import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Loader2, Volume2 } from 'lucide-react';

export interface QuizAiTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  analogiText: string | null;
  onToggleTTS: (text: string) => void;
}

export const QuizAiTutorModal: React.FC<QuizAiTutorModalProps> = ({
  isOpen,
  onClose,
  loading,
  analogiText,
  onToggleTTS,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fadeIn">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-900 border border-purple-800 text-white rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-purple-950 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <h3 className="font-extrabold text-sm text-white">Analogi Sederhana AI Tutor</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-purple-950/60 border border-purple-800/80 rounded-2xl space-y-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-purple-300 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                  <span>AI Companion menyusun analogi kehidupan nyata...</span>
                </div>
              ) : (
                <p className="text-xs text-purple-100 leading-relaxed font-medium">
                  {analogiText}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {analogiText && (
                <button
                  type="button"
                  onClick={() => onToggleTTS(analogiText)}
                  className="px-3 py-2 bg-purple-900/80 hover:bg-purple-800 text-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-purple-700"
                >
                  <Volume2 className="w-4 h-4 text-amber-300" />
                  <span>Suara</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
