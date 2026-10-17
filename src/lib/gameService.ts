import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { GameSession, GamePlayer, GameQuestion, GameTimerState, IcebreakingPackage, IcebreakingQuestionItem } from '../types/game';
import { pickRandomIcebreakingQuestion, ICEBREAKING_QUESTIONS, registerDynamicQuestions } from '../data/icebreakingQuestions';

const GAME_COLLECTION = 'game_sessions';
const ICEBREAKING_PACKAGES_COLLECTION = 'icebreaking_packages';

// In-memory cache for package questions to provide instant zero-delay question picking
const packageQuestionsCache = new Map<string, GameQuestion[]>();

/**
 * Retrieves authenticated Firebase ID Token headers for server endpoints.
 */
async function getGameAuthHeaders(): Promise<Record<string, string>> {
  try {
    let user = auth.currentUser;
    if (!user) {
      const { signInAnonymously } = await import('firebase/auth');
      const cred = await signInAnonymously(auth).catch(() => null);
      user = cred?.user || auth.currentUser;
    }
    if (user) {
      const token = await user.getIdToken().catch(() => null);
      if (token) {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        };
      }
    }
  } catch {}
  return { 'Content-Type': 'application/json' };
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
 * Generate a concise, memorable room token (e.g. "BOMB-7A" or 4 digits)
 */
export function generateRoomToken(targetClass?: string): string {
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  if (targetClass && targetClass !== 'ALL') {
    const cleanClass = targetClass.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `${cleanClass}-${digits.slice(-2)}`;
  }
  return digits;
}

/**
 * Create a new Game Session room in Firestore (Host / Teacher)
 */
export async function createGameSession(params: {
  teacherId: string;
  teacherName?: string;
  targetClass: string;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  questionCategory?: string;
  questionPackageId?: string;
  questionPackageTitle?: string;
}): Promise<GameSession> {
  const minSec = Math.max(30, params.minDurationSeconds ?? 60);
  const maxSec = Math.max(minSec + 10, params.maxDurationSeconds ?? 120);
  const secretSeconds = Math.floor(minSec + Math.random() * (maxSec - minSec + 1));
  const roomToken = generateRoomToken(params.targetClass);
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const now = Date.now();
  const initialSession: GameSession = {
    id: roomId,
    roomToken,
    teacherId: params.teacherId,
    teacherName: params.teacherName || 'Guru Pengampu',
    targetClass: params.targetClass,
    status: 'lobby',
    minDurationSeconds: minSec,
    maxDurationSeconds: maxSec,
    timerDurationSeconds: secretSeconds,
    secretExplodeSeconds: secretSeconds,
    explodeAt: null,
    timerStartedAt: null,
    timerPausedAt: null,
    pausedAt: null,
    totalPausedDurationMs: 0,
    elapsedSeconds: 0,
    isTimerPaused: false,
    currentHolderId: null,
    currentHolderName: null,
    activeQuestion: null,
    questionCategory: params.questionCategory || 'Semua Kategori',
    questionPackageId: params.questionPackageId || undefined,
    questionPackageTitle: params.questionPackageTitle || undefined,
    players: {},
    playerCount: 0,
    aliveCount: 0,
    roundNumber: 1,
    winnerId: null,
    winnerName: null,
    lastActionMessage: 'Ruang permainan telah dibuka! Menunggu peserta...',
    createdAt: now,
    updatedAt: now,
  };

  const roomRef = doc(db, GAME_COLLECTION, roomId);
  await setDoc(roomRef, initialSession);

  return initialSession;
}

/**
 * Safe, idempotent background migration of legacy root doc players into the players subcollection.
 * Ensures existing rooms with root doc players are migrated without data loss.
 */
export async function migrateRoomPlayersToSubcollection(
  roomId: string,
  legacyPlayers: Record<string, GamePlayer>
): Promise<void> {
  if (!legacyPlayers || typeof legacyPlayers !== 'object') return;
  const entries = Object.entries(legacyPlayers);
  if (entries.length === 0) return;

  try {
    for (const [playerId, player] of entries) {
      if (!playerId || !player) continue;
      const pRef = doc(db, GAME_COLLECTION, roomId, 'players', playerId);
      await setDoc(
        pRef,
        {
          id: playerId,
          studentId: playerId,
          name: player.name || player.displayName || 'Siswa',
          displayName: player.displayName || player.name || 'Siswa',
          nisn: player.nisn || '',
          kelas: player.kelas || '',
          isAlive: player.isAlive ?? true,
          score: player.score ?? 0,
          eliminatedReason: player.eliminatedReason || null,
          eliminatedAt: player.eliminatedAt || null,
          joinedAt: player.joinedAt || Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Background players migration notice:', err);
  }
}

/**
 * Fetch all players for a room (reads subcollection first, with legacy root doc fallback)
 */
export async function fetchGamePlayers(roomId: string): Promise<Record<string, GamePlayer>> {
  try {
    const playersCol = collection(db, GAME_COLLECTION, roomId, 'players');
    const snap = await getDocs(playersCol);
    if (!snap.empty) {
      const map: Record<string, GamePlayer> = {};
      snap.docs.forEach((d) => {
        const p = d.data() as GamePlayer;
        map[d.id] = { ...p, id: d.id, studentId: p.studentId || d.id, displayName: p.displayName || p.name };
      });
      return map;
    }
  } catch (err) {
    console.warn('Notice fetching players subcollection, fallback to root session:', err);
  }

  // Fallback: check legacy root doc players
  try {
    const roomRef = doc(db, GAME_COLLECTION, roomId);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      const session = snap.data() as GameSession;
      return session.players || {};
    }
  } catch (err) {
    console.warn('Notice fetching root session players fallback:', err);
  }

  return {};
}

/**
 * Subscribe to real-time updates for a single game room.
 * Uses exactly two listeners:
 * 1. Room root document for lightweight core game state (timer, round, question, holder, status)
 * 2. Players subcollection for participants (join, elimination, scores)
 * Seamlessly merges data into GameSession so UI components require ZERO modifications.
 */
export function subscribeGameSession(
  roomId: string,
  onUpdate: (session: GameSession | null) => void
): () => void {
  const roomRef = doc(db, GAME_COLLECTION, roomId);
  const playersColRef = collection(db, GAME_COLLECTION, roomId, 'players');

  let currentRoomData: GameSession | null = null;
  let currentPlayersMap: Record<string, GamePlayer> = {};
  let hasPlayersFromSubcollection = false;

  const emit = () => {
    if (!currentRoomData) {
      onUpdate(null);
      return;
    }

    // Prefer subcollection players if present; otherwise fallback to root document players (backward compatible)
    const effectivePlayers =
      hasPlayersFromSubcollection && Object.keys(currentPlayersMap).length > 0
        ? currentPlayersMap
        : currentRoomData.players || {};

    const combined: GameSession = {
      ...currentRoomData,
      players: effectivePlayers,
      playerCount: Object.keys(effectivePlayers).length,
      aliveCount: Object.values(effectivePlayers).filter((p) => p && p.isAlive).length,
    };

    onUpdate(combined);
  };

  // Listener 1: Room root document (game state)
  const unsubRoom = onSnapshot(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        currentRoomData = { id: snapshot.id, ...snapshot.data() } as GameSession;
        // If subcollection is not yet populated but root doc has legacy players, migrate in background
        if (
          !hasPlayersFromSubcollection &&
          currentRoomData.players &&
          Object.keys(currentRoomData.players).length > 0
        ) {
          migrateRoomPlayersToSubcollection(roomId, currentRoomData.players).catch(() => {});
        }
        emit();
      } else {
        currentRoomData = null;
        onUpdate(null);
      }
    },
    (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn('Realtime game session subscription notice:', err?.message || err);
      }
      onUpdate(null);
    }
  );

  // Listener 2: Players subcollection (single collection listener for all players in this room)
  const unsubPlayers = onSnapshot(
    playersColRef,
    (snapshot) => {
      if (!snapshot.empty) {
        hasPlayersFromSubcollection = true;
        const map: Record<string, GamePlayer> = {};
        snapshot.docs.forEach((d) => {
          const p = d.data() as GamePlayer;
          map[d.id] = {
            ...p,
            id: d.id,
            studentId: p.studentId || d.id,
            displayName: p.displayName || p.name,
          };
        });
        currentPlayersMap = map;
      } else {
        hasPlayersFromSubcollection = false;
        currentPlayersMap = {};
      }
      emit();
    },
    (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn('Realtime game players subscription notice:', err?.message || err);
      }
    }
  );

  return () => {
    unsubRoom();
    unsubPlayers();
  };
}

/**
 * Subscribe to real-time active game session for a subject and target class
 */
export function subscribeActiveGameForSubject(
  subjectId: string,
  teachers: Array<{ id: string; subjectIds?: string[] }>,
  onUpdate: (session: GameSession | null) => void,
  studentClass?: string
): () => void {
  // Find teacher IDs teaching this subject
  const subjectTeacherIds = new Set(
    (teachers || [])
      .filter((t) => t.subjectIds && t.subjectIds.includes(subjectId))
      .map((t) => t.id)
  );

  const q = query(
    collection(db, GAME_COLLECTION),
    where('status', 'in', ['lobby', 'playing', 'paused']),
    limit(10)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      let activeSessions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GameSession));

      if (subjectTeacherIds.size > 0) {
        activeSessions = activeSessions.filter((s) => subjectTeacherIds.has(s.teacherId));
      }

      if (studentClass && studentClass !== 'ALL') {
        const cleanClass = studentClass.trim().toLowerCase();
        activeSessions = activeSessions.filter(
          (s) =>
            !s.targetClass ||
            s.targetClass === 'ALL' ||
            s.targetClass.trim().toLowerCase() === cleanClass
        );
      }

      if (activeSessions.length > 0) {
        activeSessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        onUpdate(activeSessions[0]);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn('Realtime active game for subject notice:', err?.message || err);
      }
      onUpdate(null);
    }
  );
}

/**
 * Find active game room by token
 */
export async function findRoomByToken(token: string): Promise<GameSession | null> {
  const cleanToken = token.trim().toUpperCase();
  const q = query(
    collection(db, GAME_COLLECTION),
    where('roomToken', '==', cleanToken),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const firstDoc = snapshot.docs[0];
    return { id: firstDoc.id, ...firstDoc.data() } as GameSession;
  }
  return null;
}

/**
 * Find active game room for a specific student's class
 */
export async function findActiveRoomForClass(studentClass: string): Promise<GameSession | null> {
  try {
    const q1 = query(
      collection(db, GAME_COLLECTION),
      where('targetClass', 'in', [studentClass, 'ALL']),
      where('status', 'in', ['lobby', 'playing', 'paused']),
      limit(1)
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return { id: snap1.docs[0].id, ...snap1.docs[0].data() } as GameSession;
    }
  } catch (err) {
    console.warn('Error querying active game room for class:', err);
  }
  return null;
}

/**
 * Join an existing room as a student (Atomic Transaction)
 * Concurrent joins from 20-40 students are safely merged without overwriting each other.
 */
export async function joinGameSession(
  roomId: string,
  student: { id: string; nama: string; nisn?: string; kelas?: string }
): Promise<{ success: boolean; message: string; session?: GameSession }> {
  const roomRef = doc(db, GAME_COLLECTION, roomId);

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);

      if (!snap.exists()) {
        return { success: false, message: 'Ruang permainan tidak ditemukan atau sudah berakhir.' };
      }

      const session = { id: snap.id, ...snap.data() } as GameSession;

      // Cannot join ended rooms
      if (session.status === 'ended') {
        return { success: false, message: 'Ruang permainan ini sudah berakhir.' };
      }

      // Validate class if restricted
      if (session.targetClass && session.targetClass !== 'ALL') {
        if (student.kelas && student.kelas.toLowerCase() !== session.targetClass.toLowerCase()) {
          return {
            success: false,
            message: `Permainan ini khusus untuk ${session.targetClass}. Kelas Anda (${student.kelas}) tidak diizinkan masuk.`,
          };
        }
      }

      const currentPlayers = session.players || {};
      const existingPlayer = currentPlayers[student.id];

      // Reconnection preservation: preserve alive/eliminated state if student reconnects
      const playerObj: GamePlayer = {
        id: student.id,
        name: student.nama,
        displayName: student.nama,
        studentId: student.id,
        nisn: student.nisn || existingPlayer?.nisn || '',
        kelas: student.kelas || existingPlayer?.kelas || '',
        isAlive: existingPlayer ? existingPlayer.isAlive : true,
        score: existingPlayer?.score ?? 0,
        eliminatedReason: existingPlayer?.eliminatedReason || null,
        eliminatedAt: existingPlayer?.eliminatedAt || null,
        joinedAt: existingPlayer?.joinedAt || Date.now(),
        authUid: auth.currentUser?.uid || existingPlayer?.authUid || student.id,
        updatedAt: Date.now(),
      };

      const updatedPlayers: Record<string, GamePlayer> = {
        ...currentPlayers,
        [student.id]: playerObj,
      };

      const now = Date.now();
      const actionMsg = existingPlayer
        ? `${student.nama} kembali terhubung ke permainan.`
        : `${student.nama} bergabung ke permainan!`;

      // 1. Write individual player doc into subcollection atomically
      const playerDocRef = doc(db, GAME_COLLECTION, roomId, 'players', student.id);
      transaction.set(playerDocRef, playerObj, { merge: true });

      // 2. Update room root doc with summary count metadata and synchronized players map
      const aliveCount = Object.values(updatedPlayers).filter((p) => p && p.isAlive).length;
      const playerCount = Object.keys(updatedPlayers).length;

      transaction.update(roomRef, {
        players: updatedPlayers,
        playerCount,
        aliveCount,
        lastActionMessage: actionMsg,
        updatedAt: now,
      });

      return {
        success: true,
        message: existingPlayer ? 'Berhasil terhubung kembali!' : 'Berhasil bergabung ke permainan!',
        session: {
          ...session,
          players: updatedPlayers,
          playerCount,
          aliveCount,
          lastActionMessage: actionMsg,
          updatedAt: now,
        },
      };
    });
  } catch (err: any) {
    console.error('Transaction error in joinGameSession:', err);
    return {
      success: false,
      message: err?.message || 'Gagal bergabung karena kendala sinkronisasi serentak. Silakan coba lagi.',
    };
  }
}

/**
 * Start the Game (Host / Teacher) (Atomic Transaction)
 * Ensures game can only transition from 'lobby' to 'playing' once.
 */
export async function startGameSession(roomId: string): Promise<boolean> {
  const roomRef = doc(db, GAME_COLLECTION, roomId);
  const [playersMap, initialSnap] = await Promise.all([
    fetchGamePlayers(roomId),
    getDoc(roomRef),
  ]);

  const initialPkgId = initialSnap.exists() ? (initialSnap.data() as GameSession).questionPackageId : undefined;
  if (initialPkgId) {
    await getQuestionPoolForPackage(initialPkgId).catch(() => {});
  }

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(roomRef);
    if (!snap.exists()) return false;

    const session = snap.data() as GameSession;

    // Strict state guard: Only allow starting if currently in 'lobby'
    // Prevents double-clicks or multiple host tabs from resetting an ongoing game
    if (session.status !== 'lobby') {
      return true;
    }

    const mergedPlayers = {
      ...(session.players || {}),
      ...playersMap,
    };

    const playerList = Object.values(mergedPlayers).filter((p) => p && p.isAlive);
    if (playerList.length === 0) {
      throw new Error('Belum ada siswa yang bergabung di dalam room. Tunggu minimal 1 siswa masuk.');
    }

    // Pick first random player to hold the bomb
    const firstHolder = playerList[Math.floor(Math.random() * playerList.length)];
    
    // Pick question from custom package if available in memory cache, else default
    const firstQuestion = pickSessionQuestion(session);

    const now = Date.now();
    const minSec = session.minDurationSeconds || 60;
    const maxSec = session.maxDurationSeconds || 120;
    const durationSec = Math.floor(minSec + Math.random() * (maxSec - minSec + 1));
    const explodeAt = now + durationSec * 1000;

    transaction.update(roomRef, {
      status: 'playing',
      currentHolderId: firstHolder.id,
      currentHolderName: firstHolder.name,
      activeQuestion: firstQuestion,
      timerDurationSeconds: durationSec,
      secretExplodeSeconds: durationSec,
      explodeAt,
      timerStartedAt: now,
      timerPausedAt: null,
      pausedAt: null,
      totalPausedDurationMs: 0,
      elapsedSeconds: 0,
      isTimerPaused: false,
      roundNumber: 1,
      winnerId: null,
      winnerName: null,
      playerCount: playerList.length,
      aliveCount: playerList.length,
      lastActionMessage: `Game dimulai! Bom pertama berada di tangan ${firstHolder.name}!`,
      updatedAt: now,
    });

    return true;
  });
}

/**
 * Server-authoritative Submit Answer:
 * - Client ONLY provides selectedAnswerIndex.
 * - Server determines isCorrect against master question repository.
 * - If WRONG: player is eliminated immediately, bomb passes to another random alive player.
 * - If CORRECT: time is FROZEN (paused) so player can select target friend!
 */
export async function submitGameAnswer(
  roomId: string,
  studentId: string,
  selectedAnswerIndex: number,
  _ignoredClientElapsed?: number,
  questionId?: string
): Promise<{
  isCorrect: boolean;
  eliminated?: boolean;
  newHolderId?: string;
  gameOver?: boolean;
  winnerName?: string | null;
  message?: string;
}> {
  // Primary: Authoritative Server Endpoint
  try {
    const headers = await getGameAuthHeaders();
    const res = await fetch('/api/game-submit-answer', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        roomId,
        studentId,
        selectedAnswerIndex,
        questionId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.isCorrect === 'boolean') {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend validation call fallback, validating via transactional client fallback:', err);
  }

  // Resilient Transactional Fallback: Atomic read-validate-write prevents race conditions
  const roomRef = doc(db, GAME_COLLECTION, roomId);
  const initialSnap = await getDoc(roomRef).catch(() => null);
  const initialPkgId = initialSnap?.exists() ? (initialSnap.data() as GameSession).questionPackageId : undefined;
  if (initialPkgId && !packageQuestionsCache.has(initialPkgId)) {
    await getQuestionPoolForPackage(initialPkgId).catch(() => {});
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return { isCorrect: false, message: 'Ruang permainan tidak ditemukan.' };

      const session = snap.data() as GameSession;
      const now = Date.now();

      // State check: Game must be actively playing
      if (session.status !== 'playing') {
        return { isCorrect: false, message: 'Permainan sedang tidak aktif.' };
      }

      // Turn check: Validate that caller is the current holder
      if (session.currentHolderId !== studentId) {
        return { isCorrect: false, message: 'Bukan giliran Anda.' };
      }

      // Check caller is alive
      if (!session.players?.[studentId]?.isAlive) {
        return { isCorrect: false, message: 'Pemain sudah gugur.' };
      }

      // Check if timer is already paused (meaning student already answered correctly and waiting to throw)
      if (session.isTimerPaused) {
        return { isCorrect: false, message: 'Jawaban telah diterima. Silakan oper bom ke teman.' };
      }

      // Prevent answering stale questions if questionId provided
      if (questionId && session.activeQuestion?.id && session.activeQuestion.id !== questionId) {
        return { isCorrect: false, message: 'Soal telah berganti.' };
      }

      // Check if time expired before answer arrived (Atomic explosion in same transaction)
      const timerState = getGameTimerState(session, now);
      if (timerState.isExpired) {
        const playerDocRef = doc(db, GAME_COLLECTION, roomId, 'players', studentId);
        transaction.set(
          playerDocRef,
          {
            isAlive: false,
            status: 'eliminated',
            eliminatedReason: 'bombed',
            eliminatedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

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
          transaction.update(roomRef, {
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
            lastActionMessage: `💥 BOOOOOMM!! Waktu habis saat menjawab, bom meledak di tangan ${studentName}! Juara: ${
              winner?.name || 'Tidak ada'
            }!`,
            updatedAt: now,
          });

          return { isCorrect: false, eliminated: true, gameOver: true, winnerName: winner?.name };
        }

        const minSec = session.minDurationSeconds || 60;
        const maxSec = session.maxDurationSeconds || 120;
        const newSecretSec = Math.floor(minSec + Math.random() * (maxSec - minSec + 1));
        const nextHolder = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const nextQuestion = pickSessionQuestion(session, [session.activeQuestion?.id || '']);

        transaction.update(roomRef, {
          players: updatedPlayers,
          playerCount: Object.keys(updatedPlayers).length,
          aliveCount: alivePlayers.length,
          roundNumber: (session.roundNumber || 1) + 1,
          timerDurationSeconds: newSecretSec,
          secretExplodeSeconds: newSecretSec,
          explodeAt: now + newSecretSec * 1000,
          timerStartedAt: now,
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
        });

        return { isCorrect: false, eliminated: true, newHolderId: nextHolder.id, message: 'Waktu habis! Bom meledak sebelum jawaban terkirim.' };
      }

      const activeQ = session.activeQuestion;
      if (!activeQ || !Array.isArray(activeQ.options) || typeof selectedAnswerIndex !== 'number') {
        return { isCorrect: false, message: 'Soal aktif tidak valid.' };
      }

      const chosenOptionText = activeQ.options[selectedAnswerIndex];
      const pkgPool = session.questionPackageId ? packageQuestionsCache.get(session.questionPackageId) : null;
      const masterQ = (pkgPool && pkgPool.find((q) => q.id === activeQ.id)) || ICEBREAKING_QUESTIONS.find((q) => q.id === activeQ.id);
      const correctOptionText = masterQ ? masterQ.options[0] : activeQ.options[0];
      const isCorrect = Boolean(chosenOptionText && chosenOptionText === correctOptionText);

      // If wrong answer -> eliminate immediately atomically
      if (!isCorrect) {
        const playerDocRef = doc(db, GAME_COLLECTION, roomId, 'players', studentId);
        transaction.set(
          playerDocRef,
          {
            isAlive: false,
            status: 'eliminated',
            eliminatedReason: 'wrong_answer',
            eliminatedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

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

        // If only 1 player remains, crown winner!
        if (alivePlayers.length <= 1) {
          const winner = alivePlayers[0] || null;
          transaction.update(roomRef, {
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
            lastActionMessage: `💥 ${session.players[studentId]?.name || 'Siswa'} salah menjawab dan tereliminasi! Juara bertahan: ${winner?.name || 'Tidak ada'}!`,
            updatedAt: now,
          });
          return { isCorrect: false, eliminated: true, gameOver: true, winnerName: winner?.name };
        }

        // Pick new random alive player with scrubbed question
        const nextHolder = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const nextQuestion = pickSessionQuestion(session, [session.activeQuestion?.id || '']);

        transaction.update(roomRef, {
          players: updatedPlayers,
          playerCount: Object.keys(updatedPlayers).length,
          aliveCount: alivePlayers.length,
          currentHolderId: nextHolder.id,
          currentHolderName: nextHolder.name,
          activeQuestion: nextQuestion,
          isTimerPaused: false,
          timerPausedAt: null,
          pausedAt: null,
          lastActionMessage: `💥 ${session.players[studentId]?.name || 'Siswa'} salah menjawab dan gugur! Bom berpindah ke ${nextHolder.name}!`,
          updatedAt: now,
        });

        return { isCorrect: false, eliminated: true, newHolderId: nextHolder.id };
      }

      // If CORRECT -> Freeze timer atomically and update player score!
      const playerDocRef = doc(db, GAME_COLLECTION, roomId, 'players', studentId);
      const prevScore = session.players?.[studentId]?.score ?? 0;
      const newScore = prevScore + 10;
      transaction.set(
        playerDocRef,
        {
          score: newScore,
          updatedAt: now,
        },
        { merge: true }
      );

      const updatedPlayers = { ...session.players };
      if (updatedPlayers[studentId]) {
        updatedPlayers[studentId] = {
          ...updatedPlayers[studentId],
          score: newScore,
        };
      }

      transaction.update(roomRef, {
        players: updatedPlayers,
        isTimerPaused: true,
        timerPausedAt: now,
        pausedAt: now,
        elapsedSeconds: timerState.elapsedSeconds,
        lastActionMessage: `✨ ${session.players[studentId]?.name || 'Siswa'} berhasil menjawab benar! Waktu dibekukan sementara...`,
        updatedAt: now,
      });

      return { isCorrect: true, eliminated: false };
    });
  } catch (err: any) {
    console.error('Transaction error in submitGameAnswer fallback:', err);
    return { isCorrect: false, message: err?.message || 'Gagal memproses jawaban karena konflik serentak.' };
  }
}

/**
 * Pass the bomb to a targeted friend after answering correctly (Atomic Transaction)
 * Shifts explodeAt forward by the exact duration time spent in paused state!
 */
export async function passBombToTarget(
  roomId: string,
  fromPlayerId: string,
  toPlayerId: string
): Promise<boolean> {
  // Primary: Authoritative Server Endpoint
  try {
    const headers = await getGameAuthHeaders();
    const res = await fetch('/api/game-pass-bomb', {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomId, fromPlayerId, toPlayerId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) return true;
    }
  } catch (err) {
    console.warn('Backend pass bomb fallback, validating via transactional client fallback:', err);
  }

  // Resilient Transactional Fallback
  const roomRef = doc(db, GAME_COLLECTION, roomId);
  const initialSnap = await getDoc(roomRef).catch(() => null);
  const initialPkgId = initialSnap?.exists() ? (initialSnap.data() as GameSession).questionPackageId : undefined;
  if (initialPkgId && !packageQuestionsCache.has(initialPkgId)) {
    await getQuestionPoolForPackage(initialPkgId).catch(() => {});
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return false;

      const session = snap.data() as GameSession;
      if (session.status !== 'playing') {
        throw new Error('Game tidak sedang aktif.');
      }

      // Turn check: caller must be current holder
      if (session.currentHolderId !== fromPlayerId) {
        throw new Error('Hanya pemegang bom yang dapat mengoper.');
      }

      // State check: timer must be paused (answered correctly)
      if (!session.isTimerPaused) {
        throw new Error('Anda harus menjawab benar terlebih dahulu sebelum mengoper bom.');
      }

      // Check caller is alive
      if (!session.players?.[fromPlayerId]?.isAlive) {
        throw new Error('Pengirim bom sudah gugur.');
      }

      // Check target player
      const targetPlayer = session.players?.[toPlayerId];
      if (!targetPlayer || !targetPlayer.isAlive) {
        throw new Error('Target pemain tidak valid atau sudah gugur.');
      }

      const alivePlayers = Object.values(session.players || {}).filter((p) => p && p.isAlive);
      if (alivePlayers.length >= 2 && fromPlayerId === toPlayerId) {
        throw new Error('Tidak dapat mengoper bom ke diri sendiri.');
      }

      const fromPlayer = session.players[fromPlayerId];
      const now = Date.now();
      const prevScore = session.players?.[fromPlayerId]?.score ?? 0;
      const newScore = prevScore + 5;

      const fromDocRef = doc(db, GAME_COLLECTION, roomId, 'players', fromPlayerId);
      transaction.set(
        fromDocRef,
        {
          score: newScore,
          updatedAt: now,
        },
        { merge: true }
      );

      const updatedPlayers = { ...session.players };
      if (updatedPlayers[fromPlayerId]) {
        updatedPlayers[fromPlayerId] = {
          ...updatedPlayers[fromPlayerId],
          score: newScore,
        };
      }

      const nextQuestion = pickSessionQuestion(session, [session.activeQuestion?.id || '']);

      // Shift explodeAt forward by pause duration
      const pausedAt = session.timerPausedAt || session.pausedAt || now;
      const pauseDuration = Math.max(0, now - pausedAt);
      const currentExplodeAt = session.explodeAt || now + (session.secretExplodeSeconds || 90) * 1000;
      const newExplodeAt = currentExplodeAt + pauseDuration;
      const newTotalPaused = (session.totalPausedDurationMs || 0) + pauseDuration;

      const actionMsg = fromPlayerId === toPlayerId
        ? `✨ ${fromPlayer?.name || 'Pemain'} berhasil menjawab benar dan lanjut ke babak kuis berikutnya!`
        : `🚀 ${fromPlayer?.name || 'Pemain'} melempar bom ke ${targetPlayer.name}! Detak bom berlanjut!`;

      transaction.update(roomRef, {
        players: updatedPlayers,
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
      });

      return true;
    });
  } catch (err: any) {
    console.error('Transaction error in passBombToTarget fallback:', err);
    throw err;
  }
}

/**
 * Handle secret countdown expiration (Bomb Explosion) (Atomic Transaction)
 * Server-authoritative: Verifies that Date.now() >= explodeAt before executing.
 * Multiple concurrent explosion triggers from different devices are strictly deduplicated.
 */
export async function triggerBombExplosion(roomId: string, explodedPlayerId?: string): Promise<boolean> {
  // Primary: Authoritative Server Endpoint
  try {
    const headers = await getGameAuthHeaders();
    const res = await fetch('/api/game-trigger-explosion', {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomId, explodedPlayerId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) return true;
    }
  } catch (err) {
    console.warn('Backend trigger explosion fallback, executing transactional client fallback:', err);
  }

  // Resilient Transactional Fallback: Atomic explosion prevents multiple devices from duplicate triggers
  const roomRef = doc(db, GAME_COLLECTION, roomId);
  const initialSnap = await getDoc(roomRef).catch(() => null);
  const initialPkgId = initialSnap?.exists() ? (initialSnap.data() as GameSession).questionPackageId : undefined;
  if (initialPkgId && !packageQuestionsCache.has(initialPkgId)) {
    await getQuestionPoolForPackage(initialPkgId).catch(() => {});
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return false;

      const session = snap.data() as GameSession;
      if (session.status !== 'playing' || session.isTimerPaused) return false;

      const holderId = session.currentHolderId;
      if (!holderId) return false;

      // Caller match check: If explodedPlayerId was specified, it MUST match the current holder
      if (explodedPlayerId && explodedPlayerId !== holderId) {
        return false;
      }

      // Check if holder is alive
      if (!session.players?.[holderId]?.isAlive) {
        return false;
      }

      const now = Date.now();
      const timerState = getGameTimerState(session, now);

      // Authoritative Check: Bomb only explodes if time is truly expired!
      if (!timerState.isExpired) {
        return false;
      }

      // 1. Mark player as eliminated in the subcollection atomically
      const holderDocRef = doc(db, GAME_COLLECTION, roomId, 'players', holderId);
      transaction.set(
        holderDocRef,
        {
          isAlive: false,
          status: 'eliminated',
          eliminatedReason: 'bombed',
          eliminatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

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
      const holderName = session.players[holderId]?.name || 'Pemain';

      // If only 1 survivor left, end game!
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0] || null;
        transaction.update(roomRef, {
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
          lastActionMessage: `💥 BOOOOOMM!! Waktu habis, bom meledak di tangan ${holderName}! Selamat kepada sang juara bertahan: ${winner?.name || 'Tidak ada'}!`,
          updatedAt: now,
        });
        return true;
      }

      // If >= 2 survivors remain, start next round with new secret countdown!
      const minSec = session.minDurationSeconds || 60;
      const maxSec = session.maxDurationSeconds || 120;
      const newSecretSeconds = Math.floor(minSec + Math.random() * (maxSec - minSec + 1));
      const newExplodeAt = now + newSecretSeconds * 1000;
      const nextHolder = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const nextQuestion = pickSessionQuestion(session, [session.activeQuestion?.id || '']);

      transaction.update(roomRef, {
        players: updatedPlayers,
        playerCount: Object.keys(updatedPlayers).length,
        aliveCount: alivePlayers.length,
        roundNumber: (session.roundNumber || 1) + 1,
        timerDurationSeconds: newSecretSeconds,
        secretExplodeSeconds: newSecretSeconds,
        explodeAt: newExplodeAt,
        timerStartedAt: now,
        timerPausedAt: null,
        pausedAt: null,
        totalPausedDurationMs: 0,
        elapsedSeconds: 0,
        isTimerPaused: false,
        currentHolderId: nextHolder.id,
        currentHolderName: nextHolder.name,
        activeQuestion: nextQuestion,
        lastActionMessage: `💥 BOOOOOMM!! Waktu habis, bom meledak di tangan ${holderName}! Ronde baru dimulai, bom berada di tangan ${nextHolder.name}!`,
        updatedAt: now,
      });

      return true;
    });
  } catch (err: any) {
    console.error('Transaction error in triggerBombExplosion fallback:', err);
    return false;
  }
}

/**
 * Emergency Host Action: Force Pass bomb to another player (Atomic Transaction)
 */
export async function hostForcePassBomb(roomId: string, targetPlayerId?: string): Promise<boolean> {
  const roomRef = doc(db, GAME_COLLECTION, roomId);
  const initialSnap = await getDoc(roomRef).catch(() => null);
  const initialPkgId = initialSnap?.exists() ? (initialSnap.data() as GameSession).questionPackageId : undefined;
  if (initialPkgId && !packageQuestionsCache.has(initialPkgId)) {
    await getQuestionPoolForPackage(initialPkgId).catch(() => {});
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return false;

      const session = snap.data() as GameSession;
      if (session.status !== 'playing') return false;

      const alivePlayers = Object.values(session.players || {}).filter((p) => p && p.isAlive);
      if (alivePlayers.length < 2) return false;

      let nextHolder = targetPlayerId
        ? alivePlayers.find((p) => p.id === targetPlayerId)
        : alivePlayers.find((p) => p.id !== session.currentHolderId);

      if (!nextHolder) {
        nextHolder = alivePlayers[0];
      }

      const nextQuestion = pickSessionQuestion(session, [session.activeQuestion?.id || '']);
      const now = Date.now();

      let newExplodeAt = session.explodeAt;
      let newTotalPaused = session.totalPausedDurationMs || 0;
      if (session.isTimerPaused && (session.timerPausedAt || session.pausedAt)) {
        const pauseDuration = Math.max(0, now - (session.timerPausedAt || session.pausedAt || now));
        newExplodeAt = (session.explodeAt || now) + pauseDuration;
        newTotalPaused += pauseDuration;
      }

      transaction.update(roomRef, {
        currentHolderId: nextHolder.id,
        currentHolderName: nextHolder.name,
        activeQuestion: nextQuestion,
        isTimerPaused: false,
        timerPausedAt: null,
        pausedAt: null,
        explodeAt: newExplodeAt,
        totalPausedDurationMs: newTotalPaused,
        timerStartedAt: now,
        lastActionMessage: `⚡ Guru mengoper bom secara manual ke ${nextHolder.name}!`,
        updatedAt: now,
      });

      return true;
    });
  } catch (err: any) {
    console.error('Transaction error in hostForcePassBomb:', err);
    return false;
  }
}

/**
 * Toggle Pause / Resume game by Host (Atomic Transaction)
 * Correctly preserves remaining countdown time by shifting explodeAt upon resume.
 */
export async function togglePauseGameSession(roomId: string, pause: boolean): Promise<boolean> {
  // Primary: Authoritative Server Endpoint
  try {
    const headers = await getGameAuthHeaders();
    const res = await fetch('/api/game-toggle-pause', {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomId, pause }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) return true;
    }
  } catch (err) {
    console.warn('Backend toggle pause fallback, executing transactional client fallback:', err);
  }

  // Resilient Transactional Fallback
  const roomRef = doc(db, GAME_COLLECTION, roomId);

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return false;

      const session = snap.data() as GameSession;
      const now = Date.now();

      if (pause) {
        // Only pause if currently playing
        if (session.status !== 'playing') return true;

        transaction.update(roomRef, {
          status: 'paused',
          isTimerPaused: true,
          timerPausedAt: now,
          pausedAt: now,
          lastActionMessage: '⏸️ Permainan dijeda sementara oleh Guru.',
          updatedAt: now,
        });
      } else {
        // Only resume if currently paused
        if (session.status !== 'paused') return true;

        const pausedAt = session.timerPausedAt || session.pausedAt || now;
        const pauseDuration = Math.max(0, now - pausedAt);
        const currentExplodeAt = session.explodeAt || now + (session.secretExplodeSeconds || 90) * 1000;
        const newExplodeAt = currentExplodeAt + pauseDuration;
        const newTotalPaused = (session.totalPausedDurationMs || 0) + pauseDuration;

        transaction.update(roomRef, {
          status: 'playing',
          isTimerPaused: false,
          timerPausedAt: null,
          pausedAt: null,
          explodeAt: newExplodeAt,
          totalPausedDurationMs: newTotalPaused,
          timerStartedAt: now,
          lastActionMessage: '▶️ Permainan dilanjutkan kembali!',
          updatedAt: now,
        });
      }

      return true;
    });
  } catch (err: any) {
    console.error('Transaction error in togglePauseGameSession fallback:', err);
    return false;
  }
}

/**
 * End Game Session by Host (Atomic Transaction)
 */
export async function endGameSession(roomId: string): Promise<boolean> {
  const roomRef = doc(db, GAME_COLLECTION, roomId);

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return false;

      const session = snap.data() as GameSession;
      if (session.status === 'ended') return true; // idempotent

      transaction.update(roomRef, {
        status: 'ended',
        currentHolderId: null,
        currentHolderName: null,
        isTimerPaused: false,
        lastActionMessage: 'Sesi permainan telah diakhiri oleh Guru.',
        updatedAt: Date.now(),
      });

      return true;
    });
  } catch (err: any) {
    console.error('Transaction error in endGameSession:', err);
    return false;
  }
}

/**
 * Safely parse a document timestamp to a numerical epoch millisecond value.
 * Handles numbers, Firestore Timestamp objects, ISO strings, or missing values.
 */
function normalizeTimestamp(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Subscribe to recent game sessions list (up to 15 rooms) for the admin/teacher monitor.
 * Optimized with Firestore server-side orderBy("updatedAt", "desc") and limit(15).
 * Gracefully handles legacy docs with missing/heterogeneous timestamps and fallback query.
 */
export function subscribeRecentGameSessions(
  onUpdate: (sessions: GameSession[]) => void,
  targetClass?: string
): () => void {
  const mapAndFilterDocs = (docs: any[]): GameSession[] => {
    let sessions = docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        updatedAt: normalizeTimestamp(data.updatedAt || data.createdAt),
      } as GameSession;
    });

    if (targetClass && targetClass !== 'ALL') {
      const cleanClass = targetClass.trim().toLowerCase();
      sessions = sessions.filter(
        (s) =>
          !s.targetClass ||
          s.targetClass === 'ALL' ||
          s.targetClass.trim().toLowerCase() === cleanClass
      );
    }

    // Stable sort in memory in case of timestamp tie-breakers or fallback query
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sessions;
  };

  // Primary: Server-side sorted and limited query directly on Firestore
  const primaryQuery = query(
    collection(db, GAME_COLLECTION),
    orderBy('updatedAt', 'desc'),
    limit(15)
  );

  let activeUnsub: (() => void) | null = null;
  let hasFallenBack = false;

  const startListening = (qToUse: any) => {
    return onSnapshot(
      qToUse,
      (snapshot) => {
        onUpdate(mapAndFilterDocs(snapshot.docs));
      },
      (err) => {
        // If server-side orderBy fails (e.g. index compiling, permissions, or missing field index),
        // fallback gracefully to standard limit(15) without interrupting the teacher monitor UI
        if (!hasFallenBack && (err?.code === 'failed-precondition' || err?.code === 'invalid-argument')) {
          console.warn('OrderBy query notice, falling back to standard limit query:', err.message);
          hasFallenBack = true;
          if (activeUnsub) activeUnsub();
          const fallbackQuery = query(collection(db, GAME_COLLECTION), limit(15));
          activeUnsub = startListening(fallbackQuery);
          return;
        }

        if (err?.code !== 'permission-denied') {
          console.warn('Game sessions query status:', err?.message || err);
        }
        onUpdate([]);
      }
    );
  };

  activeUnsub = startListening(primaryQuery);

  return () => {
    if (activeUnsub) activeUnsub();
  };
}

/**
 * Delete a room document after session finishes (cleans up subcollection players gracefully)
 */
export async function deleteGameSession(roomId: string): Promise<boolean> {
  const roomRef = doc(db, GAME_COLLECTION, roomId);
  const playersCol = collection(db, GAME_COLLECTION, roomId, 'players');

  try {
    const snap = await getDocs(playersCol);
    for (const d of snap.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }
  } catch (err) {
    console.warn('Notice cleaning up players subcollection on delete:', err);
  }

  await deleteDoc(roomRef);
  return true;
}

/**
 * Convert an IcebreakingPackage question item to GameQuestion with options arranged so that options[0]
 * is the correct answer in the master representation (matching the ICEBREAKING_QUESTIONS structure).
 */
export function convertPackageToGameQuestions(pkg: IcebreakingPackage): GameQuestion[] {
  if (!pkg || !Array.isArray(pkg.questions) || pkg.questions.length === 0) {
    return [];
  }

  const result: GameQuestion[] = pkg.questions.map((q, idx) => {
    const rawOptions = Array.isArray(q.options) ? [...q.options] : [];
    while (rawOptions.length < 4) {
      rawOptions.push(`Pilihan ${rawOptions.length + 1}`);
    }

    // Ensure correct answer is placed at index 0 for the internal master representation
    const correctIdx = typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < rawOptions.length
      ? q.correctAnswerIndex
      : 0;
    const correctText = rawOptions[correctIdx] || rawOptions[0] || '';
    const otherOptions = rawOptions.filter((_, i) => i !== correctIdx);
    const normalizedOptions = [correctText, ...otherOptions].slice(0, 4);

    return {
      id: q.id || `${pkg.id}_q_${idx + 1}`,
      questionText: q.questionText || '',
      options: normalizedOptions,
      correctAnswerIndex: 0,
      category: pkg.category || 'Kuis Ice Breaking',
      explanation: q.explanation || '',
    };
  });

  // Register with dynamic question registry for instant client teacher view / lookup
  registerDynamicQuestions(result);
  return result;
}

/**
 * Fetch questions for a given packageId with caching and dynamic registration
 */
export async function getQuestionPoolForPackage(packageId?: string): Promise<GameQuestion[]> {
  if (!packageId) {
    return ICEBREAKING_QUESTIONS;
  }

  if (packageQuestionsCache.has(packageId)) {
    const cached = packageQuestionsCache.get(packageId)!;
    if (cached.length > 0) return cached;
  }

  try {
    const packageRef = doc(db, ICEBREAKING_PACKAGES_COLLECTION, packageId);
    const snap = await getDoc(packageRef);
    if (snap.exists()) {
      const pkg = { id: snap.id, ...snap.data() } as IcebreakingPackage;
      const gameQs = convertPackageToGameQuestions(pkg);
      if (gameQs.length > 0) {
        packageQuestionsCache.set(packageId, gameQs);
        return gameQs;
      }
    }
  } catch (err) {
    console.warn('Notice fetching icebreaking package questions, fallback to default questions:', err);
  }

  return ICEBREAKING_QUESTIONS;
}

/**
 * Pick random question with support for dynamic packageId
 */
export async function pickRandomIcebreakingQuestionForSession(
  packageId?: string,
  excludeIds: string[] = []
): Promise<GameQuestion> {
  const pool = await getQuestionPoolForPackage(packageId);
  const available = pool.filter((q) => !excludeIds.includes(q.id));
  const chosen = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : pool[Math.floor(Math.random() * pool.length)];

  // Shuffle options for participants so position A/B/C/D is randomized
  const originalOptions = [...chosen.options];
  const shuffledOptions = [...originalOptions].sort(() => Math.random() - 0.5);

  return {
    ...chosen,
    options: shuffledOptions,
    // Do NOT leak correctAnswerIndex to participant
    correctAnswerIndex: undefined,
  };
}

/**
 * Synchronously pick a random question for an active session.
 * If the session is configured with questionPackageId and the pool is cached,
 * it picks from that package. Otherwise falls back to default questions.
 */
export function pickSessionQuestion(session: GameSession, excludeIds: string[] = []): GameQuestion {
  const pkgPool = session.questionPackageId ? packageQuestionsCache.get(session.questionPackageId) : null;
  if (pkgPool && pkgPool.length > 0) {
    const available = pkgPool.filter((q) => !excludeIds.includes(q.id));
    const chosen = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : pkgPool[Math.floor(Math.random() * pkgPool.length)];
    const shuffledOptions = [...chosen.options].sort(() => Math.random() - 0.5);
    return {
      ...chosen,
      options: shuffledOptions,
      correctAnswerIndex: undefined,
    };
  }
  return pickRandomIcebreakingQuestion(excludeIds);
}

/**
 * Real-time subscription to published icebreaking packages (for Teacher Host selection & Admin)
 */
export function subscribeIcebreakingPackages(
  onUpdate: (packages: IcebreakingPackage[]) => void
): () => void {
  const q = query(collection(db, ICEBREAKING_PACKAGES_COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: IcebreakingPackage[] = snapshot.docs.map((d) => {
        const data = d.data();
        const pkg: IcebreakingPackage = {
          id: d.id,
          title: data.title || 'Paket Tanpa Nama',
          description: data.description || '',
          category: data.category || 'Umum',
          questions: Array.isArray(data.questions) ? data.questions : [],
          totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : (data.questions?.length || 0),
          createdBy: data.createdBy || 'admin',
          isPublished: data.isPublished ?? true,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };

        // Pre-convert and cache questions
        const gameQs = convertPackageToGameQuestions(pkg);
        if (gameQs.length > 0) {
          packageQuestionsCache.set(pkg.id, gameQs);
        }

        return pkg;
      });

      onUpdate(list);
    },
    (err) => {
      console.warn('Realtime icebreaking packages subscription notice:', err?.message || err);
      onUpdate([]);
    }
  );
}

/**
 * Fetch all icebreaking packages once
 */
export async function fetchIcebreakingPackages(): Promise<IcebreakingPackage[]> {
  try {
    const snap = await getDocs(collection(db, ICEBREAKING_PACKAGES_COLLECTION));
    return snap.docs.map((d) => {
      const data = d.data();
      const pkg: IcebreakingPackage = {
        id: d.id,
        title: data.title || 'Paket Tanpa Nama',
        description: data.description || '',
        category: data.category || 'Umum',
        questions: Array.isArray(data.questions) ? data.questions : [],
        totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : (data.questions?.length || 0),
        createdBy: data.createdBy || 'admin',
        isPublished: data.isPublished ?? true,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      const gameQs = convertPackageToGameQuestions(pkg);
      if (gameQs.length > 0) {
        packageQuestionsCache.set(pkg.id, gameQs);
      }
      return pkg;
    });
  } catch (err) {
    console.warn('Notice fetching icebreaking packages:', err);
    return [];
  }
}

/**
 * Save or Update an Icebreaking Package in Firestore
 */
export async function saveIcebreakingPackage(pkg: Partial<IcebreakingPackage>): Promise<string> {
  const isNew = !pkg.id || pkg.id.startsWith('new_');
  const packageId = isNew ? `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : pkg.id!;
  const now = new Date().toISOString();

  const questions = Array.isArray(pkg.questions) ? pkg.questions : [];
  const fullPkg: IcebreakingPackage = {
    id: packageId,
    title: pkg.title || 'Paket Soal Baru',
    description: pkg.description || '',
    category: pkg.category || 'Umum',
    questions,
    totalQuestions: questions.length,
    createdBy: pkg.createdBy || 'admin',
    isPublished: pkg.isPublished ?? true,
    createdAt: pkg.createdAt || now,
    updatedAt: now,
  };

  const packageRef = doc(db, ICEBREAKING_PACKAGES_COLLECTION, packageId);
  await setDoc(packageRef, fullPkg, { merge: true });

  // Update in-memory caches
  const gameQs = convertPackageToGameQuestions(fullPkg);
  packageQuestionsCache.set(packageId, gameQs);

  return packageId;
}

/**
 * Delete an Icebreaking Package from Firestore
 */
export async function deleteIcebreakingPackage(packageId: string): Promise<boolean> {
  const packageRef = doc(db, ICEBREAKING_PACKAGES_COLLECTION, packageId);
  await deleteDoc(packageRef);
  packageQuestionsCache.delete(packageId);
  return true;
}
