import React, { useState, useEffect, useRef } from 'react';
import {
  Bomb,
  Flame,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Trophy,
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  Skull,
  LogOut,
  Send,
  Zap,
  Search,
} from 'lucide-react';
import { GameSession, GamePlayer, GameTimerState } from '../../types/game';
import {
  subscribeGameSession,
  submitGameAnswer,
  passBombToTarget,
  triggerBombExplosion,
  getGameTimerState,
} from '../../lib/gameService';
import {
  playTickSound,
  playCorrectSound,
  playWrongSound,
  playExplosionSound,
  playVictoryFanfare,
  startIcebreakingBGM,
  stopIcebreakingBGM,
  setIcebreakingBGMMuted,
  setIcebreakingBGMUrgent,
  unlockAudioContext,
  getAudioContext,
} from '../../utils/gameAudio';
import { StudentAccount } from '../../types';
import { ExplosionEffect } from './ExplosionEffect';
import confetti from 'canvas-confetti';

interface StudentGameViewProps {
  initialSession: GameSession;
  student: StudentAccount;
  onExitGame: () => void;
}

export const StudentGameView: React.FC<StudentGameViewProps> = React.memo(({
  initialSession,
  student,
  onExitGame,
}) => {
  // Authoritative game session state for student view
  const [activeGameSession, setActiveGameSession] = useState<GameSession>(initialSession);
  const session = activeGameSession;
  const setSession = setActiveGameSession;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [hasAnsweredCorrectly, setHasAnsweredCorrectly] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<'correct' | 'wrong' | 'exploded' | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [explosionEffect, setExplosionEffect] = useState<{
    active: boolean;
    reason: 'wrong_answer' | 'timeout' | null;
    message: string;
  }>({
    active: false,
    reason: null,
    message: '',
  });

  // Audio mute ref to prevent tearing down Firestore listener on mute toggles
  const isAudioMutedRef = useRef(isAudioMuted);
  isAudioMutedRef.current = isAudioMuted;

  // Deduplication tracker per session and round to prevent multiple explosion triggers and audio repeats
  const explodedRoundsRef = useRef<Set<string>>(new Set());
  const victoryCelebratedSessionIdRef = useRef<string | null>(null);
  const confettiIntervalRef = useRef<any>(null);

  // Background Music (BGM): Start automatically on mount, stop on unmount
  useEffect(() => {
    startIcebreakingBGM({ isMuted: isAudioMuted });
    return () => {
      stopIcebreakingBGM();
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
      }
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, []);

  // Sync mute state to BGM engine
  useEffect(() => {
    setIcebreakingBGMMuted(isAudioMuted);
  }, [isAudioMuted]);

  // Track previous session state across snapshot events
  const prevSessionRef = useRef<GameSession>(initialSession);

  // Server-authoritative timestamp timer state (calculated from Firestore timestamps)
  const [timerState, setTimerState] = useState<GameTimerState>(() =>
    getGameTimerState(initialSession, Date.now())
  );
  const tickIntervalRef = useRef<any>(null);

  // Real-time listener for game room: Stable effect tied strictly to session.id & student.id
  useEffect(() => {
    const unsub = subscribeGameSession(session.id, (updated) => {
      if (!updated) return;
      const prev = prevSessionRef.current;

      // Sound and vibration cues on critical state changes
      if (!isAudioMutedRef.current) {
        if (updated.status === 'playing' && prev.status === 'lobby') {
          playCorrectSound();
        } else if (updated.currentHolderId === student.id && prev.currentHolderId !== student.id) {
          // Bomb just handed to this student!
          playTickSound(true);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
          }
        } else if (updated.status === 'ended' && prev.status !== 'ended') {
          if (updated.winnerId === student.id && victoryCelebratedSessionIdRef.current !== updated.id) {
            victoryCelebratedSessionIdRef.current = updated.id;
            playVictoryFanfare();
            triggerVictoryCelebration();
          }
        }
      }

      // Detect if this student was just eliminated by bomb/wrong answer
      const prevPlayer = prev.players?.[student.id];
      const currPlayer = updated.players?.[student.id];
      if (prevPlayer && currPlayer && prevPlayer.isAlive && !currPlayer.isAlive) {
        const roundKey = `${updated.id}_${updated.roundNumber || 1}_${student.id}`;
        const reason = currPlayer.eliminatedReason === 'wrong_answer' ? 'wrong_answer' : 'timeout';
        const reasonMsg = reason === 'wrong_answer'
          ? '💥 KABOOM! Jawabanmu Salah! Bom meledak seketika di tanganmu!'
          : '⏰ WAKTU HABIS! Bom meledak sebelum sempat kamu oper!';

        if (!explodedRoundsRef.current.has(roundKey)) {
          explodedRoundsRef.current.add(roundKey);
          if (!isAudioMutedRef.current) {
            playExplosionSound();
          }
          setExplosionEffect({
            active: true,
            reason,
            message: reasonMsg,
          });
        }
      }

      // Reset target picker when holder changes
      if (updated.currentHolderId !== student.id) {
        setShowTargetPicker(false);
        setHasAnsweredCorrectly(false);
      }

      prevSessionRef.current = updated;
      setSession(updated);
      setTimerState(getGameTimerState(updated, Date.now()));
    });

    return () => unsub();
  }, [session.id, student.id]);

  // Recalculate timer state whenever session timestamps update
  useEffect(() => {
    setTimerState(getGameTimerState(session, Date.now()));
  }, [
    session.explodeAt,
    session.timerStartedAt,
    session.timerPausedAt,
    session.isTimerPaused,
    session.status,
    session.roundNumber,
  ]);

  // Trigger grand victory fireworks confetti celebration for the surviving winner
  const triggerVictoryCelebration = () => {
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }

    // 1. Center grand blast
    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#f59e0b', '#ec4899', '#6366f1', '#10b981'],
    });

    // 2. Multi-salvo fireworks cannons from left and right
    const end = Date.now() + 3200;
    const colors = ['#f59e0b', '#fbbf24', '#6366f1', '#38bdf8', '#ef4444', '#10b981'];

    confettiIntervalRef.current = setInterval(() => {
      if (Date.now() > end) {
        if (confettiIntervalRef.current) {
          clearInterval(confettiIntervalRef.current);
          confettiIntervalRef.current = null;
        }
        return;
      }

      confetti({
        startVelocity: 35,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random() * 0.4 + 0.1, y: Math.random() * 0.5 + 0.2 },
        colors,
        particleCount: 35,
      });

      confetti({
        startVelocity: 35,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random() * 0.4 + 0.5, y: Math.random() * 0.5 + 0.2 },
        colors,
        particleCount: 35,
      });
    }, 400);

    // 3. Victory rhythmic haptic feedback for mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 80, 150, 80, 300, 100, 450]);
    }
  };

  // Active state for bomb holding and time freezing
  const isHoldingBomb = session.currentHolderId === student.id && session.status === 'playing';
  const isTimeFrozen = session.isTimerPaused || hasAnsweredCorrectly;

  // Sync urgent adrenaline tempo when holding active bomb with under 15 seconds
  useEffect(() => {
    const isUrgent = isHoldingBomb && !isTimeFrozen && timerState.remainingSeconds <= 15;
    setIcebreakingBGMUrgent(isUrgent);
  }, [isHoldingBomb, isTimeFrozen, timerState.remainingSeconds]);

  // Audio heartbeat & expiration verification trigger (only runs when holding active bomb)
  useEffect(() => {
    if (!isHoldingBomb || isTimeFrozen) {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }

    const runTick = () => {
      const now = Date.now();
      const current = getGameTimerState(session, now);
      setTimerState(current);

      // Play ticking audio based on true remaining seconds (urgent if <= 15s)
      if (!isAudioMutedRef.current) {
        playTickSound(current.remainingSeconds <= 15);
      }

      // If server timestamp has expired, trigger explosion effect and backend check ONCE per round:
      if (current.isExpired) {
        const roundKey = `${session.id}_${session.roundNumber || 1}_${student.id}`;
        if (!explodedRoundsRef.current.has(roundKey)) {
          explodedRoundsRef.current.add(roundKey);
          if (!isAudioMutedRef.current) playExplosionSound();
          setLastFeedback('exploded');
          setExplosionEffect({
            active: true,
            reason: 'timeout',
            message: '⏰ WAKTU HABIS! Bom meledak sebelum sempat kamu oper!',
          });
          // Trigger server check (server validates Date.now() >= explodeAt before exploding)
          triggerBombExplosion(session.id, student.id).catch(console.error);
        }
      }
    };

    // Immediate initial sync
    runTick();

    // Heartbeat for audio & UI tension (no cumulative local counter)
    tickIntervalRef.current = setInterval(runTick, 1000);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [
    isHoldingBomb,
    isTimeFrozen,
    session.explodeAt,
    session.timerStartedAt,
    session.timerPausedAt,
    session.status,
    session.id,
    student.id,
  ]);

  // Player state in this session
  const meAsPlayer = session.players?.[student.id];
  const isAlive = meAsPlayer?.isAlive ?? true;
  const alivePlayers: GamePlayer[] = (Object.values(session.players || {}) as GamePlayer[]).filter((p) => p && p.isAlive);
  const potentialTargets: GamePlayer[] = alivePlayers.filter((p) => p.id !== student.id);
  const filteredTargets = potentialTargets.filter((p) =>
    targetSearchQuery.trim()
      ? p.name.toLowerCase().includes(targetSearchQuery.trim().toLowerCase())
      : true
  );

  // Handle answering question
  const handleSelectOption = async (optionIndex: number) => {
    if (!isHoldingBomb || isSubmitting || !session.activeQuestion || isTimeFrozen) return;

    try {
      setIsSubmitting(true);
      // Server-authoritative validation: student only submits optionIndex.
      // Server evaluates correctness against master question bank and timestamps with active question verification.
      const result = await submitGameAnswer(
        session.id,
        student.id,
        optionIndex,
        undefined,
        session.activeQuestion?.id
      );

      if (result.isCorrect) {
        if (!isAudioMutedRef.current) playCorrectSound();
        setHasAnsweredCorrectly(true);
        setShowTargetPicker(true);
        setLastFeedback('correct');
      } else {
        // Wrong answer -> Immediate explosion sound & dramatic screen shock (deduplicated)
        const roundKey = `${session.id}_${session.roundNumber || 1}_${student.id}`;
        explodedRoundsRef.current.add(roundKey);
        if (!isAudioMutedRef.current) playExplosionSound();
        setLastFeedback('wrong');
        setExplosionEffect({
          active: true,
          reason: 'wrong_answer',
          message: '💥 KABOOM! Jawabanmu Salah! Bom meledak seketika di tanganmu!',
        });
      }
    } catch (err: any) {
      console.error('Error submitting answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exit cleanup handler ensuring all audio and intervals stop immediately
  const handleExit = () => {
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    stopIcebreakingBGM();
    onExitGame();
  };

  // Handle throwing bomb to selected friend
  const handleThrowBomb = async () => {
    if (!selectedTargetId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await passBombToTarget(session.id, student.id, selectedTargetId);
      setShowTargetPicker(false);
      setHasAnsweredCorrectly(false);
      setSelectedTargetId(null);
      setLastFeedback(null);
      if (!isAudioMutedRef.current) playCorrectSound();
    } catch (err: any) {
      console.error('Error passing bomb:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto flex flex-col font-sans bg-slate-950 text-white select-none ${
        explosionEffect.active ? 'animate-screen-shake' : ''
      }`}
      style={{
        backgroundColor: '#020617',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      {/* Framer Motion Explosion Overlay (Particle swarm, fire, smoke, shockwaves & alert modal) */}
      <ExplosionEffect
        isActive={explosionEffect.active}
        reason={explosionEffect.reason}
        message={explosionEffect.message}
        onDismiss={() => {
          setExplosionEffect({ active: false, reason: null, message: '' });
        }}
      />

      {/* 100% Solid Opaque Base Backdrop to guarantee 0% bleed-through */}
      <div className="fixed inset-0 -z-20 bg-slate-950 pointer-events-none" />

      {/* Ambient Lighting Layer (Smooth color transitions with solid dark backing, ZERO opacity pulsing) */}
      <div
        className={`fixed inset-0 -z-10 transition-colors duration-700 pointer-events-none ${
          session.status === 'ended'
            ? 'bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950'
            : isHoldingBomb && !isTimeFrozen
            ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/80 via-slate-950 to-slate-950'
            : isHoldingBomb && isTimeFrozen
            ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/60 via-slate-950 to-slate-950'
            : !isAlive
            ? 'bg-gradient-to-b from-slate-900/60 via-slate-950 to-slate-950'
            : 'bg-gradient-to-b from-indigo-950/50 via-slate-950 to-slate-950'
        }`}
      />

      {/* Tactical Glow Ring when holding active bomb (visual tension without full-screen flicker) */}
      {isHoldingBomb && !isTimeFrozen && (
        <div className="fixed inset-0 pointer-events-none border-2 sm:border-4 border-rose-500/50 shadow-[inset_0_0_60px_rgba(244,63,94,0.25)] z-40" />
      )}
      {/* Top Floating App Bar */}
      <div className="w-full max-w-xl mx-auto px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-md">
            <Bomb className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <span className="text-xs font-black tracking-tight text-white block">
              Bomb Passthrough
            </span>
            <span className="text-[10px] text-slate-300 font-mono">
              Room: <strong className="text-amber-400">{session.roomToken}</strong> • Kelas {session.targetClass}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              unlockAudioContext();
              setIsAudioMuted(!isAudioMuted);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isAudioMuted
                ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                : 'bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
            }`}
            title={isAudioMuted ? 'Nyalakan Backsound & Efek Suara' : 'Bisukan Backsound & Efek Suara'}
          >
            {isAudioMuted ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Mute</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-amber-300 animate-pulse" />
                <span className="hidden sm:inline text-[11px]">Musik On</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExit}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-600/80 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* --- SCENARIO 1: LOBBY (MENUNGGU GURU MEMULAI) --- */}
      {session.status === 'lobby' && (
        <div className="flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-2xl shadow-rose-600/50 animate-bounce">
              <Bomb className="w-12 h-12 text-amber-200" />
            </div>
            <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase shadow-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Tersambung
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Kamu Sudah Masuk di Room!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xs mx-auto">
              Menunggu Bapak/Ibu Guru memulai permainan di depan kelas...
            </p>
          </div>

          {/* Player Card */}
          <div className="w-full p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
              Identitas Pemain:
            </span>
            <div className="text-sm font-black text-white flex items-center justify-between">
              <span>{student.nama}</span>
              <span className="text-xs font-bold text-indigo-300">{student.kelas}</span>
            </div>
          </div>

          {/* Lobby Participants Counter */}
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs font-bold text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Total {alivePlayers.length} temanmu sudah ada di ruang tunggu</span>
          </div>
        </div>
      )}

      {/* --- SCENARIO 2: PLAYING - HOLDING BOMB (EMERGENCY ACTIVE) --- */}
      {session.status === 'playing' && isHoldingBomb && !showTargetPicker && (
        <div className="flex-1 max-w-lg w-full mx-auto px-4 py-3 flex flex-col justify-between space-y-3 z-10">
          {/* Header Alert Card with Countdown Bar */}
          <div className="p-4 bg-gradient-to-r from-rose-950/90 via-red-950/90 to-rose-950/90 border border-rose-500/60 rounded-2xl text-center space-y-2 shadow-xl shadow-rose-950/80">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md">
              <Flame className="w-4 h-4 text-rose-600 animate-bounce" />
              BOM ADA DI TANGANMU! JAWAB SEKARANG!
            </div>
            <p className="text-[11px] text-rose-200 font-medium">
              Pilih jawaban yang benar untuk membekukan waktu dan melempar bom ke teman!
            </p>

            {/* Tension Countdown Bar */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-rose-200 mb-1">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  <span>Sisa Waktu Bom:</span>
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono ${
                  timerState.remainingSeconds <= 15
                    ? 'bg-rose-500 text-white animate-pulse'
                    : timerState.remainingSeconds <= 30
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                }`}>
                  {timerState.remainingSeconds} detik
                </span>
              </div>
              <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/20">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    timerState.remainingSeconds <= 15
                      ? 'bg-rose-500 shadow-md shadow-rose-500/80'
                      : timerState.remainingSeconds <= 30
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, 100 - timerState.tensionPercentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Question Card */}
          {session.activeQuestion ? (
            <div className="flex-1 flex flex-col justify-center space-y-3">
              <div className="p-5 sm:p-6 bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-2xl space-y-2">
                <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider block">
                  {session.activeQuestion.category || 'Trivia Kilat'}
                </span>
                <h3 className="text-base sm:text-xl font-black text-white leading-snug">
                  {session.activeQuestion.questionText}
                </h3>
              </div>

              {/* 4 Big Tap Buttons (High contrast, solid opacity, touch friendly) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {session.activeQuestion.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    disabled={isSubmitting}
                    className="p-4 bg-slate-900/95 hover:bg-slate-800 active:scale-[0.98] border-2 border-slate-700 hover:border-amber-400 rounded-2xl text-left font-black text-sm text-white transition-all cursor-pointer flex items-center gap-3 shadow-lg disabled:opacity-50"
                  >
                    <span className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center text-xs font-black shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-snug">{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-300">
              <p>Mempersiapkan pertanyaan berikutnya...</p>
            </div>
          )}

          {/* Footer Warning */}
          <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Detak bom terus berjalan • Cepat dan teliti!
          </div>
        </div>
      )}

      {/* --- SCENARIO 3: TARGET PICKER (TIME FROZEN! SISWA MEMILIH TARGET LEMPARAN) --- */}
      {session.status === 'playing' && isHoldingBomb && showTargetPicker && (
        <div className="flex-1 max-w-lg w-full mx-auto px-4 py-4 flex flex-col justify-between space-y-4 z-10">
          {/* Frozen Banner */}
          <div className="p-4 bg-cyan-950/90 border border-cyan-400/80 rounded-2xl text-center space-y-1 shadow-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md">
              <Zap className="w-4 h-4 text-slate-950" />
              JAWABAN BENAR! WAKTU DIBEKUKAN SEMENTARA!
            </span>
            <p className="text-xs text-cyan-200 font-semibold mt-1">
              Pilih satu teman di bawah ini untuk kamu lemparkan bom!
            </p>
          </div>

          {/* Target Classmates Grid */}
          <div className="flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                {potentialTargets.length > 0
                  ? `Pilih Target Teman (${potentialTargets.length} Siswa):`
                  : 'Mode Tantangan Cepat (1 Peserta):'}
              </span>
              {selectedTargetId && (
                <span className="text-[11px] font-bold text-amber-300">
                  Target: {potentialTargets.find((p) => p.id === selectedTargetId)?.name}
                </span>
              )}
            </div>

            {/* Quick search input when class has many students (> 6) */}
            {potentialTargets.length > 6 && (
              <div className="relative">
                <input
                  type="text"
                  value={targetSearchQuery}
                  onChange={(e) => setTargetSearchQuery(e.target.value)}
                  placeholder={`Cari teman dari ${potentialTargets.length} siswa...`}
                  className="w-full px-3.5 py-2 pl-9 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none transition-colors"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                {targetSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTargetSearchQuery('')}
                    className="absolute right-2.5 top-2 text-[11px] text-slate-400 hover:text-white px-1"
                  >
                    Hapus
                  </button>
                )}
              </div>
            )}

            {potentialTargets.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 max-h-[44vh] overflow-y-auto no-scrollbar p-1">
                {filteredTargets.length === 0 ? (
                  <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                    Tidak ada teman dengan nama "{targetSearchQuery}".
                  </div>
                ) : (
                  filteredTargets.map((player) => {
                    const isSelected = selectedTargetId === player.id;
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => setSelectedTargetId(player.id)}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/30 scale-[1.02] font-black'
                            : 'bg-slate-900/90 hover:bg-slate-850 text-white border-slate-700/80 hover:border-amber-400/60 font-bold'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-white'
                          }`}
                        >
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs truncate">{player.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-amber-300 mx-auto animate-bounce" />
                <p className="text-xs font-bold text-amber-200">
                  Jawabanmu Benar! Karena kamu adalah satu-satunya peserta di ruang ini, kamu bisa langsung lanjut ke soal berikutnya.
                </p>
              </div>
            )}
          </div>

          {/* Throw / Continue Button */}
          <button
            type="button"
            onClick={potentialTargets.length > 0 ? handleThrowBomb : async () => {
              if (isSubmitting) return;
              try {
                setIsSubmitting(true);
                await passBombToTarget(session.id, student.id, student.id);
                setShowTargetPicker(false);
                setHasAnsweredCorrectly(false);
                setSelectedTargetId(null);
                setLastFeedback(null);
                if (!isAudioMutedRef.current) playCorrectSound();
              } catch (e) {
                console.error(e);
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={potentialTargets.length > 0 ? (!selectedTargetId || isSubmitting) : isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white text-base font-black rounded-2xl shadow-xl shadow-rose-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed scale-102"
          >
            <Send className="w-5 h-5 text-amber-300" />
            <span>
              {potentialTargets.length > 0
                ? (selectedTargetId
                    ? `🚀 LEMPAR BOM KE ${potentialTargets.find((p) => p.id === selectedTargetId)?.name || 'TEMAN'}!`
                    : 'PILIH TEMAN DULU DI ATAS')
                : '🚀 LANJUT KE SOAL BERIKUTNYA!'}
            </span>
          </button>
        </div>
      )}

      {/* --- SCENARIO 4: PLAYING - SAFE (BOM DI TANGAN TEMAN LAIN) --- */}
      {session.status === 'playing' && !isHoldingBomb && isAlive && (
        <div className="flex-1 max-w-md w-full mx-auto px-4 py-8 flex flex-col items-center justify-center text-center space-y-6 z-10">
          <div className="w-20 h-20 rounded-3xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-white shadow-xl shadow-indigo-950/50">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              STATUSMU: AMAN SEMENTARA
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Bom Sedang Di Tangan:
            </h2>
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700/80 shadow-lg">
              <span className="text-lg sm:text-xl font-black text-amber-300 flex items-center justify-center gap-2">
                <Bomb className="w-5 h-5 text-rose-400 animate-bounce" />
                {session.currentHolderName || 'Teman Sekelas'}
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-xs mx-auto pt-2">
              Tetap waspada! Jika ia berhasil menjawab benar, bom bisa dilempar ke kamu kapan saja!
            </p>
          </div>

          {/* Survivors Ticker */}
          <div className="w-full p-4 bg-slate-900/90 rounded-2xl border border-slate-700/80 text-left space-y-2 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Sisa Teman Yang Masih Bertahan:</span>
              <span className="text-emerald-400 font-black">{alivePlayers.length} Siswa</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {alivePlayers.slice(0, 8).map((p) => (
                <span
                  key={p.id}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                    p.id === student.id
                      ? 'bg-indigo-600 text-white border border-indigo-400'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {p.name}
                </span>
              ))}
              {alivePlayers.length > 8 && (
                <span className="text-[10px] text-slate-400">+{alivePlayers.length - 8} lainnya</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SCENARIO 5: ELIMINATED (SPECTATOR MODE) --- */}
      {session.status === 'playing' && !isAlive && (
        <div className="flex-1 max-w-md w-full mx-auto px-4 py-8 flex flex-col items-center justify-center text-center space-y-6 z-10">
          <div className="w-20 h-20 rounded-3xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-white shadow-xl shadow-rose-950/50">
            <Skull className="w-10 h-10 text-rose-400" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
              KAMU TELAH TERELIMINASI
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Mode Penonton (Spectator)
            </h2>
            <p className="text-xs text-slate-300 max-w-xs mx-auto">
              Jangan berkecil hati! Tonton terus teman-temanmu untuk melihat siapa yang akan menjadi pemenang terakhir!
            </p>
          </div>

          {/* Current Battle Info */}
          <div className="w-full p-4 bg-slate-900/90 rounded-2xl border border-slate-700/80 text-left space-y-1 shadow-lg">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
              Bom Saat Ini Di Tangan:
            </span>
            <div className="text-sm font-black text-white flex items-center gap-2">
              <Bomb className="w-4 h-4 text-rose-400" />
              <span>{session.currentHolderName || 'Teman Sekelas'}</span>
            </div>
          </div>
        </div>
      )}

      {/* --- SCENARIO 6: ENDED / VICTORY SCREEN --- */}
      {session.status === 'ended' && (
        <div className="flex-1 max-w-md w-full mx-auto px-4 py-8 flex flex-col items-center justify-center text-center space-y-6 z-10">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-white shadow-2xl shadow-amber-500/30 animate-bounce">
              <Trophy className="w-12 h-12 text-amber-300" />
            </div>
            {session.winnerId === student.id && (
              <span className="absolute -top-2 -right-2 text-2xl animate-spin">
                ✨
              </span>
            )}
          </div>

          <div className="space-y-2">
            <span className="px-3.5 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
              Permainan Selesai!
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {session.winnerId === student.id ? '🎉 KAMU ADALAH JUARA BERTAHAN!' : 'Sang Juara Bertahan:'}
            </h2>
            <div className="p-4 bg-slate-900/95 rounded-2xl border border-amber-400/50 shadow-xl">
              <h3 className="text-2xl sm:text-3xl font-black text-amber-300">
                👑 {session.winnerName || 'Juara'}
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-300 max-w-xs mx-auto">
            {session.winnerId === student.id
              ? 'Luar biasa! Refleks dan kecepatan berpikirmu berhasil membawamu bertahan hingga akhir!'
              : 'Tepuk tangan untuk sang juara! Guru dapat memulai ronde baru atau kembali ke materi pelajaran.'}
          </p>

          {session.winnerId === student.id && (
            <button
              type="button"
              onClick={triggerVictoryCelebration}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/30 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Rayakan Kemenangan Lagi! (Kembang Api 🎉)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExit}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            Kembali ke Beranda Belajar
          </button>
        </div>
      )}
    </div>
  );
});

StudentGameView.displayName = 'StudentGameView';
