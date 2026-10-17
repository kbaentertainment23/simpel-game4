import React, { useState, useEffect, useMemo } from 'react';
import {
  Bomb,
  Flame,
  Pause,
  Play,
  FastForward,
  XCircle,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  ShieldCheck,
  Skull,
  Clock,
  Sparkles,
  RefreshCw,
  Send,
  Zap,
  Radio,
  Eye,
  LogOut,
  ChevronDown,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { GameSession, GamePlayer } from '../../types/game';
import { TeacherAccount } from '../../types';
import {
  subscribeGameSession,
  subscribeRecentGameSessions,
  startGameSession,
  togglePauseGameSession,
  hostForcePassBomb,
  endGameSession,
  deleteGameSession,
} from '../../lib/gameService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { playCorrectSound } from '../../utils/gameAudio';
import { getCorrectAnswerIndexForTeacher } from '../../data/icebreakingQuestions';

interface IcebreakingMonitorProps {
  currentTeacher?: TeacherAccount | null;
  targetClass?: string;
  isTeacherRole?: boolean;
  onOpenHostNewRoom?: () => void;
  showNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const IcebreakingMonitor: React.FC<IcebreakingMonitorProps> = ({
  currentTeacher,
  targetClass,
  isTeacherRole = false,
  onOpenHostNewRoom,
  showNotify,
}) => {
  // Available recent rooms
  const [recentRooms, setRecentRooms] = useState<GameSession[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Single-document real-time subscribed session
  const [liveSession, setLiveSession] = useState<GameSession | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Manual Handover Modal state
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [selectedHandoverTargetId, setSelectedHandoverTargetId] = useState<string>('');

  // Delete Room Confirmation Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<GameSession | null>(null);

  // Filter tab for rooms: 'all' | 'active' | 'ended'
  const [roomFilterTab, setRoomFilterTab] = useState<'all' | 'active' | 'ended'>('all');

  // Search filter for participants
  const [searchQuery, setSearchQuery] = useState('');

  // Active vs Ended rooms segregation
  const activeRooms = useMemo(() => {
    return recentRooms.filter((r) => r.status === 'lobby' || r.status === 'playing' || r.status === 'paused');
  }, [recentRooms]);

  const endedRooms = useMemo(() => {
    return recentRooms.filter((r) => r.status === 'ended');
  }, [recentRooms]);

  const displayedRooms = useMemo(() => {
    if (roomFilterTab === 'active') return activeRooms;
    if (roomFilterTab === 'ended') return endedRooms;
    return recentRooms;
  }, [roomFilterTab, activeRooms, endedRooms, recentRooms]);

  // 1. Subscribe to recent rooms list (optimally limited to 10 rooms)
  useEffect(() => {
    setIsLoadingRooms(true);
    const filterClass = isTeacherRole && targetClass && targetClass !== 'ALL' ? targetClass : undefined;

    const unsubRooms = subscribeRecentGameSessions((rooms) => {
      setRecentRooms(rooms);
      setIsLoadingRooms(false);

      // Auto-select first active or latest room if none selected yet
      setSelectedRoomId((currentSelected) => {
        if (currentSelected && rooms.some((r) => r.id === currentSelected)) {
          return currentSelected;
        }
        const activeRoom = rooms.find((r) => r.status === 'playing' || r.status === 'paused' || r.status === 'lobby');
        return activeRoom ? activeRoom.id : rooms[0]?.id || null;
      });
    }, filterClass);

    return () => unsubRooms();
  }, [isTeacherRole, targetClass]);

  // 2. Single-Document onSnapshot Listener: listens ONLY to the active roomId document
  useEffect(() => {
    if (!selectedRoomId) {
      setLiveSession(null);
      return;
    }

    const unsubSingleDoc = subscribeGameSession(selectedRoomId, (updated) => {
      setLiveSession(updated);
    });

    return () => unsubSingleDoc();
  }, [selectedRoomId]);

  // Computed participants
  const playersList: GamePlayer[] = useMemo(() => {
    if (!liveSession?.players) return [];
    return (Object.values(liveSession.players) as GamePlayer[]).filter(Boolean);
  }, [liveSession?.players]);

  const alivePlayers = useMemo(() => {
    return playersList.filter((p) => p.isAlive);
  }, [playersList]);

  const eliminatedPlayers = useMemo(() => {
    return playersList.filter((p) => !p.isAlive);
  }, [playersList]);

  const filteredAlive = useMemo(() => {
    if (!searchQuery.trim()) return alivePlayers;
    const q = searchQuery.toLowerCase();
    return alivePlayers.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.kelas && p.kelas.toLowerCase().includes(q))
    );
  }, [alivePlayers, searchQuery]);

  const filteredEliminated = useMemo(() => {
    if (!searchQuery.trim()) return eliminatedPlayers;
    const q = searchQuery.toLowerCase();
    return eliminatedPlayers.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.kelas && p.kelas.toLowerCase().includes(q))
    );
  }, [eliminatedPlayers, searchQuery]);

  // Handlers
  const handleCopyToken = (token: string) => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    showNotify?.('info', `Kode token ${token} disalin ke clipboard!`);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleStartGame = async () => {
    if (!liveSession) return;
    if (alivePlayers.length === 0) {
      showNotify?.('error', 'Belum ada siswa yang bergabung di dalam room. Tunggu minimal 1 siswa masuk.');
      return;
    }
    try {
      setIsProcessingAction(true);
      await startGameSession(liveSession.id);
      playCorrectSound();
      showNotify?.('success', `🔥 Permainan dimulai dengan ${alivePlayers.length} siswa! Bom sedang berdetak!`);
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal memulai permainan.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleTogglePause = async () => {
    if (!liveSession) return;
    try {
      setIsProcessingAction(true);
      const isCurrentlyPaused = liveSession.status === 'paused' || liveSession.isTimerPaused;
      await togglePauseGameSession(liveSession.id, !isCurrentlyPaused);
      showNotify?.('info', isCurrentlyPaused ? 'Permainan dilanjutkan kembali!' : 'Permainan dijeda.');
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal mengubah status jeda.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleManualHandover = async () => {
    if (!liveSession) return;
    try {
      setIsProcessingAction(true);
      const targetId = selectedHandoverTargetId || undefined;
      await hostForcePassBomb(liveSession.id, targetId);
      setIsHandoverModalOpen(false);
      setSelectedHandoverTargetId('');
      showNotify?.('success', 'Bom berhasil dioper ke peserta baru!');
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal mengoper bom secara manual.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenDeleteModal = (session?: GameSession | null) => {
    const target = session || liveSession;
    if (!target) return;
    setRoomToDelete(target);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    try {
      setIsProcessingAction(true);
      const token = roomToDelete.roomToken;
      const targetId = roomToDelete.id;

      await deleteGameSession(targetId);

      // Instantly update local list
      setRecentRooms((prev) => {
        const remaining = prev.filter((r) => r.id !== targetId);
        setSelectedRoomId((curr) => (curr === targetId ? remaining[0]?.id || null : curr));
        return remaining;
      });

      if (liveSession?.id === targetId) {
        setLiveSession(null);
      }

      showNotify?.('success', `Room ${token} berhasil ditutup dan dihapus secara permanen dari sistem.`);
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal menghapus ruang permainan.');
    } finally {
      setIsProcessingAction(false);
      setIsDeleteModalOpen(false);
      setRoomToDelete(null);
    }
  };

  const handleEndSession = async () => {
    if (!liveSession) return;
    try {
      setIsProcessingAction(true);
      await endGameSession(liveSession.id);
      showNotify?.('info', 'Sesi permainan telah diakhiri.');
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal mengakhiri sesi.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Monitor Navigation & Room Selector */}
      <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-900/40 shrink-0">
            <Radio className="w-6 h-6 text-amber-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Live Monitor Sesi Game Icebreaking
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Single-Doc onSnapshot
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Pantau jalannya permainan, posisi bom, jawaban siswa, dan kontrol langsung sesi kelas secara realtime.
            </p>
          </div>
        </div>

        {/* Room Switcher / Filter Tabs / Create Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
          {recentRooms.length > 0 && (
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setRoomFilterTab('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  roomFilterTab === 'all'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua ({recentRooms.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoomFilterTab('active');
                  if (activeRooms.length > 0 && (!selectedRoomId || endedRooms.some((r) => r.id === selectedRoomId))) {
                    setSelectedRoomId(activeRooms[0].id);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  roomFilterTab === 'active'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Aktif ({activeRooms.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoomFilterTab('ended');
                  if (endedRooms.length > 0 && (!selectedRoomId || activeRooms.some((r) => r.id === selectedRoomId))) {
                    setSelectedRoomId(endedRooms[0].id);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  roomFilterTab === 'ended'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Selesai ({endedRooms.length})
              </button>
            </div>
          )}

          {recentRooms.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedRoomId || ''}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="py-2.5 pl-3.5 pr-8 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer max-w-[240px] truncate"
              >
                {displayedRooms.length === 0 ? (
                  <option value="">Tidak ada room {roomFilterTab === 'active' ? 'aktif' : 'selesai'}</option>
                ) : (
                  displayedRooms.map((r) => {
                    const isAct = r.status === 'lobby' || r.status === 'playing' || r.status === 'paused';
                    return (
                      <option key={r.id} value={r.id}>
                        {isAct ? '🟢' : '🏁'} Token {r.roomToken} ({r.targetClass === 'ALL' ? 'Semua Kelas' : `Kelas ${r.targetClass}`}) — {r.status === 'lobby' ? 'LOBBY' : r.status === 'playing' ? 'BERJALAN' : r.status === 'paused' ? 'DIJEDA' : 'SELESAI'}
                      </option>
                    );
                  })
                )}
              </select>
              {liveSession && (
                <button
                  type="button"
                  onClick={() => handleOpenDeleteModal(liveSession)}
                  className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Tutup dan hapus ruang game ini dari dashboard siswa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus</span>
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-semibold">Tidak ada room</span>
          )}

          {onOpenHostNewRoom && (
            <button
              type="button"
              onClick={onOpenHostNewRoom}
              className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Bomb className="w-4 h-4 text-amber-300" />
              <span>Buka Ruang Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* --- NO ROOM SELECTED / EMPTY STATE --- */}
      {!liveSession ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <Bomb className="w-12 h-12 mx-auto text-slate-300 animate-pulse" />
          <h4 className="text-base font-black text-slate-800">
            {isLoadingRooms ? 'Memuat Data Sesi Permainan...' : 'Belum Ada Sesi Permainan Yang Dipilih'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Pilih room dari menu dropdown di atas atau buka sesi room baru untuk kelas binaan Anda.
          </p>
          {onOpenHostNewRoom && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenHostNewRoom}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Buat Room Game Kelas Sekarang</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* --- MAIN BOMB STATUS & REALTIME CONTROLS CARD --- */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-3xl border-2 border-slate-800 text-white shadow-xl relative overflow-hidden space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Bomb Status Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-black bg-amber-400 text-slate-950 shadow-md">
                    TOKEN: {liveSession.roomToken}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/20">
                    Kelas: {liveSession.targetClass === 'ALL' ? 'Semua Kelas' : liveSession.targetClass}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/20">
                    Ronde {liveSession.roundNumber || 1}
                  </span>
                  {liveSession.questionPackageTitle && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                      📦 Paket: {liveSession.questionPackageTitle}
                    </span>
                  )}

                  {liveSession.status === 'playing' ? (
                    liveSession.isTimerPaused ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-400 text-slate-950 flex items-center gap-1 shadow-md animate-pulse">
                        <Pause className="w-3.5 h-3.5" />
                        WAKTU DIBEKUKAN (SEDANG MEMILIH TARGET)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500 text-white flex items-center gap-1 shadow-md animate-pulse">
                        <Flame className="w-3.5 h-3.5 text-amber-300" />
                        BOM SEDANG BERDETAK
                      </span>
                    )
                  ) : liveSession.status === 'paused' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950">
                      DIJEDA GURU
                    </span>
                  ) : liveSession.status === 'ended' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-400 text-slate-950">
                      GAME SELESAI
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-400 text-slate-950">
                      LOBBY MENUNGGU PESERTA
                    </span>
                  )}
                </div>

                {/* Current Holder Display */}
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 block">
                    Posisi Bom Saat Ini:
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="w-12 h-12 rounded-2xl bg-rose-600/30 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-md shrink-0">
                      <Bomb className={`w-7 h-7 ${liveSession.status === 'playing' && !liveSession.isTimerPaused ? 'animate-bounce text-rose-300' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h4 className="text-2xl sm:text-4xl font-black text-amber-300 tracking-tight">
                        {liveSession.currentHolderName || (liveSession.status === 'ended' ? `Juara: ${liveSession.winnerName || 'Selesai'}` : 'Belum Ada Pemegang')}
                      </h4>
                      <p className="text-xs text-slate-300 font-medium">
                        {liveSession.status === 'playing'
                          ? liveSession.isTimerPaused
                            ? 'Siswa berhasil menjawab benar dan sedang menentukan target lemparan di layarnya.'
                            : 'Siswa sedang membaca dan memilih opsi jawaban di HP-nya.'
                          : liveSession.lastActionMessage || 'Status sesi siap dimonitor.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Teacher Controlled Action Buttons */}
              <div className="flex flex-wrap lg:flex-col gap-2.5 shrink-0">
                {liveSession.status === 'lobby' ? (
                  <>
                    {/* Primary Dynamic Start Button in Lobby (appears dynamically when alivePlayers.length > 0) */}
                    {alivePlayers.length > 0 ? (
                      <button
                        type="button"
                        onClick={handleStartGame}
                        disabled={isProcessingAction}
                        className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-rose-600/40 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-500 text-white scale-[1.02] hover:scale-105 active:scale-95 animate-pulse"
                        title="Mulai permainan sekarang!"
                      >
                        <Flame className="w-5 h-5 text-amber-300 animate-bounce" />
                        <span>🔥 MULAI GAME ({alivePlayers.length} SISWA SIAP)</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-amber-400/30 text-amber-300 text-xs font-bold animate-pulse">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>Menunggu siswa masuk...</span>
                      </div>
                    )}

                    {/* End / Dismiss Lobby Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(liveSession)}
                      disabled={isProcessingAction}
                      className="px-4 py-2.5 bg-rose-950/70 hover:bg-rose-900/90 text-rose-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-rose-600/50 hover:border-rose-500 disabled:opacity-40 shadow-xs"
                      title="Tutup dan hapus ruang game ini dari dashboard siswa"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Tutup & Hapus Room</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* 1. Pause / Resume Button */}
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      disabled={isProcessingAction || liveSession.status === 'ended'}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md ${
                        liveSession.status === 'paused' || liveSession.isTimerPaused
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                          : 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      title="Jeda atau Lanjutkan Permainan"
                    >
                      {liveSession.status === 'paused' || liveSession.isTimerPaused ? (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Lanjutkan Permainan</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Jeda Permainan (Pause)</span>
                        </>
                      )}
                    </button>

                    {/* 2. Manual Handover Button */}
                    <button
                      type="button"
                      onClick={() => setIsHandoverModalOpen(true)}
                      disabled={isProcessingAction || liveSession.status !== 'playing' || alivePlayers.length < 2}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Oper bom ke siswa lain jika HP siswa terkendala"
                    >
                      <FastForward className="w-4 h-4" />
                      <span>Oper Manual (Handover)</span>
                    </button>

                    {/* 3. End Session or Delete Ended Room Button */}
                    {liveSession.status === 'ended' ? (
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(liveSession)}
                        disabled={isProcessingAction}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-rose-900/40 disabled:opacity-40"
                        title="Hapus room ini secara permanen dari sistem dan dashboard siswa"
                      >
                        <Trash2 className="w-4 h-4 text-amber-300" />
                        <span>Hapus Room Selesai</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEndSession}
                        disabled={isProcessingAction}
                        className="px-4 py-2.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Tutup sesi permainan ini"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Akhiri Sesi (End)</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Secret Timer Info Bar */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>Rentang Rahasia: <strong>{liveSession.minDurationSeconds || 60}s - {liveSession.maxDurationSeconds || 120}s</strong></span>
                <span className="text-slate-500">•</span>
                <span>Host Guru: <strong>{liveSession.teacherName || 'Guru'}</strong></span>
              </div>

              {liveSession.lastActionMessage && (
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>{liveSession.lastActionMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* --- LOBBY WAITING BANNER (DISPLAYED PROMINENTLY WHEN IN LOBBY) --- */}
          {liveSession.status === 'lobby' && (
            <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 rounded-3xl border-2 border-amber-400/40 text-white shadow-2xl text-center space-y-6 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto space-y-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30 tracking-wider uppercase inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Ruang Tunggu Kelas {liveSession.targetClass === 'ALL' ? 'Semua Kelas' : `Kelas ${liveSession.targetClass}`}
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Tampilkan Kode Token ke Layar Proyektor:
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  Siswa dapat langsung membuka aplikasi SIMPEL di HP, menekan tombol <strong className="text-amber-300">"🎮 Masuk Game Kelas"</strong>, dan mengetik kode token di bawah:
                </p>
              </div>

              {/* Giant Token Display */}
              <div className="relative z-10 inline-flex items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-950/90 text-white rounded-3xl shadow-2xl border-4 border-amber-400">
                <span className="font-mono text-4xl sm:text-6xl font-black tracking-widest text-amber-300 select-all">
                  {liveSession.roomToken}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyToken(liveSession.roomToken)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all cursor-pointer text-white flex items-center gap-1.5"
                  title="Salin Token"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-6 h-6 text-emerald-400" />
                      <span className="text-emerald-300 text-xs font-bold hidden sm:inline">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-6 h-6 text-slate-300" />
                      <span className="text-slate-300 text-xs font-bold hidden sm:inline">Salin</span>
                    </>
                  )}
                </button>
              </div>

              {/* Dynamic Big Classroom Start Area: Appears dynamically when alivePlayers.length > 0 */}
              <div className="relative z-10 flex flex-col items-center justify-center gap-3 pt-1">
                {alivePlayers.length > 0 ? (
                  <div className="space-y-3 animate-fadeIn flex flex-col items-center">
                    <button
                      type="button"
                      onClick={handleStartGame}
                      disabled={isProcessingAction}
                      className="px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-base sm:text-xl font-black rounded-2xl sm:rounded-3xl shadow-2xl shadow-rose-600/60 transition-all flex items-center gap-3 cursor-pointer scale-100 hover:scale-105 active:scale-95 animate-pulse"
                    >
                      <Flame className="w-7 h-7 text-amber-300 animate-bounce" />
                      <span>🔥 MULAI GAME SEKARANG ({alivePlayers.length} SISWA SIAP)</span>
                    </button>

                    <p className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {alivePlayers.length} siswa telah bergabung! Tekan tombol di atas untuk memulai permainan secara instan.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-400/30 rounded-2xl text-amber-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 max-w-lg mx-auto shadow-inner animate-pulse">
                    <Users className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Menunggu siswa memasukkan kode token. Tombol <strong>"Mulai Game"</strong> akan otomatis muncul begitu ada siswa yang bergabung!</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(liveSession)}
                    className="text-xs text-rose-300/80 hover:text-white underline font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Tutup & Hapus Ruang Permainan Ini</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- ENDED SESSION RECAP BANNER --- */}
          {liveSession.status === 'ended' && (
            <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border-2 border-emerald-500/40 text-white shadow-xl space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <Trophy className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-black text-white">Sesi Permainan Selesai</h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase">
                        Selesai / Non-Aktif
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Pemenang / Juara Bertahan: <strong className="text-amber-300 font-black">{liveSession.winnerName || 'Siswa'}</strong> • Sesi ini tidak lagi aktif di HP siswa.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(liveSession)}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-900/40"
                  >
                    <Trash2 className="w-4 h-4 text-amber-200" />
                    <span>Hapus Room dari Sistem</span>
                  </button>
                  {onOpenHostNewRoom && (
                    <button
                      type="button"
                      onClick={onOpenHostNewRoom}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-900/40"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Buat Room Baru</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- ACTIVE QUESTION CARD (IF IN PLAY) --- */}
          {liveSession.activeQuestion && liveSession.status !== 'ended' && (
            <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Pertanyaan Yang Sedang Muncul Di Layar Siswa:
                </span>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                  {liveSession.activeQuestion.category || 'Trivia'}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                "{liveSession.activeQuestion.questionText}"
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {liveSession.activeQuestion.options.map((opt, idx) => {
                  const teacherCorrectIdx = getCorrectAnswerIndexForTeacher(
                    liveSession.activeQuestion?.id,
                    liveSession.activeQuestion?.options
                  );
                  const isCorrectAnswer = idx === teacherCorrectIdx;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        isCorrectAnswer
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-black'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                      {isCorrectAnswer && (
                        <span className="text-[10px] uppercase font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Kunci Benar
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- PARTICIPANTS BREAKDOWN & SEARCH TOOLBAR --- */}
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama peserta permainan..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 shrink-0">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {alivePlayers.length} Bertahan (Survivors)
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                  {eliminatedPlayers.length} Gugur
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Survivors List Card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-sm font-black text-slate-900">
                      Siswa Yang Masih Bertahan ({filteredAlive.length})
                    </h4>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Aktif Bertanding
                  </span>
                </div>

                {filteredAlive.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                    Tidak ada siswa aktif yang cocok dengan pencarian.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto no-scrollbar p-0.5">
                    {filteredAlive.map((player) => {
                      const isHolding = player.id === liveSession.currentHolderId;
                      return (
                        <div
                          key={player.id}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                            isHolding
                              ? 'bg-rose-50 border-rose-400 text-rose-950 font-black ring-2 ring-rose-500/20'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 text-slate-700 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isHolding ? (
                              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Bomb className="w-4 h-4 text-amber-200 animate-bounce" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs truncate block">{player.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {player.kelas || liveSession.targetClass}
                              </span>
                            </div>
                          </div>

                          {/* Quick Handover Button if game is playing and not current holder */}
                          {liveSession.status === 'playing' && !isHolding && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await hostForcePassBomb(liveSession.id, player.id);
                                  showNotify?.('success', `Bom dioper ke ${player.name}!`);
                                } catch (err: any) {
                                  showNotify?.('error', err?.message || 'Gagal mengoper bom.');
                                }
                              }}
                              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all cursor-pointer shrink-0 shadow-2xs"
                              title={`Oper bom ke ${player.name}`}
                            >
                              <FastForward className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Eliminated Players List Card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Skull className="w-5 h-5 text-slate-400" />
                    <h4 className="text-sm font-black text-slate-900">
                      Siswa Gugur / Tereliminasi ({filteredEliminated.length})
                    </h4>
                  </div>
                  <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    Mode Penonton
                  </span>
                </div>

                {filteredEliminated.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                    Belum ada siswa yang gugur pada ronde ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto no-scrollbar p-0.5">
                    {filteredEliminated.map((player) => (
                      <div
                        key={player.id}
                        className="p-3 rounded-2xl border border-slate-200 bg-slate-100/70 text-slate-500 flex items-center gap-2.5"
                      >
                        <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                          <Skull className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold truncate block line-through">
                            {player.name}
                          </span>
                          <span className="text-[10px] font-bold text-rose-500 block truncate">
                            {player.eliminatedReason === 'wrong_answer'
                              ? '❌ Salah Menjawab'
                              : '💥 Terkena Ledakan'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- MANUAL HANDOVER MODAL --- */}
      {isHandoverModalOpen && liveSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FastForward className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-black text-slate-900">
                  Oper Bom Manual (Manual Handover)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsHandoverModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Gunakan fitur ini jika HP siswa yang sedang memegang bom mengalami kendala jaringan atau baterai habis. Bom akan dipindahkan ke siswa yang Anda pilih.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pilih Siswa Target:
              </label>
              <select
                value={selectedHandoverTargetId}
                onChange={(e) => setSelectedHandoverTargetId(e.target.value)}
                className="w-full py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">-- Pilih Siswa Acak (Random) --</option>
                {alivePlayers
                  .filter((p) => p.id !== liveSession.currentHolderId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.kelas || liveSession.targetClass})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsHandoverModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleManualHandover}
                disabled={isProcessingAction}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FastForward className="w-4 h-4" />
                <span>Pindahkan Bom Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Room Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        title="Tutup & Hapus Ruang Permainan"
        itemName={
          roomToDelete
            ? `Token ${roomToDelete.roomToken} (${roomToDelete.targetClass === 'ALL' ? 'Semua Kelas' : `Kelas ${roomToDelete.targetClass}`})`
            : 'Ruang Permainan'
        }
        itemType="Sesi Icebreaking"
        description="Ruangan ini akan langsung dihapus dari sistem dan ditutup untuk seluruh siswa. Sesi ini tidak akan lagi tampil di dashboard siswa."
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setRoomToDelete(null);
        }}
      />
    </div>
  );
};
