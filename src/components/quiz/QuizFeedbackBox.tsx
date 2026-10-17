import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface QuizFeedbackBoxProps {
  explanation?: string;
  isLastQuestion: boolean;
  onNextQuestion?: () => void;
  onNext?: () => void;
}

export const QuizFeedbackBox: React.FC<QuizFeedbackBoxProps> = React.memo(
  ({ explanation, isLastQuestion, onNextQuestion, onNext }) => {
    const handleNext = onNext || onNextQuestion || (() => {});
    return (
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, type: 'spring', bounce: 0.2 }}
        className="p-5 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-purple-950/90 border border-indigo-500/40 rounded-2xl space-y-4 shadow-xl select-none"
      >
        <div className="flex items-start gap-3 text-xs">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="space-y-1.5 flex-1">
            <span className="font-black text-indigo-300 text-xs block uppercase tracking-wide">
              Penjelasan & Pembahasan:
            </span>
            <p className="text-slate-200 leading-relaxed font-medium text-xs sm:text-sm break-words">
              {explanation || 'Jawaban yang tepat berdasarkan konsep dan substansi materi pembelajaran.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={handleNext}
            className="w-full sm:w-auto justify-center px-7 py-3.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-900/50 transition-all flex items-center gap-2.5 cursor-pointer"
          >
            <span>{isLastQuestion ? 'Lihat Hasil Kuis' : 'Soal Berikutnya'}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </motion.button>
        </div>
      </motion.div>
    );
  }
);

QuizFeedbackBox.displayName = 'QuizFeedbackBox';
