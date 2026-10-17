import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export interface QuizQuestionCardProps {
  questionIndex: number;
  questionText?: string;
  options?: string[];
  enableAITutor?: boolean;
  isSpeakingAudio?: boolean;
  onToggleTTS?: (text: string) => void;
}

export const QuizQuestionCard: React.FC<QuizQuestionCardProps> = React.memo(
  ({
    questionIndex,
    questionText = '',
    options = [],
    enableAITutor = false,
    isSpeakingAudio = false,
    onToggleTTS,
  }) => {
    const handleSpeak = () => {
      if (onToggleTTS) {
        onToggleTTS(`${questionText || ''}. Pilihan jawaban: ${(options || []).join(', ')}`);
      }
    };

    return (
      <div className="p-5 sm:p-7 bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 text-white rounded-2xl sm:rounded-3xl space-y-3 border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-2">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
            Pertanyaan #{questionIndex + 1}
          </span>

          {enableAITutor && (
            <button
              type="button"
              onClick={handleSpeak}
              className="p-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold select-none"
              title="Dengar Narasi Suara Soal"
            >
              {isSpeakingAudio ? (
                <VolumeX className="w-4 h-4 text-rose-400 animate-pulse" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-300" />
              )}
              <span>{isSpeakingAudio ? 'Hentikan' : 'Suara AI'}</span>
            </button>
          )}
        </div>

        <h3 className="text-base sm:text-lg md:text-xl font-extrabold leading-relaxed text-white break-words">
          {questionText}
        </h3>
      </div>
    );
  }
);

QuizQuestionCard.displayName = 'QuizQuestionCard';
