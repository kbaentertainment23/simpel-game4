import { QuizQuestion, StudentQuizScoreInfo } from '../types';

/**
 * Single Standardized Data Contract for Student Quiz Scores.
 * Follows the strict rule:
 * percentage = Math.round((correctCount / totalQuestions) * 100)
 */
export interface NormalizedQuizScore {
  score: number;           // Raw correct answers (0 <= score <= totalQuestions)
  totalQuestions: number;  // Actual number of questions (totalQuestions > 0)
  percentage: number;      // 0 - 100 percentage
  isPassed: boolean;       // Meets KKM threshold
  hasAttempted: boolean;   // True if the student genuinely completed/attempted the quiz
  updatedAt: string;       // ISO timestamp
  isLegacy?: boolean;
  source: 'quiz_attempts' | 'legacy_scores' | 'calculated';
}

/**
 * Standardize KKM setting: converts scale 0-10 into 0-100, enforces boundaries 0-100.
 * Default is 80%.
 */
export function normalizeKkmPercent(kkmVal?: number | null): number {
  if (kkmVal === undefined || kkmVal === null || isNaN(Number(kkmVal))) {
    return 80;
  }
  const num = Number(kkmVal);
  if (num <= 0) return 80;
  // If stored on scale 0-10 (e.g. 8 or 7.5), convert to 0-100 once
  const scaled = num <= 10 ? Math.round(num * 10) : Math.round(num);
  return Math.max(0, Math.min(100, scaled));
}

/**
 * Flexible helper to determine if a selected answer index matches the question's correct answer.
 * Handles:
 * - number: 0, 1, 2, 3
 * - numeric string: "0", "1", "2", "3"
 * - letter string: "A", "B", "C", "D" (case-insensitive)
 * - question property fallback: correctAnswer or correctAnswerIndex
 */
export function isOptionCorrect(question: QuizQuestion | undefined | null, selectedIndex: number): boolean {
  if (!question || selectedIndex < 0) return false;

  const rawCorrect = (question as any).correctAnswerIndex ?? (question as any).correctAnswer ?? 0;

  // 1. Direct number match
  if (typeof rawCorrect === 'number') {
    return selectedIndex === rawCorrect;
  }

  // 2. String representation
  const strCorrect = String(rawCorrect).trim();

  // 2a. Numeric string "0", "1", etc.
  if (/^\d+$/.test(strCorrect)) {
    return selectedIndex === parseInt(strCorrect, 10);
  }

  // 2b. Letter string "A", "B", "C", "D"
  const upper = strCorrect.toUpperCase();
  if (upper.length === 1 && upper >= 'A' && upper <= 'D') {
    const letterIdx = upper.charCodeAt(0) - 65;
    return selectedIndex === letterIdx;
  }

  // 2c. Value match against options text
  if (Array.isArray(question.options) && question.options[selectedIndex] !== undefined) {
    const optText = question.options[selectedIndex].trim().toLowerCase();
    if (optText === strCorrect.toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes a question's correctAnswerIndex to guaranteed integer 0 <= index < options.length.
 */
export function getNormalizedCorrectIndex(question: QuizQuestion): number {
  const rawCorrect = (question as any).correctAnswerIndex ?? (question as any).correctAnswer ?? 0;
  if (typeof rawCorrect === 'number' && rawCorrect >= 0) {
    return rawCorrect;
  }
  const str = String(rawCorrect).trim();
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }
  const upper = str.toUpperCase();
  if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
    return upper.charCodeAt(0) - 65;
  }
  return 0;
}

/**
 * Pure function to calculate a quiz attempt's score with 100% mathematical integrity.
 * Guarantees:
 * - Each question is evaluated exactly once
 * - Score is computed directly from userAnswers array
 * - percentage is rounded to nearest integer between 0 and 100
 * - isPassed accurately checks both percentage and requiredCorrectCount against KKM
 */
export function calculateQuizResult(
  questions: QuizQuestion[],
  userAnswers: (number | undefined | null)[] | Record<number, number>,
  kkmPercentInput: number = 80
): {
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
  requiredCorrectCount: number;
  minQuizPercent: number;
} {
  const totalQuestions = Array.isArray(questions) ? questions.length : 0;
  if (totalQuestions <= 0) {
    return {
      score: 0,
      totalQuestions: 0,
      percentage: 0,
      isPassed: false,
      requiredCorrectCount: 0,
      minQuizPercent: normalizeKkmPercent(kkmPercentInput),
    };
  }

  let correctCount = 0;
  for (let i = 0; i < totalQuestions; i++) {
    const q = questions[i];
    const userAns = Array.isArray(userAnswers) ? userAnswers[i] : userAnswers[i];
    if (typeof userAns === 'number' && userAns >= 0 && isOptionCorrect(q, userAns)) {
      correctCount++;
    }
  }

  // Clamp correct count between 0 and totalQuestions
  const safeScore = Math.max(0, Math.min(totalQuestions, correctCount));
  const percentage = Math.round((safeScore / totalQuestions) * 100);

  const minQuizPercent = normalizeKkmPercent(kkmPercentInput);
  const requiredCorrectCount = Math.max(1, Math.ceil((minQuizPercent / 100) * totalQuestions));

  // A student passes if percentage >= KKM, or score >= requiredCorrectCount, or perfect score
  const isPassed =
    percentage >= minQuizPercent ||
    safeScore >= requiredCorrectCount ||
    (totalQuestions > 0 && safeScore >= totalQuestions);

  return {
    score: safeScore,
    totalQuestions,
    percentage,
    isPassed,
    requiredCorrectCount,
    minQuizPercent,
  };
}

/**
 * Normalizes any stored score record (from quizAttempts or scores) with backwards compatibility.
 * Solves:
 * - Data where attempt.percentage is valid but attempt.score is 0
 * - Data where attempt.score is valid but attempt.percentage is 0
 * - Legacy data having only scores[materialId]
 * - Distinguishes unattempted (hasAttempted = false) from legitimate 0 score
 */
export function normalizeQuizScoreRecord(
  attempt?: Partial<StudentQuizScoreInfo> | null,
  legacyScore?: number | string | null,
  fallbackTotalQuestions: number = 10,
  kkmInput: number = 80
): NormalizedQuizScore {
  const kkmPercent = normalizeKkmPercent(kkmInput);
  const defaultTotal = fallbackTotalQuestions > 0 ? fallbackTotalQuestions : 10;

  const hasAttempt = attempt !== null && attempt !== undefined;
  const hasLegacy = legacyScore !== null && legacyScore !== undefined && legacyScore !== '';

  if (!hasAttempt && !hasLegacy) {
    return {
      score: 0,
      totalQuestions: defaultTotal,
      percentage: 0,
      isPassed: false,
      hasAttempted: false,
      updatedAt: '',
      source: 'calculated',
    };
  }

  let rawScore: number | undefined = undefined;
  let rawPercent: number | undefined = undefined;
  let rawTotal: number | undefined = undefined;
  let updatedAt = '';

  if (hasAttempt) {
    if (typeof attempt.score === 'number' && !isNaN(attempt.score)) {
      rawScore = attempt.score;
    }
    if (typeof attempt.percentage === 'number' && !isNaN(attempt.percentage)) {
      rawPercent = attempt.percentage;
    }
    if (typeof attempt.totalQuestions === 'number' && attempt.totalQuestions > 0) {
      rawTotal = attempt.totalQuestions;
    }
    if (attempt.updatedAt) {
      updatedAt = String(attempt.updatedAt);
    }
  }

  const legacyNum = hasLegacy ? Number(legacyScore) : undefined;
  const validLegacyNum = typeof legacyNum === 'number' && !isNaN(legacyNum) ? legacyNum : undefined;

  const totalQuestions = rawTotal && rawTotal > 0 ? rawTotal : defaultTotal;

  let finalScore = 0;
  let finalPercent = 0;
  let isLegacy = false;
  let source: 'quiz_attempts' | 'legacy_scores' | 'calculated' = 'quiz_attempts';

  // Case 1: Both rawScore and rawPercent exist in attempt
  if (rawScore !== undefined && rawPercent !== undefined) {
    // Check if both are 0: genuine 0 attempt
    if (rawScore === 0 && rawPercent === 0) {
      finalScore = 0;
      finalPercent = 0;
    } else if (rawScore > 0 && rawPercent === 0) {
      // Heal: score was recorded but percentage was 0
      finalScore = Math.min(totalQuestions, rawScore);
      finalPercent = Math.round((finalScore / totalQuestions) * 100);
    } else if (rawScore === 0 && rawPercent > 0) {
      // Heal: percentage was recorded (e.g. 80%) but score was 0
      finalPercent = Math.min(100, rawPercent);
      finalScore = Math.min(totalQuestions, Math.round((finalPercent / 100) * totalQuestions));
    } else {
      // Harmonize: if percentage and score are consistent
      finalPercent = Math.min(100, Math.max(0, rawPercent));
      finalScore = Math.min(totalQuestions, Math.max(0, rawScore));
      // Re-verify mathematical consistency if score > totalQuestions
      if (finalScore > totalQuestions) {
        finalScore = totalQuestions;
        finalPercent = 100;
      }
    }
  }
  // Case 2: Only rawScore exists in attempt
  else if (rawScore !== undefined) {
    finalScore = Math.min(totalQuestions, Math.max(0, rawScore));
    finalPercent = totalQuestions > 0 ? Math.round((finalScore / totalQuestions) * 100) : 0;
  }
  // Case 3: Only rawPercent exists in attempt
  else if (rawPercent !== undefined) {
    finalPercent = Math.min(100, Math.max(0, rawPercent));
    finalScore = Math.min(totalQuestions, Math.round((finalPercent / 100) * totalQuestions));
  }
  // Case 4: Only legacyScore exists
  else if (validLegacyNum !== undefined) {
    isLegacy = true;
    source = 'legacy_scores';
    // If legacy is <= 10 and total is 10, it could be raw correct (e.g. 8/10) or scale 0-10
    if (validLegacyNum <= totalQuestions && validLegacyNum > 0 && totalQuestions <= 10) {
      finalScore = validLegacyNum;
      finalPercent = Math.min(100, Math.round((validLegacyNum / totalQuestions) * 100));
    } else if (validLegacyNum > 10) {
      finalPercent = Math.min(100, validLegacyNum);
      finalScore = Math.min(totalQuestions, Math.round((finalPercent / 100) * totalQuestions));
    } else {
      finalScore = validLegacyNum;
      finalPercent = totalQuestions > 0 ? Math.round((validLegacyNum / totalQuestions) * 100) : 0;
    }
  }

  // Perfect score guarantee
  if (finalPercent >= 100 || finalScore >= totalQuestions) {
    finalPercent = 100;
    finalScore = totalQuestions;
  }

  const reqCorrect = Math.max(1, Math.ceil((kkmPercent / 100) * totalQuestions));
  const isPassed =
    finalPercent >= 100 ||
    finalScore >= totalQuestions ||
    finalPercent >= kkmPercent ||
    finalScore >= reqCorrect;

  return {
    score: finalScore,
    totalQuestions,
    percentage: finalPercent,
    isPassed,
    hasAttempted: true,
    updatedAt: updatedAt || new Date().toISOString(),
    isLegacy,
    source,
  };
}
