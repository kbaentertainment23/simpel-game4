import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAndProcessServerExplosion } from './_lib/icebreakingServerCore.ts';
import { verifyFirebaseIdToken, isAuthorizedAdminOrTeacher } from './_lib/authValidator.ts';

/**
 * Server-authoritative endpoint to check and trigger bomb explosion.
 * Server STRICTLY checks if Date.now() >= session.explodeAt before allowing any explosion.
 * If time has not expired, the explosion request is rejected.
 * forceExplode is strictly protected and requires administrative authorization.
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
      isExpired: false,
      message: 'Method Not Allowed. Hanya method POST yang diizinkan untuk memproses ledakan.',
    });
  }

  try {
    const { roomId, explodedPlayerId, forceExplode, adminPin, teacherId } = req.body || {};

    // 2. Strict Input Validation (Shape, Type, Length)
    if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0 || roomId.length > 100) {
      return res.status(400).json({ ok: false, isExpired: false, message: 'Parameter roomId wajib diisi (maks 100 karakter).' });
    }
    if (explodedPlayerId !== undefined && (typeof explodedPlayerId !== 'string' || explodedPlayerId.length > 100)) {
      return res.status(400).json({ ok: false, isExpired: false, message: 'Parameter explodedPlayerId tidak valid.' });
    }

    // 3. Authenticate and Authorize Administrative Privileges for forceExplode
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
        // If regular client/student attempted forceExplode without admin credentials, reject forceExplode bypass
        return res.status(200).json({
          ok: false,
          isExpired: false,
          message: 'Akses forceExplode ditolak. Hanya Guru host atau Admin terverifikasi yang dapat memicu ledakan paksa.',
        });
      }
    }

    // 4. Execute atomic explosion verification on server
    const result = await checkAndProcessServerExplosion({
      roomId: roomId.trim(),
      callerHolderId: explodedPlayerId ? String(explodedPlayerId).trim() : undefined,
      forceExplode: Boolean(forceExplode && isAuthorizedAdmin),
      isAdminOrTeacher: isAuthorizedAdmin,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      isExpired: false,
      message: err?.message || 'Gagal memproses pengecekan ledakan bom.',
    });
  }
}
