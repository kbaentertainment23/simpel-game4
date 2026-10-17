import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  HardDrive,
  CloudOff,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export interface OfflineNotificationBannerProps {
  className?: string;
  isExamActive?: boolean;
}

export const OfflineNotificationBanner: React.FC<OfflineNotificationBannerProps> = ({
  className = '',
  isExamActive = false,
}) => {
  const { isOnline, wasOffline, isChecking, checkConnection } = useNetworkStatus();
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showDetail, setShowDetail] = useState<boolean>(false);

  // If user is online and wasn't offline recently, show nothing
  if (isOnline && !wasOffline) {
    return null;
  }

  return (
    <aside aria-label="Status Koneksi Jaringan" className={`relative z-50 ${className}`}>
      <AnimatePresence mode="wait">
        {/* State 1: Reconnected Online Transition Banner */}
        {isOnline && wasOffline && (
          <motion.div
            key="online-reconnected-banner"
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg border-b border-emerald-500/50"
          >
            <div className="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <Wifi className="w-4 h-4 text-emerald-100 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black tracking-wide text-white">
                        Koneksi Kembali Online!
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/40 text-[10px] font-bold border border-emerald-400/40 text-emerald-100">
                        <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                        Terhubung
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-emerald-100 leading-tight truncate">
                      Sinkronisasi data progres belajar &amp; nilai kuis ke Firestore sedang dilanjutkan secara otomatis.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-100 bg-white/10 px-2.5 py-1 rounded-lg">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-200" />
                    <span className="hidden sm:inline">Menyinkronkan data...</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* State 2: Offline Mode Banner */}
        {!isOnline && (
          <motion.div
            key="offline-mode-banner"
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-md border-b border-amber-600/40"
          >
            {/* If Minimized Pill View */}
            {isMinimized ? (
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsMinimized(false)}
                  className="flex items-center gap-2 text-white hover:text-amber-100 font-bold transition-colors cursor-pointer group"
                >
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="underline decoration-amber-200/60 underline-offset-2">
                    Mode Offline Aktif — Sinkronisasi Firestore Dijeda (Klik untuk detail)
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => checkConnection()}
                    disabled={isChecking}
                    className="p-1 hover:bg-black/10 rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50"
                    title="Cek koneksi internet"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="px-2 py-0.5 rounded-lg bg-black/20 hover:bg-black/30 font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Buka
                  </button>
                </div>
              </div>
            ) : (
              /* Expanded Full Banner View */
              <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Icon & Description */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-black/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20 mt-0.5 sm:mt-0">
                      <WifiOff className="w-5 h-5 text-amber-100" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black tracking-wide text-white flex items-center gap-1.5">
                          <span>Mode Offline Aktif</span>
                        </h4>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/20 text-[10px] font-black text-amber-100 border border-white/10 uppercase tracking-wider">
                          <CloudOff className="w-3 h-3 text-amber-200" />
                          Sinkronisasi Dijeda
                        </span>
                      </div>

                      <p className="text-[11px] sm:text-xs text-amber-50 font-medium leading-relaxed max-w-2xl">
                        Koneksi internet terputus. Anda tetap dapat membaca materi dan mengerjakan aktivitas.
                        Progres belajar disimpan aman di perangkat dan akan otomatis disinkronkan ke Firestore saat kembali online.
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDetail(!showDetail)}
                      className="px-2.5 py-1.5 rounded-xl bg-black/15 hover:bg-black/25 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Lihat status penyimpanan lokal"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-amber-200" />
                      <span className="hidden sm:inline">Penyimpanan Lokal</span>
                      {showDetail ? (
                        <ChevronUp className="w-3.5 h-3.5 text-amber-200" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-amber-200" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => checkConnection()}
                      disabled={isChecking}
                      className="px-3 py-1.5 rounded-xl bg-white text-amber-950 hover:bg-amber-50 active:scale-95 text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isChecking ? 'animate-spin' : ''}`} />
                      <span>{isChecking ? 'Mengecek...' : 'Cek Koneksi'}</span>
                    </button>

                    {!isExamActive && (
                      <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        className="p-1.5 rounded-xl hover:bg-black/20 text-white/90 hover:text-white transition-colors cursor-pointer"
                        title="Perkecil notifikasi"
                        aria-label="Perkecil notifikasi"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Local Storage Safety Detail */}
                <AnimatePresence>
                  {showDetail && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-white/20 text-[11px] text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 overflow-hidden"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                        <span>
                          <strong>IndexedDB Persistent Cache Aktif:</strong> Perubahan jawaban, catatan, dan progres tetap tersimpan di browser Anda tanpa hilang.
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-200/90 italic">
                        *Jangan bersihkan cache browser saat masih offline.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
