import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  LogOut,
  Sparkles,
  CheckCircle2,
  Award,
  LayoutDashboard,
  Smartphone,
  Download,
  Share,
  PlusSquare,
} from 'lucide-react';
import { AuthSession } from '../types';
import { confirmExitExam } from '../utils/examSession';
import { useMobileBackModal } from '../utils/mobileNavigation';
import { useBodyScrollLock } from '../utils/scrollLock';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { normalizeCompletedMaterialIds } from '../utils/prerequisites';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authSession: AuthSession | null;
  isAdmin?: boolean;
  completedCount: number;
  totalMaterialsCount: number;
  onLogout: () => void;
  onOpenAdminDashboard?: () => void;
  selectedSubjectName?: string;
  subjectCompletedCount?: number;
  subjectTotalCount?: number;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  authSession,
  isAdmin = false,
  completedCount,
  totalMaterialsCount,
  onLogout,
  onOpenAdminDashboard,
  selectedSubjectName,
  subjectCompletedCount,
  subjectTotalCount,
}) => {
  // Support Android hardware back button / swipe-to-close on mobile
  useMobileBackModal('user-profile-modal', isOpen, onClose);

  // Freeze screen scrolling completely when profile modal is open
  useBodyScrollLock(isOpen);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Fallback to local cache if props arrive as 0 due to context or timing
  const [localFallbackStats, setLocalFallbackStats] = useState<{ completed: number; total: number } | null>(null);

  useEffect(() => {
    if (!isOpen || authSession?.role !== 'student' || !authSession.student?.id) return;
    if (totalMaterialsCount > 0) return;

    try {
      const studentId = authSession.student.id;
      const progStr = localStorage.getItem(`sistem_materi_prog_${studentId}`);
      const matStr = localStorage.getItem('sistem_materi_mat_cache');

      const rawParsed = progStr ? JSON.parse(progStr) : [];
      const completedIds: string[] = normalizeCompletedMaterialIds(rawParsed);
      let totalMats = 0;
      if (matStr) {
        const mats = JSON.parse(matStr);
        if (Array.isArray(mats)) {
          totalMats = mats.filter((m: any) => m && m.isPublished).length;
        }
      }
      if (totalMats > 0 || completedIds.length > 0) {
        setLocalFallbackStats({
          completed: completedIds.length,
          total: totalMats > 0 ? totalMats : completedIds.length,
        });
      }
    } catch {
      // Ignore fallback parsing errors
    }
  }, [isOpen, authSession, totalMaterialsCount]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !authSession) return null;

  const effectiveCompletedCount = totalMaterialsCount > 0 ? completedCount : (localFallbackStats?.completed ?? completedCount);
  const effectiveTotalCount = totalMaterialsCount > 0 ? totalMaterialsCount : (localFallbackStats?.total ?? totalMaterialsCount);

  const progressPercent = effectiveTotalCount > 0 ? Math.round((effectiveCompletedCount / effectiveTotalCount) * 100) : 0;

  const getAvatarLetter = () => {
    if (authSession.role === 'student' && authSession.student?.nama) {
      return authSession.student.nama.charAt(0).toUpperCase();
    }
    if (authSession.role === 'teacher' && authSession.teacher?.name) {
      return authSession.teacher.name.charAt(0).toUpperCase();
    }
    return 'A';
  };

  const getFullName = () => {
    if (authSession.role === 'student' && authSession.student) {
      return authSession.student.nama;
    }
    if (authSession.role === 'teacher' && authSession.teacher) {
      return authSession.teacher.name;
    }
    return 'Administrator Pengelola';
  };

  const modalContent = (
    <div 
      id="user-profile-modal-overlay"
      className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 pointer-events-auto touch-none select-none overscroll-none"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="user-profile-title"
    >
      {/* Modal Card Container */}
      <div 
        id="user-profile-modal-card"
        data-modal-scrollable="true"
        className="relative w-full max-w-[380px] sm:max-w-[430px] bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-left my-auto max-h-[90vh] overflow-y-auto overscroll-contain pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 relative overflow-hidden">
          {/* Subtle Ambient Glows */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Avatar Letter */}
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg border-2 border-white/20 shrink-0 mt-0.5 ${
                authSession.role === 'student'
                  ? 'bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-700'
                  : authSession.role === 'teacher'
                  ? 'bg-gradient-to-tr from-indigo-700 to-purple-800'
                  : 'bg-gradient-to-tr from-amber-500 to-orange-600'
              }`}>
                {getAvatarLetter()}
              </div>

              {/* Identity Header Info */}
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-amber-300 bg-amber-400/20 border border-amber-300/30 px-2.5 py-0.5 rounded-full mb-1.5 backdrop-blur-xs">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>
                    {authSession.role === 'student'
                      ? 'Akun Siswa Terdaftar'
                      : authSession.role === 'teacher'
                      ? 'Akun Guru Pengampu'
                      : 'Akun Administrator'}
                  </span>
                </span>

                {/* Full Name Display */}
                <h3 
                  id="user-profile-title"
                  className="font-black text-base sm:text-lg text-white leading-snug break-words whitespace-normal"
                >
                  {getFullName()}
                </h3>
              </div>
            </div>

            {/* Close Button */}
            <button
              id="close-user-profile-btn"
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Tutup Profil"
              title="Tutup Profil (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Details */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[calc(85vh-120px)] overflow-y-auto">
          {authSession.role === 'student' && authSession.student ? (
            <>
              {/* Full Name Explicit Details Card */}
              <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Nama Lengkap Siswa
                </span>
                <span className="font-black text-slate-900 text-sm sm:text-base leading-snug break-words block">
                  {authSession.student.nama}
                </span>
              </div>

              {/* Class & Absen Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Kelas
                  </span>
                  <span className="font-black text-slate-800 text-sm sm:text-base">
                    {authSession.student.kelas}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    No. Absen
                  </span>
                  <span className="font-black text-slate-800 text-sm sm:text-base">
                    {authSession.student.noAbsen || '-'}
                  </span>
                </div>
              </div>

              {/* NIS Details */}
              {authSession.student.nisn && (
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      NIS Siswa
                    </span>
                    <span className="font-black text-slate-800 font-mono text-xs sm:text-sm">
                      {authSession.student.nisn}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Terverifikasi</span>
                  </span>
                </div>
              )}

              {/* Learning Progress Summary */}
              <div className="bg-indigo-50/80 p-3 sm:p-3.5 rounded-xl border border-indigo-100/90 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Progres Belajar Mandiri</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-indigo-700 font-black text-xs sm:text-sm">{progressPercent}%</span>
                    {progressPercent === 100 && (
                      <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md border border-emerald-200">
                        Tuntas
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full bg-white rounded-full h-2.5 overflow-hidden border border-indigo-200/80 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-500">
                  <span>{effectiveCompletedCount} dari {effectiveTotalCount} materi telah diselesaikan</span>
                  {effectiveTotalCount > 0 && (
                    <span className="text-indigo-600 font-bold">
                      {effectiveTotalCount - effectiveCompletedCount > 0
                        ? `${effectiveTotalCount - effectiveCompletedCount} tersisa`
                        : 'Lengkap'}
                    </span>
                  )}
                </div>

                {selectedSubjectName && subjectTotalCount !== undefined && subjectTotalCount > 0 && (
                  <div className="pt-2 mt-1 border-t border-indigo-100/90 flex items-center justify-between text-[10.5px] text-indigo-900 font-medium">
                    <span className="truncate max-w-[170px]">Mata Pelajaran: <strong className="font-bold">{selectedSubjectName}</strong></span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                      {subjectCompletedCount || 0}/{subjectTotalCount} ({Math.round(((subjectCompletedCount || 0) / subjectTotalCount) * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : authSession.role === 'teacher' && authSession.teacher ? (
            <div className="space-y-2.5">
              {/* Teacher Full Name Card */}
              <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Nama Lengkap Guru
                </span>
                <span className="font-black text-slate-900 text-sm sm:text-base leading-snug break-words block">
                  {authSession.teacher.name}
                </span>
              </div>

              {/* Username & NIP Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Username Login
                  </span>
                  <span className="font-black text-indigo-700 font-mono text-xs sm:text-sm block truncate">
                    @{authSession.teacher.username}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    NIP Guru
                  </span>
                  <span className="font-black text-slate-800 font-mono text-xs sm:text-sm block truncate">
                    {authSession.teacher.nip || '-'}
                  </span>
                </div>
              </div>

              {/* Subject & Classes Card */}
              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">
                    Mata Pelajaran & Kelas
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Terverifikasi</span>
                  </span>
                </div>
                <div className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                  {authSession.teacher.subjectId || 'Informatika'}
                </div>
                <div className="text-[11px] font-semibold text-indigo-700">
                  {Array.isArray(authSession.teacher.assignedClasses) && authSession.teacher.assignedClasses.length > 0
                    ? `Kelas: ${authSession.teacher.assignedClasses.join(', ')}`
                    : 'Mengampu: Semua Kelas'}
                </div>
              </div>

              {onOpenAdminDashboard && (
                <button
                  id="open-admin-dashboard-from-profile"
                  type="button"
                  onClick={() => {
                    onClose();
                    confirmExitExam(onOpenAdminDashboard);
                  }}
                  className="w-full py-2.5 sm:py-3 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Buka Dashboard Guru</span>
                </button>
              )}
            </div>
          ) : (authSession.role === 'admin' || isAdmin) ? (
            <div className="space-y-2.5">
              {onOpenAdminDashboard && (
                <button
                  id="open-admin-dashboard-from-profile"
                  type="button"
                  onClick={() => {
                    onClose();
                    confirmExitExam(onOpenAdminDashboard);
                  }}
                  className="w-full py-2.5 sm:py-3 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Buka Dashboard Pengelola</span>
                </button>
              )}
            </div>
          ) : null}

          {/* Install PWA Button for Students & Users if not already installed */}
          {!isInstalled && (
            <div className="pt-1">
              <button
                id="btn-install-app-profile"
                type="button"
                onClick={async () => {
                  if (isIOS || !isInstallable) {
                    setShowPwaGuide(true);
                  } else {
                    setIsInstalling(true);
                    try {
                      await install();
                    } finally {
                      setIsInstalling(false);
                    }
                  }
                }}
                disabled={isInstalling}
                className="w-full py-2.5 sm:py-3 px-3.5 bg-gradient-to-r from-indigo-50 via-sky-50 to-indigo-50 hover:from-indigo-100 hover:to-sky-100 text-indigo-900 font-bold text-xs sm:text-sm rounded-xl border border-indigo-200/90 flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="block font-black text-indigo-950 text-xs sm:text-sm leading-tight">
                      Pasang Aplikasi di Layar HP
                    </span>
                    <span className="block text-[10px] text-indigo-600 font-medium">
                      Akses cepat 1 ketukan & layar penuh
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-200/70 border border-indigo-300 px-2 py-0.5 rounded-md">
                  PWA
                </span>
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-slate-200 w-full my-1" />

          {/* Logout Button */}
          <button
            id="profile-logout-btn"
            type="button"
            onClick={() => {
              onClose();
              confirmExitExam(onLogout);
            }}
            className="w-full py-2.5 sm:py-3 px-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 hover:text-rose-800 font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-rose-200 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Keluar Akun ({authSession.role === 'student' ? 'Siswa' : authSession.role === 'teacher' ? 'Guru' : 'Admin'})</span>
          </button>
        </div>
      </div>

      {/* Interactive PWA Guide Modal */}
      {showPwaGuide && (
        <div
          id="profile-pwa-guide-overlay"
          className="fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowPwaGuide(false)}
        >
          <div
            id="profile-pwa-guide-card"
            className="relative w-full max-w-sm bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden text-left animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-300" />
                <h4 className="font-bold text-sm text-white">
                  {isIOS ? 'Cara Pasang di iPhone/iPad' : 'Cara Pasang di HP'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPwaGuide(false)}
                className="p-1 text-slate-300 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-700">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                    <span>Ketuk ikon <strong>Bagikan (Share)</strong> <Share className="w-3.5 h-3.5 inline text-indigo-600" /> di bilah bawah browser Safari.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                    <span>Pilih <strong>Tambah ke Layar Utama</strong> <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600" /> (<i>Add to Home Screen</i>).</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                    <span>Ketuk <strong>Tambah</strong> di sudut kanan atas. Selesai!</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                    <span>Ketuk menu titik tiga <strong>(⋮)</strong> di sudut kanan atas browser Chrome / HP.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                    <span>Pilih <strong>Tambahkan ke Layar Utama</strong> atau <strong>Instal Aplikasi</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                    <span>Konfirmasi pemasangan. Aplikasi SIMPEL siap dibuka dari layar depan HP!</span>
                  </div>
                </>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setShowPwaGuide(false)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};
