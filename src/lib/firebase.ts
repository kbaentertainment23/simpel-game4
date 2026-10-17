import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress benign internal transport retry logs
try {
  setLogLevel('silent');
} catch {
  try {
    setLogLevel('error');
  } catch {}
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const rawDbId = (firebaseConfig as any)?.firestoreDatabaseId;
// If the projectId is not gen-lang-client-0428584833 (e.g. user linked their own Firebase project)
// and rawDbId is an ai-studio-* generated id, it won't exist in the user's project where the default is (default).
const projectId = (firebaseConfig as any)?.projectId || '';
const isAiStudioDbOnCustomProject =
  projectId !== 'gen-lang-client-0428584833' &&
  Boolean(rawDbId && (String(rawDbId).startsWith('ai-studio-') || String(rawDbId).includes('88a558cb')));

const isDefaultOrEmpty = !rawDbId || rawDbId === '(default)' || rawDbId === 'default' || isAiStudioDbOnCustomProject;

let db: ReturnType<typeof getFirestore>;

try {
  db = isDefaultOrEmpty
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    : initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        rawDbId
      );
} catch {
  try {
    // Fallback 1: Persistent cache without multi-tab manager (e.g. if indexedDB lock exists)
    db = isDefaultOrEmpty
      ? initializeFirestore(app, { localCache: persistentLocalCache({}) })
      : initializeFirestore(app, { localCache: persistentLocalCache({}) }, rawDbId);
  } catch {
    try {
      // Fallback 2: In-memory cache for restricted iframes / privacy mode
      db = isDefaultOrEmpty
        ? initializeFirestore(app, { localCache: memoryLocalCache() })
        : initializeFirestore(app, { localCache: memoryLocalCache() }, rawDbId);
    } catch {
      try {
        db = isDefaultOrEmpty ? getFirestore(app) : getFirestore(app, rawDbId);
      } catch {
        db = getFirestore(app);
      }
    }
  }
}

// Initialize Firebase Auth with fallback persistence (indexedDB -> localStorage -> inMemory)
// Prevents "Database is closing/hidden" or IndexedDB locking errors in sandboxed iframes and PWA tabs
let auth: ReturnType<typeof getAuth>;

try {
  if (typeof window !== 'undefined') {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
  } else {
    auth = getAuth(app);
  }
} catch {
  try {
    auth = getAuth(app);
  } catch {
    auth = initializeAuth(app, {
      persistence: [inMemoryPersistence],
    });
  }
}

// Validate Connection to Firestore (MANDATORY CONSTRAINT from Firebase Skill)
export async function testConnection(): Promise<{ ok: boolean; message?: string }> {
  try {
    const { doc, getDocFromServer } = await import('firebase/firestore');
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline. Sistem tetap beroperasi stabil menggunakan cache lokal.');
      return { ok: false, message: 'offline' };
    }
    // Server was contacted successfully (even if doc doesn't exist)
    return { ok: true };
  }
}

if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}

// Attempt silent anonymous authentication if not already authenticated
// This fulfills Firestore security rules requiring `request.auth != null`
if (typeof window !== 'undefined') {
  try {
    onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          signInAnonymously(auth).catch((err) => {
            // Check for benign database closing/hidden or network errors during tab unload
            const msg = String(err?.message || err);
            if (msg.includes('Database is closing') || msg.includes('hidden') || msg.includes('network-request-failed')) {
              return;
            }
            console.warn(
              '[Firebase Auth] Anonymous sign-in belum aktif di Firebase Console. Pastikan untuk mengaktifkan: Firebase Console > Build > Authentication > Sign-in method > Anonymous (Anonim) > Enable.',
              err?.message || err
            );
          });
        }
      },
      (err) => {
        // Catch auth state listener internal errors (e.g. Database is closing/hidden)
        const msg = String(err?.message || err);
        if (!msg.includes('Database is closing') && !msg.includes('hidden')) {
          console.warn('[Firebase Auth] Auth state listener notice:', err);
        }
      }
    );
  } catch (listenerErr) {
    console.warn('[Firebase Auth] Could not attach auth state listener:', listenerErr);
  }
}

export { app, db, auth };


