import React from 'react';
import {
  Trophy,
  Award,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  GraduationCap,
  RefreshCw,
  BookOpen,
  Focus,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  PartyPopper,
} from 'lucide-react';
import { Material, QuizQuestion } from '../../types';
import { isOptionCorrect, getNormalizedCorrectIndex } from '../../utils/quizScoring';

export interface QuizCompletedResultCardProps {
  material: Material;
  finalScorePercent: number;
  minQuizPercent: number;
  score: number;
  requiredCorrectCount: number;
  isCurrentAttemptPassed: boolean;
  studentName: string;
  studentClass: string;
  studentAbsen: string;
  questions: QuizQuestion[];
  userAnswers: Record<number, number>;
  isEnrichmentMode: boolean;
  highestScoreRecord?: { score: number; totalQuestions: number } | null;
  handlePlayAgain: () => void;
  handleReturnToOfficialQuiz: () => void;
  handleStartEnrichmentQuiz: () => void;
  handleDownloadResultImage: () => void;
  isGeneratingImage: boolean;
  imageDownloaded: boolean;
  showReview: boolean;
  setShowReview: (show: boolean) => void;
  isFocusMode: boolean;
  setIsFocusMode: (focus: boolean) => void;
}

export const QuizCompletedResultCard: React.FC<QuizCompletedResultCardProps> = ({
  material,
  finalScorePercent,
  minQuizPercent,
  score,
  requiredCorrectCount,
  isCurrentAttemptPassed,
  studentName,
  studentClass,
  studentAbsen,
  questions,
  userAnswers,
  isEnrichmentMode,
  highestScoreRecord,
  handlePlayAgain,
  handleReturnToOfficialQuiz,
  handleStartEnrichmentQuiz,
  handleDownloadResultImage,
  isGeneratingImage,
  imageDownloaded,
  showReview,
  setShowReview,
  setIsFocusMode,
}) => {
  return (
    <div className="bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 shadow-2xl border-2 border-indigo-500/40 relative overflow-hidden animate-in zoom-in-95 duration-300 min-w-0">
      {/* Festive Ambient Glows */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Trophy & Cheerful Title */}
      <div className="text-center space-y-2.5 relative z-10">
        <div className="relative inline-block">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center mx-auto shadow-xl ring-4 transition-all animate-bounce ${
              finalScorePercent >= minQuizPercent || score >= requiredCorrectCount
                ? finalScorePercent === 100
                  ? 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-orange-400 text-amber-950 ring-amber-300/80 shadow-amber-500/50'
                  : 'bg-gradient-to-tr from-emerald-400 via-teal-300 to-cyan-400 text-teal-950 ring-emerald-300/80 shadow-emerald-500/50'
                : 'bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-500 text-white ring-rose-300/80 shadow-rose-500/50'
            }`}
          >
            {finalScorePercent >= minQuizPercent || score >= requiredCorrectCount ? (
              finalScorePercent === 100 ? (
                <Trophy className="w-11 h-11 sm:w-13 sm:h-13 text-amber-900 stroke-[2.5]" />
              ) : (
                <Award className="w-11 h-11 sm:w-13 sm:h-13 text-teal-900 stroke-[2.5]" />
              )
            ) : (
              <RotateCcw className="w-11 h-11 sm:w-13 sm:h-13 text-white stroke-[2.5]" />
            )}
          </div>

          {/* Floating Star Tag */}
          <span
            className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-black shadow-md border-2 border-white whitespace-nowrap flex items-center gap-1 ${
              isCurrentAttemptPassed ? 'bg-amber-400 text-slate-950' : 'bg-rose-600 text-white'
            }`}
          >
            {isCurrentAttemptPassed ? (
              <>
                <Sparkles className="w-3 h-3 text-amber-900 fill-amber-900" />
                <span>{finalScorePercent === 100 ? '⭐⭐⭐ JUARA 1' : '⭐⭐ LULUS KKM'}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-200 fill-amber-200" />
                <span>BELUM KKM</span>
              </>
            )}
          </span>
        </div>

        <div className="pt-2 space-y-1">
          <h4 className="text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-pink-300 tracking-tight leading-snug drop-shadow-md">
            {finalScorePercent >= minQuizPercent || score >= requiredCorrectCount
              ? finalScorePercent === 100
                ? '🎉 LUAR BIASA! KAMU JUARA 100%'
                : '🌟 HEBAT SEKALI! KAMU LULUS KKM'
              : '💪 BELUM MENCAPAI KKM, AYO COBA LAGI!'}
          </h4>
          <p className="text-xs sm:text-sm text-indigo-200 font-medium px-2 max-w-xl mx-auto">
            {finalScorePercent >= minQuizPercent || score >= requiredCorrectCount ? (
              <>
                Selamat! Kamu berhasil menuntaskan mini kuis materi{' '}
                <strong className="text-white font-extrabold">"{material.title}"</strong> dengan
                melampaui KKM.
              </>
            ) : (
              <>
                Kamu menjawab benar{' '}
                <strong className="text-amber-300 font-extrabold">
                  {score} dari {questions.length} soal ({finalScorePercent}%)
                </strong>
                . Syarat KKM untuk menyelesaikan materi ini adalah minimal{' '}
                <strong className="text-white font-extrabold">
                  {minQuizPercent}% ({requiredCorrectCount} benar)
                </strong>
                .
              </>
            )}
          </p>
        </div>
      </div>

      {/* Colorful Score & Student Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 relative z-10 min-w-0">
        {/* Student Profile Card */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white p-4 sm:p-5 rounded-2xl border border-blue-400/30 shadow-lg space-y-2 relative overflow-hidden flex flex-col justify-between min-w-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-200 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-cyan-300" />
              <span>Profil Siswa</span>
            </span>
            <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-xs text-white text-[10px] font-black rounded-full border border-white/30">
              Siswa Aktif
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-base sm:text-lg font-black text-white truncate drop-shadow-xs">
              {studentName}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="px-2.5 py-1 bg-cyan-400/25 text-cyan-100 text-xs font-black rounded-lg border border-cyan-300/40">
                Kelas {studentClass}
              </span>
              <span className="px-2.5 py-1 bg-amber-400/25 text-amber-200 text-xs font-black rounded-lg border border-amber-300/40 font-mono">
                Absen: #{studentAbsen}
              </span>
            </div>
          </div>
        </div>

        {/* Score & Breakdown Card */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 text-white p-4 sm:p-5 rounded-2xl border border-pink-400/30 shadow-lg space-y-2 relative overflow-hidden flex flex-col justify-between min-w-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-pink-200 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>Hasil Mini Kuis</span>
            </span>
            <span
              className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border ${
                isCurrentAttemptPassed
                  ? 'bg-emerald-400/30 text-emerald-200 border-emerald-300/40'
                  : 'bg-rose-400/30 text-rose-200 border-rose-300/40'
              }`}
            >
              {isCurrentAttemptPassed
                ? 'Lulus KKM ✓'
                : `Belum KKM (Min. ${requiredCorrectCount} Benar / ${minQuizPercent}%)`}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-300 flex items-baseline gap-1 drop-shadow-md">
              <span>{finalScorePercent}</span>
              <span className="text-xs sm:text-sm text-pink-200 font-bold">/ 100 Poin</span>
            </div>
            <div className="text-right">
              <div
                className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl border ${
                  isCurrentAttemptPassed
                    ? 'text-emerald-300 bg-emerald-950/40 border-emerald-400/40'
                    : 'text-rose-300 bg-rose-950/40 border-rose-400/40'
                }`}
              >
                {score} dari {questions.length} Benar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Question Answer Badges Bar */}
      <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/15 relative z-10 space-y-2">
        <div className="flex items-center justify-between text-xs font-black text-indigo-200">
          <span>Hasil Setiap Butir Soal:</span>
          <span className="text-amber-300 font-extrabold">
            {score} Benar • {questions.length - score} Salah (Target KKM: {minQuizPercent}% /{' '}
            {requiredCorrectCount} Benar)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {(questions || []).map((q, idx) => {
            const isCorrect = userAnswers[idx] !== undefined && isOptionCorrect(q, userAnswers[idx]);
            return (
              <div
                key={idx}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-xs border transition-all ${
                  isCorrect
                    ? 'bg-emerald-500 text-white border-emerald-300 shadow-emerald-500/20'
                    : 'bg-rose-500 text-white border-rose-300 shadow-rose-500/20'
                }`}
              >
                <span>Soal #{idx + 1}</span>
                <span>{isCorrect ? '✓' : '✗'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Automatic Completion Status Notification based on KKM / Enrichment */}
      {isEnrichmentMode ? (
        <div className="flex items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-xs sm:text-sm font-black shadow-lg border-2 border-emerald-300/80 text-center relative z-10">
          <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
          <span>
            🌟 Sesi Pengayaan Selesai! Skor ({score}/{questions.length}) tidak disimpan karena hanya
            sebagai latihan pengayaan. Nilai kuis resmi kamu ({highestScoreRecord?.score || 10}/
            {highestScoreRecord?.totalQuestions || 10}) tetap aman tersimpan!
          </span>
        </div>
      ) : isCurrentAttemptPassed ? (
        <div className="flex items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 text-white text-xs sm:text-sm font-black shadow-lg border-2 border-emerald-300/80 text-center relative z-10 animate-pulse">
          <PartyPopper className="w-5 h-5 text-amber-200 shrink-0" />
          <span>
            🎉 Hore! Kamu Lulus KKM ({score}/{questions.length} Benar). Materi ini otomatis tercatat
            Selesai & materi berikutnya telah terbuka! 🚀
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-red-600 text-white text-xs sm:text-sm font-black shadow-lg border-2 border-rose-300/80 text-center relative z-10">
          <AlertTriangle className="w-5 h-5 text-amber-200 shrink-0" />
          <span>
            ⚠️ Nilai kuis kamu ({score}/{questions.length} Benar) belum mencapai KKM (Minimal{' '}
            {requiredCorrectCount} Benar / {minQuizPercent}%). Materi ini belum selesai & materi
            berikutnya masih terkunci. Ayo ulangi kuis! 💪
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-1 relative z-10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {isEnrichmentMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-inline-enrichment-refresh-more"
                type="button"
                onClick={handlePlayAgain}
                className="w-full sm:w-auto px-4.5 py-3.5 min-h-[44px] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-2xl border border-emerald-400/40 shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                title="Acak butir soal pengayaan baru dari sisa bank soal guru"
              >
                <RefreshCw className="w-4 h-4 text-emerald-200" />
                <span>Acak Soal Pengayaan Lainnya</span>
              </button>
              <button
                id="btn-inline-return-official"
                type="button"
                onClick={handleReturnToOfficialQuiz}
                className="w-full sm:w-auto px-4 py-3.5 min-h-[44px] bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer backdrop-blur-xs"
              >
                <BookOpen className="w-4 h-4 text-indigo-300" />
                <span>Kembali ke Kuis Utama</span>
              </button>
            </div>
          ) : score === questions.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-inline-enrichment-refresh"
                type="button"
                onClick={handleStartEnrichmentQuiz}
                className="w-full sm:w-auto px-5 py-3.5 min-h-[44px] bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-2xl border-2 border-emerald-300 shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 animate-pulse"
                title="Nilai kamu sempurna (100)! Klik untuk membuka paket soal pengayaan yang diacak dari sisa bank soal guru"
              >
                <RefreshCw className="w-4 h-4 text-emerald-100" />
                <span>Refresh Soal Pengayaan (Acak Sisa Bank Soal)</span>
              </button>
              <button
                type="button"
                onClick={handlePlayAgain}
                className="w-full sm:w-auto px-4 py-3.5 min-h-[44px] bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Ulangi kuis resmi guru"
              >
                <RotateCcw className="w-4 h-4 text-slate-300" />
                <span>Ulangi Kuis Resmi</span>
              </button>
            </div>
          ) : (
            <button
              id="btn-inline-retry-official"
              type="button"
              onClick={handlePlayAgain}
              className="w-full sm:w-auto px-5 py-3.5 min-h-[44px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-2xl border border-indigo-400/40 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              title="Ulangi kuis ini untuk mencapai nilai sempurna 100%"
            >
              <RotateCcw className="w-4 h-4 text-amber-300" />
              <span>Ulangi Kuis ({score}/{questions.length} Benar)</span>
            </button>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsFocusMode(true)}
              className="w-full sm:w-auto px-4 py-3.5 min-h-[44px] bg-white/10 hover:bg-white/20 text-white font-black text-xs sm:text-sm rounded-2xl border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md backdrop-blur-xs active:scale-[0.98]"
              title="Buka hasil di Mode Layar Penuh"
            >
              <Focus className="w-4 h-4 text-amber-300" />
              <span>Mode Layar Penuh</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadResultImage}
              disabled={isGeneratingImage}
              className="w-full sm:w-auto px-5 py-3.5 min-h-[44px] bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-white font-black text-xs sm:text-sm rounded-2xl transition-all shadow-xl hover:shadow-2xl shadow-orange-500/40 flex items-center justify-center gap-2 cursor-pointer border-2 border-amber-200/80 disabled:opacity-50 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isGeneratingImage ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4 text-white animate-bounce" />
              )}
              <span>
                {isGeneratingImage ? 'Memproses Kartu HD...' : 'Unduh Kartu Hasil Kuis (PNG)'}
              </span>
            </button>
          </div>
        </div>

        {imageDownloaded && (
          <div className="bg-emerald-500 text-white border-2 border-emerald-300 rounded-2xl p-3.5 text-xs sm:text-sm font-black flex items-center gap-2 animate-fadeIn shadow-lg">
            <Download className="w-4 h-4 text-amber-200 shrink-0 animate-bounce" />
            <span>
              ✨ <strong>Kartu_Hasil_MiniKuis.png</strong> berhasil terunduh dengan kualitas HD!
            </span>
          </div>
        )}
      </div>

      {/* Review Jawaban Accordion */}
      <div className="pt-3 border-t border-white/15 space-y-3 min-w-0 relative z-10">
        <button
          type="button"
          onClick={() => setShowReview(!showReview)}
          className="w-full flex items-center justify-between text-xs sm:text-sm font-black text-white hover:text-amber-300 transition-colors cursor-pointer bg-white/10 hover:bg-white/15 px-4 py-3 rounded-2xl border border-white/20 backdrop-blur-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">Review Soal & Pembahasan Lengkap ({questions.length})</span>
          </div>
          <span className="shrink-0 ml-2 text-xs text-indigo-200">
            {showReview ? 'Sembunyikan ▲' : 'Buka Detail Soal ▼'}
          </span>
        </button>

        {showReview && (
          <div className="space-y-3 pt-2 min-w-0">
            {(questions || []).map((q, qIdx) => {
              const userAnsIdx = userAnswers[qIdx];
              const normCorrect = getNormalizedCorrectIndex(q);
              const isCorrect = userAnsIdx !== undefined && isOptionCorrect(q, userAnsIdx);

              return (
                <div
                  key={qIdx}
                  className="bg-slate-900/90 border-2 border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-3 text-xs sm:text-sm min-w-0 shadow-lg text-slate-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-xs">
                      Soal #{qIdx + 1}
                    </span>
                    {isCorrect ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-black border border-emerald-300 flex items-center gap-1.5 shadow-xs shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-white" /> Jawaban Benar (+10)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-black border border-rose-300 flex items-center gap-1.5 shadow-xs shrink-0">
                        <XCircle className="w-4 h-4 text-white" /> Jawaban Belum Tepat
                      </span>
                    )}
                  </div>

                  <p className="font-bold text-white leading-relaxed break-words text-sm sm:text-base">
                    {q.question}
                  </p>

                  <div className="space-y-1.5 text-xs pt-1">
                    <div
                      className={`p-3 rounded-xl border text-xs sm:text-sm font-semibold break-words ${
                        isCorrect
                          ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                          : 'bg-rose-950/60 border-rose-400/40 text-rose-200'
                      }`}
                    >
                      Jawabanmu:{' '}
                      <strong className={isCorrect ? 'text-emerald-300' : 'text-rose-300'}>
                        {userAnsIdx !== undefined && q.options && q.options[userAnsIdx] !== undefined
                          ? `${String.fromCharCode(65 + userAnsIdx)}. ${q.options[userAnsIdx]}`
                          : 'Tidak dijawab'}
                      </strong>
                    </div>
                    {!isCorrect && q.options && q.options[normCorrect] !== undefined && (
                      <div className="bg-emerald-950/70 p-3 rounded-xl border border-emerald-400/50 text-emerald-200 text-xs sm:text-sm font-medium break-words">
                        Jawaban yang Benar:{' '}
                        <strong className="text-emerald-300">
                          {String.fromCharCode(65 + normCorrect)}. {q.options[normCorrect]}
                        </strong>
                      </div>
                    )}
                  </div>

                  {q.explanation && (
                    <p className="text-xs sm:text-[13px] text-amber-100 bg-amber-950/50 p-3 sm:p-3.5 rounded-xl border border-amber-500/40 mt-1.5 leading-relaxed break-words">
                      💡 <strong className="text-amber-300">Pembahasan:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
