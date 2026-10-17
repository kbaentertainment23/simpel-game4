import { FIREBASE_REST_CONFIG } from './firebaseConfig.ts';

export interface GamePlayer {
  id: string;
  name: string;
  displayName?: string;
  studentId?: string;
  nisn?: string;
  kelas?: string;
  avatarSeed?: string;
  status?: string;
  isAlive: boolean;
  score?: number;
  eliminatedReason?: 'wrong_answer' | 'bombed' | null;
  eliminatedAt?: number | null;
  joinedAt: number;
  authUid?: string;
  updatedAt?: number;
}

export interface ClientGameQuestion {
  id: string;
  questionText: string;
  options: string[];
  category?: string;
  explanation?: string;
}

export interface GameTimerState {
  isActive: boolean;
  isPaused: boolean;
  remainingMs: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  isExpired: boolean;
  tensionPercentage: number;
}

export interface GameSession {
  id: string;
  roomToken: string;
  teacherId: string;
  teacherName?: string;
  targetClass: string;
  status: 'lobby' | 'playing' | 'paused' | 'ended';

  // Server-Authoritative Timestamp Timer Model
  minDurationSeconds: number;
  maxDurationSeconds: number;
  timerDurationSeconds?: number; // Total seconds allocated for this round
  secretExplodeSeconds: number; // Backward-compatible alias
  explodeAt?: number | null; // Exact Unix timestamp (ms) when bomb will explode
  timerStartedAt?: number | null; // Timestamp (ms) when active tick segment started
  timerPausedAt?: number | null; // Timestamp (ms) when paused
  pausedAt?: number | null; // Backward-compatible alias
  totalPausedDurationMs?: number; // Total pause duration in ms during this round
  elapsedSeconds?: number; // Derived seconds for backward compatibility
  isTimerPaused: boolean;

  // Bomb State & Turn
  currentHolderId: string | null;
  currentHolderName: string | null;
  activeQuestion: ClientGameQuestion | null;
  questionCategory?: string;
  questionPackageId?: string | null;
  questionPackageTitle?: string | null;
  players: Record<string, GamePlayer>;
  playerCount?: number;
  aliveCount?: number;
  roundNumber?: number;
  winnerId?: string | null;
  winnerName?: string | null;
  lastActionMessage?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Pure mathematical calculation of bomb timer state based exclusively on server timestamps.
 * Client and server call this exact same function to maintain 100% time sync.
 */
export function getGameTimerState(
  session: GameSession | null | undefined,
  currentEpochMs: number = Date.now()
): GameTimerState {
  if (!session || session.status === 'lobby' || session.status === 'ended') {
    const totalSec = session?.timerDurationSeconds || session?.secretExplodeSeconds || 90;
    return {
      isActive: false,
      isPaused: false,
      remainingMs: totalSec * 1000,
      remainingSeconds: totalSec,
      elapsedSeconds: 0,
      totalDurationSeconds: totalSec,
      isExpired: false,
      tensionPercentage: 0,
    };
  }

  const totalDurationSec = session.timerDurationSeconds || session.secretExplodeSeconds || 90;
  const totalDurationMs = totalDurationSec * 1000;
  const isPaused = session.status === 'paused' || session.isTimerPaused;

  // Derive explodeAt if missing (fallback for older sessions)
  let explodeAt = session.explodeAt;
  if (!explodeAt) {
    const start = session.timerStartedAt || session.createdAt || currentEpochMs;
    explodeAt = start + totalDurationMs;
  }

  // When paused, freeze effective time at timerPausedAt
  const effectiveTime =
    isPaused && (session.timerPausedAt || session.pausedAt)
      ? session.timerPausedAt || session.pausedAt || currentEpochMs
      : currentEpochMs;

  const remainingMs = Math.max(0, explodeAt - effectiveTime);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const elapsedMs = Math.max(0, totalDurationMs - remainingMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const isExpired = remainingMs <= 0 && session.status === 'playing' && !isPaused;
  const tensionPercentage = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));

  return {
    isActive: session.status === 'playing',
    isPaused,
    remainingMs,
    remainingSeconds,
    elapsedSeconds,
    totalDurationSeconds: totalDurationSec,
    isExpired,
    tensionPercentage,
  };
}

/**
 * Helper to compute randomized duration and initial timestamps for a new round
 */
export function calculateNewRoundTimer(minDurationSeconds: number = 60, maxDurationSeconds: number = 120) {
  const minSec = Math.max(30, minDurationSeconds);
  const maxSec = Math.max(minSec + 10, maxDurationSeconds);
  const durationSec = Math.floor(minSec + Math.random() * (maxSec - minSec + 1));
  const now = Date.now();
  const explodeAt = now + durationSec * 1000;

  return {
    timerDurationSeconds: durationSec,
    secretExplodeSeconds: durationSec,
    explodeAt,
    timerStartedAt: now,
    timerPausedAt: null,
    pausedAt: null,
    totalPausedDurationMs: 0,
    elapsedSeconds: 0,
    isTimerPaused: false,
  };
}

/**
 * Authoritative Server Master Question Bank.
 * The correct answer text is exclusively known here on the server.
 * correctAnswerIndex is NEVER sent to Firestore or client documents!
 */
export const MASTER_QUESTIONS: Array<{
  id: string;
  questionText: string;
  options: string[];
  correctText: string;
  category: string;
}> = [
  { id: 'ib_q_1', questionText: 'Hewan mamalia darat apa yang secara anatomi tubuhnya TIDAK BISA melompat?', options: ['Gajah', 'Kuda Nil', 'Badak', 'Unta'], correctText: 'Gajah', category: 'Trivia Hewan & Alam' },
  { id: 'ib_q_2', questionText: 'Buah apa yang bijinya berada di bagian luar kulitnya, bukan di dalam daging buahnya?', options: ['Stroberi', 'Kiwi', 'Alpukat', 'Pepaya'], correctText: 'Stroberi', category: 'Trivia Makanan & Buah' },
  { id: 'ib_q_3', questionText: 'Warna apa yang dihasilkan jika kita mencampurkan cat warna BIRU dan KUNING secara merata?', options: ['Hijau', 'Ungu', 'Oranye', 'Cokelat'], correctText: 'Hijau', category: 'Logika Warna' },
  { id: 'ib_q_4', questionText: 'Berapa banyak kaki yang dimiliki oleh seekor laba-laba normal?', options: ['8 kaki', '6 kaki', '10 kaki', '12 kaki'], correctText: '8 kaki', category: 'Trivia Hewan & Alam' },
  { id: 'ib_q_5', questionText: 'Planet apa di Tata Surya yang jarak orbitnya paling dekat dengan Matahari?', options: ['Merkurius', 'Venus', 'Mars', 'Bumi'], correctText: 'Merkurius', category: 'Sains & Luar Angkasa' },
  { id: 'ib_q_6', questionText: 'Makanan khas Indonesia yang dinobatkan sebagai salah satu makanan terlezat di dunia asal Sumatera Barat adalah...', options: ['Rendang', 'Pempek', 'Gudeg', 'Rawon'], correctText: 'Rendang', category: 'Kuliner Nusantara' },
  { id: 'ib_q_7', questionText: 'Benda apa yang selalu naik tetapi tidak pernah bisa turun kembali?', options: ['Usia / Umur', 'Balon Gas', 'Layang-layang', 'Asap'], correctText: 'Usia / Umur', category: 'Teka-teki Logika Santai' },
  { id: 'ib_q_8', questionText: 'Di laut, mamalia terbesar di dunia yang bernapas menggunakan paru-paru adalah...', options: ['Paus Biru', 'Hiu Megalodon', 'Orca (Paus Pembunuh)', 'Ikan Pari Manta'], correctText: 'Paus Biru', category: 'Trivia Hewan & Alam' },
  { id: 'ib_q_9', questionText: 'Huruf apa yang menjadi huruf keempat dalam kata "INDONESIA"?', options: ['O', 'D', 'N', 'E'], correctText: 'O', category: 'Fokus & Ketelitian Cepat' },
  { id: 'ib_q_10', questionText: 'Berapa hasil dari 5 dikali 5 ditambah 5?', options: ['30', '50', '25', '35'], correctText: '30', category: 'Hitung Kilat' },
  { id: 'ib_q_11', questionText: 'Hewan berkantung khas Australia yang suka melompat dan menggendong anaknya adalah...', options: ['Kanguru', 'Koala', 'Platipus', 'Wombat'], correctText: 'Kanguru', category: 'Trivia Hewan & Alam' },
  { id: 'ib_q_12', questionText: 'Alat musik tradisional asal Jawa Barat yang dimainkan dengan cara digoyangkan adalah...', options: ['Angklung', 'Gamelan', 'Sasando', 'Kolintang'], correctText: 'Angklung', category: 'Budaya & Seni' },
  { id: 'ib_q_13', questionText: 'Mata uang resmi yang digunakan di negara Jepang adalah...', options: ['Yen', 'Won', 'Ringgit', 'Dollar'], correctText: 'Yen', category: 'Pengetahuan Umum' },
  { id: 'ib_q_14', questionText: 'Jika kemarin lusa adalah hari Selasa, maka hari ini adalah hari apa?', options: ['Kamis', 'Rabu', 'Jumat', 'Sabtu'], correctText: 'Kamis', category: 'Logika Waktu' },
  { id: 'ib_q_15', questionText: 'Bagian tubuh manusia manakah yang memiliki sidik unik dan berbeda pada setiap orang di dunia?', options: ['Jari Tangan', 'Kuku', 'Rambut', 'Gigi'], correctText: 'Jari Tangan', category: 'Biologi Seru' },
  { id: 'ib_q_16', questionText: 'Gunung tertinggi di dunia yang puncaknya terletak di perbatasan Nepal dan Tibet adalah...', options: ['Gunung Everest', 'Gunung Kilimanjaro', 'Gunung Fuji', 'Gunung Bromo'], correctText: 'Gunung Everest', category: 'Geografi Dunia' },
  { id: 'ib_q_17', questionText: 'Dalam cerita dongeng anak-anak, tokoh putri yang kehilangan sepatu kacanya saat pesta dansa adalah...', options: ['Cinderella', 'Putri Salju', 'Rapunzel', 'Ariel'], correctText: 'Cinderella', category: 'Cerita & Dongeng Populer' },
  { id: 'ib_q_18', questionText: 'Sebuah segitiga memiliki berapa jumlah sudut di dalamnya?', options: ['3 sudut', '4 sudut', '5 sudut', '2 sudut'], correctText: '3 sudut', category: 'Geometri Cepat' },
  { id: 'ib_q_19', questionText: 'Ikan bernapas di dalam air menggunakan organ tubuh bernama...', options: ['Insang', 'Paru-paru', 'Trakea', 'Kulit'], correctText: 'Insang', category: 'Trivia Hewan & Alam' },
  { id: 'ib_q_20', questionText: 'Pulau di Indonesia yang terkenal sebagai habitat alami kadal raksasa purba Komodo adalah...', options: ['Pulau Komodo (NTT)', 'Pulau Bali', 'Pulau Lombok', 'Pulau Madura'], correctText: 'Pulau Komodo (NTT)', category: 'Geografi Nusantara' },
  { id: 'ib_q_21', questionText: 'Berapa jumlah warna utama pada pelangi yang biasa kita nyanyikan (Me-Ji-Ku-Hi-Bi-Ni-U)?', options: ['7 warna', '5 warna', '6 warna', '8 warna'], correctText: '7 warna', category: 'Pengetahuan Umum' },
  { id: 'ib_q_22', questionText: 'Burung yang tidak bisa terbang tetapi merupakan perenang handal dan hidup di daerah es dingin adalah...', options: ['Penguin', 'Burung Unta', 'Bebek', 'Flamingo'], correctText: 'Penguin', category: 'Trivia Hewan & Alam' },
  { id: 'ib_q_23', questionText: 'Lagu kebangsaan negara Republik Indonesia adalah...', options: ['Indonesia Raya', 'Bagimu Negeri', 'Garuda Pancasila', 'Halo-Halo Bandung'], correctText: 'Indonesia Raya', category: 'Wawasan Kebangsaan' },
  { id: 'ib_q_24', questionText: 'Logam mulia yang berwarna kuning berkilau dan biasa dijadikan perhiasan atau investasi adalah...', options: ['Emas', 'Perak', 'Tembaga', 'Besi'], correctText: 'Emas', category: 'Benda & Materi' },
  { id: 'ib_q_25', questionText: 'Di komputer atau laptop, alat penunjuk berbentuk panah di layar yang digerakkan tangan disebut...', options: ['Kursor / Mouse', 'Monitor', 'Keyboard', 'Speaker'], correctText: 'Kursor / Mouse', category: 'Teknologi Santai' },
  { id: 'ib_q_26', questionText: 'Benda apa yang punya leher tapi tidak punya kepala?', options: ['Botol', 'Baju', 'Pena', 'Cangkir'], correctText: 'Botol', category: 'Teka-teki Logika Santai' },
  { id: 'ib_q_27', questionText: 'Berapa menit dalam 1 jam?', options: ['60 menit', '100 menit', '50 menit', '30 menit'], correctText: '60 menit', category: 'Hitung Kilat' },
  { id: 'ib_q_28', questionText: 'Hewan apa yang dijuluki sebagai "Raja Hutan"?', options: ['Singa', 'Harimau', 'Gajah', 'Serigala'], correctText: 'Singa', category: 'Trivia Hewan & Alam' },
  { id: 'ib_q_29', questionText: 'Ibukota negara Indonesia yang berada di Pulau Jawa adalah...', options: ['Jakarta', 'Surabaya', 'Bandung', 'Medan'], correctText: 'Jakarta', category: 'Geografi Nusantara' },
  { id: 'ib_q_30', questionText: 'Pohon apa yang daunnya biasa dipakai untuk membungkus ketupat saat hari raya?', options: ['Pohon Kelapa (Janur)', 'Pohon Pisang', 'Pohon Bambu', 'Pohon Mangga'], correctText: 'Pohon Kelapa (Janur)', category: 'Tradisi & Alam' },
  { id: 'ib_q_31', questionText: 'Bulan ke-8 dalam penanggalan masehi adalah bulan apa?', options: ['Agustus', 'Juli', 'September', 'Oktober'], correctText: 'Agustus', category: 'Logika Waktu' },
  { id: 'ib_q_32', questionText: 'Berapa jumlah sisi yang dimiliki oleh sebuah dadu standar?', options: ['6 sisi', '4 sisi', '8 sisi', '12 sisi'], correctText: '6 sisi', category: 'Benda Sehari-hari' },
  { id: 'ib_q_33', questionText: 'Alat untuk melihat benda-benda renik atau sangat kecil seperti bakteri adalah...', options: ['Mikroskop', 'Teleskop', 'Periskop', 'Stetoskop'], correctText: 'Mikroskop', category: 'Sains & Alat' },
  { id: 'ib_q_34', questionText: 'Air mendidih pada suhu normal mencapai berapa derajat Celsius?', options: ['100°C', '50°C', '80°C', '120°C'], correctText: '100°C', category: 'Sains Sederhana' },
  { id: 'ib_q_35', questionText: 'Jika kamu memotong sebuah tali menjadi 3 bagian, berapa kali kamu harus mengguntingnya?', options: ['2 kali', '3 kali', '1 kali', '4 kali'], correctText: '2 kali', category: 'Teka-teki Logika Santai' },
  { id: 'ib_q_36', questionText: 'Sayuran berwarna oranye yang sangat disukai oleh kelinci dan kaya vitamin A adalah...', options: ['Wortel', 'Tomat', 'Jagung', 'Labu'], correctText: 'Wortel', category: 'Trivia Makanan & Sayuran' },
  { id: 'ib_q_37', questionText: 'Negara Menara Pisa yang miring dan terkenal dengan masakan Pizza serta Spaghetti adalah...', options: ['Italia', 'Prancis', 'Spanyol', 'Jerman'], correctText: 'Italia', category: 'Dunia & Kuliner' },
  { id: 'ib_q_38', questionText: 'Apa warna bendera kebangsaan Indonesia pada bagian atasnya?', options: ['Merah', 'Putih', 'Biru', 'Kuning'], correctText: 'Merah', category: 'Wawasan Kebangsaan' },
  { id: 'ib_q_39', questionText: 'Hewan pemakan daging disebut karnivora, sedangkan hewan pemakan tumbuhan disebut...', options: ['Herbivora', 'Omnivora', 'Insektivora', 'Mamalia'], correctText: 'Herbivora', category: 'Biologi Seru' },
  { id: 'ib_q_40', questionText: 'Lampu lalu lintas: Lampu berwarna KUNING menandakan bahwa pengendara harus...', options: ['Hati-hati / Siap-siap', 'Berhenti', 'Maju Cepat', 'Belok Kiri'], correctText: 'Hati-hati / Siap-siap', category: 'Aturan Lalu Lintas' },
];

export interface ServerQuestionItem {
  id: string;
  questionText: string;
  options: string[];
  correctText: string;
  category?: string;
}

// In-memory cache for package questions to prevent redundant REST calls on every answer
const serverPackageQuestionsCache = new Map<string, ServerQuestionItem[]>();

export async function fetchServerPackageQuestions(packageId?: string | null): Promise<ServerQuestionItem[]> {
  if (!packageId) return [];
  const cleanPkgId = packageId.trim();
  if (serverPackageQuestionsCache.has(cleanPkgId)) {
    const cached = serverPackageQuestionsCache.get(cleanPkgId)!;
    if (cached.length > 0) return cached;
  }
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_REST_CONFIG.projectId
    )}/databases/${encodeURIComponent(
      FIREBASE_REST_CONFIG.databaseId
    )}/documents/icebreaking_packages/${encodeURIComponent(cleanPkgId)}?key=${encodeURIComponent(
      FIREBASE_REST_CONFIG.apiKey
    )}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    if (!json || !json.fields) return [];
    const parsed = parseFirestoreFields(json.fields, cleanPkgId) as any;
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const items: ServerQuestionItem[] = parsed.questions.map((q: any, idx: number) => {
        const qOptions = Array.isArray(q.options) ? q.options : [];
        const correctIdx =
          typeof q.correctAnswerIndex === 'number' &&
          q.correctAnswerIndex >= 0 &&
          q.correctAnswerIndex < qOptions.length
            ? q.correctAnswerIndex
            : 0;
        const correctText = qOptions[correctIdx] || qOptions[0] || '';
        return {
          id: q.id || `pkg_q_${idx}`,
          questionText: q.questionText || '',
          options: qOptions,
          correctText,
          category: parsed.category || 'Trivia Paket',
        };
      });
      serverPackageQuestionsCache.set(cleanPkgId, items);
      return items;
    }
  } catch (err) {
    console.warn('Notice fetching package questions in server:', err);
  }
  return [];
}

/**
 * Pick and randomize question options without leaking the correctAnswerIndex
 */
export function pickRandomScrubbedQuestion(
  excludeIds: string[] = [],
  customPool?: ServerQuestionItem[]
): ClientGameQuestion {
  const activePool = customPool && customPool.length > 0 ? customPool : MASTER_QUESTIONS;
  const pool = activePool.filter((q) => !excludeIds.includes(q.id));
  const selected = pool.length > 0
    ? pool[Math.floor(Math.random() * pool.length)]
    : activePool[Math.floor(Math.random() * activePool.length)];

  const shuffledOptions = [...selected.options].sort(() => Math.random() - 0.5);

  return {
    id: selected.id,
    questionText: selected.questionText,
    options: shuffledOptions,
    category: selected.category,
  };
}

/**
 * Helper to fetch subcollection players via Google Cloud Firestore REST API.
 * Uses pageSize=300 and pagination to safely fetch classes with >30 up to 300+ students.
 */
export async function fetchServerGamePlayers(roomId: string): Promise<Record<string, GamePlayer>> {
  const cleanId = roomId.trim();
  const players: Record<string, GamePlayer> = {};

  try {
    let pageToken: string | undefined = undefined;

    do {
      let url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        FIREBASE_REST_CONFIG.projectId
      )}/databases/${encodeURIComponent(
        FIREBASE_REST_CONFIG.databaseId
      )}/documents/game_sessions/${encodeURIComponent(cleanId)}/players?pageSize=300&key=${encodeURIComponent(
        FIREBASE_REST_CONFIG.apiKey
      )}`;

      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url);
      if (!res.ok) break;
      const json = await res.json().catch(() => null);
      if (!json || !Array.isArray(json.documents)) break;

      for (const doc of json.documents) {
        if (!doc || !doc.fields) continue;
        const parts = (doc.name || '').split('/');
        const playerId = parts[parts.length - 1];
        if (!playerId) continue;

        const parsed = parseFirestoreFields(doc.fields, playerId) as any;
        players[playerId] = {
          id: playerId,
          studentId: playerId,
          name: parsed.name || parsed.displayName || 'Siswa',
          displayName: parsed.displayName || parsed.name || 'Siswa',
          nisn: parsed.nisn || '',
          kelas: parsed.kelas || '',
          isAlive: parsed.isAlive !== false,
          score: typeof parsed.score === 'number' ? parsed.score : 0,
          eliminatedReason: parsed.eliminatedReason || null,
          eliminatedAt: parsed.eliminatedAt || null,
          joinedAt: parsed.joinedAt || Date.now(),
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }

      pageToken = json.nextPageToken;
    } while (pageToken);

    return players;
  } catch (err) {
    console.warn('Notice fetching server game players subcollection:', err);
    return players;
  }
}

/**
 * Helper to patch a subcollection player doc via Google Cloud Firestore REST API
 */
export async function patchServerPlayerDoc(
  roomId: string,
  playerId: string,
  updates: Record<string, any>
): Promise<void> {
  const cleanRoomId = roomId.trim();
  const cleanPlayerId = playerId.trim();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const maskParams = keys.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_REST_CONFIG.projectId
  )}/databases/${encodeURIComponent(
    FIREBASE_REST_CONFIG.databaseId
  )}/documents/game_sessions/${encodeURIComponent(cleanRoomId)}/players/${encodeURIComponent(
    cleanPlayerId
  )}?${maskParams}&key=${encodeURIComponent(FIREBASE_REST_CONFIG.apiKey)}`;

  try {
    const fields = serializeToFirestoreFields(updates);
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.warn('Notice patching server player doc:', err);
  }
}

/**
 * Server-authoritative data fetcher with updateTime metadata for Firestore REST optimistic concurrency control
 */
export interface ServerGameSessionWithMeta {
  session: GameSession;
  updateTime: string;
}

export async function fetchServerGameSessionWithMeta(roomId: string): Promise<ServerGameSessionWithMeta | null> {
  const cleanId = roomId.trim();
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_REST_CONFIG.projectId
  )}/databases/${encodeURIComponent(
    FIREBASE_REST_CONFIG.databaseId
  )}/documents/game_sessions/${encodeURIComponent(cleanId)}?key=${encodeURIComponent(
    FIREBASE_REST_CONFIG.apiKey
  )}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || !json.fields) return null;

  const session = parseFirestoreFields(json.fields, cleanId);

  // If players object in root document is missing or empty, fetch from subcollection
  if (!session.players || Object.keys(session.players).length === 0) {
    const subPlayers = await fetchServerGamePlayers(cleanId);
    if (Object.keys(subPlayers).length > 0) {
      session.players = subPlayers;
    }
  }

  return {
    session,
    updateTime: json.updateTime || '',
  };
}

/**
 * Helper to fetch a Firestore game session via Google Cloud REST API
 */
export async function fetchServerGameSession(roomId: string): Promise<GameSession | null> {
  const meta = await fetchServerGameSessionWithMeta(roomId);
  return meta ? meta.session : null;
}

/**
 * Helper to patch a Firestore game session with optional precondition check on updateTime
 */
export async function patchServerGameSession(
  roomId: string,
  updatedSession: Partial<GameSession>,
  fieldMask: string[],
  expectedUpdateTime?: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  const cleanId = roomId.trim();
  const maskParams = fieldMask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  let url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_REST_CONFIG.projectId
  )}/databases/${encodeURIComponent(
    FIREBASE_REST_CONFIG.databaseId
  )}/documents/game_sessions/${encodeURIComponent(cleanId)}?${maskParams}&key=${encodeURIComponent(
    FIREBASE_REST_CONFIG.apiKey
  )}`;

  if (expectedUpdateTime) {
    url += `&currentDocument.updateTime=${encodeURIComponent(expectedUpdateTime)}`;
  }

  const fields = serializeToFirestoreFields(updatedSession);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    return {
      ok: false,
      status: res.status,
      error: errorJson?.error?.message || `HTTP ${res.status}`,
    };
  }

  return { ok: true, status: 200 };
}

/**
 * Optimistic Concurrency Control Transaction Runner for Firestore REST.
 * Fetches the document with updateTime, executes the mutation function, and commits
 * with currentDocument.updateTime precondition. If another concurrent request modified
 * the document, it retries automatically with fresh state up to maxRetries.
 */
export interface ServerTransactionResult<T> {
  abort?: boolean;
  updates?: Partial<GameSession>;
  fieldMask?: string[];
  payload: T;
}

export async function runServerGameTransaction<T>(
  roomId: string,
  txFn: (session: GameSession) => Promise<ServerTransactionResult<T>> | ServerTransactionResult<T>,
  maxRetries: number = 3
): Promise<T> {
  const cleanId = roomId.trim();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const meta = await fetchServerGameSessionWithMeta(cleanId);
    if (!meta || !meta.session) {
      throw new Error('Sesi permainan tidak ditemukan.');
    }

    const txRes = await txFn(meta.session);

    // If transaction decided to abort without writing
    if (txRes.abort || !txRes.updates || !txRes.fieldMask || txRes.fieldMask.length === 0) {
      return txRes.payload;
    }

    // Try patch with optimistic concurrency control precondition
    const patchRes = await patchServerGameSession(
      cleanId,
      txRes.updates,
      txRes.fieldMask,
      meta.updateTime
    );

    if (patchRes.ok) {
      return txRes.payload;
    }

    // If precondition conflict (another client wrote in between)
    if (patchRes.status === 400 || patchRes.status === 409 || patchRes.status === 412) {
      await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));
      continue;
    }

    // Any other error
    console.warn(`[ServerTransaction] Unexpected error on attempt ${attempt + 1}:`, patchRes.error);
    break;
  }

  throw new Error('Gagal memperbarui status game karena konflik pembaruan bersamaan.');
}

export interface ServerExplosionResult {
  ok: boolean;
  isExpired: boolean;
  gameOver?: boolean;
  winnerName?: string | null;
  message?: string;
  remainingMs?: number;
}

/**
 * Authoritative Server Bomb Explosion Handler & Timer Verifier (Atomic Transaction)
 * Checks if now >= explodeAt. If expired, performs authoritative explosion.
 * If NOT expired, rejects explosion to prevent client spoofing.
 * Prevents multiple devices from triggering duplicate explosions.
 */
export async function checkAndProcessServerExplosion(params: {
  roomId: string;
  callerHolderId?: string;
  forceExplode?: boolean;
  isAdminOrTeacher?: boolean;
}): Promise<ServerExplosionResult> {
  const { roomId, callerHolderId, forceExplode = false, isAdminOrTeacher = false } = params;
  // Security Enforcement: forceExplode can ONLY be exercised by verified admin or teacher
  const effectiveForceExplode = Boolean(forceExplode && isAdminOrTeacher);

  try {
    return await runServerGameTransaction<ServerExplosionResult>(roomId, async (session) => {
      if (session.status !== 'playing') {
        return {
          abort: true,
          payload: { ok: false, isExpired: false, message: 'Permainan sedang tidak aktif.' },
        };
      }

      // Timer must not be paused
      if (session.isTimerPaused && !effectiveForceExplode) {
        return {
          abort: true,
          payload: { ok: false, isExpired: false, message: 'Waktu sedang dijeda.' },
        };
      }

      const holderId = session.currentHolderId;
      if (!holderId) {
        return {
          abort: true,
          payload: { ok: false, isExpired: false, message: 'Tidak ada pemegang bom saat ini.' },
        };
      }

      // If callerHolderId provided, verify match (prevent stale device explosion)
      if (callerHolderId && callerHolderId !== holderId && !effectiveForceExplode) {
        return {
          abort: true,
          payload: { ok: false, isExpired: false, message: 'Pemegang bom saat ini telah berpindah.' },
        };
      }

      // Check if holder is already eliminated
      if (!session.players[holderId]?.isAlive) {
        return {
          abort: true,
          payload: { ok: false, isExpired: false, message: 'Pemegang bom sudah gugur sebelumnya.' },
        };
      }

      const now = Date.now();
      const timerState = getGameTimerState(session, now);

      // CRITICAL AUTHORITATIVE CHECK: Bomb only explodes if now >= explodeAt (or authorized forceExplode)
      if (!timerState.isExpired && !effectiveForceExplode) {
        return {
          abort: true,
          payload: {
            ok: false,
            isExpired: false,
            remainingMs: timerState.remainingMs,
            message: `Waktu bom belum habis (${timerState.remainingSeconds} detik tersisa). Ledakan ditolak.`,
          },
        };
      }

      // --- TIME EXPIRED -> EXECUTE EXPLOSION ON SERVER ATOMICALLY ---
      const updatedPlayers = { ...session.players };
      if (updatedPlayers[holderId]) {
        updatedPlayers[holderId] = {
          ...updatedPlayers[holderId],
          isAlive: false,
          eliminatedReason: 'bombed',
          eliminatedAt: now,
        };
      }

      const alivePlayers = Object.values(updatedPlayers).filter((p) => p && p.isAlive);
      const explodedName = session.players[holderId]?.name || 'Pemain';

      // Asynchronously sync player subcollection doc
      patchServerPlayerDoc(roomId, holderId, {
        isAlive: false,
        status: 'eliminated',
        eliminatedReason: 'bombed',
        eliminatedAt: now,
        updatedAt: now,
      }).catch(() => {});

      if (alivePlayers.length <= 1) {
        // Only 1 survivor left -> End game and crown winner
        const winner = alivePlayers[0] || null;
        return {
          updates: {
            players: updatedPlayers,
            playerCount: Object.keys(updatedPlayers).length,
            aliveCount: alivePlayers.length,
            status: 'ended',
            winnerId: winner?.id || null,
            winnerName: winner?.name || null,
            currentHolderId: null,
            currentHolderName: null,
            activeQuestion: null,
            isTimerPaused: false,
            lastActionMessage: `💥 BOOOOOMM!! Waktu habis, bom meledak di tangan ${explodedName}! Juara bertahan: ${
              winner?.name || 'Tidak ada'
            }!`,
            updatedAt: now,
          },
          fieldMask: [
            'players',
            'playerCount',
            'aliveCount',
            'status',
            'winnerId',
            'winnerName',
            'currentHolderId',
            'currentHolderName',
            'activeQuestion',
            'isTimerPaused',
            'lastActionMessage',
            'updatedAt',
          ],
          payload: { ok: true, isExpired: true, gameOver: true, winnerName: winner?.name || null },
        };
      }

      // >= 2 survivors remain -> Start next round with new secret explodeAt timestamp
      const roundTimer = calculateNewRoundTimer(session.minDurationSeconds, session.maxDurationSeconds);
      const nextHolder = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const packageQuestions = session.questionPackageId
        ? await fetchServerPackageQuestions(session.questionPackageId)
        : [];
      const nextQuestion = pickRandomScrubbedQuestion([session.activeQuestion?.id || ''], packageQuestions);

      return {
        updates: {
          players: updatedPlayers,
          playerCount: Object.keys(updatedPlayers).length,
          aliveCount: alivePlayers.length,
          roundNumber: (session.roundNumber || 1) + 1,
          timerDurationSeconds: roundTimer.timerDurationSeconds,
          secretExplodeSeconds: roundTimer.secretExplodeSeconds,
          explodeAt: roundTimer.explodeAt,
          timerStartedAt: roundTimer.timerStartedAt,
          timerPausedAt: null,
          pausedAt: null,
          totalPausedDurationMs: 0,
          elapsedSeconds: 0,
          isTimerPaused: false,
          currentHolderId: nextHolder.id,
          currentHolderName: nextHolder.name,
          activeQuestion: nextQuestion,
          lastActionMessage: `💥 BOOOOOMM!! Waktu habis, bom meledak di tangan ${explodedName}! Ronde baru dimulai, bom berada di tangan ${nextHolder.name}!`,
          updatedAt: now,
        },
        fieldMask: [
          'players',
          'playerCount',
          'aliveCount',
          'roundNumber',
          'timerDurationSeconds',
          'secretExplodeSeconds',
          'explodeAt',
          'timerStartedAt',
          'timerPausedAt',
          'pausedAt',
          'totalPausedDurationMs',
          'elapsedSeconds',
          'isTimerPaused',
          'currentHolderId',
          'currentHolderName',
          'activeQuestion',
          'lastActionMessage',
          'updatedAt',
        ],
        payload: { ok: true, isExpired: true, gameOver: false },
      };
    });
  } catch (err: any) {
    return {
      ok: false,
      isExpired: false,
      message: err?.message || 'Gagal memproses ledakan bom secara aman.',
    };
  }
}

export interface ServerAnswerResult {
  ok: boolean;
  isCorrect: boolean;
  eliminated?: boolean;
  gameOver?: boolean;
  newHolderId?: string;
  winnerName?: string | null;
  message?: string;
}

/**
 * Server-authoritative answer validation (Atomic Transaction)
 * Client ONLY supplies: roomId, studentId, selectedAnswerIndex, and optional questionId.
 * Validates turn, active question, and expiration atomically with OCC before committing.
 */
export async function validateAndProcessAnswer(params: {
  roomId: string;
  studentId: string;
  selectedAnswerIndex: number;
  questionId?: string;
  authUid?: string;
}): Promise<ServerAnswerResult> {
  const { roomId, studentId, selectedAnswerIndex, questionId, authUid } = params;

  try {
    return await runServerGameTransaction<ServerAnswerResult>(roomId, async (session) => {
      if (session.status !== 'playing') {
        return {
          abort: true,
          payload: { ok: false, isCorrect: false, message: 'Permainan sedang tidak aktif.' },
        };
      }

      // Security Check 1: Player must be registered in the session
      const player = session.players[studentId];
      if (!player) {
        return {
          abort: true,
          payload: {
            ok: false,
            isCorrect: false,
            message: 'Pemain tidak terdaftar dalam sesi room ini.',
          },
        };
      }

      // Security Check 2: Class scope authorization
      if (session.targetClass && session.targetClass !== 'ALL' && player.kelas) {
        if (player.kelas.toLowerCase() !== session.targetClass.toLowerCase()) {
          return {
            abort: true,
            payload: {
              ok: false,
              isCorrect: false,
              message: `Pemain dari kelas ${player.kelas} tidak diizinkan di ruang ${session.targetClass}.`,
            },
          };
        }
      }

      // Security Check 3: Firebase Auth UID token binding check
      if (authUid && player.authUid && player.authUid !== authUid) {
        return {
          abort: true,
          payload: {
            ok: false,
            isCorrect: false,
            message: 'Identitas autentikasi tidak sesuai dengan profil pemain di room.',
          },
        };
      }

      // Security Check 4: Must be current bomb holder
      if (session.currentHolderId !== studentId) {
        return {
          abort: true,
          payload: {
            ok: false,
            isCorrect: false,
            message: 'Anda bukan pemegang bom saat ini. Hanya pemegang bom yang dapat menjawab.',
          },
        };
      }

      // Security Check 5: Player must be alive
      if (!player.isAlive) {
        return {
          abort: true,
          payload: {
            ok: false,
            isCorrect: false,
            message: 'Pemain sudah gugur.',
          },
        };
      }

      // Security Check 6: Timer must not already be paused
      if (session.isTimerPaused) {
        return {
          abort: true,
          payload: {
            ok: false,
            isCorrect: false,
            message: 'Jawaban sedang menunggu lemparan bom ke teman berikutnya.',
          },
        };
      }

      // Security Check 4: Question validation (prevent answering stale questions)
      if (questionId && session.activeQuestion?.id && session.activeQuestion.id !== questionId) {
        return {
          abort: true,
          payload: {
            ok: false,
            isCorrect: false,
            message: 'Soal telah berganti.',
          },
        };
      }

      const now = Date.now();
      const timerState = getGameTimerState(session, now);
      const packageQuestions = session.questionPackageId
        ? await fetchServerPackageQuestions(session.questionPackageId)
        : [];

      // Security Check 5: Did time already expire before answer was submitted?
      if (timerState.isExpired) {
        // Bomb already exploded! Handle explosion atomically right here
        const updatedPlayers = { ...session.players };
        if (updatedPlayers[studentId]) {
          updatedPlayers[studentId] = {
            ...updatedPlayers[studentId],
            isAlive: false,
            eliminatedReason: 'bombed',
            eliminatedAt: now,
          };
        }

        const alivePlayers = Object.values(updatedPlayers).filter((p) => p && p.isAlive);
        const studentName = session.players[studentId]?.name || 'Siswa';

        if (alivePlayers.length <= 1) {
          const winner = alivePlayers[0] || null;
          return {
            updates: {
              players: updatedPlayers,
              status: 'ended',
              winnerId: winner?.id || null,
              winnerName: winner?.name || null,
              currentHolderId: null,
              currentHolderName: null,
              activeQuestion: null,
              isTimerPaused: false,
              lastActionMessage: `💥 BOOOOOMM!! Waktu habis saat menjawab, bom meledak di tangan ${studentName}! Juara: ${
                winner?.name || 'Tidak ada'
              }!`,
              updatedAt: now,
            },
            fieldMask: [
              'players',
              'status',
              'winnerId',
              'winnerName',
              'currentHolderId',
              'currentHolderName',
              'activeQuestion',
              'isTimerPaused',
              'lastActionMessage',
              'updatedAt',
            ],
            payload: {
              ok: false,
              isCorrect: false,
              eliminated: true,
              gameOver: true,
              winnerName: winner?.name || null,
              message: 'Waktu habis! Bom meledak sebelum jawaban terkirim.',
            },
          };
        }

        const roundTimer = calculateNewRoundTimer(session.minDurationSeconds, session.maxDurationSeconds);
        const nextHolder = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const nextQuestion = pickRandomScrubbedQuestion([session.activeQuestion?.id || ''], packageQuestions);

        return {
          updates: {
            players: updatedPlayers,
            roundNumber: (session.roundNumber || 1) + 1,
            timerDurationSeconds: roundTimer.timerDurationSeconds,
            secretExplodeSeconds: roundTimer.secretExplodeSeconds,
            explodeAt: roundTimer.explodeAt,
            timerStartedAt: roundTimer.timerStartedAt,
            timerPausedAt: null,
            pausedAt: null,
            totalPausedDurationMs: 0,
            elapsedSeconds: 0,
            isTimerPaused: false,
            currentHolderId: nextHolder.id,
            currentHolderName: nextHolder.name,
            activeQuestion: nextQuestion,
            lastActionMessage: `💥 BOOOOOMM!! Waktu habis di tangan ${studentName}! Bom berpindah ke ${nextHolder.name}!`,
            updatedAt: now,
          },
          fieldMask: [
            'players',
            'roundNumber',
            'timerDurationSeconds',
            'secretExplodeSeconds',
            'explodeAt',
            'timerStartedAt',
            'timerPausedAt',
            'pausedAt',
            'totalPausedDurationMs',
            'elapsedSeconds',
            'isTimerPaused',
            'currentHolderId',
            'currentHolderName',
            'activeQuestion',
            'lastActionMessage',
            'updatedAt',
          ],
          payload: {
            ok: false,
            isCorrect: false,
            eliminated: true,
            newHolderId: nextHolder.id,
            message: 'Waktu habis! Bom meledak sebelum jawaban terkirim.',
          },
        };
      }

      const activeQ = session.activeQuestion;
      if (!activeQ || !Array.isArray(activeQ.options) || typeof selectedAnswerIndex !== 'number') {
        return {
          abort: true,
          payload: { ok: false, isCorrect: false, message: 'Soal aktif tidak valid.' },
        };
      }

      // Bounds check
      if (selectedAnswerIndex < 0 || selectedAnswerIndex >= activeQ.options.length) {
        return {
          abort: true,
          payload: { ok: false, isCorrect: false, message: 'Pilihan jawaban di luar batas.' },
        };
      }

      // Compare selected text against master answer or package answer
      const chosenText = activeQ.options[selectedAnswerIndex];
      const masterEntry =
        (packageQuestions.length > 0 ? packageQuestions.find((q) => q.id === activeQ.id) : null) ||
        MASTER_QUESTIONS.find((q) => q.id === activeQ.id);
      const correctText = masterEntry ? masterEntry.correctText : activeQ.options[0];
      const isCorrect = chosenText === correctText;
      const studentName = session.players[studentId]?.name || 'Siswa';

      if (isCorrect) {
        // Correct answer -> Server FREEZES timer at timestamp `now`!
        const prevScore = session.players[studentId]?.score || 0;
        patchServerPlayerDoc(roomId, studentId, {
          score: prevScore + 10,
          updatedAt: now,
        }).catch(() => {});

        return {
          updates: {
            isTimerPaused: true,
            timerPausedAt: now,
            pausedAt: now,
            elapsedSeconds: timerState.elapsedSeconds,
            lastActionMessage: `✨ ${studentName} berhasil menjawab benar! Waktu dibekukan sementara...`,
            updatedAt: now,
          },
          fieldMask: ['isTimerPaused', 'timerPausedAt', 'pausedAt', 'elapsedSeconds', 'lastActionMessage', 'updatedAt'],
          payload: {
            ok: true,
            isCorrect: true,
            eliminated: false,
            message: 'Jawaban benar! Waktu dibekukan sementara.',
          },
        };
      }

      // Wrong answer -> Eliminate player immediately
      const updatedPlayers = { ...session.players };
      if (updatedPlayers[studentId]) {
        updatedPlayers[studentId] = {
          ...updatedPlayers[studentId],
          isAlive: false,
          eliminatedReason: 'wrong_answer',
          eliminatedAt: now,
        };
      }

      const alivePlayers = Object.values(updatedPlayers).filter((p) => p && p.isAlive);

      // Asynchronously sync player subcollection doc
      patchServerPlayerDoc(roomId, studentId, {
        isAlive: false,
        status: 'eliminated',
        eliminatedReason: 'wrong_answer',
        eliminatedAt: now,
        updatedAt: now,
      }).catch(() => {});

      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0] || null;
        return {
          updates: {
            players: updatedPlayers,
            playerCount: Object.keys(updatedPlayers).length,
            aliveCount: alivePlayers.length,
            status: 'ended',
            winnerId: winner?.id || null,
            winnerName: winner?.name || null,
            currentHolderId: null,
            currentHolderName: null,
            activeQuestion: null,
            isTimerPaused: false,
            lastActionMessage: `💥 ${studentName} salah menjawab dan tereliminasi! Juara bertahan: ${
              winner?.name || 'Tidak ada'
            }!`,
            updatedAt: now,
          },
          fieldMask: [
            'players',
            'playerCount',
            'aliveCount',
            'status',
            'winnerId',
            'winnerName',
            'currentHolderId',
            'currentHolderName',
            'activeQuestion',
            'isTimerPaused',
            'lastActionMessage',
            'updatedAt',
          ],
          payload: {
            ok: true,
            isCorrect: false,
            eliminated: true,
            gameOver: true,
            winnerName: winner?.name || null,
            message: 'Jawaban salah! Anda tereliminasi.',
          },
        };
      }

      // >= 2 players alive -> pass bomb to next random player with fresh scrubbed question
      const nextHolder = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const nextQuestion = pickRandomScrubbedQuestion([activeQ.id], packageQuestions);

      return {
        updates: {
          players: updatedPlayers,
          playerCount: Object.keys(updatedPlayers).length,
          aliveCount: alivePlayers.length,
          currentHolderId: nextHolder.id,
          currentHolderName: nextHolder.name,
          activeQuestion: nextQuestion,
          isTimerPaused: false,
          timerPausedAt: null,
          pausedAt: null,
          lastActionMessage: `💥 ${studentName} salah menjawab dan gugur! Bom berpindah ke ${nextHolder.name}!`,
          updatedAt: now,
        },
        fieldMask: [
          'players',
          'playerCount',
          'aliveCount',
          'currentHolderId',
          'currentHolderName',
          'activeQuestion',
          'isTimerPaused',
          'timerPausedAt',
          'pausedAt',
          'lastActionMessage',
          'updatedAt',
        ],
        payload: {
          ok: true,
          isCorrect: false,
          eliminated: true,
          gameOver: false,
          newHolderId: nextHolder.id,
          message: 'Jawaban salah! Anda tereliminasi.',
        },
      };
    });
  } catch (err: any) {
    return {
      ok: false,
      isCorrect: false,
      message: err?.message || 'Terjadi kesalahan sistem saat memvalidasi jawaban.',
    };
  }
}

/**
 * Authoritative Server Bomb Passing (Atomic Transaction)
 * Extends explodeAt by the exact millisecond duration spent in paused state!
 * Validates that sender is current holder, sender answered correctly, target is alive,
 * and target is not sender.
 */
export interface ServerPassBombResult {
  ok: boolean;
  message?: string;
}

export async function processPassBomb(params: {
  roomId: string;
  fromPlayerId: string;
  toPlayerId: string;
  authUid?: string;
}): Promise<ServerPassBombResult> {
  const { roomId, fromPlayerId, toPlayerId, authUid } = params;

  try {
    return await runServerGameTransaction<ServerPassBombResult>(roomId, async (session) => {
      if (session.status !== 'playing') {
        return { abort: true, payload: { ok: false, message: 'Game tidak aktif.' } };
      }

      // Verification: Sender player must exist in the session
      const fromPlayer = session.players[fromPlayerId];
      if (!fromPlayer) {
        return { abort: true, payload: { ok: false, message: 'Pengirim bom tidak terdaftar dalam sesi.' } };
      }

      // Verification: Token binding check
      if (authUid && fromPlayer.authUid && fromPlayer.authUid !== authUid) {
        return { abort: true, payload: { ok: false, message: 'Identitas pengirim tidak sesuai dengan token otentikasi.' } };
      }

      // Verification: Caller must be the current bomb holder
      if (session.currentHolderId !== fromPlayerId) {
        return { abort: true, payload: { ok: false, message: 'Hanya pemegang bom yang dapat mengoper.' } };
      }

      // Verification: Timer must be paused (meaning student answered correctly)
      if (!session.isTimerPaused) {
        return { abort: true, payload: { ok: false, message: 'Anda harus menjawab benar terlebih dahulu.' } };
      }

      // Verification: Sender must still be alive
      if (!fromPlayer.isAlive) {
        return { abort: true, payload: { ok: false, message: 'Pengirim bom sudah gugur.' } };
      }

      const targetPlayer = session.players[toPlayerId];
      if (!targetPlayer || !targetPlayer.isAlive) {
        return { abort: true, payload: { ok: false, message: 'Target pemain tidak valid atau sudah gugur.' } };
      }

      const alivePlayers = Object.values(session.players || {}).filter((p) => p && p.isAlive);
      if (alivePlayers.length >= 2 && fromPlayerId === toPlayerId) {
        return { abort: true, payload: { ok: false, message: 'Tidak dapat mengoper bom ke diri sendiri.' } };
      }

      const now = Date.now();
      const prevScore = fromPlayer?.score || 0;
      patchServerPlayerDoc(roomId, fromPlayerId, {
        score: prevScore + 5,
        updatedAt: now,
      }).catch(() => {});

      const packageQuestions = session.questionPackageId
        ? await fetchServerPackageQuestions(session.questionPackageId)
        : [];
      const nextQuestion = pickRandomScrubbedQuestion([session.activeQuestion?.id || ''], packageQuestions);

      // Calculate pause duration and advance explodeAt
      const pausedAt = session.timerPausedAt || session.pausedAt || now;
      const pauseDurationMs = Math.max(0, now - pausedAt);
      const currentExplodeAt = session.explodeAt || now + (session.secretExplodeSeconds || 90) * 1000;
      const newExplodeAt = currentExplodeAt + pauseDurationMs;
      const newTotalPaused = (session.totalPausedDurationMs || 0) + pauseDurationMs;

      const actionMsg =
        fromPlayerId === toPlayerId
          ? `✨ ${fromPlayer?.name || 'Pemain'} berhasil menjawab benar dan lanjut ke babak kuis berikutnya!`
          : `🚀 ${fromPlayer?.name || 'Pemain'} melempar bom ke ${targetPlayer.name}! Detak bom berlanjut!`;

      return {
        updates: {
          currentHolderId: targetPlayer.id,
          currentHolderName: targetPlayer.name,
          activeQuestion: nextQuestion,
          isTimerPaused: false,
          timerPausedAt: null,
          pausedAt: null,
          explodeAt: newExplodeAt,
          totalPausedDurationMs: newTotalPaused,
          timerStartedAt: now,
          lastActionMessage: actionMsg,
          updatedAt: now,
        },
        fieldMask: [
          'currentHolderId',
          'currentHolderName',
          'activeQuestion',
          'isTimerPaused',
          'timerPausedAt',
          'pausedAt',
          'explodeAt',
          'totalPausedDurationMs',
          'timerStartedAt',
          'lastActionMessage',
          'updatedAt',
        ],
        payload: { ok: true, message: 'Bom berhasil dilempar.' },
      };
    });
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gagal melempar bom karena konflik concurrent.' };
  }
}

/**
 * Authoritative Server Toggle Pause / Resume (Atomic Transaction)
 * Pause freezes time by setting timerPausedAt.
 * Resume extends explodeAt by (now - timerPausedAt).
 */
export interface ServerTogglePauseResult {
  ok: boolean;
  message?: string;
}

export async function processTogglePause(params: {
  roomId: string;
  pause: boolean;
  callerId?: string;
  isAdminOrTeacher?: boolean;
}): Promise<ServerTogglePauseResult> {
  const { roomId, pause, callerId, isAdminOrTeacher = false } = params;

  try {
    return await runServerGameTransaction<ServerTogglePauseResult>(roomId, async (session) => {
      // Authorization Check: Only room teacher or verified admin can pause/resume
      if (callerId && session.teacherId && callerId !== session.teacherId && !isAdminOrTeacher) {
        return {
          abort: true,
          payload: { ok: false, message: 'Hanya Guru host atau Admin yang berhak mengubah status jeda permainan.' },
        };
      }

      const now = Date.now();

      if (pause) {
        // Pausing game: only allowed if playing
        if (session.status !== 'playing') {
          return { abort: true, payload: { ok: true, message: 'Permainan sudah dalam status dijeda atau selesai.' } };
        }

        return {
          updates: {
            status: 'paused',
            isTimerPaused: true,
            timerPausedAt: now,
            pausedAt: now,
            lastActionMessage: '⏸️ Permainan dijeda sementara oleh Guru.',
            updatedAt: now,
          },
          fieldMask: ['status', 'isTimerPaused', 'timerPausedAt', 'pausedAt', 'lastActionMessage', 'updatedAt'],
          payload: { ok: true, message: 'Permainan berhasil dijeda.' },
        };
      } else {
        // Resuming game: only allowed if currently paused
        if (session.status !== 'paused') {
          return { abort: true, payload: { ok: true, message: 'Permainan tidak sedang dijeda.' } };
        }

        const pausedAt = session.timerPausedAt || session.pausedAt || now;
        const pauseDurationMs = Math.max(0, now - pausedAt);
        const currentExplodeAt = session.explodeAt || now + (session.secretExplodeSeconds || 90) * 1000;
        const newExplodeAt = currentExplodeAt + pauseDurationMs;
        const newTotalPaused = (session.totalPausedDurationMs || 0) + pauseDurationMs;

        return {
          updates: {
            status: 'playing',
            isTimerPaused: false,
            timerPausedAt: null,
            pausedAt: null,
            explodeAt: newExplodeAt,
            totalPausedDurationMs: newTotalPaused,
            timerStartedAt: now,
            lastActionMessage: '▶️ Permainan dilanjutkan kembali!',
            updatedAt: now,
          },
          fieldMask: [
            'status',
            'isTimerPaused',
            'timerPausedAt',
            'pausedAt',
            'explodeAt',
            'totalPausedDurationMs',
            'timerStartedAt',
            'lastActionMessage',
            'updatedAt',
          ],
          payload: { ok: true, message: 'Permainan berhasil dilanjutkan.' },
        };
      }
    });
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gagal mengubah status jeda permainan.' };
  }
}

// -------------------------------------------------------------
// Firestore REST Serializer & Parser helpers
// -------------------------------------------------------------

function serializeToFirestoreFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    fields[key] = convertJsValueToFirestore(val);
  }

  return fields;
}

function convertJsValueToFirestore(val: any): any {
  if (val === null) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(convertJsValueToFirestore) } };
  }
  if (typeof val === 'object') {
    const mapFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        mapFields[k] = convertJsValueToFirestore(v);
      }
    }
    return { mapValue: { fields: mapFields } };
  }
  return { stringValue: String(val) };
}

function parseFirestoreFields(fields: Record<string, any>, docId: string): GameSession {
  const result: any = { id: docId };

  for (const [key, valObj] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(valObj);
  }

  return result as GameSession;
}

function parseFirestoreValue(valObj: any): any {
  if (!valObj) return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('booleanValue' in valObj) return valObj.booleanValue;
  if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
  if ('doubleValue' in valObj) return parseFloat(valObj.doubleValue);
  if ('nullValue' in valObj) return null;
  if ('arrayValue' in valObj) {
    const values = valObj.arrayValue?.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in valObj) {
    const mapFields = valObj.mapValue?.fields || {};
    const mapRes: Record<string, any> = {};
    for (const [k, v] of Object.entries(mapFields)) {
      mapRes[k] = parseFirestoreValue(v);
    }
    return mapRes;
  }
  return null;
}
