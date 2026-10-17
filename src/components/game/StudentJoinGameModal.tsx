import React, { useState, useEffect } from 'react';
import {
  Bomb,
  Flame,
  X,
  ArrowRight,
  Sparkles,
  Gamepad2,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { StudentAccount } from '../../types';
import { GameSession } from '../../types/game';
import { findRoomByToken, findActiveRoomForClass, joinGameSession } from '../../lib/gameService';
import { unlockAudioContext } from '../../utils/gameAudio';

interface StudentJoinGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentAccount;
  initialToken?: string;
  onJoined: (session: GameSession) => void;
}

export const StudentJoinGameModal: React.FC<StudentJoinGameModalProps> = ({
  isOpen,
  onClose,
  student,
  initialToken = '',
  onJoined,
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeClassRoom, setActiveClassRoom] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initialToken if provided
  useEffect(() => {
    if (initialToken) {
      setTokenInput(initialToken);
    }
  }, [initialToken]);

  // Check if teacher already has an active room for student's class
  useEffect(() => {
    if (!isOpen || !student.kelas) return;
    if (initialToken) return; // If token specifically requested, use that

    findActiveRoomForClass(student.kelas)
      .then((room) => {
        if (room && room.status !== 'ended') {
          setActiveClassRoom(room);
          setTokenInput(room.roomToken);
        }
      })
      .catch(() => {});
  }, [isOpen, student.kelas]);

  if (!isOpen) return null;

  const handleJoin = async (targetToken?: string) => {
    // Explicitly unlock and wake up Web Audio context on user gesture tap
    unlockAudioContext();

    const token = (targetToken || tokenInput).trim().toUpperCase();
    if (!token) {
      setErrorMsg('Silakan masukkan kode token room.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);

      // Find room
      const room = await findRoomByToken(token);
      if (!room) {
        setErrorMsg('Kode token tidak ditemukan atau ruang permainan sudah berakhir.');
        return;
      }

      if (room.status === 'ended') {
        setErrorMsg('Ruang permainan ini sudah berakhir.');
        return;
      }

      // Join room
      const result = await joinGameSession(room.id, {
        id: student.id,
        nama: student.nama,
        nisn: student.nisn,
        kelas: student.kelas,
      });

      if (!result.success || !result.session) {
        setErrorMsg(result.message || 'Gagal masuk ke room.');
        return;
      }

      onJoined(result.session);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat masuk ke room.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-900/50 shrink-0">
              <Bomb className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse text-amber-200" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-rose-500/30 text-rose-300 border border-rose-500/40 uppercase">
                Multiplayer Icebreaking
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Masuk Game Kelas
              </h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Active Class Room Shortcut (if teacher opened room for this class) */}
          {activeClassRoom && (
            <div className="p-4 bg-indigo-50/80 rounded-2xl border-2 border-indigo-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-indigo-700 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Room Aktif Untuk Kelasmu!
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Siap Dimainkan
                </span>
              </div>
              <p className="text-xs text-slate-700 font-semibold">
                Guru telah membuka ruang game untuk <strong>Kelas {activeClassRoom.targetClass}</strong> dengan token:
              </p>
              <button
                type="button"
                onClick={() => handleJoin(activeClassRoom.roomToken)}
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                <span>Masuk Sekarang (Token: {activeClassRoom.roomToken})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Manual Token Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Atau Masukkan Kode Token dari Guru:
            </label>
            <div className="relative">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value.toUpperCase());
                  setErrorMsg(null);
                }}
                placeholder="Contoh: BOMB-7A atau 5892"
                maxLength={10}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-base font-black text-slate-900 tracking-wider placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none focus:border-rose-500 focus:bg-white"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <Gamepad2 className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Join Button */}
          <button
            type="button"
            onClick={() => handleJoin()}
            disabled={isLoading || !tokenInput.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>{isLoading ? 'Memeriksa Token...' : 'Masuk ke Arena Permainan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
