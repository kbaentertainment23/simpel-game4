import React, { useState, useEffect } from 'react';
import {
  Search,
  Lock,
  CheckCircle2,
  Award,
  Sparkles,
  GraduationCap,
  WifiOff,
  X,
  ChevronDown,
  Trophy,
  Bomb,
} from 'lucide-react';
import { parseLogoUrl } from '../utils/urlParser';
import { confirmExitExam } from '../utils/examSession';
import { AuthSession } from '../types';
import { UserProfileModal } from './UserProfileModal';
import { unlockAudioContext } from '../utils/gameAudio';

interface NavbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isAdmin: boolean;
  authSession?: AuthSession | null;
  onOpenAdminLogin: () => void;
  onOpenAdminDashboard: () => void;
  onLogoutAdmin: () => void;
  completedCount: number;
  totalMaterialsCount: number;
  overallCompletedCount?: number;
  overallTotalMaterialsCount?: number;
  selectedSubjectName?: string;
  onGoHome: () => void;
  logoUrl?: string;
  onOpenLeaderboard?: () => void;
  onOpenIcebreakingGame?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  setSearchQuery,
  isAdmin,
  authSession,
  onOpenAdminLogin,
  onOpenAdminDashboard,
  onLogoutAdmin,
  completedCount,
  totalMaterialsCount,
  overallCompletedCount,
  overallTotalMaterialsCount,
  selectedSubjectName,
  onGoHome,
  logoUrl,
  onOpenLeaderboard,
  onOpenIcebreakingGame,
}) => {
  const progressPercent = totalMaterialsCount > 0 ? Math.round((completedCount / totalMaterialsCount) * 100) : 0;
  const effectiveOverallCompleted = overallCompletedCount !== undefined ? overallCompletedCount : completedCount;
  const effectiveOverallTotal = overallTotalMaterialsCount !== undefined ? overallTotalMaterialsCount : totalMaterialsCount;
  const [imgError, setImgError] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const displayLogoUrl = logoUrl ? parseLogoUrl(logoUrl) : '';

  // Get initial letter for avatar
  const getAvatarLetter = () => {
    if (authSession?.student?.nama) return authSession.student.nama.charAt(0).toUpperCase();
    if (authSession?.teacher?.name) return authSession.teacher.name.charAt(0).toUpperCase();
    if (authSession?.role === 'admin' || isAdmin) return 'A';
    return 'U';
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-2xs transition-all pt-[env(safe-area-inset-top,0px)]">
      
      {/* Top Red & White National Standard Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-white to-indigo-600 w-full" />

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18 gap-1.5 sm:gap-4 overflow-visible">
          
          {/* Logo & Brand */}
          <div 
            onClick={() => confirmExitExam(onGoHome)}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0"
          >
            <div className="relative">
              {displayLogoUrl && !imgError ? (
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform duration-200 p-0.5">
                  <img
                    src={displayLogoUrl}
                    alt="Logo Sekolah"
                    className="w-full h-full object-contain rounded-lg sm:rounded-xl"
                    onError={() => setImgError(true)}
                  />
                </div>
              ) : (
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform duration-200">
                  <GraduationCap className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-amber-300" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-[7px] sm:text-[8px] text-white font-extrabold shadow-xs" title="Standar Nasional">
                ✓
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-black text-slate-900 text-sm sm:text-xl tracking-tight group-hover:text-indigo-600 transition-colors">
                  SIMPEL
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-extrabold bg-amber-50 text-amber-800 rounded-full border border-amber-200/80 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Kurikulum Merdeka
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 hidden md:block font-medium">
                Sistem Informasi Materi Pembelajaran
              </p>
            </div>
          </div>

          {/* Right Actions: Offline Badge, Progress Badge & Unified Profile Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            
            {/* Offline PWA Mode Badge */}
            {isOffline && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-black bg-amber-50 text-amber-900 border border-amber-300/80 rounded-lg sm:rounded-xl shadow-2xs animate-pulse"
                title="Mode Offline - Materi tersimpan dapat dibuka tanpa internet"
              >
                <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 shrink-0" />
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}

            {/* Student Progress Badge (Per Subject) */}
            {totalMaterialsCount > 0 && selectedSubjectName && (
              <div className="hidden md:flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-indigo-50/60 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl border border-emerald-200/80 shadow-2xs shrink-0">
                <div className="relative flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  {progressPercent === 100 && (
                    <Award className="w-3 h-3 text-amber-500 absolute -top-1 -right-1 animate-bounce" />
                  )}
                </div>
                <div className="flex items-center gap-1 font-extrabold text-slate-800 text-[11px] sm:text-xs">
                  <span className="hidden lg:inline font-semibold text-slate-600 truncate max-w-[100px]">{selectedSubjectName}:</span>
                  <span className="hidden xl:inline text-slate-500 font-medium">{completedCount}/{totalMaterialsCount}</span>
                  <span 
                    key={`nav-pct-${progressPercent}`} 
                    className="text-emerald-700 font-black bg-emerald-100/90 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] inline-block"
                  >
                    {progressPercent}%
                  </span>
                </div>
              </div>
            )}

            {/* Leaderboard Quick Access Button */}
            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl sm:rounded-2xl border border-amber-200/90 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all cursor-pointer shadow-2xs font-bold text-xs shrink-0 active:scale-95"
                title="Lihat Papan Peringkat & Lencana Prestasi Siswa"
              >
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
                <span className="hidden md:inline font-extrabold text-amber-950">Peringkat</span>
              </button>
            )}

            {/* Icebreaking Game Quick Access Button */}
            {onOpenIcebreakingGame && (
              <button
                type="button"
                onClick={() => {
                  unlockAudioContext();
                  onOpenIcebreakingGame();
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl sm:rounded-2xl border border-rose-200/90 bg-rose-50 hover:bg-rose-100 text-rose-900 transition-all cursor-pointer shadow-2xs font-bold text-xs shrink-0 active:scale-95"
                title="Masuk Game Icebreaking Kelas"
              >
                <Bomb className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 animate-pulse shrink-0" />
                <span className="font-extrabold text-rose-950 text-[11px] sm:text-xs">
                  <span className="sm:hidden">Game</span>
                  <span className="hidden sm:inline">Game Kelas</span>
                </span>
              </button>
            )}

            {/* Unified User Profile Button & Identity Modal */}
            {authSession ? (
              <div className="relative shrink-0">
                {/* Profile Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  className={`flex items-center gap-1.5 sm:gap-2.5 p-1 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isProfileOpen
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:border-slate-300'
                  }`}
                  aria-expanded={isProfileOpen}
                  aria-haspopup="true"
                  title="Lihat Profil & Identitas Akun"
                >
                  {/* Avatar Icon / Letter */}
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs sm:text-sm text-white shrink-0 shadow-xs ${
                    authSession.role === 'student'
                      ? 'bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-700'
                      : authSession.role === 'teacher'
                      ? 'bg-gradient-to-tr from-indigo-700 to-purple-800'
                      : 'bg-gradient-to-tr from-amber-500 to-orange-600'
                  }`}>
                    {getAvatarLetter()}
                  </div>

                  {/* Name and Label (Hidden on ultra small screens, visible on mobile+) */}
                  <div className="hidden min-[400px]:flex flex-col text-left min-w-0 max-w-[100px] sm:max-w-[150px] lg:max-w-[180px]">
                    <span className="text-xs font-black text-slate-800 truncate leading-tight">
                      {authSession.role === 'student'
                        ? authSession.student?.nama.split(' ')[0]
                        : authSession.role === 'teacher'
                        ? authSession.teacher?.name.split(' ')[0]
                        : 'Admin'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 truncate leading-tight">
                      {authSession.role === 'student'
                        ? `Kelas ${authSession.student?.kelas || '-'}`
                        : authSession.role === 'teacher'
                        ? 'Guru'
                        : 'Pengelola'}
                    </span>
                  </div>

                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isProfileOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                </button>

                {/* Topmost Layer Screen-Freezing User Profile Modal */}
                <UserProfileModal
                  isOpen={isProfileOpen}
                  onClose={() => setIsProfileOpen(false)}
                  authSession={authSession}
                  isAdmin={isAdmin}
                  completedCount={effectiveOverallCompleted}
                  totalMaterialsCount={effectiveOverallTotal}
                  selectedSubjectName={selectedSubjectName}
                  subjectCompletedCount={completedCount}
                  subjectTotalCount={totalMaterialsCount}
                  onLogout={onLogoutAdmin}
                  onOpenAdminDashboard={onOpenAdminDashboard}
                />
              </div>
            ) : (
              <button
                onClick={() => confirmExitExam(onOpenAdminLogin)}
                className="p-1.5 sm:p-2 min-h-[34px] sm:min-h-[38px] min-w-[34px] sm:min-w-[38px] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl sm:rounded-2xl transition-all duration-200 border border-transparent hover:border-indigo-100 cursor-pointer shrink-0"
                title="Login Pengelola / Guru / Admin"
                aria-label="Login Pengelola"
              >
                <Lock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};


