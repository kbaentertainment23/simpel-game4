import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  AlertTriangle,
  Maximize2,
  XCircle,
  Clock,
  History,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import {
  useExamSession,
  dismissViolationModal,
  dismissLockdownModal,
  stopExamSession,
} from '../utils/examSession';

export const AntiCheatModal: React.FC = () => {
  const session = useExamSession();

  // Determine active modal with strict priority to prevent modal stacking/overlap on mobile
  // Priority 1: Terminated Modal (3/3 violations)
  // Priority 2: Violation Warning Modal (1/3 or 2/3 violations)
  // Priority 3: Lockdown Fullscreen Modal
  let activeModal: 'terminated' | 'violation' | 'lockdown' | null = null;

  if (session.isTerminated) {
    activeModal = 'terminated';
  } else if (session.isActive && session.showViolationModal) {
    activeModal = 'violation';
  } else if (session.isActive && session.showLockdownModal) {
    activeModal = 'lockdown';
  }

  if (!activeModal) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        {/* 1. LOCKDOWN FULLSCREEN WARNING MODAL */}
        {activeModal === 'lockdown' && (
          <motion.div
            key="lockdown-modal"
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="relative w-full max-w-sm sm:max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl shadow-amber-950/80 overflow-hidden text-slate-100 my-auto p-4 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 shrink-0">
                <Maximize2 className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                  Mode Lockdown Aktif
                </span>
                <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                  Layar Penuh (Fullscreen) Diperlukan
                </h3>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
              <p className="leading-relaxed">
                Siswa wajib mengerjakan kuis/ujian dalam mode <strong className="text-white">Layar Penuh (Fullscreen)</strong>.
              </p>
              <p className="text-amber-300 text-[11px] font-medium leading-relaxed">
                ⚠️ Keluar dari mode layar penuh secara berulang dapat dianggap sebagai pelanggaran pengawasan.
              </p>
            </div>

            <button
              type="button"
              onClick={dismissLockdownModal}
              className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
              <span>KEMBALI KE MODE FULLSCREEN</span>
            </button>
          </motion.div>
        )}

        {/* 2. TAB SWITCHING VIOLATION WARNING MODAL (1/3 & 2/3) */}
        {activeModal === 'violation' && (
          <motion.div
            key="violation-modal"
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className={`relative w-full max-w-sm sm:max-w-lg bg-slate-900 border-2 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto ${
              session.violationsCount === 2
                ? 'border-red-500 shadow-red-950/90'
                : 'border-amber-500 shadow-amber-950/80'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`p-3.5 sm:p-5 flex items-center justify-between gap-2.5 text-white ${
                session.violationsCount === 2
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700'
                  : 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-sm rounded-xl text-white shrink-0">
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" />
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono font-black tracking-widest uppercase text-white/90 block">
                    {session.violationsCount === 2 ? '🚨 PERINGATAN KERAS' : '⚠️ PERINGATAN INTEGRITAS'}
                  </span>
                  <h3 className="text-xs sm:text-base font-black text-white leading-tight">
                    Terdeteksi Berpindah Tab ({session.violationsCount}/3)
                  </h3>
                </div>
              </div>

              <div className="bg-white/20 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-mono font-black text-white shrink-0 border border-white/30 whitespace-nowrap">
                Sisa: {session.maxViolations - session.violationsCount}x
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[80vh] overflow-y-auto">
              <div
                className={`p-3.5 sm:p-4 rounded-xl border text-xs space-y-1.5 sm:space-y-2 ${
                  session.violationsCount === 2
                    ? 'bg-red-950/50 border-red-800/80 text-red-200'
                    : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {session.violationsCount === 2
                      ? 'PERINGATAN TERAKHIR SEBELUM DIBATALKAN!'
                      : 'PERINGATAN PELANGGARAN PERTAMA!'}
                  </span>
                </div>
                <p className="leading-relaxed text-[11px] sm:text-xs">
                  {session.violationsCount === 1 ? (
                    <>
                      Sistem mencatat Anda baru saja meninggalkan jendela ujian / berpindah tab pada pukul{' '}
                      <strong className="text-white font-mono">{session.lastViolationTime}</strong>. Mohon tetap fokus berada di halaman ujian ini!
                    </>
                  ) : (
                    <>
                      <strong className="text-red-300">PERINGATAN KERAS!</strong> Anda terdeteksi meninggalkan halaman ujian sebanyak <strong className="text-white">2 kali</strong>. Sisa <strong className="text-amber-300">1 kali kesempatan lagi</strong>. Jika Anda berpindah tab sekali lagi, sesi kuis/ujian akan <strong className="text-red-400 font-extrabold uppercase">LANGSUNG DIBATALKAN OTOMATIS</strong>.
                    </>
                  )}
                </p>
              </div>

              {/* History Log */}
              {Array.isArray(session.violationHistory) && session.violationHistory.length > 0 && (
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80 text-xs space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>Catatan Waktu Pelanggaran:</span>
                  </span>
                  <ul className="space-y-1 font-mono text-[10px] sm:text-[11px] text-slate-300">
                    {(session.violationHistory || []).map((item, idx) => (
                      <li key={idx} className="flex items-center gap-1.5 text-rose-300">
                        <span className="text-slate-500">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={dismissViolationModal}
                className={`w-full py-3 sm:py-3.5 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border active:scale-95 ${
                  session.violationsCount === 2
                    ? 'bg-red-600 hover:bg-red-500 border-red-400/40 shadow-red-950/60'
                    : 'bg-amber-600 hover:bg-amber-500 border-amber-400/40 shadow-amber-950/60'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>SAYA MENGERTI & LANJUTKAN UJIAN</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. AUTOMATIC CANCEL / TERMINATED MODAL (3/3 VIOLATIONS) */}
        {activeModal === 'terminated' && (
          <motion.div
            key="terminated-modal"
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-sm sm:max-w-lg bg-slate-900 border-2 border-red-600 rounded-2xl shadow-2xl shadow-red-950/90 overflow-hidden text-slate-100 my-auto"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-700 via-rose-700 to-red-800 p-4 sm:p-5 flex items-center gap-3 text-white">
              <div className="p-2.5 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl text-white shrink-0">
                <XCircle className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse text-white" />
              </div>
              <div>
                <span className="text-[9px] sm:text-[10px] font-mono font-black text-red-200 uppercase tracking-widest block">
                  Peringatan Keamanan System
                </span>
                <h3 className="text-sm sm:text-lg font-black text-white leading-tight">
                  UJIAN TELAH DIHENTIKAN
                </h3>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-red-950/70 border border-red-800/90 rounded-xl p-3.5 sm:p-4 text-xs text-red-100 space-y-2">
                <div className="flex items-center gap-2 text-red-300 font-extrabold text-xs sm:text-base">
                  <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-red-400" />
                  <span>Batas Maksimal Pelanggaran Terlampaui (3/3)</span>
                </div>
                <p className="leading-relaxed text-slate-200 text-[11px] sm:text-sm">
                  Ujian mode kiosk untuk materi <strong className="text-white font-bold">"{session.materialTitle || 'Ujian'}"</strong> telah <strong className="text-red-400 font-extrabold underline">DIHENTIKAN OLEH SISTEM</strong> karena terjadi pelanggaran berpindah tab / meninggalkan jendela ujian sebanyak <strong className="text-white font-black">3 kali</strong> (batas maksimal).
                </p>
              </div>

              {/* Log History */}
              {Array.isArray(session.violationHistory) && session.violationHistory.length > 0 && (
                <div className="bg-slate-800/90 rounded-xl p-3 sm:p-3.5 border border-slate-700 text-xs space-y-2">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                    <span>Bukti Audit Catatan Pelanggaran:</span>
                  </span>
                  <div className="space-y-1.5 font-mono text-[10px] sm:text-[11px]">
                    {(session.violationHistory || []).map((log, i) => (
                      <div key={i} className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-rose-300">
                        <span className="font-semibold text-rose-400">Pelanggaran #{i + 1}</span>
                        <span className="font-bold text-slate-200">{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 sm:p-3 rounded-xl text-amber-200 text-[11px] sm:text-xs text-center leading-relaxed font-medium">
                Persetujuan dari Guru / Pengawas diperlukan jika ingin meminta izin pengerjaan ulang.
              </div>

              <button
                type="button"
                onClick={stopExamSession}
                className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs sm:text-sm rounded-xl border border-red-400/40 shadow-lg shadow-red-950/80 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <LogOut className="w-4 h-4 text-white shrink-0" />
                <span>KELUAR KE HALAMAN SEBELUMNYA</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
