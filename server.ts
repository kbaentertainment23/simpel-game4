import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  generateQuizQuestionsWithAI,
  generateQuizBankQuestionsWithAI,
  generateAIAnalogyAndHintWithAI,
  getGeminiApiKey,
} from './api/_lib/quizGeneratorCore.ts';
import {
  validateAndProcessAnswer,
  processPassBomb,
  checkAndProcessServerExplosion,
  processTogglePause,
} from './api/_lib/icebreakingServerCore.ts';
import {
  verifyFirebaseIdToken,
  isAuthorizedAdminOrTeacher,
  checkRateLimit,
  validatePayloadSizeAndShape,
  validateAnalogyPayloadSizeAndShape,
} from './api/_lib/authValidator.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb', strict: false }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Gracefully handle any body-parser SyntaxError (e.g. malformed JSON or null tokens)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err instanceof SyntaxError || err.type === 'entity.parse.failed')) {
      (req as any).body = {};
      return next();
    }
    next(err);
  });

  // Basic CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // API routes FIRST
  app.all('/api/health', (req, res) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed. Use GET.' });
    }
    const key = getGeminiApiKey();
    res.json({
      status: 'ok',
      hasGeminiKey: !!key,
    });
  });

  // 10-Question Mini Quiz generation endpoint using semantic content analysis
  app.post('/api/generate-quiz', async (req, res) => {
    try {
      // 1. Strict Payload Boundary Check
      let rawBody: any = {};
      try {
        rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        if (!rawBody || typeof rawBody !== 'object') rawBody = {};
      } catch {
        rawBody = {};
      }
      const validation = validatePayloadSizeAndShape(rawBody, {
        maxTitleLen: 300,
        maxDescLen: 1500,
        maxObjectivesLen: 1500,
      });

      if (!validation.isValid) {
        const fallbackTitle = typeof rawBody?.title === 'string' && rawBody.title.trim() ? rawBody.title.trim() : 'Materi Pembelajaran';
        const fallback = await generateQuizQuestionsWithAI({ title: fallbackTitle, forceRefresh: false });
        res.status(200).json({
          ...fallback,
          isFallback: true,
          warning: `Payload tidak valid: ${validation.error}. Menggunakan bank soal kurasi.`,
        });
        return;
      }

      const sanitizedBody = validation.sanitizedBody;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

      // 2. Firebase ID Token Verification
      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      const authResult = await verifyFirebaseIdToken(authHeader, clientIp);

      if (!authResult.isAuthenticated) {
        const fallback = await generateQuizQuestionsWithAI({
          ...sanitizedBody,
          forceRefresh: false,
        });
        res.status(200).json({
          ...fallback,
          isFallback: true,
          warning: 'Akses generator AI memerlukan sesi terotentikasi. Menampilkan bank soal kurasi resmi.',
        });
        return;
      }

      // 3. Sliding-Window Rate Limiter
      const rateLimit = checkRateLimit(authResult.uid || clientIp, 10, 60000);
      if (!rateLimit.isAllowed) {
        const fallback = await generateQuizQuestionsWithAI({
          ...sanitizedBody,
          forceRefresh: false,
        });
        res.status(200).json({
          ...fallback,
          isFallback: true,
          warning: `Batas kuota request tercapai (${rateLimit.resetInSeconds} detik tersisa). Menggunakan bank soal kurasi.`,
        });
        return;
      }

      console.log(`[Quiz Controller] Generating quiz for "${sanitizedBody.title}" (Grade: ${sanitizedBody.targetGrade || 'smp-7'}).`);
      const result = await generateQuizQuestionsWithAI(sanitizedBody);
      res.json(result);
    } catch (err: any) {
      console.error('[Quiz Controller] Error in /api/generate-quiz:', err);
      try {
        const fallbackTitle = (req.body && typeof req.body === 'object' && typeof req.body.title === 'string' && req.body.title.trim())
          ? req.body.title.trim()
          : 'Materi Pembelajaran';
        const fallbackResult = await generateQuizQuestionsWithAI({
          title: fallbackTitle,
          forceRefresh: false,
        });
        res.status(200).json({
          ...fallbackResult,
          isFallback: true,
          warning: 'Layanan AI dialihkan ke bank soal kurasi resmi.',
        });
      } catch {
        res.status(200).json({
          quizQuestions: [],
          flashcards: [],
          isFallback: true,
          warning: 'Layanan AI sedang dalam pemeliharaan.',
        });
      }
    }
  });

  // 30-Question Bank Soal generation endpoint using semantic content analysis (C2-C4)
  app.post('/api/generate-quiz-bank', async (req, res) => {
    try {
      // 1. Strict Payload Boundary Check
      let rawBody: any = {};
      try {
        rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        if (!rawBody || typeof rawBody !== 'object') rawBody = {};
      } catch {
        rawBody = {};
      }
      const validation = validatePayloadSizeAndShape(rawBody, {
        maxTitleLen: 300,
        maxDescLen: 1500,
        maxObjectivesLen: 1500,
        maxMaterialTextLen: 5000,
      });

      if (!validation.isValid) {
        const fallbackTitle = typeof rawBody?.title === 'string' && rawBody.title.trim() ? rawBody.title.trim() : 'Materi Pembelajaran';
        const fallback = await generateQuizBankQuestionsWithAI({ title: fallbackTitle, forceRefresh: false });
        res.status(200).json({
          ...fallback,
          isFallback: true,
          warning: `Payload tidak valid: ${validation.error}. Menggunakan bank soal kurasi.`,
        });
        return;
      }

      const sanitizedBody = validation.sanitizedBody;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

      // 2. Firebase ID Token Verification
      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      const authResult = await verifyFirebaseIdToken(authHeader, clientIp);

      if (!authResult.isAuthenticated) {
        const fallback = await generateQuizBankQuestionsWithAI({
          ...sanitizedBody,
          forceRefresh: false,
        });
        res.status(200).json({
          ...fallback,
          isFallback: true,
          warning: 'Akses generator bank soal memerlukan sesi terotentikasi. Menampilkan bank soal kurasi resmi.',
        });
        return;
      }

      // 3. Sliding-Window Rate Limiter (Max 3 bank generations per minute per user)
      const rateLimit = checkRateLimit(`bank_${authResult.uid || clientIp}`, 3, 60000);
      if (!rateLimit.isAllowed) {
        const fallback = await generateQuizBankQuestionsWithAI({
          ...sanitizedBody,
          forceRefresh: false,
        });
        res.status(200).json({
          ...fallback,
          isFallback: true,
          warning: `Batas kuota request bank soal tercapai (${rateLimit.resetInSeconds} detik tersisa). Menggunakan bank soal kurasi.`,
        });
        return;
      }

      console.log(`[Quiz Bank Controller] Generating bank questions for "${sanitizedBody.title}" (Grade: ${sanitizedBody.targetGrade || 'smp-7'}).`);
      const result = await generateQuizBankQuestionsWithAI(sanitizedBody);
      res.json(result);
    } catch (err: any) {
      console.error('[Quiz Bank Controller] Error in /api/generate-quiz-bank:', err);
      try {
        const fallbackTitle = (req.body && typeof req.body === 'object' && typeof req.body.title === 'string' && req.body.title.trim())
          ? req.body.title.trim()
          : 'Materi Pembelajaran';
        const fallbackResult = await generateQuizBankQuestionsWithAI({
          title: fallbackTitle,
          forceRefresh: false,
        });
        res.status(200).json({
          ...fallbackResult,
          isFallback: true,
          warning: 'Layanan AI dialihkan ke bank soal kurasi resmi.',
        });
      } catch {
        res.status(200).json({
          quizQuestions: [],
          totalCount: 0,
          isFallback: true,
          warning: 'Layanan bank soal AI sedang dalam pemeliharaan.',
        });
      }
    }
  });

  // Lightweight Quiz Analogy and Hint endpoint (< 200 tokens)
  app.post('/api/ai-analogy', async (req, res) => {
    try {
      // 1. Strict Payload Boundary Check
      let rawBody: any = {};
      try {
        rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        if (!rawBody || typeof rawBody !== 'object') rawBody = {};
      } catch {
        rawBody = {};
      }
      const validation = validateAnalogyPayloadSizeAndShape(rawBody);

      if (!validation.isValid) {
        res.status(200).json({
          analogy: 'Bayangkan konsep ini seperti sistem teratur dalam kehidupan sehari-hari di mana setiap komponen bekerja selaras.',
          hint: 'Fokus pada kata kunci utama dan eliminasi opsi yang kurang relevan.',
          isFallback: true,
          warning: `Payload tidak valid: ${validation.error}`,
        });
        return;
      }

    const sanitizedBody = validation.sanitizedBody;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

    // 2. Firebase ID Token Verification
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    const authResult = await verifyFirebaseIdToken(authHeader, clientIp);

    if (!authResult.isAuthenticated) {
      res.status(200).json({
        analogy: 'Bayangkan konsep ini seperti rangkaian proses teratur: memahami fondasi dasar membantu menjawab keseluruhan alur dengan tepat.',
        hint: 'Cermati pilihan yang paling sesuai dengan prinsip utama materi ini.',
        isFallback: true,
        warning: 'Akses tutor AI memerlukan sesi terotentikasi. Menggunakan bantuan kurasi.',
      });
      return;
    }

    // 3. Sliding-Window Rate Limiter
    const rateLimit = checkRateLimit(`tutor_${authResult.uid || clientIp}`, 15, 60000);
    if (!rateLimit.isAllowed) {
      res.status(200).json({
        analogy: 'Konsep ini serupa dengan langkah terstruktur di mana setiap bagian saling melengkapi.',
        hint: 'Fokus pada kata kunci yang paling sering muncul pada ringkasan materi.',
        isFallback: true,
        warning: `Batas kuota pertanyaan AI tercapai (${rateLimit.resetInSeconds} detik). Menggunakan bantuan kurasi.`,
      });
      return;
    }

      const result = await generateAIAnalogyAndHintWithAI(sanitizedBody);
      res.json(result);
    } catch (err: any) {
      console.error('[Analogy Controller] Error in /api/ai-analogy:', err?.message || err);
      res.status(200).json({
        analogy: 'Bayangkan konsep ini seperti sistem teratur dalam kehidupan sehari-hari di mana setiap komponen bekerja selaras.',
        hint: 'Fokus pada kata kunci utama dan eliminasi opsi yang kurang relevan.',
        isFallback: true,
        warning: 'Layanan AI sedang sibuk. Menggunakan petunjuk kurasi.',
      });
    }
  });

  // Student instant offline endpoint for browser unload/beacon signals
  app.post('/api/student-offline', async (req, res) => {
    try {
      let studentId = '';
      if (typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          studentId = parsed.studentId || '';
        } catch {
          studentId = req.body.trim();
        }
      } else if (req.body && typeof req.body === 'object') {
        studentId = req.body.studentId || '';
      }

      if (!studentId || typeof studentId !== 'string') {
        res.status(200).json({ ok: false, message: 'Missing studentId' });
        return;
      }

      const nowIso = new Date().toISOString();
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'simpel-media-ajar';
      const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyCL1dR_YKV8iOt-_EEjdAiCejE4NuyI8h0';
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/databases/(default)/documents/students/${encodeURIComponent(
        studentId
      )}?updateMask.fieldPaths=isOnline&updateMask.fieldPaths=activeSubjectId&updateMask.fieldPaths=activeSubjectName&updateMask.fieldPaths=lastActive&updateMask.fieldPaths=updatedAt&key=${encodeURIComponent(
        apiKey
      )}`;

      const patchPayload = {
        fields: {
          isOnline: { booleanValue: false },
          activeSubjectId: { nullValue: null },
          activeSubjectName: { nullValue: null },
          lastActive: { stringValue: nowIso },
          updatedAt: { stringValue: nowIso },
        },
      };

      const firestoreRes = await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });

      res.status(200).json({
        ok: firestoreRes.ok,
        status: firestoreRes.status,
        timestamp: nowIso,
        studentId,
      });
    } catch (err: any) {
      res.status(200).json({
        ok: false,
        error: err?.message || 'Error processing offline status',
      });
    }
  });

  // Server-Authoritative Icebreaking Answer Submission
  app.all('/api/game-submit-answer', async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({
        ok: false,
        isCorrect: false,
        message: 'Method Not Allowed. Hanya method POST yang diizinkan untuk mengirim jawaban.',
      });
    }

    try {
      const { roomId, studentId, selectedAnswerIndex, questionId } = req.body || {};

      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0 || roomId.length > 100) {
        return res.status(400).json({ ok: false, isCorrect: false, message: 'Parameter roomId wajib diisi (maks 100 karakter).' });
      }
      if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0 || studentId.length > 100) {
        return res.status(400).json({ ok: false, isCorrect: false, message: 'Parameter studentId wajib diisi.' });
      }
      if (typeof selectedAnswerIndex !== 'number' || !Number.isInteger(selectedAnswerIndex) || selectedAnswerIndex < 0 || selectedAnswerIndex > 10) {
        return res.status(400).json({ ok: false, isCorrect: false, message: 'Parameter selectedAnswerIndex wajib berupa angka integer valid (0-10).' });
      }
      if (questionId !== undefined && (typeof questionId !== 'string' || questionId.length > 100)) {
        return res.status(400).json({ ok: false, isCorrect: false, message: 'Parameter questionId tidak valid.' });
      }

      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      let authUid: string | undefined = undefined;
      if (authHeader) {
        const authResult = await verifyFirebaseIdToken(authHeader);
        if (authResult.isAuthenticated) {
          authUid = authResult.uid;
        }
      }

      const result = await validateAndProcessAnswer({
        roomId: String(roomId).trim(),
        studentId: String(studentId).trim(),
        selectedAnswerIndex,
        questionId: typeof questionId === 'string' ? questionId.trim() : undefined,
        authUid,
      });
      res.status(200).json(result);
    } catch (err: any) {
      res.status(200).json({ ok: false, isCorrect: false, message: err?.message || 'Error' });
    }
  });

  // Server-Authoritative Icebreaking Bomb Pass
  app.all('/api/game-pass-bomb', async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({
        ok: false,
        message: 'Method Not Allowed. Hanya method POST yang diizinkan untuk mengoper bom.',
      });
    }

    try {
      const { roomId, fromPlayerId, toPlayerId } = req.body || {};

      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0 || roomId.length > 100) {
        return res.status(400).json({ ok: false, message: 'Parameter roomId wajib berupa string valid (maks 100 karakter).' });
      }
      if (!fromPlayerId || typeof fromPlayerId !== 'string' || fromPlayerId.trim().length === 0 || fromPlayerId.length > 100) {
        return res.status(400).json({ ok: false, message: 'Parameter fromPlayerId wajib diisi.' });
      }
      if (!toPlayerId || typeof toPlayerId !== 'string' || toPlayerId.trim().length === 0 || toPlayerId.length > 100) {
        return res.status(400).json({ ok: false, message: 'Parameter toPlayerId wajib diisi.' });
      }

      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      let authUid: string | undefined = undefined;
      if (authHeader) {
        const authResult = await verifyFirebaseIdToken(authHeader);
        if (authResult.isAuthenticated) {
          authUid = authResult.uid;
        }
      }

      const result = await processPassBomb({
        roomId: String(roomId).trim(),
        fromPlayerId: String(fromPlayerId).trim(),
        toPlayerId: String(toPlayerId).trim(),
        authUid,
      });
      res.status(200).json(result);
    } catch (err: any) {
      res.status(200).json({ ok: false, message: err?.message || 'Error' });
    }
  });

  // Server-Authoritative Icebreaking Bomb Explosion & Timer Check
  app.all('/api/game-trigger-explosion', async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({
        ok: false,
        isExpired: false,
        message: 'Method Not Allowed. Hanya method POST yang diizinkan untuk memproses ledakan.',
      });
    }

    try {
      const { roomId, explodedPlayerId, forceExplode, adminPin, teacherId } = req.body || {};

      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0 || roomId.length > 100) {
        return res.status(400).json({ ok: false, isExpired: false, message: 'Parameter roomId wajib diisi (maks 100 karakter).' });
      }
      if (explodedPlayerId !== undefined && (typeof explodedPlayerId !== 'string' || explodedPlayerId.length > 100)) {
        return res.status(400).json({ ok: false, isExpired: false, message: 'Parameter explodedPlayerId tidak valid.' });
      }

      let isAuthorizedAdmin = false;
      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      let authResult = undefined;
      if (authHeader) {
        authResult = await verifyFirebaseIdToken(authHeader);
      }

      if (forceExplode) {
        isAuthorizedAdmin = isAuthorizedAdminOrTeacher({
          authResult,
          adminPin,
          teacherId: typeof teacherId === 'string' ? teacherId : undefined,
        });

        if (!isAuthorizedAdmin) {
          return res.status(200).json({
            ok: false,
            isExpired: false,
            message: 'Akses forceExplode ditolak. Hanya Guru host atau Admin terverifikasi yang dapat memicu ledakan paksa.',
          });
        }
      }

      const result = await checkAndProcessServerExplosion({
        roomId: String(roomId).trim(),
        callerHolderId: explodedPlayerId ? String(explodedPlayerId).trim() : undefined,
        forceExplode: Boolean(forceExplode && isAuthorizedAdmin),
        isAdminOrTeacher: isAuthorizedAdmin,
      });
      res.status(200).json(result);
    } catch (err: any) {
      res.status(200).json({ ok: false, isExpired: false, message: err?.message || 'Error' });
    }
  });

  // Server-Authoritative Icebreaking Toggle Pause
  app.all('/api/game-toggle-pause', async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({
        ok: false,
        message: 'Method Not Allowed. Hanya method POST yang diizinkan untuk menjeda permainan.',
      });
    }

    try {
      const { roomId, pause, callerId, adminPin } = req.body || {};

      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0 || roomId.length > 100) {
        return res.status(400).json({ ok: false, message: 'Parameter roomId wajib diisi (maks 100 karakter).' });
      }
      if (typeof pause !== 'boolean') {
        return res.status(400).json({ ok: false, message: 'Parameter pause wajib berupa nilai boolean.' });
      }

      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      let authResult = undefined;
      if (authHeader) {
        authResult = await verifyFirebaseIdToken(authHeader);
      }

      const isAuthorized = isAuthorizedAdminOrTeacher({
        authResult,
        adminPin,
        teacherId: typeof callerId === 'string' ? callerId : undefined,
      });

      const result = await processTogglePause({
        roomId: String(roomId).trim(),
        pause: Boolean(pause),
        callerId: callerId ? String(callerId).trim() : undefined,
        isAdminOrTeacher: isAuthorized,
      });
      res.status(200).json(result);
    } catch (err: any) {
      res.status(200).json({ ok: false, message: err?.message || 'Error' });
    }
  });

  // Dedicated PWA routes with required headers for Chrome & mobile browsers
  app.get('/sw.js', (req, res) => {
    const swPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', 'sw.js')
      : path.join(process.cwd(), 'public', 'sw.js');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(swPath);
  });

  app.get('/manifest.json', (req, res) => {
    const manifestPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', 'manifest.json')
      : path.join(process.cwd(), 'public', 'manifest.json');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(manifestPath);
  });

  // Vite middleware for development vs static production serving
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    hasDist;

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {

    // Immutable caching for hashed assets (Vite produces content-hashed filenames)
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));

    // Other static files (root icons, etc.) with explicit revalidation for HTML
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

    // In Express v5, wildcard route requires '*all'
    // Always serve index.html with strict no-cache to guarantee browser requests fresh chunk hashes
    app.get('*all', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
