export interface GamePlayer {
  id: string; // studentId
  name: string; // displayName
  displayName?: string; // alias
  studentId?: string; // alias
  nisn?: string;
  kelas?: string;
  avatarSeed?: string;
  isAlive: boolean;
  score?: number;
  eliminatedReason?: 'wrong_answer' | 'bombed' | null;
  eliminatedAt?: number | null;
  joinedAt: number;
  authUid?: string;
  updatedAt?: number;
}

export interface GameQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswerIndex?: number; // Kept private on server; scrubbed from public game_sessions document
  category?: string;
  explanation?: string;
}

export type GameStatus = 'lobby' | 'playing' | 'paused' | 'ended';

export interface GameTimerState {
  isActive: boolean;
  isPaused: boolean;
  remainingMs: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  isExpired: boolean;
  tensionPercentage: number; // 0% to 100% of time spent
}

export interface GameSession {
  id: string; // roomId (misal: "ROOM_8821")
  roomToken: string; // e.g. "8821" or "BOMB7A"
  teacherId: string;
  teacherName?: string;
  targetClass: string; // e.g. "7A" or "ALL"
  status: GameStatus;

  // Konfigurasi & State Timer Berbasis Timestamp Otoritatif
  minDurationSeconds: number; // default: 60
  maxDurationSeconds: number; // default: 120
  timerDurationSeconds?: number; // Total alokasi durasi ronde ini dalam detik (sama dengan secretExplodeSeconds)
  secretExplodeSeconds: number; // Nilai acak rahasia antara min & max (alias kompatibilitas)
  explodeAt?: number | null; // Timestamp absolut (Unix epoch ms) kapan bom dijadwalkan meledak
  timerStartedAt?: number | null; // Timestamp Unix ms saat segmen detak aktif dimulai
  timerPausedAt?: number | null; // Timestamp Unix ms saat waktu dijeda/dibekukan
  pausedAt?: number | null; // Alias kompatibilitas untuk timerPausedAt
  totalPausedDurationMs?: number; // Akumulasi total milidetik waktu yang dihabiskan dalam status jeda pada ronde ini
  elapsedSeconds?: number; // Akumulasi detik berjalan (turunan timestamp untuk backward compatibility)
  isTimerPaused: boolean; // TRUE saat jeda guru atau saat siswa membekukan waktu setelah jawab benar

  // Bomb State & Giliran
  currentHolderId: string | null;
  currentHolderName: string | null;
  activeQuestion: GameQuestion | null;
  questionCategory?: string;

  // Daftar Peserta
  players: Record<string, GamePlayer>;
  playerCount?: number;
  aliveCount?: number;

  // Pemenang & Ronde
  roundNumber?: number;
  winnerId?: string | null;
  winnerName?: string | null;
  lastActionMessage?: string; // e.g. "Ahmad melempar bom ke Siti!"
  
  // Paket Soal Ice Breaking Dinamis
  questionPackageId?: string;
  questionPackageTitle?: string;

  createdAt: number;
  updatedAt: number;
}

export interface IcebreakingQuestionItem {
  id: string;
  questionText: string;
  options: [string, string, string, string] | string[];
  correctAnswerIndex: number; // 0-3 (pilihan benar)
  explanation?: string;
}

export interface IcebreakingPackage {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: IcebreakingQuestionItem[];
  totalQuestions: number;
  createdBy: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
