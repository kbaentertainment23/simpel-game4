import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { QuizQuestion } from '../../types';
import { isOptionCorrect } from '../../utils/quizScoring';

export interface QuizStepGridProps {
  questions?: QuizQuestion[];
  questionsCount?: number;
  currentQuestionIndex?: number;
  currentIndex?: number;
  userAnswers?: number[];
  isAnswered?: boolean;
  enableLifelines?: boolean;
  enableAITutor?: boolean;
  usedFiftyFifty?: boolean;
  hasUsedFiftyFifty?: boolean;
  hasUsedAIHint?: boolean;
  onUseFiftyFifty?: () => void;
  onGetAIHint?: () => void;
  onGetAnalogi?: () => void;
}

export const QuizStepGrid: React.FC<QuizStepGridProps> = React.memo(
  ({
    questions = [],
    questionsCount,
    currentQuestionIndex,
    currentIndex,
    userAnswers = [],
    isAnswered = false,
    enableLifelines = false,
    usedFiftyFifty = false,
    hasUsedFiftyFifty = false,
    hasUsedAIHint = false,
  }) => {
    const activeIndex = currentQuestionIndex ?? currentIndex ?? 0;
    const safeQuestions = questions || [];
    const total = questionsCount ?? safeQuestions.length;
    const progressPercent = total > 0 ? Math.round(((activeIndex + (isAnswered ? 1 : 0)) / total) * 100) : 0;
    const is5050Used = hasUsedFiftyFifty || usedFiftyFifty;

    return (
      <div className="space-y-2">
        {/* Progress bar and lifelines status preview */}
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-400">
          <span>
            Soal <strong className="text-white">{Math.min(activeIndex + 1, total)}</strong> dari {total}
          </span>
          {enableLifelines && (
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border ${
                  is5050Used
                    ? 'bg-slate-900/60 text-slate-500 border-slate-800'
                    : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                }`}
              >
                ⚡ 50:50: {is5050Used ? '0x' : '1x'}
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border ${
                  hasUsedAIHint
                    ? 'bg-slate-900/60 text-slate-500 border-slate-800'
                    : 'bg-indigo-400/15 text-indigo-300 border-indigo-400/30'
                }`}
              >
                💡 AI: {hasUsedAIHint ? '0x' : '1x'}
              </span>
            </div>
          )}
        </div>

        {/* Animated Progress Bar */}
        <div className="relative w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        {/* Steps Indicator Grid (1 to N) */}
        {(safeQuestions || []).length > 0 && (
          <div className="flex items-center justify-between gap-1 overflow-x-auto pt-1 pb-0.5 scrollbar-none select-none">
            {(safeQuestions || []).map((_, qIdx) => {
              const isPast = qIdx < activeIndex;
              const isCurrent = qIdx === activeIndex;
              const userAnsIdx = userAnswers ? userAnswers[qIdx] : undefined;
              const isCorrect = userAnsIdx !== undefined && safeQuestions[qIdx] && isOptionCorrect(safeQuestions[qIdx], userAnsIdx);

              return (
                <div
                  key={qIdx}
                  className={`flex-1 min-w-[24px] sm:min-w-[28px] h-7 sm:h-8 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black flex items-center justify-center transition-all border ${
                    isPast
                      ? isCorrect
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-2xs'
                        : 'bg-rose-500 text-white border-rose-400 shadow-2xs'
                      : isCurrent
                      ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-300/40 shadow-xs'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {isPast ? (
                    isCorrect ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )
                  ) : (
                    <span>{qIdx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

QuizStepGrid.displayName = 'QuizStepGrid';
