import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, CheckCircle2 } from 'lucide-react';
import { Material, QuizQuestion } from '../../types';
import { getNormalizedCorrectIndex } from '../../utils/quizScoring';

export interface QuizReviewExplanationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  questions: QuizQuestion[];
}

export const QuizReviewExplanationsModal: React.FC<QuizReviewExplanationsModalProps> = ({
  isOpen,
  onClose,
  material,
  questions,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="mini-quiz-saved-review-modal"
          className="fixed inset-0 z-[99995] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between gap-3 shrink-0 border-b border-indigo-700">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300 border border-white/20 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black truncate text-white">
                    Review Pembahasan Soal & Konsep Kuis
                  </h3>
                  <p className="text-xs text-indigo-200 truncate">
                    Materi: {material.title} ({questions.length} Soal)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Questions List with explanations */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
              {questions.map((q, idx) => {
                const normCorrect = getNormalizedCorrectIndex(q);
                return (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs">
                        Nomor #{idx + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        Kunci Jawaban: {String.fromCharCode(65 + normCorrect)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-relaxed">
                      {q.question}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      {(q.options || []).map((opt, oIdx) => {
                        const isCorrect = oIdx === normCorrect;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 sm:p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 ring-1 ring-emerald-400/40'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                  {q.explanation && (
                    <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl text-xs text-amber-950 leading-relaxed mt-2">
                      💡 <strong className="text-amber-800">Pembahasan Konsep:</strong> {q.explanation}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all"
              >
                Tutup Pembahasan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
