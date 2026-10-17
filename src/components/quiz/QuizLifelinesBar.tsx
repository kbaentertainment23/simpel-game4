import React from 'react';
import { Zap, Lightbulb, Brain, Loader2, Sparkles, Check, Lock } from 'lucide-react';

export interface QuizLifelinesBarProps {
  enableLifelines: boolean;
  enableAITutor?: boolean;
  hasUsedFiftyFifty: boolean;
  hasUsedAIHint: boolean;
  disabledOptionsCount: number;
  isAnswered: boolean;
  isCurrentQuestionHint?: boolean;
  loadingHint?: boolean;
  loadingAnalogi?: boolean;
  onUseFiftyFifty: () => void;
  onGetAIHint: () => void;
  onGetAnalogi?: () => void;
}

export const QuizLifelinesBar: React.FC<QuizLifelinesBarProps> = React.memo(
  ({
    enableLifelines,
    enableAITutor = false,
    hasUsedFiftyFifty,
    hasUsedAIHint,
    disabledOptionsCount,
    isAnswered,
    isCurrentQuestionHint = false,
    loadingHint = false,
    loadingAnalogi = false,
    onUseFiftyFifty,
    onGetAIHint,
    onGetAnalogi,
  }) => {
    if (!enableLifelines) return null;

    const is5050ActiveOnCurrent = disabledOptionsCount > 0;
    const canUse5050 = !hasUsedFiftyFifty && !isAnswered && !is5050ActiveOnCurrent;
    const canUseAIHint = (!hasUsedAIHint || isCurrentQuestionHint) && !isAnswered && !loadingHint;

    return (
      <div
        id="quiz-lifelines-bar"
        className="p-3 sm:p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 rounded-2xl sm:rounded-3xl shadow-lg relative overflow-hidden transition-all select-none"
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 relative z-10">
          {/* Label Section */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-xs shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white tracking-wide">Fitur Bantuan Kuis</span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  1x Kesempatan
                </span>
              </div>
              <p className="text-[10px] text-indigo-200/80 hidden sm:block">
                Gunakan saat kamu ragu menentukan jawaban terbaik
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* 50:50 BUTTON */}
            <button
              type="button"
              onClick={canUse5050 ? onUseFiftyFifty : undefined}
              disabled={!canUse5050}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all border shadow-xs min-h-[40px] ${
                is5050ActiveOnCurrent
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50 cursor-default'
                  : canUse5050
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 border-amber-300 shadow-amber-500/20 active:scale-95 cursor-pointer ring-2 ring-amber-400/30'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
              }`}
              title={
                is5050ActiveOnCurrent
                  ? '2 opsi salah telah dieliminasi'
                  : hasUsedFiftyFifty
                  ? 'Kesempatan 50:50 sudah terpakai di sesi kuis ini'
                  : 'Eliminasi 2 pilihan jawaban salah (Tersedia 1x)'
              }
            >
              <Zap className={`w-3.5 h-3.5 ${canUse5050 ? 'fill-slate-950 text-slate-950' : 'text-slate-500'}`} />
              <span>50:50</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                  is5050ActiveOnCurrent
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : canUse5050
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {is5050ActiveOnCurrent ? (
                  <span className="flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Aktif
                  </span>
                ) : hasUsedFiftyFifty ? (
                  <span className="flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> 0x
                  </span>
                ) : (
                  '1x'
                )}
              </span>
            </button>

            {/* AI HINT BUTTON */}
            <button
              type="button"
              onClick={canUseAIHint ? onGetAIHint : undefined}
              disabled={!canUseAIHint}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all border shadow-xs min-h-[40px] ${
                canUseAIHint
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-400 shadow-indigo-500/25 active:scale-95 cursor-pointer ring-2 ring-indigo-400/30'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
              }`}
              title={
                hasUsedAIHint && !isCurrentQuestionHint
                  ? 'Kesempatan Petunjuk AI sudah terpakai di sesi kuis ini'
                  : 'Minta petunjuk & clue cerdas dari AI Gemini (Tersedia 1x)'
              }
            >
              {loadingHint ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
              ) : (
                <Lightbulb className={`w-3.5 h-3.5 ${canUseAIHint ? 'text-amber-300' : 'text-slate-500'}`} />
              )}
              <span>{loadingHint ? 'Memproses...' : 'Petunjuk AI'}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                  canUseAIHint
                    ? isCurrentQuestionHint
                      ? 'bg-purple-400/25 text-purple-200 border border-purple-400/40'
                      : 'bg-white/20 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isCurrentQuestionHint ? (
                  'Buka'
                ) : hasUsedAIHint ? (
                  <span className="flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> 0x
                  </span>
                ) : (
                  '1x'
                )}
              </span>
            </button>

            {/* AI ANALOGI BUTTON (OPTIONAL TUTOR FEATURE) */}
            {enableAITutor && onGetAnalogi && (
              <button
                type="button"
                onClick={!isAnswered && !loadingAnalogi ? onGetAnalogi : undefined}
                disabled={isAnswered || loadingAnalogi}
                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all border min-h-[40px] ${
                  !isAnswered && !loadingAnalogi
                    ? 'bg-slate-800/90 hover:bg-slate-700 text-purple-200 border-purple-400/30 cursor-pointer'
                    : 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
                }`}
                title="Penjelasan analogi konsep kehidupan nyata"
              >
                {loadingAnalogi ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                ) : (
                  <Brain className="w-3.5 h-3.5 text-purple-300" />
                )}
                <span className="hidden sm:inline">Analogi</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

QuizLifelinesBar.displayName = 'QuizLifelinesBar';
