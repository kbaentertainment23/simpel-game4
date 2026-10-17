import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processPassBomb } from './_lib/icebreakingServerCore.ts';
import { verifyFirebaseIdToken } from './_lib/authValidator.ts';

/**
 * Server-authoritative endpoint to pass the bomb to another player.
 * Server verifies that the sender is the current holder and has answered correctly (timer paused).
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
      message: 'Method Not Allowed. Hanya method POST yang diizinkan untuk mengoper bom.',
    });
  }

  try {
    const { roomId, fromPlayerId, toPlayerId } = req.body || {};

    // 2. Strict Input Validation (Shape, Type, Length)
    if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0 || roomId.length > 100) {
      return res.status(400).json({ ok: false, message: 'Parameter roomId wajib berupa string valid (maks 100 karakter).' });
    }
    if (!fromPlayerId || typeof fromPlayerId !== 'string' || fromPlayerId.trim().length === 0 || fromPlayerId.length > 100) {
      return res.status(400).json({ ok: false, message: 'Parameter fromPlayerId wajib diisi.' });
    }
    if (!toPlayerId || typeof toPlayerId !== 'string' || toPlayerId.trim().length === 0 || toPlayerId.length > 100) {
      return res.status(400).json({ ok: false, message: 'Parameter toPlayerId wajib diisi.' });
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

    // 4. Execute atomic transaction in server core
    const result = await processPassBomb({
      roomId: roomId.trim(),
      fromPlayerId: fromPlayerId.trim(),
      toPlayerId: toPlayerId.trim(),
      authUid,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      message: err?.message || 'Gagal melempar bom.',
    });
  }
}
