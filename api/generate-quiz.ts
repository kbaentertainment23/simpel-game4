import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateQuizQuestionsWithAI } from './_lib/quizGeneratorCore.ts';
import {
  verifyFirebaseIdToken,
  checkRateLimit,
  validatePayloadSizeAndShape,
} from './_lib/authValidator.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Safe CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

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
      return res.status(200).json({
        ...fallback,
        isFallback: true,
        warning: `Payload tidak valid: ${validation.error}. Menggunakan bank soal kurasi.`,
      });
    }

    const sanitizedBody = validation.sanitizedBody;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

    // 2. Firebase ID Token Verification (Anti-Scraper & Anti-Unauthorized Quota Drain)
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    const authResult = await verifyFirebaseIdToken(authHeader, clientIp);

    if (!authResult.isAuthenticated) {
      // Zero-Crash Policy: Graceful fallback without revealing internal error codes
      const fallback = await generateQuizQuestionsWithAI({
        ...sanitizedBody,
        forceRefresh: false,
      });
      return res.status(200).json({
        ...fallback,
        isFallback: true,
        warning: 'Akses generator AI memerlukan sesi terotentikasi. Menampilkan bank soal kurasi resmi.',
      });
    }

    // 3. Sliding-Window Rate Limiter (Anti-Flood Protection)
    const rateLimit = checkRateLimit(authResult.uid || clientIp, 10, 60000);
    if (!rateLimit.isAllowed) {
      const fallback = await generateQuizQuestionsWithAI({
        ...sanitizedBody,
        forceRefresh: false,
      });
      return res.status(200).json({
        ...fallback,
        isFallback: true,
        warning: `Batas kuota request tercapai (${rateLimit.resetInSeconds} detik tersisa). Menggunakan bank soal kurasi.`,
      });
    }

    // 4. Authorized Execution via Gemini API
    const result = await generateQuizQuestionsWithAI(sanitizedBody);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error generating AI quiz:', err?.message || err);
    // Graceful safety net: never return 500 to client
    try {
      const fallbackTitle = (req.body && typeof req.body === 'object' && typeof req.body.title === 'string' && req.body.title.trim())
        ? req.body.title.trim()
        : 'Materi Pembelajaran';
      const fallbackResult = await generateQuizQuestionsWithAI({
        title: fallbackTitle,
        forceRefresh: false,
      });
      return res.status(200).json({
        ...fallbackResult,
        isFallback: true,
        warning: 'Layanan AI dialihkan ke bank soal kurasi resmi.',
      });
    } catch {
      return res.status(200).json({
        quizQuestions: [],
        flashcards: [],
        isFallback: true,
        warning: 'Layanan AI sedang dalam pemeliharaan.',
      });
    }
  }
}
