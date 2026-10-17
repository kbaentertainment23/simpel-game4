import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface QuizOptionCardProps {
  index: number;
  optionText?: string;
  text?: string;
  isSelected: boolean;
  isCorrect: boolean;
  isDisabled5050?: boolean;
  isAnswered: boolean;
  onSelect: (index: number) => void;
}

export const QuizOptionCard: React.FC<QuizOptionCardProps> = React.memo(
  ({
    index,
    optionText,
    text,
    isSelected,
    isCorrect,
    isDisabled5050 = false,
    isAnswered,
    onSelect,
  }) => {
    const displayText = optionText ?? text ?? '';
    let optionStyle =
      'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:border-indigo-400 hover:bg-indigo-950/40 hover:text-white';

    if (isDisabled5050) {
      optionStyle = 'bg-slate-950/60 text-slate-600 border-slate-800 opacity-40 cursor-not-allowed line-through';
    } else if (isAnswered) {
      if (isCorrect) {
        optionStyle = 'bg-emerald-950/90 text-emerald-100 border-emerald-500 font-bold ring-2 ring-emerald-500/40 shadow-lg';
      } else if (isSelected && !isCorrect) {
        optionStyle = 'bg-rose-950/90 text-rose-100 border-rose-500 font-semibold ring-1 ring-rose-400/50 shadow-lg';
      } else {
        optionStyle = 'bg-slate-950/70 text-slate-500 border-slate-800 opacity-50';
      }
    }

    const handleClick = () => {
      if (!isAnswered && !isDisabled5050) {
        onSelect(index);
      }
    };

    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.03 }}
        whileHover={!isAnswered && !isDisabled5050 ? { scale: 1.01, x: 4 } : undefined}
        whileTap={!isAnswered && !isDisabled5050 ? { scale: 0.98 } : undefined}
        onClick={handleClick}
        disabled={isAnswered || isDisabled5050}
        className={`w-full p-4 min-h-[56px] rounded-2xl border text-xs sm:text-sm text-left transition-all flex items-start gap-3.5 cursor-pointer select-none ${optionStyle}`}
      >
        <span
          className={`w-8 h-8 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center shrink-0 border transition-all ${
            isAnswered && isCorrect
              ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
              : isAnswered && isSelected && !isCorrect
              ? 'bg-rose-500 text-white border-rose-400 shadow-md'
              : isSelected
              ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {String.fromCharCode(65 + index)}
        </span>

        <span className="pt-1 leading-relaxed flex-1 font-semibold text-slate-100 break-words">
          {displayText}
        </span>

        {isDisabled5050 && (
          <span className="text-[10px] text-slate-400 font-bold bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-700/80 shrink-0 self-center">
            Dieliminasi 50:50
          </span>
        )}

        {isAnswered && isCorrect && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
          </motion.div>
        )}
        {isAnswered && isSelected && !isCorrect && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-1" />
          </motion.div>
        )}
      </motion.button>
    );
  }
);

QuizOptionCard.displayName = 'QuizOptionCard';
