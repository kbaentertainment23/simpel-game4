import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processTogglePause } from './_lib/icebreakingServerCore.ts';
import { verifyFirebaseIdToken, isAuthorizedAdminOrTeacher } from './_lib/authValidator.ts';

/**
 * Server-authoritative endpoint to pause or resume game session.
 * Correctly preserves remaining countdown time by shifting explodeAt upon resume.
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
      message: 'Method Not Allowed. Hanya method POST yang diizinkan untuk menjeda permainan.',
    });
  }

  try {
    const { roomId, pause, callerId, adminPin } = req.body || {};

    // 2. Strict Input Validation (Shape, Type)
    if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0 || roomId.length > 100) {
      return res.status(400).json({ ok: false, message: 'Parameter roomId wajib diisi (maks 100 karakter).' });
    }
    if (typeof pause !== 'boolean') {
      return res.status(400).json({ ok: false, message: 'Parameter pause wajib berupa nilai boolean.' });
    }

    // 3. Authenticate and Authorize Host Teacher / Admin Privileges
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
      roomId: roomId.trim(),
      pause: Boolean(pause),
      callerId: callerId ? String(callerId).trim() : undefined,
      isAdminOrTeacher: isAuthorized,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      message: err?.message || 'Gagal mengubah status jeda.',
    });
  }
}
