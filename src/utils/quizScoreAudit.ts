import { doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { STUDENT_PROGRESS_COL } from '../lib/dataService';
import { StudentProgressRecord } from '../types';
import { normalizeQuizScoreRecord } from './quizScoring';

export interface ScoreDiscrepancyItem {
  studentId: string;
  studentName?: string;
  studentClass?: string;
  materialId: string;
  issue: string;
  originalScore?: number;
  originalPercentage?: number;
  originalTotalQuestions?: number;
  originalScoresMapValue?: number;
  inCompletedList: boolean;
  proposedScore?: number;
  proposedPercentage?: number;
  proposedTotalQuestions?: number;
  action: 'healable' | 'manual_review_needed';
}

export interface QuizScoreAuditReport {
  scannedAt: string;
  totalStudentsScanned: number;
  totalDiscrepanciesFound: number;
  healableCount: number;
  manualReviewCount: number;
  items: ScoreDiscrepancyItem[];
}

/**
 * Scans all student progress records for data integrity issues in quiz scores.
 * Does not modify any data.
 */
export function auditQuizScores(allProgress: Record<string, StudentProgressRecord>): QuizScoreAuditReport {
  const items: ScoreDiscrepancyItem[] = [];
  const entries = Object.entries(allProgress || {});

  for (const [studentDocId, prog] of entries) {
    if (!prog) continue;

    const sId = prog.studentId || studentDocId;
    const sName = prog.studentName || '';
    const sClass = prog.kelas || '';
    const completedSet = new Set(Array.isArray(prog.completedMaterialIds) ? prog.completedMaterialIds : []);
    const scoresMap = prog.scores || {};
    const attemptsMap = prog.quizAttempts || {};

    const allMaterialIds = new Set<string>([
      ...completedSet,
      ...Object.keys(scoresMap),
      ...Object.keys(attemptsMap),
    ]);

    for (const mId of allMaterialIds) {
      const attempt = attemptsMap[mId];
      const mapScore = scoresMap[mId];
      const isCompleted = completedSet.has(mId);

      const hasAttempt = attempt !== undefined && attempt !== null;
      const hasMapScore = mapScore !== undefined && mapScore !== null;

      if (!hasAttempt && !hasMapScore) {
        continue;
      }

      const rawScore = attempt?.score;
      const rawPercent = attempt?.percentage;
      const rawTotal = attempt?.totalQuestions;

      let issue = '';
      let action: 'healable' | 'manual_review_needed' = 'healable';

      // Discrepancy 1: Percentage > 0 but score === 0 with totalQuestions > 0
      if (rawScore === 0 && typeof rawPercent === 'number' && rawPercent > 0) {
        issue = `Persentase ${rawPercent}% tetapi jumlah benar tercatat 0`;
      }
      // Discrepancy 2: Score > 0 but percentage === 0
      else if (typeof rawScore === 'number' && rawScore > 0 && rawPercent === 0) {
        issue = `Jumlah benar ${rawScore} tetapi persentase tercatat 0%`;
      }
      // Discrepancy 3: Score exceeds total questions
      else if (typeof rawScore === 'number' && typeof rawTotal === 'number' && rawScore > rawTotal && rawTotal > 0) {
        issue = `Jumlah benar (${rawScore}) melebihi jumlah total soal (${rawTotal})`;
      }
      // Discrepancy 4: Inconsistent values between scores[mId] and quizAttempts[mId].percentage
      else if (hasAttempt && hasMapScore && rawPercent !== undefined && Math.abs(rawPercent - Number(mapScore)) > 1) {
        // Check if mapScore is raw correct scale (e.g. 8 vs 80%)
        if (!(Number(mapScore) <= 10 && Math.round((Number(mapScore) / (rawTotal || 10)) * 100) === rawPercent)) {
          issue = `Nilai pada scores (${mapScore}) berbeda dari quizAttempts.percentage (${rawPercent}%)`;
        }
      }
      // Discrepancy 5: Marked completed and passed KKM, but recorded score/percentage is 0
      else if (isCompleted && ((rawScore === 0 && rawPercent === 0) || (mapScore === 0 && !hasAttempt))) {
        issue = `Materi berstatus Selesai (Lulus KKM) namun nilai tersimpan adalah 0`;
        action = 'manual_review_needed';
      }

      if (issue) {
        const normalized = normalizeQuizScoreRecord(attempt, mapScore, rawTotal || 10, 80);
        items.push({
          studentId: sId,
          studentName: sName,
          studentClass: sClass,
          materialId: mId,
          issue,
          originalScore: rawScore,
          originalPercentage: rawPercent,
          originalTotalQuestions: rawTotal,
          originalScoresMapValue: typeof mapScore === 'number' ? mapScore : undefined,
          inCompletedList: isCompleted,
          proposedScore: normalized.score,
          proposedPercentage: normalized.percentage,
          proposedTotalQuestions: normalized.totalQuestions,
          action,
        });
      }
    }
  }

  const healableCount = items.filter((i) => i.action === 'healable').length;
  const manualReviewCount = items.filter((i) => i.action === 'manual_review_needed').length;

  return {
    scannedAt: new Date().toISOString(),
    totalStudentsScanned: entries.length,
    totalDiscrepanciesFound: items.length,
    healableCount,
    manualReviewCount,
    items,
  };
}

/**
 * Self-healing mechanism for provable score inconsistencies.
 * If dryRun is true, calculates proposed fixes without committing to Firestore.
 * If dryRun is false, updates Firestore in atomic chunks.
 */
export async function healInconsistentQuizScores(
  allProgress: Record<string, StudentProgressRecord>,
  options: { dryRun?: boolean } = { dryRun: true }
): Promise<{
  dryRun: boolean;
  totalScanned: number;
  repairedCount: number;
  skippedCount: number;
  report: QuizScoreAuditReport;
}> {
  const auditReport = auditQuizScores(allProgress);
  const healableItems = auditReport.items.filter((i) => i.action === 'healable');

  if (options.dryRun || healableItems.length === 0) {
    return {
      dryRun: Boolean(options.dryRun),
      totalScanned: auditReport.totalStudentsScanned,
      repairedCount: healableItems.length,
      skippedCount: auditReport.manualReviewCount,
      report: auditReport,
    };
  }

  // Group healable items by studentId to do single update per student
  const studentUpdates = new Map<string, {
    scores: Record<string, number>;
    quizAttempts: Record<string, any>;
  }>();

  for (const item of healableItems) {
    let studentObj = studentUpdates.get(item.studentId);
    if (!studentObj) {
      const orig = (allProgress[item.studentId] as StudentProgressRecord) || ({} as any);
      studentObj = {
        scores: { ...(orig.scores || {}) },
        quizAttempts: { ...(orig.quizAttempts || {}) },
      };
      studentUpdates.set(item.studentId, studentObj);
    }

    if (item.proposedPercentage !== undefined && item.proposedScore !== undefined) {
      studentObj.scores[item.materialId] = item.proposedPercentage;
      studentObj.quizAttempts[item.materialId] = {
        score: item.proposedScore,
        totalQuestions: item.proposedTotalQuestions || 10,
        percentage: item.proposedPercentage,
        updatedAt: new Date().toISOString(),
        isPassed: item.proposedPercentage >= 80,
      };
    }
  }

  // Commit updates in batches of 400
  const studentEntries = Array.from(studentUpdates.entries());
  for (let i = 0; i < studentEntries.length; i += 400) {
    const chunk = studentEntries.slice(i, i + 400);
    const batch = writeBatch(db);

    for (const [sId, updates] of chunk) {
      const ref = doc(db, STUDENT_PROGRESS_COL, sId);
      batch.update(ref, {
        scores: updates.scores,
        quizAttempts: updates.quizAttempts,
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  }

  return {
    dryRun: false,
    totalScanned: auditReport.totalStudentsScanned,
    repairedCount: healableItems.length,
    skippedCount: auditReport.manualReviewCount,
    report: auditReport,
  };
}

/**
 * Convenience runner: Reads all student progress records from Firestore and LocalStorage,
 * runs data integrity audit, and optionally repairs healable inconsistencies.
 */
export async function runQuizScoreAuditAndRepair(dryRun: boolean = false): Promise<{
  report: QuizScoreAuditReport;
  repairedCount: number;
  dryRun: boolean;
}> {
  const allProgress: Record<string, StudentProgressRecord> = {};

  try {
    const snap = await getDocs(collection(db, STUDENT_PROGRESS_COL));
    for (const d of snap.docs) {
      allProgress[d.id] = { id: d.id, ...d.data() } as StudentProgressRecord;
    }
  } catch (err) {
    console.warn('Could not read student_progress from Firestore during audit:', err);
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('student_progress_') || key.startsWith('app_student_progress_'))) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const sId = parsed.studentId || key.replace(/^.*progress_/, '');
          if (!allProgress[sId]) {
            allProgress[sId] = parsed;
          }
        }
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }

  const result = await healInconsistentQuizScores(allProgress, { dryRun });
  return {
    report: result.report,
    repairedCount: result.repairedCount,
    dryRun: result.dryRun,
  };
}

