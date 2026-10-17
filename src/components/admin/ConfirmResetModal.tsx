import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmResetModalProps {
  isOpen: boolean;
  title?: string;
  studentName: string;
  studentClass?: string;
  extraInfo?: string;
  description?: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const ConfirmResetModal: React.FC<ConfirmResetModalProps> = ({
  isOpen,
  title = 'Konfirmasi Reset Progres Siswa',
  studentName,
  studentClass,
  extraInfo,
  description,
  confirmText = 'Ya, Reset Progres',
  onConfirm,
  onClose,
}) => {
  const [isResetting, setIsResetting] = useState(false);

  // Close on Escape key press and freeze background scroll
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResetting && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = originalBodyWidth;
      document.body.style.paddingRight = originalBodyPaddingRight;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isResetting, isOpen, onClose]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    try {
      setIsResetting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Reset action error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const modalContent = (
    <div
      id="modal-confirm-reset"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={() => !isResetting && onClose()}
    >
      <div
        id="modal-confirm-reset-content"
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-scaleUp relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          id="btn-close-reset-modal"
          disabled={isResetting}
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          title="Tutup Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning / Header */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200 shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div className="space-y-1 pr-6">
            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {title}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Konfirmasi persetujuan sebelum eksekusi reset sistem.
            </p>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-slate-800 space-y-2.5">
          <p className="font-semibold text-slate-700">
            Apakah Anda yakin ingin mereset data siswa berikut?
          </p>

          <div className="p-3 bg-white rounded-xl border border-amber-200/70 shadow-2xs flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-black text-slate-900 text-sm truncate">
                {studentName}
              </div>
              {extraInfo && (
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                  {extraInfo}
                </div>
              )}
            </div>
            {studentClass && (
              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200/60 text-indigo-700 font-bold rounded-lg text-xs whitespace-nowrap shrink-0">
                Kelas {studentClass}
              </span>
            )}
          </div>

          <div className="flex items-start gap-2 text-rose-800 bg-rose-50/80 p-2.5 rounded-lg border border-rose-100 text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              {description || (
                <span>
                  Setelah disetujui, progres materi yang telah diselesaikan serta nilai kuis siswa ini akan direset kembali ke kondisi awal (0%).
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            id="btn-cancel-reset"
            disabled={isResetting}
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            id="btn-confirm-reset-action"
            disabled={isResetting}
            onClick={handleExecute}
            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mereset...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
