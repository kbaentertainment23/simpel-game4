import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut } from 'lucide-react';

export interface QuizExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
}

export const QuizExitConfirmModal: React.FC<QuizExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="mini-quiz-exit-modal-backdrop"
          className="fixed inset-0 z-[99995] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-white">Keluar dari Sesi Kuis?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Progres kuis belum selesai. Jika Anda keluar sekarang, sesi pengerjaan kuis ini akan dihentikan dan Anda akan kembali ke tampilan materi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
              >
                Lanjutkan Kuis
              </button>
              <button
                type="button"
                onClick={onConfirmExit}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-950"
              >
                Ya, Keluar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
