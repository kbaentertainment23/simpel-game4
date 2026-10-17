import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIAnalogyAndHintWithAI } from './_lib/quizGeneratorCore.ts';
import {
  verifyFirebaseIdToken,
  checkRateLimit,
  validateAnalogyPayloadSizeAndShape,
} from './_lib/authValidator.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    // 1. Strict Payload Boundary Check for AI Analogy / Hint
    let rawBody: any = {};
    try {
      rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!rawBody || typeof rawBody !== 'object') rawBody = {};
    } catch {
      rawBody = {};
    }

    const validation = validateAnalogyPayloadSizeAndShape(rawBody);

    if (!validation.isValid) {
      return res.status(200).json({
        analogy: 'Bayangkan konsep ini seperti sistem teratur dalam kehidupan sehari-hari di mana setiap komponen bekerja selaras.',
        hint: 'Fokus pada kata kunci utama dan eliminasi opsi yang kurang relevan.',
        isFallback: true,
        warning: `Payload tidak valid: ${validation.error}`,
      });
    }

    const sanitizedBody = validation.sanitizedBody;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

    // 2. Firebase ID Token Verification
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    const authResult = await verifyFirebaseIdToken(authHeader, clientIp);

    if (!authResult.isAuthenticated) {
      return res.status(200).json({
        analogy: 'Bayangkan konsep ini seperti rangkaian proses teratur: memahami fondasi dasar membantu menjawab keseluruhan alur dengan tepat.',
        hint: 'Cermati pilihan yang paling sesuai dengan prinsip utama materi ini.',
        isFallback: true,
        warning: 'Akses tutor AI memerlukan sesi terotentikasi. Menggunakan bantuan kurasi.',
      });
    }

    // 3. Sliding-Window Rate Limiter (Max 15 requests per minute for AI tutor)
    const rateLimit = checkRateLimit(`tutor_${authResult.uid || clientIp}`, 15, 60000);
    if (!rateLimit.isAllowed) {
      return res.status(200).json({
        analogy: 'Konsep ini serupa dengan langkah terstruktur di mana setiap bagian saling melengkapi.',
        hint: 'Fokus pada kata kunci yang paling sering muncul pada ringkasan materi.',
        isFallback: true,
        warning: `Batas kuota pertanyaan AI tercapai (${rateLimit.resetInSeconds} detik). Menggunakan bantuan kurasi.`,
      });
    }

    // 4. Authorized Execution via Gemini API
    const result = await generateAIAnalogyAndHintWithAI(sanitizedBody);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error in /api/ai-analogy:', err?.message || err);
    return res.status(200).json({
      analogy: 'Bayangkan konsep ini seperti sistem teratur dalam kehidupan sehari-hari di mana setiap komponen bekerja selaras.',
      hint: 'Fokus pada kata kunci utama dan eliminasi opsi yang kurang relevan.',
      isFallback: true,
      warning: 'Layanan AI sedang sibuk. Menggunakan petunjuk kurasi.',
    });
  }
}
