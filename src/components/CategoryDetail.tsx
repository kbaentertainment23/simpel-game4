import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Lock,
  X,
  ArrowRight,
  FileText,
  Presentation,
  Video,
  ClipboardList,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Category, Material, AuthSession } from '../types';
import { MaterialViewer } from './MaterialViewer';
import { confirmExitExam, useExamSession } from '../utils/examSession';
import { checkCategoryUnlockStatus, getMaterialPrerequisiteChain, normalizeCompletedMaterialIds } from '../utils/prerequisites';
import { getMinQuizScoreToUnlock, fetchStudentQuizScores, DEFAULT_MIN_QUIZ_SCORE } from '../lib/dataService';
import { formatTargetGradeLabel } from '../utils/quizGenerator';
import { useMobileBackModal } from '../utils/mobileNavigation';
import { useBodyScrollLock } from '../utils/scrollLock';

interface CategoryDetailProps {
  category: Category;
  subjectName?: string;
  materials: Material[];
  allCategories?: Category[];
  allMaterials?: Material[];
  completedMaterialIds: string[];
  onToggleCompleted: (materialId: string, options?: { localOnly?: boolean }) => void;
  userNotes: Record<string, string>;
  onSaveNote: (materialId: string, noteText: string) => void;
  bookmarkedMaterialIds?: string[];
  onToggleBookmark?: (materialId: string) => void;
  onBackToHome: () => void;
  authSession?: AuthSession | null;
}

export const CategoryDetail: React.FC<CategoryDetailProps> = ({
  category,
  subjectName,
  materials,
  allCategories,
  allMaterials,
  completedMaterialIds,
  onToggleCompleted,
  userNotes,
  onSaveNote,
  bookmarkedMaterialIds = [],
  onToggleBookmark,
  onBackToHome,
  authSession,
}) => {
  const examSession = useExamSession();
  const isTeacherOrAdmin = authSession?.role === 'admin' || authSession?.role === 'teacher';

  const safeCompletedMaterialIds = useMemo(
    () => normalizeCompletedMaterialIds(completedMaterialIds),
    [completedMaterialIds]
  );

  // Check parent category unlock status
  const categoryStatus = useMemo(() => {
    return checkCategoryUnlockStatus(
      category,
      allCategories || [category],
      allMaterials || materials,
      safeCompletedMaterialIds,
      authSession
    );
  }, [category, allCategories, allMaterials, materials, safeCompletedMaterialIds, authSession]);

  // Only published materials, ordered canonically
  const publishedMaterials = useMemo(() => {
    return (materials || [])
      .filter((m) => m && m.isPublished)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [materials]);

  // Load min quiz passing score threshold & student's quiz records
  const [minQuizScore, setMinQuizScore] = useState<number>(DEFAULT_MIN_QUIZ_SCORE);
  const [studentScores, setStudentScores] = useState<Record<string, any>>({});

  const [activeMaterialId, setActiveMaterialId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`sistem_materi_active_mat_${category.id}`);
      if (saved && publishedMaterials.some((m) => m.id === saved)) {
        return saved;
      }
    } catch {}
    return publishedMaterials.length > 0 ? publishedMaterials[0].id : '';
  });

  // Fallback state for iframe security block (e.g. X-Frame-Options: DENY, permission errors)
  const [iframeLoadError, setIframeLoadError] = useState<boolean>(false);

  // Reset iframe error state when active material changes
  useEffect(() => {
    setIframeLoadError(false);
  }, [activeMaterialId]);

  const [lockedMatModal, setLockedMatModal] = useState<{
    targetTitle: string;
    targetLabel: string;
    targetIndex: number;
    requiredTitle: string;
    requiredLabel: string;
    requiredId: string;
    isReqMatUnlocked: boolean;
    activeAvailableTitle: string;
    activeAvailableLabel: string;
    activeAvailableId: string;
    explanation?: string;
    reason?: 'parent_topic_locked' | 'material_locked' | 'quiz_score_insufficient';
    currentScore?: number;
    minQuizScore?: number;
    totalQuestions?: number;
  } | null>(null);

  // Support Android hardware back button / swipe-to-close on mobile
  useMobileBackModal('category-detail-locked-mat-modal', Boolean(lockedMatModal), () => setLockedMatModal(null));

  // Freeze background layer and lock body scroll completely while locked material modal is active
  useBodyScrollLock(Boolean(lockedMatModal));

  useEffect(() => {
    if (!lockedMatModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLockedMatModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lockedMatModal]);

  // Helper to format material label (Materi N or Test N)
  const getMaterialLabels = useMemo(() => {
    let mCount = 0;
    let tCount = 0;
    return (publishedMaterials || []).map((mat) => {
      if (!mat) return '';
      const isGoogleForm =
        mat.type === 'gform' ||
        mat.originalUrl?.includes('docs.google.com/forms') ||
        mat.originalUrl?.includes('forms.gle') ||
        mat.embedUrl?.includes('docs.google.com/forms') ||
        mat.embedUrl?.includes('forms.gle');

      if (isGoogleForm) {
        tCount++;
        return `Test ${tCount}`;
      } else {
        mCount++;
        return `Materi ${mCount}`;
      }
    });
  }, [publishedMaterials]);

  const resolveStudentCandidateIds = (): string[] => {
    const ids: string[] = [];
    if (authSession?.student?.id) ids.push(authSession.student.id);
    if (authSession?.student?.nisn) ids.push(authSession.student.nisn);
    if (authSession?.student?.username) ids.push(authSession.student.username);
    if (authSession?.student?.nama) ids.push(authSession.student.nama);
    if ((authSession as any)?.studentAccount?.id) ids.push((authSession as any).studentAccount.id);
    if ((authSession as any)?.studentAccount?.nisn) ids.push((authSession as any).studentAccount.nisn);
    if ((authSession as any)?.studentAccount?.nama) ids.push((authSession as any).studentAccount.nama);

    try {
      const raw = localStorage.getItem('sistem_materi_auth_session');
      if (raw && raw !== 'null' && raw !== 'undefined') {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.student?.id) ids.push(parsed.student.id);
          if (parsed.student?.nisn) ids.push(parsed.student.nisn);
          if (parsed.student?.username) ids.push(parsed.student.username);
          if (parsed.student?.nama) ids.push(parsed.student.nama);
        }
      }
    } catch {}

    return Array.from(new Set(ids.filter(Boolean)));
  };

  const resolveStudentId = () => {
    const candidates = resolveStudentCandidateIds();
    return candidates[0] || 'default_student';
  };

  useEffect(() => {
    let isMounted = true;
    getMinQuizScoreToUnlock()
      .then((val) => {
        if (isMounted) setMinQuizScore(val);
      })
      .catch(() => {});

    const candidateIds = resolveStudentCandidateIds();
    const studentId = candidateIds[0] || 'default_student';

    const loadScores = (force = false) => {
      fetchStudentQuizScores(studentId, { forceRevalidate: force, additionalIds: candidateIds })
        .then((scores) => {
          if (isMounted) setStudentScores(scores || {});
        })
        .catch(() => {});
    };

    loadScores();

    // Listen to storage events for score updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('sistem_materi_student_scores_') || e.key === 'sistem_materi_min_quiz_score' || e.key.startsWith('sistem_materi_scores_'))) {
        loadScores(true);
        getMinQuizScoreToUnlock().then((v) => {
          if (isMounted) setMinQuizScore(v);
        }).catch(() => {});
      }
    };

    const handleResetEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail;
      const isTargeted =
        !detail ||
        detail.allStudents ||
        (detail.studentIds && detail.studentIds.some((id: string) => candidateIds.includes(id))) ||
        (detail.studentId && candidateIds.includes(detail.studentId));

      if (isTargeted) {
        if (detail?.materialId) {
          setStudentScores((prev) => {
            const next = { ...prev };
            delete next[detail.materialId];
            return next;
          });
        } else {
          setStudentScores({});
        }
        loadScores(true);
      }
    };

    const handleProgressSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail;
      const isTargeted =
        !detail ||
        detail.allStudents ||
        (detail.studentIds && detail.studentIds.some((id: string) => candidateIds.includes(id))) ||
        (detail.studentId && candidateIds.includes(detail.studentId));

      if (isTargeted && detail?.record?.scores) {
        setStudentScores(detail.record.scores);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('student-material-reset', handleResetEvent);
    window.addEventListener('student-progress-sync', handleProgressSync);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('student-material-reset', handleResetEvent);
      window.removeEventListener('student-progress-sync', handleProgressSync);
    };
  }, [authSession?.student?.id, authSession?.student?.nisn, authSession?.student?.nama, safeCompletedMaterialIds]);

  // Helper to determine if a material at a given index is unlocked and prerequisite details
  const checkMaterialUnlockStatus = (mat: Material, index: number) => {
    if (isTeacherOrAdmin) {
      return {
        isUnlocked: true,
        requiredMat: null as Material | null,
        requiredLabel: '',
        reason: undefined,
        currentScore: 0,
        minQuizScore,
        totalQuestions: 10,
      };
    }

    // RULE 1: If parent category is locked, ALL materials in it (including 1st) are locked!
    if (!categoryStatus.isUnlocked) {
      return {
        isUnlocked: false,
        requiredMat: null,
        requiredLabel: `Topik #${categoryStatus.requiredCatNumber || 1}`,
        reason: 'parent_topic_locked' as const,
        currentScore: 0,
        minQuizScore,
        totalQuestions: 10,
      };
    }

    // RULE 2: First material of an unlocked topic is ALWAYS unlocked
    if (index <= 0) {
      return {
        isUnlocked: true,
        requiredMat: null as Material | null,
        requiredLabel: '',
        reason: undefined,
        currentScore: 0,
        minQuizScore,
        totalQuestions: 10,
      };
    }

    // Teacher manual unlock override
    if (mat.isManuallyUnlocked) {
      return {
        isUnlocked: true,
        requiredMat: null as Material | null,
        requiredLabel: '',
        reason: undefined,
        currentScore: 0,
        minQuizScore,
        totalQuestions: 10,
      };
    }

    // Prerequisite lock is ONLY active if explicitly enabled by teacher via requirePreviousCompleted
    const isPrereqEnabled = Boolean(mat.requirePreviousCompleted);
    const hasSpecificPrereq = isPrereqEnabled && Boolean(mat.prerequisiteMaterialId && mat.prerequisiteMaterialId !== 'none');

    // If teacher hasn't locked this material, it is unlocked
    if (!isPrereqEnabled) {
      return {
        isUnlocked: true,
        requiredMat: null as Material | null,
        requiredLabel: '',
        reason: undefined,
        currentScore: 0,
        minQuizScore,
        totalQuestions: 10,
      };
    }

    const evaluatePrereqMat = (targetReq: Material, reqLabel: string) => {
      const isReqDone = safeCompletedMaterialIds.includes(targetReq.id);
      const scoreRecord = studentScores[targetReq.id];

      if (scoreRecord !== undefined && scoreRecord !== null) {
        let correctCount = 0;
        let totalQ = targetReq.quizSelectedQuestionIds?.length || targetReq.quizQuestions?.length || 10;
        let percentage = 0;

        if (typeof scoreRecord === 'number') {
          if (scoreRecord <= totalQ && totalQ > 0) {
            correctCount = scoreRecord;
            percentage = Math.round((correctCount / totalQ) * 100);
          } else {
            percentage = scoreRecord;
            correctCount = Math.round((percentage / 100) * totalQ);
          }
        } else if (typeof scoreRecord === 'object') {
          correctCount = scoreRecord.score ?? 0;
          totalQ = scoreRecord.totalQuestions || totalQ;
          percentage = scoreRecord.percentage ?? (totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0);
        }

        if (correctCount >= totalQ && totalQ > 0) {
          correctCount = totalQ;
          percentage = 100;
        }

        const minPercent = minQuizScore <= 10 ? minQuizScore * 10 : minQuizScore;
        const reqCorrect = Math.max(1, Math.ceil((minPercent / 100) * totalQ));
        const isPassed = correctCount >= totalQ || percentage >= minPercent || correctCount >= reqCorrect;

        if (!isPassed) {
          return {
            isUnlocked: false,
            requiredMat: targetReq,
            requiredLabel: reqLabel,
            reason: 'quiz_score_insufficient' as const,
            currentScore: correctCount,
            minQuizScore: reqCorrect,
            totalQuestions: totalQ,
          };
        }
      } else if (!isReqDone) {
        return {
          isUnlocked: false,
          requiredMat: targetReq,
          requiredLabel: reqLabel,
          reason: 'material_locked' as const,
          currentScore: 0,
          minQuizScore,
          totalQuestions: 10,
        };
      }

      return {
        isUnlocked: true,
        requiredMat: targetReq,
        requiredLabel: reqLabel,
        reason: undefined,
        currentScore: 0,
        minQuizScore,
        totalQuestions: 10,
      };
    };

    // If specific prerequisite material is set (and not 'previous')
    if (hasSpecificPrereq && mat.prerequisiteMaterialId !== 'previous') {
      const targetReq = (allMaterials || materials).find((m) => m.id === mat.prerequisiteMaterialId);
      if (targetReq) {
        const reqIdx = publishedMaterials.findIndex((m) => m.id === targetReq.id);
        const reqLabel = reqIdx >= 0 ? getMaterialLabels[reqIdx] : `Materi #${targetReq.order}`;
        return evaluatePrereqMat(targetReq, reqLabel);
      }
    }

    // Default sequential: requires previous material (index - 1)
    if (index > 0) {
      const prevMat = publishedMaterials[index - 1];
      const reqLabel = getMaterialLabels[index - 1] || `Materi ${index}`;
      return evaluatePrereqMat(prevMat, reqLabel);
    }

    return {
      isUnlocked: true,
      requiredMat: null as Material | null,
      requiredLabel: '',
      reason: undefined,
      currentScore: 0,
      minQuizScore,
      totalQuestions: 10,
    };
  };

  // Helper to determine if a material at a given index is unlocked
  const isMaterialUnlocked = (index: number) => {
    if (index < 0 || index >= publishedMaterials.length) return false;
    const mat = publishedMaterials[index];
    return checkMaterialUnlockStatus(mat, index).isUnlocked;
  };

  useEffect(() => {
    if (activeMaterialId) {
      localStorage.setItem(`sistem_materi_active_mat_${category.id}`, activeMaterialId);
    }
  }, [activeMaterialId, category.id]);

  // Scroll to top and sync active material when entering category detail
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (typeof document !== 'undefined') {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    try {
      const saved = localStorage.getItem(`sistem_materi_active_mat_${category.id}`);
      if (saved && publishedMaterials.some((m) => m.id === saved)) {
        setActiveMaterialId(saved);
      }
    } catch {}
  }, [category.id, publishedMaterials]);

  // Ensure activeMaterialId is valid and not a locked material for students
  useEffect(() => {
    if (publishedMaterials.length === 0) return;

    const currentIdx = publishedMaterials.findIndex((m) => m.id === activeMaterialId);
    
    // If current material is not in list OR for students it's currently locked
    if (currentIdx === -1 || (!isTeacherOrAdmin && !isMaterialUnlocked(currentIdx))) {
      // Find the highest unlocked material
      let highestUnlockedIdx = 0;
      for (let i = 0; i < publishedMaterials.length; i++) {
        if (isMaterialUnlocked(i)) {
          highestUnlockedIdx = i;
        } else {
          break;
        }
      }
      if (highestUnlockedIdx >= 0 && publishedMaterials[highestUnlockedIdx]) {
        setActiveMaterialId(publishedMaterials[highestUnlockedIdx].id);
      }
    }
  }, [publishedMaterials, safeCompletedMaterialIds, activeMaterialId, isTeacherOrAdmin, studentScores, minQuizScore]);

  const activeMaterial = publishedMaterials.find((m) => m.id === activeMaterialId) || publishedMaterials[0];
  const currentIndex = publishedMaterials.findIndex((m) => m.id === (activeMaterial?.id));

  const completedCount = publishedMaterials.filter((m) => safeCompletedMaterialIds.includes(m.id)).length;
  const isAllCompleted = publishedMaterials.length > 0 && completedCount === publishedMaterials.length;

  // If parent topic is locked for students, show locked screen instead of material content
  if (!categoryStatus.isUnlocked && !isTeacherOrAdmin) {
    const reqCat = categoryStatus.requiredCategory;
    const reqMats = (allMaterials || materials).filter((m) => reqCat && m.categoryId === reqCat.id && m.isPublished);
    const completedReqMats = reqMats.filter((m) => safeCompletedMaterialIds.includes(m.id)).length;
    const reqStatus = reqCat
      ? checkCategoryUnlockStatus(
          reqCat,
          allCategories || [reqCat],
          allMaterials || materials,
          safeCompletedMaterialIds,
          authSession
        )
      : null;

    return (
      <div className="w-full max-w-full space-y-4 animate-in fade-in duration-300 py-4">
        <button
          onClick={() => confirmExitExam(onBackToHome)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer group ring-2 ring-indigo-300/60"
        >
          <ArrowLeft className="w-4 h-4 stroke-[3] group-hover:-translate-x-0.5 transition-transform" />
          <span>Kembali ke Daftar Topik</span>
        </button>

        <div className="p-6 sm:p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-mono uppercase font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
              Topik Pembelajaran Terkunci
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 pt-1">{category.title}</h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Kamu belum dapat mengakses materi pada topik ini karena seluruh materi pada topik prasyarat belum diselesaikan secara berurutan.
            </p>
          </div>

          {reqCat && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">Prasyarat Wajib:</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                  reqStatus?.isUnlocked ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {reqStatus?.isUnlocked ? `${completedReqMats}/${reqMats.length} Selesai` : 'Masih Terkunci'}
                </span>
              </div>
              <p className="font-extrabold text-sm text-slate-900">
                Topik #{categoryStatus.requiredCatNumber || 1}: {reqCat.title}
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => confirmExitExam(onBackToHome)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
            >
              Kembali ke Pilihan Topik
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-full overflow-x-hidden space-y-3 sm:space-y-5 lg:space-y-6 animate-in fade-in duration-300 relative ${lockedMatModal ? 'overflow-hidden max-h-screen pointer-events-none select-none touch-none overscroll-none' : ''}`}>
      
      {/* Background layer: fully frozen (interactively & visually) while popup is displayed */}
      <div
        className={`w-full max-w-full space-y-3 sm:space-y-5 lg:space-y-6 transition-all duration-200 ${
          lockedMatModal
            ? 'filter blur-[3px] grayscale-[25%] opacity-60 pointer-events-none select-none touch-none overscroll-none'
            : ''
        }`}
        style={
          lockedMatModal
            ? {
                touchAction: 'none',
                overscrollBehavior: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }
            : undefined
        }
        aria-hidden={Boolean(lockedMatModal)}
        {...(lockedMatModal ? { inert: true } : {})}
      >
        {/* Top Navigation & Breadcrumb */}
      {!examSession.isActive && (
        <div className="flex items-center justify-between gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => confirmExitExam(onBackToHome)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer group ring-2 ring-indigo-300/60"
          >
            <ArrowLeft className="w-4 h-4 text-white stroke-[3] group-hover:-translate-x-0.5 transition-transform" />
            <span>Kembali</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span onClick={() => confirmExitExam(onBackToHome)} className="hover:text-indigo-600 cursor-pointer shrink-0">Topik</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="text-slate-900 font-bold truncate">{category.title}</span>
          </div>
        </div>
      )}

      {/* Category Header Card (Matching SubjectSelector theme) */}
      {!examSession.isActive && (
        <div className="relative overflow-hidden rounded-xl sm:rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-3 sm:p-5 lg:p-6 border border-indigo-500/30 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-5 w-full max-w-full">
          {/* Subtle Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-10 w-60 h-60 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-base sm:text-2xl font-black text-white tracking-tight leading-snug drop-shadow-xs break-words">
                {category.title}
              </h1>
              {subjectName && (
                <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-extrabold bg-white/15 text-indigo-100 border border-white/20">
                  {subjectName}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-extrabold bg-white/15 text-indigo-100 border border-white/20">
                🎓 {formatTargetGradeLabel(category.targetGrade)}
              </span>
            </div>
          </div>

          {/* Progress Badge */}
          <div className="relative z-10 bg-slate-800/80 backdrop-blur-md p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-700/80 shrink-0 flex flex-col justify-center gap-1 shadow-xs w-full lg:w-auto lg:min-w-[220px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs text-slate-300 font-bold">Progres Topik</span>
              <span 
                key={`cat-detail-pct-${publishedMaterials.length > 0 ? Math.round((completedCount / publishedMaterials.length) * 100) : 0}`} 
                className="text-[10px] sm:text-xs font-black text-amber-300 bg-amber-400/20 border border-amber-300/40 px-1.5 py-0.5 rounded-md animate-in zoom-in-95 duration-300 inline-block"
              >
                {publishedMaterials.length > 0 ? Math.round((completedCount / publishedMaterials.length) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-slate-900/90 rounded-full h-1.5 sm:h-2 overflow-hidden border border-slate-700/60 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-indigo-400 via-emerald-400 to-teal-300 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${publishedMaterials.length > 0 ? Math.round((completedCount / publishedMaterials.length) * 100) : 0}%` }}
              />
            </div>
            <div className="text-[10px] sm:text-[11px] font-extrabold text-indigo-200/90 text-right">
              {completedCount}/{publishedMaterials.length} Materi Selesai
            </div>
          </div>
        </div>
      )}

      {/* Material Selector Tabs / Cards */}
      {publishedMaterials.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <BookOpen className="w-7 h-7 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm">Materi Belum Tersedia</h3>
          <p className="text-xs text-slate-400">Belum ada link materi yang diunggah untuk topik ini.</p>
        </div>
      ) : (
        <div className="w-full max-w-full space-y-2.5 sm:space-y-4">
          {/* Material Navigation Tabs / Grid Selector */}
          {!examSession.isActive && publishedMaterials.length > 1 && (
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/90 p-2 sm:p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 px-1 mb-2">
                <span className="text-[11px] sm:text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Daftar Materi & Ujian ({publishedMaterials.length})</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  Pilih materi di bawah untuk membuka
                </span>
              </div>

              {/* Horizontal Scroll on Mobile / Wrap Grid on Desktop */}
              <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 overflow-x-auto pb-1 sm:pb-0 scroll-smooth overscroll-x-contain touch-pan-x scrollbar-none">
                {(publishedMaterials || []).map((mat, idx) => {
                  if (!mat) return null;
                  const label = getMaterialLabels[idx];
                  const unlockStatus = checkMaterialUnlockStatus(mat, idx);
                  const isUnlocked = unlockStatus.isUnlocked || isTeacherOrAdmin;
                  const isCurrent = mat.id === activeMaterialId;
                  const isDone = safeCompletedMaterialIds.includes(mat.id);

                  const isGForm =
                    mat.type === 'gform' ||
                    mat.originalUrl?.includes('docs.google.com/forms') ||
                    mat.embedUrl?.includes('docs.google.com/forms');

                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => {
                        if (isUnlocked) {
                          confirmExitExam(() => setActiveMaterialId(mat.id));
                        } else {
                          // Try getting prerequisite chain from helper
                          const chain = getMaterialPrerequisiteChain(
                            mat,
                            allMaterials || materials,
                            allCategories || [category],
                            safeCompletedMaterialIds,
                            authSession,
                            studentScores,
                            minQuizScore
                          );

                          let reqMat = chain?.immediateRequiredMaterial || unlockStatus.requiredMat;
                          let reqLabel = chain?.immediateRequiredLabel || unlockStatus.requiredLabel || '';

                          // Accurately determine if the immediate prerequisite material is unlocked
                          let isReqUnlocked = false;
                          if (reqMat) {
                            const reqIdx = publishedMaterials.findIndex((m) => m.id === reqMat!.id);
                            if (reqIdx >= 0) {
                              if (!reqLabel) reqLabel = getMaterialLabels[reqIdx];
                              isReqUnlocked = checkMaterialUnlockStatus(reqMat, reqIdx).isUnlocked;
                            } else {
                              isReqUnlocked = chain ? chain.isImmediateRequiredUnlocked : false;
                            }
                          }

                          let activeMat = chain?.activeAvailableMaterial || reqMat;
                          let activeLabel = chain?.activeAvailableLabel || reqLabel;

                          // If immediate prerequisite is ALSO locked, trace backward to the first unlocked material
                          if (!isReqUnlocked) {
                            let firstUnlockedIdx = 0;
                            for (let i = 0; i < publishedMaterials.length; i++) {
                              if (checkMaterialUnlockStatus(publishedMaterials[i], i).isUnlocked) {
                                firstUnlockedIdx = i;
                              } else {
                                break;
                              }
                            }
                            activeMat = publishedMaterials[firstUnlockedIdx] || publishedMaterials[0];
                            activeLabel = getMaterialLabels[firstUnlockedIdx] || `Materi ${firstUnlockedIdx + 1}`;
                          }

                          const explanation = !isReqUnlocked && activeMat
                            ? `${reqLabel} saat ini masih terkunci karena kamu harus menyelesaikan ${activeLabel} (${activeMat.title}) terlebih dahulu.`
                            : chain?.explanation;

                          setLockedMatModal({
                            targetTitle: mat.title,
                            targetLabel: label,
                            targetIndex: idx,
                            requiredTitle: reqMat?.title || (unlockStatus.reason === 'parent_topic_locked' ? (categoryStatus.requiredCategory?.title || 'Topik Prasyarat') : ''),
                            requiredLabel: reqLabel,
                            requiredId: reqMat?.id || '',
                            isReqMatUnlocked: isReqUnlocked,
                            activeAvailableTitle: activeMat?.title || '',
                            activeAvailableLabel: activeLabel,
                            activeAvailableId: activeMat?.id || '',
                            explanation: explanation,
                            reason: unlockStatus.reason,
                            currentScore: unlockStatus.currentScore,
                            minQuizScore: unlockStatus.minQuizScore,
                            totalQuestions: unlockStatus.totalQuestions,
                          });
                        }
                      }}
                      className={`min-w-[140px] sm:min-w-0 flex-1 sm:flex-initial text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between gap-1.5 shrink-0 ${
                        isCurrent
                          ? 'bg-indigo-50/90 border-indigo-500/80 ring-2 ring-indigo-400/40 shadow-xs'
                          : isUnlocked
                          ? 'bg-slate-50/70 hover:bg-slate-100/90 border-slate-200/80 text-slate-700'
                          : 'bg-slate-100/60 border-slate-200/60 text-slate-400 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : isGForm
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-slate-200/80 text-slate-700'
                          }`}
                        >
                          {label}
                        </span>

                        <div className="flex items-center gap-1">
                          {isDone ? (
                            <span className="text-emerald-600 flex items-center gap-0.5 text-[10px] font-extrabold bg-emerald-50 px-1 py-0.5 rounded-md border border-emerald-200/60">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="hidden xs:inline">Tuntas</span>
                            </span>
                          ) : !isUnlocked ? (
                            <span className="text-slate-400 bg-slate-200/60 p-0.5 rounded">
                              <Lock className="w-3 h-3" />
                            </span>
                          ) : isGForm ? (
                            <ClipboardList className="w-3.5 h-3.5 text-purple-500" />
                          ) : mat.type === 'slides' ? (
                            <Presentation className="w-3.5 h-3.5 text-amber-500" />
                          ) : mat.type === 'video' ? (
                            <Video className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                          )}
                        </div>
                      </div>

                      <p
                        className={`text-xs font-bold line-clamp-1 break-words ${
                          isCurrent ? 'text-indigo-950 font-black' : isUnlocked ? 'text-slate-800' : 'text-slate-500'
                        }`}
                      >
                        {mat.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Sequential Completion Banner (Prompting next module) */}
          {!examSession.isActive && activeMaterial && safeCompletedMaterialIds.includes(activeMaterial.id) && currentIndex < publishedMaterials.length - 1 && (
            <div className="w-full max-w-full bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/90 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5 shadow-2xs animate-in fade-in duration-300">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-emerald-950 truncate">
                    Materi ini telah tuntas! Modul berikutnya sudah terbuka.
                  </p>
                  <p className="text-[11px] text-emerald-700 font-semibold truncate hidden sm:block">
                    Lanjut ke {getMaterialLabels[currentIndex + 1]}: {publishedMaterials[currentIndex + 1]?.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const nextIdx = currentIndex + 1;
                  if (nextIdx < publishedMaterials.length && (isMaterialUnlocked(nextIdx) || isTeacherOrAdmin)) {
                    const nextMat = publishedMaterials[nextIdx];
                    confirmExitExam(() => setActiveMaterialId(nextMat.id));
                  }
                }}
                className="w-full xs:w-auto h-8 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-1 shrink-0 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <span>Lanjut Belajar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Material Embedded Viewer wrapped in responsive iframe-wrapper */}
          <AnimatePresence mode="wait">
            {activeMaterial && (
              <motion.div
                key={activeMaterial.id}
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.995 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-full space-y-3"
              >
                {/* Fallback Notice Bar if iframe encounters X-Frame-Options: DENY or access error */}
                {iframeLoadError && (
                  <div className="p-3.5 sm:p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fadeIn text-xs text-amber-950">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5 sm:mt-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-extrabold text-amber-900">
                          Konten Dibatasi oleh Penyedia ('X-Frame-Options: DENY' atau Batasan Akun)
                        </p>
                        <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                          Penyedia dokumen atau browser membatasi pratinjau langsung di dalam frame. Silakan gunakan tombol di samping untuk membuka dokumen di tab baru.
                        </p>
                      </div>
                    </div>
                    <a
                      href={activeMaterial.originalUrl || activeMaterial.embedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer self-stretch sm:self-auto justify-center hover:scale-[1.02] active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Tab Baru</span>
                    </a>
                  </div>
                )}

                {/* Responsive iframe-wrapper Container */}
                <div className="iframe-wrapper w-full max-w-full relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all">
                  {/* Top helper header for iframe-wrapper */}
                  <div className="px-3 sm:px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 font-medium truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-[11px] font-bold text-slate-700 truncate">
                        {activeMaterial.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIframeLoadError((prev) => !prev)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Klik jika konten tidak tampil atau terhalang izin"
                      >
                        {iframeLoadError ? 'Tutup Info' : 'Kendala Tampilan?'}
                      </button>

                      {(activeMaterial.originalUrl || activeMaterial.embedUrl) && (
                        <a
                          href={activeMaterial.originalUrl || activeMaterial.embedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 hover:text-indigo-800 border border-slate-200 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                          title="Buka dokumen di tab browser baru"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Buka di Tab Baru</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Material Viewer inside iframe-wrapper */}
                  <MaterialViewer
                    material={activeMaterial}
                    category={category}
                    subjectName={subjectName}
                    isCompleted={safeCompletedMaterialIds.includes(activeMaterial.id)}
                    onToggleCompleted={onToggleCompleted}
                    userNote={userNotes[activeMaterial.id] || ''}
                    onSaveNote={onSaveNote}
                    isBookmarked={Array.isArray(bookmarkedMaterialIds) && bookmarkedMaterialIds.includes(activeMaterial.id)}
                    onToggleBookmark={onToggleBookmark}
                    nextMaterial={currentIndex < publishedMaterials.length - 1 ? publishedMaterials[currentIndex + 1] : null}
                    onNextMaterial={() => {
                      const nextIdx = currentIndex + 1;
                      if (nextIdx < publishedMaterials.length && (isMaterialUnlocked(nextIdx) || isTeacherOrAdmin)) {
                        const nextMat = publishedMaterials[nextIdx];
                        confirmExitExam(() => {
                          setActiveMaterialId(nextMat.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        });
                      }
                    }}
                    onIframeError={() => setIframeLoadError(true)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}

      </div>

      {/* Locked Material Alert Modal */}
      {lockedMatModal && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto touch-none select-none overscroll-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLockedMatModal(null);
            }
          }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            data-modal-scrollable="true"
            className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200/90 space-y-4 animate-in zoom-in-95 duration-200 relative ring-1 ring-white/20 pointer-events-auto max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <button
              onClick={() => setLockedMatModal(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border ${
                lockedMatModal.reason === 'quiz_score_insufficient'
                  ? 'bg-rose-100 border-rose-200 text-rose-700'
                  : 'bg-amber-100 border-amber-200 text-amber-700'
              }`}>
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md border ${
                  lockedMatModal.reason === 'quiz_score_insufficient'
                    ? 'text-rose-800 bg-rose-50 border-rose-200'
                    : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}>
                  {lockedMatModal.reason === 'quiz_score_insufficient' ? 'Nilai Kuis Belum KKM' : 'Materi Terkunci'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {lockedMatModal.reason === 'quiz_score_insufficient'
                    ? 'Selesaikan Mini Kuis Materi Prasyarat'
                    : 'Selesaikan Materi Sebelumnya'}
                </h3>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5 text-xs text-slate-700 leading-relaxed">
              {lockedMatModal.reason === 'quiz_score_insufficient' ? (
                <p>
                  Untuk mengakses <strong>{lockedMatModal.targetLabel} ({lockedMatModal.targetTitle})</strong>, kamu wajib mencapai nilai minimal <strong>{lockedMatModal.minQuizScore || 8} dari {lockedMatModal.totalQuestions || 10} soal benar</strong> pada mini kuis materi prasyarat.
                </p>
              ) : (
                <p>
                  Untuk mengakses <strong>{lockedMatModal.targetLabel} ({lockedMatModal.targetTitle})</strong>, kamu harus menyelesaikan materi prasyarat terlebih dahulu secara berurutan.
                </p>
              )}

              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-500">Materi Prasyarat:</p>
                    <p className="font-extrabold text-slate-900 truncate">
                      {lockedMatModal.requiredLabel}: {lockedMatModal.requiredTitle}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded border shrink-0 ${
                    !lockedMatModal.isReqMatUnlocked
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : lockedMatModal.reason === 'quiz_score_insufficient'
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                  }`}>
                    {!lockedMatModal.isReqMatUnlocked
                      ? 'Masih Terkunci'
                      : lockedMatModal.reason === 'quiz_score_insufficient'
                      ? 'Perlu Kuis Ulang'
                      : 'Belum Selesai'}
                  </span>
                </div>

                {!lockedMatModal.isReqMatUnlocked && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                      <p className="font-bold flex items-center gap-1.5 text-amber-800">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>{lockedMatModal.requiredLabel} juga belum terbuka</span>
                      </p>
                      <p className="text-[11px] mt-1 text-amber-800/90 font-medium">
                        {lockedMatModal.explanation || `Kamu harus menyelesaikan ${lockedMatModal.activeAvailableLabel} (${lockedMatModal.activeAvailableTitle}) terlebih dahulu.`}
                      </p>
                    </div>
                  </div>
                )}

                {lockedMatModal.reason === 'quiz_score_insufficient' && (
                  <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-rose-50/70 p-1.5 rounded-lg border border-rose-100">
                      <p className="text-[10px] font-bold text-rose-600">Skor Tertinggi Kamu</p>
                      <p className="text-xs font-black text-rose-800">
                        {lockedMatModal.currentScore || 0}/{lockedMatModal.totalQuestions || 10} Benar
                      </p>
                    </div>
                    <div className="bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600">Syarat Kelulusan (KKM)</p>
                      <p className="text-xs font-black text-emerald-800">
                        Min. {lockedMatModal.minQuizScore || 8}/{lockedMatModal.totalQuestions || 10} Benar
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              {lockedMatModal.reason === 'parent_topic_locked' ? (
                <button
                  onClick={() => {
                    setLockedMatModal(null);
                    confirmExitExam(onBackToHome);
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-center"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>Kembali ke Pilihan Topik</span>
                </button>
              ) : lockedMatModal.isReqMatUnlocked && lockedMatModal.requiredId ? (
                <button
                  onClick={() => {
                    const reqId = lockedMatModal.requiredId;
                    setLockedMatModal(null);
                    confirmExitExam(() => setActiveMaterialId(reqId));
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-center"
                >
                  <span>{lockedMatModal.reason === 'quiz_score_insufficient' ? `Kerjakan Kuis ${lockedMatModal.requiredLabel}` : `Buka ${lockedMatModal.requiredLabel}`}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              ) : lockedMatModal.activeAvailableId ? (
                <button
                  onClick={() => {
                    const activeId = lockedMatModal.activeAvailableId;
                    setLockedMatModal(null);
                    confirmExitExam(() => setActiveMaterialId(activeId));
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-center"
                >
                  <span>Buka {lockedMatModal.activeAvailableLabel} (Mulai Belajar)</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              ) : null}
              <button
                onClick={() => setLockedMatModal(null)}
                className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
