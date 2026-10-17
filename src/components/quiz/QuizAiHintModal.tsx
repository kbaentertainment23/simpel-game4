import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb, Loader2 } from 'lucide-react';

export interface QuizAiHintModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  hintText: string | null;
}

export const QuizAiHintModal: React.FC<QuizAiHintModalProps> = ({
  isOpen,
  onClose,
  loading,
  hintText,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fadeIn">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-900 border border-indigo-800 text-white rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-indigo-950 pb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-sm text-white">Petunjuk Pintar AI</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-indigo-950/60 border border-indigo-800/80 rounded-2xl space-y-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-indigo-300 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>AI Gemini sedang merumuskan petunjuk...</span>
                </div>
              ) : (
                <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                  {hintText || 'Fokus pada kata kunci utama pertanyaan dan eliminasi opsi yang saling bertolak belakang!'}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Paham, Kembali ke Soal
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
