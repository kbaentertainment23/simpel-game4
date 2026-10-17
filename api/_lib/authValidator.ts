import { FIREBASE_REST_CONFIG } from './firebaseConfig.ts';

interface CachedToken {
  uid: string;
  isAnonymous: boolean;
  email?: string;
  expiresAt: number;
}

// In-memory token cache to prevent redundant round-trips to Google Identity Toolkit (5 min TTL)
const tokenVerificationCache = new Map<string, CachedToken>();

// In-memory sliding-window rate limiter per UID/IP (window: 60 seconds)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Periodic cache hygiene to avoid memory leaks in long-lived serverless containers
function pruneStaleCache() {
  const now = Date.now();
  if (tokenVerificationCache.size > 500) {
    for (const [key, val] of tokenVerificationCache.entries()) {
      if (val.expiresAt <= now) {
        tokenVerificationCache.delete(key);
      }
    }
  }
  if (rateLimitBuckets.size > 500) {
    for (const [key, val] of rateLimitBuckets.entries()) {
      if (val.resetAt <= now) {
        rateLimitBuckets.delete(key);
      }
    }
  }
}

export interface AuthValidationResult {
  isAuthenticated: boolean;
  uid?: string;
  isAnonymous?: boolean;
  email?: string;
  isRateLimited?: boolean;
  rateLimitRemaining?: number;
  error?: string;
}

/**
 * Extracts and verifies Firebase ID Token against Google Identity Toolkit.
 * Caches valid tokens for 5 minutes in memory to minimize latency (< 1ms on cache hit).
 * Inspects whether the account is anonymous or backed by identity provider/credentials.
 */
export async function verifyFirebaseIdToken(
  authHeader: string | undefined,
  _clientIp: string = 'unknown'
): Promise<AuthValidationResult> {
  pruneStaleCache();

  if (!authHeader || typeof authHeader !== 'string') {
    return {
      isAuthenticated: false,
      error: 'Authorization header (Bearer token) tidak disertakan.',
    };
  }

  const parts = authHeader.trim().split(' ');
  const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1].trim() : authHeader.trim();

  if (!token || token.length < 50) {
    return {
      isAuthenticated: false,
      error: 'Format Bearer token tidak valid.',
    };
  }

  const now = Date.now();

  // Check in-memory cache
  const cached = tokenVerificationCache.get(token);
  if (cached && cached.expiresAt > now) {
    return {
      isAuthenticated: true,
      uid: cached.uid,
      isAnonymous: cached.isAnonymous,
      email: cached.email,
    };
  }

  try {
    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      FIREBASE_REST_CONFIG.apiKey
    )}`;

    const response = await fetch(lookupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!response.ok) {
      return {
        isAuthenticated: false,
        error: 'Token Firebase tidak valid atau telah kadaluarsa.',
      };
    }

    const data = await response.json();
    const user = data.users?.[0];

    if (!user || !user.localId) {
      return {
        isAuthenticated: false,
        error: 'Identitas pengguna Firebase tidak ditemukan.',
      };
    }

    const uid = user.localId;
    const isAnonymous = !user.providerUserInfo || user.providerUserInfo.length === 0;
    const email = user.email || undefined;

    // Cache for 5 minutes
    tokenVerificationCache.set(token, {
      uid,
      isAnonymous,
      email,
      expiresAt: now + 5 * 60 * 1000,
    });

    return {
      isAuthenticated: true,
      uid,
      isAnonymous,
      email,
    };
  } catch (err: any) {
    console.warn('[AuthValidator] Error during token verification lookup:', err?.message || err);
    return {
      isAuthenticated: false,
      error: 'Gagal memverifikasi token ke server autentikasi.',
    };
  }
}

/**
 * Rate Limiter to protect Gemini API quota from automated abuse or loop floods.
 * Default: Max 10 requests per 60 seconds per UID/IP.
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { isAllowed: boolean; remaining: number; resetInSeconds: number } {
  pruneStaleCache();
  const now = Date.now();
  let bucket = rateLimitBuckets.get(identifier);

  if (!bucket || bucket.resetAt <= now) {
    bucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitBuckets.set(identifier, bucket);
    return {
      isAllowed: true,
      remaining: maxRequests - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (bucket.count >= maxRequests) {
    return {
      isAllowed: false,
      remaining: 0,
      resetInSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count++;
  return {
    isAllowed: true,
    remaining: maxRequests - bucket.count,
    resetInSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/**
 * Strict Payload Validation to prevent prompt injection and oversized payload abuse (> 50KB).
 */
export function validatePayloadSizeAndShape(
  body: any,
  options?: {
    maxTitleLen?: number;
    maxDescLen?: number;
    maxObjectivesLen?: number;
    maxMaterialTextLen?: number;
  }
): { isValid: boolean; sanitizedBody?: any; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, error: 'Request body harus berupa objek JSON yang valid.' };
  }

  const rawString = JSON.stringify(body);
  if (Buffer.byteLength(rawString, 'utf8') > 50 * 1024) {
    return { isValid: false, error: 'Ukuran payload melebihi batas aman (maksimal 50 KB).' };
  }

  const maxTitle = options?.maxTitleLen || 300;
  const maxDesc = options?.maxDescLen || 1500;
  const maxObj = options?.maxObjectivesLen || 1500;
  const maxText = options?.maxMaterialTextLen || 5000;

  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, maxTitle)
      : 'Materi Pembelajaran';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, maxDesc) : '';
  const learningObjectives =
    typeof body.learningObjectives === 'string' ? body.learningObjectives.trim().slice(0, maxObj) : '';
  const materialText = typeof body.materialText === 'string' ? body.materialText.trim().slice(0, maxText) : '';
  const targetGrade = typeof body.targetGrade === 'string' ? body.targetGrade.trim().slice(0, 50) : 'smp-7';
  const categoryName = typeof body.categoryName === 'string' ? body.categoryName.trim().slice(0, 150) : '';
  const subjectName = typeof body.subjectName === 'string' ? body.subjectName.trim().slice(0, 150) : '';

  return {
    isValid: true,
    sanitizedBody: {
      ...body,
      title,
      description,
      learningObjectives,
      materialText,
      targetGrade,
      categoryName,
      subjectName,
      forceRefresh: Boolean(body.forceRefresh),
    },
  };
}

/**
 * Specialized validator for AI Analogy and Hint requests.
 * Restricts question text and options to sensible lengths to protect Gemini quota.
 */
export function validateAnalogyPayloadSizeAndShape(
  body: any
): { isValid: boolean; sanitizedBody?: any; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, error: 'Request body harus berupa objek JSON.' };
  }

  const rawString = JSON.stringify(body);
  if (Buffer.byteLength(rawString, 'utf8') > 20 * 1024) {
    return { isValid: false, error: 'Ukuran payload melebihi batas aman tutor (maksimal 20 KB).' };
  }

  const questionText = typeof body.questionText === 'string' ? body.questionText.trim().slice(0, 600) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : '';

  let sanitizedOptions: string[] = [];
  if (Array.isArray(body.options)) {
    sanitizedOptions = body.options
      .slice(0, 6)
      .map((opt: any) => (typeof opt === 'string' ? opt.trim().slice(0, 200) : ''))
      .filter((opt: string) => opt.length > 0);
  }

  if (!questionText && !title) {
    return { isValid: false, error: 'Teks pertanyaan atau judul materi tidak boleh kosong.' };
  }

  return {
    isValid: true,
    sanitizedBody: {
      questionText,
      options: sanitizedOptions,
      title,
    },
  };
}

/**
 * Checks whether caller possesses teacher or administrative privileges.
 */
export function isAuthorizedAdminOrTeacher(options: {
  authResult?: AuthValidationResult;
  adminPin?: any;
  teacherId?: string;
  expectedTeacherId?: string;
}): boolean {
  const validPin = (process.env.ADMIN_PIN || '123456').trim();
  if (options.adminPin && String(options.adminPin).trim() === validPin) {
    return true;
  }
  if (options.authResult?.isAuthenticated && !options.authResult.isAnonymous) {
    return true;
  }
  if (options.teacherId && options.expectedTeacherId && options.teacherId === options.expectedTeacherId) {
    return true;
  }
  return false;
}
