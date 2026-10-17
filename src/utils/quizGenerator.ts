import { Material, QuizQuestion, FlashcardItem } from '../types';
import { getFallbackQuizBankQuestions } from './fallbackQuizBank';
import { getNormalizedCorrectIndex } from './quizScoring';

export function shuffleQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  if (!questions || questions.length === 0) return [];

  // 1. Fisher-Yates shuffle on the question array order
  const shuffledQuestions = [...questions];
  for (let i = shuffledQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
  }

  // 2. Fisher-Yates shuffle on options of each question and update correctAnswerIndex
  return shuffledQuestions.map((q) => {
    if (!q.options || q.options.length === 0) return q;

    const normIdx = getNormalizedCorrectIndex(q);
    const taggedOptions = q.options.map((opt, idx) => ({
      text: opt,
      isCorrect: idx === normIdx,
    }));

    for (let i = taggedOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [taggedOptions[i], taggedOptions[j]] = [taggedOptions[j], taggedOptions[i]];
    }

    const newCorrectIndex = taggedOptions.findIndex((t) => t.isCorrect);

    return {
      ...q,
      options: taggedOptions.map((t) => t.text),
      correctAnswerIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
    };
  });
}

export function getDefaultQuizQuestions(
  material: Material,
  categoryName?: string,
  subjectName?: string
): QuizQuestion[] {
  // 1. Prioritas Utama: Soal yang dipilih guru di menu Bank Soal Mini Kuis
  if (
    material.quizBankQuestions &&
    material.quizBankQuestions.length > 0 &&
    material.quizSelectedQuestionIds &&
    material.quizSelectedQuestionIds.length > 0
  ) {
    const selectedSet = new Set(material.quizSelectedQuestionIds);
    const selectedList = material.quizBankQuestions.filter((q) => selectedSet.has(q.id));
    if (selectedList.length > 0) {
      return material.quizRandomize !== false
        ? shuffleQuizQuestions(selectedList)
        : [...selectedList];
    }
  }

  // 2. Soal kurasi yang sudah diterbitkan oleh guru pada materi
  if (material.quizQuestions && material.quizQuestions.length > 0) {
    return material.quizRandomize !== false
      ? shuffleQuizQuestions(material.quizQuestions)
      : [...material.quizQuestions];
  }

  // 3. Jika materi memiliki bank soal namun belum sempat dikurasi, ambil 10 soal pertama
  if (material.quizBankQuestions && material.quizBankQuestions.length > 0) {
    const first10 = material.quizBankQuestions.slice(0, 10);
    return material.quizRandomize !== false
      ? shuffleQuizQuestions(first10)
      : [...first10];
  }

  // 4. Fallback substantif domain-aware dari bank soal lokal
  const fallbackPool = generateFallbackQuizBank(material, categoryName, subjectName);
  const first10Fallback = fallbackPool.slice(0, 10);
  return material.quizRandomize !== false
    ? shuffleQuizQuestions(first10Fallback)
    : [...first10Fallback];
}

/**
 * Mengambil paket soal pengayaan secara acak dari SISA bank soal yang BELUM dipilih oleh guru.
 * Contoh: Dari 30 butir bank soal, jika guru memilih 10 butir, maka sisa 20 butir diacak untuk pengayaan.
 */
export function getEnrichmentQuizQuestions(
  material: Material,
  categoryName?: string,
  subjectName?: string
): { questions: QuizQuestion[]; totalRemainingPool: number } {
  const bank = material.quizBankQuestions && material.quizBankQuestions.length > 0
    ? material.quizBankQuestions
    : generateFallbackQuizBank(material, categoryName, subjectName);

  // Kumpulkan semua ID soal yang sudah dipilih oleh guru untuk kuis resmi
  const teacherSelectedIds = new Set<string>();
  if (material.quizSelectedQuestionIds && material.quizSelectedQuestionIds.length > 0) {
    material.quizSelectedQuestionIds.forEach((id) => teacherSelectedIds.add(id));
  } else if (material.quizQuestions && material.quizQuestions.length > 0) {
    material.quizQuestions.forEach((q) => teacherSelectedIds.add(q.id));
  } else {
    // Default 10 pertama yang menjadi kuis resmi
    bank.slice(0, 10).forEach((q) => teacherSelectedIds.add(q.id));
  }

  // Filter sisa soal di bank yang BELUM dipilih oleh guru
  const unselectedQuestions = bank.filter((q) => !teacherSelectedIds.has(q.id));
  const totalRemainingPool = unselectedQuestions.length;

  if (unselectedQuestions.length > 0) {
    // Acak sisa soal yang belum dipilih oleh guru (10 sampai 29 soal sisa) untuk latihan pengayaan siswa juara
    const shuffled = shuffleQuizQuestions(unselectedQuestions);
    return {
      questions: shuffled,
      totalRemainingPool,
    };
  }

  // Jika semua soal telah terpilih (atau bank hanya sedikit), acak ulang seluruh bank sebagai pengayaan
  const shuffledAll = shuffleQuizQuestions(bank);
  return {
    questions: shuffledAll,
    totalRemainingPool: bank.length,
  };
}

export function formatTargetGradeLabel(targetGrade?: string): string {
  if (!targetGrade) return 'Semua Tingkat / Umum';
  const clean = String(targetGrade).trim().toLowerCase();
  
  if (clean === 'all' || clean === 'umum' || clean === 'semua' || clean === '*') {
    return 'Semua Tingkat (Umum)';
  }
  if (clean === 'smp-7' || clean === '7') {
    return 'Kelas 7 (SMP)';
  }
  if (clean === 'smp-8' || clean === '8') {
    return 'Kelas 8 (SMP)';
  }
  if (clean === 'smp-9' || clean === '9') {
    return 'Kelas 9 (SMP)';
  }
  if (clean === 'sma-10' || clean === '10') {
    return 'Kelas 10 (SMA/SMK)';
  }
  if (clean === 'sma-11' || clean === '11') {
    return 'Kelas 11 (SMA/SMK)';
  }
  if (clean === 'sma-12' || clean === '12') {
    return 'Kelas 12 (SMA/SMK)';
  }
  if (clean === 'sd-4-6' || clean === 'sd') {
    return 'SD Kelas 4-6 (Fase C)';
  }

  // If number
  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    return `Kelas ${numMatch[0]}`;
  }

  return targetGrade;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { auth } = await import('../lib/firebase');
    let user = auth.currentUser;
    if (!user) {
      const { signInAnonymously } = await import('firebase/auth');
      const cred = await signInAnonymously(auth).catch(() => null);
      user = cred?.user || auth.currentUser;
    }
    if (user) {
      const token = await user.getIdToken().catch(() => null);
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch {}
  return {};
}

export async function fetchAIGeneratedQuiz(
  material: Material,
  categoryName?: string,
  subjectName?: string,
  forceRefresh: boolean = false
): Promise<{ quizQuestions: QuizQuestion[]; flashcards: FlashcardItem[]; cached?: boolean } | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 28000) : null;
  const safeTitle = (material?.title && typeof material.title === 'string' && material.title.trim())
    ? material.title.trim()
    : 'Materi Pembelajaran';

  try {
    const authHeaders = await getAuthHeader();
    const res = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({
        title: safeTitle,
        description: material?.description || '',
        learningObjectives: material?.learningObjectives || '',
        categoryName: categoryName || '',
        subjectName: subjectName || '',
        targetGrade: material?.targetGrade || 'smp-7',
        forceRefresh,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('AI quiz generation endpoint returned non-OK status:', res.status, errText);
      const fallbackBank = getFallbackQuizBankQuestions(
        { ...material, title: safeTitle },
        categoryName,
        subjectName
      );
      return {
        quizQuestions: fallbackBank.slice(0, 10).map((q, idx) => ({ ...q, id: `quiz-${idx + 1}` })),
        flashcards: [],
      };
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (data && Array.isArray(data.quizQuestions) && data.quizQuestions.length > 0) {
      return {
        quizQuestions: data.quizQuestions,
        flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
      };
    }

    const fallbackBank = getFallbackQuizBankQuestions(
      { ...material, title: safeTitle },
      categoryName,
      subjectName
    );
    return {
      quizQuestions: fallbackBank.slice(0, 10).map((q, idx) => ({ ...q, id: `quiz-${idx + 1}` })),
      flashcards: [],
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('AI quiz generation request timed out after 28s. Falling back to curated questions.');
    } else {
      console.warn('AI quiz generation unavailable (network or server), using fallback:', err?.message || err);
    }
    const fallbackBank = getFallbackQuizBankQuestions(
      { ...material, title: safeTitle },
      categoryName,
      subjectName
    );
    return {
      quizQuestions: fallbackBank.slice(0, 10).map((q, idx) => ({ ...q, id: `quiz-${idx + 1}` })),
      flashcards: [],
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Generates 30 structured, high-quality fallback questions based strictly on Judul and TP
 * in case of network interruption or offline development environment.
 */
export function generateFallbackQuizBank(
  material: Material,
  categoryName?: string,
  subjectName?: string,
  _customObjectives?: string
): QuizQuestion[] {
  return getFallbackQuizBankQuestions(material, categoryName, subjectName);
}

export interface FetchQuizBankResult {
  quizQuestions: QuizQuestion[];
  totalCount: number;
  modelUsed?: string;
  error?: string;
  warning?: string;
  isFallback?: boolean;
}

export async function fetchAIGeneratedQuizBank(
  material: Material,
  categoryName?: string,
  subjectName?: string,
  customObjectives?: string,
  materialContentSnippet?: string,
  forceRefresh: boolean = false
): Promise<FetchQuizBankResult> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 28000) : null;
  const safeTitle = (material?.title && typeof material.title === 'string' && material.title.trim())
    ? material.title.trim()
    : 'Materi Pembelajaran';

  try {
    const authHeaders = await getAuthHeader();
    const res = await fetch('/api/generate-quiz-bank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({
        materialId: material?.id || 'temp-mat',
        title: safeTitle,
        description: material?.description || '',
        learningObjectives: (customObjectives || material?.learningObjectives || '').trim(),
        materialText: materialContentSnippet || '',
        categoryName: categoryName || '',
        subjectName: subjectName || '',
        targetGrade: material?.targetGrade || 'smp-7',
        forceRefresh,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errMsg = '';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errJson.message;
      } catch {}

      if (!errMsg) {
        if (res.status === 504) {
          errMsg = 'Vercel Serverless Timeout (504): Proses AI di server melebihi batas waktu serverless.';
        } else if (res.status === 404) {
          errMsg = 'Endpoint /api/generate-quiz-bank tidak ditemukan (404). Pastikan konfigurasi vercel.json sudah aktif.';
        } else if (errText.includes('FUNCTION_INVOCATION_FAILED')) {
          errMsg = 'Serverless Vercel function sedang restart atau variabel GEMINI_API_KEY belum disetel di Vercel Settings.';
        } else {
          errMsg = `Server error HTTP ${res.status}: ${errText.slice(0, 150)}`;
        }
      }

      console.warn('AI quiz bank endpoint returned non-OK status:', res.status, errMsg);
      const fallbackQuestions = getFallbackQuizBankQuestions(
        { ...material, title: safeTitle },
        categoryName,
        subjectName
      ).slice(0, 30);
      return {
        quizQuestions: fallbackQuestions,
        totalCount: fallbackQuestions.length,
        isFallback: true,
        warning: 'Menyajikan 30 butir bank soal kurasi materi kurikulum.',
      };
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (data && Array.isArray(data.quizQuestions) && data.quizQuestions.length > 0) {
      return {
        quizQuestions: data.quizQuestions,
        totalCount: data.totalCount || data.quizQuestions.length,
        modelUsed: data.modelUsed,
        warning: data.warning,
        isFallback: data.isFallback,
      };
    }

    const fallbackQuestions = getFallbackQuizBankQuestions(
      { ...material, title: safeTitle },
      categoryName,
      subjectName
    ).slice(0, 30);
    return {
      quizQuestions: fallbackQuestions,
      totalCount: fallbackQuestions.length,
      isFallback: true,
      warning: data?.warning || 'Menyajikan 30 butir bank soal kurasi materi kurikulum.',
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    const msg = isTimeout
      ? 'Koneksi ke AI serverless timeout setelah 28 detik.'
      : err?.message || 'Gagal terhubung ke API server.';
    console.warn('AI quiz bank request failed:', msg);
    const fallbackQuestions = getFallbackQuizBankQuestions(
      { ...material, title: safeTitle },
      categoryName,
      subjectName
    ).slice(0, 30);
    return {
      quizQuestions: fallbackQuestions,
      totalCount: fallbackQuestions.length,
      isFallback: true,
      warning: 'Menyajikan 30 butir bank soal kurasi materi kurikulum.',
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
