import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateAndProcessAnswer } from './_lib/icebreakingServerCore.ts';
import { verifyFirebaseIdToken } from './_lib/authValidator.ts';

/**
 * Server-authoritative endpoint to submit and validate an icebreaking answer.
 * Clients only send selectedAnswerIndex, roomId, studentId, and optional questionId.
 * Client is NEVER trusted to determine isCorrect.
 * Complies with AGENTS.md Zero-Crash Policy and self-contained serverless architecture.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Restrict HTTP Method: Only POST is allowed
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

    // 2. Strict Input Validation (Shape, Type, Bounds)
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

    // 3. Authenticate Caller Token if Authorization Header is provided
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    let authUid: string | undefined = undefined;
    if (authHeader) {
      const authResult = await verifyFirebaseIdToken(authHeader);
      if (authResult.isAuthenticated) {
        authUid = authResult.uid;
      }
    }

    // 4. Validate and process answer atomically on server
    const result = await validateAndProcessAnswer({
      roomId: roomId.trim(),
      studentId: studentId.trim(),
      selectedAnswerIndex,
      questionId: typeof questionId === 'string' ? questionId.trim() : undefined,
      authUid,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    // Zero-Crash Policy: Return safe error payload
    return res.status(200).json({
      ok: false,
      isCorrect: false,
      message: err?.message || 'Terjadi kesalahan sistem saat memvalidasi jawaban.',
    });
  }
}
