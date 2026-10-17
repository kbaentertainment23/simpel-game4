import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

export interface QuizRefreshConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRefresh: () => void;
}

export const QuizRefreshConfirmModal: React.FC<QuizRefreshConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmRefresh,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="mini-quiz-refresh-modal-backdrop"
          className="fixed inset-0 z-[99996] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-white">Buat Ulang Soal Kuis?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI Gemini akan merumuskan 10 butir soal kuis baru secara otomatis. Sesi saat ini akan dimulai ulang dari nomor 1 dengan variasi soal yang segar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onConfirmRefresh}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-indigo-950 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ya, Refresh Soal</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
