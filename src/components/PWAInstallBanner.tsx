import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  X,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Zap,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { parseLogoUrl } from '../utils/urlParser';

interface PWAInstallBannerProps {
  siteLogoUrl?: string;
  isStudent?: boolean;
  examActive?: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  siteLogoUrl,
  isStudent = true,
  examActive = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isDismissed, install, dismiss } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Suppress banner if already running in standalone mode, during active exam, or dismissed
  if (isInstalled || examActive || isDismissed) {
    return null;
  }

  const logoSrc = siteLogoUrl ? parseLogoUrl(siteLogoUrl) : '/pwa-icon-192.png';

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowGuideModal(true);
      return;
    }

    if (isInstallable) {
      setIsInstalling(true);
      try {
        const result = await install();
        if (result === 'dismissed') {
          // User chose not to install from native prompt
        }
      } finally {
        setIsInstalling(false);
      }
    } else {
      // Fallback: If beforeinstallprompt hasn't fired or is unsupported, show guide
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.section
          id="pwa-install-banner"
          aria-label="Pemasangan Aplikasi Layar Utama"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 pb-1"
        >
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-xl shadow-indigo-950/20 border border-indigo-700/40 p-3.5 sm:p-5">
            {/* Ambient decorative lighting */}
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Left Side: App Icon & Info */}
              <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                {/* App Icon (Simulating Home Screen App Icon) */}
                <div className="relative shrink-0">
                  <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-white p-1.5 shadow-lg shadow-black/20 border border-white/30 flex items-center justify-center overflow-hidden transition-transform duration-200 hover:scale-105">
                    <img
                      src={logoSrc}
                      alt="SIMPEL App Icon"
                      className="w-full h-full object-contain rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/pwa-icon-192.png';
                      }}
                    />
                  </div>
                  {/* Mini smartphone badge indicator */}
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-indigo-950 shadow-xs flex items-center justify-center">
                    <Smartphone className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </div>
                </div>

                {/* Content description */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                    <span className="font-black text-white text-base sm:text-lg tracking-tight">
                      Pasang Aplikasi SIMPEL
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                      Layar Utama HP
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 sm:line-clamp-none font-normal leading-relaxed">
                    Akses materi & modul belajar langsung dari layar HP tanpa browser. Lebih hemat kuota, cepat, dan layar penuh layaknya aplikasi resmi!
                  </p>

                  {/* Feature chips */}
                  <div className="hidden sm:flex flex-wrap items-center gap-2 mt-2.5 text-[11px] text-indigo-200 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                      <Zap className="w-3 h-3 text-amber-300" /> Akses Cepat 1 Ketukan
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                      <Smartphone className="w-3 h-3 text-emerald-300" /> Tampilan Layar Penuh
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                      <Layers className="w-3 h-3 text-sky-300" /> Ringan & Hemat Memori
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Action Buttons & Dismiss */}
              <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-white/10 justify-between md:justify-end">
                <button
                  type="button"
                  id="btn-pwa-dismiss"
                  onClick={dismiss}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  title="Tutup pemberitahuan ini"
                >
                  Nanti Saja
                </button>

                <button
                  type="button"
                  id="btn-pwa-install-action"
                  onClick={handleInstallClick}
                  disabled={isInstalling}
                  className="flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 border border-indigo-400/40 active:scale-95 transition-all cursor-pointer"
                >
                  {isIOS ? (
                    <>
                      <Share className="w-4 h-4 text-white" />
                      <span>Pasang di iPhone</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>{isInstalling ? 'Memasang...' : 'Pasang Aplikasi'}</span>
                    </>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>
              </div>

            </div>
          </div>
        </motion.section>
      </AnimatePresence>

      {/* Interactive Guide Modal for iOS & Browsers without automated prompt */}
      <AnimatePresence>
        {showGuideModal && (
          <div
            id="pwa-guide-modal-overlay"
            className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
            onClick={() => setShowGuideModal(false)}
          >
            <div
              id="pwa-guide-modal-card"
              className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden text-left animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white p-1 shadow-md border border-white/20 flex items-center justify-center shrink-0">
                      <img
                        src={logoSrc}
                        alt="SIMPEL"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/pwa-icon-192.png';
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-white">
                        {isIOS ? 'Cara Pasang di iPhone / iPad' : 'Cara Pasang ke Layar Utama'}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-indigo-200">
                        Hanya butuh 5 detik tanpa perlu download dari App Store / Play Store
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(false)}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body - Step-by-step instructions */}
              <div className="p-4 sm:p-6 space-y-4">
                {isIOS ? (
                  <>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        1
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        Ketuk tombol <strong className="text-indigo-900 font-bold inline-flex items-center gap-1 mx-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200"><Share className="w-3.5 h-3.5 text-indigo-600" /> Bagikan (Share)</strong> pada bilah bawah browser Safari.
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        2
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        Gulir menu ke bawah lalu pilih <strong className="text-indigo-900 font-bold inline-flex items-center gap-1 mx-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200"><PlusSquare className="w-3.5 h-3.5 text-indigo-600" /> Tambah ke Layar Utama</strong> (<i>Add to Home Screen</i>).
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        3
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        Ketuk tombol <strong className="text-indigo-900 font-bold">Tambah (Add)</strong> di sudut kanan atas layar. Selesai! Ikon SIMPEL akan langsung muncul di layar depan iPhone Anda.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        1
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        Ketuk ikon menu titik tiga <strong className="text-indigo-900 font-bold">(⋮)</strong> di sudut kanan atas browser Chrome / browser HP Anda.
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        2
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        Pilih menu <strong className="text-indigo-900 font-bold inline-flex items-center gap-1 mx-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200"><Smartphone className="w-3.5 h-3.5 text-indigo-600" /> Tambahkan ke Layar Utama</strong> atau <strong>Instal Aplikasi</strong>.
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        3
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        Konfirmasi dengan mengetuk <strong className="text-indigo-900 font-bold">Instal / Tambah</strong>. Aplikasi SIMPEL siap dibuka kapan saja dari beranda HP!
                      </div>
                    </div>
                  </>
                )}

                {/* Benefits footnote */}
                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Aplikasi ini resmi, sangat ringan (&lt; 2 MB), dan tidak membebani memori HP siswa.</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Saya Mengerti, Tutup
                </button>
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
