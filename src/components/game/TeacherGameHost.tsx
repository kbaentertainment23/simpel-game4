import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bomb,
  Flame,
  Play,
  Pause,
  RotateCcw,
  Users,
  Copy,
  Check,
  ShieldAlert,
  Trophy,
  Volume2,
  VolumeX,
  FastForward,
  Clock,
  Sparkles,
  ArrowRight,
  Skull,
  UserCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Gamepad2,
  Radio,
  Package,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { GameSession, GamePlayer, GameTimerState, IcebreakingPackage } from '../../types/game';
import {
  createGameSession,
  subscribeGameSession,
  subscribeRecentGameSessions,
  subscribeIcebreakingPackages,
  startGameSession,
  triggerBombExplosion,
  hostForcePassBomb,
  togglePauseGameSession,
  endGameSession,
  deleteGameSession,
  getGameTimerState,
} from '../../lib/gameService';
import {
  playTickSound,
  playExplosionSound,
  playVictoryFanfare,
  playCorrectSound,
  startIcebreakingBGM,
  stopIcebreakingBGM,
  setIcebreakingBGMMuted,
  unlockAudioContext,
} from '../../utils/gameAudio';
import { TeacherAccount, Subject } from '../../types';
import { getCorrectAnswerIndexForTeacher } from '../../data/icebreakingQuestions';
import { ConfirmDeleteModal } from '../admin/ConfirmDeleteModal';

interface TeacherGameHostProps {
  currentTeacher?: TeacherAccount | null;
  masterClasses?: string[];
  subjects?: Subject[];
  isTeacherRole?: boolean;
  initialPackageId?: string;
  onClose?: () => void;
  showNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const TeacherGameHost: React.FC<TeacherGameHostProps> = ({
  currentTeacher,
  masterClasses = ['7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'],
  subjects,
  isTeacherRole = false,
  initialPackageId,
  onClose,
  showNotify,
}) => {
  // Setup Form State
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (currentTeacher?.assignedClasses && currentTeacher.assignedClasses.length > 0) {
      return currentTeacher.assignedClasses[0];
    }
    return masterClasses[0] || '7A';
  });
  const [minSeconds, setMinSeconds] = useState<number>(60);
  const [maxSeconds, setMaxSeconds] = useState<number>(120);

  // Question Package & Source State
  const [packages, setPackages] = useState<IcebreakingPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState<boolean>(true);
  const [questionSourceType, setQuestionSourceType] = useState<'custom' | 'default'>(() =>
    initialPackageId ? 'custom' : 'default'
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>(() => initialPackageId || '');
  const [questionCategory, setQuestionCategory] = useState<string>('Trivia Populer & Lucu');

  // Active Session State
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false);

  // Server-authoritative timer state for host proyektor
  const [hostTimerState, setHostTimerState] = useState<GameTimerState | null>(null);
  const localTimerRef = useRef<any>(null);

  // Available classes for this teacher
  const availableClasses = isTeacherRole && currentTeacher?.assignedClasses && currentTeacher.assignedClasses.length > 0
    ? currentTeacher.assignedClasses
    : masterClasses;

  // Real-time listener to Firestore icebreaking packages
  useEffect(() => {
    setIsLoadingPackages(true);
    const unsub = subscribeIcebreakingPackages((list) => {
      setPackages(list);
      setIsLoadingPackages(false);

      if (initialPackageId) {
        const found = list.find((p) => p.id === initialPackageId);
        if (found) {
          setQuestionSourceType('custom');
          setSelectedPackageId(found.id);
        }
      }
    });

    return () => unsub();
  }, [initialPackageId]);

  // Synchronize when initialPackageId prop changes
  useEffect(() => {
    if (initialPackageId) {
      setQuestionSourceType('custom');
      setSelectedPackageId(initialPackageId);
    }
  }, [initialPackageId]);

  // Active custom package item
  const activeCustomPackage = useMemo(() => {
    if (questionSourceType !== 'custom') return null;
    if (selectedPackageId) {
      return packages.find((p) => p.id === selectedPackageId) || null;
    }
    return packages[0] || null;
  }, [questionSourceType, selectedPackageId, packages]);

  // Listen for existing active rooms so teacher can easily resume if needed
  const [existingActiveRooms, setExistingActiveRooms] = useState<GameSession[]>([]);

  useEffect(() => {
    const unsub = subscribeRecentGameSessions((rooms) => {
      const active = rooms.filter((r) => r.status === 'lobby' || r.status === 'playing' || r.status === 'paused');
      setExistingActiveRooms(active);
    }, isTeacherRole && currentTeacher?.assignedClasses?.[0] ? currentTeacher.assignedClasses[0] : undefined);

    return () => unsub();
  }, [isTeacherRole, currentTeacher?.assignedClasses]);

  // Track previous session state and ensure sound triggers only once per valid transition
  const prevSessionRef = useRef<GameSession | null>(null);
  const startSoundPlayedSessionIdRef = useRef<string | null>(null);
  const victorySoundPlayedSessionIdRef = useRef<string | null>(null);
  const hostExplosionTriggeredRoundRef = useRef<Set<string>>(new Set());

  // Synchronize Background Music (BGM) for classroom host when active room is open
  useEffect(() => {
    if (activeSession && (activeSession.status === 'lobby' || activeSession.status === 'playing')) {
      startIcebreakingBGM({ isMuted: isSoundMuted });
    } else {
      stopIcebreakingBGM();
    }
    return () => {
      stopIcebreakingBGM();
    };
  }, [activeSession?.id, activeSession?.status]);

  // Sync host mute state with BGM
  useEffect(() => {
    setIcebreakingBGMMuted(isSoundMuted);
  }, [isSoundMuted]);

  useEffect(() => {
    if (!activeSession?.id) {
      prevSessionRef.current = null;
      return;
    }

    const unsub = subscribeGameSession(activeSession.id, (updated) => {
      if (updated) {
        const prev = prevSessionRef.current;

        // Sound trigger strictly on verified status transitions, never repeatedly across snapshots
        if (!isSoundMuted) {
          if (
            prev &&
            prev.status === 'lobby' &&
            updated.status === 'playing' &&
            startSoundPlayedSessionIdRef.current !== updated.id
          ) {
            startSoundPlayedSessionIdRef.current = updated.id;
            playCorrectSound();
          } else if (
            prev &&
            prev.status !== 'ended' &&
            updated.status === 'ended' &&
            updated.winnerId &&
            victorySoundPlayedSessionIdRef.current !== updated.id
          ) {
            victorySoundPlayedSessionIdRef.current = updated.id;
            playVictoryFanfare();
          }
        }

        prevSessionRef.current = updated;
        setActiveSession(updated);
        setHostTimerState(getGameTimerState(updated, Date.now()));
      } else {
        prevSessionRef.current = null;
        setActiveSession(null);
        setHostTimerState(null);
      }
    });

    return () => {
      unsub();
    };
  }, [activeSession?.id, isSoundMuted]);

  // Server-authoritative timer tracker for host display & explosion check
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'playing') {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
      setHostTimerState(null);
      return;
    }

    if (activeSession.isTimerPaused) {
      // Time is frozen while student picks target or game is paused
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
      setHostTimerState(getGameTimerState(activeSession, Date.now()));
      return;
    }

    const runHostTick = () => {
      const now = Date.now();
      const current = getGameTimerState(activeSession, now);
      setHostTimerState(current);

      // Host sound ticking
      if (!isSoundMuted) {
        if (current.remainingSeconds <= 15) {
          playTickSound(true);
        } else if (current.elapsedSeconds % 2 === 0) {
          playTickSound(false);
        }
      }

      // Check if bomb should explode (server strictly validates Date.now() >= explodeAt)
      if (current.isExpired && activeSession.currentHolderId) {
        const roundKey = `${activeSession.id}_${activeSession.roundNumber || 1}_${activeSession.currentHolderId}`;
        if (!hostExplosionTriggeredRoundRef.current.has(roundKey)) {
          hostExplosionTriggeredRoundRef.current.add(roundKey);
          if (!isSoundMuted) playExplosionSound();
          triggerBombExplosion(activeSession.id, activeSession.currentHolderId).catch(console.error);
        }
      }
    };

    runHostTick();
    localTimerRef.current = setInterval(runHostTick, 1000);

    return () => {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
    };
  }, [
    activeSession?.status,
    activeSession?.isTimerPaused,
    activeSession?.explodeAt,
    activeSession?.timerStartedAt,
    activeSession?.timerPausedAt,
    activeSession?.currentHolderId,
    activeSession?.id,
    isSoundMuted,
  ]);

  // Handlers
  const handleCreateRoom = async () => {
    const chosenPkg = questionSourceType === 'custom'
      ? (selectedPackageId ? packages.find((p) => p.id === selectedPackageId) : packages[0]) || null
      : null;

    if (questionSourceType === 'custom') {
      if (!chosenPkg) {
        showNotify?.('error', 'Silakan pilih paket soal atau gunakan trivia bawaan sistem.');
        return;
      }
      const qCount = chosenPkg.questions?.length ?? chosenPkg.totalQuestions ?? 0;
      if (qCount === 0) {
        showNotify?.('error', `Paket "${chosenPkg.title}" belum memiliki butir soal aktif. Silakan tambahkan soal di menu Paket Soal.`);
        return;
      }
    }

    unlockAudioContext();
    try {
      setIsCreating(true);
      const session = await createGameSession({
        teacherId: currentTeacher?.id || 'admin',
        teacherName: currentTeacher?.name || 'Guru Pengampu',
        targetClass: selectedClass,
        minDurationSeconds: minSeconds,
        maxDurationSeconds: maxSeconds,
        questionCategory: chosenPkg ? chosenPkg.category : questionCategory,
        questionPackageId: chosenPkg ? chosenPkg.id : undefined,
        questionPackageTitle: chosenPkg ? chosenPkg.title : undefined,
      });
      setActiveSession(session);
      setHostTimerState(null);
      showNotify?.(
        'success',
        `Room ${session.roomToken} berhasil dibuka untuk Kelas ${selectedClass}${
          chosenPkg ? ` menggunakan paket "${chosenPkg.title}" (${chosenPkg.questions?.length || 0} soal)` : ''
        }!`
      );
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal membuat ruang permainan');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartGame = async () => {
    if (!activeSession) return;
    if (playersList.length === 0) {
      showNotify?.('error', 'Belum ada siswa yang bergabung di dalam room.');
      return;
    }
    try {
      await startGameSession(activeSession.id);
      if (!isSoundMuted) playCorrectSound();
      showNotify?.('success', `Permainan dimulai dengan ${playersList.length} siswa! Bom sedang berdetak!`);
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal memulai permainan');
    }
  };

  const handleCopyToken = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.roomToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleTogglePause = async () => {
    if (!activeSession) return;
    const isPaused = activeSession.status === 'paused' || activeSession.isTimerPaused;
    await togglePauseGameSession(activeSession.id, !isPaused);
  };

  const handleForcePass = async () => {
    if (!activeSession) return;
    await hostForcePassBomb(activeSession.id);
    showNotify?.('info', 'Bom dioper manual ke peserta lain.');
  };

  const handleEndGame = async () => {
    if (!activeSession) return;
    try {
      await endGameSession(activeSession.id);
      showNotify?.('info', 'Permainan telah diakhiri.');
    } catch (err: any) {
      showNotify?.('error', err?.message || 'Gagal mengakhiri sesi.');
    }
  };

  const handleDismissRoom = () => {
    if (!activeSession) return;
    setIsDismissModalOpen(true);
  };

  const handleConfirmDismiss = async () => {
    if (!activeSession) return;
    try {
      const token = activeSession.roomToken;
      await deleteGameSession(activeSession.id);
      setActiveSession(null);
      showNotify?.('success', `Room ${token} berhasil dihapus dari sistem dan dashboard siswa.`);
    } catch (err: any) {
      showNotify?.('error', err?.message || 'Gagal menghapus room.');
    } finally {
      setIsDismissModalOpen(false);
    }
  };

  const playersList: GamePlayer[] = (Object.values(activeSession?.players || {}) as GamePlayer[]).filter(Boolean);
  const alivePlayers: GamePlayer[] = playersList.filter((p) => p.isAlive);
  const eliminatedPlayers: GamePlayer[] = playersList.filter((p) => !p.isAlive);

  return (
    <div className="w-full space-y-6">
      {/* Top Header Card */}
      <div className="p-6 bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 rounded-3xl border border-rose-500/30 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-900/50 shrink-0">
              <Bomb className="w-8 h-8 animate-pulse text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Bomb Passthrough: Trivia Battle Royale
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Mode Icebreaking Kelas
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                Game multiplayer real-time: Siswa menjawab trivia kilat, membekukan waktu, dan melempar bom ke teman sekelas sebelum meledak!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSoundMuted(!isSoundMuted)}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isSoundMuted
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-rose-500/20 text-rose-200 border-rose-500/40 hover:bg-rose-500/30'
              }`}
              title={isSoundMuted ? 'Nyalakan Efek Suara' : 'Matikan Efek Suara'}
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-300 animate-pulse" />}
              <span className="hidden sm:inline">{isSoundMuted ? 'Muted' : 'Audio On'}</span>
            </button>

            {activeSession && (
              <button
                type="button"
                onClick={handleDismissRoom}
                className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ganti Room</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- SCENARIO 1: SETUP FORM (Saat Belum Ada Room Aktif) --- */}
      {!activeSession && (
        <div className="space-y-6">
          {/* Active Existing Room Resume Banner (if any room is already active/waiting) */}
          {existingActiveRooms.length > 0 && (
            <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-indigo-500/15 border-2 border-amber-400/80 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md animate-fadeIn">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Radio className="w-6 h-6 animate-pulse text-amber-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-base font-black text-slate-900">
                      Sesi Room Aktif Ditemukan: Token <span className="font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">{existingActiveRooms[0].roomToken}</span>
                    </h4>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                      {existingActiveRooms[0].status === 'lobby' ? 'Menunggu Siswa (Lobby)' : existingActiveRooms[0].status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Kelas: <strong>{existingActiveRooms[0].targetClass === 'ALL' ? 'Semua Kelas' : existingActiveRooms[0].targetClass}</strong>
                    {existingActiveRooms[0].questionPackageTitle && (
                      <> • Paket: <strong className="text-indigo-700">📦 {existingActiveRooms[0].questionPackageTitle}</strong></>
                    )} • <strong>{existingActiveRooms[0].playerCount ?? Object.keys(existingActiveRooms[0].players || {}).length} Siswa Bergabung</strong>. Anda dapat langsung membuka room ini tanpa membuat baru!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const room = existingActiveRooms[0];
                  setActiveSession(room);
                  setHostTimerState(getGameTimerState(room, Date.now()));
                  showNotify?.('info', `Membuka room ${room.roomToken}...`);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black transition-all shrink-0 flex items-center justify-center gap-2 shadow-md cursor-pointer scale-100 hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current text-amber-300" />
                <span>Buka & Kendalikan Room Ini</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Pembuatan Room */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-indigo-600" />
                <span>Konfigurasi Sesi Permainan Baru</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Atur target kelas dan rentang waktu rahasia sebelum membagikan kode token ke siswa.
              </p>
            </div>

            <div className="space-y-5">
              {/* 1. Pilih Kelas Sasaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Target Kelas Siswa
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(availableClasses || []).map((cls) => {
                    const isSelected = selectedClass === cls;
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setSelectedClass(cls)}
                        className={`p-3 rounded-2xl border text-center font-black text-sm transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-[1.02]'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        Kelas {cls}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setSelectedClass('ALL')}
                    className={`p-3 rounded-2xl border text-center font-black text-sm transition-all cursor-pointer ${
                      selectedClass === 'ALL'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-[1.02]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Semua Kelas
                  </button>
                </div>
              </div>

              {/* 2. Rentang Waktu Ledakan Rahasia */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-rose-600" />
                    <span>Rentang Waktu Bom Meledak (Durasi Rahasia)</span>
                  </label>
                  <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    {minSeconds} - {maxSeconds} Detik (~{Math.round(minSeconds / 60)} s/d {Math.round(maxSeconds / 60)} Menit)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Sistem akan memilih durasi acak di antara rentang ini. Baik guru maupun siswa tidak akan tahu detik tepatnya bom meledak!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">Durasi Minimal:</span>
                    <input
                      type="range"
                      min={30}
                      max={90}
                      step={5}
                      value={minSeconds}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMinSeconds(val);
                        if (val >= maxSeconds) setMaxSeconds(val + 30);
                      }}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>30s</span>
                      <span className="font-bold text-rose-600">{minSeconds}s</span>
                      <span>90s</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">Durasi Maksimal:</span>
                    <input
                      type="range"
                      min={minSeconds + 10}
                      max={180}
                      step={10}
                      value={maxSeconds}
                      onChange={(e) => setMaxSeconds(Number(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{minSeconds + 10}s</span>
                      <span className="font-bold text-rose-600">{maxSeconds}s</span>
                      <span>180s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Pilihan Sumber & Paket Soal Icebreaking */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Sumber & Paket Soal Game
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {packages.length} Paket Guru Siap Digunakan
                  </span>
                </div>

                {/* Toggle Pilihan: Paket Soal Guru vs Trivia Bawaan */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setQuestionSourceType('custom');
                      if (!selectedPackageId && packages.length > 0) {
                        setSelectedPackageId(packages[0].id);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      questionSourceType === 'custom'
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200 scale-[1.01]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Paket Soal Guru ({packages.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuestionSourceType('default')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      questionSourceType === 'default'
                        ? 'bg-white text-amber-700 shadow-xs border border-slate-200 scale-[1.01]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Trivia Acak Bawaan</span>
                  </button>
                </div>

                {/* Sub-tampilan 1: Paket Soal Buatan Guru */}
                {questionSourceType === 'custom' && (
                  <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200/90 space-y-3 animate-fadeIn">
                    {isLoadingPackages ? (
                      <div className="py-4 text-center text-xs font-bold text-indigo-600 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Memuat daftar paket soal guru...</span>
                      </div>
                    ) : packages.length === 0 ? (
                      <div className="text-center py-4 space-y-2">
                        <Package className="w-8 h-8 text-indigo-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-800">
                          Belum ada paket soal yang dibuat.
                        </p>
                        <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                          Anda dapat membuat paket soal kustom di menu tab <strong>"Paket Soal"</strong> atau gunakan opsi <strong>Trivia Acak Bawaan</strong> untuk bermain langsung.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-indigo-950 mb-1.5">
                            Pilih Paket Soal yang Digunakan:
                          </label>
                          <select
                            value={selectedPackageId || packages[0]?.id || ''}
                            onChange={(e) => setSelectedPackageId(e.target.value)}
                            className="w-full py-2.5 px-3.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-xs"
                          >
                            {packages.map((pkg) => {
                              const qCount = pkg.questions?.length ?? pkg.totalQuestions ?? 0;
                              return (
                                <option key={pkg.id} value={pkg.id}>
                                  📦 {pkg.title} ({qCount} Soal) • {pkg.category || 'Umum'}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Kartu Ringkasan Paket Terpilih */}
                        {activeCustomPackage && (
                          <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5 min-w-0">
                              <span className="font-extrabold text-slate-900 truncate block">
                                {activeCustomPackage.title}
                              </span>
                              <p className="text-[11px] text-slate-500 truncate">
                                {activeCustomPackage.description || `Kategori: ${activeCustomPackage.category || 'Umum'}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg font-black text-[11px]">
                                {activeCustomPackage.questions?.length ?? activeCustomPackage.totalQuestions ?? 0} Butir Soal
                              </span>
                              {(activeCustomPackage.questions?.length ?? activeCustomPackage.totalQuestions ?? 0) === 0 && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md font-bold text-[10px]">
                                  Kosong!
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {activeCustomPackage && (activeCustomPackage.questions?.length ?? activeCustomPackage.totalQuestions ?? 0) === 0 && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>Paket ini belum memiliki butir soal. Silakan tambahkan soal di menu tab "Paket Soal" terlebih dahulu.</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Sub-tampilan 2: Trivia Acak Bawaan Sistem */}
                {questionSourceType === 'default' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <select
                      value={questionCategory}
                      onChange={(e) => setQuestionCategory(e.target.value)}
                      className="w-full py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      <option value="Trivia Populer & Lucu">🎯 Trivia Populer & Lucu (Campuran Kasual Santai)</option>
                      <option value="Teka-teki Logika Santai">🧠 Teka-teki Nalar & Logika Cepat</option>
                      <option value="Sains & Alam Seru">🌍 Sains, Alam & Fakta Unik Dunia</option>
                      <option value="Semua Kategori">✨ Semua Kategori Acak (Direkomendasikan)</option>
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Soal acak bawaan otomatis diambil dari bank data trivia icebreaking umum.
                    </p>
                  </div>
                )}
              </div>

              {/* Tombol Buat Room */}
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={
                  isCreating ||
                  (questionSourceType === 'custom' &&
                    (!activeCustomPackage ||
                      (activeCustomPackage.questions?.length ?? activeCustomPackage.totalQuestions ?? 0) === 0))
                }
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-700 to-indigo-700 hover:from-rose-700 hover:to-indigo-800 text-white rounded-2xl text-sm font-black shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>
                  {isCreating
                    ? 'Mempersiapkan Ruangan...'
                    : questionSourceType === 'custom' && activeCustomPackage
                    ? `🔥 BUKA RUANG DENGAN PAKET "${activeCustomPackage.title.toUpperCase()}"`
                    : '🔥 BUKA RUANG PERMAINAN SEKARANG'}
                </span>
              </button>
            </div>
          </div>

          {/* Aturan Main & Ringkasan untuk Guru */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200/80 p-6 space-y-4">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span>Cara Memandu Permainan</span>
            </h4>

            <div className="space-y-3 text-xs text-slate-600 font-medium leading-relaxed">
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-black text-[11px] flex items-center justify-center shrink-0">1</span>
                <p>Bagikan <strong>Kode Token Room</strong> kepada siswa di kelas melalui proyektor atau lisan.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-black text-[11px] flex items-center justify-center shrink-0">2</span>
                <p>Tunggu siswa masuk di layar lobi. Tekan <strong>"Mulai Game"</strong> saat peserta sudah siap.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-black text-[11px] flex items-center justify-center shrink-0">3</span>
                <p><strong>Mekanisme Bom:</strong> Siswa yang memegang bom harus menjawab kuis kilat 4 pilihan:</p>
              </div>

              <ul className="pl-6 space-y-1.5 list-disc text-[11px] text-slate-500">
                <li><strong className="text-rose-600">Salah Jawab:</strong> Siswa langsung <strong>gugur/tereliminasi</strong>, dan bom otomatis berpindah ke teman lain!</li>
                <li><strong className="text-emerald-600">Benar Jawab:</strong> Waktu <strong>dibekukan sementara</strong>! Siswa leluasa memilih teman target untuk dilempar bom.</li>
                <li><strong className="text-amber-600">Waktu Habis:</strong> Bom meledak di tangan pemegang terakhir, ia gugur dan ronde baru dimulai!</li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* --- SCENARIO 2: LOBBY MODE (Peserta Bergabung, Menunggu Mulai) --- */}
      {activeSession && activeSession.status === 'lobby' && (
        <div className="space-y-6">
          {/* Big Classroom Projector Banner */}
          <div className="p-8 sm:p-10 bg-white rounded-3xl border-2 border-indigo-200 shadow-xl text-center space-y-6 relative overflow-hidden">
            <div className="max-w-2xl mx-auto space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wide uppercase">
                  Ruang Tunggu Kelas {activeSession.targetClass === 'ALL' ? 'Semua Kelas' : activeSession.targetClass}
                </span>
                {activeSession.questionPackageTitle && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-300 tracking-wide">
                    📦 Paket: {activeSession.questionPackageTitle}
                  </span>
                )}
              </div>
              <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Masukkan Kode Token untuk Bergabung:
              </h3>
            </div>

            {/* Giant Token Code Display */}
            <div className="inline-flex items-center gap-4 p-4 sm:p-6 bg-slate-900 text-white rounded-3xl shadow-2xl border-4 border-amber-400">
              <span className="font-mono text-4xl sm:text-6xl font-black tracking-widest text-amber-300 select-all">
                {activeSession.roomToken}
              </span>
              <button
                type="button"
                onClick={handleCopyToken}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all cursor-pointer text-white"
                title="Salin Token"
              >
                {copiedToken ? <Check className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6" />}
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 font-semibold">
              Minta siswa membuka aplikasi SIMPEL di HP masing-masing dan menekan tombol <strong className="text-indigo-600 font-bold">"🎮 Masuk Game Kelas"</strong>.
            </p>

            {/* Dynamic Start Button Area */}
            <div className="pt-2 flex flex-col items-center justify-center gap-2">
              {playersList.length > 0 ? (
                <div className="space-y-2 text-center animate-fadeIn">
                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="px-8 sm:px-10 py-4 bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white text-base sm:text-lg font-black rounded-2xl shadow-xl shadow-rose-600/40 transition-all flex items-center justify-center gap-3 cursor-pointer scale-105 hover:scale-110 active:scale-95 animate-pulse mx-auto"
                  >
                    <Flame className="w-6 h-6 text-amber-300 animate-bounce" />
                    <span>🔥 MULAI PERMAINAN ({playersList.length} SISWA SIAP)</span>
                  </button>
                  <p className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {playersList.length} siswa siap! Klik tombol di atas untuk memulai permainan.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2 animate-pulse">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>Menunggu siswa memasukkan token... Tombol <strong>"Mulai Permainan"</strong> akan muncul otomatis saat ada siswa masuk!</span>
                </div>
              )}
            </div>
          </div>

          {/* Joined Players Live Grid */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-black text-slate-900">
                  Daftar Peserta di Lobby ({playersList.length} Siswa)
                </h4>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Real-time Sync
              </span>
            </div>

            {playersList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300 animate-pulse" />
                <p className="text-xs font-bold">Belum ada siswa yang masuk ke ruangan.</p>
                <p className="text-[11px] text-slate-400">Pastikan siswa memasukkan token <strong>{activeSession.roomToken}</strong>.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {playersList.map((player) => (
                  <div
                    key={player.id}
                    className="p-3 bg-slate-50 hover:bg-indigo-50/60 rounded-2xl border border-slate-200 transition-all flex items-center gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {player.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {player.kelas || activeSession.targetClass}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SCENARIO 3: PLAYING & BATTLE ROYALE MODE --- */}
      {activeSession && (activeSession.status === 'playing' || activeSession.status === 'paused' || activeSession.status === 'ended') && (
        <div className="space-y-6">
          {/* Main Battle Status Card */}
          <div className={`p-6 sm:p-8 rounded-3xl border-2 transition-all shadow-xl relative overflow-hidden ${
            activeSession.status === 'ended'
              ? 'bg-gradient-to-br from-amber-950 via-slate-900 to-indigo-950 border-amber-400 text-white'
              : activeSession.isTimerPaused
              ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border-cyan-400 text-white'
              : 'bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950 border-rose-500 text-white'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Holder & Status Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-white/10 border border-white/20 uppercase tracking-wider">
                    Ronde {activeSession.roundNumber || 1}
                  </span>
                  {activeSession.questionPackageTitle && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                      📦 Paket: {activeSession.questionPackageTitle}
                    </span>
                  )}

                  {activeSession.status === 'ended' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-md">
                      <Trophy className="w-4 h-4 text-slate-950" />
                      GAME BERAKHIR — SANG JUARA TELAH DITEMUKAN!
                    </span>
                  ) : activeSession.isTimerPaused ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-400 text-slate-950 flex items-center gap-1 shadow-md animate-pulse">
                      <Pause className="w-4 h-4 text-slate-950" />
                      WAKTU DIBEKUKAN (SEDANG MEMILIH TARGET LEMPARAN)
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500 text-white flex items-center gap-1 shadow-md animate-pulse">
                      <Flame className="w-4 h-4 text-amber-300" />
                      BOM BERDETAK AKTIF!
                    </span>
                  )}
                </div>

                {activeSession.status === 'ended' ? (
                  <div>
                    <h3 className="text-3xl sm:text-5xl font-black text-amber-300 tracking-tight flex items-center gap-3">
                      👑 {activeSession.winnerName || 'Juara Bertahan'}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                      Satu-satunya siswa yang berhasil bertahan hidup dari ledakan bom hingga akhir permainan!
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block">
                      Bom Sedang Di Tangan:
                    </span>
                    <h3 className="text-3xl sm:text-5xl font-black text-amber-300 tracking-tight flex items-center gap-3 mt-1">
                      <Bomb className={`w-8 h-8 sm:w-12 sm:h-12 text-rose-400 ${activeSession.isTimerPaused ? '' : 'animate-bounce'}`} />
                      <span>{activeSession.currentHolderName || 'Menunggu...'}</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                      {activeSession.isTimerPaused
                        ? `${activeSession.currentHolderName} menjawab benar! Ia sedang memilih siswa target di layarnya...`
                        : `Siswa ini sedang menjawab pertanyaan di HP-nya. Waktu rahasia terus berdetak!`}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Toolbar for Host */}
              <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
                {activeSession.status !== 'ended' && (
                  <>
                    <button
                      type="button"
                      onClick={handleForcePass}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shadow-md"
                      title="Gunakan jika HP siswa pemegang bom terputus atau macet"
                    >
                      <FastForward className="w-4 h-4" />
                      <span>⚡ Oper Manual</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs border border-white/20 transition-all cursor-pointer flex items-center gap-2"
                    >
                      {activeSession.status === 'paused' ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                      <span>{activeSession.status === 'paused' ? 'Lanjutkan' : 'Jeda Game'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEndGame}
                      className="px-4 py-2.5 bg-rose-600/80 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Akhiri Permainan</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Live Action Ticker at bottom of Card */}
            {activeSession.lastActionMessage && (
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-xs font-bold text-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>{activeSession.lastActionMessage}</span>
              </div>
            )}
          </div>

          {/* Active Question Preview (Host Screen) */}
          {activeSession.activeQuestion && activeSession.status !== 'ended' && (
            <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pertanyaan Yang Sedang Ditampilkan Di HP Siswa:
                  </span>
                </div>
                <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                  {activeSession.activeQuestion.category || 'Trivia'}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-black text-slate-800">
                "{activeSession.activeQuestion.questionText}"
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {activeSession.activeQuestion.options.map((opt, idx) => {
                  const teacherCorrectIdx = getCorrectAnswerIndexForTeacher(
                    activeSession.activeQuestion?.id,
                    activeSession.activeQuestion?.options
                  );
                  const isAnswer = idx === teacherCorrectIdx;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        isAnswer
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                      {isAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Survivors vs Graveyard Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Survivors List */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-black text-slate-900">
                    Siswa Yang Masih Bertahan ({alivePlayers.length} Orang)
                  </h4>
                </div>
                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Survivors
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {alivePlayers.map((player) => {
                  const isCurrent = player.id === activeSession.currentHolderId;
                  return (
                    <div
                      key={player.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center gap-2 ${
                        isCurrent
                          ? 'bg-rose-50 border-rose-400 text-rose-950 font-black ring-2 ring-rose-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-700 font-bold'
                      }`}
                    >
                      {isCurrent ? (
                        <Bomb className="w-5 h-5 text-rose-600 animate-bounce shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center justify-center shrink-0">
                          {player.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs truncate">{player.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Eliminated Players List */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Skull className="w-5 h-5 text-slate-400" />
                  <h4 className="text-sm font-black text-slate-900">
                    Siswa Gugur / Tereliminasi ({eliminatedPlayers.length} Orang)
                  </h4>
                </div>
                <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  Spectator
                </span>
              </div>

              {eliminatedPlayers.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  Belum ada siswa yang gugur di ronde ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {eliminatedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="p-3 rounded-2xl border border-slate-200 bg-slate-100/80 text-slate-400 flex items-center gap-2 text-xs font-semibold"
                    >
                      <Skull className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="truncate block line-through">{player.name}</span>
                        <span className="text-[10px] text-rose-500 font-bold block">
                          {player.eliminatedReason === 'wrong_answer' ? '❌ Salah Jawab' : '💥 Kena Bom'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dismiss/Delete Room Modal */}
      <ConfirmDeleteModal
        isOpen={isDismissModalOpen}
        title="Hapus Ruang Permainan"
        itemName={
          activeSession
            ? `Room Token ${activeSession.roomToken} (${activeSession.targetClass === 'ALL' ? 'Semua Kelas' : `Kelas ${activeSession.targetClass}`})`
            : 'Ruang Permainan'
        }
        itemType="Sesi Icebreaking"
        description="Ruang permainan ini akan langsung dihapus dari sistem dan tidak akan tampil lagi di dashboard siswa."
        onConfirm={handleConfirmDismiss}
        onClose={() => setIsDismissModalOpen(false)}
      />
    </div>
  );
};
