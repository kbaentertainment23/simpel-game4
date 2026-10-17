import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Loader2, RotateCcw } from 'lucide-react';

export interface BankSoalResetAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialTitle?: string;
  studentCount: number;
  isResetting: boolean;
  onConfirmReset: () => void;
}

export const BankSoalResetAllModal: React.FC<BankSoalResetAllModalProps> = ({
  isOpen,
  onClose,
  materialTitle = '',
  studentCount,
  isResetting,
  onConfirmReset,
}) => {
  React.useEffect(() => {
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
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isResetting) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">
                Reset Semua Nilai Materi Ini?
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Mereset pengerjaan kuis untuk seluruh siswa pada materi ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isResetting && onClose()}
            disabled={isResetting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
          <p className="text-[11px] leading-relaxed text-rose-800">
            Tindakan ini akan mereset <strong>seluruh ({studentCount}) siswa</strong> yang telah mengerjakan materi <span className="font-bold">"{materialTitle}"</span>. Semua nilai kuis dan status selesai akan kembali ke nol.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            id="btn-confirm-reset-all-students-quiz"
            type="button"
            onClick={onConfirmReset}
            disabled={isResetting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Mereset Semua...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Ya, Reset Semua Siswa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
