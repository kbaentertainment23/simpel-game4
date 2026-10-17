import React from 'react';
import {
  GraduationCap,
  RefreshCw,
  Eye,
  LogOut,
  HelpCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { AuthSession, Subject, TeacherAccount } from '../../types';

interface AdminHeaderProps {
  siteLogoUrl?: string;
  authSession?: AuthSession | null;
  assignedSubject?: Subject | null;
  currentTeacher?: TeacherAccount | null;
  isTeacherRole?: boolean;
  totalMaterialsCount?: number;
  totalCategoriesCount?: number;
  totalStudentsCount?: number;
  isRefreshing?: boolean;
  isSyncing?: boolean;
  onRefresh?: () => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onOpenGuide: () => void;
  onSwitchToStudentView?: () => void;
  onLogout?: () => void;
  onClose?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  siteLogoUrl,
  authSession,
  assignedSubject,
  currentTeacher,
  isTeacherRole = false,
  totalMaterialsCount = 0,
  totalCategoriesCount = 0,
  totalStudentsCount = 0,
  isRefreshing = false,
  isSyncing = false,
  onRefresh,
  onRefreshData,
  onOpenGuide,
  onSwitchToStudentView,
  onLogout,
  onClose,
}) => {
  const teacherData = currentTeacher || authSession?.teacher;
  const refreshing = isRefreshing || isSyncing;
  const handleRefresh = onRefreshData || onRefresh || (async () => {});

  const teacherClasses = teacherData?.assignedClasses && teacherData.assignedClasses.length > 0
    ? teacherData.assignedClasses.join(', ')
    : null;

  return (
    <header className="w-full bg-white transition-all pt-[env(safe-area-inset-top,0px)]">
      {/* Top Red & White Indonesian National Accent Stripe */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-white to-indigo-600 w-full" />

      <div className="max-w-[1480px] mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          
          {/* Brand & Role Status */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {siteLogoUrl ? (
              <img
                src={siteLogoUrl}
                alt="Logo Sekolah"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-contain bg-slate-50 p-1 border border-slate-200/80 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-heading font-black text-slate-900 text-base sm:text-lg tracking-tight leading-none">
                  SIMPEL
                </span>

                {isTeacherRole ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Portal Guru: {teacherData?.name || 'Pengampu'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Pusat Kontrol Super Admin</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Realtime Sync</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1 truncate">
                {isTeacherRole ? (
                  <>
                    <span className="text-slate-700 font-semibold truncate">
                      Mapel: {assignedSubject?.name || teacherData?.subjectId || 'Mata Pelajaran'}
                    </span>
                    {teacherClasses && (
                      <span className="text-slate-500 hidden sm:inline truncate">
                        • Kelas Binaan: {teacherClasses}
                      </span>
                    )}
                  </>
                ) : (
                  <span>Sistem Informasi Materi Pembelajaran Elektronik — Panel Pengelola Kurikulum</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end shrink-0">
            
            {/* Guide Button */}
            <button
              type="button"
              onClick={onOpenGuide}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200/70 shadow-2xs cursor-pointer active:scale-95"
              title="Panduan Format Tautan Drive, Youtube, Canva, & Quiz"
            >
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Panduan Link</span>
            </button>

            {/* Refresh / Sync Button */}
            <button
              type="button"
              onClick={() => handleRefresh()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200/70 shadow-2xs cursor-pointer disabled:opacity-50 active:scale-95"
              title="Sinkronisasi data terbaru dari database Firestore"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Menyinkronkan...' : 'Sinkron Data'}</span>
            </button>

            {/* Switch to Student View */}
            {onSwitchToStudentView && (
              <button
                type="button"
                onClick={onSwitchToStudentView}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-50 to-sky-50 hover:from-indigo-100 hover:to-sky-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                title="Buka tampilan portal belajar siswa untuk pratinjau langsung"
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>Pratinjau Siswa</span>
              </button>
            )}

            {/* Logout Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-extrabold rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Keluar dari akun pengajar/admin"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
