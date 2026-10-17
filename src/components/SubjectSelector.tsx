import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Award,
  BookMarked,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Flame,
  TrendingUp,
  UserCheck,
  RotateCcw,
  Bookmark,
  Trophy,
  Bomb,
} from 'lucide-react';
import { Subject, Category, Material, TeacherAccount, StudentAccount, AuthSession, MaterialActivityLog } from '../types';
import { StudentProgressRecord } from '../lib/dataService';
import { getSubjectIcon } from '../utils/subjectIcons';
import { getTeachersForSubject, doesTeacherTeachClass } from '../utils/classFilter';
import { normalizeCompletedMaterialIds } from '../utils/prerequisites';
import { StudentActivityLog } from './StudentActivityLog';
import { Leaderboard } from './Leaderboard';

export type SubjectSelectorTab = 'subjects' | 'bookmarks' | 'leaderboard' | 'activity_log';

interface SubjectSelectorProps {
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  teachers?: TeacherAccount[];
  students?: StudentAccount[];
  allStudentProgress?: Record<string, StudentProgressRecord>;
  completedMaterialIds?: string[];
  completedMaterialTimestamps?: Record<string, string>;
  activityLogs?: MaterialActivityLog[];
  bookmarkedMaterialIds?: string[];
  onToggleBookmark?: (materialId: string) => void;
  userNotes?: Record<string, string>;
  onSaveNote?: (materialId: string, noteText: string) => void;
  searchQuery: string;
  onSelectSubject: (subjectId: string) => void;
  onDirectOpenMaterial?: (subjectId: string, categoryId: string, materialId: string) => void;
  onOpenGuide?: () => void;
  authSession?: AuthSession | null;
  activeTab?: SubjectSelectorTab;
  onTabChange?: (tab: SubjectSelectorTab) => void;
  onOpenIcebreakingGame?: () => void;
}

// Helper to assign vibrant color palettes per subject
function getSubjectTheme(subjName: string, code?: string) {
  const name = (subjName + ' ' + (code || '')).toLowerCase();
  if (name.includes('informatika') || name.includes('tik') || name.includes('komputer')) {
    return {
      bgIcon: 'bg-cyan-50 border-cyan-100 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white',
      badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      borderTop: 'from-cyan-500 to-blue-600',
      accentGlow: 'hover:shadow-cyan-500/10',
    };
  }
  if (name.includes('ipa') || name.includes('sains') || name.includes('biologi') || name.includes('fisika')) {
    return {
      bgIcon: 'bg-emerald-50 border-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      borderTop: 'from-emerald-500 to-teal-600',
      accentGlow: 'hover:shadow-emerald-500/10',
    };
  }
  if (name.includes('matematika') || name.includes('mtk')) {
    return {
      bgIcon: 'bg-violet-50 border-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
      badge: 'bg-violet-50 text-violet-700 border-violet-200',
      borderTop: 'from-violet-500 to-indigo-600',
      accentGlow: 'hover:shadow-violet-500/10',
    };
  }
  if (name.includes('inggris') || name.includes('english')) {
    return {
      bgIcon: 'bg-rose-50 border-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      borderTop: 'from-rose-500 to-pink-600',
      accentGlow: 'hover:shadow-rose-500/10',
    };
  }
  if (name.includes('indonesia') || name.includes('bahasa')) {
    return {
      bgIcon: 'bg-amber-50 border-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      borderTop: 'from-amber-500 to-orange-600',
      accentGlow: 'hover:shadow-amber-500/10',
    };
  }
  if (name.includes('ips') || name.includes('sejarah') || name.includes('geografi') || name.includes('pancasila') || name.includes('ppkn')) {
    return {
      bgIcon: 'bg-sky-50 border-sky-100 text-sky-600 group-hover:bg-sky-600 group-hover:text-white',
      badge: 'bg-sky-50 text-sky-700 border-sky-200',
      borderTop: 'from-sky-500 to-indigo-600',
      accentGlow: 'hover:shadow-sky-500/10',
    };
  }
  return {
    bgIcon: 'bg-indigo-50 border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    borderTop: 'from-indigo-500 to-purple-600',
    accentGlow: 'hover:shadow-indigo-500/10',
  };
}

export const SubjectSelector: React.FC<SubjectSelectorProps> = ({
  subjects = [],
  categories = [],
  materials = [],
  teachers = [],
  students = [],
  allStudentProgress = {},
  completedMaterialIds = [],
  completedMaterialTimestamps = {},
  activityLogs = [],
  bookmarkedMaterialIds = [],
  onToggleBookmark,
  userNotes = {},
  onSaveNote,
  searchQuery,
  onSelectSubject,
  onDirectOpenMaterial,
  authSession,
  activeTab: controlledActiveTab,
  onTabChange,
  onOpenIcebreakingGame,
}) => {
  const safeSubjects = useMemo(() => (Array.isArray(subjects) ? subjects : []), [subjects]);
  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const safeMaterials = useMemo(() => (Array.isArray(materials) ? materials : []), [materials]);

  const [internalActiveTab, setInternalActiveTab] = useState<SubjectSelectorTab>('subjects');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'not_started'>('all');

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab: SubjectSelectorTab) => {
    if (onTabChange) onTabChange(tab);
    setInternalActiveTab(tab);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (typeof document !== 'undefined') {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeTab]);

  const currentStudent = authSession?.role === 'student' ? authSession.student : undefined;

  const safeCompletedMaterialIds = useMemo(
    () => normalizeCompletedMaterialIds(completedMaterialIds),
    [completedMaterialIds]
  );

  // Global student progress across all materials
  const publishedMaterials = useMemo(() => safeMaterials.filter((m) => m && m.isPublished), [safeMaterials]);
  const totalAllPublished = publishedMaterials.length;
  const totalAllCompleted = useMemo(
    () => publishedMaterials.filter((m) => safeCompletedMaterialIds.includes(m.id)).length,
    [publishedMaterials, safeCompletedMaterialIds]
  );
  const globalProgressPct = totalAllPublished > 0 ? Math.round((totalAllCompleted / totalAllPublished) * 100) : 0;
  const isGlobalAllCompleted = totalAllPublished > 0 && totalAllCompleted === totalAllPublished;

  // Calculate stats per subject
  const subjectStatsMap = useMemo(() => {
    const map: Record<string, { total: number; completed: number; pct: number; isCompleted: boolean; isInProgress: boolean; isNotStarted: boolean }> = {};
    safeSubjects.forEach((subj) => {
      if (!subj) return;
      const subjCats = safeCategories.filter((c) => c && (c.subjectId === subj.id || (!c.subjectId && subj.id === 'informatika')));
      const catIds = (subjCats || []).map((c) => c?.id).filter(Boolean);
      const subjMats = safeMaterials.filter((m) => m && catIds.includes(m.categoryId) && m.isPublished);
      const completed = subjMats.filter((m) => safeCompletedMaterialIds.includes(m.id)).length;
      const total = subjMats.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isCompleted = total > 0 && completed === total;
      const isInProgress = completed > 0 && !isCompleted;
      const isNotStarted = completed === 0;
      map[subj.id] = { total, completed, pct, isCompleted, isInProgress, isNotStarted };
    });
    return map;
  }, [safeSubjects, safeCategories, safeMaterials, safeCompletedMaterialIds]);

  // Counts for filters
  const filterCounts = useMemo(() => {
    let inProgressCount = 0;
    let completedCount = 0;
    let notStartedCount = 0;

    safeSubjects.forEach((s) => {
      if (!s) return;
      const st = subjectStatsMap[s.id];
      if (st) {
        if (st.isCompleted) completedCount++;
        else if (st.isInProgress) inProgressCount++;
        else notStartedCount++;
      }
    });

    return {
      all: safeSubjects.length,
      in_progress: inProgressCount,
      completed: completedCount,
      not_started: notStartedCount,
    };
  }, [safeSubjects, subjectStatsMap]);

  // Filtered subjects based on search & status filter
  const filteredSubjects = useMemo(() => {
    return safeSubjects.filter((subj) => {
      if (!subj) return false;
      // 1. Status filter
      const st = subjectStatsMap[subj.id];
      if (statusFilter === 'in_progress' && !st?.isInProgress) return false;
      if (statusFilter === 'completed' && !st?.isCompleted) return false;
      if (statusFilter === 'not_started' && !st?.isNotStarted) return false;

      // 2. Search query filter
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const nameMatch = subj.name ? subj.name.toLowerCase().includes(q) : false;
      const codeMatch = subj.code ? subj.code.toLowerCase().includes(q) : false;
      const descMatch = subj.description ? subj.description.toLowerCase().includes(q) : false;

      const subjCats = safeCategories.filter((c) => c && (c.subjectId === subj.id || (!c.subjectId && subj.id === 'informatika')));
      const catMatch = subjCats.some((c) => c.title && c.title.toLowerCase().includes(q));

      return nameMatch || codeMatch || descMatch || catMatch;
    });
  }, [safeSubjects, subjectStatsMap, statusFilter, searchQuery, safeCategories]);

  const safeBookmarks = useMemo(() => (Array.isArray(bookmarkedMaterialIds) ? bookmarkedMaterialIds : []), [bookmarkedMaterialIds]);

  // Bookmarked materials list
  const bookmarkedMaterials = useMemo(() => {
    return publishedMaterials.filter((m) => safeBookmarks.includes(m.id));
  }, [publishedMaterials, safeBookmarks]);

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery) return bookmarkedMaterials;
    const q = searchQuery.toLowerCase();
    return bookmarkedMaterials.filter((m) => {
      const cat = safeCategories.find((c) => c.id === m.categoryId);
      const subj = safeSubjects.find((s) => s.id === cat?.subjectId);
      return (
        m.title.toLowerCase().includes(q) ||
        (cat && cat.title.toLowerCase().includes(q)) ||
        (subj && subj.name.toLowerCase().includes(q))
      );
    });
  }, [bookmarkedMaterials, searchQuery, safeCategories, safeSubjects]);

  const handleDirectOpen = (subjectId: string, categoryId: string, materialId: string) => {
    if (onDirectOpenMaterial) {
      onDirectOpenMaterial(subjectId, categoryId, materialId);
    } else {
      onSelectSubject(subjectId);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full animate-in fade-in duration-300">
      
      {/* Compact Modern Hero Card */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-indigo-500/30 text-white p-3.5 sm:p-5 lg:p-6 border shadow-lg">
        
        {/* Ambient Subtle Glows */}
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 lg:gap-6 items-center">
          
          {/* Header Area: Badges & Title (Left 7 cols on desktop) */}
          <div className="space-y-2 sm:space-y-2.5 lg:col-span-7">
            
            {/* Top Badges Bar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/15 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 backdrop-blur-md transition-colors">
                <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                <span>Portal Pembelajaran</span>
              </span>

              {currentStudent ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 flex items-center gap-1.5 backdrop-blur-md">
                  <GraduationCap className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Kelas {currentStudent.kelas}</span>
                  {currentStudent.noAbsen && <span className="opacity-75 font-mono">• Absen {currentStudent.noAbsen}</span>}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-rose-500/20 text-rose-200 border border-rose-400/30 flex items-center gap-1.5 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>Kurikulum Merdeka</span>
                </span>
              )}

              {isGlobalAllCompleted && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 flex items-center gap-1.5 backdrop-blur-md shadow-2xs">
                  <Award className="w-3 h-3 text-emerald-300" />
                  <span>Semua Selesai</span>
                </span>
              )}
            </div>

            {/* Main Title & Subtitle */}
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug drop-shadow-sm break-words">
                {currentStudent ? `Materi & Modul Belajar Siswa` : 'Sistem Pembelajaran Mandiri'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-4xl pt-0.5 break-words">
                {currentStudent 
                  ? `Selamat datang, ${currentStudent.nama}! Akses materi interaktif, rangkuman, kuis evaluasi, dan modul penugasan kelas ${currentStudent.kelas}.`
                  : `Jelajahi ${subjects.length} mata pelajaran, ${categories.length} topik pembelajaran, dan ${materials.length} materi ajar interaktif.`}
              </p>
            </div>

          </div>

          {/* Compact Ringkasan Belajar Bar (Right 5 cols on desktop) */}
          <div className="w-full bg-slate-900/80 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-4 space-y-2.5 shadow-md lg:col-span-5">
            
            {/* Top Progress Line */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-white">Ringkasan Belajar</span>
                  <span className="text-[11px] text-slate-300 font-medium truncate">
                    • {totalAllCompleted} dari {totalAllPublished} materi selesai
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs shrink-0 self-start sm:self-auto">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{globalProgressPct}% Tuntas</span>
              </div>
            </div>

            {/* Slim Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/10 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${globalProgressPct}%` }}
              />
            </div>

            {/* Quick Compact Metrics (Single row) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
              <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 flex items-center justify-between gap-1 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 truncate">Mapel Tuntas</span>
                <span className="text-xs sm:text-sm font-black text-emerald-400 shrink-0">{filterCounts.completed}</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 flex items-center justify-between gap-1 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 truncate">Sedang Berjalan</span>
                <span className="text-xs sm:text-sm font-black text-sky-400 shrink-0">{filterCounts.in_progress}</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 flex items-center justify-between gap-1 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 truncate">Materi Selesai</span>
                <span className="text-xs sm:text-sm font-black text-amber-300 shrink-0">{totalAllCompleted}</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 flex items-center justify-between gap-1 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 truncate">Total Mapel</span>
                <span className="text-xs sm:text-sm font-black text-indigo-300 shrink-0">{subjects.length}</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Modern Responsive Navigation & Interactive Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 sm:p-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
        
        {/* Left: Tab Selector (Compact & High Contrast) */}
        <div className="bg-slate-100/90 p-1 rounded-xl flex items-center gap-1 shrink-0 border border-slate-200/60 overflow-x-auto max-w-full scrollbar-none overscroll-x-contain touch-pan-x">
          
          <button
            type="button"
            onClick={() => setActiveTab('subjects')}
            className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'subjects'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
            }`}
          >
            <BookMarked className="w-4 h-4 shrink-0" />
            <span>Mata Pelajaran</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'subjects' ? 'bg-indigo-700 text-white' : 'bg-slate-200/80 text-slate-700'}`}>
              {subjects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'bookmarks'
                ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-400'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
            }`}
          >
            <Bookmark className="w-4 h-4 shrink-0" />
            <span>Materi Ditandai</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'bookmarks' ? 'bg-amber-600 text-white' : 'bg-slate-200/80 text-slate-700'}`}>
              {bookmarkedMaterials.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'bg-violet-600 text-white shadow-sm ring-1 ring-violet-500'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Papan Peringkat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity_log')}
            className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'activity_log'
                ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Riwayat Belajar</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'activity_log' ? 'bg-slate-800 text-amber-300' : 'bg-slate-200/80 text-slate-700'}`}>
              {totalAllCompleted}
            </span>
          </button>

        </div>

      </div>

      {/* Render Active View */}
      {activeTab === 'leaderboard' ? (
        <Leaderboard
          students={students}
          subjects={subjects}
          categories={categories}
          materials={materials}
          currentStudent={currentStudent}
          allStudentProgress={allStudentProgress}
          isTeacherOrAdmin={authSession?.role === 'admin' || authSession?.role === 'teacher'}
        />
      ) : activeTab === 'bookmarks' ? (
        <div className="space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bookmark className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Materi Ditandai (Bookmarks)</h3>
                <p className="text-xs text-slate-500">Daftar materi penting yang telah kamu tandai untuk diakses kembali dengan cepat</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 text-xs font-black shrink-0 border border-amber-200">
              {filteredBookmarks.length} Tersimpan
            </span>
          </div>

          {filteredBookmarks.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center border border-amber-100 shadow-xs">
                <Bookmark className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-base">Belum Ada Materi yang Ditandai</h4>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Saat membuka materi pembelajaran, klik tombol <strong className="text-amber-700">"Tandai Materi"</strong> di bilah atas untuk menyimpannya di sini agar mudah dibuka kembali.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('subjects')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                <span>Jelajahi Mata Pelajaran</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBookmarks.map((mat) => {
                const cat = categories.find((c) => c.id === mat.categoryId);
                const subj = subjects.find((s) => s.id === cat?.subjectId);
                const isDone = completedMaterialIds.includes(mat.id);

                return (
                  <div
                    key={mat.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-400/80 p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-all group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-black text-[11px] truncate border border-indigo-100">
                          {subj?.name || 'Mata Pelajaran'}
                        </span>
                        {isDone ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Selesai
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                            Belum Selesai
                          </span>
                        )}
                      </div>

                      {cat && (
                        <p className="text-xs font-semibold text-slate-400 truncate">
                          Topik: {cat.title}
                        </p>
                      )}

                      <h4 className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                        {mat.title}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleDirectOpen(subj?.id || '', cat?.id || '', mat.id)}
                        className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                      >
                        <span>Buka Materi</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {onToggleBookmark && (
                        <button
                          type="button"
                          onClick={() => onToggleBookmark(mat.id)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 transition-all cursor-pointer"
                          title="Hapus dari daftar penanda"
                        >
                          <Bookmark className="w-4 h-4 fill-amber-500 text-amber-500" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'activity_log' ? (
        <StudentActivityLog
          activityLogs={activityLogs}
          completedMaterialTimestamps={completedMaterialTimestamps}
          completedMaterialIds={safeCompletedMaterialIds}
          subjects={subjects}
          categories={categories}
          materials={materials}
          onDirectOpenMaterial={handleDirectOpen}
          authSession={authSession}
        />
      ) : (
        /* Tab 1: Symmetrical, High-End Subject Cards Grid */
        <div className="space-y-4 sm:space-y-5">

          {/* Symmetrical Section Header */}
          <div className="bg-slate-100/90 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 sm:gap-3 select-none flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <BookMarked className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">
                Daftar Mata Pelajaran <span className="text-slate-500 font-semibold text-[10px] sm:text-xs">({filteredSubjects.length} Ditampilkan)</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] sm:text-[11px] font-black border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
              {currentStudent && (
                <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-indigo-100 hidden xs:inline-block">
                  Kelas {currentStudent.kelas}
                </span>
              )}
            </div>
          </div>

          {/* Grid of Subject Cards */}
          {filteredSubjects.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Tidak Ada Mata Pelajaran Sesuai Filter</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                {statusFilter !== 'all'
                  ? `Tidak ada mata pelajaran dengan status "${statusFilter}". Coba ubah filter atau atur ke "Semua".`
                  : searchQuery
                  ? `Tidak ditemukan mata pelajaran yang cocok dengan kata kunci "${searchQuery}".`
                  : `Belum ada mata pelajaran yang ditugaskan oleh guru untuk Kelas ${currentStudent?.kelas || ''}.`}
              </p>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tampilkan Semua Mapel</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6 items-stretch">
              {(filteredSubjects || []).map((subj) => {
                if (!subj) return null;
                const subjCats = safeCategories.filter((c) => c && (c.subjectId === subj.id || (!c.subjectId && subj.id === 'informatika')));
                const catIds = (subjCats || []).map((c) => c?.id).filter(Boolean);
                const subjMats = safeMaterials.filter((m) => m && catIds.includes(m.categoryId) && m.isPublished);

                const completedCount = subjMats.filter((m) => (completedMaterialIds || []).includes(m.id)).length;
                const totalCount = subjMats.length;
                const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                const isFullyCompleted = totalCount > 0 && completedCount === totalCount;
                const isInProgress = completedCount > 0 && !isFullyCompleted;

                const theme = getSubjectTheme(subj.name, subj.code);

                // Find teacher(s) for this subject
                const subjTeachers = getTeachersForSubject(subj, teachers);
                const primaryTeacher = currentStudent
                  ? (subjTeachers.find((t) => doesTeacherTeachClass(t, currentStudent.kelas)) || subjTeachers[0])
                  : subjTeachers[0];

                return (
                  <div
                    key={subj.id}
                    onClick={() => onSelectSubject(subj.id)}
                    className={`group bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 active:scale-[0.99] h-full ${
                      isFullyCompleted
                        ? 'border-emerald-300/90 bg-gradient-to-b from-white via-emerald-50/10 to-white hover:border-emerald-400'
                        : isInProgress
                        ? 'border-sky-300/90 bg-gradient-to-b from-white via-sky-50/10 to-white hover:border-sky-400'
                        : 'border-slate-200/90 hover:border-indigo-300'
                    }`}
                  >
                    {/* Top Accent Strip */}
                    <div
                      className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${
                        isFullyCompleted
                          ? 'from-emerald-500 to-teal-500'
                          : isInProgress
                          ? 'from-sky-500 via-blue-500 to-indigo-600'
                          : theme.borderTop
                      } group-hover:h-2 transition-all duration-300`}
                    />

                    {/* Top Section: Icon, Status, Title, Teacher, Metadata */}
                    <div className="space-y-2.5 sm:space-y-3 pt-1">
                      
                      {/* Row 1: Subject Icon & Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border flex items-center justify-center transition-all duration-300 shrink-0 group-hover:scale-105 shadow-2xs ${
                            isFullyCompleted
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : isInProgress
                              ? 'bg-sky-50 border-sky-200 text-sky-600'
                              : theme.bgIcon
                          }`}
                        >
                          {getSubjectIcon(subj.icon, 'w-4.5 h-4.5 sm:w-5 sm:h-5')}
                        </div>

                        {isFullyCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] sm:text-[11px] font-black bg-emerald-100/90 text-emerald-800 rounded-full border border-emerald-300/80 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                            <span>100% Tuntas</span>
                          </span>
                        ) : isInProgress ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold bg-sky-100/90 text-sky-800 rounded-full border border-sky-300/80 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                            <span>Sedang Belajar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                            {subj.code ? `${subj.code} • ` : ''}{subjCats.length} Topik
                          </span>
                        )}
                      </div>

                      {/* Row 2: Title & Teacher Subtitle */}
                      <div className="space-y-1">
                        <h3 className="font-heading text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.5rem] flex items-center break-words">
                          {subj.name}
                        </h3>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">
                            {primaryTeacher ? (
                              <span>Guru: <strong className="text-slate-700 font-semibold">{primaryTeacher.name}</strong></span>
                            ) : (
                              <span className="text-slate-400 italic">Modul Mandiri</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Metadata Badges (Topik & Modul) */}
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/60">
                          <BookOpen className="w-3 h-3 text-slate-400" />
                          <span>{subjCats.length} Topik</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/60">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{subjMats.length} Modul Ajar</span>
                        </span>
                      </div>

                    </div>

                    {/* Bottom Section: Progress Bar & Action CTA */}
                    <div className="space-y-2.5 sm:space-y-3 pt-3 mt-3 sm:pt-3.5 sm:mt-3.5 border-t border-slate-100">
                      
                      {/* Progress Indicator */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium text-[11px]">Progres Pembelajaran</span>
                          <div className="flex items-center gap-1 font-bold">
                            <span
                              className={
                                isFullyCompleted
                                  ? 'text-emerald-600 font-black text-[11px]'
                                  : isInProgress
                                  ? 'text-sky-600 font-black text-[11px]'
                                  : 'text-indigo-600 font-black text-[11px]'
                              }
                            >
                              {progressPercent}%
                            </span>
                            <span className="text-slate-400 font-normal text-[10px]">
                              ({completedCount}/{totalCount})
                            </span>
                          </div>
                        </div>
                        
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/60 shadow-inner">
                          <div
                            className={`h-full transition-all duration-700 ease-out rounded-full ${
                              isFullyCompleted
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : isInProgress
                                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Full-width CTA Button that illuminates on hover */}
                      <div
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all duration-200 shadow-2xs ${
                          isFullyCompleted
                            ? 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white'
                            : isInProgress
                            ? 'bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white'
                            : 'bg-slate-50 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white'
                        }`}
                      >
                        <span>{isFullyCompleted ? 'Review Materi' : isInProgress ? 'Lanjut Belajar' : 'Buka Pelajaran'}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
