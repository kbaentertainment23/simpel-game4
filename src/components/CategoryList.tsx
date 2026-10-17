import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMobileBackModal } from '../utils/mobileNavigation';
import {
  BookOpen,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Layers,
  GraduationCap,
  ChevronRight,
  Lock,
  X,
  Bomb,
  Flame,
  Users,
  Sparkles,
} from 'lucide-react';
import { Subject, Category, Material, AuthSession, TeacherAccount } from '../types';
import { GameSession } from '../types/game';
import { subscribeActiveGameForSubject, joinGameSession } from '../lib/gameService';
import { unlockAudioContext } from '../utils/gameAudio';
import { getSubjectIcon } from '../utils/subjectIcons';
import { checkCategoryUnlockStatus, getCategoryPrerequisiteChain } from '../utils/prerequisites';
import { formatTargetGradeLabel } from '../utils/quizGenerator';
import { useBodyScrollLock } from '../utils/scrollLock';

interface CategoryListProps {
  currentSubject?: Subject | null;
  categories: Category[];
  materials: Material[];
  searchQuery: string;
  completedMaterialIds: string[];
  teachers?: TeacherAccount[];
  onSelectCategory: (categoryId: string) => void;
  onBackToSubjects?: () => void;
  onOpenGuide?: () => void;
  onOpenIcebreakingGame?: (targetRoomToken?: string) => void;
  onJoinedGame?: (session: GameSession) => void;
  authSession?: AuthSession | null;
}

type SortOption = 'default' | 'alpha-asc' | 'alpha-desc' | 'date-desc' | 'date-asc';

export const CategoryList: React.FC<CategoryListProps> = ({
  currentSubject,
  categories = [],
  materials = [],
  searchQuery = '',
  completedMaterialIds = [],
  teachers = [],
  onSelectCategory,
  onBackToSubjects,
  onOpenIcebreakingGame,
  onJoinedGame,
  authSession,
}) => {
  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const safeMaterials = useMemo(() => (Array.isArray(materials) ? materials : []), [materials]);
  const safeCompletedIds = useMemo(() => (Array.isArray(completedMaterialIds) ? completedMaterialIds : []), [completedMaterialIds]);

  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [activeGame, setActiveGame] = useState<GameSession | null>(null);
  const [isJoiningGame, setIsJoiningGame] = useState(false);
  const [joinGameError, setJoinGameError] = useState<string | null>(null);

  // Subscribe to real-time active game session for this subject
  useEffect(() => {
    if (!currentSubject?.id) {
      setActiveGame(null);
      return;
    }

    const studentClass = authSession?.student?.kelas;
    const unsub = subscribeActiveGameForSubject(
      currentSubject.id,
      teachers || [],
      (session) => {
        setActiveGame(session);
      },
      studentClass
    );

    return () => unsub();
  }, [currentSubject?.id, teachers, authSession?.student?.kelas]);

  const handleDirectJoinActiveGame = async () => {
    if (!activeGame) return;

    // Explicitly unlock audio on user gesture tap
    unlockAudioContext();

    if (authSession?.student) {
      try {
        setIsJoiningGame(true);
        setJoinGameError(null);
        const res = await joinGameSession(activeGame.id, {
          id: authSession.student.id,
          nama: authSession.student.nama,
          nisn: authSession.student.nisn,
          kelas: authSession.student.kelas,
        });

        if (res.success && res.session) {
          onJoinedGame?.(res.session);
          return;
        } else {
          setJoinGameError(res.message || 'Gagal masuk ke permainan.');
          onOpenIcebreakingGame?.(activeGame.roomToken);
        }
      } catch (err: any) {
        setJoinGameError(err?.message || 'Terjadi kesalahan saat masuk');
        onOpenIcebreakingGame?.(activeGame.roomToken);
      } finally {
        setIsJoiningGame(false);
      }
    } else {
      onOpenIcebreakingGame?.(activeGame.roomToken);
    }
  };

  const [lockedModalData, setLockedModalData] = useState<{
    targetTopicTitle: string;
    targetTopicNumber: number;
    requiredTopicTitle: string;
    requiredTopicNumber: number;
    requiredTopicId: string;
    isReqTopicUnlocked: boolean;
    activeAvailableTopicTitle: string;
    activeAvailableTopicNumber: number;
    activeAvailableTopicId: string;
    explanation?: string;
    completedMatsCount: number;
    totalMatsCount: number;
  } | null>(null);

  // Support Android hardware back button / swipe-to-close on mobile
  useMobileBackModal('locked-topic-modal', Boolean(lockedModalData), () => setLockedModalData(null));

  // Freeze background layer and lock body scroll completely while locked topic modal is active
  useBodyScrollLock(Boolean(lockedModalData));

  useEffect(() => {
    if (!lockedModalData) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLockedModalData(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lockedModalData]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (typeof document !== 'undefined') {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [currentSubject?.id]);

  const isTeacherOrAdmin = authSession?.role === 'admin' || authSession?.role === 'teacher';

  // Filter categories by subject (if subject is selected) and searchQuery
  const subjectCategories = useMemo(() => {
    return currentSubject
      ? safeCategories.filter((cat) => cat && (cat.subjectId === currentSubject.id || (!cat.subjectId && currentSubject.id === 'informatika')))
      : safeCategories;
  }, [currentSubject, safeCategories]);

  // Base canonical sequential ordering of categories within the subject
  const sequentialCategories = useMemo(() => {
    return [...subjectCategories].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [subjectCategories]);

  // Helper map: for each categoryId, is it unlocked?
  const categoryUnlockMap = useMemo(() => {
    const map: Record<string, { isUnlocked: boolean; requiredCategory?: Category; requiredCatNumber?: number; isPrereqConfigured?: boolean }> = {};
    
    sequentialCategories.forEach((cat) => {
      if (!cat) return;
      const status = checkCategoryUnlockStatus(cat, safeCategories, safeMaterials, safeCompletedIds, authSession);
      map[cat.id] = status;
    });

    return map;
  }, [sequentialCategories, safeCategories, safeMaterials, safeCompletedIds, authSession]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return subjectCategories;
    const q = searchQuery.toLowerCase();
    return subjectCategories.filter((cat) => {
      if (!cat) return false;
      const titleMatch = cat.title ? cat.title.toLowerCase().includes(q) : false;
      const descMatch = cat.description ? cat.description.toLowerCase().includes(q) : false;

      // Also match material titles inside this category
      const catMats = safeMaterials.filter((m) => m && m.categoryId === cat.id);
      const matMatch = catMats.some((m) => m.title && m.title.toLowerCase().includes(q));

      return titleMatch || descMatch || matMatch;
    });
  }, [subjectCategories, searchQuery, safeMaterials]);

  const sortedCategories = useMemo(() => {
    return [...filteredCategories].sort((a, b) => {
      if (sortBy === 'alpha-asc') {
        return a.title.localeCompare(b.title, 'id', { sensitivity: 'base' });
      }
      if (sortBy === 'alpha-desc') {
        return b.title.localeCompare(a.title, 'id', { sensitivity: 'base' });
      }
      if (sortBy === 'date-desc') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'date-asc') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      return (a.order || 0) - (b.order || 0);
    });
  }, [filteredCategories, sortBy]);

  const handleCardClick = (cat: Category, catIndexInSequence: number) => {
    const unlockInfo = categoryUnlockMap[cat.id];
    const isUnlocked = unlockInfo?.isUnlocked || isTeacherOrAdmin;

    if (isUnlocked) {
      onSelectCategory(cat.id);
    } else {
      const chain = getCategoryPrerequisiteChain(
        cat,
        safeCategories,
        safeMaterials,
        safeCompletedIds,
        authSession
      );

      const reqCat = chain?.immediateRequiredCategory || unlockInfo?.requiredCategory;
      if (reqCat) {
        const reqMats = safeMaterials.filter((m) => m && m.categoryId === reqCat.id && m.isPublished);
        const completedMats = reqMats.filter((m) => safeCompletedIds.includes(m.id)).length;

        const activeCat = chain?.activeAvailableCategory || reqCat;
        const activeNum = chain?.activeAvailableCatNumber || unlockInfo?.requiredCatNumber || 1;

        setLockedModalData({
          targetTopicTitle: cat.title,
          targetTopicNumber: catIndexInSequence + 1,
          requiredTopicTitle: reqCat.title,
          requiredTopicNumber: chain?.immediateRequiredCatNumber || unlockInfo?.requiredCatNumber || catIndexInSequence,
          requiredTopicId: reqCat.id,
          isReqTopicUnlocked: chain ? chain.isImmediateRequiredUnlocked : (categoryUnlockMap[reqCat.id]?.isUnlocked ?? true),
          activeAvailableTopicTitle: activeCat.title,
          activeAvailableTopicNumber: activeNum,
          activeAvailableTopicId: activeCat.id,
          explanation: chain?.explanation,
          completedMatsCount: completedMats,
          totalMatsCount: reqMats.length,
        });
      }
    }
  };

  return (
    <div className={`space-y-3 sm:space-y-6 animate-in fade-in duration-300 relative ${lockedModalData ? 'overflow-hidden max-h-screen pointer-events-none select-none touch-none overscroll-none' : ''}`}>
      
      {/* Background layer: fully frozen (interactively & visually) while locked topic popup is displayed */}
      <div
        className={`space-y-3 sm:space-y-6 transition-all duration-200 ${
          lockedModalData
            ? 'filter blur-[3px] grayscale-[25%] opacity-60 pointer-events-none select-none touch-none overscroll-none'
            : ''
        }`}
        style={
          lockedModalData
            ? {
                touchAction: 'none',
                overscrollBehavior: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }
            : undefined
        }
        aria-hidden={Boolean(lockedModalData)}
        {...(lockedModalData ? { inert: true } : {})}
      >
        {/* Top Navigation & Breadcrumb */}
      {currentSubject && (
        <div className="flex items-center justify-between gap-2 sm:gap-2.5">
          <button
            onClick={onBackToSubjects}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer group ring-2 ring-indigo-300/60"
          >
            <ArrowLeft className="w-4 h-4 text-white stroke-[3] group-hover:-translate-x-0.5 transition-transform" />
            <span>Pilih Mapel</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span onClick={onBackToSubjects} className="hover:text-indigo-600 cursor-pointer shrink-0">Mapel</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="text-slate-900 font-bold truncate">{currentSubject.name}</span>
          </div>
        </div>
      )}

      {/* Subject Header Card (Matching SubjectSelector theme) */}
      {currentSubject && (() => {
        const totalMatsInSubj = materials.filter((m) => {
          const cat = categories.find((c) => c.id === m.categoryId);
          return (cat?.subjectId === currentSubject.id || (!cat?.subjectId && currentSubject.id === 'informatika')) && m.isPublished;
        });
        const completedMatsInSubj = totalMatsInSubj.filter((m) => completedMaterialIds.includes(m.id)).length;
        const subjProgressPct = totalMatsInSubj.length > 0 ? Math.round((completedMatsInSubj / totalMatsInSubj.length) * 100) : 0;
        const isSubjAllCompleted = totalMatsInSubj.length > 0 && completedMatsInSubj === totalMatsInSubj.length;

        return (
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-5 lg:p-6 border border-indigo-500/30 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-5">
            {/* Subtle Ambient Glows */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-10 w-60 h-60 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl min-w-0">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30 border border-indigo-300/40 ring-2 ring-white/10">
                  {getSubjectIcon(currentSubject.icon, 'w-5 h-5 sm:w-6 sm:h-6')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-base sm:text-2xl font-black text-white tracking-tight leading-snug drop-shadow-xs break-words">
                      {currentSubject.name}
                    </h1>
                    {currentSubject.code && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-extrabold bg-white/15 text-indigo-100 border border-white/20 font-mono">
                        {currentSubject.code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Badge */}
            <div className="relative z-10 bg-slate-900/80 backdrop-blur-md px-3.5 py-2.5 rounded-xl sm:rounded-2xl border border-white/10 shrink-0 flex flex-col justify-center gap-1.5 shadow-xs w-full lg:w-auto lg:min-w-[220px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs text-slate-300 font-bold">Progres Mapel</span>
                <span 
                  key={`subj-pct-${subjProgressPct}`}
                  className="text-[10px] sm:text-xs font-black text-amber-300 bg-amber-400/20 border border-amber-300/40 px-1.5 py-0.5 rounded-md animate-in zoom-in-95 duration-300 inline-block"
                >
                  {subjProgressPct}%
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-white/10 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 via-emerald-400 to-teal-300 transition-all duration-700 ease-out rounded-full"
                  style={{ width: `${subjProgressPct}%` }}
                />
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-indigo-200/90 text-right">
                {completedMatsInSubj}/{totalMatsInSubj.length} Materi Selesai
              </div>
            </div>
          </div>
        );
      })()}

      {/* Active Icebreaking Game Session Card - Only appears when teacher of this subject activated a game */}
      {activeGame && currentSubject && (
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 border-2 border-rose-500/40 text-white p-4 sm:p-5 lg:p-6 shadow-xl shadow-rose-950/20 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Left Column: Icon & Room Info */}
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-900/50 shrink-0 border border-rose-400/40 ring-2 ring-white/10 mt-0.5 sm:mt-0">
                <Bomb className="w-7 h-7 sm:w-8 sm:h-8 text-amber-200 animate-pulse" />
              </div>

              <div className="space-y-1.5 min-w-0">
                {/* Badges Bar */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-rose-500 text-white shadow-sm flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>GAME KELAS AKTIF</span>
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    TOKEN: {activeGame.roomToken}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/10 text-slate-200 border border-white/15">
                    {activeGame.targetClass === 'ALL' ? 'Semua Kelas' : `Kelas ${activeGame.targetClass}`}
                  </span>

                  {(activeGame.playerCount !== undefined ? activeGame.playerCount > 0 : (activeGame.players && Object.keys(activeGame.players).length > 0)) && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/10 text-slate-200 border border-white/15 flex items-center gap-1">
                      <Users className="w-3 h-3 text-cyan-300" />
                      <span>{activeGame.playerCount ?? Object.keys(activeGame.players || {}).length} Siswa Bergabung</span>
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Icebreaking: Bomb Passthrough & Trivia ({currentSubject.name})
                </h3>

                {/* Subtitle / Host note */}
                <p className="text-xs sm:text-sm text-slate-300 font-medium line-clamp-2">
                  {activeGame.lastActionMessage || `Guru pengampu (${activeGame.teacherName || 'Bapak/Ibu Guru'}) sedang mengaktifkan game interaktif di mata pelajaran ${currentSubject.name}!`}
                </p>
              </div>
            </div>

            {/* Right Column: CTA Join Button (Touch Friendly) */}
            <div className="shrink-0 pt-1 sm:pt-0 w-full md:w-auto">
              <button
                type="button"
                onClick={handleDirectJoinActiveGame}
                disabled={isJoiningGame}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 hover:from-rose-500 hover:to-amber-400 text-white font-black text-sm sm:text-base shadow-xl shadow-rose-950/50 hover:shadow-rose-500/30 active:scale-95 transition-all cursor-pointer border border-rose-400/50 group min-h-[48px]"
              >
                {isJoiningGame ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                    <span>Menghubungkan ke Game...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-5 h-5 text-amber-200 animate-bounce group-hover:scale-110 transition-transform shrink-0" />
                    <span>Masuk Game Kelas Sekarang</span>
                    <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform shrink-0" />
                  </>
                )}
              </button>
              {joinGameError && (
                <p className="text-xs text-rose-300 font-semibold mt-1.5 text-center md:text-right">
                  {joinGameError}
                </p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Symmetrical Topic Section Bar */}
      <div className="bg-slate-100/90 px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2.5 select-none">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-700 truncate">
            Daftar Topik Pembelajaran <span className="text-slate-500 font-medium text-[11px] sm:text-xs">({sortedCategories.length} Topik)</span>
          </span>
        </div>
      </div>

      {/* Grid of Topic Cards */}
      {sortedCategories.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 text-center bg-white rounded-3xl border border-slate-200 space-y-2"
        >
          <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm">Topik Belum Tersedia</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Tidak ada topik yang cocok dengan pencarian "${searchQuery}".`
              : `Belum ada topik yang dibuat untuk mata pelajaran ini.`}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.04,
                delayChildren: 0.02,
              },
            },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 items-stretch"
        >
          {(sortedCategories || []).map((cat) => {
            const seqIndex = sequentialCategories.findIndex((c) => c.id === cat.id);
            const displayTopicNum = seqIndex >= 0 ? seqIndex + 1 : 1;
            const unlockInfo = categoryUnlockMap[cat.id];
            const isUnlocked = unlockInfo?.isUnlocked || isTeacherOrAdmin;

            const catMats = safeMaterials.filter((m) => m && m.categoryId === cat.id && m.isPublished);
            const completedCountInCat = catMats.filter((m) => safeCompletedIds.includes(m.id)).length;
            const isAllCompleted = catMats.length > 0 && completedCountInCat === catMats.length;
            const isInProgress = completedCountInCat > 0 && !isAllCompleted;
            const catProgressPct = catMats.length > 0 ? Math.round((completedCountInCat / catMats.length) * 100) : 0;

            return (
              <motion.div
                key={cat.id}
                variants={{
                  hidden: { opacity: 0, y: 14, scale: 0.98 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: {
                      duration: 0.28,
                      ease: [0.22, 1, 0.36, 1],
                    },
                  },
                }}
                whileHover={{ y: -4, transition: { duration: 0.18, ease: 'easeOut' } }}
                whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
                onClick={() => handleCardClick(cat, seqIndex)}
                className={`group rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border transition-shadow duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden shadow-xs hover:shadow-xl h-full ${
                  isAllCompleted
                    ? 'border-emerald-300/90 shadow-2xs hover:border-emerald-500 bg-gradient-to-b from-white via-emerald-50/10 to-white'
                    : !isUnlocked
                    ? 'border-slate-200 bg-slate-50/90 hover:bg-slate-100/90 hover:border-slate-300 shadow-2xs'
                    : isInProgress
                    ? 'border-sky-300/90 shadow-2xs hover:border-sky-500 bg-gradient-to-b from-white via-sky-50/10 to-white'
                    : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-indigo-300'
                }`}
              >
                {/* Accent Top Border Gradient */}
                <div
                  className={`absolute top-0 left-0 w-full h-1.5 transition-all duration-300 ${
                    isAllCompleted
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 group-hover:h-2'
                      : !isUnlocked
                      ? 'bg-slate-300'
                      : isInProgress
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 group-hover:h-2'
                      : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 group-hover:h-2'
                  }`}
                />

                <div className="space-y-3 pt-1">
                  {/* Top Row: Icon + Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all duration-300 shrink-0 group-hover:scale-105 shadow-2xs ${
                        isAllCompleted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                          : !isUnlocked
                          ? 'bg-slate-200/80 border-slate-300 text-slate-500'
                          : isInProgress
                          ? 'bg-sky-50 border-sky-200 text-sky-600'
                          : 'bg-indigo-50 border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                      }`}
                    >
                      {getSubjectIcon(cat.icon, 'w-5 h-5')}
                    </div>

                    <div className="shrink-0 max-w-[65%] flex justify-end">
                      {isAllCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          100% Tuntas
                        </span>
                      ) : !isUnlocked ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-200/90 text-slate-700 border border-slate-300 shadow-2xs text-right leading-tight max-w-full"
                          title={`Buka dengan menyelesaikan Topik #${unlockInfo?.requiredCatNumber || 1}`}
                        >
                          <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="flex flex-col text-left">
                            <span className="font-extrabold text-slate-800 text-[10px]">Terkunci</span>
                            <span className="text-[9px] text-slate-500 font-semibold">Syarat: Topik #{unlockInfo?.requiredCatNumber || 1}</span>
                          </span>
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-sky-100 text-sky-800 border border-sky-300 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                          Sedang Belajar
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {catMats.length} Modul
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border font-mono ${
                        !isUnlocked ? 'bg-slate-200/60 text-slate-500 border-slate-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        Topik #{String(displayTopicNum).padStart(2, '0')}
                      </span>
                      {isTeacherOrAdmin && !unlockInfo?.isUnlocked && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                          Akses Guru
                        </span>
                      )}
                    </div>
                    <h3 className={`font-heading text-base font-extrabold line-clamp-2 leading-snug min-h-[2.5rem] flex items-center transition-colors ${
                      !isUnlocked ? 'text-slate-700' : 'text-slate-900 group-hover:text-indigo-600'
                    }`}>
                      {cat.title}
                    </h3>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/60">
                      <BookOpen className="w-3 h-3 text-slate-400" />
                      <span>{catMats.length} Modul Ajar</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50/90 px-2 py-0.5 rounded-md border border-indigo-200/70">
                      <GraduationCap className="w-3 h-3 text-indigo-500" />
                      <span>{formatTargetGradeLabel(cat.targetGrade)}</span>
                    </span>
                  </div>

                </div>

                {/* Bottom Section: Progress & Action CTA */}
                <div className="space-y-3 pt-3.5 mt-3.5 border-t border-slate-100">
                  {/* Progress Indicator */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium text-[11px]">
                        {!isUnlocked ? 'Status Pembelajaran' : 'Progres Topik'}
                      </span>
                      <div className="flex items-center gap-1 font-bold">
                        <span
                          className={
                            isAllCompleted
                              ? 'text-emerald-600 font-black text-[11px]'
                              : !isUnlocked
                              ? 'text-slate-500 font-bold text-[11px]'
                              : isInProgress
                              ? 'text-sky-600 font-black text-[11px]'
                              : 'text-indigo-600 font-black text-[11px]'
                          }
                        >
                          {!isUnlocked ? (
                            'Terkunci'
                          ) : (
                            <>
                              <span key={`cat-pct-${catProgressPct}`} className="animate-in zoom-in-95 duration-300 inline-block">
                                {catProgressPct}%
                              </span>
                              <span className="text-slate-400 font-normal text-[10px]">
                                ({completedCountInCat}/{catMats.length})
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/60 shadow-inner">
                      <div
                        className={`h-full transition-all duration-700 ease-out rounded-full ${
                          isAllCompleted
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : !isUnlocked
                            ? 'bg-slate-300 w-0'
                            : isInProgress
                            ? 'bg-gradient-to-r from-sky-500 via-indigo-500 to-indigo-600'
                            : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-500'
                        }`}
                        style={{ width: !isUnlocked ? '0%' : `${catProgressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Full-width CTA Button */}
                  <div
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all duration-200 shadow-2xs ${
                      isAllCompleted
                        ? 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white'
                        : !isUnlocked
                        ? 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        : isInProgress
                        ? 'bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white'
                        : 'bg-slate-50 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}
                  >
                    {!isUnlocked ? (
                      <>
                        <span className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Modul Terkunci</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">Selesaikan Prasyarat</span>
                      </>
                    ) : (
                      <>
                        <span>{isAllCompleted ? 'Review Topik' : isInProgress ? 'Lanjut Belajar' : 'Buka Topik'}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
                      </>
                    )}
                  </div>
                </div>

              </motion.div>
            );
          })}
        </motion.div>
      )}

      </div>

      {/* Locked Topic Alert Modal */}
      {lockedModalData && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto touch-none select-none overscroll-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLockedModalData(null);
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
              onClick={() => setLockedModalData(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  Mekanisme Belajar Berurutan
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  Topik Belum Terbuka
                </h3>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5 text-xs text-slate-700 leading-relaxed">
              <p>
                Untuk mengakses <strong>Topik #{lockedModalData.targetTopicNumber}: {lockedModalData.targetTopicTitle}</strong>, kamu harus menyelesaikan seluruh modul materi pada topik prasyarat secara berurutan terlebih dahulu.
              </p>
              
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-500">Prasyarat Langsung:</p>
                    <p className="font-extrabold text-slate-900 truncate">
                      Topik #{lockedModalData.requiredTopicNumber}: {lockedModalData.requiredTopicTitle}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded border shrink-0 ${
                    lockedModalData.isReqTopicUnlocked
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                  }`}>
                    {lockedModalData.isReqTopicUnlocked ? (
                      `${lockedModalData.completedMatsCount}/${lockedModalData.totalMatsCount} Selesai`
                    ) : (
                      'Masih Terkunci'
                    )}
                  </span>
                </div>

                {!lockedModalData.isReqTopicUnlocked && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                      <p className="font-bold flex items-center gap-1.5 text-amber-800">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Topik #{lockedModalData.requiredTopicNumber} juga belum terbuka</span>
                      </p>
                      <p className="text-[11px] mt-1 text-amber-800/90 font-medium">
                        {lockedModalData.explanation || `Kamu harus menyelesaikan Topik #${lockedModalData.activeAvailableTopicNumber} (${lockedModalData.activeAvailableTopicTitle}) terlebih dahulu.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              {lockedModalData.isReqTopicUnlocked ? (
                <button
                  onClick={() => {
                    const reqId = lockedModalData.requiredTopicId;
                    setLockedModalData(null);
                    onSelectCategory(reqId);
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>Buka Topik #{lockedModalData.requiredTopicNumber}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    const activeId = lockedModalData.activeAvailableTopicId;
                    setLockedModalData(null);
                    onSelectCategory(activeId);
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-center"
                >
                  <span>Buka Topik #{lockedModalData.activeAvailableTopicNumber} (Mulai Belajar)</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              )}
              <button
                onClick={() => setLockedModalData(null)}
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

