import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Maximize2,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Presentation,
  Layers,
  Focus,
  X,
  Video,
  Play,
  FileText,
  ClipboardList,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Lock,
  ArrowRight,
  Loader2,
  Smartphone,
  Monitor,
  Bookmark,
  ExternalLink,
} from 'lucide-react';
import { checkGFormAccess, formatAccessDateTime, formatRemainingTime } from '../utils/gformAccessControl';
import { Material, Category } from '../types';
import { MiniQuizSection } from './MiniQuizSection';
import { playCompletionSound, playPopSound } from '../utils/audioSynth';
import { startExamSession, stopExamSession, useExamSession, requestLockdownFullscreen } from '../utils/examSession';

interface MaterialViewerProps {
  material: Material;
  category?: Category;
  subjectName?: string;
  isCompleted: boolean;
  onToggleCompleted: (materialId: string, options?: { localOnly?: boolean }) => void;
  userNote?: string;
  onSaveNote?: (materialId: string, noteText: string) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (materialId: string) => void;
  nextMaterial?: Material | null;
  onNextMaterial?: () => void;
  onIframeError?: () => void;
}

export const MaterialViewer: React.FC<MaterialViewerProps> = ({
  material,
  category,
  subjectName,
  isCompleted,
  onToggleCompleted,
  userNote,
  onSaveNote,
  isBookmarked = false,
  onToggleBookmark,
  nextMaterial,
  onNextMaterial,
  onIframeError,
}) => {
  const examSession = useExamSession();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [showReflection, setShowReflection] = useState(true);
  const [aspectRatioMode, setAspectRatioMode] = useState<'auto' | '16:9' | '9:16'>('auto');
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  // Reset iframe loading state when active material changes
  useEffect(() => {
    setIsIframeLoading(true);
  }, [material.id, material.embedUrl]);

  // Sumatif Google Form Anti-Cheat Exam State
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [examTimeSeconds, setExamTimeSeconds] = useState(0);
  const [showFinishConfirmModal, setShowFinishConfirmModal] = useState(false);

  // Periodic ticker to recalculate access control in real-time every second
  const [, setAccessTicker] = useState(0);
  useEffect(() => {
    if (material.type !== 'gform' || !material.isAccessTimeRestricted) return;
    const interval = setInterval(() => {
      setAccessTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [material.type, material.isAccessTimeRestricted]);

  // Google Form Access Control Check
  const accessCheck = checkGFormAccess(material);

  // Auto-close exam session and kiosk mode if access expires while running
  useEffect(() => {
    if (material.type === 'gform' && !accessCheck.isAccessible) {
      if (isExamStarted || isKioskMode) {
        setIsExamStarted(false);
        setIsKioskMode(false);
        exitFullscreenMode();
      }
    }
  }, [material.type, accessCheck.isAccessible, isExamStarted, isKioskMode]);

  // Exam timer listener
  useEffect(() => {
    let interval: any;
    if (material.type === 'gform' && isExamStarted && !examSession.isTerminated) {
      interval = setInterval(() => {
        setExamTimeSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setExamTimeSeconds(0);
    }
    return () => clearInterval(interval);
  }, [material.type, isExamStarted, examSession.isTerminated]);

  // Sync active exam status with global examSession state manager
  useEffect(() => {
    if (material.type === 'gform' && (isExamStarted || isKioskMode)) {
      startExamSession(material.id, material.title, { enableLockdown: true });
    } else {
      stopExamSession();
    }
    return () => {
      stopExamSession();
    };
  }, [material.type, isExamStarted, isKioskMode, material.id, material.title]);

  // Reset local exam view if session is terminated due to max violations
  useEffect(() => {
    if (examSession.isTerminated) {
      setIsExamStarted(false);
      setIsKioskMode(false);
      exitFullscreenMode();
    }
  }, [examSession.isTerminated]);

  const requestFullscreenMode = () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request rejected or unsupported:', err);
    }
  };

  const exitFullscreenMode = () => {
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  };

  // Automatically request fullscreen when Kiosk Mode is activated
  useEffect(() => {
    if (isKioskMode) {
      requestFullscreenMode();
    }
  }, [isKioskMode]);

  // Freeze background page scrolling during Kiosk Mode, active exam, or Focus Mode
  useEffect(() => {
    if (isKioskMode || isFocusMode || (material.type === 'gform' && isExamStarted)) {
      const originalOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isKioskMode, isFocusMode, isExamStarted, material.type]);

  // Handle Escape key to close focus mode
  useEffect(() => {
    if (!isFocusMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  // Prevent accidental tab close or page reload during active exam
  useEffect(() => {
    if (material.type !== 'gform' || (!isExamStarted && !isKioskMode)) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Ujian sedang berlangsung! Yakin ingin keluar?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [material.type, isExamStarted, isKioskMode]);

  const isGoogleForm =
    material.type === 'gform' ||
    material.originalUrl?.includes('docs.google.com/forms') ||
    material.originalUrl?.includes('forms.gle') ||
    material.embedUrl?.includes('docs.google.com/forms') ||
    material.embedUrl?.includes('forms.gle');

  const formatTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinishExam = () => {
    playCompletionSound();
    if (!isCompleted) {
      onToggleCompleted(material.id);
    }
    setIsExamStarted(false);
    setIsKioskMode(false);
    exitFullscreenMode();
    stopExamSession();
    setShowFinishConfirmModal(false);
  };

  const handleOpenFocusMode = () => {
    playPopSound();
    setIsFocusMode(true);
  };

  const handleToggleFullscreen = () => {
    const iframeContainer = document.getElementById(`material-frame-container-${material.id}`);
    if (iframeContainer) {
      if (!document.fullscreenElement) {
        iframeContainer.requestFullscreen().catch((err) => console.warn(err));
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch((err) => console.warn(err));
        setIsFullscreen(false);
      }
    }
  };

  const isPresentationOrCanva = useMemo(() => {
    const url = (material.embedUrl || material.originalUrl || '').toLowerCase();
    return (
      material.type === 'canva' ||
      material.type === 'gdrive' ||
      material.type === 'youtube' ||
      material.type === 'video' ||
      url.includes('canva.com') ||
      url.includes('presentation') ||
      url.includes('slides') ||
      url.includes('drive.google.com') ||
      url.includes('youtube.com') ||
      url.includes('youtu.be')
    );
  }, [material.embedUrl, material.originalUrl, material.type]);

  const containerAspectClass = useMemo(() => {
    if (aspectRatioMode === '16:9') {
      return 'aspect-video sm:aspect-video w-full h-auto min-h-[220px] xs:min-h-[260px] sm:min-h-[380px] md:min-h-[500px] overflow-hidden';
    }
    if (aspectRatioMode === '9:16') {
      return 'aspect-[9/16] w-full max-w-[340px] xs:max-w-sm sm:max-w-md mx-auto h-auto min-h-[460px] sm:min-h-[560px] overflow-hidden shadow-xl';
    }
    // Auto dynamic sizing
    if (isPresentationOrCanva) {
      return 'aspect-[16/9] sm:aspect-video w-full h-auto min-h-[220px] xs:min-h-[260px] sm:min-h-[380px] md:min-h-[520px] overflow-hidden';
    }
    return 'h-[52vh] sm:h-[62vh] md:h-[68vh] min-h-[340px] sm:min-h-[480px] md:min-h-[620px] overflow-hidden';
  }, [aspectRatioMode, isPresentationOrCanva]);

  return (
    <div className="w-full max-w-full space-y-3 sm:space-y-5 lg:space-y-6 animate-in fade-in duration-300">
      
      {/* Material Top Header & Controls */}
      <div 
        id="material-header-card"
        className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 sm:gap-4 lg:gap-6 w-full max-w-full"
      >
        
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border shadow-2xs ${
                material.type === 'gform'
                  ? 'bg-purple-50 text-purple-900 border-purple-300 font-extrabold'
                  : material.type === 'youtube'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : material.type === 'video'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : material.type === 'canva'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : material.type === 'pdf'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {material.type === 'gform' ? (
                <>
                  <ClipboardList className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>Tes / Sumatif Google Form</span>
                </>
              ) : material.type === 'youtube' ? (
                <>
                  <Play className="w-4 h-4 fill-rose-600 text-rose-600 shrink-0" />
                  <span>Video YouTube</span>
                </>
              ) : material.type === 'video' ? (
                <>
                  <Video className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Video Drive / File</span>
                </>
              ) : material.type === 'canva' ? (
                <>
                  <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Canva Presentation</span>
                </>
              ) : material.type === 'pdf' ? (
                <>
                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Dokumen PDF</span>
                </>
              ) : (
                <>
                  <Presentation className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Google Slide / Doc</span>
                </>
              )}
            </span>

            {isCompleted && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Selesai Dikerjakan</span>
              </span>
            )}
          </div>

          <div className="bg-gradient-to-r from-indigo-50/90 via-slate-50/60 to-white/40 p-3.5 sm:p-4 rounded-2xl border border-indigo-100/90 border-l-4 border-l-indigo-600 shadow-2xs">
            <h2 className="font-heading font-black text-slate-950 text-xl sm:text-2xl lg:text-3xl tracking-tight leading-snug sm:leading-tight">
              {material.title}
            </h2>
          </div>
        </div>

        {/* Control Buttons & Automatic Status Indicator */}
        <div 
          id="material-header-controls-container" 
          className="w-full sm:w-56 md:w-60 lg:w-64 shrink-0 flex flex-col gap-2"
        >
          {/* Primary Action & Status Indicator (2-column on mobile, stacked on tablet/desktop) */}
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-col sm:gap-2">
            {!isGoogleForm ? (
              <button
                id="btn-material-focus-mode"
                type="button"
                onClick={handleOpenFocusMode}
                className="w-full min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-black rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center ring-2 ring-indigo-500/20 active:scale-98"
                title="Sembunyikan navigasi & gangguan untuk fokus membaca"
              >
                <Focus className="w-4 h-4 text-indigo-200 shrink-0" />
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide whitespace-nowrap">Mode Fokus</span>
              </button>
            ) : (
              <button
                id="btn-material-kiosk-mode"
                type="button"
                disabled={!accessCheck.isAccessible}
                onClick={() => {
                  if (!accessCheck.isAccessible) return;
                  playPopSound();
                  setIsKioskMode(true);
                  if (!isExamStarted) {
                    setIsExamStarted(true);
                  }
                  startExamSession(material.id, material.title, { enableLockdown: true });
                  requestLockdownFullscreen();
                }}
                className={`w-full min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-black rounded-xl flex items-center justify-center gap-1.5 transition-all text-center select-none ${
                  !accessCheck.isAccessible
                    ? 'bg-slate-800 text-slate-400 border border-slate-700 shadow-none cursor-not-allowed opacity-80 ring-0'
                    : 'bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white shadow-md cursor-pointer ring-2 ring-purple-600/30 active:scale-98'
                }`}
                title={
                  !accessCheck.isAccessible
                    ? `${accessCheck.statusLabel}: ${accessCheck.statusDescription}`
                    : 'Aktifkan Mode Kiosk Ujian layar penuh tanpa toolbar & navigasi keluar'
                }
              >
                {!accessCheck.isAccessible ? (
                  <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                )}
                <span className="font-extrabold text-xs sm:text-sm tracking-wide whitespace-nowrap">
                  <span className="sm:hidden">
                    {!accessCheck.isAccessible ? 'Terkunci' : 'Mode Kiosk'}
                  </span>
                  <span className="hidden sm:inline">
                    {!accessCheck.isAccessible ? 'Kiosk Terkunci' : 'Mode Kiosk Ujian'}
                  </span>
                </span>
              </button>
            )}

            {/* Automatic Progress Status Indicator (Non-clickable Badge) */}
            {isCompleted ? (
              <div 
                id="material-status-indicator"
                className="w-full min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs select-none"
                title="Materi ini telah tuntas diselesaikan"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="whitespace-nowrap tracking-wide">
                  <span className="sm:hidden">Selesai ✓</span>
                  <span className="hidden sm:inline">Status: Selesai ✓</span>
                </span>
              </div>
            ) : isGoogleForm ? (
              <div
                id="material-status-indicator"
                className={`w-full min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs select-none ${
                  !accessCheck.isAccessible
                    ? 'bg-rose-50 text-rose-900 border border-rose-300'
                    : 'bg-purple-50 text-purple-900 border border-purple-300'
                }`}
                title={
                  !accessCheck.isAccessible
                    ? accessCheck.statusDescription
                    : 'Selesaikan ujian Google Form dan klik Selesai Ujian untuk otomatis menyelesaikan materi'
                }
              >
                {!accessCheck.isAccessible ? (
                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                )}
                <span className="whitespace-nowrap tracking-wide">
                  <span className="sm:hidden">
                    {!accessCheck.isAccessible ? 'Terkunci' : 'Belum Selesai'}
                  </span>
                  <span className="hidden sm:inline">
                    {!accessCheck.isAccessible ? accessCheck.statusLabel : 'Belum Selesai (Ujian)'}
                  </span>
                </span>
              </div>
            ) : (
              <div
                id="material-status-indicator"
                className="w-full min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs select-none"
                title="Selesaikan Mini Kuis di bagian bawah materi ini untuk otomatis menandai selesai"
              >
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="whitespace-nowrap tracking-wide">
                  <span className="sm:hidden">Belum Selesai</span>
                  <span className="hidden sm:inline">Belum Selesai (Kuis)</span>
                </span>
              </div>
            )}
          </div>

          {/* Secondary Utilities: Bookmark */}
          {onToggleBookmark && (
            <div className="w-full">
              <button
                id="btn-material-bookmark"
                type="button"
                onClick={() => {
                  playPopSound();
                  onToggleBookmark(material.id);
                }}
                className={`w-full min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-extrabold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center active:scale-98 ${
                  isBookmarked
                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 ring-2 ring-amber-400/30 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:border-amber-400 shadow-2xs'
                }`}
                title={isBookmarked ? 'Hapus dari Materi Ditandai (Bookmarks)' : 'Simpan / Tandai Materi untuk Dipelajari Nanti'}
              >
                <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-colors ${isBookmarked ? 'fill-amber-500 text-amber-600' : 'text-slate-500'}`} />
                <span className="whitespace-nowrap">
                  <span className="sm:hidden">{isBookmarked ? 'Ditandai' : 'Tandai Materi'}</span>
                  <span className="hidden sm:inline">{isBookmarked ? 'Ditandai ✓' : 'Tandai Materi'}</span>
                </span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Special Sumatif Exam Intro Banner for Google Form */}
      {material.type === 'gform' && !isExamStarted && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-2xl p-5 sm:p-6 text-white border border-purple-500/30 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-2xl border border-purple-400/30 flex items-center justify-center shrink-0">
                {accessCheck.isAccessible ? (
                  <ShieldCheck className="w-6 h-6 text-purple-300 animate-pulse" />
                ) : (
                  <Lock className="w-6 h-6 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-purple-300 uppercase font-bold tracking-wider">
                    Halaman Ujian Sumatif (Sistem Anti-Curang)
                  </span>
                  {material.isAccessTimeRestricted && (
                    <span
                      className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${accessCheck.statusBadgeColor}`}
                    >
                      {accessCheck.statusLabel}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-black text-white leading-snug">
                  {material.title}
                </h3>
              </div>
            </div>

            {/* Schedule details pill */}
            {material.isAccessTimeRestricted && (
              <div className="text-[11px] bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 space-y-0.5 text-slate-300">
                {material.accessStartDate && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-slate-400 font-medium">Mulai:</span>
                    <strong className="text-indigo-300">{formatAccessDateTime(material.accessStartDate)}</strong>
                  </div>
                )}
                {material.accessEndDate && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-slate-400 font-medium">Batas:</span>
                    <strong className="text-amber-300">{formatAccessDateTime(material.accessEndDate)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {!accessCheck.isAccessible ? (
            /* LOCKED STATE NOTICE */
            <div className="bg-rose-950/40 border-2 border-rose-800/80 rounded-2xl p-5 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-900/60 border border-rose-700/60 text-rose-300 flex items-center justify-center">
                <Lock className="w-7 h-7 text-rose-400" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-base font-black text-rose-200">
                  {accessCheck.statusLabel}
                </h4>
                <p className="text-xs text-rose-300/90 leading-relaxed font-medium">
                  {accessCheck.statusDescription}
                </p>
                <div className="pt-2 text-[11px] text-slate-400 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                  💡 <strong>Catatan:</strong> Jika Anda peserta susulan atau izin berhalangan, silakan hubungi guru mata pelajaran atau pengawas ujian untuk membuka kunci akses ujian ini secara manual.
                </div>
              </div>
              <button
                type="button"
                disabled
                className="px-6 py-3 bg-slate-800 text-slate-500 font-extrabold text-xs sm:text-sm rounded-xl border border-slate-700 cursor-not-allowed inline-flex items-center gap-2 opacity-70"
              >
                <Lock className="w-4 h-4 text-slate-500" />
                <span>Ujian Terkunci Otomatis</span>
              </button>
            </div>
          ) : (
            /* ALLOWED / READY STATE */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Peraturan Security Ujian:</span>
                </h4>
                <ul className="space-y-1.5 text-slate-300 list-disc list-inside text-[11px] leading-relaxed">
                  <li>Siswa wajib mengerjakan ujian langsung di dalam sistem ini.</li>
                  <li><strong className="text-amber-300">Dilarang keluar/berpindah tab browser</strong> atau berpindah ke aplikasi lain.</li>
                  <li>Sistem akan secara otomatis mencatat <strong className="text-rose-400">jumlah pelanggaran</strong> jika keluar halaman.</li>
                  <li>Kerjakan dengan jujur, tertib, dan mandiri.</li>
                </ul>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-purple-300 flex items-center gap-1.5 text-xs">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Kesiapan Sesi:</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Google Form telah disiapkan di dalam aplikasi. Tekan tombol di bawah untuk membuka soal dalam Mode Kiosk Ujian terkunci.
                  </p>
                </div>

                <button
                  onClick={() => {
                    playPopSound();
                    setIsExamStarted(true);
                    setIsKioskMode(true);
                    startExamSession(material.id, material.title, { enableLockdown: true });
                    requestLockdownFullscreen();
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-purple-200" />
                  <span>Mulai Ujian Mode Kiosk</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Exam Control Security Bar (When Google Form exam is active) */}
      {material.type === 'gform' && isExamStarted && (
        <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-2.5 sm:p-3.5 text-white shadow-lg space-y-2.5">
          {/* Top Row: Info & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-1.5 sm:p-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse text-purple-400" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 shrink-0">
                    <span className="hidden sm:inline">Ujian Sumatif Aktif</span>
                    <span className="sm:hidden">Ujian Aktif</span>
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-0.5 truncate max-w-[180px] sm:max-w-xs">
                  {material.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap">
              <button
                onClick={() => {
                  playPopSound();
                  setIsKioskMode(true);
                  requestFullscreenMode();
                }}
                className="px-2.5 sm:px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-200 shrink-0" />
                <span>Mode Kiosk</span>
              </button>

              <button
                onClick={handleToggleFullscreen}
                className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 hidden sm:flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Layar Penuh</span>
              </button>

              <button
                onClick={() => {
                  playPopSound();
                  setShowFinishConfirmModal(true);
                }}
                className="px-2.5 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                <span>Selesai Ujian</span>
              </button>
            </div>
          </div>

          {/* Bottom Telemetry Bar: Sejajar & Rapi */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px] font-mono flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 font-bold">
                <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Waktu: <strong className="text-emerald-200">{formatTimer(examTimeSeconds)}</strong></span>
              </span>

              <div
                className={`px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 shrink-0 ${
                  examSession.violationsCount === 0
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : 'bg-rose-950/90 text-rose-300 border-rose-800/80 animate-pulse'
                }`}
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>Pelanggaran Tab: <strong className="font-black">{examSession.violationsCount}/3</strong></span>
              </div>
            </div>

            <div className="text-slate-400 text-[10px] hidden md:flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-purple-400" />
              <span>Sistem Pengawasan Aktif</span>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN LOCKED KIOSK MODE OVERLAY */}
      {isKioskMode && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col w-screen h-screen overflow-hidden select-none animate-in fade-in duration-200">
          {/* Kiosk Top Navigation / Security Bar */}
          <div className="bg-slate-900 border-b border-purple-500/40 px-2.5 sm:px-4 py-2 text-white shrink-0 shadow-lg select-none">
            {/* Primary Row: Title & Selesai Ujian Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-purple-500/20 border border-purple-500/40 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] sm:text-[10px] font-mono font-extrabold bg-purple-500/30 text-purple-200 border border-purple-400/40 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                      <span className="hidden sm:inline">MODE KIOSK UJIAN TERKUNCI</span>
                      <span className="sm:hidden">KIOSK TERKUNCI</span>
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate max-w-[130px] sm:max-w-xs md:max-w-md mt-0.5">
                    {material.title}
                  </h3>
                </div>
              </div>

              {/* Right Action: Selesai Ujian Button (ALWAYS VISIBLE & UNTRUNCATED) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    playPopSound();
                    setShowFinishConfirmModal(true);
                  }}
                  className="px-2.5 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                  <span>Selesai Ujian</span>
                </button>
              </div>
            </div>

            {/* Telemetry Row (Timer & Pelanggaran Status - Sejajar & Rapi) */}
            {material.type === 'gform' && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {/* Timer Chip */}
                  {isExamStarted && (
                    <div className="text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 font-bold">
                      <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Waktu: <strong className="text-emerald-200">{formatTimer(examTimeSeconds)}</strong></span>
                    </div>
                  )}

                  {/* Pelanggaran Chip */}
                  <div
                    className={`px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 shrink-0 ${
                      examSession.violationsCount === 0
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                        : 'bg-rose-950/90 text-rose-300 border-rose-800/80 animate-pulse'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Pelanggaran Tab: <strong className="font-black">{examSession.violationsCount}/3</strong></span>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-1 text-slate-400 text-[10px]">
                  <ShieldAlert className="w-3 h-3 text-purple-400" />
                  <span>Sistem Anti-Curang Aktif</span>
                </div>
              </div>
            )}
          </div>

          {/* Kiosk Embedded Iframe Area */}
          <div
            className="w-full flex-1 relative bg-slate-900"
            onContextMenu={(e) => {
              if (material.type === 'gform') e.preventDefault();
            }}
            onCopy={(e) => {
              if (material.type === 'gform') e.preventDefault();
            }}
            onDragStart={(e) => {
              if (material.type === 'gform') e.preventDefault();
            }}
          >
            <iframe
              src={material.embedUrl}
              className="w-full h-full border-none bg-white"
              title={material.title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Embedded Viewer Container (Standard View) */}
      {(material.type !== 'gform' || isExamStarted) && !isKioskMode && (
        <div className="w-full max-w-full space-y-2.5">
          
          <div
            id={`material-frame-container-${material.id}`}
            onContextMenu={(e) => {
              if (material.type === 'gform') e.preventDefault();
            }}
            onCopy={(e) => {
              if (material.type === 'gform') e.preventDefault();
            }}
            className={`iframe-wrapper relative w-full max-w-full transition-all duration-300 rounded-xl sm:rounded-2xl border border-slate-300 shadow-sm bg-slate-950 flex flex-col ${containerAspectClass}`}
          >
            {/* Header Bar */}
            <div className="bg-slate-900 text-slate-300 px-2.5 sm:px-3.5 py-1.5 sm:py-2 border-b border-slate-800 flex items-center justify-between text-xs shrink-0 select-none w-full max-w-full gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-[10px] sm:text-[11px] truncate max-w-[140px] xs:max-w-[180px] sm:max-w-xs text-slate-400 ml-1">
                  {material.type === 'gform' ? 'Google Form Ujian Sumatif (Kiosk)' : `Pratinjau Materi (${material.type})`}
                </span>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Dynamic Aspect Ratio Switcher (16:9 / 9:16) for Canva & Google Drive */}
                {isPresentationOrCanva && (
                  <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700 text-[10px]">
                    <button
                      onClick={() => setAspectRatioMode('16:9')}
                      className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        aspectRatioMode === '16:9'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Rasio 16:9 (Lanskap Widescreen)"
                    >
                      <Monitor className="w-3 h-3" />
                      <span>16:9</span>
                    </button>
                    <button
                      onClick={() => setAspectRatioMode('9:16')}
                      className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        aspectRatioMode === '9:16'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Rasio 9:16 (Potret Smartphone)"
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>9:16</span>
                    </button>
                    <button
                      onClick={() => setAspectRatioMode('auto')}
                      className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        aspectRatioMode === 'auto'
                          ? 'bg-slate-700 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Ukuran Otomatis Responsif"
                    >
                      <span>Auto</span>
                    </button>
                  </div>
                )}

                {material.type === 'gform' && (
                  <button
                    disabled={!accessCheck.isAccessible}
                    onClick={() => {
                      if (!accessCheck.isAccessible) return;
                      playPopSound();
                      setIsKioskMode(true);
                    }}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg transition-colors text-[10px] sm:text-[11px] font-bold ${
                      !accessCheck.isAccessible
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700 hover:text-white cursor-pointer'
                    }`}
                    title={
                      !accessCheck.isAccessible
                        ? `${accessCheck.statusLabel}: ${accessCheck.statusDescription}`
                        : 'Buka tampilan Kiosk tanpa toolbar'
                    }
                  >
                    {!accessCheck.isAccessible ? (
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{!accessCheck.isAccessible ? 'Terkunci' : 'Mode Kiosk'}</span>
                  </button>
                )}

                {material.type !== 'gform' && (material.originalUrl || material.embedUrl) && (
                  <a
                    href={material.originalUrl || material.embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-lg transition-colors text-[10px] sm:text-[11px] cursor-pointer"
                    title="Buka dokumen di tab baru jika iframe mengalami kendala izin atau tampilan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Buka Dokumen</span>
                  </a>
                )}

                <button
                  onClick={handleToggleFullscreen}
                  className="hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-lg transition-colors text-[10px] sm:text-[11px] cursor-pointer"
                  title="Tampilkan materi layar penuh"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Layar Penuh</span>
                </button>
              </div>
            </div>

            {/* Embedded Iframe with sandbox protection against top navigation & smooth skeleton */}
            <div className="w-full h-full flex-1 relative overflow-hidden bg-slate-950">
              {isIframeLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 gap-2 select-none animate-pulse">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <span className="text-[11px] font-semibold text-slate-300">Memuat Konten Digital...</span>
                </div>
              )}
              <iframe
                src={material.embedUrl}
                onLoad={() => setIsIframeLoading(false)}
                onError={() => onIframeError?.()}
                className="w-full h-full max-w-full flex-1 border-none bg-white block"
                title={material.title}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-presentation"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Reflection / Self-Check Questions Accordion */}
      {Array.isArray(material.reflectionQuestions) && material.reflectionQuestions.length > 0 && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 space-y-3">
          <button
            onClick={() => setShowReflection(!showReflection)}
            className="w-full flex items-center justify-between text-left min-h-[40px]"
          >
            <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              <span>Pertanyaan Refleksi & Pemahaman</span>
            </div>
            {showReflection ? (
              <ChevronUp className="w-4 h-4 text-indigo-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {showReflection && (
            <div className="pt-2 border-t border-indigo-100/80 space-y-2">
              <p className="text-xs text-indigo-800">
                Gunakan pertanyaan ini untuk menguji sejauh mana Anda memahami materi di atas:
              </p>
              <ul className="space-y-2">
                {(material.reflectionQuestions || []).map((q, idx) => (
                  <li
                    key={idx}
                    className="p-3.5 bg-white rounded-xl border border-indigo-100 text-xs font-medium text-slate-800 flex items-start gap-2.5 shadow-2xs"
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Mini Kuis Interaktif (Hanya jika bukan Google Form) */}
      {material.type !== 'gform' && !material.originalUrl?.includes('docs.google.com/forms') && !material.originalUrl?.includes('forms.gle') && (
        <MiniQuizSection
          material={material}
          categoryName={category?.title}
          subjectName={subjectName}
          isCompleted={isCompleted}
          onToggleCompleted={onToggleCompleted}
        />
      )}

      {/* Completion & Next Material Action Bar (Muncul Otomatis Ketika Materi Telah Selesai) */}
      {isCompleted && !examSession.isActive && !isKioskMode && !isFocusMode && (
        <div
          id="sticky-material-bottom-actions"
          className="relative mt-8 sm:mt-10 mb-8 sm:mb-12 z-20 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white border-2 border-emerald-300/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg shadow-emerald-500/10 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-200">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-black text-slate-900 truncate flex items-center gap-2">
                <span>Materi Selesai Dipelajari</span>
                <span className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-lg border border-emerald-300">
                  Tuntas ✓
                </span>
              </p>
              <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                Bagus! Kamu telah menuntaskan modul & mini kuis ini.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            {/* Next Material Button (if available) */}
            {nextMaterial && onNextMaterial ? (
              <button
                type="button"
                onClick={onNextMaterial}
                className="w-full sm:w-auto min-h-[48px] px-5 sm:px-6 py-3 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 shrink-0 ring-2 ring-emerald-300/50"
                title={`Lanjut ke: ${nextMaterial.title}`}
              >
                <span>Materi Berikutnya</span>
                <ArrowRight className="w-4 h-4 shrink-0 stroke-[2.5]" />
              </button>
            ) : (
              <div className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-2xs">
                <span>🎉 Semua Materi di Topik Ini Telah Tuntas!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Distraction-Free Focus Mode (Reading Mode) - Optimized for Mobile & Desktop */}
      {isFocusMode && createPortal(
        <div 
          id="focus-reading-mode-portal"
          className="fixed inset-0 z-[99990] bg-slate-950 flex flex-col text-slate-100 animate-in fade-in duration-200 p-1.5 sm:p-3 sm:p-4"
        >
          {/* Top Bar inside Focus Mode - Compact, clean, and space-saving */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 mb-1.5 sm:mb-2.5 flex items-center justify-between gap-2 shrink-0 shadow-xl backdrop-blur-md">
            
            {/* Left: Indicator & Material Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Focus className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-pulse" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 shrink-0">
                    Mode Fokus
                  </span>
                  {isCompleted && (
                    <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                      Selesai
                    </span>
                  )}
                </div>
                <h3 
                  className="font-extrabold text-xs sm:text-sm text-white truncate max-w-[130px] xs:max-w-[200px] sm:max-w-md mt-0.5 leading-tight"
                  title={material.title}
                >
                  {material.title}
                </h3>
              </div>
            </div>

            {/* Right: Quick Controls & Exit Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Status Badge */}
              <div
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl border flex items-center gap-1 select-none shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isGoogleForm
                    ? 'bg-purple-950/70 text-purple-200 border-purple-800/80'
                    : 'bg-amber-950/70 text-amber-200 border-amber-800/80'
                }`}
                title={isCompleted ? 'Status: Selesai' : 'Belum Selesai'}
              >
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isCompleted ? 'text-emerald-400' : isGoogleForm ? 'text-purple-400' : 'text-amber-400'}`} />
                <span className="hidden sm:inline">
                  {isCompleted
                    ? 'Selesai ✓'
                    : isGoogleForm
                    ? 'Ujian'
                    : 'Belum'}
                </span>
              </div>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg sm:rounded-xl border border-slate-700/80 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Layar Penuh"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Layar Penuh</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsFocusMode(false)}
                className="px-2.5 sm:px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-lg sm:rounded-xl shadow-xs flex items-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95"
                title="Tutup Mode Fokus (Esc)"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Tutup</span>
                <span className="hidden sm:inline">Mode Fokus</span>
              </button>
            </div>

          </div>

          {/* Main Focus Reading Container */}
          <div className="flex-1 w-full relative overflow-hidden bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl shadow-2xl">
            <iframe
              src={material.embedUrl}
              className="w-full h-full border-none bg-white"
              title={`${material.title} (Focus Mode)`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

        </div>,
        document.body
      )}

      {/* FINISH EXAM CONFIRMATION MODAL */}
      {showFinishConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-500/40 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-purple-500/20 pb-4">
              <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Konfirmasi Selesai Ujian</h3>
                <p className="text-xs text-slate-400">Pemeriksaan Akhir Sesi Ujian</p>
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Perhatian Sebelum Keluar:</span>
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                <li>Pastikan Anda telah menekan tombol <strong className="text-emerald-400">Kirim (Submit)</strong> di dalam formulir Google Form.</li>
                <li>Durasi pengerjaan: <strong className="text-purple-300">{formatTimer(examTimeSeconds)}</strong></li>
                <li>Catatan pelanggaran: <strong className={examSession.violationsCount === 0 ? "text-emerald-400" : "text-rose-400"}>{examSession.violationsCount}/3</strong></li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  playPopSound();
                  setShowFinishConfirmModal(false);
                }}
                className="px-4 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                Kembali ke Soal
              </button>
              <button
                onClick={handleFinishExam}
                className="px-4 py-2.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ya, Selesai Ujian</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


