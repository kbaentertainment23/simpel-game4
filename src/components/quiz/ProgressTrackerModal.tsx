import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Copy,
  Download,
  RotateCcw,
  Search,
  Send,
  BookOpen,
  GraduationCap,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Check,
  Loader2,
  Filter,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Material, StudentAccount, Subject, Category, StudentProgressRecord } from '../../types';
import {
  fetchAllStudentProgress,
  getMinQuizScoreToUnlock,
  DEFAULT_MIN_QUIZ_SCORE,
  resetStudentMaterialProgress,
  getMergedStudentProgress,
} from '../../lib/dataService';

export interface ProgressTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMaterial: Material | null;
  students: StudentAccount[];
  categories?: Category[];
  subjects?: Subject[];
  masterClasses?: string[];
  minQuizScore?: number;
  initialClass?: string;
  initialTab?: 'not_attempted' | 'remedial' | 'passed' | 'all';
  onResetStudent?: (studentId: string, studentName: string) => Promise<void>;
  showNotify?: (type: 'success' | 'error', message: string) => void;
}

export interface StudentProgressEvaluationRow {
  studentId: string;
  nisn: string;
  nama: string;
  kelas: string;
  noAbsen: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
  hasAttempted: boolean;
  isCompletedInProg: boolean;
  completedAt?: string;
  statusText: 'TUNTAS' | 'REMEDIAL' | 'BELUM MENGERJAKAN';
}

export const ProgressTrackerModal: React.FC<ProgressTrackerModalProps> = ({
  isOpen,
  onClose,
  activeMaterial,
  students = [],
  categories = [],
  subjects = [],
  masterClasses = [],
  minQuizScore: initialKkm,
  initialClass = 'all',
  initialTab = 'not_attempted',
  onResetStudent,
  showNotify,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(initialClass);
  const [activeTab, setActiveTab] = useState<'not_attempted' | 'remedial' | 'passed' | 'all'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [progressMap, setProgressMap] = useState<Record<string, StudentProgressRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [kkmScore, setKkmScore] = useState<number>(() => {
    if (typeof initialKkm === 'number' && initialKkm > 0) {
      return initialKkm <= 10 ? initialKkm * 10 : initialKkm;
    }
    return DEFAULT_MIN_QUIZ_SCORE;
  });

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync initial props on open
  useEffect(() => {
    if (isOpen) {
      if (initialClass) setSelectedClass(initialClass);
      if (initialTab) setActiveTab(initialTab);
      setSearchQuery('');
    }
  }, [isOpen, initialClass, initialTab]);

  // Freeze background layer when modal is open
  useEffect(() => {
    if (!isOpen) return;

    // Get current scroll position of the window
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Save previous styles
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyLeft = document.body.style.left;
    const originalBodyRight = document.body.style.right;
    const originalBodyWidth = document.body.style.width;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    // Freeze both html and body completely
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Prevent wheel and touch scrolling from propagating through the backdrop
    const backdropEl = backdropRef.current;
    const handlePreventScroll = (e: Event) => {
      if (e.target === backdropEl) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    if (backdropEl) {
      backdropEl.addEventListener('wheel', handlePreventScroll, { passive: false });
      backdropEl.addEventListener('touchmove', handlePreventScroll, { passive: false });
    }

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.left = originalBodyLeft;
      document.body.style.right = originalBodyRight;
      document.body.style.width = originalBodyWidth;
      document.body.style.paddingRight = originalBodyPaddingRight;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handleKeyDown);

      if (backdropEl) {
        backdropEl.removeEventListener('wheel', handlePreventScroll);
        backdropEl.removeEventListener('touchmove', handlePreventScroll);
      }
    };
  }, [isOpen, onClose]);

  // Load KKM and Progress
  const loadProgressData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [kkmVal, allProg] = await Promise.all([
        getMinQuizScoreToUnlock().catch(() => DEFAULT_MIN_QUIZ_SCORE),
        fetchAllStudentProgress({
          selectedClass: selectedClass !== 'all' ? selectedClass : undefined,
          forceRevalidate: isManualRefresh,
        }).catch(() => ({})),
      ]);

      const effectiveKkm = kkmVal <= 10 ? kkmVal * 10 : kkmVal;
      setKkmScore(effectiveKkm);
      setProgressMap(allProg || {});
    } catch (err) {
      console.warn('[ProgressTrackerModal] Error fetching progress:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (isOpen && activeMaterial) {
      loadProgressData();
    }
  }, [isOpen, activeMaterial?.id, loadProgressData]);

  // Listen to cross-component reset events
  useEffect(() => {
    if (!isOpen || !activeMaterial) return;

    const handleResetEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail;
      if (detail && (!detail.materialId || detail.materialId === activeMaterial.id)) {
        loadProgressData(true);
      }
    };

    window.addEventListener('student-material-reset', handleResetEvent);
    return () => {
      window.removeEventListener('student-material-reset', handleResetEvent);
    };
  }, [isOpen, activeMaterial?.id, loadProgressData]);

  // Toast feedback timeout
  const showToast = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 3500);
  };

  // Extract class list
  const classList = useMemo(() => {
    const set = new Set<string>();
    (masterClasses || []).forEach((c) => {
      if (c && typeof c === 'string' && c.trim()) set.add(c.trim());
    });
    (students || []).forEach((s) => {
      if (s?.kelas && s.kelas.trim()) set.add(s.kelas.trim());
    });
    Object.values(progressMap || {}).forEach((p) => {
      const pKelas = (p as any)?.kelas;
      if (pKelas && typeof pKelas === 'string' && pKelas.trim()) set.add(pKelas.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [masterClasses, students, progressMap]);

  // Target question count for active material
  const targetTotalQuestions = useMemo(() => {
    if (!activeMaterial) return 10;
    if (activeMaterial.quizSelectedQuestionIds && activeMaterial.quizSelectedQuestionIds.length > 0) {
      return activeMaterial.quizSelectedQuestionIds.length;
    }
    if (activeMaterial.quizQuestions && activeMaterial.quizQuestions.length > 0) {
      return activeMaterial.quizQuestions.length;
    }
    return 10;
  }, [activeMaterial]);

  // Category and Subject metadata for active material
  const activeCategory = useMemo(() => {
    if (!activeMaterial) return null;
    return categories.find((c) => c.id === activeMaterial.categoryId) || null;
  }, [activeMaterial, categories]);

  const activeSubject = useMemo(() => {
    if (!activeCategory) return null;
    return subjects.find((s) => s.id === (activeCategory.subjectId || 'informatika')) || null;
  }, [activeCategory, subjects]);

  // Evaluate students for this active material
  const evaluatedRows: StudentProgressEvaluationRow[] = useMemo(() => {
    if (!activeMaterial) return [];

    const matId = activeMaterial.id;
    const studentAccountMap = new Map<string, StudentAccount>();
    (students || []).forEach((st) => {
      if (!st) return;
      if (st.id) studentAccountMap.set(st.id.toLowerCase().trim(), st);
      if (st.nisn) studentAccountMap.set(st.nisn.toLowerCase().trim(), st);
      if (st.nama) studentAccountMap.set(st.nama.toLowerCase().trim(), st);
    });

    const evaluatedStudentsMap = new Map<string, {
      studentId: string;
      nisn: string;
      nama: string;
      kelas: string;
      noAbsen: string;
    }>();

    // 1. Registered students in roster
    (students || []).forEach((st) => {
      if (!st) return;
      const key = st.id || st.nisn || st.nama;
      evaluatedStudentsMap.set(key, {
        studentId: st.id || st.nisn || st.nama,
        nisn: st.nisn || '',
        nama: st.nama || '',
        kelas: st.kelas || '',
        noAbsen: st.noAbsen || '',
      });
    });

    // 2. Extra students from progress records
    Object.entries(progressMap || {}).forEach(([progStudentId, prog]: [string, StudentProgressRecord]) => {
      const match =
        studentAccountMap.get(progStudentId.toLowerCase().trim()) ||
        (prog.studentName ? studentAccountMap.get(prog.studentName.toLowerCase().trim()) : null);

      const studentId = match?.id || progStudentId;
      const nisn = match?.nisn || progStudentId;
      const nama = match?.nama || prog.studentName || progStudentId;
      const kelas = match?.kelas || prog.kelas || '';
      const noAbsen = match?.noAbsen || '';

      const key = studentId || nisn || nama;
      if (!evaluatedStudentsMap.has(key)) {
        evaluatedStudentsMap.set(key, {
          studentId,
          nisn,
          nama,
          kelas,
          noAbsen,
        });
      }
    });

    const rows: StudentProgressEvaluationRow[] = [];
    const minRequiredScore = Math.max(1, Math.ceil((kkmScore / 100) * targetTotalQuestions));

    evaluatedStudentsMap.forEach((st) => {
      // Filter by class if selectedClass is not 'all'
      if (selectedClass !== 'all' && st.kelas.trim().toLowerCase() !== selectedClass.trim().toLowerCase()) {
        return;
      }

      const prog = getMergedStudentProgress(
        { id: st.studentId, nisn: st.nisn, nama: st.nama, kelas: st.kelas },
        progressMap
      );

      const attempt = prog?.quizAttempts?.[matId];
      const rawScore = prog?.scores?.[matId];
      const isCompletedInProg = Array.isArray(prog?.completedMaterialIds) && prog.completedMaterialIds.includes(matId);

      const hasAttempted = attempt !== undefined || rawScore !== undefined || isCompletedInProg;

      let scoreVal = 0;
      let percentVal = 0;
      let totalQ = attempt?.totalQuestions || targetTotalQuestions;

      if (attempt) {
        scoreVal = attempt.score ?? Math.round((attempt.percentage / 100) * totalQ);
        percentVal = attempt.percentage ?? (totalQ > 0 ? Math.round((scoreVal / totalQ) * 100) : 0);
      } else if (rawScore !== undefined) {
        const numRaw = Number(rawScore);
        if (numRaw <= totalQ && totalQ > 0) {
          scoreVal = numRaw;
          percentVal = Math.round((numRaw / totalQ) * 100);
        } else {
          percentVal = numRaw;
          scoreVal = Math.round((percentVal / 100) * totalQ);
        }
      } else if (isCompletedInProg) {
        percentVal = kkmScore;
        scoreVal = minRequiredScore;
      }

      // Cap at total questions
      if (scoreVal >= totalQ && totalQ > 0) {
        scoreVal = totalQ;
        percentVal = 100;
      }

      const isPassed = hasAttempted && (
        isCompletedInProg ||
        percentVal >= kkmScore ||
        scoreVal >= minRequiredScore ||
        scoreVal >= totalQ
      );

      let statusText: 'TUNTAS' | 'REMEDIAL' | 'BELUM MENGERJAKAN' = 'BELUM MENGERJAKAN';
      if (hasAttempted) {
        statusText = isPassed ? 'TUNTAS' : 'REMEDIAL';
      }

      rows.push({
        studentId: st.studentId,
        nisn: st.nisn,
        nama: st.nama,
        kelas: st.kelas,
        noAbsen: st.noAbsen,
        score: scoreVal,
        totalQuestions: totalQ,
        percentage: percentVal,
        isPassed,
        hasAttempted,
        isCompletedInProg,
        completedAt: (attempt as any)?.completedAt || attempt?.updatedAt,
        statusText,
      });
    });

    return rows;
  }, [activeMaterial, students, progressMap, selectedClass, kkmScore, targetTotalQuestions]);

  // Grouped lists
  const unattemptedList = useMemo(() => {
    return evaluatedRows.filter((r) => !r.hasAttempted);
  }, [evaluatedRows]);

  const remedialList = useMemo(() => {
    return evaluatedRows.filter((r) => r.hasAttempted && !r.isPassed);
  }, [evaluatedRows]);

  const passedList = useMemo(() => {
    return evaluatedRows.filter((r) => r.hasAttempted && r.isPassed);
  }, [evaluatedRows]);

  // Filtered and searched list for active tab
  const displayedList = useMemo(() => {
    let list: StudentProgressEvaluationRow[] = [];
    if (activeTab === 'not_attempted') list = unattemptedList;
    else if (activeTab === 'remedial') list = remedialList;
    else if (activeTab === 'passed') list = passedList;
    else list = evaluatedRows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.nama.toLowerCase().includes(q) ||
          r.nisn.toLowerCase().includes(q) ||
          r.noAbsen.toLowerCase().includes(q) ||
          r.kelas.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const aNum = parseInt(a.noAbsen, 10);
      const bNum = parseInt(b.noAbsen, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.nama.localeCompare(b.nama, 'id');
    });
  }, [activeTab, unattemptedList, remedialList, passedList, evaluatedRows, searchQuery]);

  // Reset student attempt directly
  const handleResetDirect = async (row: StudentProgressEvaluationRow) => {
    if (!activeMaterial || resettingId === row.studentId) return;

    setResettingId(row.studentId);
    try {
      if (onResetStudent) {
        await onResetStudent(row.studentId, row.nama);
      } else {
        const matched = students.find(
          (s) =>
            s.id === row.studentId ||
            s.nisn === row.studentId ||
            (s.nama && s.nama.toLowerCase().trim() === row.nama.toLowerCase().trim())
        );
        const addIds = matched ? [matched.id, matched.nisn].filter(Boolean) as string[] : [];
        await resetStudentMaterialProgress(row.studentId, activeMaterial.id, addIds);
      }

      // Optimistic update in local progressMap
      setProgressMap((prev) => {
        const copy = { ...prev };
        if (copy[row.studentId]) {
          const p = { ...copy[row.studentId] };
          if (p.scores) delete p.scores[activeMaterial.id];
          if (p.quizAttempts) delete p.quizAttempts[activeMaterial.id];
          if (Array.isArray(p.completedMaterialIds)) {
            p.completedMaterialIds = p.completedMaterialIds.filter((id) => id !== activeMaterial.id);
          }
          copy[row.studentId] = p;
        }
        return copy;
      });

      showToast(`✓ Berhasil mereset kuis untuk ${row.nama}. Siswa dapat mengulang kuis kembali.`);
      if (showNotify) {
        showNotify('success', `Kuis untuk siswa ${row.nama} berhasil direset secara real-time.`);
      }
    } catch (err: any) {
      console.error('Failed to reset student in modal:', err);
      showToast('Gagal mereset kuis: ' + (err?.message || 'Error'));
    } finally {
      setResettingId(null);
    }
  };

  // WhatsApp Broadcast for Unattempted / Remedial
  const handleCopyWhatsAppBroadcast = (mode: 'not_attempted' | 'remedial' | 'all') => {
    if (!activeMaterial) return;

    const className = selectedClass !== 'all' ? `Kelas ${selectedClass}` : 'Semua Kelas';
    const matTitle = activeMaterial.title;
    const subjTitle = activeSubject?.name || 'Mata Pelajaran';

    let listToCopy: StudentProgressEvaluationRow[] = [];
    let heading = '';

    if (mode === 'not_attempted') {
      listToCopy = unattemptedList;
      heading = `📢 *PEMBERITAHUAN PENGERJAAN MINI KUIS*\n`;
      heading += `Kepada siswa ${className} yang namanya tercantum di bawah ini, mohon untuk *segera menyelesaikan Mini Kuis*:`;
    } else if (mode === 'remedial') {
      listToCopy = remedialList;
      heading = `⚠️ *PENGUMUMAN REMEDIAL MINI KUIS*\n`;
      heading += `Berikut adalah daftar siswa ${className} yang *belum mencapai standar KKM (${kkmScore})* dan *perlu mengikuti remedial*:`;
    } else {
      listToCopy = evaluatedRows.filter((r) => !r.isPassed);
      heading = `📋 *REKAP SISWA BELUM TUNTAS & BELUM KUIS*\n`;
      heading += `Daftar siswa ${className} yang belum mengerjakan atau butuh remedial kuis:`;
    }

    if (listToCopy.length === 0) {
      showToast('Semua siswa sudah tuntas! Tidak ada daftar yang perlu disalin.');
      return;
    }

    let text = `${heading}\n\n`;
    text += `📚 *Mata Pelajaran:* ${subjTitle}\n`;
    text += `📖 *Materi:* ${matTitle}\n`;
    text += `🎯 *Standar KKM:* ${kkmScore} / 100\n`;
    text += `👥 *Kelompok:* ${className}\n`;
    text += `──────────────────────\n\n`;

    listToCopy.forEach((r, idx) => {
      const noStr = String(idx + 1).padStart(2, '0');
      const absenStr = r.noAbsen ? `[Abs: ${r.noAbsen}] ` : '';
      if (!r.hasAttempted) {
        text += `${noStr}. ${absenStr}*${r.nama}* (${r.kelas || '-'}) ➔ ⏳ _Belum Mengerjakan_\n`;
      } else {
        text += `${noStr}. ${absenStr}*${r.nama}* (${r.kelas || '-'}) ➔ Nilai: *${r.percentage}* ⚠️ [Butuh Remedial]\n`;
      }
    });

    text += `\n──────────────────────\n`;
    text += `Silakan segera login ke aplikasi SIMPEL dan selesaikan kuis sebelum batas waktu berakhir. Terima kasih.`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast('✓ Format WhatsApp berhasil disalin ke clipboard! Siap dibagikan ke grup kelas.');
      })
      .catch(() => {
        showToast('Gagal menyalin teks ke clipboard.');
      });
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!activeMaterial || displayedList.length === 0) {
      showToast('Tidak ada data siswa untuk diekspor.');
      return;
    }

    const matTitle = activeMaterial.title;
    const reqCorrect = Math.max(1, Math.ceil((kkmScore / 100) * targetTotalQuestions));

    const dataRows = displayedList.map((r, i) => ({
      'No': i + 1,
      'Nama Siswa': r.nama,
      'Kelas': r.kelas || '-',
      'No. Absen': r.noAbsen || '-',
      'NISN': r.nisn || '-',
      'Materi': matTitle,
      'Jumlah Benar': r.hasAttempted ? r.score : 0,
      'Total Soal': r.totalQuestions,
      'Nilai Akhir (%)': r.hasAttempted ? r.percentage : 0,
      'Standar KKM': `${kkmScore}% (Min. ${reqCorrect} Benar)`,
      'Status Ketuntasan': r.statusText,
      'Waktu Selesai': r.completedAt ? new Date(r.completedAt).toLocaleString('id-ID') : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 30 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pelacak Progres Kuis');

    const fileName = `Progres_Kuis_${activeMaterial.title.replace(/\s+/g, '_')}_${selectedClass}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('✓ File Excel berhasil diunduh.');
  };

  if (!isOpen || !activeMaterial) return null;

  const totalClassStudents = evaluatedRows.length;
  const passRate = totalClassStudents > 0 ? Math.round((passedList.length / totalClassStudents) * 100) : 0;

  const modalContent = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fadeIn overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Toast Feedback */}
      {copyFeedback && (
        <div className="fixed top-6 right-6 z-[999999] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-indigo-500/40 flex items-center gap-3 animate-bounce">
          <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-100">{copyFeedback}</span>
        </div>
      )}

      {/* Main Modal Card with consistent height across all tabs */}
      <div
        className="bg-white w-full max-w-5xl h-[90vh] max-h-[820px] min-h-[580px] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scaleUp relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Pelacak Progres Siswa & Remedial Kuis
                </h3>
                <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-extrabold rounded-full">
                  Real-Time Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-semibold text-white">{activeMaterial.title}</span>
                <span>&bull;</span>
                <span>Standar KKM: <strong className="text-amber-400">{kkmScore}%</strong></span>
                <span>&bull;</span>
                <span>Maks. {targetTotalQuestions} Soal</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => loadProgressData(true)}
              disabled={isRefreshing || isLoading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Perbarui Data Real-time dari Server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-all cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Class Filter Bar (Horizontal Scrollable Tabs) */}
        <div className="bg-slate-50 p-3 sm:px-5 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-extrabold text-slate-500 shrink-0 flex items-center gap-1 uppercase tracking-wider mr-1">
            <GraduationCap className="w-4 h-4 text-slate-400" />
            <span>Pilih Kelas:</span>
          </span>

          <button
            type="button"
            onClick={() => setSelectedClass('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
              selectedClass === 'all'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Semua Kelas ({students.length})
          </button>

          {classList.map((cls) => {
            const isSelected = selectedClass.toLowerCase() === cls.toLowerCase();
            const countInClass = (students || []).filter(
              (s) => s?.kelas && s.kelas.trim().toLowerCase() === cls.toLowerCase()
            ).length;

            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span>Kelas {cls}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {countInClass}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="p-3 sm:p-5 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
          {/* Card 1: Belum Mengerjakan */}
          <div
            onClick={() => setActiveTab('not_attempted')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'not_attempted'
                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
                Belum Mengerjakan
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1">
              {unattemptedList.length}
              <span className="text-xs text-slate-400 font-bold ml-1">/ {totalClassStudents}</span>
            </div>
            <span className="text-[10px] text-amber-700 font-bold block mt-0.5">
              Klik untuk lihat daftar
            </span>
          </div>

          {/* Card 2: Perlu Remedial */}
          <div
            onClick={() => setActiveTab('remedial')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'remedial'
                ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">
                Perlu Remedial
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-900 mt-1">
              {remedialList.length}
              <span className="text-xs text-slate-400 font-bold ml-1">Siswa</span>
            </div>
            <span className="text-[10px] text-rose-700 font-bold block mt-0.5">
              Nilai di bawah {kkmScore}%
            </span>
          </div>

          {/* Card 3: Lulus KKM (Tuntas) */}
          <div
            onClick={() => setActiveTab('passed')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'passed'
                ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                Tuntas / Lulus KKM
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-1">
              {passedList.length}
              <span className="text-xs text-slate-400 font-bold ml-1">
                ({passRate}%)
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
              Target tercapai &ge; {kkmScore}%
            </span>
          </div>

          {/* Card 4: Total & Partisipasi */}
          <div
            onClick={() => setActiveTab('all')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider">
                Total Siswa Kelas
              </span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-950 mt-1">
              {totalClassStudents}
              <span className="text-xs text-slate-400 font-bold ml-1">Siswa</span>
            </div>
            <span className="text-[10px] text-indigo-700 font-bold block mt-0.5">
              {totalClassStudents - unattemptedList.length} Telah Mengerjakan
            </span>
          </div>
        </div>

        {/* Toolbar: Sub Tabs + Search + Actions */}
        <div className="p-3 sm:px-5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
          {/* Sub Tabs */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('not_attempted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'not_attempted'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Belum Kuis</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'not_attempted' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {unattemptedList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('remedial')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'remedial'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Remedial</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'remedial' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {remedialList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('passed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'passed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tuntas KKM</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'passed' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {passedList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Semua</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {evaluatedRows.length}
              </span>
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari siswa / absen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Broadcast WhatsApp Button */}
            <button
              type="button"
              onClick={() =>
                handleCopyWhatsAppBroadcast(
                  activeTab === 'remedial' ? 'remedial' : activeTab === 'not_attempted' ? 'not_attempted' : 'all'
                )
              }
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Salin pesan pengumuman WhatsApp untuk grup kelas"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salin WA</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
              title="Ekspor daftar ke file Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>

        {/* Content Table Area */}
        <div className="p-3 sm:p-5 flex-1 min-h-0 overflow-y-auto no-scrollbar overscroll-contain">
          {isLoading ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-bold">Sinkronisasi data progres siswa secara real-time...</p>
            </div>
          ) : displayedList.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-xs text-slate-600 font-bold max-w-md">
                {searchQuery
                  ? 'Tidak ada siswa yang cocok dengan pencarian.'
                  : activeTab === 'not_attempted'
                  ? 'Luar biasa! Seluruh siswa pada kelas ini sudah mengerjakan kuis.'
                  : activeTab === 'remedial'
                  ? 'Hebat! Tidak ada siswa yang memerlukan remedial (semua tuntas KKM).'
                  : 'Belum ada data siswa untuk kategori ini.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5 text-center w-12">No</th>
                    <th className="py-3 px-3.5">Nama Siswa</th>
                    <th className="py-3 px-3.5 text-center">Kelas</th>
                    <th className="py-3 px-3.5 text-center">Absen</th>
                    <th className="py-3 px-3.5 text-center">Jumlah Benar</th>
                    <th className="py-3 px-3.5 text-center">Nilai (%)</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-center">Waktu Pengerjaan</th>
                    <th className="py-3 px-3.5 text-center">Aksi Guru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {displayedList.map((row, idx) => {
                    const isResettingThis = resettingId === row.studentId;

                    return (
                      <tr key={row.studentId || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-3.5">
                          <div className="font-extrabold text-slate-900">{row.nama}</div>
                          {row.nisn && (
                            <div className="text-[10px] text-slate-400 font-mono">NIS: {row.nisn}</div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[11px]">
                            {row.kelas || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-center text-slate-500 font-bold">
                          {row.noAbsen || '-'}
                        </td>
                        <td className="py-3 px-3.5 text-center font-extrabold">
                          {row.hasAttempted ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-black text-xs border border-slate-200">
                              {row.score} / {row.totalQuestions}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center font-black">
                          {row.hasAttempted ? (
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                row.isPassed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {row.percentage}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {row.statusText === 'TUNTAS' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Tuntas</span>
                            </span>
                          ) : row.statusText === 'REMEDIAL' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Remedial</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Belum Kuis</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center text-slate-500 text-[11px] whitespace-nowrap">
                          {row.completedAt ? new Date(row.completedAt).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {row.hasAttempted ? (
                            <button
                              type="button"
                              onClick={() => handleResetDirect(row)}
                              disabled={isResettingThis}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Reset kuis agar siswa dapat mengulang kuis / remedial"
                            >
                              {isResettingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              <span>Reset Kuis</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Menunggu pengerjaan</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Ringkasan Materi:</span>
            <span>{totalClassStudents} Siswa Terdaftar</span>
            <span>&bull;</span>
            <span className="text-emerald-700 font-bold">{passedList.length} Tuntas</span>
            <span>&bull;</span>
            <span className="text-rose-700 font-bold">{remedialList.length} Remedial</span>
            <span>&bull;</span>
            <span className="text-amber-700 font-bold">{unattemptedList.length} Belum Mengerjakan</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
