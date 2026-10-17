import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { getFallbackQuizBankQuestions } from './fallbackQuizBank.ts';

export function getGeminiApiKey(): string | undefined {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_APIKEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.VITE_GEMINI_KEY;
  if (!key) return undefined;
  const trimmed = key.trim();
  // Strip optional quotes if user accidentally pasted with quotes in Vercel UI
  return trimmed.replace(/^["']|["']$/g, '');
}

export interface GenerateQuizParams {
  title: string;
  description?: string;
  categoryName?: string;
  subjectName?: string;
  targetGrade?: string;
  learningObjectives?: string;
  forceRefresh?: boolean;
}

// In-memory cache to make repeated generation instantaneous (< 50ms)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const quizCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

const TARGET_GRADE_MAP: Record<string, { label: string; levelDesc: string }> = {
  'smp-7': {
    label: 'SMP Kelas 7 (Fase D)',
    levelDesc:
      'Gunakan Bahasa Indonesia baku yang lugas, komunikatif, dan mudah dipahami siswa remaja SMP usia 12-13 tahun. Kuis fokus pada pemahaman konsep dasar, istilah penting sederhana, serta contoh situasi nyata sehari-hari. HINDARI istilah akademis tinggi atau istilah teknis perguruan tinggi yang membingungkan.',
  },
  'smp-8': {
    label: 'SMP Kelas 8 (Fase D)',
    levelDesc:
      'Gunakan Bahasa Indonesia baku yang jelas untuk siswa SMP usia 13-14 tahun. Soal berkategori sedang/dasar, menghubungkan konsep dengan penerapan praktis, tidak terlalu rumit, dan mudah dipikirkan secara logis oleh siswa SMP kelas 8.',
  },
  'smp-9': {
    label: 'SMP Kelas 9 (Fase D)',
    levelDesc:
      'Gunakan Bahasa Indonesia baku untuk siswa SMP usia 14-15 tahun. Soal menguji pemahaman dan analisis sederhana tanpa jebakan istilah teknis tinggi yang berlebihan. Pas untuk tingkat akhir SMP.',
  },
  'sma-10': {
    label: 'SMA / SMK Kelas 10 (Fase E)',
    levelDesc:
      'Gunakan Bahasa Indonesia baku yang menarik untuk siswa SMA/SMK kelas 10 (usia 15-16 tahun). Soal menguji fondasi konsep SMA/SMK, penalaran logis, dan penerapan praktis dengan tingkat kesulitan yang proporsional.',
  },
  'sma-11': {
    label: 'SMA / SMK Kelas 11 (Fase F)',
    levelDesc:
      'Gunakan Bahasa Indonesia baku untuk siswa SMA/SMK kelas 11 (usia 16-17 tahun). Soal melatih penalaran kritis, studi kasus, dan analisis menengah sesuai kurikulum kelas 11.',
  },
  'sma-12': {
    label: 'SMA / SMK Kelas 12 (Fase F)',
    levelDesc:
      'Gunakan Bahasa Indonesia baku untuk siswa SMA/SMK kelas 12 (usia 17-18 tahun). Soal melatih pemahaman komprehensif, persiapan ujian, dan pemecahan masalah kritis.',
  },
  'sd-4-6': {
    label: 'SD Kelas 4-6 (Fase C)',
    levelDesc:
      'Gunakan bahasa yang sangat sederhana, ramah anak usia 9-12 tahun, kalimat pendek dan jelas. Soal bersifat konkrit, langsung ke konsep utama, dan sangat terjangkau.',
  },
  'umum': {
    label: 'Umum / Semua Tingkatan',
    levelDesc:
      'Gunakan bahasa yang fleksibel, komunikatif, dan seimbang yang dapat dipahami oleh berbagai kalangan siswa.',
  },
};

export function resolveGradeInfo(grade?: string): { label: string; levelDesc: string } {
  if (!grade) return TARGET_GRADE_MAP['smp-7'];
  const clean = String(grade).toLowerCase().trim();
  if (TARGET_GRADE_MAP[clean]) return TARGET_GRADE_MAP[clean];
  if (clean === '7' || clean.includes('smp-7') || clean.includes('kelas 7') || clean.includes('fase d')) {
    return TARGET_GRADE_MAP['smp-7'];
  }
  if (clean === '8' || clean.includes('smp-8') || clean.includes('kelas 8')) {
    return TARGET_GRADE_MAP['smp-8'];
  }
  if (clean === '9' || clean.includes('smp-9') || clean.includes('kelas 9')) {
    return TARGET_GRADE_MAP['smp-9'];
  }
  if (
    clean === '10' ||
    clean.includes('sma-10') ||
    clean.includes('smk-10') ||
    clean.includes('kelas 10') ||
    clean.includes('fase e')
  ) {
    return TARGET_GRADE_MAP['sma-10'];
  }
  if (
    clean === '11' ||
    clean.includes('sma-11') ||
    clean.includes('smk-11') ||
    clean.includes('kelas 11') ||
    clean.includes('fase f')
  ) {
    return TARGET_GRADE_MAP['sma-11'];
  }
  if (clean === '12' || clean.includes('sma-12') || clean.includes('smk-12') || clean.includes('kelas 12')) {
    return TARGET_GRADE_MAP['sma-12'];
  }
  if (clean.includes('sd') || clean.includes('fase c')) {
    return TARGET_GRADE_MAP['sd-4-6'];
  }
  if (clean === 'all' || clean === 'umum') {
    return {
      label: 'SMP Kelas 7-9 (Fase D)',
      levelDesc:
        'Gunakan Bahasa Indonesia baku yang komunikatif dan lugas untuk siswa sekolah menengah (SMP usia 12-15 tahun). Kuis fokus pada pemahaman konsep dasar, hitungan praktis, istilah penting, dan skenario nyata.',
    };
  }
  return TARGET_GRADE_MAP['smp-7'];
}

/**
 * Strips away any unintentional meta-academic or TP quoting phrases from question stems.
 */
function cleanQuestionStem(qText: string, title: string): string {
  let cleaned = (qText || '').trim();

  // Strip leading "Berdasarkan Tujuan Pembelajaran (TP): ..." or "Berdasarkan TP..."
  cleaned = cleaned.replace(/^berdasarkan\s+(tujuan\s+pembelajaran(\s*\(tp\))?|tp)[\s\S]*?(?:,\s*|\.\s*|\?\s*)/i, '');

  // Strip "Menurut materi [title],"
  cleaned = cleaned.replace(/^menurut\s+materi[\s\S]*?(?:,\s*|\.\s*)/i, '');

  // If question is a stiff meta-question asking what must be mastered:
  if (/apa konsep paling mendasar yang harus kamu kuasai/i.test(cleaned)) {
    cleaned = `Dalam konsep "${title}", prinsip mendasar yang menjadi landasan cara kerja sistem adalah...`;
  }

  // Ensure capitalization
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned || `Bagaimanakah prinsip dasar dari "${title}" dalam pemanfaatannya?`;
}

export async function generateQuizQuestionsWithAI(params: GenerateQuizParams) {
  const apiKey = getGeminiApiKey();
  const rawTitle = params?.title && typeof params.title === 'string' ? params.title.trim() : '';
  const isMissingTitle = !rawTitle;
  const title = rawTitle || 'Materi Pembelajaran';
  const { description, targetGrade, learningObjectives, forceRefresh } = params || {};

  // Fallback helper in case of missing API key or generation failure
  const getCuratedFallback = () => {
    const nowStr = new Date().toISOString();
    const fallbackBank = getFallbackQuizBankQuestions(
      {
        id: 'gen-fallback-10',
        title,
        description: description || '',
        learningObjectives: learningObjectives || '',
        type: 'other',
        originalUrl: '',
        embedUrl: '',
        order: 1,
        isPublished: true,
        categoryId: '',
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      params?.categoryName,
      params?.subjectName
    );
    return {
      quizQuestions: fallbackBank.slice(0, 10).map((q, idx) => ({ ...q, id: `quiz-${idx + 1}` })),
      flashcards: [],
      isFallback: true,
      warning: isMissingTitle
        ? 'Judul materi belum diisi. Menggunakan bank soal kurasi materi pembelajaran.'
        : !apiKey
        ? 'Variabel GEMINI_API_KEY belum terkonfigurasi di Vercel Environment Variables. Menggunakan bank soal kurasi.'
        : undefined,
    };
  };

  if (isMissingTitle) {
    console.warn('[QuizAI] Judul materi kosong. Menggunakan bank soal kurasi.');
    return getCuratedFallback();
  }

  if (!apiKey) {
    console.warn('[QuizAI] GEMINI_API_KEY tidak ditemukan. Menggunakan bank soal kurasi.');
    return getCuratedFallback();
  }

  // 1. High-speed cache lookup (sub-50ms response for identical content)
  const normTitle = title.trim().toLowerCase();
  const normGrade = (targetGrade || 'smp-7').toLowerCase();
  const normObj = (learningObjectives || '').trim().toLowerCase();
  const cacheKey = `quiz10-v5::${normTitle}::${normGrade}::${normObj}`;

  if (!forceRefresh) {
    const cached = quizCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.data,
        cached: true,
      };
    }
  }

  const targetInfo = resolveGradeInfo(targetGrade);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const objectivesText =
    learningObjectives && learningObjectives.trim()
      ? learningObjectives.trim()
      : `Memahami pengertian, karakteristik, fungsi, serta contoh penerapan praktis konsep "${title}" dalam kehidupan sehari-hari.`;

  const prompt = `INSTRUKSI ASESMEN PEMBELAJARAN (PEDAGOGICAL DECONSTRUCTION):
Anda bertindak sebagai guru penyusun soal ujian sekolah yang profesional.
Lakukan DEKONSTRUKSI PEDAGOGIS: Jadikan Tujuan Pembelajaran (TP) sebagai panduan internal materi Anda, BUKAN untuk dibaca atau dikutip kepada siswa.

1. INFORMASI MATERI:
   - Topik / Materi: "${title}"
   ${params.categoryName ? `- Bab / Kategori: "${params.categoryName}"` : ''}
   ${params.subjectName ? `- Mata Pelajaran: "${params.subjectName}"` : ''}
   ${description ? `- Ringkasan Konten: "${description}"` : ''}
   - Sasaran Peserta Didik: ${targetInfo.label} (${targetInfo.levelDesc})

2. PANDUAN RUANG LINGKUP CAPAIAN (INTERNAL GURU - JANGAN DIKUTIP KE SOAL):
   "${objectivesText}"

3. PETUNJUK PENERJEMAHAN TP MENJADI SOAL SUBSTANTIF NYATA:
   - Jika TP membahas perhitungan/konversi (misal biner ke desimal): Buat soal HITUNGAN LANGSUNG (Contoh: "Berapakah nilai desimal dari bilangan biner 1010?", "Jika sebuah perangkat membaca biner 1101, nilai desimalnya adalah...").
   - Jika TP membahas kodifikasi (misal tabel ASCII, format data): Buat soal KODIFIKASI NYATA (Contoh: "Huruf kapital 'A' bernilai desimal 65 pada tabel ASCII. Bentuk biner 8-bit huruf 'A' adalah...", "Mengapa komputer perlu mengodekan huruf ke bentuk biner?").
   - Jika TP membahas konsep sistem komputer: Buat soal LOGIKA KERJA (Contoh: "Mengapa komputer menggunakan sistem biner basis 2 daripada desimal?").
   - Jika materi sains/sosial: Buat studi kasus fenomena nyata sehari-hari di sekolah atau rumah.

4. LARANGAN KERAS (ANTI-SLOP & ANTI-META):
   - DILARANG mengutip teks TP, menyebut nomor TP, atau menggunakan kalimat tujuan pembelajaran di dalam pertanyaan.
   - DILARANG menulis frasa kaku seperti "Berdasarkan Tujuan Pembelajaran...", "Berdasarkan TP...", "Menurut uraian materi di atas...", "Apa konsep paling mendasar yang harus kamu kuasai...".
   - Siswa di ruang ujian tidak pernah membaca silabus atau TP. Semua soal harus LANGSUNG menanyakan objek pelajarannya.

5. KOMPOSISI TINGKAT KOGNITIF (10 BUTIR SOAL):
   - Level C2 - Pemahaman Konsep (4 soal): Menguji pemahaman mendalam tentang prinsip kerja, karakteristik inti, dan logika dasar.
   - Level C3 - Penerapan & Hitungan Praktis (3 soal): Menguji penerapan nyata, perhitungan konversi, atau skenario praktis harian siswa.
   - Level C4 - Analisis & HOTS (3 soal): Menguji analisis sebab-akibat, troubleshooting masalah, dan evaluasi solusi.

6. FORMAT OUTPUT:
   - Tepat 10 soal pilihan ganda (A, B, C, D) dengan pengecoh masuk akal dan adil.
   - "correctAnswerIndex": integer 0, 1, 2, atau 3 tersebar merata.
   - "explanation": penjelasan edukatif singkat (1-2 kalimat) mengenai fakta ilmiah/hitungannya.
   - "cognitiveLevel": 'C2', 'C3', atau 'C4 (HOTS)'.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      quizQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctAnswerIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            cognitiveLevel: { type: Type.STRING },
          },
          required: [
            'id',
            'question',
            'options',
            'correctAnswerIndex',
            'explanation',
            'cognitiveLevel',
          ],
        },
      },
    },
    required: ['quizQuestions'],
  };

  const candidateConfigs: Array<{ name: string; thinkingLevel?: ThinkingLevel }> = [
    { name: 'gemini-3.1-flash-lite' },
    { name: 'gemini-flash-latest' },
    { name: 'gemini-3.8-flash' },
  ];

  for (let attempt = 0; attempt < candidateConfigs.length; attempt++) {
    const candidate = candidateConfigs[attempt];
    try {
      const config: any = {
        temperature: 0.65,
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction:
          'Anda adalah guru ahli penyusun soal ujian SMP/SMA yang berpengalaman. Gunakan teknik Dekonstruksi Pedagogis untuk merumuskan butir-butir soal yang substantif, mengalir alami, dan menguji konsep materi secara langsung (termasuk soal hitungan/kasus konkret). Dilarang keras mengutip teks Tujuan Pembelajaran (TP) atau membuat pertanyaan meta kurikulum. Siswa harus langsung diuji mengenai materi sains/komputernya.',
      };

      if (candidate.thinkingLevel) {
        config.thinkingConfig = { thinkingLevel: candidate.thinkingLevel };
      }

      const response = await ai.models.generateContent({
        model: candidate.name,
        contents: prompt,
        config,
      });

      const text = response.text || '{}';
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.quizQuestions) && parsed.quizQuestions.length > 0) {
        // Normalize and clean questions to eliminate any stiff meta wording
        const normalizedQuestions = parsed.quizQuestions.map((q: any, idx: number) => ({
          ...q,
          id: q.id || `quiz-${idx + 1}`,
          question: cleanQuestionStem(q.question, title),
          options: Array.isArray(q.options) && q.options.length === 4 ? q.options : (q.options || []).slice(0, 4),
          correctAnswerIndex:
            typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
              ? q.correctAnswerIndex
              : 0,
          explanation: q.explanation || `Jawaban berkaitan dengan konsep pokok ${title}.`,
          cognitiveLevel: q.cognitiveLevel || (idx < 4 ? 'C2' : idx < 7 ? 'C3' : 'C4 (HOTS)'),
        }));

        const result = {
          quizQuestions: normalizedQuestions,
          flashcards: [],
        };

        // Save to cache
        quizCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });
        return result;
      }
    } catch (err: any) {
      console.warn(`[QuizAI] Model ${candidate.name} attempt failed:`, err?.message || err);
    }
  }

  // Graceful fallback to domain-aware question engine
  console.warn('[QuizAI] All AI models failed. Using intelligent domain-aware fallback.');
  return getCuratedFallback();
}

export interface GenerateQuizBankParams {
  materialId?: string;
  title: string;
  description?: string;
  categoryName?: string;
  subjectName?: string;
  targetGrade?: string;
  learningObjectives?: string;
  materialText?: string;
  forceRefresh?: boolean;
}

export async function generateQuizBankQuestionsWithAI(params: GenerateQuizBankParams) {
  const apiKey = getGeminiApiKey();
  const rawTitle = params?.title && typeof params.title === 'string' ? params.title.trim() : '';
  const isMissingTitle = !rawTitle;
  const title = rawTitle || 'Materi Pembelajaran';
  const {
    materialId,
    description,
    categoryName,
    subjectName,
    targetGrade,
    learningObjectives,
    materialText,
    forceRefresh,
  } = params || {};

  // Helper for generating full 30-item curated fallback questions
  const getCuratedFallback30 = (warningMsg?: string) => {
    const nowStr = new Date().toISOString();
    const fallback = getFallbackQuizBankQuestions(
      {
        id: materialId || 'gen-fallback-30',
        title,
        description: description || '',
        learningObjectives: learningObjectives || '',
        type: 'other',
        originalUrl: '',
        embedUrl: '',
        order: 1,
        isPublished: true,
        categoryId: '',
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      categoryName,
      subjectName
    );

    const questions = fallback.slice(0, 30).map((q, idx) => ({
      ...q,
      id: `qb-${idx + 1}`,
      question: cleanQuestionStem(q.question, title),
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : (q.options || []).slice(0, 4),
      correctAnswerIndex:
        typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
          ? q.correctAnswerIndex
          : 0,
      explanation: q.explanation || `Jawaban berkaitan dengan konsep pokok ${title}.`,
      cognitiveLevel: q.cognitiveLevel || (idx < 10 ? 'C2' : idx < 20 ? 'C3' : 'C4 (HOTS)'),
    }));

    return {
      quizQuestions: questions,
      totalCount: questions.length,
      isFallback: true,
      generatedAt: nowStr,
      modelUsed: 'curated-fallback',
      warning: warningMsg,
    };
  };

  if (isMissingTitle) {
    console.warn('[QuizBankAI] Judul materi kosong. Menggunakan curated bank 30 butir.');
    return getCuratedFallback30(
      'Judul materi belum ditentukan. Sistem menyajikan 30 butir bank soal kurasi materi pembelajaran.'
    );
  }

  // If Gemini API Key is missing, do NOT crash - gracefully return the curated 30-question bank!
  if (!apiKey) {
    console.warn('[QuizBankAI] Gemini API Key tidak terdeteksi. Menggunakan bank soal kurasi materi.');
    return getCuratedFallback30(
      'Variabel GEMINI_API_KEY belum terpasang di Vercel Settings > Environment Variables. Menggunakan bank soal kurasi materi kurikulum.'
    );
  }

  const normId = (materialId || '').trim();
  const normTitle = title.trim().toLowerCase();
  const normGrade = (targetGrade || 'smp-7').toLowerCase();
  const normObj = (learningObjectives || '').trim().toLowerCase();
  const cacheKey = `bank30-v1::${normId || normTitle}::${normGrade}::${normObj}`;

  if (forceRefresh) {
    quizCache.delete(cacheKey);
  } else {
    const cached = quizCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.data,
        cached: true,
      };
    }
  }

  const targetInfo = resolveGradeInfo(targetGrade);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const objectivesText =
    learningObjectives && learningObjectives.trim()
      ? learningObjectives.trim()
      : `Memahami pengertian, karakteristik, fungsi, serta contoh penerapan praktis konsep "${title}" dalam kehidupan sehari-hari.`;

  const schemaBatch = {
    type: Type.OBJECT,
    properties: {
      quizQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctAnswerIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            cognitiveLevel: { type: Type.STRING },
          },
          required: [
            'id',
            'question',
            'options',
            'correctAnswerIndex',
            'explanation',
            'cognitiveLevel',
          ],
        },
      },
    },
    required: ['quizQuestions'],
  };

  const fastCandidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

  const promptFull30 = `INSTRUKSI ASESMEN BANK SOAL 30 BUTIR (C2, C3, C4 HOTS):
Materi: "${title}" | Mapel: "${subjectName || 'Informatika'}" | Bab: "${categoryName || 'Topik'}" | Tingkat: ${targetInfo.label}
${description ? `Ringkasan: "${description}"` : ''}
${materialText ? `Konten: "${materialText.slice(0, 1000)}"` : ''}
Panduan Capaian: "${objectivesText}"

TUGAS:
Susun 30 BUTIR SOAL PILIHAN GANDA (A, B, C, D):
- Soal 1-10 [Level C2 - Pemahaman Konsep Inti]: Karakteristik pokok, istilah penting, dan prinsip kerja dasar.
- Soal 11-20 [Level C3 - Penerapan & Hitungan Praktis]: Skenario nyata, penerapan praktis harian, konfigurasi teknis.
- Soal 21-30 [Level C4 - Analisis & Troubleshooting HOTS]: Pemecahan masalah, analisis kegagalan sistem, dan evaluasi kritis.

LARANGAN KERAS: Dilarang mengutip teks TP atau menulis "Berdasarkan TP...". Soal harus langsung menanyakan konsep atau kasus nyata.
Format: 30 soal pilihan ganda, 4 opsi, correctAnswerIndex (0-3), explanation ringkas 1 kalimat, cognitiveLevel ('C2', 'C3', atau 'C4 (HOTS)').`;

  let allRawQuestions: any[] = [];
  let modelUsed = '';

  // 1. Fast unified 30-item generation call (optimized for ultra-fast serverless execution < 6s)
  for (const modelName of fastCandidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptFull30,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: schemaBatch,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          systemInstruction:
            'Anda adalah guru ahli penyusun bank soal ujian sekolah. Gunakan Dekonstruksi Pedagogis: susun 30 butir soal pilihan ganda orisinal berkualitas tinggi. Ringkas penjelasan dalam 1 kalimat jelas. Output murni JSON sesuai skema.',
        },
      });
      let parsed: any = null;
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        parsed = null;
      }
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.quizQuestions) && parsed.quizQuestions.length >= 10) {
        allRawQuestions = parsed.quizQuestions;
        modelUsed = modelName;
        break;
      }
    } catch (err: any) {
      console.info(`[QuizBankAI Unified] Model ${modelName} attempt:`, err?.message || err);
    }
  }

  // 2. If AI generated partial questions (e.g. 10-29), seamlessly fill the rest from curated domain fallback to reach 30
  if (allRawQuestions.length > 0 && allRawQuestions.length < 30) {
    const nowStr = new Date().toISOString();
    const fallback = getFallbackQuizBankQuestions(
      {
        id: 'gen-fallback-30',
        title,
        description: description || '',
        learningObjectives: learningObjectives || '',
        type: 'other',
        originalUrl: '',
        embedUrl: '',
        order: 1,
        isPublished: true,
        categoryId: '',
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      categoryName,
      subjectName
    );
    const needed = 30 - allRawQuestions.length;
    allRawQuestions = [...allRawQuestions, ...fallback.slice(0, needed)];
  }

  // 3. If AI generation completely failed or timed out, use the full 30-item domain fallback
  if (allRawQuestions.length === 0) {
    console.warn('[QuizBankAI] AI generation yielded 0 questions. Using curated domain bank.');
    return getCuratedFallback30();
  }

  // Normalize, clean and assign clean sequential IDs qb-1 through qb-30
  const normalizedQuestions = allRawQuestions.slice(0, 30).map((q: any, idx: number) => ({
    ...q,
    id: `qb-${idx + 1}`,
    question: cleanQuestionStem(q.question, title),
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : (q.options || []).slice(0, 4),
    correctAnswerIndex:
      typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
        ? q.correctAnswerIndex
        : 0,
    explanation: q.explanation || `Jawaban yang tepat berkaitan dengan prinsip dasar ${title}.`,
    cognitiveLevel: q.cognitiveLevel || (idx < 10 ? 'C2' : idx < 20 ? 'C3' : 'C4 (HOTS)'),
  }));

  const result = {
    quizQuestions: normalizedQuestions,
    totalCount: normalizedQuestions.length,
    generatedAt: new Date().toISOString(),
    modelUsed: modelUsed || 'gemini-3.1-flash-lite',
  };

  quizCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

export interface GenerateAnalogyParams {
  questionText: string;
  options?: string[];
  title?: string;
  categoryName?: string;
}

const analogyCache = new Map<string, CacheEntry>();

/**
 * Lightweight, token-efficient AI generation for Quiz analogies and hints.
 * Consumes < 200 tokens using Gemini 3.1 Flash Lite.
 */
export async function generateAIAnalogyAndHintWithAI(params: GenerateAnalogyParams) {
  const apiKey = getGeminiApiKey();
  const { questionText, options = [], title, categoryName } = params || {};
  if (!questionText || !questionText.trim()) {
    return {
      analogy: `Bayangkan konsep materi "${(title || 'pembelajaran').slice(0, 45)}" seperti rangkaian proses teratur di mana setiap langkah saling melengkapi.`,
      hint: `Cermati kata kunci inti pada ringkasan materi dan pilih jawaban yang paling relevan.`,
      isFallback: true,
      warning: 'Teks pertanyaan belum disediakan. Menggunakan petunjuk kurasi.',
    };
  }

  const cleanQ = questionText.trim();
  const cacheKey = `analogy::${cleanQ.toLowerCase().slice(0, 120)}`;
  const cached = analogyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const fallbackAnalogy = `Bayangkan konsep "${(title || cleanQ).slice(0, 45)}" seperti situasi sehari-hari di mana setiap elemen bekerja sama secara teratur untuk mencapai hasil terbaik.`;
  const fallbackHint = `Fokus pada kata kunci inti pertanyaan dan eliminasi opsi jawaban yang tidak relevan dengan konsep dasar.`;

  if (!apiKey) {
    return { analogy: fallbackAnalogy, hint: fallbackHint, isFallback: true };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `Anda adalah Guru AI Pembimbing Belajar yang ramah dan komunikatif untuk siswa sekolah.
Tugas: Buat 1 analogi sederhana dunia nyata (maksimal 2 kalimat) dan 1 petunjuk berpikir logis (hint) tanpa membocorkan jawaban langsung.
- Pertanyaan: "${cleanQ}"
${options.length ? `- Pilihan Jawaban: ${options.join(', ')}` : ''}
${title ? `- Materi: "${title}"` : ''}
${categoryName ? `- Topik: "${categoryName}"` : ''}

Ketentuan:
1. "analogy": Tulis analogi dunia nyata konkret dan ramah anak.
2. "hint": Tulis 1 petunjuk cerdas pemandu logika tanpa membocorkan kunci.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      analogy: { type: Type.STRING },
      hint: { type: Type.STRING },
    },
    required: ['analogy', 'hint'],
  };

  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ];

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.4,
          maxOutputTokens: 250,
          responseMimeType: 'application/json',
          responseSchema: schema,
          systemInstruction:
            'Anda adalah AI Tutor ramah yang selalu menjelaskan konsep dengan analogi sederhana dan petunjuk belajar yang efektif.',
        },
      });

      if (response.text) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(response.text);
        } catch {
          parsed = null;
        }
        if (parsed && typeof parsed === 'object' && parsed.analogy && parsed.hint) {
          const result = {
            analogy: parsed.analogy.trim(),
            hint: parsed.hint.trim(),
            modelUsed: modelName,
          };
          analogyCache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }
      }
    } catch (err: any) {
      console.warn(`[AnalogyAI] Model ${modelName} attempt failed:`, err?.message || err);
    }
  }

  const result = { analogy: fallbackAnalogy, hint: fallbackHint, isFallback: true };
  analogyCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}
