import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FIREBASE_REST_CONFIG } from './_lib/firebaseConfig.ts';

/**
 * Serverless endpoint to instantly mark a student as offline in Firestore
 * when they close their browser tab or navigate away.
 * Fully compatible with navigator.sendBeacon and fetch with keepalive: true.
 * Complies with AGENTS.md Zero-Crash Policy and self-contained structure.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let studentId = '';

    // Handle different content types (JSON or text/plain from beacon)
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
      return res.status(200).json({
        ok: false,
        message: 'Parameter studentId tidak ditemukan.',
      });
    }

    const nowIso = new Date().toISOString();
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_REST_CONFIG.projectId
    )}/databases/${encodeURIComponent(
      FIREBASE_REST_CONFIG.databaseId
    )}/documents/students/${encodeURIComponent(
      studentId
    )}?updateMask.fieldPaths=isOnline&updateMask.fieldPaths=activeSubjectId&updateMask.fieldPaths=activeSubjectName&updateMask.fieldPaths=lastActive&updateMask.fieldPaths=updatedAt&key=${encodeURIComponent(
      FIREBASE_REST_CONFIG.apiKey
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchPayload),
    });

    return res.status(200).json({
      ok: firestoreRes.ok,
      status: firestoreRes.status,
      timestamp: nowIso,
      studentId,
    });
  } catch (err: any) {
    // Zero-Crash Policy: Return 200 with error details
    return res.status(200).json({
      ok: false,
      error: err?.message || 'Gagal memperbarui status offline siswa.',
    });
  }
}
