import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Clock, ShieldAlert, Play, XCircle, FileWarning } from 'lucide-react';
import {
  useExamSession,
  confirmExitAndStop,
  cancelExitModal,
  getPendingExitMaterialTitle,
} from '../utils/examSession';

const COUNTDOWN_SECONDS = 5;

export const ExamExitModal: React.FC = () => {
  const sessionState = useExamSession();
  const isOpen = sessionState.isExitModalOpen;
  const materialTitle = getPendingExitMaterialTitle() || sessionState.materialTitle || 'Kuis / Ujian Sumatif';

  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS);

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(COUNTDOWN_SECONDS);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isUnlocked = countdown === 0;
  const progressPercent = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100;

  return (
    <AnimatePresence>
      <div className="fixed inset-[0] z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-slate-900 border-2 border-red-500/50 rounded-2xl shadow-2xl shadow-red-950/80 overflow-hidden text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Danger Banner */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl text-white">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-wide uppercase">
                  Konfirmasi Hentikan Ujian
                </h3>
                <p className="text-xs text-red-100 font-medium">
                  Peringatan Keamanan Evaluasi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelExitModal}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Tutup Warning & Lanjutkan"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Countdown Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-red-500 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Active Exam Box */}
            <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="text-red-300 font-bold uppercase tracking-wider block text-[10px]">
                  Sesi Aktif Yang Sedang Berjalan:
                </span>
                <p className="text-white font-extrabold text-sm leading-snug">
                  {materialTitle}
                </p>
              </div>
            </div>

            {/* Strict Warning Points */}
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 text-xs text-slate-300 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Konsekuensi Jika Anda Keluar Sekarang:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 leading-relaxed pl-1">
                <li>
                  Seluruh <strong className="text-white">jawaban kuis yang telah diisi akan hilang</strong> dan tidak dapat dipulihkan.
                </li>
                <li>
                  Sesi pengerjaan akan <strong className="text-red-400">dianggap dibatalkan</strong> oleh sistem.
                </li>
                <li>
                  Nilai akhir <strong className="text-white">tidak akan tersimpan</strong> pada laporan belajar.
                </li>
              </ul>
            </div>

            {/* Countdown Visual Timer */}
            {!isUnlocked ? (
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>Masa Pikir & Refleksi Siswa:</span>
                </div>
                <div className="font-mono font-black text-sm bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-300">
                  {countdown} detik lagi
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-300">
                <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Tombol konfirmasi telah dibuka. Pastikan Anda benar-benar yakin sebelum keluar.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch gap-3">
              {/* Primary Recommended Button: Keep taking exam */}
              <button
                type="button"
                onClick={cancelExitModal}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30 group"
              >
                <Play className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />
                <span>BATALKAN & LANJUTKAN UJIAN</span>
              </button>

              {/* Secondary Locked Danger Button */}
              <button
                type="button"
                onClick={confirmExitAndStop}
                disabled={!isUnlocked}
                className={`py-3 px-4 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  isUnlocked
                    ? 'bg-red-700 hover:bg-red-600 text-white border-red-500 shadow-lg shadow-red-950/60'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-75'
                }`}
              >
                {isUnlocked ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Ya, Hentikan Ujian</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>Tunggu ({countdown}s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
