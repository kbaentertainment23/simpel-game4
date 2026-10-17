/**
 * Security & Cryptography Utilities for SIMPEL
 * Provides SHA-256 hashing for credentials (Admin PIN, Teacher/Student Passwords)
 * with multi-runtime support (Browser & Node.js), safe migration verification,
 * and data sanitization routines to prevent leaking passwords to client components or localStorage.
 */

const PIN_SALT = 'simpel_pin_salt_2026';
const TEACHER_SALT = 'simpel_teacher_salt_2026';
const STUDENT_SALT = 'simpel_student_salt_2026';

/**
 * Hashes a string using standard Web Crypto API (SHA-256).
 * Compatible with modern browsers and Node.js 18+ runtime.
 */
export async function hashCredential(input: string, salt: string = PIN_SALT): Promise<string> {
  const cleanInput = (input || '').trim();
  if (!cleanInput) return '';

  try {
    const cryptoObj =
      (typeof globalThis !== 'undefined' && globalThis.crypto) ||
      (typeof window !== 'undefined' ? window.crypto : undefined);

    if (cryptoObj && cryptoObj.subtle) {
      const enc = new TextEncoder();
      const data = enc.encode(`${salt}:${cleanInput}`);
      const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('Web Crypto subtle digest failed, using fallback:', err);
  }

  // Fallback hash implementation if Web Crypto subtle is unavailable
  let hash = 0;
  const str = `${salt}:${cleanInput}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

/**
 * Verifies if user input matches either a stored hash or a legacy plaintext credential.
 * Supports string/number credentials, case-insensitivity, default password fallbacks,
 * and salt variations to guarantee valid logins never fail during migration.
 */
export async function verifyCredential(
  input: any,
  storedHashOrPlain?: any,
  salt: string = PIN_SALT,
  options?: { allowDefaultIfEmpty?: boolean; defaultCredential?: string }
): Promise<boolean> {
  const cleanInput = input !== undefined && input !== null ? String(input).trim() : '';
  if (!cleanInput) return false;

  // If no password or hash is set in the database
  if (storedHashOrPlain === undefined || storedHashOrPlain === null || String(storedHashOrPlain).trim() === '') {
    if (options?.allowDefaultIfEmpty && options?.defaultCredential) {
      return cleanInput === options.defaultCredential;
    }
    // Backward-compatible uninitialized fallback during migration
    return cleanInput === 'pass123' || cleanInput === '12345' || cleanInput === 'guru123';
  }

  const cleanStored = String(storedHashOrPlain).trim();

  // 1. Hash match with specified salt (Highest priority, standard modern hash)
  const hashedInput = await hashCredential(cleanInput, salt);
  if (hashedInput.toLowerCase() === cleanStored.toLowerCase()) {
    return true;
  }

  // 2. Fallback salts (STUDENT_SALT, PIN_SALT, TEACHER_SALT) for cross-salt migration tolerance
  const allSalts = [STUDENT_SALT, PIN_SALT, TEACHER_SALT];
  for (const s of allSalts) {
    if (s !== salt) {
      const altHash = await hashCredential(cleanInput, s);
      if (altHash.toLowerCase() === cleanStored.toLowerCase()) return true;
    }
  }

  // 3. Raw unsalted SHA-256 hash check if legacy hash was created without salt
  try {
    const cryptoObj =
      (typeof globalThis !== 'undefined' && globalThis.crypto) ||
      (typeof window !== 'undefined' ? window.crypto : undefined);
    if (cryptoObj && cryptoObj.subtle) {
      const enc = new TextEncoder();
      const rawData = enc.encode(cleanInput);
      const rawBuffer = await cryptoObj.subtle.digest('SHA-256', rawData);
      const rawHex = Array.from(new Uint8Array(rawBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
      if (rawHex.toLowerCase() === cleanStored.toLowerCase()) return true;
    }
  } catch {}

  // 4. Legacy plaintext match fallback (only for unmigrated accounts that still have plain text in DB)
  if (cleanInput === cleanStored || cleanInput.toLowerCase() === cleanStored.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Removes sensitive fields (like plain password and hash) from teacher account before public rendering
 */
export function sanitizeTeacherForPublic<T extends { password?: string; passwordHash?: string }>(
  teacher: T
): Omit<T, 'password' | 'passwordHash'> {
  if (!teacher) return teacher;
  const { password, passwordHash, ...safe } = teacher;
  return safe as Omit<T, 'password' | 'passwordHash'>;
}

/**
 * Removes sensitive fields (like plain password and hash) from student account before public rendering
 */
export function sanitizeStudentForPublic<T extends { password?: string; passwordHash?: string }>(
  student: T
): Omit<T, 'password' | 'passwordHash'> {
  if (!student) return student;
  const { password, passwordHash, ...safe } = student;
  return safe as Omit<T, 'password' | 'passwordHash'>;
}

/**
 * Sanitizes an AuthSession object completely, stripping any passwords or password hashes
 */
export function sanitizeAuthSession<T extends { role: string; teacher?: any; student?: any }>(
  session: T
): T {
  if (!session) return session;
  const clean: any = { role: session.role };
  if (session.teacher) {
    clean.teacher = sanitizeTeacherForPublic(session.teacher);
  }
  if (session.student) {
    clean.student = sanitizeStudentForPublic(session.student);
  }
  return clean as T;
}

export { PIN_SALT, TEACHER_SALT, STUDENT_SALT };
