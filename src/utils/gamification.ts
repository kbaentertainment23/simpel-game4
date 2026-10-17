import { StudentGamificationData } from '../types';

export interface BadgeInfo {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt?: string;
}

export interface GamificationState {
  exp: number;
  level: number;
  unlockedBadges: string[]; // Badge IDs
  dailyStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  quizzesCompleted: number;
  perfectQuizzes: number;
  flashcardsFlipped: number;
}

export const GAMIFICATION_LEVELS = [
  { level: 1, title: 'Pembelajar Pemula', minExp: 0, maxExp: 100, icon: '🌱' },
  { level: 2, title: 'Pembuka Wawasan', minExp: 100, maxExp: 250, icon: '📖' },
  { level: 3, title: 'Penalari Kritis', minExp: 250, maxExp: 500, icon: '⚡' },
  { level: 4, title: 'Penjelajah Topik', minExp: 500, maxExp: 1000, icon: '🚀' },
  { level: 5, title: 'Master 8 Dimensi', minExp: 1000, maxExp: 2000, icon: '👑' },
  { level: 6, title: 'Cendekia Utama', minExp: 2000, maxExp: 99999, icon: '🏆' },
];

export const ALL_BADGES: BadgeInfo[] = [
  {
    id: 'perfect_score',
    title: 'Skor Sempurna 🎯',
    description: 'Meraih nilai 100% pada pengerjaan mini kuis',
    icon: '🎯',
    color: 'from-amber-500 to-yellow-500',
  },
  {
    id: 'speed_master',
    title: 'Cepat & Tangkas ⚡',
    description: 'Menyelesaikan kuis dalam Mode Tantangan Waktu',
    icon: '⚡',
    color: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'explorer_5',
    title: 'Penjelajah Materi 🚀',
    description: 'Menyelesaikan 5 modul materi pembelajaran',
    icon: '🚀',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'explorer_10',
    title: 'Master Penjelajah 🧭',
    description: 'Menyelesaikan 10 modul materi pembelajaran',
    icon: '🧭',
    color: 'from-indigo-600 to-violet-600',
  },
  {
    id: 'kkm_champion',
    title: 'Juara Ketuntasan 🏆',
    description: 'Lulus KKM kuis dengan hasil memuaskan',
    icon: '🏆',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'duta_8dimensi',
    title: 'Duta 8 Dimensi 🌟',
    description: 'Menyelesaikan materi kuis profil lulusan',
    icon: '🌟',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'study_notes_pro',
    title: 'Pena Cendekia 📝',
    description: 'Membuat catatan belajar mandiri pada materi',
    icon: '📝',
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'bookmark_fan',
    title: 'Kolektor Materi 🔖',
    description: 'Menyimpan bookmark materi pembelajaran penting',
    icon: '🔖',
    color: 'from-rose-500 to-pink-500',
  },
  {
    id: 'flashcard_pro',
    title: 'Master Kartu 🎴',
    description: 'Membalik & mempelajari 5 kartu flashcard',
    icon: '🎴',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'streak_3days',
    title: 'Penjaga Api 🔥',
    description: 'Mempertahankan konsistensi belajar (Streak 3 hari)',
    icon: '🔥',
    color: 'from-orange-500 to-rose-500',
  },
];

const DEFAULT_STORAGE_KEY = 'sistem_materi_gamification_v1';

function getStorageKey(studentId?: string): string {
  if (studentId) {
    return `sistem_materi_gamification_${studentId}`;
  }
  return DEFAULT_STORAGE_KEY;
}

export function getGamificationState(studentId?: string): GamificationState {
  const key = getStorageKey(studentId);
  try {
    const saved = localStorage.getItem(key) || (!studentId ? localStorage.getItem(DEFAULT_STORAGE_KEY) : null);
    if (saved && saved !== 'null' && saved !== 'undefined') {
      const parsed = JSON.parse(saved) as GamificationState;
      if (parsed && typeof parsed === 'object') {
        // Update Daily Streak
        const today = new Date().toISOString().split('T')[0];
        if (parsed.lastActiveDate !== today) {
          const lastDate = new Date(parsed.lastActiveDate || today);
          const nowDate = new Date(today);
          const diffDays = Math.floor((nowDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

          if (diffDays === 1) {
            parsed.dailyStreak = (parsed.dailyStreak || 0) + 1;
          } else if (diffDays > 1) {
            parsed.dailyStreak = 1;
          }
          parsed.lastActiveDate = today;
          saveGamificationState(parsed, studentId);
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading gamification state:', e);
  }

  const initialState: GamificationState = {
    exp: 0,
    level: 1,
    unlockedBadges: [],
    dailyStreak: 1,
    lastActiveDate: new Date().toISOString().split('T')[0],
    quizzesCompleted: 0,
    perfectQuizzes: 0,
    flashcardsFlipped: 0,
  };
  saveGamificationState(initialState, studentId);
  return initialState;
}

export function saveGamificationState(state: GamificationState, studentId?: string): void {
  const key = getStorageKey(studentId);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn('Error saving gamification state:', e);
  }
}

/**
 * Returns a complete, valid, non-undefined StudentGamificationData object.
 * Preserves all valid existing values (exp/points, badges, streak, level, stats),
 * while substituting safe defaults for missing or undefined fields.
 * Guarantees Firestore WriteBatch.set / setDoc / updateDoc will NEVER receive undefined.
 */
export function getDefaultGamificationData(
  existing?: Partial<StudentGamificationData> | null
): StudentGamificationData {
  const today = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  // Safely extract points / exp using nullish coalescing
  const expVal =
    typeof existing?.exp === 'number' && !isNaN(existing.exp)
      ? existing.exp
      : (typeof existing?.points === 'number' && !isNaN(existing.points) ? existing.points : 0);

  // Safely extract unlocked badges using nullish coalescing
  const badgesVal = Array.isArray(existing?.unlockedBadges)
    ? existing.unlockedBadges.filter(Boolean)
    : (Array.isArray(existing?.badges) ? existing.badges.filter(Boolean) : []);

  // Safely extract streak using nullish coalescing
  const streakVal =
    typeof existing?.dailyStreak === 'number' && !isNaN(existing.dailyStreak)
      ? existing.dailyStreak
      : (typeof existing?.streak === 'number' && !isNaN(existing.streak) ? existing.streak : 0);

  // Safely extract level using nullish coalescing
  const levelVal =
    typeof existing?.level === 'number' && !isNaN(existing.level) && existing.level >= 1
      ? existing.level
      : 1;

  return {
    exp: expVal,
    points: expVal,
    level: levelVal,
    unlockedBadges: badgesVal,
    badges: badgesVal,
    dailyStreak: streakVal,
    streak: streakVal,
    lastActiveDate: existing?.lastActiveDate || today,
    quizzesCompleted:
      typeof existing?.quizzesCompleted === 'number' && !isNaN(existing.quizzesCompleted)
        ? existing.quizzesCompleted
        : 0,
    perfectQuizzes:
      typeof existing?.perfectQuizzes === 'number' && !isNaN(existing.perfectQuizzes)
        ? existing.perfectQuizzes
        : 0,
    flashcardsFlipped:
      typeof existing?.flashcardsFlipped === 'number' && !isNaN(existing.flashcardsFlipped)
        ? existing.flashcardsFlipped
        : 0,
    updatedAt: existing?.updatedAt || nowIso,
  };
}

export function getCurrentLevelInfo(exp: number) {
  const current = GAMIFICATION_LEVELS.find((l) => exp >= l.minExp && exp < l.maxExp) || GAMIFICATION_LEVELS[GAMIFICATION_LEVELS.length - 1];
  const nextLevel = GAMIFICATION_LEVELS.find((l) => l.level === current.level + 1);
  return {
    ...current,
    nextLevelMinExp: nextLevel ? nextLevel.minExp : current.maxExp,
  };
}

export function addExp(amount: number, studentId?: string): { newState: GamificationState; leveledUp: boolean; newLevel: number; earnedBadges: BadgeInfo[] } {
  const state = getGamificationState(studentId);
  const oldLevelInfo = getCurrentLevelInfo(state.exp);
  
  state.exp += amount;
  const newLevelInfo = getCurrentLevelInfo(state.exp);
  const leveledUp = newLevelInfo.level > oldLevelInfo.level;
  state.level = newLevelInfo.level;

  const earnedBadges: BadgeInfo[] = [];

  // Check 3-day streak badge
  if (state.dailyStreak >= 3 && !state.unlockedBadges.includes('streak_3days')) {
    state.unlockedBadges.push('streak_3days');
    const badge = ALL_BADGES.find((b) => b.id === 'streak_3days');
    if (badge) earnedBadges.push(badge);
  }

  saveGamificationState(state, studentId);

  if (leveledUp) {
    playAudioFx('level_up');
  } else if (amount > 0) {
    playAudioFx('exp');
  }

  return { newState: state, leveledUp, newLevel: state.level, earnedBadges };
}

export function recordQuizCompletion(
  score: number,
  totalQuestions: number,
  isTimeAttack: boolean,
  studentId?: string
): { state: GamificationState; newBadges: BadgeInfo[] } {
  const state = getGamificationState(studentId);
  state.quizzesCompleted += 1;
  const isPerfect = score === totalQuestions && totalQuestions > 0;
  if (isPerfect) state.perfectQuizzes += 1;

  const newBadges: BadgeInfo[] = [];

  // Perfect Score badge
  if (isPerfect && !state.unlockedBadges.includes('perfect_score')) {
    state.unlockedBadges.push('perfect_score');
    const b = ALL_BADGES.find((badge) => badge.id === 'perfect_score');
    if (b) newBadges.push(b);
  }

  // Speed Master badge
  if (isTimeAttack && !state.unlockedBadges.includes('speed_master')) {
    state.unlockedBadges.push('speed_master');
    const b = ALL_BADGES.find((badge) => badge.id === 'speed_master');
    if (b) newBadges.push(b);
  }

  // KKM Champion (score >= 80% or >= 8)
  const isPassedKKM = totalQuestions > 0 && (score / totalQuestions) >= 0.8;
  if (isPassedKKM && !state.unlockedBadges.includes('kkm_champion')) {
    state.unlockedBadges.push('kkm_champion');
    const b = ALL_BADGES.find((badge) => badge.id === 'kkm_champion');
    if (b) newBadges.push(b);
  }

  // Duta 8 Dimensi badge
  if (score >= 3 && !state.unlockedBadges.includes('duta_8dimensi')) {
    state.unlockedBadges.push('duta_8dimensi');
    const b = ALL_BADGES.find((badge) => badge.id === 'duta_8dimensi');
    if (b) newBadges.push(b);
  }

  // Add EXP for quiz completion
  const quizExp = isPerfect ? 100 : (score * 10);
  state.exp += quizExp;
  const levelInfo = getCurrentLevelInfo(state.exp);
  state.level = levelInfo.level;

  saveGamificationState(state, studentId);

  if (newBadges.length > 0) {
    playAudioFx('badge');
  }

  return { state, newBadges };
}

export function recordMaterialCompletion(completedCount: number, studentId?: string): { state: GamificationState; newBadges: BadgeInfo[] } {
  const state = getGamificationState(studentId);
  const newBadges: BadgeInfo[] = [];

  if (completedCount >= 5 && !state.unlockedBadges.includes('explorer_5')) {
    state.unlockedBadges.push('explorer_5');
    const b = ALL_BADGES.find((badge) => badge.id === 'explorer_5');
    if (b) newBadges.push(b);
  }

  if (completedCount >= 10 && !state.unlockedBadges.includes('explorer_10')) {
    state.unlockedBadges.push('explorer_10');
    const b = ALL_BADGES.find((badge) => badge.id === 'explorer_10');
    if (b) newBadges.push(b);
  }

  saveGamificationState(state, studentId);
  if (newBadges.length > 0) {
    playAudioFx('badge');
  }
  return { state, newBadges };
}

export function recordNoteCreated(studentId?: string): { state: GamificationState; newBadges: BadgeInfo[] } {
  const state = getGamificationState(studentId);
  const newBadges: BadgeInfo[] = [];

  if (!state.unlockedBadges.includes('study_notes_pro')) {
    state.unlockedBadges.push('study_notes_pro');
    const b = ALL_BADGES.find((badge) => badge.id === 'study_notes_pro');
    if (b) newBadges.push(b);
  }

  state.exp += 15;
  const levelInfo = getCurrentLevelInfo(state.exp);
  state.level = levelInfo.level;

  saveGamificationState(state, studentId);
  if (newBadges.length > 0) {
    playAudioFx('badge');
  }
  return { state, newBadges };
}

export function recordBookmarkToggled(isBookmarked: boolean, studentId?: string): { state: GamificationState; newBadges: BadgeInfo[] } {
  const state = getGamificationState(studentId);
  const newBadges: BadgeInfo[] = [];

  if (isBookmarked && !state.unlockedBadges.includes('bookmark_fan')) {
    state.unlockedBadges.push('bookmark_fan');
    const b = ALL_BADGES.find((badge) => badge.id === 'bookmark_fan');
    if (b) newBadges.push(b);
  }

  if (isBookmarked) {
    state.exp += 10;
    const levelInfo = getCurrentLevelInfo(state.exp);
    state.level = levelInfo.level;
  }

  saveGamificationState(state, studentId);
  if (newBadges.length > 0) {
    playAudioFx('badge');
  }
  return { state, newBadges };
}

/**
 * Calculates student gamification summary from progress record,
 * automatically computing total EXP, Level, and Badges for Leaderboard display.
 */
export function calculateStudentGamification(progress: {
  completedMaterialIds?: string[];
  scores?: Record<string, number>;
  notes?: Record<string, string>;
  bookmarkedMaterialIds?: string[];
  gamification?: Partial<GamificationState>;
}): GamificationState & { badges: BadgeInfo[] } {
  const completedCount = progress.completedMaterialIds?.length || 0;
  const scoresObj = progress.scores || {};
  const scoresList = Object.values(scoresObj);
  const quizCount = scoresList.length;
  const perfectCount = scoresList.filter((s) => s >= 100).length;
  const passedKkmCount = scoresList.filter((s) => s >= 80).length;
  const notesCount = Object.keys(progress.notes || {}).length;
  const bookmarksCount = (progress.bookmarkedMaterialIds || []).length;

  const savedGamification = progress.gamification;

  // Compute total EXP based on achievements + stored bonus
  let calculatedExp = (completedCount * 30) +
    scoresList.reduce((acc, s) => acc + Math.round((s / 100) * 50), 0) +
    (perfectCount * 50) +
    (notesCount * 15) +
    (bookmarksCount * 10);

  if (savedGamification?.exp && savedGamification.exp > calculatedExp) {
    calculatedExp = savedGamification.exp;
  }

  const levelInfo = getCurrentLevelInfo(calculatedExp);

  // Compute unlocked badges
  const unlockedSet = new Set<string>(savedGamification?.unlockedBadges || []);

  if (perfectCount > 0) unlockedSet.add('perfect_score');
  if (passedKkmCount > 0) unlockedSet.add('kkm_champion');
  if (completedCount >= 5) unlockedSet.add('explorer_5');
  if (completedCount >= 10) unlockedSet.add('explorer_10');
  if (notesCount > 0) unlockedSet.add('study_notes_pro');
  if (bookmarksCount > 0) unlockedSet.add('bookmark_fan');
  if (quizCount >= 2) unlockedSet.add('duta_8dimensi');

  const unlockedBadges = Array.from(unlockedSet);
  const badges = ALL_BADGES.filter((b) => unlockedSet.has(b.id));

  return {
    exp: calculatedExp,
    level: levelInfo.level,
    unlockedBadges,
    dailyStreak: savedGamification?.dailyStreak || 1,
    lastActiveDate: savedGamification?.lastActiveDate || new Date().toISOString().split('T')[0],
    quizzesCompleted: Math.max(quizCount, savedGamification?.quizzesCompleted || 0),
    perfectQuizzes: Math.max(perfectCount, savedGamification?.perfectQuizzes || 0),
    flashcardsFlipped: savedGamification?.flashcardsFlipped || 0,
    badges,
  };
}

// Shared AudioContext instance for high performance and zero memory leaks on mobile
let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Sound effects generator via Web Audio API with zero frame drop
export function playAudioFx(type: 'exp' | 'level_up' | 'badge' | 'correct' | 'wrong' | 'pop') {
  // Use requestAnimationFrame / microtask so audio execution doesn't block touch input response
  if (typeof window === 'undefined') return;
  
  requestAnimationFrame(() => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;

      if (type === 'exp') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'level_up') {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
          gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.1);
          osc.stop(ctx.currentTime + idx * 0.1 + 0.25);
        });
      } else if (type === 'badge') {
        const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.2);
        });
      } else if (type === 'correct') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'wrong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch {
      // Audio Context fail fallback
    }
  });
}
