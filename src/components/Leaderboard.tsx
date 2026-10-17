import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Sparkles,
  Flame,
  Search,
  Filter,
  Users,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { StudentAccount, Subject, Category, Material, StudentProgressRecord } from '../types';
import {
  calculateStudentGamification,
  getCurrentLevelInfo,
  ALL_BADGES,
  BadgeInfo,
} from '../utils/gamification';
import {
  fetchLeaderboardSummary,
  syncLeaderboardSummary,
  fetchStudents,
  fetchAllStudentProgress,
  getMergedStudentProgress,
  LeaderboardSummaryDoc,
} from '../lib/dataService';

interface LeaderboardProps {
  students?: StudentAccount[];
  allStudentProgress?: Record<string, StudentProgressRecord>;
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  currentStudent?: StudentAccount | null;
  isTeacherOrAdmin?: boolean;
  onSelectStudent?: (student: StudentAccount) => void;
}

interface RankedStudentItem {
  student: StudentAccount;
  rank: number;
  exp: number;
  level: number;
  levelTitle: string;
  levelIcon: string;
  badges: BadgeInfo[];
  completedMaterialsCount: number;
  totalMaterialsCount: number;
  avgQuizScore: number;
  quizzesAttemptedCount: number;
  isCurrentStudent: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  students = [],
  allStudentProgress = {},
  subjects = [],
  categories = [],
  materials = [],
  currentStudent,
  isTeacherOrAdmin = false,
  onSelectStudent,
}) => {
  const [summaryDoc, setSummaryDoc] = useState<LeaderboardSummaryDoc | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // High-performance Firestore quota saver:
  // Loads pre-aggregated summary immediately, with self-healing fallback
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSummary(true);
    fetchLeaderboardSummary()
      .then((doc) => {
        if (isMounted && doc) {
          setSummaryDoc(doc);
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat ringkasan papan peringkat:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSummary(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSyncSummary = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const [freshStudents, freshProgress] = await Promise.all([
        fetchStudents(),
        fetchAllStudentProgress(),
      ]);
      const res = await syncLeaderboardSummary(freshStudents, freshProgress);
      if (res) {
        setSummaryDoc(res);
        setSyncFeedback('Papan peringkat berhasil diperbarui!');
      } else {
        setSyncFeedback('Tidak ada data siswa untuk disinkronkan.');
      }
    } catch (err: any) {
      setSyncFeedback('Gagal memperbarui: ' + (err?.message || 'terjadi kesalahan'));
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // Available classes extracted from student roster or pre-aggregated summary
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    if (students.length > 0) {
      students.forEach((s) => {
        if (s.kelas && s.kelas.trim()) set.add(s.kelas.trim());
      });
    } else if (summaryDoc?.topStudents) {
      summaryDoc.topStudents.forEach((s) => {
        if (s.kelas && s.kelas.trim()) set.add(s.kelas.trim());
      });
    }
    return Array.from(set).sort();
  }, [students, summaryDoc]);

  // Initial class filter defaults to current student's class if available, else 'all'
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (currentStudent?.kelas) return currentStudent.kelas;
    return availableClasses[0] || 'all';
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [rankingMetric, setRankingMetric] = useState<'exp' | 'quiz' | 'materials'>('exp');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBadgeDetailModal, setShowBadgeDetailModal] = useState<BadgeInfo | null>(null);

  // Filter materials based on selected subject if applicable
  const targetMaterials = useMemo(() => {
    const published = materials.filter((m) => m && m.isPublished !== false);
    if (selectedSubjectId === 'all') return published;

    const subjectCategories = categories.filter((c) => c.subjectId === selectedSubjectId);
    const catIds = subjectCategories.map((c) => c.id);
    return published.filter((m) => catIds.includes(m.categoryId));
  }, [materials, categories, selectedSubjectId]);

  const totalTargetMaterials = targetMaterials.length;

  // Process each student's progress and gamification
  const processedRanks = useMemo<RankedStudentItem[]>(() => {
    const targetMatIds = new Set(targetMaterials.map((m) => m.id));

    // Full calculation path: when teacher/admin has full student roster & progress loaded
    if (students.length > 0 && Object.keys(allStudentProgress).length > 0) {
      const filteredStudents = students.filter((s) => {
        if (!s) return false;
        if (selectedClass !== 'all' && s.kelas !== selectedClass) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = (s.nama || '').toLowerCase().includes(q);
          const matchNisn = (s.nisn || '').includes(q);
          const matchAbsen = (s.noAbsen || '').includes(q);
          if (!matchName && !matchNisn && !matchAbsen) return false;
        }
        return true;
      });

      const list: Omit<RankedStudentItem, 'rank'>[] = filteredStudents.map((student) => {
        const progress = getMergedStudentProgress(student, allStudentProgress);

        const gamification = calculateStudentGamification(progress);
        const levelInfo = getCurrentLevelInfo(gamification.exp);

        const completedIds = (progress.completedMaterialIds || []).filter((id) =>
          selectedSubjectId === 'all' ? true : targetMatIds.has(id)
        );
        const completedMaterialsCount = completedIds.length;

        const rawScores = progress.scores || {};
        const relevantScores: number[] = [];
        Object.entries(rawScores).forEach(([matId, scorePct]) => {
          if (selectedSubjectId === 'all' || targetMatIds.has(matId)) {
            if (typeof scorePct === 'number') relevantScores.push(scorePct);
          }
        });

        const quizzesAttemptedCount = relevantScores.length;
        const avgQuizScore = quizzesAttemptedCount > 0
          ? Math.round(relevantScores.reduce((a, b) => a + b, 0) / quizzesAttemptedCount)
          : 0;

        const isCurrentStudent = !!currentStudent && (currentStudent.id === student.id || currentStudent.nisn === student.nisn);

        return {
          student,
          exp: gamification.exp,
          level: levelInfo.level,
          levelTitle: levelInfo.title,
          levelIcon: levelInfo.icon,
          badges: gamification.badges,
          completedMaterialsCount,
          totalMaterialsCount: totalTargetMaterials,
          avgQuizScore,
          quizzesAttemptedCount,
          isCurrentStudent,
        };
      });

      list.sort((a, b) => {
        if (rankingMetric === 'exp') {
          if (b.exp !== a.exp) return b.exp - a.exp;
          if (b.completedMaterialsCount !== a.completedMaterialsCount) return b.completedMaterialsCount - a.completedMaterialsCount;
          return b.avgQuizScore - a.avgQuizScore;
        } else if (rankingMetric === 'quiz') {
          if (b.avgQuizScore !== a.avgQuizScore) return b.avgQuizScore - a.avgQuizScore;
          if (b.exp !== a.exp) return b.exp - a.exp;
          return b.completedMaterialsCount - a.completedMaterialsCount;
        } else {
          if (b.completedMaterialsCount !== a.completedMaterialsCount) return b.completedMaterialsCount - a.completedMaterialsCount;
          if (b.exp !== a.exp) return b.exp - a.exp;
          return b.avgQuizScore - a.avgQuizScore;
        }
      });

      return list.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
    }

    // High performance / Quota saver path: use pre-aggregated summaryDoc
    if (summaryDoc?.topStudents && summaryDoc.topStudents.length > 0) {
      let filtered = summaryDoc.topStudents.filter((item) => {
        if (selectedClass !== 'all' && item.kelas !== selectedClass) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = (item.nama || '').toLowerCase().includes(q);
          const matchNisn = (item.nisn || '').includes(q);
          const matchAbsen = (item.noAbsen || '').includes(q);
          if (!matchName && !matchNisn && !matchAbsen) return false;
        }
        return true;
      });

      if (rankingMetric === 'quiz') {
        filtered = [...filtered].sort((a, b) => {
          if (b.avgQuizScore !== a.avgQuizScore) return b.avgQuizScore - a.avgQuizScore;
          return b.exp - a.exp;
        });
      } else if (rankingMetric === 'materials') {
        filtered = [...filtered].sort((a, b) => {
          if (b.completedMaterialsCount !== a.completedMaterialsCount) return b.completedMaterialsCount - a.completedMaterialsCount;
          return b.exp - a.exp;
        });
      }

      return filtered.map((item, index) => {
        const isCurrentStudent = !!currentStudent && (currentStudent.id === item.id || currentStudent.nisn === item.nisn);
        const derivedBadges = (item.badges && item.badges.length > 0)
          ? item.badges
          : ALL_BADGES.slice(0, Math.min(Math.floor(item.exp / 200), 5));

        return {
          student: {
            id: item.id,
            nama: item.nama,
            kelas: item.kelas,
            nisn: item.nisn || '',
            noAbsen: item.noAbsen || '',
          } as StudentAccount,
          rank: selectedClass === 'all' ? (item.rank || index + 1) : index + 1,
          exp: item.exp,
          level: item.level,
          levelTitle: item.levelTitle,
          levelIcon: item.levelIcon,
          badges: derivedBadges,
          completedMaterialsCount: item.completedMaterialsCount,
          totalMaterialsCount: totalTargetMaterials,
          avgQuizScore: item.avgQuizScore,
          quizzesAttemptedCount: item.quizzesAttemptedCount,
          isCurrentStudent,
        };
      });
    }

    return [];
  }, [
    students,
    allStudentProgress,
    summaryDoc,
    selectedClass,
    selectedSubjectId,
    rankingMetric,
    searchQuery,
    targetMaterials,
    totalTargetMaterials,
    currentStudent,
  ]);

  // Current logged in student standing
  const currentStudentStanding = useMemo(() => {
    if (!currentStudent) return null;
    const found = processedRanks.find((item) => item.isCurrentStudent);
    if (found) return found;

    // If student not in top rankings or summary list, compute their own standing from their available progress
    const myProgress = getMergedStudentProgress(currentStudent, allStudentProgress);
    const gamification = calculateStudentGamification(myProgress);
    const levelInfo = getCurrentLevelInfo(gamification.exp);
    const completedMaterialsCount = (myProgress.completedMaterialIds || []).length;
    const rawScores = Object.values(myProgress.scores || {}).filter((v) => typeof v === 'number');
    const avgQuizScore = rawScores.length > 0 ? Math.round(rawScores.reduce((a, b) => a + Number(b), 0) / rawScores.length) : 0;

    return {
      student: currentStudent,
      rank: summaryDoc?.totalStudents ? summaryDoc.totalStudents : 100,
      exp: gamification.exp,
      level: levelInfo.level,
      levelTitle: levelInfo.title,
      levelIcon: levelInfo.icon,
      badges: gamification.badges,
      completedMaterialsCount,
      totalMaterialsCount: totalTargetMaterials,
      avgQuizScore,
      quizzesAttemptedCount: rawScores.length,
      isCurrentStudent: true,
    } as RankedStudentItem;
  }, [processedRanks, currentStudent, allStudentProgress, summaryDoc, totalTargetMaterials]);

  // Top 3 Podium
  const podiumTop3 = useMemo(() => {
    return {
      rank1: processedRanks[0] || null,
      rank2: processedRanks[1] || null,
      rank3: processedRanks[2] || null,
    };
  }, [processedRanks]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-7 shadow-xl border border-indigo-800/60">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 text-xs font-black backdrop-blur-xs">
              <Trophy className="w-3.5 h-3.5" />
              <span>Papan Peringkat Prestasi & Gamifikasi</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Leaderboard Prestasi Belajar
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/90 font-medium max-w-xl leading-relaxed">
              Pantau peringkat, poin EXP, dan lencana prestasi siswa sekelas dan antar mata pelajaran untuk memicu semangat belajar kolaboratif.
            </p>
          </div>

          {/* Quick Stat Pill & Quota Sync Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handleSyncSummary}
              disabled={isSyncing}
              className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-black transition-all cursor-pointer inline-flex items-center justify-center gap-2 backdrop-blur-md shadow-xs disabled:opacity-50"
              title={
                isTeacherOrAdmin
                  ? 'Perbarui dokumen ringkasan peringkat agar semua siswa dapat mengakses leaderboard secara cepat.'
                  : 'Segarkan papan peringkat untuk melihat peringkat dan EXP terbaru.'
              }
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? 'Memperbarui...'
                  : isTeacherOrAdmin
                  ? 'Sinkronkan Ringkasan'
                  : 'Perbarui Peringkat'}
              </span>
            </button>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 shrink-0 justify-between sm:justify-start">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs">
                  <Crown className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-indigo-200">Total Siswa Terdaftar</p>
                  <p className="text-sm font-black text-white">{summaryDoc?.totalStudents || processedRanks.length} Siswa</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {syncFeedback && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold text-center animate-in fade-in">
            {syncFeedback}
          </div>
        )}
      </div>

      {isLoadingSummary && (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Memuat peringkat prestasi siswa...</p>
        </div>
      )}

      {/* Current Student Highlighted Callout (If logged in as student) */}
      {currentStudent && currentStudentStanding && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-50/80 to-purple-50/80 border-2 border-amber-400/60 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black flex items-center justify-center text-lg shadow-md shrink-0">
              #{currentStudentStanding.rank}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-indigo-950">Posisi Peringkat Kamu:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-[11px] shadow-2xs">
                  Peringkat #{currentStudentStanding.rank} dari {processedRanks.length} Siswa
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px]">
                  {currentStudentStanding.levelIcon} {currentStudentStanding.levelTitle}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Kamu telah mengumpulkan <strong>{currentStudentStanding.exp.toLocaleString('id-ID')} EXP</strong>, menyelesaikan <strong>{currentStudentStanding.completedMaterialsCount} materi</strong>, dan meraih <strong>{currentStudentStanding.badges.length} lencana</strong>. Terus tingkatkan! 🚀
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            {currentStudentStanding.badges.slice(0, 4).map((badge) => (
              <button
                key={badge.id}
                type="button"
                onClick={() => setShowBadgeDetailModal(badge)}
                className="w-8 h-8 rounded-xl bg-white border border-amber-300 shadow-2xs flex items-center justify-center text-sm cursor-pointer hover:scale-110 transition-transform"
                title={`${badge.title}: ${badge.description}`}
              >
                {badge.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Control Bar: Class, Subject, Metric, Search */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
        {/* Metric Selector Tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Kategori Peringkat:</span>
          </span>

          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80 gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setRankingMetric('exp')}
              className={`flex-1 sm:flex-initial px-2 sm:px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                rankingMetric === 'exp'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                <span className="sm:hidden">Poin EXP</span>
                <span className="hidden sm:inline">Poin & EXP Belajar</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRankingMetric('materials')}
              className={`flex-1 sm:flex-initial px-2 sm:px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                rankingMetric === 'materials'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>
                <span className="sm:hidden">Materi</span>
                <span className="hidden sm:inline">Materi Tuntas</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRankingMetric('quiz')}
              className={`flex-1 sm:flex-initial px-2 sm:px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                rankingMetric === 'quiz'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span>
                <span className="sm:hidden">Nilai Kuis</span>
                <span className="hidden sm:inline">Rata-rata Nilai Kuis</span>
              </span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
          {/* Class Filter */}
          <div className="sm:col-span-3">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Filter Kelas:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div className="sm:col-span-4">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Mata Pelajaran:</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">Semua Mata Pelajaran</option>
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Search */}
          <div className="sm:col-span-5">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Cari Nama / NIS:</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TOP 3 PODIUM SECTION (Only if at least 1 student exists) */}
      {processedRanks.length > 0 && (
        <div className="bg-gradient-to-b from-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-indigo-900/60 overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center space-y-1 mb-6 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">
              🌟 Podium Kehormatan
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white">Bintang Prestasi Kelas</h3>
          </div>

          {/* Podium Grid */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-4 items-end max-w-2xl mx-auto pt-3 sm:pt-4 relative z-10">
            {/* Rank 2 (Silver) */}
            <div className="flex flex-col items-center text-center">
              {podiumTop3.rank2 ? (
                <>
                  <div className="relative mb-1.5 sm:mb-2">
                    <div className="w-12 h-12 sm:w-18 sm:h-18 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-900 flex items-center justify-center font-black text-lg sm:text-xl shadow-lg border-2 border-white/60">
                      {podiumTop3.rank2.student.nama.charAt(0)}
                    </div>
                    <span className="absolute -bottom-1.5 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-300 text-slate-900 font-black text-[10px] sm:text-xs flex items-center justify-center shadow-md border border-white">
                      2
                    </span>
                  </div>
                  <p className="font-extrabold text-[11px] sm:text-sm text-white truncate max-w-[90px] sm:max-w-[140px]">
                    {podiumTop3.rank2.student.nama}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-slate-300 font-bold block truncate max-w-[90px] sm:max-w-none">
                    Kelas {podiumTop3.rank2.student.kelas}
                  </span>
                  <div className="mt-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-white/10 text-amber-300 font-black text-[9px] sm:text-[11px] max-w-full truncate">
                    {rankingMetric === 'exp'
                      ? `${podiumTop3.rank2.exp} EXP`
                      : rankingMetric === 'quiz'
                      ? `${podiumTop3.rank2.avgQuizScore}% Kuis`
                      : `${podiumTop3.rank2.completedMaterialsCount} Tuntas`}
                  </div>
                  {/* Step */}
                  <div className="w-full h-16 sm:h-24 bg-gradient-to-t from-slate-800 to-slate-700/80 rounded-t-xl sm:rounded-t-2xl border-t border-slate-500/50 mt-2 sm:mt-2.5 flex items-center justify-center">
                    <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
                  </div>
                </>
              ) : (
                <div className="h-28 flex items-center justify-center text-slate-500 text-xs">Kosong</div>
              )}
            </div>

            {/* Rank 1 (Gold / Champion) */}
            <div className="flex flex-col items-center text-center -mt-3 sm:-mt-4">
              {podiumTop3.rank1 ? (
                <>
                  <div className="relative mb-1.5 sm:mb-2">
                    <div className="absolute -top-4 sm:-top-5 left-1/2 -translate-x-1/2 text-amber-400 animate-bounce">
                      <Crown className="w-5 h-5 sm:w-7 sm:h-7 fill-amber-400" />
                    </div>
                    <div className="w-14 h-14 sm:w-22 sm:h-22 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 text-slate-950 flex items-center justify-center font-black text-xl sm:text-3xl shadow-2xl border-2 sm:border-3 border-amber-200">
                      {podiumTop3.rank1.student.nama.charAt(0)}
                    </div>
                    <span className="absolute -bottom-1.5 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center shadow-lg border-2 border-white">
                      1
                    </span>
                  </div>
                  <p className="font-black text-xs sm:text-base text-amber-300 truncate max-w-[100px] sm:max-w-[160px]">
                    {podiumTop3.rank1.student.nama}
                  </p>
                  <span className="text-[10px] sm:text-[11px] text-amber-200/90 font-bold block truncate max-w-[100px] sm:max-w-none">
                    Kelas {podiumTop3.rank1.student.kelas}
                  </span>
                  <div className="mt-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs shadow-md max-w-full truncate">
                    {rankingMetric === 'exp'
                      ? `${podiumTop3.rank1.exp} EXP`
                      : rankingMetric === 'quiz'
                      ? `${podiumTop3.rank1.avgQuizScore}% Kuis`
                      : `${podiumTop3.rank1.completedMaterialsCount} Tuntas`}
                  </div>
                  {/* Step */}
                  <div className="w-full h-22 sm:h-36 bg-gradient-to-t from-amber-900/60 to-amber-600/70 rounded-t-xl sm:rounded-t-2xl border-t-2 border-amber-400 mt-2 sm:mt-2.5 flex items-center justify-center shadow-inner">
                    <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-amber-300" />
                  </div>
                </>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-500 text-xs">Kosong</div>
              )}
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="flex flex-col items-center text-center">
              {podiumTop3.rank3 ? (
                <>
                  <div className="relative mb-1.5 sm:mb-2">
                    <div className="w-12 h-12 sm:w-18 sm:h-18 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-600 text-amber-100 flex items-center justify-center font-black text-lg sm:text-xl shadow-lg border-2 border-amber-400/50">
                      {podiumTop3.rank3.student.nama.charAt(0)}
                    </div>
                    <span className="absolute -bottom-1.5 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-600 text-white font-black text-[10px] sm:text-xs flex items-center justify-center shadow-md border border-white">
                      3
                    </span>
                  </div>
                  <p className="font-extrabold text-[11px] sm:text-sm text-white truncate max-w-[90px] sm:max-w-[140px]">
                    {podiumTop3.rank3.student.nama}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-amber-200/80 font-bold block truncate max-w-[90px] sm:max-w-none">
                    Kelas {podiumTop3.rank3.student.kelas}
                  </span>
                  <div className="mt-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-white/10 text-amber-300 font-black text-[9px] sm:text-[11px] max-w-full truncate">
                    {rankingMetric === 'exp'
                      ? `${podiumTop3.rank3.exp} EXP`
                      : rankingMetric === 'quiz'
                      ? `${podiumTop3.rank3.avgQuizScore}% Kuis`
                      : `${podiumTop3.rank3.completedMaterialsCount} Tuntas`}
                  </div>
                  {/* Step */}
                  <div className="w-full h-12 sm:h-20 bg-gradient-to-t from-amber-950 to-amber-900/80 rounded-t-xl sm:rounded-t-2xl border-t border-amber-600/50 mt-2 sm:mt-2.5 flex items-center justify-center">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                  </div>
                </>
              ) : (
                <div className="h-28 flex items-center justify-center text-slate-500 text-xs">Kosong</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL LEADERBOARD TABLE */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-black text-slate-900 text-base">Daftar Lengkap Peringkat Siswa</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Menampilkan {processedRanks.length} siswa berdasarkan{' '}
              <strong>
                {rankingMetric === 'exp'
                  ? 'Akumulasi Poin EXP'
                  : rankingMetric === 'quiz'
                  ? 'Rata-rata Nilai Kuis'
                  : 'Total Materi Pembelajaran Tuntas'}
              </strong>
            </p>
          </div>

          <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/70">
            {selectedClass === 'all' ? 'Semua Rombel' : `Kelas ${selectedClass}`} •{' '}
            {selectedSubjectId === 'all'
              ? 'Semua Mapel'
              : subjects.find((s) => s.id === selectedSubjectId)?.name || 'Mapel'}
          </div>
        </div>

        {processedRanks.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600 text-sm">Tidak ada siswa ditemukan</p>
            <p className="text-xs text-slate-400">
              Coba sesuaikan filter kelas, mata pelajaran, atau kata kunci pencarian.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {processedRanks.map((item) => {
              const isTop3 = item.rank <= 3;
              return (
                <div
                  key={item.student.id}
                  className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors ${
                    item.isCurrentStudent
                      ? 'bg-indigo-50/90 border-l-4 border-l-indigo-600 ring-1 ring-indigo-200'
                      : isTop3
                      ? 'hover:bg-amber-50/40'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Left: Rank & Avatar & Identity */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <div className="w-8 sm:w-10 text-center shrink-0">
                      {item.rank === 1 ? (
                        <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center mx-auto shadow-xs">
                          🥇
                        </div>
                      ) : item.rank === 2 ? (
                        <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center mx-auto shadow-xs">
                          🥈
                        </div>
                      ) : item.rank === 3 ? (
                        <div className="w-8 h-8 rounded-xl bg-amber-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-xs">
                          🥉
                        </div>
                      ) : (
                        <span className="font-black text-sm text-slate-500">#{item.rank}</span>
                      )}
                    </div>

                    {/* Avatar Initials */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                        item.isCurrentStudent
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                          : isTop3
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.student.nama.charAt(0)}
                    </div>

                    {/* Student Name & Class & Level */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-black text-xs sm:text-sm truncate ${
                            item.isCurrentStudent ? 'text-indigo-950' : 'text-slate-900'
                          }`}
                        >
                          {item.student.nama}
                        </span>
                        {item.isCurrentStudent && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white text-[10px] font-black shrink-0">
                            Kamu
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium flex-wrap">
                        <span className="font-bold text-slate-700">Kelas {item.student.kelas}</span>
                        {item.student.noAbsen && <span>• Absen {item.student.noAbsen}</span>}
                        <span className="hidden sm:inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.2 rounded font-bold">
                          <span>{item.levelIcon}</span>
                          <span>Lv.{item.level} {item.levelTitle}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges Preview (Desktop / Tablet) */}
                  <div className="hidden md:flex items-center gap-1 shrink-0">
                    {item.badges.slice(0, 3).map((badge) => (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => setShowBadgeDetailModal(badge)}
                        className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                        title={`${badge.title}: ${badge.description}`}
                      >
                        {badge.icon}
                      </button>
                    ))}
                    {item.badges.length > 3 && (
                      <span className="text-[10px] font-extrabold text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                        +{item.badges.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Right Score Metrics */}
                  <div className="text-right shrink-0 min-w-[72px] sm:min-w-[120px]">
                    {rankingMetric === 'exp' ? (
                      <div>
                        <span className="font-black text-sm sm:text-base text-indigo-700 block">
                          {item.exp.toLocaleString('id-ID')}{' '}
                          <span className="text-[10px] font-extrabold text-indigo-500">EXP</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {item.completedMaterialsCount} materi tuntas
                        </span>
                      </div>
                    ) : rankingMetric === 'quiz' ? (
                      <div>
                        <span className="font-black text-sm sm:text-base text-emerald-700 block">
                          {item.avgQuizScore}%
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {item.quizzesAttemptedCount} kuis dicoba
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-black text-sm sm:text-base text-indigo-700 block">
                          {item.completedMaterialsCount}/{item.totalMaterialsCount}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {item.totalMaterialsCount > 0
                            ? `${Math.round((item.completedMaterialsCount / item.totalMaterialsCount) * 100)}% tuntas`
                            : '0% tuntas'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BADGES GALLERY SECTION */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Daftar Lencana Prestasi Tersedia</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Siswa secara otomatis memperoleh lencana prestasi ini saat mencapai target pembelajaran.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {ALL_BADGES.map((b) => {
            const hasUnlocked = currentStudentStanding?.badges.some((ub) => ub.id === b.id);
            return (
              <div
                key={b.id}
                onClick={() => setShowBadgeDetailModal(b)}
                className={`p-3 rounded-2xl border text-center space-y-1.5 transition-all cursor-pointer ${
                  hasUnlocked
                    ? 'bg-gradient-to-b from-amber-50/80 to-white border-amber-300/80 shadow-xs ring-2 ring-amber-200/50'
                    : 'bg-slate-50/80 border-slate-200/80 opacity-75 hover:opacity-100 hover:bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-xl mx-auto">
                  {b.icon}
                </div>
                <p className="font-black text-xs text-slate-900 truncate">{b.title}</p>
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                  {b.description}
                </p>
                {hasUnlocked ? (
                  <span className="inline-block text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Telah Diraih ✓
                  </span>
                ) : (
                  <span className="inline-block text-[9px] font-bold text-slate-400">
                    Belum Terbuka
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Badge Detail Modal */}
      {showBadgeDetailModal && (
        <div
          className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowBadgeDetailModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-100 to-amber-200 border-2 border-amber-300 text-3xl flex items-center justify-center mx-auto shadow-md">
              {showBadgeDetailModal.icon}
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-lg text-slate-900">{showBadgeDetailModal.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {showBadgeDetailModal.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowBadgeDetailModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
            >
              Tutup Penjelasan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
