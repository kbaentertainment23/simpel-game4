import React from 'react';
import {
  BookMarked,
  Award,
  User,
  Bookmark,
  Trophy,
} from 'lucide-react';
import { AuthSession } from '../types';

export type StudentNavTab = 'materials' | 'bookmarks' | 'leaderboard' | 'results' | 'profile';

interface MobileBottomNavProps {
  activeTab: StudentNavTab;
  onTabChange: (tab: StudentNavTab) => void;
  completedCount: number;
  totalMaterialsCount: number;
  bookmarkedCount?: number;
  authSession: AuthSession | null;
  examActive?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  completedCount,
  totalMaterialsCount,
  bookmarkedCount = 0,
  authSession,
  examActive = false,
}) => {
  // If an active sumatif exam session is in progress, hide bottom navigation to maintain security lockdown
  if (examActive) return null;

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Navigasi Utama Siswa"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0.5rem)] pt-1 select-none transition-all duration-200"
    >
      <div className="max-w-md mx-auto px-2 flex items-center justify-around">
        {/* Tab 1: Materi & Modul Belajar */}
        <button
          type="button"
          id="btn-bottom-nav-materials"
          onClick={() => onTabChange('materials')}
          className={`flex-1 min-h-[48px] py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
            activeTab === 'materials'
              ? 'text-indigo-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-colors ${activeTab === 'materials' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}>
            <BookMarked className="w-4 h-4 stroke-[2.2]" />
            {totalMaterialsCount > 0 && (
              <span className={`absolute -top-1 -right-1.5 px-1 py-0.2 rounded-full text-[8px] font-black leading-tight border ${
                activeTab === 'materials'
                  ? 'bg-indigo-600 text-white border-white'
                  : 'bg-slate-200 text-slate-700 border-white'
              }`}>
                {completedCount}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-tight tracking-tight">Materi</span>
        </button>

        {/* Tab 2: Tersimpan / Bookmarks */}
        <button
          type="button"
          id="btn-bottom-nav-bookmarks"
          onClick={() => onTabChange('bookmarks')}
          className={`flex-1 min-h-[48px] py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
            activeTab === 'bookmarks'
              ? 'text-amber-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-colors ${activeTab === 'bookmarks' ? 'bg-amber-50 text-amber-600' : 'text-slate-500'}`}>
            <Bookmark className="w-4 h-4 stroke-[2.2]" />
            {bookmarkedCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full text-[8px] font-black bg-amber-500 text-white border border-white">
                {bookmarkedCount}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-tight tracking-tight">Tersimpan</span>
        </button>

        {/* Tab 3: Papan Peringkat / Leaderboard */}
        <button
          type="button"
          id="btn-bottom-nav-leaderboard"
          onClick={() => onTabChange('leaderboard')}
          className={`flex-1 min-h-[48px] py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
            activeTab === 'leaderboard'
              ? 'text-violet-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-colors ${activeTab === 'leaderboard' ? 'bg-violet-50 text-violet-600' : 'text-slate-500'}`}>
            <Trophy className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="text-[10px] leading-tight tracking-tight">Peringkat</span>
        </button>

        {/* Tab 4: Hasil / Riwayat Belajar */}
        <button
          type="button"
          id="btn-bottom-nav-results"
          onClick={() => onTabChange('results')}
          className={`flex-1 min-h-[48px] py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
            activeTab === 'results'
              ? 'text-indigo-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-colors ${activeTab === 'results' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}>
            <Award className="w-4 h-4 stroke-[2.2]" />
            {completedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </div>
          <span className="text-[10px] leading-tight tracking-tight">Riwayat</span>
        </button>

        {/* Tab 5: Profil Akun */}
        <button
          type="button"
          id="btn-bottom-nav-profile"
          onClick={() => onTabChange('profile')}
          className={`flex-1 min-h-[48px] py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
            activeTab === 'profile'
              ? 'text-indigo-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-colors ${activeTab === 'profile' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white ${
              authSession?.role === 'student'
                ? 'bg-gradient-to-tr from-indigo-600 to-violet-600'
                : 'bg-slate-700'
            }`}>
              {authSession?.student?.nama ? authSession.student.nama.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
            </div>
          </div>
          <span className="text-[10px] leading-tight tracking-tight">Akun</span>
        </button>
      </div>
    </nav>
  );
};
