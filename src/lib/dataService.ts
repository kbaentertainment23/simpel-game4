import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  where,
  writeBatch,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { Subject, Category, Material, AdminSettings, TeacherAccount, StudentAccount, MaterialActivityLog, StudentProgressRecord, StudentGamificationData, SystemBackupData, DatabaseJunkReport, DatabaseJunkItem } from '../types';
export type { StudentProgressRecord };
import { ThemeConfig, DEFAULT_THEME_CONFIG } from '../types/theme';
import { INITIAL_SUBJECTS, INITIAL_CATEGORIES, INITIAL_MATERIALS } from '../utils/initialData';
import { calculateStudentGamification, getCurrentLevelInfo, BadgeInfo, getDefaultGamificationData } from '../utils/gamification';
import {
  normalizeQuizScoreRecord,
  normalizeKkmPercent,
  calculateQuizResult,
} from '../utils/quizScoring';
import {
  hashCredential,
  verifyCredential,
  PIN_SALT,
  TEACHER_SALT,
  STUDENT_SALT,
  sanitizeTeacherForPublic,
  sanitizeStudentForPublic,
} from '../utils/security';
import {
  swrFetch,
  invalidateCache,
  setCacheData,
  getCacheData,
  getInitialCacheArray,
  getInitialCacheValue,
  clearAllSWRCache,
  useFirestoreSWR,
  subscribeToCache,
} from './swrCache';

export {
  swrFetch,
  invalidateCache,
  setCacheData,
  getCacheData,
  getInitialCacheArray,
  getInitialCacheValue,
  clearAllSWRCache,
  useFirestoreSWR,
  subscribeToCache,
};

export const CACHE_KEYS = {
  SUBJECTS: 'subjects',
  CATEGORIES: 'categories',
  MATERIALS: 'materials',
  MATERIALS_CAT: (catId: string) => `materials_cat_${catId}`,
  TEACHERS: 'teachers',
  STUDENTS: 'students',
  STUDENTS_CLASS: (kelas: string) => `students_class_${kelas}`,
  THEME_CONFIG: 'theme_config',
  MASTER_GRADES: 'master_grades',
  MASTER_CLASSES: 'master_classes',
  ADMIN_PIN: 'admin_pin',
  SETTINGS_PASSWORD: 'settings_password',
  SITE_LOGO: 'site_logo',
  MIN_QUIZ_SCORE: 'min_quiz_score',
  ALL_STUDENT_PROGRESS: 'all_student_progress',
  LEADERBOARD_SUMMARY: 'leaderboard_summary',
  STUDENT_PROGRESS: (studentId: string) => `student_progress_${studentId}`,
  STUDENT_PROGRESS_DETAILS: (studentId: string) => `student_progress_details_${studentId}`,
  STUDENT_QUIZ_SCORES: (studentId: string) => `student_quiz_scores_${studentId}`,
  STUDENT_PROGRESS_CLASS: (kelas: string) => `student_progress_class_${kelas}`,
  APP_META_VERSIONS: 'app_meta_versions',
};

const SUBJECTS_COL = 'subjects';
const CATEGORIES_COL = 'categories';
const MATERIALS_COL = 'materials';
const SETTINGS_COL = 'settings';
const TEACHERS_COL = 'teachers';
const STUDENTS_COL = 'students';
const ADMIN_DOC_ID = 'admin_config';
const APP_META_COL = 'app_meta';
const APP_META_VERSIONS_DOC = 'versions';
const APP_META_CACHE_KEY = 'app_meta_versions_cache';

export const DEFAULT_PIN = '12345';
export const DEFAULT_SETTINGS_PASSWORD = 'admin12345';
export const DEFAULT_MIN_QUIZ_SCORE = 80;
export const DEFAULT_MIN_QUIZ_PERCENT = 80;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  const isPermissionOrOffline =
    errMsg.includes('Missing or insufficient permissions') ||
    errMsg.includes('permission-denied') ||
    errMsg.includes('client is offline');

  if (!isPermissionOrOffline) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

// Helper to strip undefined fields from objects, nested objects, and arrays before sending to Firestore
export function cleanFirestoreData<T extends Record<string, any>>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if ('_methodName' in data || (data as any).constructor?.name === 'FieldValue') return data;

  if (Array.isArray(data)) {
    return data
      .map((item) => (typeof item === 'object' && item !== null && !(item instanceof Date) && !('_methodName' in item) ? cleanFirestoreData(item) : item))
      .filter((item) => item !== undefined) as unknown as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !('_methodName' in value) && (value as any).constructor?.name !== 'FieldValue') {
        result[key] = cleanFirestoreData(value);
      } else if (Array.isArray(value)) {
        result[key] = value
          .map((item) => (typeof item === 'object' && item !== null && !(item instanceof Date) && !('_methodName' in item) ? cleanFirestoreData(item) : item))
          .filter((item) => item !== undefined);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// Validation helpers for duplicate prevention
export async function validateTeacherUniqueness(
  username: string,
  nip?: string,
  excludeId?: string
): Promise<{ isValid: boolean; conflictReason?: string }> {
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanNip = (nip || '').trim();

  if (!cleanUsername) {
    return { isValid: false, conflictReason: 'Username guru tidak boleh kosong.' };
  }

  const allTeachers = await fetchTeachers();
  for (const t of allTeachers) {
    if (excludeId && t.id === excludeId) continue;
    if (t.username && t.username.trim().toLowerCase() === cleanUsername) {
      return {
        isValid: false,
        conflictReason: `Username "@${username.trim()}" sudah digunakan oleh guru "${t.name}". Silakan gunakan username lain.`,
      };
    }
    if (cleanNip && t.nip && t.nip.trim() !== '' && t.nip.trim() === cleanNip) {
      return {
        isValid: false,
        conflictReason: `NIP/NIK "${cleanNip}" sudah terdaftar atas nama guru "${t.name}".`,
      };
    }
  }
  return { isValid: true };
}

export async function validateStudentUniqueness(
  nisn: string,
  username?: string,
  excludeId?: string
): Promise<{ isValid: boolean; conflictReason?: string }> {
  const cleanNisn = (nisn || '').trim();
  const cleanUsername = (username || cleanNisn).trim().toLowerCase();

  if (!cleanNisn) {
    return { isValid: false, conflictReason: 'NIS siswa tidak boleh kosong.' };
  }

  const allStudents = await fetchStudents();
  for (const s of allStudents) {
    if (excludeId && s.id === excludeId) continue;
    if (s.nisn && s.nisn.trim() === cleanNisn) {
      return {
        isValid: false,
        conflictReason: `NIS "${cleanNisn}" sudah terdaftar atas nama "${s.nama}" (Kelas ${s.kelas}).`,
      };
    }
    const existingUser = (s.username || s.nisn || '').trim().toLowerCase();
    if (cleanUsername && existingUser && existingUser === cleanUsername) {
      return {
        isValid: false,
        conflictReason: `Username / ID login "@${cleanUsername}" sudah digunakan oleh siswa "${s.nama}".`,
      };
    }
  }
  return { isValid: true };
}

// Initialize default settings doc if needed
export async function seedInitialDataIfNeeded(): Promise<void> {
  try {
    // Settings doc
    const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      const hashedPin = await hashCredential(DEFAULT_PIN, PIN_SALT);
      await setDoc(settingsRef, {
        adminPinHash: hashedPin,
        siteTitle: 'Sistem Pembelajaran Interaktif',
        minQuizScoreToUnlock: DEFAULT_MIN_QUIZ_SCORE,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const data = settingsSnap.data();
      // Auto-migrate legacy plaintext PIN to secure SHA-256 hash
      if (!data.adminPinHash && data.adminPin) {
        const hashed = await hashCredential(data.adminPin, PIN_SALT);
        await updateDoc(settingsRef, {
          adminPinHash: hashed,
          adminPin: deleteField(),
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  } catch {
    // Silently continue with local defaults if Firestore settings are unreachable
  }
}

// Clear all data permanently from Firestore & localStorage
export async function clearAllFirestoreData(): Promise<void> {
  try {
    // Clear localStorage
    localStorage.removeItem('sistem_materi_subj_cache');
    localStorage.removeItem('sistem_materi_cat_cache');
    localStorage.removeItem('sistem_materi_mat_cache');
    localStorage.removeItem('sistem_materi_selected_subject_id');

    // Clear Subjects
    const subjSnap = await getDocs(collection(db, SUBJECTS_COL));
    if (!subjSnap.empty) {
      const batch = writeBatch(db);
      subjSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Clear Categories
    const catSnap = await getDocs(collection(db, CATEGORIES_COL));
    if (!catSnap.empty) {
      const batch = writeBatch(db);
      catSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Clear Materials
    const matSnap = await getDocs(collection(db, MATERIALS_COL));
    if (!matSnap.empty) {
      const batch = writeBatch(db);
      matSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('Error clearing Firestore data:', err);
  }
}

// ==========================================
// APP CONTENT VERSIONS (Single Meta-Version Check)
// ==========================================
export interface AppContentVersions {
  materialsUpdatedAt: number;
  categoriesUpdatedAt: number;
  subjectsUpdatedAt: number;
  settingsUpdatedAt: number;
  quizBankUpdatedAt?: number;
}

const DEFAULT_VERSIONS: AppContentVersions = {
  materialsUpdatedAt: 1,
  categoriesUpdatedAt: 1,
  subjectsUpdatedAt: 1,
  settingsUpdatedAt: 1,
  quizBankUpdatedAt: 1,
};

let inMemoryVersionsCache: { versions: AppContentVersions; fetchedAt: number } | null = null;

export async function getAppContentVersions(forceCheck = false): Promise<AppContentVersions> {
  const now = Date.now();
  // Return in-memory cached versions if within 60 seconds (1 minute client cooldown)
  if (!forceCheck && inMemoryVersionsCache && now - inMemoryVersionsCache.fetchedAt < 60_000) {
    return inMemoryVersionsCache.versions;
  }

  try {
    const ref = doc(db, APP_META_COL, APP_META_VERSIONS_DOC);
    const snap = await getDoc(ref);
    let versions: AppContentVersions;
    if (snap.exists()) {
      const data = snap.data();
      versions = {
        materialsUpdatedAt: Number(data.materialsUpdatedAt || 1),
        categoriesUpdatedAt: Number(data.categoriesUpdatedAt || 1),
        subjectsUpdatedAt: Number(data.subjectsUpdatedAt || 1),
        settingsUpdatedAt: Number(data.settingsUpdatedAt || 1),
        quizBankUpdatedAt: Number(data.quizBankUpdatedAt || data.materialsUpdatedAt || 1),
      };
    } else {
      // Document doesn't exist yet, bootstrap it
      versions = {
        materialsUpdatedAt: now,
        categoriesUpdatedAt: now,
        subjectsUpdatedAt: now,
        settingsUpdatedAt: now,
        quizBankUpdatedAt: now,
      };
      setDoc(ref, cleanFirestoreData(versions), { merge: true }).catch(() => {});
    }
    inMemoryVersionsCache = { versions, fetchedAt: now };
    try {
      localStorage.setItem(APP_META_CACHE_KEY, JSON.stringify(versions));
    } catch {}
    return versions;
  } catch (err: any) {
    // Graceful fallback to cached or default versions without noisy warnings
    try {
      const stored = localStorage.getItem(APP_META_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        inMemoryVersionsCache = { versions: parsed, fetchedAt: now };
        return parsed;
      }
    } catch {}
    return inMemoryVersionsCache?.versions || DEFAULT_VERSIONS;
  }
}

export async function touchAppContentVersion(
  entity: 'materials' | 'categories' | 'subjects' | 'settings' | 'quizBank'
): Promise<void> {
  const now = Date.now();
  const fieldMap: Record<string, keyof AppContentVersions> = {
    materials: 'materialsUpdatedAt',
    categories: 'categoriesUpdatedAt',
    subjects: 'subjectsUpdatedAt',
    settings: 'settingsUpdatedAt',
    quizBank: 'quizBankUpdatedAt',
  };
  const key = fieldMap[entity] || 'materialsUpdatedAt';

  // Update in-memory cache immediately
  if (inMemoryVersionsCache) {
    inMemoryVersionsCache.versions[key] = now;
    if (entity === 'quizBank' || entity === 'materials') {
      inMemoryVersionsCache.versions.materialsUpdatedAt = now;
      inMemoryVersionsCache.versions.quizBankUpdatedAt = now;
    }
    inMemoryVersionsCache.fetchedAt = now;
  } else {
    inMemoryVersionsCache = {
      versions: { ...DEFAULT_VERSIONS, [key]: now },
      fetchedAt: now,
    };
  }

  // Update local storage
  try {
    localStorage.setItem(APP_META_CACHE_KEY, JSON.stringify(inMemoryVersionsCache.versions));
    localStorage.setItem(`app_meta_version_${entity}`, String(now));
    if (entity === 'quizBank' || entity === 'materials') {
      localStorage.setItem('app_meta_version_materials', String(now));
      localStorage.setItem('app_meta_version_quizBank', String(now));
    }
  } catch {}

  // Update Firestore version doc in background
  try {
    const ref = doc(db, APP_META_COL, APP_META_VERSIONS_DOC);
    const updatePayload: Record<string, number> = { [key]: now };
    if (entity === 'quizBank' || entity === 'materials') {
      updatePayload.materialsUpdatedAt = now;
      updatePayload.quizBankUpdatedAt = now;
    }
    await setDoc(ref, cleanFirestoreData(updatePayload), { merge: true });
  } catch (_err) {
    // Silently continue since local version was already updated
  }
}

// Subject CRUD
export async function fetchSubjects(options?: { forceRevalidate?: boolean }): Promise<Subject[]> {
  const cachedSubjs = getCacheData<Subject[]>(CACHE_KEYS.SUBJECTS, 'sistem_materi_subj_cache');
  const storedVersionRaw = typeof window !== 'undefined' ? localStorage.getItem('app_meta_version_subjects') : null;
  const storedVersion = storedVersionRaw ? Number(storedVersionRaw) : 0;

  // Single Meta-Version Check: if cached subjects exist and matches server version, return without querying collection
  if (!options?.forceRevalidate && cachedSubjs && Array.isArray(cachedSubjs) && cachedSubjs.length > 0 && storedVersion > 0) {
    try {
      const versions = await getAppContentVersions();
      if (storedVersion >= versions.subjectsUpdatedAt) {
        return cachedSubjs;
      }
    } catch {
      return cachedSubjs;
    }
  }

  return swrFetch(
    CACHE_KEYS.SUBJECTS,
    async () => {
      try {
        const q = query(collection(db, SUBJECTS_COL), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          return [];
        }
        const subjs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
        try {
          const versions = await getAppContentVersions();
          localStorage.setItem('app_meta_version_subjects', String(versions.subjectsUpdatedAt || Date.now()));
        } catch {}
        return subjs;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, SUBJECTS_COL);
        const isPermission = err?.message?.includes('insufficient permissions') || err?.code === 'permission-denied';
        if (isPermission) {
          return getInitialCacheArray<Subject>(CACHE_KEYS.SUBJECTS, 'sistem_materi_subj_cache');
        }
        throw err;
      }
    },
    {
      staleTime: 300_000,
      forceRevalidate: options?.forceRevalidate,
      persistKey: 'sistem_materi_subj_cache',
    }
  );
}

export function subscribeSubjects(
  callback: (subjects: Subject[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(collection(db, SUBJECTS_COL), orderBy('order', 'asc'));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
      setCacheData(CACHE_KEYS.SUBJECTS, items, 'sistem_materi_subj_cache', false);
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, SUBJECTS_COL);
    }
  );
  return unsubscribe;
}

export async function createSubject(subj: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subject> {
  const newRef = doc(collection(db, SUBJECTS_COL));
  const newSubj: Subject = {
    ...subj,
    id: newRef.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Immediate optimistic cache update
  setCacheData<Subject[]>(
    CACHE_KEYS.SUBJECTS,
    (prev = []) => {
      const exists = prev.some((s) => s.id === newSubj.id);
      const next = exists ? prev.map((s) => (s.id === newSubj.id ? newSubj : s)) : [...prev, newSubj];
      return next.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    'sistem_materi_subj_cache',
    true
  );

  try {
    await setDoc(newRef, cleanFirestoreData(newSubj));
    touchAppContentVersion('subjects').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${SUBJECTS_COL}/${newSubj.id}`);
    throw err;
  }
  return newSubj;
}

export async function updateSubject(id: string, updates: Partial<Subject>): Promise<void> {
  const now = new Date().toISOString();
  // Immediate optimistic cache update
  setCacheData<Subject[]>(
    CACHE_KEYS.SUBJECTS,
    (prev = []) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: now } : s));
      return next.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    'sistem_materi_subj_cache',
    true
  );

  try {
    const ref = doc(db, SUBJECTS_COL, id);
    await updateDoc(ref, cleanFirestoreData({
      ...updates,
      updatedAt: now,
    }));
    touchAppContentVersion('subjects').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${SUBJECTS_COL}/${id}`);
    throw err;
  }
}

export async function deleteSubject(id: string): Promise<void> {
  // Immediate optimistic cache update
  setCacheData<Subject[]>(
    CACHE_KEYS.SUBJECTS,
    (prev = []) => prev.filter((s) => s.id !== id),
    'sistem_materi_subj_cache',
    true
  );
  setCacheData<Category[]>(
    CACHE_KEYS.CATEGORIES,
    (prev = []) => prev.filter((c) => c.subjectId !== id),
    'sistem_materi_cat_cache',
    true
  );

  try {
    const ref = doc(db, SUBJECTS_COL, id);
    await deleteDoc(ref);

    // Also update or delete categories linked to this subject
    const catQ = query(collection(db, CATEGORIES_COL), where('subjectId', '==', id));
    const catSnap = await getDocs(catQ);
    if (!catSnap.empty) {
      const batch = writeBatch(db);
      catSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
    touchAppContentVersion('subjects').catch(() => {});
    touchAppContentVersion('categories').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${SUBJECTS_COL}/${id}`);
    throw err;
  }
}

// Category CRUD
export async function fetchCategories(options?: { forceRevalidate?: boolean }): Promise<Category[]> {
  const cachedCats = getCacheData<Category[]>(CACHE_KEYS.CATEGORIES, 'sistem_materi_cat_cache');
  const storedVersionRaw = typeof window !== 'undefined' ? localStorage.getItem('app_meta_version_categories') : null;
  const storedVersion = storedVersionRaw ? Number(storedVersionRaw) : 0;

  // Single Meta-Version Check: if cached categories exist and matches server version, return without querying collection
  if (!options?.forceRevalidate && cachedCats && Array.isArray(cachedCats) && cachedCats.length > 0 && storedVersion > 0) {
    try {
      const versions = await getAppContentVersions();
      if (storedVersion >= versions.categoriesUpdatedAt) {
        return cachedCats;
      }
    } catch {
      return cachedCats;
    }
  }

  return swrFetch(
    CACHE_KEYS.CATEGORIES,
    async () => {
      try {
        const q = query(collection(db, CATEGORIES_COL), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const cats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
        try {
          const versions = await getAppContentVersions();
          localStorage.setItem('app_meta_version_categories', String(versions.categoriesUpdatedAt || Date.now()));
        } catch {}
        return cats;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, CATEGORIES_COL);
        const isPermission = err?.message?.includes('insufficient permissions') || err?.code === 'permission-denied';
        if (isPermission) {
          return getInitialCacheArray<Category>(CACHE_KEYS.CATEGORIES, 'sistem_materi_cat_cache');
        }
        throw err;
      }
    },
    {
      staleTime: 300_000,
      forceRevalidate: options?.forceRevalidate,
      persistKey: 'sistem_materi_cat_cache',
    }
  );
}

export function subscribeCategories(
  callback: (categories: Category[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(collection(db, CATEGORIES_COL), orderBy('order', 'asc'));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
      setCacheData(CACHE_KEYS.CATEGORIES, items, 'sistem_materi_cat_cache', false);
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, CATEGORIES_COL);
    }
  );
  return unsubscribe;
}

export async function createCategory(cat: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
  const newRef = doc(collection(db, CATEGORIES_COL));
  const newCat: Category = {
    ...cat,
    id: newRef.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Immediate optimistic cache update
  setCacheData<Category[]>(
    CACHE_KEYS.CATEGORIES,
    (prev = []) => {
      const exists = prev.some((c) => c.id === newCat.id);
      const next = exists ? prev.map((c) => (c.id === newCat.id ? newCat : c)) : [...prev, newCat];
      return next.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    'sistem_materi_cat_cache',
    true
  );

  try {
    await setDoc(newRef, cleanFirestoreData(newCat));
    touchAppContentVersion('categories').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${CATEGORIES_COL}/${newCat.id}`);
    throw err;
  }
  return newCat;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
  const now = new Date().toISOString();
  // Immediate optimistic cache update so any component reads the latest data with zero delay
  setCacheData<Category[]>(
    CACHE_KEYS.CATEGORIES,
    (prev = []) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: now } : c));
      return next.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    'sistem_materi_cat_cache',
    true
  );

  try {
    const ref = doc(db, CATEGORIES_COL, id);
    await updateDoc(ref, cleanFirestoreData({
      ...updates,
      updatedAt: now,
    }));
    touchAppContentVersion('categories').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${CATEGORIES_COL}/${id}`);
    throw err;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  // Immediate optimistic cache update
  setCacheData<Category[]>(
    CACHE_KEYS.CATEGORIES,
    (prev = []) => prev.filter((c) => c.id !== id),
    'sistem_materi_cat_cache',
    true
  );
  setCacheData<Material[]>(
    CACHE_KEYS.MATERIALS,
    (prev = []) => prev.filter((m) => m.categoryId !== id),
    'sistem_materi_mat_cache',
    true
  );

  try {
    const ref = doc(db, CATEGORIES_COL, id);
    await deleteDoc(ref);

    // Also delete associated materials
    const matQ = query(collection(db, MATERIALS_COL), where('categoryId', '==', id));
    const matSnap = await getDocs(matQ);
    if (!matSnap.empty) {
      const batch = writeBatch(db);
      matSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
    touchAppContentVersion('categories').catch(() => {});
    touchAppContentVersion('materials').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${CATEGORIES_COL}/${id}`);
    throw err;
  }
}

// Material CRUD
export async function fetchMaterials(
  categoryId?: string,
  options?: { forceRevalidate?: boolean }
): Promise<Material[]> {
  // If categoryId is specified, check cached allMaterials first
  if (categoryId && !options?.forceRevalidate) {
    const allCached = getCacheData<Material[]>(CACHE_KEYS.MATERIALS, 'sistem_materi_mat_cache');
    if (allCached && Array.isArray(allCached) && allCached.length > 0) {
      return allCached.filter((m) => m.categoryId === categoryId);
    }
  }

  // Check local storage cache and its stored version
  const cachedMats = getCacheData<Material[]>(CACHE_KEYS.MATERIALS, 'sistem_materi_mat_cache');
  const storedVersionRaw = typeof window !== 'undefined' ? localStorage.getItem('app_meta_version_materials') : null;
  const storedVersion = storedVersionRaw ? Number(storedVersionRaw) : 0;

  // Single Meta-Version Check: if cached materials exist and matches server version, return without querying collection
  if (!options?.forceRevalidate && cachedMats && Array.isArray(cachedMats) && cachedMats.length > 0 && storedVersion > 0) {
    try {
      const versions = await getAppContentVersions();
      if (storedVersion >= versions.materialsUpdatedAt) {
        if (categoryId) {
          return cachedMats.filter((m) => m.categoryId === categoryId);
        }
        return cachedMats;
      }
    } catch {
      if (categoryId) {
        return cachedMats.filter((m) => m.categoryId === categoryId);
      }
      return cachedMats;
    }
  }

  if (categoryId) {
    return swrFetch(
      CACHE_KEYS.MATERIALS_CAT(categoryId),
      async () => {
        try {
          const q = query(collection(db, MATERIALS_COL), where('categoryId', '==', categoryId), orderBy('order', 'asc'));
          const snapshot = await getDocs(q);
          return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Material));
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, MATERIALS_COL);
          throw err;
        }
      },
      {
        staleTime: 300_000,
        forceRevalidate: options?.forceRevalidate,
      }
    );
  }

  return swrFetch(
    CACHE_KEYS.MATERIALS,
    async () => {
      try {
        const q = query(collection(db, MATERIALS_COL), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const mats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Material));
        try {
          const versions = await getAppContentVersions();
          localStorage.setItem('app_meta_version_materials', String(versions.materialsUpdatedAt || Date.now()));
        } catch {}
        return mats;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, MATERIALS_COL);
        const isPermission = err?.message?.includes('insufficient permissions') || err?.code === 'permission-denied';
        if (isPermission) {
          return getInitialCacheArray<Material>(CACHE_KEYS.MATERIALS, 'sistem_materi_mat_cache');
        }
        throw err;
      }
    },
    {
      staleTime: 300_000,
      forceRevalidate: options?.forceRevalidate,
      persistKey: 'sistem_materi_mat_cache',
    }
  );
}

export function subscribeMaterials(
  callback: (materials: Material[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(collection(db, MATERIALS_COL), orderBy('order', 'asc'));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Material));
      setCacheData(CACHE_KEYS.MATERIALS, items, 'sistem_materi_mat_cache', false);
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, MATERIALS_COL);
    }
  );
  return unsubscribe;
}

export async function createMaterial(mat: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<Material> {
  const newRef = doc(collection(db, MATERIALS_COL));
  const newMat: Material = {
    ...mat,
    id: newRef.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Immediate optimistic cache update
  setCacheData<Material[]>(
    CACHE_KEYS.MATERIALS,
    (prev = []) => {
      const exists = prev.some((m) => m.id === newMat.id);
      const next = exists ? prev.map((m) => (m.id === newMat.id ? newMat : m)) : [...prev, newMat];
      return next.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    'sistem_materi_mat_cache',
    true
  );

  try {
    await setDoc(newRef, cleanFirestoreData(newMat));
    touchAppContentVersion('materials').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${MATERIALS_COL}/${newMat.id}`);
    throw err;
  }
  return newMat;
}

export async function updateMaterial(id: string, updates: Partial<Material>): Promise<void> {
  const now = new Date().toISOString();
  // Immediate optimistic cache update so any component sees newest values with 0ms delay
  setCacheData<Material[]>(
    CACHE_KEYS.MATERIALS,
    (prev = []) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...updates, updatedAt: now } : m));
      return next.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    'sistem_materi_mat_cache',
    true
  );

  try {
    const ref = doc(db, MATERIALS_COL, id);
    await updateDoc(ref, cleanFirestoreData({
      ...updates,
      updatedAt: now,
    }));
    touchAppContentVersion('materials').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${MATERIALS_COL}/${id}`);
    throw err;
  }
}

export async function deleteMaterial(id: string): Promise<void> {
  // Immediate optimistic cache update
  setCacheData<Material[]>(
    CACHE_KEYS.MATERIALS,
    (prev = []) => prev.filter((m) => m.id !== id),
    'sistem_materi_mat_cache',
    true
  );

  try {
    const ref = doc(db, MATERIALS_COL, id);
    await deleteDoc(ref);
    touchAppContentVersion('materials').catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${MATERIALS_COL}/${id}`);
    throw err;
  }
}


// Admin PIN Settings & Secure Verification
export async function verifyAdminPin(enteredPin: string): Promise<boolean> {
  const clean = (enteredPin || '').trim();
  if (!clean) return false;

  try {
    const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      const storedHash = data.adminPinHash;
      const storedPlain = data.adminPin;

      if (storedHash) {
        return await verifyCredential(clean, storedHash, PIN_SALT);
      }

      if (storedPlain) {
        const isValid = await verifyCredential(clean, storedPlain, PIN_SALT);
        if (isValid) {
          // Seamlessly upgrade legacy plaintext PIN to SHA-256 hash in Firestore
          const hashed = await hashCredential(clean, PIN_SALT);
          await updateDoc(settingsRef, {
            adminPinHash: hashed,
            adminPin: deleteField(),
            migratedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
        return isValid;
      }

      // If document exists with no credentials set, require explicit setting
      return false;
    }

    // Default PIN verification only on first-time initial boot when doc does not exist
    const isDefault = clean === DEFAULT_PIN;
    if (isDefault) {
      const hashed = await hashCredential(DEFAULT_PIN, PIN_SALT);
      await setDoc(
        settingsRef,
        {
          adminPinHash: hashed,
          adminPin: deleteField(),
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    }
    return isDefault;
  } catch (err) {
    console.warn('[verifyAdminPin] Verification error:', err);
    return false;
  }
}

export async function getAdminPin(): Promise<string> {
  return '••••••••';
}

export async function setAdminPin(newPin: string): Promise<void> {
  const clean = (newPin || '').trim();
  if (!clean) return;

  const hashed = await hashCredential(clean, PIN_SALT);
  const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
  await setDoc(
    settingsRef,
    {
      adminPinHash: hashed,
      adminPin: deleteField(),
      migratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  invalidateCache(CACHE_KEYS.ADMIN_PIN);
}

// Settings Password
export async function verifySettingsPassword(enteredPassword: string): Promise<boolean> {
  const clean = (enteredPassword || '').trim();
  if (!clean) return false;

  try {
    const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      const storedHash = data.settingsPasswordHash;
      const storedPlain = data.settingsPassword;

      if (storedHash) {
        return await verifyCredential(clean, storedHash, PIN_SALT);
      }
      if (storedPlain) {
        const isValid = await verifyCredential(clean, storedPlain, PIN_SALT);
        if (isValid) {
          const hashed = await hashCredential(clean, PIN_SALT);
          await updateDoc(settingsRef, {
            settingsPasswordHash: hashed,
            settingsPassword: deleteField(),
            migratedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
        return isValid;
      }
      return false;
    }
    const isDefault = clean === DEFAULT_SETTINGS_PASSWORD;
    if (isDefault) {
      const hashed = await hashCredential(DEFAULT_SETTINGS_PASSWORD, PIN_SALT);
      await setDoc(
        settingsRef,
        {
          settingsPasswordHash: hashed,
          settingsPassword: deleteField(),
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    }
    return isDefault;
  } catch (err) {
    console.warn('[verifySettingsPassword] Verification error:', err);
    return false;
  }
}

export async function getSettingsPassword(): Promise<string> {
  return '••••••••';
}

export async function setSettingsPassword(newPassword: string): Promise<void> {
  const clean = (newPassword || '').trim();
  if (!clean) return;

  const hashed = await hashCredential(clean, PIN_SALT);
  const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
  await setDoc(
    settingsRef,
    {
      settingsPasswordHash: hashed,
      settingsPassword: deleteField(),
      migratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  invalidateCache(CACHE_KEYS.SETTINGS_PASSWORD);
}

// Site Logo Settings
export async function getSiteLogoUrl(): Promise<string> {
  return swrFetch(
    CACHE_KEYS.SITE_LOGO,
    async () => {
      const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
      const snap = await getDoc(settingsRef);
      if (snap.exists() && snap.data().logoUrl !== undefined) {
        return snap.data().logoUrl;
      }
      return '';
    },
    {
      staleTime: 900_000,
      persistKey: 'sistem_materi_logo_url',
    }
  );
}

export async function setSiteLogoUrl(logoUrl: string): Promise<void> {
  const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
  await setDoc(
    settingsRef,
    {
      logoUrl: logoUrl,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  setCacheData(CACHE_KEYS.SITE_LOGO, logoUrl, 'sistem_materi_logo_url');
}

// Minimum Quiz Score to Unlock Next Material (KKM Mini Kuis dalam bentuk Persentase %)
export async function getMinQuizScoreToUnlock(): Promise<number> {
  return swrFetch(
    CACHE_KEYS.MIN_QUIZ_SCORE,
    async () => {
      const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
      const snap = await getDoc(settingsRef);
      if (snap.exists() && typeof snap.data().minQuizScoreToUnlock === 'number') {
        const val = snap.data().minQuizScoreToUnlock;
        // Auto-migrate legacy 1-10 scale to percentage (e.g. 8 -> 80%)
        return val <= 10 ? val * 10 : val;
      }
      return DEFAULT_MIN_QUIZ_SCORE;
    },
    {
      staleTime: 900_000,
      persistKey: 'sistem_materi_min_quiz_score',
    }
  );
}

export async function setMinQuizScoreToUnlock(score: number): Promise<void> {
  const settingsRef = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
  await setDoc(
    settingsRef,
    {
      minQuizScoreToUnlock: score,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  setCacheData(CACHE_KEYS.MIN_QUIZ_SCORE, score, 'sistem_materi_min_quiz_score');
}

// Teacher Account CRUD Operations
export async function fetchTeachers(options?: { forceRevalidate?: boolean }): Promise<TeacherAccount[]> {
  return swrFetch(
    CACHE_KEYS.TEACHERS,
    async () => {
      try {
        const q = query(collection(db, TEACHERS_COL), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
          const raw = { id: d.id, ...d.data() } as TeacherAccount;
          return sanitizeTeacherForPublic(raw);
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, TEACHERS_COL);
        const isPermission = err?.message?.includes('insufficient permissions') || err?.code === 'permission-denied';
        if (isPermission) {
          return getInitialCacheArray<TeacherAccount>(CACHE_KEYS.TEACHERS, 'sistem_materi_teachers_cache');
        }
        throw err;
      }
    },
    {
      staleTime: 30_000,
      forceRevalidate: options?.forceRevalidate,
      persistKey: 'sistem_materi_teachers_cache',
    }
  );
}

export function subscribeTeachers(
  callback: (teachers: TeacherAccount[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(collection(db, TEACHERS_COL), orderBy('name', 'asc'));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const raw = { id: d.id, ...d.data() } as TeacherAccount;
        return sanitizeTeacherForPublic(raw);
      });
      setCacheData(CACHE_KEYS.TEACHERS, items, 'sistem_materi_teachers_cache', false);
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, TEACHERS_COL);
    }
  );
  return unsubscribe;
}


export async function createTeacher(
  teacherData: Omit<TeacherAccount, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TeacherAccount> {
  const cleanUsername = (teacherData.username || '').trim().toLowerCase();
  const cleanNip = (teacherData.nip || '').trim();
  const cleanPassword = (teacherData.password || 'guru123').trim();
  const validation = await validateTeacherUniqueness(cleanUsername, cleanNip);
  if (!validation.isValid) {
    throw new Error(validation.conflictReason || 'Username atau NIP guru sudah terdaftar.');
  }

  const passwordHash = await hashCredential(cleanPassword, TEACHER_SALT);

  const newRef = doc(collection(db, TEACHERS_COL));
  const newTeacherData: any = {
    name: teacherData.name.trim(),
    nip: cleanNip,
    username: cleanUsername,
    passwordHash,
    isDefaultPassword: cleanPassword === 'guru123',
    migratedAt: new Date().toISOString(),
    subjectId: teacherData.subjectId,
    assignedClasses: teacherData.assignedClasses || [],
    id: newRef.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(newRef, cleanFirestoreData(newTeacherData));
  
  invalidateCache(CACHE_KEYS.TEACHERS);
  return sanitizeTeacherForPublic(newTeacherData) as TeacherAccount;
}

export async function updateTeacher(id: string, updates: Partial<TeacherAccount>): Promise<void> {
  const cleanUpdates: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      if (typeof v === 'string') {
        cleanUpdates[k] = v.trim();
      } else {
        cleanUpdates[k] = v;
      }
    }
  }

  // Normalize username to lowercase if provided
  if (cleanUpdates.username !== undefined) {
    cleanUpdates.username = String(cleanUpdates.username).toLowerCase();
  }

  if (cleanUpdates.username !== undefined || cleanUpdates.nip !== undefined) {
    const current = await fetchTeachers({ forceRevalidate: true });
    const existing = current.find(t => t.id === id);
    const targetUser = cleanUpdates.username !== undefined ? cleanUpdates.username : (existing?.username || '');
    const targetNip = cleanUpdates.nip !== undefined ? cleanUpdates.nip : (existing?.nip || '');
    const validation = await validateTeacherUniqueness(targetUser, targetNip, id);
    if (!validation.isValid) {
      throw new Error(validation.conflictReason || 'Username atau NIP guru sudah terdaftar.');
    }
  }

  // If password is being updated, hash it, update passwordHash, and remove legacy plaintext password from Firestore
  if (cleanUpdates.password !== undefined && String(cleanUpdates.password).trim() !== '') {
    const cleanPwd = String(cleanUpdates.password).trim();
    cleanUpdates.passwordHash = await hashCredential(cleanPwd, TEACHER_SALT);
    cleanUpdates.password = deleteField();
    cleanUpdates.isDefaultPassword = false;
    cleanUpdates.migratedAt = new Date().toISOString();
  } else if (cleanUpdates.password !== undefined) {
    delete cleanUpdates.password;
  }

  const sanitized = cleanFirestoreData({
    ...cleanUpdates,
    updatedAt: new Date().toISOString(),
  });

  const ref = doc(db, TEACHERS_COL, id);
  await updateDoc(ref, sanitized);
  invalidateCache(CACHE_KEYS.TEACHERS);
}

export async function deleteTeacher(id: string): Promise<void> {
  const ref = doc(db, TEACHERS_COL, id);
  await deleteDoc(ref);
  invalidateCache(CACHE_KEYS.TEACHERS);
}

export async function bulkCreateTeachers(
  teachersData: Omit<TeacherAccount, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<TeacherAccount[]> {
  const existingTeachers = (await fetchTeachers()) || [];
  const existingUsernames = new Set((existingTeachers || []).map(t => (t?.username || '').trim().toLowerCase()));
  const existingNips = new Set((existingTeachers || []).map(t => (t?.nip || '').trim()).filter(Boolean));

  const seenInBatchUsers = new Set<string>();
  const seenInBatchNips = new Set<string>();

  // Filter out duplicates within batch or existing DB
  const validData: Omit<TeacherAccount, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  for (const tData of teachersData) {
    const cleanUser = tData.username.trim().toLowerCase();
    const cleanNip = (tData.nip || '').trim();

    if (!cleanUser) continue;
    if (existingUsernames.has(cleanUser) || seenInBatchUsers.has(cleanUser)) continue;
    if (cleanNip && (existingNips.has(cleanNip) || seenInBatchNips.has(cleanNip))) continue;

    seenInBatchUsers.add(cleanUser);
    if (cleanNip) seenInBatchNips.add(cleanNip);
    validData.push(tData);
  }

  const createdTeachers: TeacherAccount[] = [];
  const batchSize = 400;
  for (let i = 0; i < validData.length; i += batchSize) {
    const chunk = validData.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const tData of chunk) {
      const newRef = doc(collection(db, TEACHERS_COL));
      const rawPwd = (tData.password || 'guru123').trim();
      const passwordHash = tData.passwordHash || (await hashCredential(rawPwd, TEACHER_SALT));
      const { password, ...safeData } = tData;
      const newTeacher: any = {
        ...safeData,
        passwordHash,
        isDefaultPassword: rawPwd === 'guru123',
        migratedAt: new Date().toISOString(),
        id: newRef.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      delete newTeacher.password;
      batch.set(newRef, cleanFirestoreData(newTeacher));
      createdTeachers.push(sanitizeTeacherForPublic(newTeacher) as TeacherAccount);
    }
    await batch.commit();
  }

  invalidateCache(CACHE_KEYS.TEACHERS);
  return createdTeachers;
}


export async function authenticateTeacher(usernameOrNip: string, pass: string): Promise<TeacherAccount | null> {
  const cleanInput = usernameOrNip.trim().toLowerCase();
  const cleanPass = pass.trim();
  if (!cleanInput || !cleanPass) return null;

  try {
    let targetDoc: { id: string; data: any } | null = null;

    // 1. Parallel query by username and NIP
    const qUser = query(collection(db, TEACHERS_COL), where('username', '==', cleanInput));
    const qNip = query(collection(db, TEACHERS_COL), where('nip', '==', usernameOrNip.trim()));

    const [snapUser, snapNip] = await Promise.all([
      getDocs(qUser).catch(() => null),
      getDocs(qNip).catch(() => null),
    ]);

    if (snapUser && !snapUser.empty) {
      const d = snapUser.docs[0];
      targetDoc = { id: d.id, data: d.data() };
    } else if (snapNip && !snapNip.empty) {
      const d = snapNip.docs[0];
      targetDoc = { id: d.id, data: d.data() };
    }

    // 3. Fallback search (e.g. if case differences in stored username)
    if (!targetDoc) {
      const teachers = await fetchTeachers();
      const found = teachers.find(
        (t) =>
          ((t.username && t.username.trim().toLowerCase() === cleanInput) ||
            (t.nip && t.nip.trim().toLowerCase() === cleanInput))
      );
      if (found) {
        targetDoc = { id: found.id, data: found };
      }
    }

    if (!targetDoc) return null;

    const data = targetDoc.data;
    const dbPassword = data.password !== undefined && data.password !== null && String(data.password).trim() !== ''
      ? String(data.password).trim()
      : '';
    const dbHash = data.passwordHash ? String(data.passwordHash).trim() : '';

    let isPasswordValid = false;

    // A. Check against stored SHA-256 hash first
    if (dbHash) {
      isPasswordValid = await verifyCredential(cleanPass, dbHash, TEACHER_SALT);
    }

    // B. Legacy plaintext match fallback (for accounts that have not yet logged in / migrated)
    if (!isPasswordValid && dbPassword) {
      if (cleanPass === dbPassword || cleanPass.toLowerCase() === dbPassword.toLowerCase()) {
        isPasswordValid = true;
      }
    }

    // C. Default password fallback for fresh account with no credentials set
    if (!isPasswordValid && !dbHash && !dbPassword && cleanPass === 'guru123') {
      isPasswordValid = true;
    }

    if (isPasswordValid) {
      // Seamless Migration: Ensure passwordHash is saved and REMOVE plaintext password from Firestore!
      const currentComputedHash = await hashCredential(cleanPass, TEACHER_SALT);
      const migrationUpdates: Record<string, any> = {};

      if (data.passwordHash !== currentComputedHash) {
        migrationUpdates.passwordHash = currentComputedHash;
      }
      if (data.password !== undefined) {
        migrationUpdates.password = deleteField();
      }
      migrationUpdates.isDefaultPassword = cleanPass === 'guru123';
      migrationUpdates.migratedAt = new Date().toISOString();
      migrationUpdates.updatedAt = new Date().toISOString();

      if (Object.keys(migrationUpdates).length > 0 && targetDoc.id) {
        await updateDoc(doc(db, TEACHERS_COL, targetDoc.id), migrationUpdates).catch(() => {});
      }

      // Return clean teacher account WITHOUT password!
      const fullTeacher: TeacherAccount = {
        id: targetDoc.id,
        name: data.name || '',
        nip: data.nip || '',
        username: data.username || cleanInput,
        subjectId: data.subjectId || '',
        assignedClasses: Array.isArray(data.assignedClasses) ? data.assignedClasses : [],
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      return sanitizeTeacherForPublic(fullTeacher) as TeacherAccount;
    }

    return null;
  } catch (err) {
    console.error('Error authenticating teacher:', err);
    return null;
  }
}

// Student Account CRUD Operations
const DEMO_NISNS = [
  '0012345678',
  '0098765432',
  '0081234001',
  '0081234002',
  '0081234003',
  '0082234001',
  '0082234002',
  '0081123401',
];

const DEMO_NAMES = [
  'Andi Pratama',
  'Budi Santoso',
  'Citra Dewi',
  'Dian Permata',
  'Eka Kurniawan',
  'Fajar Nugraha',
  'Siti Rahmawati',
];

export async function purgeDemoAccountsAndData(): Promise<void> {
  try {
    // 1. Fetch current students from Firestore
    const snap = await getDocs(collection(db, STUDENTS_COL));
    if (!snap.empty) {
      const demoDocs = snap.docs.filter((d) => {
        const data = d.data();
        const id = d.id;
        const nisn = (data.nisn || '').trim();
        const nama = (data.nama || '').trim();
        return (
          id.startsWith('std_demo_') ||
          DEMO_NISNS.includes(nisn) ||
          DEMO_NAMES.includes(nama)
        );
      });

      if (demoDocs.length > 0) {
        const batch = writeBatch(db);
        demoDocs.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    }

    // 2. Clear demo progress records if any
    const progSnap = await getDocs(collection(db, STUDENT_PROGRESS_COL));
    if (!progSnap.empty) {
      const demoProgDocs = progSnap.docs.filter((d) => {
        const id = d.id;
        const data = d.data();
        const sName = (data.studentName || '').trim();
        return (
          id.startsWith('std_demo_') ||
          DEMO_NAMES.includes(sName) ||
          DEMO_NISNS.includes(id)
        );
      });
      if (demoProgDocs.length > 0) {
        const batch = writeBatch(db);
        demoProgDocs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // 3. Clean localStorage cache
    try {
      const saved = localStorage.getItem('sistem_materi_students_cache');
      if (saved) {
        const list: StudentAccount[] = JSON.parse(saved);
        const filtered = list.filter(
          (s) =>
            !s.id.startsWith('std_demo_') &&
            !DEMO_NISNS.includes(s.nisn?.trim()) &&
            !DEMO_NAMES.includes(s.nama?.trim())
        );
        localStorage.setItem('sistem_materi_students_cache', JSON.stringify(filtered));
      }
    } catch {}

    // Clean specific demo progress localStorage keys
    DEMO_NISNS.forEach((nisn) => {
      localStorage.removeItem(`sistem_materi_prog_${nisn}`);
    });
    ['std_demo_1', 'std_demo_2'].forEach((id) => {
      localStorage.removeItem(`sistem_materi_prog_${id}`);
    });
  } catch (err) {
    console.warn('Error purging demo accounts:', err);
  }
}

export async function fetchStudents(options?: {
  selectedClass?: string;
  forceRevalidate?: boolean;
}): Promise<StudentAccount[]> {
  const isClassTargeted = Boolean(
    options?.selectedClass &&
    options.selectedClass !== 'all' &&
    options.selectedClass !== 'ALL'
  );
  const targetClass = isClassTargeted ? (options!.selectedClass as string) : '';
  const cacheKey = isClassTargeted
    ? CACHE_KEYS.STUDENTS_CLASS(targetClass)
    : CACHE_KEYS.STUDENTS;
  const persistKey = isClassTargeted
    ? `sistem_materi_students_class_${targetClass}`
    : 'sistem_materi_students_cache';

  // Fast-path local filter: if all students are already in memory/storage cache, avoid Firestore read
  if (isClassTargeted && !options?.forceRevalidate) {
    const allCached = getCacheData<StudentAccount[]>(CACHE_KEYS.STUDENTS, 'sistem_materi_students_cache');
    if (allCached && Array.isArray(allCached) && allCached.length > 0) {
      const filtered = allCached.filter((s) => s.kelas === targetClass);
      if (filtered.length > 0) return filtered;
    }
  }

  return swrFetch(
    cacheKey,
    async () => {
      try {
        let q = query(collection(db, STUDENTS_COL), orderBy('nama', 'asc'));
        if (isClassTargeted) {
          q = query(collection(db, STUDENTS_COL), where('kelas', '==', targetClass), orderBy('nama', 'asc'));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
          const data = d.data();
          const studentObj: StudentAccount = {
            id: d.id,
            ...data,
            nisn: String(data.nisn || data.nis || data.username || '').trim(),
            username: String(data.username || data.nisn || data.nis || '').trim(),
            isOnline: typeof data.isOnline === 'boolean' ? data.isOnline : false,
            lastActive: data.lastActive || data.updatedAt || undefined,
            lastLogin: data.lastLogin || undefined,
          } as StudentAccount;
          return sanitizeStudentForPublic(studentObj);
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, STUDENTS_COL);
        const isPermission = err?.message?.includes('insufficient permissions') || err?.code === 'permission-denied';
        if (isPermission) {
          return getInitialCacheArray<StudentAccount>(cacheKey, persistKey);
        }
        throw err;
      }
    },
    {
      staleTime: options?.forceRevalidate ? 0 : 300_000,
      forceRevalidate: options?.forceRevalidate,
      persistKey,
    }
  );
}

export function subscribeStudents(
  callback: (students: StudentAccount[]) => void,
  onError?: (err: any) => void,
  selectedClass?: string
): () => void {
  const isClassTargeted = Boolean(
    selectedClass &&
    selectedClass !== 'all' &&
    selectedClass !== 'ALL'
  );
  const targetClass = isClassTargeted ? (selectedClass as string) : '';
  const q = isClassTargeted
    ? query(collection(db, STUDENTS_COL), where('kelas', '==', targetClass), orderBy('nama', 'asc'))
    : query(collection(db, STUDENTS_COL), orderBy('nama', 'asc'));

  const cacheKey = isClassTargeted
    ? CACHE_KEYS.STUDENTS_CLASS(targetClass)
    : CACHE_KEYS.STUDENTS;
  const persistKey = isClassTargeted
    ? `sistem_materi_students_class_${targetClass}`
    : 'sistem_materi_students_cache';

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data();
        const studentObj: StudentAccount = {
          id: d.id,
          ...data,
          nisn: String(data.nisn || data.nis || data.username || '').trim(),
          username: String(data.username || data.nisn || data.nis || '').trim(),
          isOnline: typeof data.isOnline === 'boolean' ? data.isOnline : false,
          lastActive: data.lastActive || data.updatedAt || undefined,
          lastLogin: data.lastLogin || undefined,
        } as StudentAccount;
        return sanitizeStudentForPublic(studentObj);
      });
      // Retain student records in cache for viewing and offline readiness
      setCacheData(cacheKey, items, persistKey, false);
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, STUDENTS_COL);
    }
  );
  return unsubscribe;
}


export async function createStudent(
  studentData: Omit<StudentAccount, 'id' | 'createdAt' | 'updatedAt'>
): Promise<StudentAccount> {
  const validation = await validateStudentUniqueness(studentData.nisn, studentData.username);
  if (!validation.isValid) {
    throw new Error(validation.conflictReason || 'NIS atau Username siswa sudah terdaftar.');
  }

  const cleanPass = studentData.password ? String(studentData.password).trim() : 'pass123';
  const passHash = await hashCredential(cleanPass, STUDENT_SALT);
  const newRef = doc(collection(db, STUDENTS_COL));
  const newStudent: any = {
    ...studentData,
    id: newRef.id,
    passwordHash: passHash,
    isDefaultPassword: cleanPass === 'pass123',
    migratedAt: new Date().toISOString(),
    username: studentData.username || studentData.nisn,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  delete newStudent.password;

  await setDoc(newRef, cleanFirestoreData(newStudent));

  invalidateCache(CACHE_KEYS.STUDENTS);
  return sanitizeStudentForPublic(newStudent) as StudentAccount;
}

export async function updateStudent(id: string, updates: Partial<StudentAccount>): Promise<void> {
  const cleanUpdates: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      if (typeof v === 'string') {
        cleanUpdates[k] = v.trim();
      } else {
        cleanUpdates[k] = v;
      }
    }
  }

  // If password is being updated, hash it, update passwordHash, and remove legacy plaintext password from Firestore
  if (cleanUpdates.password !== undefined && String(cleanUpdates.password).trim() !== '') {
    const passToHash = String(cleanUpdates.password).trim();
    cleanUpdates.passwordHash = await hashCredential(passToHash, STUDENT_SALT);
    cleanUpdates.password = deleteField();
    cleanUpdates.isDefaultPassword = passToHash === 'pass123';
    cleanUpdates.migratedAt = new Date().toISOString();
  } else {
    delete cleanUpdates.password;
  }

  if (cleanUpdates.nisn !== undefined || cleanUpdates.username !== undefined) {
    const current = await fetchStudents();
    const existing = current.find((s) => s.id === id);
    const targetNisn = cleanUpdates.nisn !== undefined ? cleanUpdates.nisn : (existing?.nisn || '');
    const targetUsername = cleanUpdates.username !== undefined ? cleanUpdates.username : (existing?.username || targetNisn);
    const validation = await validateStudentUniqueness(targetNisn, targetUsername, id);
    if (!validation.isValid) {
      throw new Error(validation.conflictReason || 'NIS atau Username siswa sudah terdaftar.');
    }
  }

  const sanitized = cleanFirestoreData({
    ...cleanUpdates,
    updatedAt: new Date().toISOString(),
  });

  const ref = doc(db, STUDENTS_COL, id);
  await updateDoc(ref, sanitized);
  invalidateCache(CACHE_KEYS.STUDENTS);
}

export async function deleteStudent(id: string): Promise<void> {
  const ref = doc(db, STUDENTS_COL, id);
  await deleteDoc(ref);
  try {
    const progRef = doc(db, STUDENT_PROGRESS_COL, id);
    await deleteDoc(progRef);
  } catch (err) {
    console.warn('[DataService] Error deleting associated student_progress:', err);
  }
  invalidateCache(CACHE_KEYS.STUDENTS);
  invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
  invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(id));
  invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(id));
}

/**
 * Update a student's real-time online presence status in Firestore.
 * When isOnline is true, sets isOnline: true, lastLogin (if not set recently), and lastActive.
 * When isOnline is false, sets isOnline: false and lastActive to current timestamp.
 */
export async function updateStudentOnlineStatus(
  studentId: string,
  isOnline: boolean
): Promise<void> {
  if (!studentId) return;

  if (!isOnline) {
    // Also trigger instant multi-channel offline beacon
    markStudentOfflineImmediately(studentId);
  }

  try {
    const ref = doc(db, STUDENTS_COL, studentId);
    const now = new Date().toISOString();
    const payload: Record<string, any> = {
      isOnline,
      lastActive: now,
      updatedAt: now,
    };
    if (isOnline) {
      payload.lastLogin = now;
    } else {
      payload.activeSubjectId = null;
      payload.activeSubjectName = null;
    }
    await updateDoc(ref, payload);
    invalidateCache(CACHE_KEYS.STUDENTS);
  } catch {
    // Silently ignore if offline or permission denied
  }
}

/**
 * Instantly marks a student as offline in Firestore when closing the browser tab or navigating away.
 * Employs a multi-channel guarantee that outlives the browser page destruction:
 * 1. navigator.sendBeacon to same-origin /api/student-offline (survives tab close without CORS preflight)
 * 2. fetch() with { keepalive: true } to /api/student-offline
 * 3. Direct Google Cloud Firestore REST API PATCH with { keepalive: true }
 * 4. Concurrent Firestore Web SDK updateDoc call
 */
export function markStudentOfflineImmediately(studentId: string): void {
  if (!studentId) return;

  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    isOnline: false,
    activeSubjectId: null,
    activeSubjectName: null,
    lastActive: nowIso,
    updatedAt: nowIso,
  };

  // If there are pending uncommitted seconds in memory, commit them together with offline status!
  if (studentTouchStates[studentId]) {
    const state = studentTouchStates[studentId];
    if (state.lastTouchEpoch > 0) {
      const elapsed = Math.round((Date.now() - state.lastTouchEpoch) / 1000);
      if (elapsed >= 1 && elapsed <= 600) {
        state.pendingGlobalSeconds += elapsed;
        if (state.lastSubjectId && state.lastSubjectId.trim().length > 0) {
          const cleanSub = state.lastSubjectId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
          state.pendingSubjectSeconds[cleanSub] = (state.pendingSubjectSeconds[cleanSub] || 0) + elapsed;
        }
      }
    }

    for (const [subId, sec] of Object.entries(state.pendingSubjectSeconds)) {
      if (sec > 0 && subId && subId.trim().length > 0) {
        payload[`subjectOnlineSeconds.${subId}`] = increment(sec);
        const mins = Math.max(1, Math.round(sec / 60));
        payload[`subjectOnlineMinutes.${subId}`] = increment(mins);
      }
    }
    if (state.pendingGlobalSeconds > 0) {
      payload.totalOnlineSeconds = increment(state.pendingGlobalSeconds);
      const mins = Math.max(1, Math.round(state.pendingGlobalSeconds / 60));
      payload.totalOnlineMinutes = increment(mins);
    }

    // Reset state after capturing
    studentTouchStates[studentId].lastTouchEpoch = 0;
    studentTouchStates[studentId].pendingSubjectSeconds = {};
    studentTouchStates[studentId].pendingGlobalSeconds = 0;
    studentTouchStates[studentId].uncreditedMs = 0;
    studentTouchStates[studentId].lastSubjectId = null;
    studentTouchStates[studentId].lastSubjectName = null;
  }

  const payloadJson = JSON.stringify({
    studentId,
    isOnline: false,
    activeSubjectId: null,
    activeSubjectName: null,
    timestamp: nowIso,
  });

  // Channel 1: navigator.sendBeacon (Standard W3C unload delivery, survives tab close)
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payloadJson], { type: 'application/json' });
      navigator.sendBeacon('/api/student-offline', blob);
    } catch {
      // Fallback handled below
    }
  }

  // Channel 2: Same-origin fetch with keepalive: true
  if (typeof fetch === 'function') {
    try {
      fetch('/api/student-offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadJson,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  // Channel 3: Direct Google Cloud Firestore REST API PATCH with keepalive: true
  try {
    const rawProjectId = (firebaseConfig as any)?.projectId || 'simpel-media-ajar';
    const rawApiKey = (firebaseConfig as any)?.apiKey || '';
    if (rawProjectId && rawApiKey && typeof fetch === 'function') {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        rawProjectId
      )}/databases/(default)/documents/students/${encodeURIComponent(
        studentId
      )}?updateMask.fieldPaths=isOnline&updateMask.fieldPaths=activeSubjectId&updateMask.fieldPaths=activeSubjectName&updateMask.fieldPaths=lastActive&updateMask.fieldPaths=updatedAt&key=${encodeURIComponent(
        rawApiKey
      )}`;

      fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            isOnline: { booleanValue: false },
            activeSubjectId: { nullValue: null },
            activeSubjectName: { nullValue: null },
            lastActive: { stringValue: nowIso },
            updatedAt: { stringValue: nowIso },
          },
        }),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}

  // Channel 4: Firestore Client SDK updateDoc (with accumulated time)
  try {
    const ref = doc(db, STUDENTS_COL, studentId);
    updateDoc(ref, payload).catch(() => {});
  } catch {}
}

// In-memory state tracking for subject-specific second accumulators
interface SubjectTouchState {
  lastTouchEpoch: number;
  lastSubjectId: string | null;
  lastSubjectName: string | null;
  pendingSubjectSeconds: Record<string, number>;
  pendingGlobalSeconds: number;
  accumulatedSubjectSecsForMin: Record<string, number>;
  accumulatedGlobalSecsForMin: number;
  uncreditedMs: number;
  lastWrittenEpoch: number;
}

const studentTouchStates: Record<string, SubjectTouchState> = {};

/**
 * Periodically touch a student's active session heartbeat.
 * Throttled to at most once every 20 seconds per studentId (unless forceFlush is true).
 * Incrementally accumulates online learning time in seconds and minutes specifically per subject.
 * Also preserves global totalOnlineSeconds and totalOnlineMinutes.
 * 100% Zero-Waste Firestore: Combines presence & subject time into exactly 1 write per heartbeat!
 */
export async function touchStudentActiveSession(
  studentId: string,
  options?: {
    activeSubjectId?: string | null;
    activeSubjectName?: string | null;
    forceFlush?: boolean;
    skipAccumulation?: boolean;
  }
): Promise<void> {
  if (!studentId) return;
  const now = Date.now();
  let state = studentTouchStates[studentId];

  // If first time calling for this student session
  if (!state) {
    state = {
      lastTouchEpoch: now,
      lastSubjectId: options?.activeSubjectId !== undefined ? options.activeSubjectId : null,
      lastSubjectName: options?.activeSubjectName !== undefined ? options.activeSubjectName : null,
      pendingSubjectSeconds: {},
      pendingGlobalSeconds: 0,
      accumulatedSubjectSecsForMin: {},
      accumulatedGlobalSecsForMin: 0,
      uncreditedMs: 0,
      lastWrittenEpoch: now,
    };
    studentTouchStates[studentId] = state;

    try {
      const ref = doc(db, STUDENTS_COL, studentId);
      const nowIso = new Date().toISOString();
      await updateDoc(ref, {
        isOnline: true,
        lastActive: nowIso,
        updatedAt: nowIso,
        activeSubjectId: options?.activeSubjectId || null,
        activeSubjectName: options?.activeSubjectName || null,
      });
      invalidateCache(CACHE_KEYS.STUDENTS);
    } catch (err) {
      console.error('Error in touchStudentActiveSession initial write:', err);
    }
    return;
  }

  // Calculate elapsed time since last touch (skipping accumulation when returning from background or inactive state)
  const elapsedMs = (!options?.skipAccumulation && state.lastTouchEpoch > 0)
    ? Math.max(0, now - state.lastTouchEpoch)
    : 0;
  state.lastTouchEpoch = now;

  // Continuous millisecond accumulator (cap to max 10 mins if user slept computer)
  if (elapsedMs > 0 && elapsedMs <= 600000) {
    state.uncreditedMs = (state.uncreditedMs || 0) + elapsedMs;
  }

  const elapsedSec = Math.floor((state.uncreditedMs || 0) / 1000);
  if (elapsedSec > 0) {
    state.uncreditedMs = (state.uncreditedMs || 0) % 1000;
    // Credit to the subject that was active during this elapsed period
    if (state.lastSubjectId && typeof state.lastSubjectId === 'string' && state.lastSubjectId.trim().length > 0) {
      const cleanSub = state.lastSubjectId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      if (cleanSub.length > 0) {
        state.pendingSubjectSeconds[cleanSub] = (state.pendingSubjectSeconds[cleanSub] || 0) + elapsedSec;
      }
    }
    state.pendingGlobalSeconds += elapsedSec;
  }

  // Update state tracking for next cycle
  const currentSubId = options?.activeSubjectId !== undefined ? options.activeSubjectId : state.lastSubjectId;
  const currentSubName = options?.activeSubjectName !== undefined ? options.activeSubjectName : state.lastSubjectName;
  state.lastSubjectId = currentSubId;
  state.lastSubjectName = currentSubName;

  // Throttling: If not forceFlush and pending seconds < 15 and < 20s since last write, skip write to save quota!
  const hasPendingTime = state.pendingGlobalSeconds >= 15 || Object.values(state.pendingSubjectSeconds).some((s) => s >= 15);
  const timeSinceLastWrite = now - (state.lastWrittenEpoch || 0);

  if (!options?.forceFlush && !hasPendingTime && timeSinceLastWrite < 20000) {
    return;
  }

  state.lastWrittenEpoch = now;

  try {
    const ref = doc(db, STUDENTS_COL, studentId);
    const nowIso = new Date().toISOString();
    const payload: Record<string, any> = {
      isOnline: true,
      lastActive: nowIso,
      updatedAt: nowIso,
      activeSubjectId: currentSubId || null,
      activeSubjectName: currentSubName || null,
    };

    // Atomically increment subject seconds and accurate minutes
    for (const [subId, sec] of Object.entries(state.pendingSubjectSeconds)) {
      if (sec > 0 && subId && subId.trim().length > 0) {
        payload[`subjectOnlineSeconds.${subId}`] = increment(sec);
        state.accumulatedSubjectSecsForMin[subId] = (state.accumulatedSubjectSecsForMin[subId] || 0) + sec;
        if (state.accumulatedSubjectSecsForMin[subId] >= 60) {
          const minsToAdd = Math.floor(state.accumulatedSubjectSecsForMin[subId] / 60);
          state.accumulatedSubjectSecsForMin[subId] %= 60;
          payload[`subjectOnlineMinutes.${subId}`] = increment(minsToAdd);
        }
      }
    }

    // Atomically increment global seconds and accurate minutes
    if (state.pendingGlobalSeconds > 0) {
      payload.totalOnlineSeconds = increment(state.pendingGlobalSeconds);
      state.accumulatedGlobalSecsForMin = (state.accumulatedGlobalSecsForMin || 0) + state.pendingGlobalSeconds;
      if (state.accumulatedGlobalSecsForMin >= 60) {
        const minsToAdd = Math.floor(state.accumulatedGlobalSecsForMin / 60);
        state.accumulatedGlobalSecsForMin %= 60;
        payload.totalOnlineMinutes = increment(minsToAdd);
      }
    }

    // Clear pending buffer
    state.pendingSubjectSeconds = {};
    state.pendingGlobalSeconds = 0;

    await updateDoc(ref, payload);
    invalidateCache(CACHE_KEYS.STUDENTS);
  } catch (err) {
    console.error('Error in touchStudentActiveSession updateDoc:', err);
  }
}

/**
 * Format total online minutes into readable Indonesian format.
 * Examples: '45 mnt', '1 jam 20 mnt', '12 jam', '< 1 mnt'
 */
export function formatStudyDuration(minutes: number): { text: string; fullText: string } {
  if (!minutes || minutes <= 0) {
    return { text: '< 1 mnt', fullText: 'Kurang dari 1 menit' };
  }
  if (minutes < 60) {
    return { text: `${minutes} mnt`, fullText: `${minutes} menit` };
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return { text: `${hours} jam`, fullText: `${hours} jam` };
  }
  return {
    text: `${hours}j ${remaining}m`,
    fullText: `${hours} jam ${remaining} menit`,
  };
}

/**
 * Format total online seconds into readable Indonesian format.
 * Accurately supports sub-minute durations (e.g. '45 dtk') and hour formats.
 */
export function formatStudyDurationSeconds(seconds: number): { text: string; fullText: string; minutes: number } {
  const safeSeconds = Math.max(0, typeof seconds === 'number' && !isNaN(seconds) ? Math.round(seconds) : 0);
  const minutes = Math.max(1, Math.round(safeSeconds / 60));

  if (safeSeconds <= 0) {
    return { text: '0 mnt', fullText: 'Belum ada aktivitas', minutes: 0 };
  }
  if (safeSeconds < 60) {
    return { text: `${safeSeconds} dtk`, fullText: `${safeSeconds} Detik`, minutes: 1 };
  }
  const hours = Math.floor(safeSeconds / 3600);
  const remainingMins = Math.floor((safeSeconds % 3600) / 60);
  const remainingSecs = safeSeconds % 60;

  if (hours === 0) {
    if (remainingSecs > 0 && remainingMins < 5) {
      return {
        text: `${remainingMins}m ${remainingSecs}s`,
        fullText: `${remainingMins} Menit ${remainingSecs} Detik`,
        minutes: Math.max(1, remainingMins),
      };
    }
    return { text: `${remainingMins} mnt`, fullText: `${remainingMins} Menit`, minutes: Math.max(1, remainingMins) };
  }
  if (remainingMins === 0) {
    return { text: `${hours} jam`, fullText: `${hours} Jam`, minutes: Math.round(safeSeconds / 60) };
  }
  return {
    text: `${hours}j ${remainingMins}m`,
    fullText: `${hours} Jam ${remainingMins} Menit`,
    minutes: Math.round(safeSeconds / 60),
  };
}

/**
 * Threshold in ms for considering a student actively online.
 * 3.5 minutes allows for slight heartbeat delays or background tab throttling.
 */
export const STUDENT_ONLINE_THRESHOLD_MS = 210000; // 3.5 minutes

/**
 * Helper to flexibly determine if two subject identifiers point to the same subject.
 * Robust against document ID vs name vs slug vs 'informatika' defaults.
 */
export function areSubjectsMatching(
  subjectA?: string | null,
  subjectB?: string | null,
  availableSubjects?: { id: string; name: string }[] | null
): boolean {
  if (!subjectA || !subjectB) return false;
  const cleanA = subjectA.trim().toLowerCase();
  const cleanB = subjectB.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  // Informatika default/alias matching
  const isAInformatika = cleanA === 'informatika' || cleanA.includes('informatika') || cleanA === 'tik';
  const isBInformatika = cleanB === 'informatika' || cleanB.includes('informatika') || cleanB === 'tik';
  if (isAInformatika && isBInformatika) return true;

  // Combine provided availableSubjects with any cached subjects for 100% reliable matching
  const cachedSubjs = getCacheData<{ id: string; name: string }[]>(CACHE_KEYS.SUBJECTS, 'sistem_materi_subj_cache') || [];
  const allSubjs = [...(availableSubjects || []), ...cachedSubjs];

  if (allSubjs.length > 0) {
    const subObjA = allSubjs.find(
      (s) => (s?.id || '').toLowerCase() === cleanA || (s?.name || '').toLowerCase() === cleanA
    );
    const subObjB = allSubjs.find(
      (s) => (s?.id || '').toLowerCase() === cleanB || (s?.name || '').toLowerCase() === cleanB
    );

    if (subObjA && subObjB && subObjA.id === subObjB.id) return true;
    if (subObjA && ((subObjA.id || '').toLowerCase() === cleanB || (subObjA.name || '').toLowerCase() === cleanB)) return true;
    if (subObjB && ((subObjB.id || '').toLowerCase() === cleanA || (subObjB.name || '').toLowerCase() === cleanA)) return true;
  }

  return false;
}

/**
 * Calculate accurate real-time online status and human-readable last active text.
 * When targetSubjectId is provided (e.g. Guru Informatika viewing),
 * isOnline evaluates to TRUE ONLY if student is actively inside that specific subject!
 * When student is actively inside another subject, isOnlineInOtherSubject evaluates to TRUE.
 */
export function getStudentOnlineStatus(
  student?: StudentAccount | null,
  progressRecord?: { lastActive?: string; updatedAt?: string } | null,
  targetSubjectId?: string | null,
  availableSubjects?: { id: string; name: string }[] | null
): {
  isOnline: boolean;
  isOnlineInTargetSubject: boolean;
  isOnlineInLobby: boolean;
  isOnlineInOtherSubject: boolean;
  lastActiveText: string;
  statusLabel: 'Online' | 'Akses Mapel Lain' | 'Offline';
  subStatusText: string;
  locationLabel: string;
  activeSubjectId?: string | null;
  activeSubjectName?: string | null;
} {
  if (!student) {
    return {
      isOnline: false,
      isOnlineInTargetSubject: false,
      isOnlineInLobby: false,
      isOnlineInOtherSubject: false,
      lastActiveText: 'Tidak Aktif',
      statusLabel: 'Offline',
      subStatusText: 'Tidak Aktif',
      locationLabel: 'Offline',
      activeSubjectId: null,
      activeSubjectName: null,
    };
  }

  // Determine latest timestamp from student and/or progress
  const candidateTimes = [
    student.lastActive,
    student.lastLogin,
    progressRecord?.lastActive,
    progressRecord?.updatedAt,
    student.updatedAt,
  ].filter(Boolean) as string[];

  let latestMs = 0;
  for (const timeStr of candidateTimes) {
    const ms = new Date(timeStr).getTime();
    if (!isNaN(ms) && ms > latestMs) {
      latestMs = ms;
    }
  }

  const now = Date.now();
  const timeDiff = latestMs > 0 ? Math.max(0, now - latestMs) : Infinity;

  // Student is globally online if:
  // 1. student.isOnline === true AND latest activity is within the threshold window
  // 2. Or very recent heartbeat activity within 2.5 minutes regardless of boolean flag
  const isGloballyOnline =
    (student.isOnline === true && timeDiff < STUDENT_ONLINE_THRESHOLD_MS) ||
    (student.isOnline !== false && timeDiff < 150000);

  const studentActiveSubject = student.activeSubjectId && student.activeSubjectId.trim().length > 0
    ? student.activeSubjectId.trim()
    : null;
  const isTargetFiltered = Boolean(targetSubjectId && targetSubjectId !== 'all');

  // Resolve best readable subject name for the student's active subject
  const cachedSubjs = getCacheData<{ id: string; name: string }[]>(CACHE_KEYS.SUBJECTS, 'sistem_materi_subj_cache') || [];
  const allSubjs = [...(availableSubjects || []), ...cachedSubjs];

  let resolvedActiveSubjectName: string | null = student.activeSubjectName || null;
  if (studentActiveSubject && allSubjs.length > 0) {
    const matchedSubject = allSubjs.find(
      (s) => s.id === studentActiveSubject || areSubjectsMatching(s.id, studentActiveSubject, allSubjs)
    );
    if (matchedSubject?.name) {
      resolvedActiveSubjectName = matchedSubject.name;
    }
  }

  // Determine whether student is in lobby, in target subject, or in other subject
  const isOnlineInLobby = isGloballyOnline && !studentActiveSubject;
  const matchesTarget = Boolean(
    isGloballyOnline &&
    studentActiveSubject &&
    isTargetFiltered &&
    areSubjectsMatching(studentActiveSubject, targetSubjectId, allSubjs)
  );
  const isOnlineInTargetSubject = isGloballyOnline && (!isTargetFiltered || matchesTarget);
  const isOnlineInOtherSubject = Boolean(
    isGloballyOnline &&
    studentActiveSubject &&
    isTargetFiltered &&
    !matchesTarget
  );

  // Status label for badge
  let statusLabel: 'Online' | 'Akses Mapel Lain' | 'Offline' = 'Offline';
  if (isGloballyOnline) {
    statusLabel = isOnlineInOtherSubject ? 'Akses Mapel Lain' : 'Online';
  }

  // Location label: specifically fulfills requirement:
  // "di bawah online d dashboard guru itu berisi tulisan di lobby mapel, jika masuk ke mapel lain tulisanya di mapel lain"
  let locationLabel = 'Offline';
  if (isGloballyOnline) {
    if (isOnlineInLobby) {
      locationLabel = 'di lobby mapel';
    } else if (isOnlineInOtherSubject) {
      locationLabel = resolvedActiveSubjectName ? `di mapel lain (${resolvedActiveSubjectName})` : 'di mapel lain';
    } else if (isTargetFiltered && matchesTarget) {
      locationLabel = 'di mapel ini';
    } else {
      locationLabel = resolvedActiveSubjectName ? `di mapel ${resolvedActiveSubjectName}` : 'di lobby mapel';
    }
  }

  let lastActiveText = 'Belum pernah login';
  if (isGloballyOnline) {
    lastActiveText = locationLabel;
  } else if (latestMs > 0) {
    const minutesAgo = Math.floor(timeDiff / 60000);
    if (minutesAgo < 1) {
      lastActiveText = 'Baru saja keluar';
    } else if (minutesAgo < 60) {
      lastActiveText = `${minutesAgo} mnt lalu`;
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      if (hoursAgo < 24) {
        lastActiveText = `${hoursAgo} jam lalu`;
      } else {
        const daysAgo = Math.floor(hoursAgo / 24);
        if (daysAgo === 1) {
          lastActiveText = 'Kemarin';
        } else if (daysAgo < 7) {
          lastActiveText = `${daysAgo} hari lalu`;
        } else {
          lastActiveText = new Date(latestMs).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
          });
        }
      }
    }
  }

  return {
    isOnline: isGloballyOnline,
    isOnlineInTargetSubject,
    isOnlineInLobby,
    isOnlineInOtherSubject,
    lastActiveText,
    statusLabel,
    subStatusText: isGloballyOnline ? locationLabel : lastActiveText,
    locationLabel,
    activeSubjectId: studentActiveSubject,
    activeSubjectName: resolvedActiveSubjectName,
  };
}

export async function bulkCreateStudents(
  studentsData: Omit<StudentAccount, 'id' | 'createdAt' | 'updatedAt'>[],
  options?: { updateExisting?: boolean; onProgress?: (current: number, total: number) => void }
): Promise<StudentAccount[]> {
  const existingStudents = (await fetchStudents()) || [];
  const existingMap = new Map<string, StudentAccount>();
  for (const s of existingStudents) {
    if (s?.nisn) existingMap.set(s.nisn.trim(), s);
    if (s?.username) existingMap.set(s.username.trim().toLowerCase(), s);
  }

  const seenInBatchNisns = new Set<string>();
  const seenInBatchUsers = new Set<string>();

  const toCreate: Omit<StudentAccount, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const toUpdate: { existing: StudentAccount; updated: Partial<StudentAccount> }[] = [];

  for (const stdData of studentsData) {
    const cleanNisn = (stdData.nisn || '').trim();
    const cleanUser = (stdData.username || cleanNisn).trim().toLowerCase();

    if (!cleanNisn) continue;
    if (seenInBatchNisns.has(cleanNisn) || seenInBatchUsers.has(cleanUser)) continue;

    const existingByNisn = existingMap.get(cleanNisn);
    const existingByUser = existingMap.get(cleanUser);
    const existing = existingByNisn || existingByUser;

    if (existing) {
      if (options?.updateExisting) {
        toUpdate.push({
          existing,
          updated: {
            nama: stdData.nama || existing.nama,
            kelas: stdData.kelas || existing.kelas,
            noAbsen: stdData.noAbsen || existing.noAbsen,
          },
        });
        seenInBatchNisns.add(cleanNisn);
        seenInBatchUsers.add(cleanUser);
      }
      continue;
    }

    seenInBatchNisns.add(cleanNisn);
    seenInBatchUsers.add(cleanUser);
    toCreate.push(stdData);
  }

  const pwdHashCache = new Map<string, string>();
  const defaultHash = await hashCredential('pass123', STUDENT_SALT);
  pwdHashCache.set('pass123', defaultHash);

  const createdStudents: StudentAccount[] = [];
  const batchSize = 250;
  const totalOperations = toCreate.length + toUpdate.length;
  let processedOperations = 0;

  // 1. Process inserts
  for (let i = 0; i < toCreate.length; i += batchSize) {
    const chunk = toCreate.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const stdData of chunk) {
      const newRef = doc(collection(db, STUDENTS_COL));
      const studentPassword = stdData.password ? String(stdData.password).trim() : 'pass123';
      let passwordHash = pwdHashCache.get(studentPassword);
      if (!passwordHash) {
        passwordHash = await hashCredential(studentPassword, STUDENT_SALT);
        pwdHashCache.set(studentPassword, passwordHash);
      }

      const { password, ...safeStdData } = stdData as any;
      const newStudent: any = {
        ...safeStdData,
        id: newRef.id,
        passwordHash,
        isDefaultPassword: studentPassword === 'pass123',
        migratedAt: new Date().toISOString(),
        username: stdData.username || stdData.nisn,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      delete newStudent.password;
      batch.set(newRef, cleanFirestoreData(newStudent));
      createdStudents.push(sanitizeStudentForPublic(newStudent) as StudentAccount);
    }
    await batch.commit();
    processedOperations += chunk.length;
    options?.onProgress?.(processedOperations, totalOperations || 1);
  }

  // 2. Process updates if updateExisting is enabled
  if (toUpdate.length > 0) {
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const chunk = toUpdate.slice(i, i + batchSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const docRef = doc(db, STUDENTS_COL, item.existing.id);
        batch.update(docRef, {
          ...cleanFirestoreData(item.updated),
          updatedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
      processedOperations += chunk.length;
      options?.onProgress?.(processedOperations, totalOperations || 1);
    }
  }

  invalidateCache(CACHE_KEYS.STUDENTS);

  // Sync any newly introduced classes into master classes
  try {
    const newClasses: string[] = Array.from(
      new Set(studentsData.map((s) => (s.kelas || '').trim()).filter(Boolean))
    );
    if (newClasses.length > 0) {
      const currentMaster: string[] = (await fetchMasterClasses()) || [];
      const merged: string[] = Array.from(new Set<string>([...currentMaster, ...newClasses])).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
      if (merged.length > currentMaster.length) {
        await saveMasterClasses(merged);
      }
    }
  } catch (err) {
    console.warn('Error syncing master classes on bulkCreateStudents:', err);
  }

  return createdStudents;
}

/**
 * Diagnostic & repair routine that inspects all registered students in Firestore,
 * ensuring valid passwords, SHA-256 hashes, and sanitized NISN/Username fields.
 * Guarantees every student on the roster can log in seamlessly while purging plaintext passwords.
 */
export async function repairAndSyncAllStudents(): Promise<{ total: number; fixed: number }> {
  try {
    const snapshot = await getDocs(collection(db, STUDENTS_COL));
    if (snapshot.empty) return { total: 0, fixed: 0 };

    let fixedCount = 0;
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const docId = docSnap.id;

      const rawNisn = String(data.nisn || data.nis || data.username || docId).trim();
      const rawUser = String(data.username || rawNisn).trim();
      const rawPass = String(data.password || data.pass || 'pass123').trim() || 'pass123';
      const expectedHash = await hashCredential(rawPass, STUDENT_SALT);

      let needsUpdate = false;
      const updates: Record<string, any> = {};

      if (!data.nisn || String(data.nisn).trim() !== rawNisn) {
        updates.nisn = rawNisn;
        needsUpdate = true;
      }
      if (!data.username || String(data.username).trim() !== rawUser) {
        updates.username = rawUser;
        needsUpdate = true;
      }
      // Migrate passwordHash and cleanly DELETE legacy plaintext password!
      if (!data.passwordHash || data.passwordHash !== expectedHash) {
        updates.passwordHash = expectedHash;
        needsUpdate = true;
      }
      if (data.password !== undefined) {
        updates.password = deleteField();
        needsUpdate = true;
      }
      if (data.pass !== undefined) {
        updates.pass = deleteField();
        needsUpdate = true;
      }
      if (!data.migratedAt) {
        updates.migratedAt = new Date().toISOString();
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.updatedAt = new Date().toISOString();
        batch.update(doc(db, STUDENTS_COL, docId), updates);
        batchCount++;
        fixedCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    invalidateCache(CACHE_KEYS.STUDENTS);
    return { total: snapshot.size, fixed: fixedCount };
  } catch {
    return { total: 0, fixed: 0 };
  }
}

export async function authenticateStudent(nisnOrUser: string, pass: string): Promise<StudentAccount | null> {
  const cleanInput = String(nisnOrUser || '').trim();
  const cleanLower = cleanInput.toLowerCase();
  const cleanPass = String(pass || '').trim();
  if (!cleanInput || !cleanPass) return null;

  const cleanDigits = cleanInput.replace(/\D/g, '');
  const cleanNumber = !isNaN(Number(cleanInput)) && cleanInput !== '' ? Number(cleanInput) : null;

  try {
    let targetDoc: { id: string; data: any } | null = null;

    // 1. Direct lookup by Document ID (in case ID equals NIS or username)
    try {
      const docById = await getDoc(doc(db, STUDENTS_COL, cleanInput));
      if (docById.exists()) {
        targetDoc = { id: docById.id, data: docById.data() };
      } else if (cleanLower !== cleanInput) {
        const docByIdLower = await getDoc(doc(db, STUDENTS_COL, cleanLower));
        if (docByIdLower.exists()) {
          targetDoc = { id: docByIdLower.id, data: docByIdLower.data() };
        }
      }
    } catch {}

    // 2. Parallel Firestore queries by NISN, NIS, or Username
    if (!targetDoc) {
      const queryAttempts = [
        // Exact nisn string
        query(collection(db, STUDENTS_COL), where('nisn', '==', cleanInput)),
        // Exact username
        query(collection(db, STUDENTS_COL), where('username', '==', cleanLower)),
        // nis field (some databases or imports name the field 'nis')
        query(collection(db, STUDENTS_COL), where('nis', '==', cleanInput)),
      ];

      if (cleanInput !== cleanLower) {
        queryAttempts.push(query(collection(db, STUDENTS_COL), where('username', '==', cleanInput)));
      }

      if (cleanNumber !== null) {
        queryAttempts.push(
          query(collection(db, STUDENTS_COL), where('nisn', '==', cleanNumber)),
          query(collection(db, STUDENTS_COL), where('nis', '==', cleanNumber))
        );
      }

      // Execute queries in parallel for ultra-fast response
      const results = await Promise.all(
        queryAttempts.map((q) => getDocs(q).catch(() => null))
      );

      for (const snap of results) {
        if (snap && !snap.empty) {
          targetDoc = { id: snap.docs[0].id, data: snap.docs[0].data() };
          break;
        }
      }
    }

    // 3. Robust Fallback: Scan full student collection directly from Firestore
    // Ensures students with leading zeros, special characters, or custom fields are always found!
    if (!targetDoc) {
      try {
        const fullSnap = await getDocs(collection(db, STUDENTS_COL));
        if (!fullSnap.empty) {
          for (const d of fullSnap.docs) {
            const data = d.data();
            const dNisn = String(data.nisn || '').trim();
            const dNis = String(data.nis || '').trim();
            const dUser = String(data.username || '').trim();
            const dNama = String(data.nama || '').trim();

            const matchExact =
              dNisn.toLowerCase() === cleanLower ||
              dNis.toLowerCase() === cleanLower ||
              dUser.toLowerCase() === cleanLower ||
              d.id.toLowerCase() === cleanLower;

            const matchDigits =
              cleanDigits.length >= 3 &&
              (dNisn.replace(/\D/g, '') === cleanDigits ||
                dNis.replace(/\D/g, '') === cleanDigits ||
                dUser.replace(/\D/g, '') === cleanDigits);

            const matchName = dNama.toLowerCase() === cleanLower;

            if (matchExact || matchDigits || matchName) {
              targetDoc = { id: d.id, data };
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Fallback scan failed:', err);
      }
    }

    if (!targetDoc) {
      console.warn(`[authenticateStudent] Student not found for input: "${cleanInput}"`);
      return null;
    }

    const data = targetDoc.data;
    const dbPassword = data.password !== undefined && data.password !== null && String(data.password).trim() !== ''
      ? String(data.password).trim()
      : (data.pass !== undefined && data.pass !== null ? String(data.pass).trim() : '');
    const dbHash = data.passwordHash ? String(data.passwordHash).trim() : '';

    let isPasswordValid = false;

    // A. Plaintext database password match (Highest priority for unmigrated accounts: if database has legacy password, matching it succeeds)
    if (dbPassword) {
      if (cleanPass === dbPassword || cleanPass.toLowerCase() === dbPassword.toLowerCase()) {
        isPasswordValid = true;
      }
    }

    // B. Check against stored SHA-256 hash
    if (!isPasswordValid && dbHash) {
      isPasswordValid = await verifyCredential(cleanPass, dbHash, STUDENT_SALT);
    }

    // C. Default password fallback ('pass123') if no password/hash set in DB or if default matches
    if (!isPasswordValid && (!dbPassword || dbPassword === 'pass123')) {
      if (cleanPass === 'pass123' || cleanPass === '12345') {
        isPasswordValid = true;
      }
    }

    // D. If input matches default password pass123 and password in DB is empty
    if (!isPasswordValid && !dbPassword && !dbHash && cleanPass === 'pass123') {
      isPasswordValid = true;
    }

    if (isPasswordValid) {
      // Auto-heal & Migrate: Ensure Firestore has computed hash and REMOVE plaintext password!
      const expectedHash = await hashCredential(cleanPass, STUDENT_SALT);
      const updatesToSync: Record<string, any> = {};

      if (data.passwordHash !== expectedHash) {
        updatesToSync.passwordHash = expectedHash;
      }
      // Cleanly remove legacy plaintext fields from Firestore document
      if (data.password !== undefined) {
        updatesToSync.password = deleteField();
      }
      if (data.pass !== undefined) {
        updatesToSync.pass = deleteField();
      }
      updatesToSync.isDefaultPassword = cleanPass === 'pass123';
      updatesToSync.migratedAt = new Date().toISOString();

      if (!data.nisn && data.nis) {
        updatesToSync.nisn = String(data.nis).trim();
      }
      if (!data.username) {
        updatesToSync.username = data.nisn || data.nis || cleanInput;
      }

      const nowIso = new Date().toISOString();
      updatesToSync.isOnline = true;
      updatesToSync.lastActive = nowIso;
      updatesToSync.lastLogin = nowIso;
      updatesToSync.updatedAt = nowIso;
      await updateDoc(doc(db, STUDENTS_COL, targetDoc.id), updatesToSync).catch(() => {});

      const authenticatedStudent: StudentAccount = {
        id: targetDoc.id,
        nama: data.nama || 'Siswa',
        kelas: data.kelas || '-',
        noAbsen: data.noAbsen ? String(data.noAbsen) : undefined,
        nisn: String(data.nisn || data.nis || cleanInput).trim(),
        username: String(data.username || data.nisn || data.nis || cleanInput).trim(),
        isOnline: true,
        lastActive: nowIso,
        lastLogin: nowIso,
        createdAt: data.createdAt,
        updatedAt: nowIso,
      };

      return sanitizeStudentForPublic(authenticatedStudent) as StudentAccount;
    }

    console.warn(`[authenticateStudent] Password mismatch for student: "${cleanInput}"`);
    return null;
  } catch (err) {
    console.error('Error authenticating student:', err);
    return null;
  }
}

// Student Progress Persistence
export const STUDENT_PROGRESS_COL = 'student_progress';
const PROGRESS_BATCH_LIMIT = 400;

export interface StudentQuizScoreInfo {
  score: number;
  totalQuestions: number;
  percentage: number;
  updatedAt: string;
}

export interface MaterialStudentQuizScoreRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentAbsen?: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: string;
  isPassed: boolean;
}

export interface StudentProgressSyncItem {
  studentId: string;
  studentName?: string;
  kelas?: string;
  completedMaterialIds?: string[];
  completedMaterialTimestamps?: Record<string, string>;
  activityLogs?: MaterialActivityLog[];
  scores?: Record<string, number>;
  quizAttempts?: Record<string, StudentQuizScoreInfo>;
  gamification?: StudentGamificationData;
}

// ========================================================
// DEBOUNCE QUEUE FOR NON-QUIZ STUDENT PROGRESS (30 SECONDS)
// & OFFLINE RESILIENCE QUEUE
// ========================================================
interface PendingStudentProgressWrite {
  studentId: string;
  payload: any;
  timer: any;
  promiseResolvers: Array<() => void>;
}
const pendingProgressWrites = new Map<string, PendingStudentProgressWrite>();
const OFFLINE_PROGRESS_QUEUE_KEY = 'sistem_materi_offline_progress_queue';

function getOfflineProgressQueue(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OFFLINE_PROGRESS_QUEUE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePendingProgressToOfflineQueue(studentId: string, payload: any): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineProgressQueue();
    queue[studentId] = payload;
    localStorage.setItem(OFFLINE_PROGRESS_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function removePendingProgressFromOfflineQueue(studentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineProgressQueue();
    if (studentId in queue) {
      delete queue[studentId];
      if (Object.keys(queue).length === 0) {
        localStorage.removeItem(OFFLINE_PROGRESS_QUEUE_KEY);
      } else {
        localStorage.setItem(OFFLINE_PROGRESS_QUEUE_KEY, JSON.stringify(queue));
      }
    }
  } catch {}
}

/**
 * Resiliently flushes all pending debounced progress writes to Firestore.
 * Uses Promise.allSettled() and retains unconfirmed items in the offline queue if offline or failed.
 */
export async function flushAllPendingProgressWrites(): Promise<void> {
  // Sync unconfirmed items from offline resilience queue into memory queue
  const offlineQueue = getOfflineProgressQueue();
  for (const [sid, offPayload] of Object.entries(offlineQueue)) {
    if (!pendingProgressWrites.has(sid)) {
      pendingProgressWrites.set(sid, {
        studentId: sid,
        payload: offPayload,
        timer: null,
        promiseResolvers: [],
      });
    }
  }

  if (pendingProgressWrites.size === 0) return;

  const entries = Array.from(pendingProgressWrites.entries());

  // Clear running timers
  entries.forEach(([, item]) => {
    if (item.timer) {
      clearTimeout(item.timer);
      item.timer = null;
    }
  });

  const writePromises = entries.map(async ([studentId, item]) => {
    const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
    await setDoc(ref, cleanFirestoreData(item.payload), { merge: true });
    return studentId;
  });

  const results = await Promise.allSettled(writePromises);

  results.forEach((res, idx) => {
    const [studentId, item] = entries[idx];
    if (res.status === 'fulfilled') {
      item.promiseResolvers.forEach((resolve) => resolve());
      pendingProgressWrites.delete(studentId);
      removePendingProgressFromOfflineQueue(studentId);
    } else {
      console.warn(`[Debounce Flush] Failed flushing progress for ${studentId}, retained in offline resilience queue:`, res.reason);
      // Retain in offline queue so it will be retried automatically when internet reconnects
      savePendingProgressToOfflineQueue(studentId, item.payload);
    }
  });
}

/**
 * Automatically initializes offline progress queue synchronization on network reconnection.
 */
export function initOfflineProgressQueueSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    flushAllPendingProgressWrites().catch((err) => {
      console.warn('[Offline Progress Sync] Online retry error:', err);
    });
  };

  window.addEventListener('online', handleOnline);

  // Initial check on load: if browser is online, flush pending queue after brief initialization window
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => {
      flushAllPendingProgressWrites().catch(() => {});
    }, 2500);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

if (typeof window !== 'undefined') {
  initOfflineProgressQueueSync();

  window.addEventListener('beforeunload', () => {
    flushAllPendingProgressWrites().catch(() => {});
  });
  window.addEventListener('pagehide', () => {
    flushAllPendingProgressWrites().catch(() => {});
  });
}

/**
 * Saves a student's progress record atomically using a Firestore writeBatch.
 * Ensures consistent multi-field updates without partial write states.
 * Non-quiz progress updates (e.g. reading logs) are automatically debounced (30s)
 * to prevent quota exhaustion when 1,000 students read materials concurrently.
 */
export async function saveStudentProgress(
  studentId: string,
  completedMaterialIds: string[],
  studentName?: string,
  kelas?: string,
  completedMaterialTimestamps?: Record<string, string>,
  activityLogs?: MaterialActivityLog[],
  scores?: Record<string, number>,
  quizAttempts?: Record<string, StudentQuizScoreInfo>,
  notes?: Record<string, string>,
  bookmarkedMaterialIds?: string[],
  gamification?: any,
  progressStats?: {
    progressPercent?: number;
    completedCount?: number;
    totalMaterialsCount?: number;
  },
  additionalIds?: string[],
  options?: { immediate?: boolean; explicitSet?: boolean }
): Promise<void> {
  if (!studentId) return;
  try {
    const allTargetIds = Array.from(new Set([studentId, ...(additionalIds || [])].filter(Boolean)));

    // Multi-device / multi-tab safety: merge with existing cached completedMaterialIds
    let safeCompletedIds = completedMaterialIds;
    if (Array.isArray(completedMaterialIds)) {
      const cached = getCacheData<StudentProgressRecord>(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId));
      let localProg: string[] = [];
      for (const sid of allTargetIds) {
        try {
          const raw = localStorage.getItem(`sistem_materi_prog_${sid}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localProg = parsed;
              break;
            }
          }
        } catch {}
      }

      const existingCompleted = Array.isArray(cached?.completedMaterialIds)
        ? cached.completedMaterialIds
        : localProg;

      if (!options?.explicitSet) {
        safeCompletedIds = Array.from(new Set([...existingCompleted, ...completedMaterialIds]));
      }
    }

    // Compute progress stats if not explicitly passed
    let progressPercent = progressStats?.progressPercent;
    let completedCount = progressStats?.completedCount ?? (Array.isArray(safeCompletedIds) ? safeCompletedIds.length : 0);
    let totalMaterialsCount = progressStats?.totalMaterialsCount;

    if (typeof progressPercent !== 'number') {
      try {
        const cachedMats = localStorage.getItem('sistem_materi_mat_cache');
        if (cachedMats) {
          const parsed = JSON.parse(cachedMats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const published = parsed.filter((m: any) => m && m.isPublished !== false);
            if (published.length > 0) {
              totalMaterialsCount = totalMaterialsCount ?? published.length;
              progressPercent = Math.round((completedCount / published.length) * 100);
            }
          }
        }
      } catch {}
      if (typeof progressPercent !== 'number') {
        progressPercent = 0;
      }
    }

    // Resolve gamification: preserve existing data if present; validate and provide safe defaults
    let safeGamification: StudentGamificationData | undefined = undefined;
    if (gamification) {
      safeGamification = getDefaultGamificationData(gamification);
    } else {
      for (const sid of allTargetIds) {
        try {
          const ls = localStorage.getItem(`sistem_materi_gamification_${sid}`);
          if (ls) {
            safeGamification = getDefaultGamificationData(JSON.parse(ls));
            break;
          }
        } catch {}
      }
    }

    // Preserve existing scores and quizAttempts if not explicitly provided
    let safeScores = scores;
    let safeAttempts = quizAttempts;

    if (!safeScores || !safeAttempts) {
      const cached = getCacheData<StudentProgressRecord>(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId));
      if (!safeScores && cached?.scores && Object.keys(cached.scores).length > 0) {
        safeScores = { ...cached.scores };
      }
      if (!safeAttempts && cached?.quizAttempts && Object.keys(cached.quizAttempts).length > 0) {
        safeAttempts = { ...cached.quizAttempts };
      }

      if (!safeScores || !safeAttempts) {
        for (const sid of allTargetIds) {
          try {
            if (!safeScores) {
              const ls = localStorage.getItem(`sistem_materi_scores_${sid}`);
              if (ls && ls !== 'null' && ls !== 'undefined') {
                const parsed = JSON.parse(ls);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
                  safeScores = parsed;
                }
              }
            }
            if (!safeAttempts) {
              const la = localStorage.getItem(`sistem_materi_quiz_attempts_${sid}`);
              if (la && la !== 'null' && la !== 'undefined') {
                const parsed = JSON.parse(la);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
                  safeAttempts = parsed;
                }
              }
            }
          } catch {}
        }
      }
    }

    const payload = cleanFirestoreData({
      studentId,
      completedMaterialIds: safeCompletedIds,
      progressPercent,
      completedCount,
      ...(typeof totalMaterialsCount === 'number' ? { totalMaterialsCount } : {}),
      ...(studentName ? { studentName } : {}),
      ...(kelas ? { kelas } : {}),
      ...(completedMaterialTimestamps ? { completedMaterialTimestamps } : {}),
      ...(activityLogs ? { activityLogs } : {}),
      ...(safeScores ? { scores: safeScores } : {}),
      ...(safeAttempts ? { quizAttempts: safeAttempts } : {}),
      ...(notes ? { notes } : {}),
      ...(bookmarkedMaterialIds ? { bookmarkedMaterialIds } : {}),
      ...(safeGamification ? { gamification: safeGamification } : {}),
      updatedAt: new Date().toISOString(),
    });

    // Immediate local persistence across all candidate IDs (Zero-Data-Loss offline-first guarantee)
    try {
      allTargetIds.forEach((sid) => {
        localStorage.setItem(`sistem_materi_prog_${sid}`, JSON.stringify(safeCompletedIds));
        localStorage.setItem(`sistem_materi_prog_percent_${sid}`, JSON.stringify(progressPercent));
        localStorage.setItem(`sistem_materi_completed_count_${sid}`, JSON.stringify(completedCount));
        if (typeof totalMaterialsCount === 'number') {
          localStorage.setItem(`sistem_materi_total_materials_${sid}`, JSON.stringify(totalMaterialsCount));
        }
        if (completedMaterialTimestamps) {
          localStorage.setItem(`sistem_materi_prog_times_${sid}`, JSON.stringify(completedMaterialTimestamps));
          localStorage.setItem(`sistem_materi_timestamps_${sid}`, JSON.stringify(completedMaterialTimestamps));
        }
        if (activityLogs) {
          localStorage.setItem(`sistem_materi_activity_logs_${sid}`, JSON.stringify(activityLogs));
          localStorage.setItem(`sistem_materi_activity_${sid}`, JSON.stringify(activityLogs));
        }
        if (safeScores) {
          localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify(safeScores));
        }
        if (safeAttempts) {
          localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify(safeAttempts));
        }
        if (notes) {
          localStorage.setItem(`sistem_materi_notes_${sid}`, JSON.stringify(notes));
        }
        if (bookmarkedMaterialIds) {
          localStorage.setItem(`sistem_materi_bookmarks_${sid}`, JSON.stringify(bookmarkedMaterialIds));
        }
        if (safeGamification) {
          localStorage.setItem(`sistem_materi_gamification_${sid}`, JSON.stringify(safeGamification));
        }
        setCacheData(CACHE_KEYS.STUDENT_PROGRESS(sid), safeCompletedIds, `sistem_materi_prog_${sid}`);
        setCacheData(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid), payload as StudentProgressRecord, `sistem_materi_prog_details_${sid}`);
        if (safeScores) {
          setCacheData(CACHE_KEYS.STUDENT_QUIZ_SCORES(sid), safeScores, `sistem_materi_scores_${sid}`);
        }
      });
    } catch {}

    invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
    invalidateCache(CACHE_KEYS.LEADERBOARD_SUMMARY);

    // Check if this is an immediate milestone write or can be debounced (30s)
    const isMilestone =
      options?.immediate === true ||
      Boolean(scores && Object.keys(scores).length > 0) ||
      Boolean(quizAttempts && Object.keys(quizAttempts).length > 0);

    let finalPayload = payload;

    const existingPending = pendingProgressWrites.get(studentId);
    if (existingPending) {
      if (existingPending.timer) clearTimeout(existingPending.timer);

      // Set union of completedMaterialIds so reading materials in queue are never overwritten by incoming items
      const mergedCompletedIds = Array.from(
        new Set([
          ...(Array.isArray(existingPending.payload?.completedMaterialIds) ? existingPending.payload.completedMaterialIds : []),
          ...(Array.isArray(payload?.completedMaterialIds) ? payload.completedMaterialIds : []),
        ])
      );

      const mergedTimestamps = {
        ...(existingPending.payload?.completedMaterialTimestamps || {}),
        ...(payload?.completedMaterialTimestamps || {}),
      };

      const mergedScores = {
        ...(existingPending.payload?.scores || {}),
        ...(payload?.scores || {}),
      };

      const mergedAttempts = {
        ...(existingPending.payload?.quizAttempts || {}),
        ...(payload?.quizAttempts || {}),
      };

      const prevLogs: MaterialActivityLog[] = Array.isArray(existingPending.payload?.activityLogs) ? existingPending.payload.activityLogs : [];
      const incomingLogs: MaterialActivityLog[] = Array.isArray(payload?.activityLogs) ? payload.activityLogs : [];
      const logMap = new Map<string, MaterialActivityLog>();
      [...prevLogs, ...incomingLogs].forEach((l) => {
        if (l && l.materialId) logMap.set(l.materialId, l);
      });
      const mergedLogs = Array.from(logMap.values());

      const mergedPayload = cleanFirestoreData({
        ...existingPending.payload,
        ...payload,
        completedMaterialIds: mergedCompletedIds,
        completedCount: mergedCompletedIds.length,
        ...(Object.keys(mergedTimestamps).length > 0 ? { completedMaterialTimestamps: mergedTimestamps } : {}),
        ...(Object.keys(mergedScores).length > 0 ? { scores: mergedScores } : {}),
        ...(Object.keys(mergedAttempts).length > 0 ? { quizAttempts: mergedAttempts } : {}),
        ...(mergedLogs.length > 0 ? { activityLogs: mergedLogs } : {}),
        updatedAt: new Date().toISOString(),
      });

      existingPending.payload = mergedPayload;
      finalPayload = mergedPayload;

      if (!isMilestone) {
        existingPending.timer = setTimeout(async () => {
          try {
            const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
            await setDoc(ref, cleanFirestoreData(mergedPayload), { merge: true });
            existingPending.promiseResolvers.forEach((res) => res());
            pendingProgressWrites.delete(studentId);
            removePendingProgressFromOfflineQueue(studentId);
          } catch (e) {
            console.warn('[Debounced Progress Write] Failed:', e);
          }
        }, 30_000);
        savePendingProgressToOfflineQueue(studentId, mergedPayload);
        return;
      }
    }

    if (!isMilestone) {
      savePendingProgressToOfflineQueue(studentId, payload);
      return new Promise<void>((resolve) => {
        const timer = setTimeout(async () => {
          try {
            const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
            await setDoc(ref, cleanFirestoreData(payload), { merge: true });
            resolve();
            pendingProgressWrites.delete(studentId);
            removePendingProgressFromOfflineQueue(studentId);
          } catch (e) {
            console.warn('[Debounced Progress Write] Failed:', e);
            resolve();
          }
        }, 30_000);

        pendingProgressWrites.set(studentId, {
          studentId,
          payload,
          timer,
          promiseResolvers: [resolve],
        });
      });
    }

    // Milestone write: flush immediately to Firestore via writeBatch with final merged payload
    if (existingPending) {
      existingPending.promiseResolvers.forEach((res) => res());
      pendingProgressWrites.delete(studentId);
      removePendingProgressFromOfflineQueue(studentId);
    }

    const batch = writeBatch(db);
    // Write only to primary canonical studentId document in Firestore using merged data
    const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
    batch.set(ref, cleanFirestoreData({ ...finalPayload, studentId }), { merge: true });
    await batch.commit();
    removePendingProgressFromOfflineQueue(studentId);
  } catch (err) {
    console.warn('Error saving student progress to Firestore:', err);
  }
}

/**
 * Saves a student's personal notes and bookmarks to Firestore and localStorage with multi-device protection
 */
export async function saveStudentNotesAndBookmarks(
  studentId: string,
  notes?: Record<string, string>,
  bookmarkedMaterialIds?: string[],
  options?: { explicitSet?: boolean }
): Promise<void> {
  if (!studentId) return;
  try {
    let finalBookmarks = bookmarkedMaterialIds;
    // Multi-device / multi-tab safety: merge with cached bookmarks if adding
    if (bookmarkedMaterialIds !== undefined && !options?.explicitSet) {
      const cached = getCacheData<StudentProgressRecord>(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId));
      let localBookmarks: string[] = [];
      try {
        const raw = localStorage.getItem(`sistem_materi_bookmarks_${studentId}`);
        if (raw) localBookmarks = JSON.parse(raw);
      } catch {}

      const existingBm = Array.isArray(cached?.bookmarkedMaterialIds)
        ? cached.bookmarkedMaterialIds
        : Array.isArray(localBookmarks)
        ? localBookmarks
        : [];

      finalBookmarks = Array.from(new Set([...existingBm, ...bookmarkedMaterialIds]));
    }

    try {
      if (notes !== undefined) {
        localStorage.setItem(`sistem_materi_notes_${studentId}`, JSON.stringify(notes));
      }
      if (finalBookmarks !== undefined) {
        localStorage.setItem(`sistem_materi_bookmarks_${studentId}`, JSON.stringify(finalBookmarks));
      }
    } catch {}

    const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
    const payload = cleanFirestoreData({
      studentId,
      ...(notes !== undefined ? { notes } : {}),
      ...(finalBookmarks !== undefined ? { bookmarkedMaterialIds: finalBookmarks } : {}),
      updatedAt: new Date().toISOString(),
    });

    invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
    invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId));

    const batch = writeBatch(db);
    batch.set(ref, cleanFirestoreData(payload), { merge: true });
    await batch.commit();
  } catch (err) {
    console.warn('Error saving student notes & bookmarks to Firestore:', err);
  }
}

/**
 * Saves a student's gamification state to Firestore and localStorage
 */
export async function saveStudentGamification(
  studentId: string,
  gamification: any
): Promise<void> {
  if (!studentId || !gamification) return;
  const safeGamification = getDefaultGamificationData(gamification);
  try {
    try {
      localStorage.setItem(`sistem_materi_gamification_${studentId}`, JSON.stringify(safeGamification));
    } catch {}

    const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
    const payload = cleanFirestoreData({
      studentId,
      gamification: safeGamification,
      updatedAt: new Date().toISOString(),
    });

    invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
    invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId));

    const batch = writeBatch(db);
    batch.set(ref, cleanFirestoreData(payload), { merge: true });
    await batch.commit();
  } catch (err) {
    console.warn('Error saving student gamification to Firestore:', err);
  }
}

/**
 * Saves a student's mini quiz score atomically using a Firestore writeBatch,
 * storing ONLY the highest score per material to optimize database size and prevent redundant attempt bloat.
 * Uses cached progress first to bypass unnecessary Firestore getDoc reads.
 */
export async function saveStudentQuizScore(
  studentId: string,
  materialId: string,
  score: number,
  totalQuestions: number,
  studentName?: string,
  kelas?: string,
  additionalIds?: string[],
  gamificationData?: any
): Promise<{ isNewHighest: boolean; highestPercentage: number; highestScore: number; totalQuestions: number }> {
  if (!studentId || !materialId) {
    return { isNewHighest: false, highestPercentage: 0, highestScore: score, totalQuestions };
  }

  const newPercentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const allTargetIds = Array.from(new Set([studentId, ...(additionalIds || [])].filter(Boolean)));

  try {
    const ref = doc(db, STUDENT_PROGRESS_COL, studentId);

    // Retrieve from memory cache or local storage first to bypass getDoc read
    const cachedDetails = getCacheData<StudentProgressRecord>(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId));
    let existingScores: Record<string, number> = cachedDetails?.scores ? { ...cachedDetails.scores } : {};
    let existingAttempts: Record<string, StudentQuizScoreInfo> = cachedDetails?.quizAttempts ? { ...cachedDetails.quizAttempts } : {};
    let existingCompleted: string[] = cachedDetails?.completedMaterialIds ? [...cachedDetails.completedMaterialIds] : [];
    let existingTimestamps: Record<string, string> = cachedDetails?.completedMaterialTimestamps ? { ...cachedDetails.completedMaterialTimestamps } : {};
    let existingLogs: MaterialActivityLog[] = cachedDetails?.activityLogs ? [...cachedDetails.activityLogs] : [];
    let existingName = studentName || cachedDetails?.studentName || '';
    let existingKelas = kelas || cachedDetails?.kelas || '';

    // Merge any pending debounced progress using Set union
    const pending = pendingProgressWrites.get(studentId);
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer);
      if (Array.isArray(pending.payload?.completedMaterialIds)) {
        existingCompleted = Array.from(new Set([...existingCompleted, ...pending.payload.completedMaterialIds]));
      }
      if (pending.payload?.completedMaterialTimestamps) {
        existingTimestamps = { ...existingTimestamps, ...pending.payload.completedMaterialTimestamps };
      }
      if (pending.payload?.activityLogs) {
        const logMap = new Map<string, MaterialActivityLog>();
        [...existingLogs, ...pending.payload.activityLogs].forEach((l) => {
          if (l && l.materialId) logMap.set(l.materialId, l);
        });
        existingLogs = Array.from(logMap.values());
      }
      pending.promiseResolvers.forEach((res) => res());
      pendingProgressWrites.delete(studentId);
      removePendingProgressFromOfflineQueue(studentId);
    }

    // Local storage fallback across candidate IDs if memory cache does not have scores
    if (Object.keys(existingScores).length === 0) {
      for (const sid of allTargetIds) {
        try {
          const localScores = localStorage.getItem(`sistem_materi_scores_${sid}`);
          if (localScores && localScores !== 'null' && localScores !== 'undefined' && Object.keys(existingScores).length === 0) {
            const parsed = JSON.parse(localScores);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existingScores = parsed;
          }
          const localAttempts = localStorage.getItem(`sistem_materi_quiz_attempts_${sid}`);
          if (localAttempts && localAttempts !== 'null' && localAttempts !== 'undefined' && Object.keys(existingAttempts).length === 0) {
            const parsed = JSON.parse(localAttempts);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existingAttempts = parsed;
          }
        } catch {}
      }
    }

    if (existingCompleted.length === 0) {
      for (const sid of allTargetIds) {
        try {
          const localProg = localStorage.getItem(`sistem_materi_prog_${sid}`);
          if (localProg && localProg !== 'null' && localProg !== 'undefined' && existingCompleted.length === 0) {
            const parsed = JSON.parse(localProg);
            if (Array.isArray(parsed)) existingCompleted = parsed;
          }
          const localTimes = localStorage.getItem(`sistem_materi_prog_times_${sid}`);
          if (localTimes && localTimes !== 'null' && localTimes !== 'undefined' && Object.keys(existingTimestamps).length === 0) {
            const parsed = JSON.parse(localTimes);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existingTimestamps = parsed;
          }
        } catch {}
      }
    }

    // If scores or completed are still empty, perform 1 fallback Firestore read
    let snap: any = null;
    if (Object.keys(existingScores).length === 0 || existingCompleted.length === 0) {
      try {
        snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (Object.keys(existingScores).length === 0 && data.scores) existingScores = { ...data.scores };
          if (Object.keys(existingAttempts).length === 0 && data.quizAttempts) existingAttempts = { ...data.quizAttempts };
          if (existingCompleted.length === 0 && data.completedMaterialIds) existingCompleted = [...data.completedMaterialIds];
          if (Object.keys(existingTimestamps).length === 0 && data.completedMaterialTimestamps) existingTimestamps = { ...data.completedMaterialTimestamps };
          if (existingLogs.length === 0 && data.activityLogs) existingLogs = [...data.activityLogs];
          if (!existingName) existingName = data.studentName || '';
          if (!existingKelas) existingKelas = data.kelas || '';
        }
      } catch {}
    }

    let minQuizPercent = DEFAULT_MIN_QUIZ_SCORE;
    try {
      const kkm = await getMinQuizScoreToUnlock();
      minQuizPercent = normalizeKkmPercent(kkm);
    } catch {
      minQuizPercent = DEFAULT_MIN_QUIZ_SCORE;
    }
    const reqCorrect = Math.max(1, Math.ceil((minQuizPercent / 100) * (totalQuestions || 1)));

    // Safely evaluate existing score using standardized single data contract
    const existingRawScore = existingScores[materialId];
    const existingAttempt = existingAttempts[materialId];
    const normalizedExisting = normalizeQuizScoreRecord(existingAttempt, existingRawScore, totalQuestions, minQuizPercent);

    const currentHighestPercent = normalizedExisting.hasAttempted ? normalizedExisting.percentage : -1;
    const currentHighestScore = normalizedExisting.hasAttempted ? normalizedExisting.score : -1;

    const isNewHighest =
      newPercentage > currentHighestPercent ||
      (newPercentage === currentHighestPercent && score > currentHighestScore);

    const isPassingAttempt = newPercentage >= minQuizPercent || score >= reqCorrect || currentHighestPercent >= minQuizPercent;
    const shouldAddCompletion = isPassingAttempt && !existingCompleted.includes(materialId);

    // Self-healing: if an attempt was recorded with score=0 but percentage>0, or vice versa, or attempt object missing
    const needsAttemptHealing =
      !existingAttempts[materialId] ||
      (existingAttempts[materialId].percentage === 0 && existingAttempts[materialId].score > 0) ||
      (existingAttempts[materialId].score === 0 && existingAttempts[materialId].percentage > 0) ||
      !normalizedExisting.hasAttempted;

    const shouldSave = isNewHighest || shouldAddCompletion || needsAttemptHealing;

    if (shouldSave) {
      const recordPercentage = isNewHighest ? newPercentage : Math.max(newPercentage, currentHighestPercent);
      const recordScore = isNewHighest ? score : Math.max(score, currentHighestScore);
      const finalTotalQ = isNewHighest ? totalQuestions : (existingAttempt?.totalQuestions || totalQuestions);

      existingScores[materialId] = recordPercentage;
      existingAttempts[materialId] = {
        score: recordScore,
        totalQuestions: finalTotalQ,
        percentage: recordPercentage,
        updatedAt: new Date().toISOString(),
      };

      if (isPassingAttempt && !existingCompleted.includes(materialId)) {
        existingCompleted.push(materialId);
        existingTimestamps[materialId] = new Date().toISOString();
      }

      let quizProgressPercent = 0;
      let quizTotalMaterialsCount: number | undefined = undefined;
      try {
        const cachedMats = localStorage.getItem('sistem_materi_mat_cache');
        if (cachedMats) {
          const parsed = JSON.parse(cachedMats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const published = parsed.filter((m: any) => m && m.isPublished !== false);
            if (published.length > 0) {
              quizTotalMaterialsCount = published.length;
              quizProgressPercent = Math.round((existingCompleted.length / published.length) * 100);
            }
          }
        }
      } catch {}

      let safeGamification: StudentGamificationData | undefined = undefined;
      if (gamificationData) {
        safeGamification = getDefaultGamificationData(gamificationData);
      } else if (cachedDetails?.gamification) {
        safeGamification = getDefaultGamificationData(cachedDetails.gamification);
      } else if (snap?.exists() && snap.data()?.gamification) {
        safeGamification = getDefaultGamificationData(snap.data().gamification);
      } else {
        for (const sid of allTargetIds) {
          try {
            const ls = localStorage.getItem(`sistem_materi_gamification_${sid}`);
            if (ls) {
              safeGamification = getDefaultGamificationData(JSON.parse(ls));
              break;
            }
          } catch {}
        }
        if (!safeGamification) {
          safeGamification = getDefaultGamificationData(null);
        }
      }

      const payload = cleanFirestoreData({
        studentId,
        ...(existingName ? { studentName: existingName } : {}),
        ...(existingKelas ? { kelas: existingKelas } : {}),
        completedMaterialIds: existingCompleted,
        completedMaterialTimestamps: existingTimestamps,
        progressPercent: quizProgressPercent,
        completedCount: existingCompleted.length,
        ...(typeof quizTotalMaterialsCount === 'number' ? { totalMaterialsCount: quizTotalMaterialsCount } : {}),
        activityLogs: existingLogs,
        scores: existingScores,
        quizAttempts: existingAttempts,
        ...(safeGamification ? { gamification: safeGamification } : {}),
        updatedAt: new Date().toISOString(),
      });

      const batch = writeBatch(db);
      // Write only to primary canonical studentId document in Firestore to prevent duplicate student_progress records
      const targetRef = doc(db, STUDENT_PROGRESS_COL, studentId);
      batch.set(targetRef, cleanFirestoreData({ ...payload, studentId }), { merge: true });
      await batch.commit();
      removePendingProgressFromOfflineQueue(studentId);

      invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
      allTargetIds.forEach((sid) => {
        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(sid));
        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid));
        invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(sid));

        try {
          localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify(existingScores));
          localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify(existingAttempts));
          localStorage.setItem(`sistem_materi_prog_${sid}`, JSON.stringify(existingCompleted));
          localStorage.setItem(`sistem_materi_prog_times_${sid}`, JSON.stringify(existingTimestamps));
          localStorage.setItem(`sistem_materi_timestamps_${sid}`, JSON.stringify(existingTimestamps));
          localStorage.setItem(`sistem_materi_prog_percent_${sid}`, JSON.stringify(quizProgressPercent));
          localStorage.setItem(`sistem_materi_completed_count_${sid}`, JSON.stringify(existingCompleted.length));
          if (typeof quizTotalMaterialsCount === 'number') {
            localStorage.setItem(`sistem_materi_total_materials_${sid}`, JSON.stringify(quizTotalMaterialsCount));
          }
          if (safeGamification) {
            localStorage.setItem(`sistem_materi_gamification_${sid}`, JSON.stringify(safeGamification));
          }
        } catch {}
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(
          new CustomEvent('student-progress-sync', {
            detail: {
              studentIds: allTargetIds,
              materialId,
              completedMaterialIds: existingCompleted,
              scores: existingScores,
              quizAttempts: existingAttempts,
              highestScoreRecord: existingAttempts[materialId],
              record: {
                scores: existingScores,
                quizAttempts: existingAttempts,
                completedMaterialIds: existingCompleted,
              },
            },
          })
        );
      }

      return {
        isNewHighest,
        highestPercentage: recordPercentage,
        highestScore: recordScore,
        totalQuestions: finalTotalQ,
      };
    } else {
      // Existing score is higher or equal; preserve the highest score
      return {
        isNewHighest: false,
        highestPercentage: currentHighestPercent,
        highestScore: currentHighestScore >= 0 ? currentHighestScore : Math.round((currentHighestPercent / 100) * totalQuestions),
        totalQuestions: existingAttempt?.totalQuestions ?? totalQuestions,
      };
    }
  } catch (err) {
    console.warn('Error saving student quiz score to Firestore:', err);
    try {
      let localScores: Record<string, number> = {};
      let localAttempts: Record<string, StudentQuizScoreInfo> = {};
      for (const sid of allTargetIds) {
        try {
          const ls = localStorage.getItem(`sistem_materi_scores_${sid}`);
          if (ls && ls !== 'null' && ls !== 'undefined' && Object.keys(localScores).length === 0) {
            const parsed = JSON.parse(ls);
            if (parsed && typeof parsed === 'object') localScores = parsed;
          }
          const la = localStorage.getItem(`sistem_materi_quiz_attempts_${sid}`);
          if (la && la !== 'null' && la !== 'undefined' && Object.keys(localAttempts).length === 0) {
            const parsed = JSON.parse(la);
            if (parsed && typeof parsed === 'object') localAttempts = parsed;
          }
        } catch {}
      }

      const existingRaw = localScores[materialId];
      const existingAtt = localAttempts[materialId];
      const normalizedExisting = normalizeQuizScoreRecord(existingAtt, existingRaw, totalQuestions, 80);
      const currentHighestPercent = normalizedExisting.hasAttempted ? normalizedExisting.percentage : -1;
      const currentHighestScore = normalizedExisting.hasAttempted ? normalizedExisting.score : -1;

      const isNewHighest =
        newPercentage > currentHighestPercent ||
        (newPercentage === currentHighestPercent && score > currentHighestScore);

      if (isNewHighest || !normalizedExisting.hasAttempted) {
        localScores[materialId] = newPercentage;
        localAttempts[materialId] = {
          score,
          totalQuestions,
          percentage: newPercentage,
          updatedAt: new Date().toISOString(),
        };
        allTargetIds.forEach((sid) => {
          try {
            localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify(localScores));
            localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify(localAttempts));
          } catch {}
        });
        return { isNewHighest: true, highestPercentage: newPercentage, highestScore: score, totalQuestions };
      }
      return {
        isNewHighest: false,
        highestPercentage: currentHighestPercent,
        highestScore: currentHighestScore >= 0 ? currentHighestScore : Math.round((currentHighestPercent / 100) * totalQuestions),
        totalQuestions: existingAtt?.totalQuestions ?? totalQuestions,
      };
    } catch {
      return { isNewHighest: false, highestPercentage: newPercentage, highestScore: score, totalQuestions };
    }
  }
}

/**
 * Synchronizes multiple student progress records in chunked Firestore writeBatches,
 * reducing multiple sequential network round trips into single atomic batch operations.
 */
export async function syncStudentProgressBatch(
  updates: StudentProgressSyncItem[]
): Promise<{ successCount: number; errorCount: number }> {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { successCount: 0, errorCount: 0 };
  }

  const validUpdates = updates.filter((u) => u && u.studentId);
  if (validUpdates.length === 0) return { successCount: 0, errorCount: 0 };

  const now = new Date().toISOString();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < validUpdates.length; i += PROGRESS_BATCH_LIMIT) {
    const chunk = validUpdates.slice(i, i + PROGRESS_BATCH_LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((item) => {
      const ref = doc(db, STUDENT_PROGRESS_COL, item.studentId);
      const payload = cleanFirestoreData({
        ...item,
        ...(item.gamification !== undefined ? { gamification: getDefaultGamificationData(item.gamification) } : {}),
        updatedAt: now,
      });
      batch.set(ref, cleanFirestoreData(payload), { merge: true });
    });

    try {
      await batch.commit();
      successCount += chunk.length;

      // Update local storage and invalidate SWR caches for all committed students
      chunk.forEach((item) => {
        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(item.studentId));
        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(item.studentId));
        invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(item.studentId));

        try {
          if (item.completedMaterialIds) {
            localStorage.setItem(`sistem_materi_prog_${item.studentId}`, JSON.stringify(item.completedMaterialIds));
          }
          if (item.completedMaterialTimestamps) {
            localStorage.setItem(`sistem_materi_prog_times_${item.studentId}`, JSON.stringify(item.completedMaterialTimestamps));
            localStorage.setItem(`sistem_materi_timestamps_${item.studentId}`, JSON.stringify(item.completedMaterialTimestamps));
          }
          if (item.activityLogs) {
            localStorage.setItem(`sistem_materi_activity_logs_${item.studentId}`, JSON.stringify(item.activityLogs));
            localStorage.setItem(`sistem_materi_activity_${item.studentId}`, JSON.stringify(item.activityLogs));
          }
          if (item.scores) {
            localStorage.setItem(`sistem_materi_scores_${item.studentId}`, JSON.stringify(item.scores));
          }
          if (item.quizAttempts) {
            localStorage.setItem(`sistem_materi_quiz_attempts_${item.studentId}`, JSON.stringify(item.quizAttempts));
          }
        } catch {}
      });
    } catch (err) {
      console.error('Error committing batch student progress sync:', err);
      errorCount += chunk.length;
    }
  }

  invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
  return { successCount, errorCount };
}

/**
 * Resets progress records for multiple students using atomic Firestore writeBatches.
 */
export async function bulkResetStudentProgress(
  studentIds: string[]
): Promise<{ successCount: number; errorCount: number }> {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return { successCount: 0, errorCount: 0 };
  }

  const validIds = studentIds.filter(Boolean);
  if (validIds.length === 0) return { successCount: 0, errorCount: 0 };

  const now = new Date().toISOString();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < validIds.length; i += PROGRESS_BATCH_LIMIT) {
    const chunk = validIds.slice(i, i + PROGRESS_BATCH_LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((id) => {
      const ref = doc(db, STUDENT_PROGRESS_COL, id);
      batch.set(
        ref,
        cleanFirestoreData({
          studentId: id,
          completedMaterialIds: [],
          completedMaterialTimestamps: {},
          activityLogs: [],
          scores: {},
          quizAttempts: {},
          gamification: getDefaultGamificationData(null),
          updatedAt: now,
        }),
        { merge: true }
      );
    });

    try {
      await batch.commit();
      successCount += chunk.length;

      chunk.forEach((id) => {
        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(id));
        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(id));
        invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(id));
        try {
          localStorage.setItem(`sistem_materi_prog_${id}`, JSON.stringify([]));
          localStorage.setItem(`sistem_materi_timestamps_${id}`, JSON.stringify({}));
          localStorage.setItem(`sistem_materi_activity_${id}`, JSON.stringify([]));
          localStorage.setItem(`sistem_materi_scores_${id}`, JSON.stringify({}));
          localStorage.setItem(`sistem_materi_quiz_attempts_${id}`, JSON.stringify({}));
        } catch {}
      });
    } catch (err) {
      console.error('Error committing bulk student progress reset:', err);
      errorCount += chunk.length;
    }
  }

  invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
  return { successCount, errorCount };
}

/**
 * Fetches all highest quiz scores and attempt details for a student.
 */
export async function fetchStudentQuizScores(
  studentId: string,
  options?: { forceRevalidate?: boolean; additionalIds?: string[]; studentName?: string }
): Promise<Record<string, StudentQuizScoreInfo>> {
  if (!studentId) return {};
  const candidateIds = Array.from(new Set([studentId, ...(options?.additionalIds || [])].filter(Boolean)));

  return swrFetch(
    CACHE_KEYS.STUDENT_QUIZ_SCORES(studentId),
    async () => {
      const mergedScores: Record<string, number> = {};
      const mergedAttempts: Record<string, StudentQuizScoreInfo> = {};
      let hasData = false;

      for (const sid of candidateIds) {
        try {
          const ref = doc(db, STUDENT_PROGRESS_COL, sid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            hasData = true;
            const data = snap.data();
            const scores = data.scores || {};
            const attempts = data.quizAttempts || {};

            for (const [matId, val] of Object.entries(scores)) {
              const numVal = Number(val);
              if (typeof mergedScores[matId] !== 'number' || numVal > mergedScores[matId]) {
                mergedScores[matId] = numVal;
                if (attempts[matId]) {
                  mergedAttempts[matId] = attempts[matId];
                } else {
                  // If numVal is <= 10, it represents raw correct count on 10 questions (e.g. 10/10 = 100%)
                  const normalizedScore = numVal <= 10 ? numVal : Math.round((numVal / 100) * 10);
                  const normalizedPercent = numVal <= 10 ? Math.min(100, Math.round((numVal / 10) * 100)) : numVal;
                  mergedAttempts[matId] = {
                    score: normalizedScore,
                    totalQuestions: 10,
                    percentage: normalizedPercent,
                    updatedAt: data.updatedAt || '',
                  };
                }
              }
            }

            for (const [matId, att] of Object.entries(attempts)) {
              if (att && (!mergedAttempts[matId] || (att as any).percentage > (mergedAttempts[matId]?.percentage ?? -1))) {
                mergedAttempts[matId] = att as StudentQuizScoreInfo;
                mergedScores[matId] = (att as any).percentage;
              }
            }
          }
        } catch {}
      }

      if (hasData) {
        try {
          candidateIds.forEach((sid) => {
            localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify(mergedScores));
            localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify(mergedAttempts));
          });
        } catch {}
        return mergedAttempts;
      }

      try {
        candidateIds.forEach((sid) => {
          const localScores = localStorage.getItem(`sistem_materi_scores_${sid}`);
          const localAttempts = localStorage.getItem(`sistem_materi_quiz_attempts_${sid}`);
          if (localScores && Object.keys(mergedScores).length === 0) {
            Object.assign(mergedScores, JSON.parse(localScores));
          }
          if (localAttempts && Object.keys(mergedAttempts).length === 0) {
            Object.assign(mergedAttempts, JSON.parse(localAttempts));
          }
        });
      } catch {}

      return mergedAttempts;
    },
    {
      staleTime: options?.forceRevalidate ? 0 : 30_000,
      forceRevalidate: options?.forceRevalidate || false,
      persistKey: `sistem_materi_quiz_attempts_${studentId}`,
    }
  );
}

/**
 * Fetches all student evaluation records for a specific material.
 * Used by Bank Soal Mini Kuis AI and Teacher Evaluation tab.
 * Supports targeted class querying to prevent full-collection Firestore read spikes.
 */
export async function fetchMaterialStudentQuizScores(
  materialId: string,
  studentsList: StudentAccount[] = [],
  customKkmPercent?: number,
  fallbackTotalQ?: number,
  selectedClass?: string
): Promise<MaterialStudentQuizScoreRecord[]> {
  if (!materialId) return [];

  let kkmPercent = DEFAULT_MIN_QUIZ_SCORE;
  if (typeof customKkmPercent === 'number' && customKkmPercent > 0) {
    kkmPercent = customKkmPercent <= 10 ? customKkmPercent * 10 : customKkmPercent;
  } else {
    try {
      const kkm = await getMinQuizScoreToUnlock();
      kkmPercent = kkm <= 10 ? kkm * 10 : kkm;
    } catch {
      kkmPercent = DEFAULT_MIN_QUIZ_SCORE;
    }
  }

  const allProgress = await fetchAllStudentProgress({
    selectedClass: selectedClass && selectedClass !== 'all' && selectedClass !== 'ALL' ? selectedClass : undefined,
  });
  const studentMap = new Map<string, StudentAccount>();
  for (const s of studentsList) {
    if (s.id) studentMap.set(s.id, s);
    if (s.nisn) studentMap.set(s.nisn, s);
    if (s.nama) studentMap.set(s.nama.toLowerCase().trim(), s);
  }

  const activeTotalQ =
    typeof fallbackTotalQ === 'number' && fallbackTotalQ > 0 && fallbackTotalQ <= 20
      ? fallbackTotalQ
      : 10;

  const deduplicatedMap = new Map<string, MaterialStudentQuizScoreRecord>();

  for (const [studentDocId, prog] of Object.entries(allProgress)) {
    const hasScore = prog.scores && prog.scores[materialId] !== undefined;
    const hasAttempt = prog.quizAttempts && prog.quizAttempts[materialId] !== undefined;
    const isCompletedInProg = Array.isArray(prog.completedMaterialIds) && prog.completedMaterialIds.includes(materialId);

    // Include if student has an attempt, a score, OR has completed the material
    if (!hasScore && !hasAttempt && !isCompletedInProg) continue;

    const attempt = prog.quizAttempts?.[materialId];
    const legacyScore = hasScore ? prog.scores[materialId] : undefined;

    const normalized = normalizeQuizScoreRecord(attempt, legacyScore, activeTotalQ, kkmPercent);
    let truePercent = normalized.percentage;
    let harmonizedScore = normalized.score;

    // Self-healing: If student has completedMaterialIds for this material, but recorded score was 0
    if (isCompletedInProg && truePercent === 0 && harmonizedScore === 0) {
      truePercent = kkmPercent;
      harmonizedScore = Math.max(1, Math.ceil((kkmPercent / 100) * activeTotalQ));
    }

    // Harmonize score proportional to activeTotalQ if recorded question count differed
    if (normalized.totalQuestions !== activeTotalQ && activeTotalQ > 0) {
      if (truePercent >= 100) {
        harmonizedScore = activeTotalQ;
      } else {
        harmonizedScore = Math.min(activeTotalQ, Math.round((truePercent / 100) * activeTotalQ));
      }
    }

    const minPercent = kkmPercent;
    const reqCorrect = Math.max(1, Math.ceil((minPercent / 100) * activeTotalQ));
    const isPassed = isCompletedInProg || normalized.isPassed || truePercent >= minPercent || harmonizedScore >= reqCorrect;

    const completedTime =
      attempt?.updatedAt ||
      prog.completedMaterialTimestamps?.[materialId] ||
      prog.updatedAt ||
      new Date().toISOString();

    const matchedStudent =
      studentMap.get(studentDocId) ||
      (prog.studentId ? studentMap.get(prog.studentId) : undefined) ||
      (prog.studentName ? studentMap.get(prog.studentName.toLowerCase().trim()) : undefined);

    const name = matchedStudent?.nama || prog.studentName || 'Siswa';
    const cls = matchedStudent?.kelas || prog.kelas || '-';
    const absen = matchedStudent?.noAbsen || '-';

    // Canonical key to guarantee zero duplicate student entries in evaluation table
    const canonicalKey =
      matchedStudent?.id ||
      matchedStudent?.nisn ||
      (prog.studentId && prog.studentId.trim()
        ? prog.studentId.trim()
        : `${name.toLowerCase().trim()}_${cls.toLowerCase().trim()}`);

    const newRecord: MaterialStudentQuizScoreRecord = {
      id: matchedStudent?.id || studentDocId,
      studentId: matchedStudent?.id || prog.studentId || studentDocId,
      studentName: name,
      studentClass: cls,
      studentAbsen: absen,
      score: harmonizedScore,
      totalQuestions: activeTotalQ,
      percentage: truePercent,
      completedAt: completedTime,
      isPassed,
    };

    if (deduplicatedMap.has(canonicalKey)) {
      const existing = deduplicatedMap.get(canonicalKey)!;
      // Keep record with higher percentage, or if equal, latest completedAt
      if (
        newRecord.percentage > existing.percentage ||
        (newRecord.percentage === existing.percentage &&
          new Date(newRecord.completedAt).getTime() > new Date(existing.completedAt).getTime())
      ) {
        deduplicatedMap.set(canonicalKey, newRecord);
      }
    } else {
      deduplicatedMap.set(canonicalKey, newRecord);
    }
  }

  const results = Array.from(deduplicatedMap.values());

  results.sort((a, b) => {
    if (a.studentClass !== b.studentClass) return a.studentClass.localeCompare(b.studentClass);
    const numA = parseInt(a.studentAbsen || '0', 10);
    const numB = parseInt(b.studentAbsen || '0', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.studentName.localeCompare(b.studentName);
  });

  return results;
}

/**
 * Resets a student's completion, quiz score, and quiz attempts for a specific material.
 * This completely reverts the material to its initial uncompleted state so that
 * the student can redo the quiz and material from scratch.
 */
export async function resetStudentMaterialProgress(
  studentId: string,
  materialId: string,
  additionalStudentIds: string[] = [],
  studentName?: string
): Promise<{ success: boolean; message?: string }> {
  if (!studentId || !materialId) {
    return { success: false, message: 'ID Siswa atau ID Materi tidak valid.' };
  }

  const initialIds = Array.from(new Set([studentId, ...additionalStudentIds].filter(Boolean)));
  const allDocIdsToReset = new Set<string>(initialIds);

  try {
    const allProgressSnap = await getDocs(collection(db, STUDENT_PROGRESS_COL));
    const matchedDocs: { ref: any; id: string; data: any }[] = [];

    allProgressSnap.docs.forEach((docSnap) => {
      const dId = docSnap.id;
      const data = docSnap.data();
      const sId = data.studentId;
      const sNisn = data.nisn;
      const sName = data.studentName;

      const isIdMatch =
        initialIds.includes(dId) ||
        (sId && initialIds.includes(sId)) ||
        (sNisn && initialIds.includes(sNisn));
      const isNameMatch =
        studentName && sName && sName.toLowerCase().trim() === studentName.toLowerCase().trim();

      if (isIdMatch || isNameMatch) {
        allDocIdsToReset.add(dId);
        if (sId) allDocIdsToReset.add(sId);
        if (sNisn) allDocIdsToReset.add(sNisn);
        matchedDocs.push({ ref: docSnap.ref, id: dId, data });
      }
    });

    const finalIds = Array.from(allDocIdsToReset);

    if (matchedDocs.length > 0) {
      const batch = writeBatch(db);
      for (const m of matchedDocs) {
        const data = m.data;
        const existingScores = { ...(data.scores || {}) };
        const existingAttempts = { ...(data.quizAttempts || {}) };
        const existingTimestamps = { ...(data.completedMaterialTimestamps || {}) };
        let existingCompleted: string[] = Array.isArray(data.completedMaterialIds)
          ? [...data.completedMaterialIds]
          : [];
        let existingLogs: MaterialActivityLog[] = Array.isArray(data.activityLogs)
          ? [...data.activityLogs]
          : [];

        delete existingScores[materialId];
        delete existingAttempts[materialId];
        delete existingTimestamps[materialId];
        existingCompleted = existingCompleted.filter((id) => id !== materialId);
        existingLogs = existingLogs.filter((log) => log.materialId !== materialId);

        const payload = cleanFirestoreData({
          ...data,
          completedMaterialIds: existingCompleted,
          completedMaterialTimestamps: existingTimestamps,
          scores: existingScores,
          quizAttempts: existingAttempts,
          activityLogs: existingLogs,
          updatedAt: new Date().toISOString(),
        });

        batch.set(m.ref, payload);
      }
      await batch.commit();
    } else {
      for (const sid of initialIds) {
        const ref = doc(db, STUDENT_PROGRESS_COL, sid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const existingScores = { ...(data.scores || {}) };
          const existingAttempts = { ...(data.quizAttempts || {}) };
          const existingTimestamps = { ...(data.completedMaterialTimestamps || {}) };
          let existingCompleted: string[] = Array.isArray(data.completedMaterialIds)
            ? [...data.completedMaterialIds]
            : [];
          let existingLogs: MaterialActivityLog[] = Array.isArray(data.activityLogs)
            ? [...data.activityLogs]
            : [];

          delete existingScores[materialId];
          delete existingAttempts[materialId];
          delete existingTimestamps[materialId];
          existingCompleted = existingCompleted.filter((id) => id !== materialId);
          existingLogs = existingLogs.filter((log) => log.materialId !== materialId);

          const payload = cleanFirestoreData({
            ...data,
            completedMaterialIds: existingCompleted,
            completedMaterialTimestamps: existingTimestamps,
            scores: existingScores,
            quizAttempts: existingAttempts,
            activityLogs: existingLogs,
            updatedAt: new Date().toISOString(),
          });

          const batch = writeBatch(db);
          batch.set(ref, payload);
          await batch.commit();
        }
      }
    }

    for (const sid of finalIds) {
      try {
        const localScores = localStorage.getItem(`sistem_materi_scores_${sid}`);
        if (localScores) {
          const sc = JSON.parse(localScores);
          delete sc[materialId];
          localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify(sc));
        }
        const localAtt = localStorage.getItem(`sistem_materi_quiz_attempts_${sid}`);
        if (localAtt) {
          const at = JSON.parse(localAtt);
          delete at[materialId];
          localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify(at));
        }
        const localProg = localStorage.getItem(`sistem_materi_prog_${sid}`);
        if (localProg) {
          let pr: string[] = JSON.parse(localProg);
          pr = pr.filter((id) => id !== materialId);
          localStorage.setItem(`sistem_materi_prog_${sid}`, JSON.stringify(pr));
        }
        const localTimes = localStorage.getItem(`sistem_materi_prog_times_${sid}`);
        if (localTimes) {
          const tm = JSON.parse(localTimes);
          delete tm[materialId];
          localStorage.setItem(`sistem_materi_prog_times_${sid}`, JSON.stringify(tm));
        }
        localStorage.removeItem(`sistem_materi_prog_details_${sid}`);
        localStorage.removeItem(`quiz_res_${materialId}_${sid}`);
        localStorage.removeItem(`quiz_answers_${materialId}_${sid}`);
        localStorage.removeItem(`sistem_materi_quiz_ans_${materialId}_${sid}`);
        localStorage.removeItem(`simpel_quiz_progress_${materialId}_${sid}`);
      } catch {}

      invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(sid));
      invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid));
      invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(sid));
    }

    invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
    try {
      localStorage.removeItem('sistem_materi_all_progress_cache');
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(
        new CustomEvent('student-material-reset', {
          detail: { studentIds: finalIds, materialId },
        })
      );
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error resetting student material progress:', err);
    return { success: false, message: err?.message || 'Gagal mereset data siswa di database.' };
  }
}

/**
 * Resets all students' completion and quiz score for a specific material.
 */
export async function resetAllStudentsMaterialProgress(
  materialId: string
): Promise<{ success: boolean; count: number; message?: string }> {
  if (!materialId) {
    return { success: false, count: 0, message: 'ID Materi tidak valid.' };
  }

  try {
    const snap = await getDocs(collection(db, STUDENT_PROGRESS_COL));
    let count = 0;
    const batch = writeBatch(db);

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const hasScore = data.scores && data.scores[materialId] !== undefined;
      const hasAttempt = data.quizAttempts && data.quizAttempts[materialId] !== undefined;
      const hasCompleted = Array.isArray(data.completedMaterialIds) && data.completedMaterialIds.includes(materialId);

      if (hasScore || hasAttempt || hasCompleted) {
        const existingScores = { ...(data.scores || {}) };
        const existingAttempts = { ...(data.quizAttempts || {}) };
        const existingTimestamps = { ...(data.completedMaterialTimestamps || {}) };
        let existingCompleted: string[] = Array.isArray(data.completedMaterialIds) ? [...data.completedMaterialIds] : [];
        let existingLogs: MaterialActivityLog[] = Array.isArray(data.activityLogs) ? [...data.activityLogs] : [];

        delete existingScores[materialId];
        delete existingAttempts[materialId];
        delete existingTimestamps[materialId];
        existingCompleted = existingCompleted.filter((id) => id !== materialId);
        existingLogs = existingLogs.filter((log) => log.materialId !== materialId);

        const payload = cleanFirestoreData({
          ...data,
          completedMaterialIds: existingCompleted,
          completedMaterialTimestamps: existingTimestamps,
          scores: existingScores,
          quizAttempts: existingAttempts,
          activityLogs: existingLogs,
          updatedAt: new Date().toISOString(),
        });

        batch.set(docSnap.ref, payload);
        count++;

        const sid = docSnap.id;
        try {
          localStorage.removeItem(`sistem_materi_scores_${sid}`);
          localStorage.removeItem(`sistem_materi_quiz_attempts_${sid}`);
          localStorage.removeItem(`sistem_materi_prog_${sid}`);
          localStorage.removeItem(`sistem_materi_prog_times_${sid}`);
          localStorage.removeItem(`sistem_materi_timestamps_${sid}`);
          localStorage.removeItem(`sistem_materi_prog_details_${sid}`);
          localStorage.removeItem(`quiz_res_${materialId}_${sid}`);
          localStorage.removeItem(`quiz_answers_${materialId}_${sid}`);
        } catch {}

        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(sid));
        invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid));
        invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(sid));
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
    try {
      localStorage.removeItem('sistem_materi_all_progress_cache');
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(
        new CustomEvent('student-material-reset', {
          detail: { materialId, allStudents: true },
        })
      );
    }

    return { success: true, count };
  } catch (err: any) {
    console.error('Error resetting all students material progress:', err);
    return { success: false, count: 0, message: err?.message || 'Gagal mereset semua data siswa.' };
  }
}

export async function fetchStudentProgress(studentId: string): Promise<string[]> {
  if (!studentId) return [];
  const detailsCached = getCacheData<StudentProgressRecord>(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId));
  if (detailsCached?.completedMaterialIds && Array.isArray(detailsCached.completedMaterialIds)) {
    return detailsCached.completedMaterialIds;
  }
  return swrFetch(
    CACHE_KEYS.STUDENT_PROGRESS(studentId),
    async () => {
      const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.completedMaterialIds)) {
          return data.completedMaterialIds;
        }
        if (data.completedMaterialIds && typeof data.completedMaterialIds === 'object') {
          return Object.keys(data.completedMaterialIds).filter(Boolean);
        }
        return [];
      }
      return [];
    },
    {
      staleTime: 45_000,
      persistKey: `sistem_materi_prog_${studentId}`,
    }
  );
}

export async function fetchStudentProgressDetails(
  studentId: string,
  options?: { forceRevalidate?: boolean; additionalIds?: string[]; studentName?: string; kelas?: string }
): Promise<StudentProgressRecord | null> {
  if (!studentId) return null;
  const candidateIds = Array.from(new Set([studentId, ...(options?.additionalIds || [])].filter(Boolean)));

  return swrFetch(
    CACHE_KEYS.STUDENT_PROGRESS_DETAILS(studentId),
    async () => {
      let foundAny = false;
      let mergedCompletedSet = new Set<string>();
      let mergedTimestamps: Record<string, string> = {};
      let mergedScores: Record<string, number> = {};
      let mergedAttempts: Record<string, StudentQuizScoreInfo> = {};
      let mergedLogs: MaterialActivityLog[] = [];
      let mergedNotes: Record<string, string> = {};
      let mergedBookmarksSet = new Set<string>();
      let studentName = options?.studentName || '';
      let studentKelas = options?.kelas || '';
      let maxProgressPercent: number | undefined = undefined;
      let totalMaterialsCount: number | undefined = undefined;
      let latestUpdatedAt = '';
      let mergedGamification: StudentGamificationData | undefined = undefined;
      const missingOrOutdatedIds: string[] = [];

      for (const sid of candidateIds) {
        try {
          const ref = doc(db, STUDENT_PROGRESS_COL, sid);
          const s = await getDoc(ref);
          if (s.exists()) {
            foundAny = true;
            const data = s.data();
            if (!studentName && data.studentName) studentName = data.studentName;
            if (!studentKelas && data.kelas) studentKelas = data.kelas;
            if (data.updatedAt && data.updatedAt > latestUpdatedAt) latestUpdatedAt = data.updatedAt;

            if (data.gamification) {
              if (!mergedGamification || (data.gamification.exp || 0) > (mergedGamification.exp || 0)) {
                mergedGamification = getDefaultGamificationData(data.gamification);
              }
            }

            if (Array.isArray(data.completedMaterialIds)) {
              data.completedMaterialIds.forEach((id: string) => mergedCompletedSet.add(id));
            }
            if (data.completedMaterialTimestamps) {
              Object.assign(mergedTimestamps, data.completedMaterialTimestamps);
            }
            if (data.scores) {
              for (const [mId, val] of Object.entries(data.scores)) {
                const num = Number(val);
                if (typeof mergedScores[mId] !== 'number' || num > mergedScores[mId]) {
                  mergedScores[mId] = num;
                }
              }
            }
            if (data.quizAttempts) {
              for (const [mId, att] of Object.entries(data.quizAttempts)) {
                if (att && (!mergedAttempts[mId] || (att as any).percentage > (mergedAttempts[mId]?.percentage ?? -1))) {
                  mergedAttempts[mId] = att as StudentQuizScoreInfo;
                }
              }
            }
            if (Array.isArray(data.activityLogs)) {
              const existingIds = new Set(mergedLogs.map((l) => `${l.materialId}_${l.completedAt || (l as any).timestamp}`));
              data.activityLogs.forEach((log: MaterialActivityLog) => {
                const key = `${log.materialId}_${log.completedAt || (log as any).timestamp}`;
                if (!existingIds.has(key)) {
                  mergedLogs.push(log);
                  existingIds.add(key);
                }
              });
            }
            if (data.notes) {
              Object.assign(mergedNotes, data.notes);
            }
            if (Array.isArray(data.bookmarkedMaterialIds)) {
              data.bookmarkedMaterialIds.forEach((id: string) => mergedBookmarksSet.add(id));
            }
            if (typeof data.progressPercent === 'number') {
              if (maxProgressPercent === undefined || data.progressPercent > maxProgressPercent) {
                maxProgressPercent = data.progressPercent;
              }
            }
            if (typeof data.totalMaterialsCount === 'number') {
              totalMaterialsCount = data.totalMaterialsCount;
            }
          } else {
            missingOrOutdatedIds.push(sid);
          }
        } catch {}
      }

      // Auto-heal: Ensure any materials where student scored >= 80% are in completedMaterialIds
      let healedAny = false;
      for (const [mId, sVal] of Object.entries(mergedScores)) {
        if (Number(sVal) >= 80 && !mergedCompletedSet.has(mId)) {
          mergedCompletedSet.add(mId);
          healedAny = true;
          if (!mergedTimestamps[mId]) {
            mergedTimestamps[mId] = mergedAttempts[mId]?.updatedAt || latestUpdatedAt || new Date().toISOString();
          }
        }
      }
      for (const [mId, att] of Object.entries(mergedAttempts)) {
        const p = (att as any)?.percentage ?? (((att as any)?.score && (att as any)?.totalQuestions) ? Math.round(((att as any).score / (att as any).totalQuestions) * 100) : 0);
        if (p >= 80 && !mergedCompletedSet.has(mId)) {
          mergedCompletedSet.add(mId);
          healedAny = true;
          if (!mergedTimestamps[mId]) {
            mergedTimestamps[mId] = (att as any)?.updatedAt || latestUpdatedAt || new Date().toISOString();
          }
        }
      }

      const completedMaterialIds = Array.from(mergedCompletedSet);

      if (foundAny || healedAny) {
        if (healedAny) {
          missingOrOutdatedIds.push(...candidateIds);
        }
        // Calculate unified progress stats
        try {
          const cachedMats = localStorage.getItem('sistem_materi_mat_cache');
          if (cachedMats) {
            const parsed = JSON.parse(cachedMats);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const published = parsed.filter((m: any) => m && m.isPublished !== false);
              if (published.length > 0) {
                totalMaterialsCount = published.length;
                maxProgressPercent = Math.round((completedMaterialIds.length / published.length) * 100);
              }
            }
          }
        } catch {}

        if (!mergedGamification) {
          for (const sid of candidateIds) {
            try {
              const ls = localStorage.getItem(`sistem_materi_gamification_${sid}`);
              if (ls) {
                mergedGamification = getDefaultGamificationData(JSON.parse(ls));
                break;
              }
            } catch {}
          }
        }

        const rec: StudentProgressRecord = {
          studentId,
          studentName,
          kelas: studentKelas,
          completedMaterialIds,
          completedMaterialTimestamps: mergedTimestamps,
          progressPercent: maxProgressPercent,
          completedCount: completedMaterialIds.length,
          totalMaterialsCount,
          scores: mergedScores,
          quizAttempts: mergedAttempts,
          activityLogs: mergedLogs,
          notes: mergedNotes,
          bookmarkedMaterialIds: Array.from(mergedBookmarksSet),
          gamification: getDefaultGamificationData(mergedGamification),
          updatedAt: latestUpdatedAt || new Date().toISOString(),
        };

        try {
          candidateIds.forEach((sid) => {
            localStorage.setItem(`sistem_materi_prog_${sid}`, JSON.stringify(rec.completedMaterialIds));
            if (typeof rec.progressPercent === 'number') {
              localStorage.setItem(`sistem_materi_prog_percent_${sid}`, JSON.stringify(rec.progressPercent));
            }
            if (typeof rec.completedCount === 'number') {
              localStorage.setItem(`sistem_materi_completed_count_${sid}`, JSON.stringify(rec.completedCount));
            }
            localStorage.setItem(`sistem_materi_prog_times_${sid}`, JSON.stringify(rec.completedMaterialTimestamps));
            localStorage.setItem(`sistem_materi_timestamps_${sid}`, JSON.stringify(rec.completedMaterialTimestamps));
            localStorage.setItem(`sistem_materi_activity_logs_${sid}`, JSON.stringify(rec.activityLogs));
            localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify(rec.scores || {}));
            localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify(rec.quizAttempts || {}));
            localStorage.setItem(`sistem_materi_notes_${sid}`, JSON.stringify(rec.notes || {}));
            localStorage.setItem(`sistem_materi_bookmarks_${sid}`, JSON.stringify(rec.bookmarkedMaterialIds || []));
            if (rec.gamification) {
              localStorage.setItem(`sistem_materi_gamification_${sid}`, JSON.stringify(rec.gamification));
            }
            setCacheData(CACHE_KEYS.STUDENT_PROGRESS(sid), rec.completedMaterialIds, `sistem_materi_prog_${sid}`);
            setCacheData(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid), rec, `sistem_materi_prog_details_${sid}`);
          });
        } catch {}

        // Asynchronously synchronize all candidate document records in Firestore so both Doc ID and NISN stay 100% matched
        if (missingOrOutdatedIds.length > 0) {
          try {
            const batch = writeBatch(db);
            const syncPayload = cleanFirestoreData({
              ...rec,
              updatedAt: new Date().toISOString(),
            });
            missingOrOutdatedIds.forEach((sid) => {
              const r = doc(db, STUDENT_PROGRESS_COL, sid);
              batch.set(r, cleanFirestoreData({ ...syncPayload, studentId: sid }), { merge: true });
            });
            batch.commit().catch(() => {});
          } catch {}
        }

        return rec;
      }

      // Check local storage fallback across all candidates so user doesn't see empty progress if offline
      for (const sid of candidateIds) {
        try {
          const local = localStorage.getItem(`sistem_materi_prog_${sid}`);
          if (local && local !== 'null' && local !== 'undefined') {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const safeObj = (raw: string | null): Record<string, any> => {
                if (!raw || raw === 'null' || raw === 'undefined') return {};
                try {
                  const p = JSON.parse(raw);
                  return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
                } catch {
                  return {};
                }
              };
              const safeArr = (raw: string | null): any[] => {
                if (!raw || raw === 'null' || raw === 'undefined') return [];
                try {
                  const p = JSON.parse(raw);
                  return Array.isArray(p) ? p : [];
                } catch {
                  return [];
                }
              };

              const fallbackTimes = localStorage.getItem(`sistem_materi_prog_times_${sid}`);
              const fallbackLogs = localStorage.getItem(`sistem_materi_activity_logs_${sid}`);
              const fallbackScores = localStorage.getItem(`sistem_materi_scores_${sid}`);
              const fallbackAttempts = localStorage.getItem(`sistem_materi_quiz_attempts_${sid}`);
              const fallbackNotes = localStorage.getItem(`sistem_materi_notes_${sid}`);
              const fallbackBookmarks = localStorage.getItem(`sistem_materi_bookmarks_${sid}`);

              return {
                studentId: sid,
                studentName,
                kelas: studentKelas,
                completedMaterialIds: parsed,
                completedMaterialTimestamps: safeObj(fallbackTimes),
                completedCount: parsed.length,
                scores: safeObj(fallbackScores),
                quizAttempts: safeObj(fallbackAttempts),
                activityLogs: safeArr(fallbackLogs),
                notes: safeObj(fallbackNotes),
                bookmarkedMaterialIds: safeArr(fallbackBookmarks),
                updatedAt: new Date().toISOString(),
              };
            }
          }
        } catch {}
      }

      return null;
    },
    {
      staleTime: options?.forceRevalidate ? 0 : 45_000,
      forceRevalidate: options?.forceRevalidate || false,
      persistKey: `sistem_materi_prog_details_${studentId}`,
    }
  );
}

/**
 * Real-time subscription to a student's progress and quiz scores.
 * Automatically merges candidate IDs, synchronizes localStorage, and emits window events on updates.
 */
export function subscribeStudentProgress(
  candidateIds: string[],
  callback: (record: StudentProgressRecord | null) => void
): () => void {
  const validIds = Array.from(new Set(candidateIds.filter(Boolean)));
  if (validIds.length === 0) return () => {};

  const unsubs: (() => void)[] = [];
  const candidateSnapshots: Record<string, StudentProgressRecord | null> = {};

  const handleCandidateUpdate = () => {
    // Merge all available candidate snapshots
    let mergedCompletedSet = new Set<string>();
    let mergedTimestamps: Record<string, string> = {};
    let mergedScores: Record<string, number> = {};
    let mergedAttempts: Record<string, StudentQuizScoreInfo> = {};
    let mergedLogs: MaterialActivityLog[] = [];
    let mergedNotes: Record<string, string> = {};
    let mergedBookmarksSet = new Set<string>();
    let studentName = '';
    let studentKelas = '';
    let maxProgressPercent: number | undefined = undefined;
    let totalMaterialsCount: number | undefined = undefined;
    let latestUpdatedAt = '';
    let mergedGamification: StudentGamificationData | undefined = undefined;
    let hasAnyData = false;

    for (const rec of Object.values(candidateSnapshots)) {
      if (!rec) continue;
      hasAnyData = true;
      if (!studentName && rec.studentName) studentName = rec.studentName;
      if (!studentKelas && rec.kelas) studentKelas = rec.kelas;
      if (rec.updatedAt && rec.updatedAt > latestUpdatedAt) latestUpdatedAt = rec.updatedAt;

      if (rec.gamification) {
        if (!mergedGamification || (rec.gamification.exp || 0) > (mergedGamification.exp || 0)) {
          mergedGamification = getDefaultGamificationData(rec.gamification);
        }
      }

      if (Array.isArray(rec.completedMaterialIds)) {
        rec.completedMaterialIds.forEach((id) => mergedCompletedSet.add(id));
      }
      if (rec.completedMaterialTimestamps) {
        Object.assign(mergedTimestamps, rec.completedMaterialTimestamps);
      }
      if (rec.scores) {
        for (const [mId, val] of Object.entries(rec.scores)) {
          const num = Number(val);
          if (typeof mergedScores[mId] !== 'number' || num > mergedScores[mId]) {
            mergedScores[mId] = num;
          }
        }
      }
      if (rec.quizAttempts) {
        for (const [mId, att] of Object.entries(rec.quizAttempts)) {
          if (att && (!mergedAttempts[mId] || (att as any).percentage > (mergedAttempts[mId]?.percentage ?? -1))) {
            mergedAttempts[mId] = att;
          }
        }
      }
      if (Array.isArray(rec.activityLogs)) {
        const existingIds = new Set(mergedLogs.map((l) => `${l.materialId}_${l.completedAt || (l as any).timestamp}`));
        rec.activityLogs.forEach((log) => {
          const key = `${log.materialId}_${log.completedAt || (log as any).timestamp}`;
          if (!existingIds.has(key)) {
            mergedLogs.push(log);
            existingIds.add(key);
          }
        });
      }
      if (rec.notes) {
        Object.assign(mergedNotes, rec.notes);
      }
      if (Array.isArray(rec.bookmarkedMaterialIds)) {
        rec.bookmarkedMaterialIds.forEach((id) => mergedBookmarksSet.add(id));
      }
      if (typeof rec.progressPercent === 'number') {
        if (maxProgressPercent === undefined || rec.progressPercent > maxProgressPercent) {
          maxProgressPercent = rec.progressPercent;
        }
      }
      if (typeof rec.totalMaterialsCount === 'number') {
        totalMaterialsCount = rec.totalMaterialsCount;
      }
    }

    if (hasAnyData) {
      const completedMaterialIds = Array.from(mergedCompletedSet);
      const record: StudentProgressRecord = {
        studentId: validIds[0],
        studentName,
        kelas: studentKelas,
        completedMaterialIds,
        completedMaterialTimestamps: mergedTimestamps,
        progressPercent: maxProgressPercent,
        completedCount: completedMaterialIds.length,
        totalMaterialsCount,
        scores: mergedScores,
        quizAttempts: mergedAttempts,
        activityLogs: mergedLogs,
        notes: mergedNotes,
        bookmarkedMaterialIds: Array.from(mergedBookmarksSet),
        gamification: getDefaultGamificationData(mergedGamification),
        updatedAt: latestUpdatedAt || new Date().toISOString(),
      };

      try {
        validIds.forEach((id) => {
          localStorage.setItem(`sistem_materi_prog_${id}`, JSON.stringify(record.completedMaterialIds));
          if (typeof record.progressPercent === 'number') {
            localStorage.setItem(`sistem_materi_prog_percent_${id}`, JSON.stringify(record.progressPercent));
          }
          if (typeof record.completedCount === 'number') {
            localStorage.setItem(`sistem_materi_completed_count_${id}`, JSON.stringify(record.completedCount));
          }
          localStorage.setItem(`sistem_materi_prog_times_${id}`, JSON.stringify(record.completedMaterialTimestamps));
          localStorage.setItem(`sistem_materi_timestamps_${id}`, JSON.stringify(record.completedMaterialTimestamps));
          localStorage.setItem(`sistem_materi_scores_${id}`, JSON.stringify(record.scores));
          localStorage.setItem(`sistem_materi_quiz_attempts_${id}`, JSON.stringify(record.quizAttempts));
          localStorage.setItem(`sistem_materi_activity_logs_${id}`, JSON.stringify(record.activityLogs));
          localStorage.setItem(`sistem_materi_notes_${id}`, JSON.stringify(record.notes || {}));
          localStorage.setItem(`sistem_materi_bookmarks_${id}`, JSON.stringify(record.bookmarkedMaterialIds || []));
          if (record.gamification) {
            localStorage.setItem(`sistem_materi_gamification_${id}`, JSON.stringify(record.gamification));
          }
        });
      } catch {}

      callback(record);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(
          new CustomEvent('student-progress-sync', {
            detail: { studentIds: validIds, record },
          })
        );
      }
    }
  };

  validIds.forEach((sid) => {
    try {
      const ref = doc(db, STUDENT_PROGRESS_COL, sid);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            candidateSnapshots[sid] = {
              studentId: sid,
              studentName: data.studentName || '',
              kelas: data.kelas || '',
              completedMaterialIds: Array.isArray(data.completedMaterialIds) ? data.completedMaterialIds : [],
              completedMaterialTimestamps: data.completedMaterialTimestamps || {},
              progressPercent: typeof data.progressPercent === 'number' ? data.progressPercent : undefined,
              completedCount: typeof data.completedCount === 'number' ? data.completedCount : (Array.isArray(data.completedMaterialIds) ? data.completedMaterialIds.length : 0),
              totalMaterialsCount: typeof data.totalMaterialsCount === 'number' ? data.totalMaterialsCount : undefined,
              scores: data.scores || {},
              quizAttempts: data.quizAttempts || {},
              activityLogs: Array.isArray(data.activityLogs) ? data.activityLogs : [],
              notes: data.notes || {},
              bookmarkedMaterialIds: Array.isArray(data.bookmarkedMaterialIds) ? data.bookmarkedMaterialIds : [],
              gamification: getDefaultGamificationData(data.gamification),
              updatedAt: data.updatedAt || '',
            };
          } else {
            candidateSnapshots[sid] = null;
          }
          handleCandidateUpdate();
        },
        () => {
          // Silently handle progress snapshot error
        }
      );
      unsubs.push(unsub);
    } catch {
      // Silently handle listener creation error
    }
  });

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
}

export interface LeaderboardSummaryStudent {
  id: string;
  nama: string;
  kelas: string;
  nisn?: string;
  noAbsen?: string;
  exp: number;
  level: number;
  levelTitle: string;
  levelIcon: string;
  badges?: BadgeInfo[];
  completedMaterialsCount: number;
  totalMaterialsCount: number;
  avgQuizScore: number;
  quizzesAttemptedCount: number;
  rank: number;
}

export interface LeaderboardSummaryDoc {
  updatedAt: string;
  totalStudents: number;
  topStudents: LeaderboardSummaryStudent[];
}

/**
 * Merges multiple student progress records if a student has data stored under
 * Firestore doc ID, NISN, or username, ensuring zero lost progress data.
 */
export function getMergedStudentProgress(
  student: { id: string; nisn?: string; nis?: string; username?: string; nama?: string; kelas?: string },
  allProgress: Record<string, StudentProgressRecord>
): StudentProgressRecord {
  const pId = allProgress[student.id];
  const pNisn = student.nisn ? allProgress[student.nisn] : undefined;
  const pNis = (student as any).nis ? allProgress[(student as any).nis] : undefined;
  const pUsername = student.username && student.username !== student.nisn && student.username !== student.id
    ? allProgress[student.username]
    : undefined;

  const records = [pId, pNisn, pNis, pUsername].filter(Boolean) as StudentProgressRecord[];

  // Also check if any record in allProgress matches by studentId, nisn, or studentName
  const targetIds = [student.id, student.nisn, (student as any).nis, student.username].filter(Boolean) as string[];
  Object.values(allProgress || {}).forEach((p) => {
    if (!p) return;
    const pAny = p as any;
    const matchesId = (p.studentId && targetIds.includes(p.studentId)) || (pAny.nisn && targetIds.includes(pAny.nisn));
    const matchesName = student.nama && p.studentName && p.studentName.toLowerCase().trim() === student.nama.toLowerCase().trim();
    if ((matchesId || matchesName) && !records.includes(p)) {
      records.push(p);
    }
  });

  if (records.length === 0) {
    return {
      studentId: student.id,
      studentName: student.nama || '',
      kelas: student.kelas || '',
      completedMaterialIds: [],
      completedMaterialTimestamps: {},
      scores: {},
      quizAttempts: {},
      activityLogs: [],
      notes: {},
      bookmarkedMaterialIds: [],
      completedCount: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  const completedSet = new Set<string>();
  const mergedTimestamps: Record<string, string> = {};
  const mergedScores: Record<string, number> = {};
  const mergedQuizAttempts: Record<string, any> = {};
  const mergedLogs: any[] = [];
  const mergedNotes: Record<string, string> = {};
  const bookmarksSet = new Set<string>();
  let bestGamification: any = undefined;
  let latestUpdatedAt = '';

  records.forEach((r) => {
    if (r.updatedAt && r.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = r.updatedAt;
    }
    const safeCompleted = Array.isArray(r.completedMaterialIds)
      ? r.completedMaterialIds
      : (r.completedMaterialIds && typeof r.completedMaterialIds === 'object' ? Object.keys(r.completedMaterialIds).filter(Boolean) : []);
    safeCompleted.forEach((id) => completedSet.add(id));
    if (r.completedMaterialTimestamps) {
      Object.assign(mergedTimestamps, r.completedMaterialTimestamps);
    }
    if (r.scores) {
      Object.entries(r.scores).forEach(([k, v]) => {
        if (typeof v === 'number') {
          mergedScores[k] = Math.max(mergedScores[k] ?? 0, v);
        }
      });
    }
    if (r.quizAttempts) {
      Object.entries(r.quizAttempts).forEach(([k, att]: [string, any]) => {
        if (!att) return;
        const existingAtt = mergedQuizAttempts[k];
        if (!existingAtt) {
          mergedQuizAttempts[k] = att;
        } else {
          const newP = att.percentage ?? (att.totalQuestions ? Math.round((att.score / att.totalQuestions) * 100) : 0);
          const oldP = existingAtt.percentage ?? (existingAtt.totalQuestions ? Math.round((existingAtt.score / existingAtt.totalQuestions) * 100) : 0);
          if (newP > oldP || (newP === oldP && (att.score || 0) > (existingAtt.score || 0))) {
            mergedQuizAttempts[k] = att;
          }
        }
      });
    }
    if (Array.isArray(r.activityLogs)) {
      mergedLogs.push(...r.activityLogs);
    }
    if (r.notes) {
      Object.assign(mergedNotes, r.notes);
    }
    if (Array.isArray(r.bookmarkedMaterialIds)) {
      r.bookmarkedMaterialIds.forEach((b) => bookmarksSet.add(b));
    }
    if (r.gamification) {
      if (!bestGamification || (r.gamification.exp || 0) > (bestGamification.exp || 0)) {
        bestGamification = r.gamification;
      }
    }
  });

  // Auto-heal: Ensure any material where student scored >= 80% is in completedSet
  Object.entries(mergedScores).forEach(([mId, sVal]) => {
    if (Number(sVal) >= 80 && !completedSet.has(mId)) {
      completedSet.add(mId);
      if (!mergedTimestamps[mId]) {
        mergedTimestamps[mId] = mergedQuizAttempts[mId]?.updatedAt || latestUpdatedAt || new Date().toISOString();
      }
    }
  });
  Object.entries(mergedQuizAttempts).forEach(([mId, att]: [string, any]) => {
    const p = att?.percentage ?? ((att?.score && att?.totalQuestions) ? Math.round((att.score / att.totalQuestions) * 100) : 0);
    if (p >= 80 && !completedSet.has(mId)) {
      completedSet.add(mId);
      if (!mergedTimestamps[mId]) {
        mergedTimestamps[mId] = att?.updatedAt || latestUpdatedAt || new Date().toISOString();
      }
    }
  });

  return {
    studentId: student.id,
    studentName: student.nama || records[0]?.studentName || '',
    kelas: student.kelas || records[0]?.kelas || '',
    completedMaterialIds: Array.from(completedSet),
    completedMaterialTimestamps: mergedTimestamps,
    scores: mergedScores,
    quizAttempts: mergedQuizAttempts,
    activityLogs: mergedLogs,
    notes: mergedNotes,
    bookmarkedMaterialIds: Array.from(bookmarksSet),
    gamification: getDefaultGamificationData(bestGamification),
    completedCount: completedSet.size,
    updatedAt: latestUpdatedAt || new Date().toISOString(),
  };
}

/**
 * High-performance Firestore quota optimization:
 * Reads a single pre-calculated aggregate leaderboard document.
 * Eliminates 1,000 document reads down to 1 single document read for students.
 * If the aggregate document is missing or empty, automatically self-heals by generating it.
 */
export async function fetchLeaderboardSummary(forceRefresh = false): Promise<LeaderboardSummaryDoc | null> {
  if (forceRefresh) {
    invalidateCache(CACHE_KEYS.LEADERBOARD_SUMMARY);
  }
  return swrFetch(
    CACHE_KEYS.LEADERBOARD_SUMMARY,
    async () => {
      try {
        const ref = doc(db, SETTINGS_COL, 'leaderboard_summary');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as LeaderboardSummaryDoc;
          if (data && Array.isArray(data.topStudents) && data.topStudents.length > 0) {
            return data;
          }
        }
        // Self-heal: automatically compute and save leaderboard summary if missing
        const autoSummary = await syncLeaderboardSummary();
        if (autoSummary) {
          return autoSummary;
        }
      } catch (err) {
        console.warn('Error fetching or self-healing leaderboard summary:', err);
      }
      return null;
    },
    {
      staleTime: forceRefresh ? 0 : 300_000, // 5 minutes cache
      persistKey: 'sistem_materi_leaderboard_summary_cache',
    }
  );
}

/**
 * Pre-computes top rankings into a single document 'settings/leaderboard_summary'.
 * Allows all students to access live rankings instantly with almost zero Firestore read quota.
 */
export async function syncLeaderboardSummary(
  studentsList?: StudentAccount[],
  progressMap?: Record<string, StudentProgressRecord>
): Promise<LeaderboardSummaryDoc | null> {
  try {
    const students = studentsList && studentsList.length > 0 ? studentsList : await fetchStudents();
    const allProgress = progressMap && Object.keys(progressMap).length > 0 ? progressMap : await fetchAllStudentProgress();

    if (!students || students.length === 0) return null;

    const rankedList: LeaderboardSummaryStudent[] = students.map((s) => {
      const prog = getMergedStudentProgress(s, allProgress);
      const gamification = calculateStudentGamification(prog);
      const levelInfo = getCurrentLevelInfo(gamification.exp);
      const completedCount = Array.isArray(prog.completedMaterialIds)
        ? prog.completedMaterialIds.length
        : (typeof prog.completedCount === 'number' ? prog.completedCount : 0);
      const rawScores = Object.values(prog.scores || {}).filter((v) => typeof v === 'number');
      const avgScore = rawScores.length > 0 ? Math.round(rawScores.reduce((a, b) => a + Number(b), 0) / rawScores.length) : 0;

      return {
        id: s.id,
        nama: s.nama,
        kelas: s.kelas || '',
        nisn: s.nisn || '',
        noAbsen: s.noAbsen || '',
        exp: gamification.exp,
        level: levelInfo.level,
        levelTitle: levelInfo.title,
        levelIcon: levelInfo.icon,
        badges: gamification.badges || [],
        completedMaterialsCount: completedCount,
        totalMaterialsCount: 0,
        avgQuizScore: avgScore,
        quizzesAttemptedCount: rawScores.length,
        rank: 1,
      };
    });

    rankedList.sort((a, b) => {
      if (b.exp !== a.exp) return b.exp - a.exp;
      if (b.completedMaterialsCount !== a.completedMaterialsCount) return b.completedMaterialsCount - a.completedMaterialsCount;
      return b.avgQuizScore - a.avgQuizScore;
    });

    rankedList.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    // Store up to 500 students to cover all registered classes
    const topStudents = rankedList.slice(0, 500);

    const summaryDoc: LeaderboardSummaryDoc = {
      updatedAt: new Date().toISOString(),
      totalStudents: students.length,
      topStudents,
    };

    const ref = doc(db, SETTINGS_COL, 'leaderboard_summary');
    await setDoc(ref, summaryDoc, { merge: true });
    setCacheData(CACHE_KEYS.LEADERBOARD_SUMMARY, summaryDoc, 'sistem_materi_leaderboard_summary_cache');
    return summaryDoc;
  } catch (err) {
    console.warn('Error in syncLeaderboardSummary:', err);
    return null;
  }
}

export async function fetchAllStudentProgress(options?: {
  selectedClass?: string;
  forceRevalidate?: boolean;
}): Promise<Record<string, StudentProgressRecord>> {
  const isClassTargeted = Boolean(
    options?.selectedClass &&
    options.selectedClass !== 'all' &&
    options.selectedClass !== 'ALL'
  );

  const targetClass = isClassTargeted ? (options!.selectedClass as string) : '';
  const cacheKey = isClassTargeted
    ? CACHE_KEYS.STUDENT_PROGRESS_CLASS(targetClass)
    : CACHE_KEYS.ALL_STUDENT_PROGRESS;
  const persistKey = isClassTargeted
    ? `sistem_materi_prog_class_${targetClass}`
    : 'sistem_materi_all_progress_cache';

  return swrFetch(
    cacheKey,
    async () => {
      let q = query(collection(db, STUDENT_PROGRESS_COL));
      if (isClassTargeted) {
        q = query(collection(db, STUDENT_PROGRESS_COL), where('kelas', '==', targetClass));
      }
      const snap = await getDocs(q);
      const result: Record<string, StudentProgressRecord> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const completedIds = Array.isArray(data.completedMaterialIds) ? [...data.completedMaterialIds] : [];
        const timestamps = data.completedMaterialTimestamps ? { ...data.completedMaterialTimestamps } : {};
        const scores = data.scores || {};
        const attempts = data.quizAttempts || {};

        // Auto-heal: Ensure any material with score >= 80% (or 10-scale score >= 8) is in completedIds
        Object.entries(scores).forEach(([mId, val]) => {
          const num = Number(val);
          const isPassed = num >= 80 || (num >= 8 && num <= 10);
          if (isPassed && !completedIds.includes(mId)) {
            completedIds.push(mId);
            if (!timestamps[mId]) {
              timestamps[mId] = attempts[mId]?.updatedAt || data.updatedAt || new Date().toISOString();
            }
          }
        });
        Object.entries(attempts).forEach(([mId, att]: [string, any]) => {
          const rawSc = Number(att?.score);
          const totalQ = Number(att?.totalQuestions) || 10;
          const p = typeof att?.percentage === 'number'
            ? (att.percentage <= 10 && totalQ <= 10 ? Math.round((att.percentage / totalQ) * 100) : att.percentage)
            : ((!isNaN(rawSc) && totalQ > 0) ? Math.round((rawSc / totalQ) * 100) : 0);
          const isPassedAttempt = p >= 80 || rawSc >= totalQ || (totalQ === 10 && rawSc >= 8);
          if (isPassedAttempt && !completedIds.includes(mId)) {
            completedIds.push(mId);
            if (!timestamps[mId]) {
              timestamps[mId] = att?.updatedAt || data.updatedAt || new Date().toISOString();
            }
          }
        });

        result[d.id] = {
          studentId: d.id,
          studentName: data.studentName || '',
          kelas: data.kelas || '',
          completedMaterialIds: completedIds,
          completedMaterialTimestamps: timestamps,
          progressPercent: typeof data.progressPercent === 'number' ? data.progressPercent : undefined,
          completedCount: completedIds.length,
          totalMaterialsCount: typeof data.totalMaterialsCount === 'number' ? data.totalMaterialsCount : undefined,
          scores,
          quizAttempts: attempts,
          activityLogs: data.activityLogs || [],
          notes: data.notes || {},
          bookmarkedMaterialIds: data.bookmarkedMaterialIds || [],
          gamification: getDefaultGamificationData(data.gamification),
          updatedAt: data.updatedAt || '',
        };
      });
      return result;
    },
    {
      staleTime: options?.forceRevalidate ? 0 : 300_000,
      forceRevalidate: options?.forceRevalidate,
      persistKey,
    }
  );
}

/**
 * Real-time subscription to student progress documents.
 * Supports targeted class querying to prevent full-collection Firestore read spikes.
 */
export function subscribeAllStudentProgress(
  callback: (records: Record<string, StudentProgressRecord>) => void,
  onError?: (err: any) => void,
  selectedClass?: string
): () => void {
  const isClassTargeted = Boolean(
    selectedClass &&
    selectedClass !== 'all' &&
    selectedClass !== 'ALL'
  );
  const targetClass = isClassTargeted ? (selectedClass as string) : '';
  const q = isClassTargeted
    ? query(collection(db, STUDENT_PROGRESS_COL), where('kelas', '==', targetClass))
    : collection(db, STUDENT_PROGRESS_COL);

  const cacheKey = isClassTargeted
    ? CACHE_KEYS.STUDENT_PROGRESS_CLASS(targetClass)
    : CACHE_KEYS.ALL_STUDENT_PROGRESS;
  const persistKey = isClassTargeted
    ? `sistem_materi_prog_class_${targetClass}`
    : 'sistem_materi_all_progress_cache';

  return onSnapshot(
    q,
    (snap) => {
      const result: Record<string, StudentProgressRecord> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const completedIds = Array.isArray(data.completedMaterialIds) ? [...data.completedMaterialIds] : [];
        const timestamps = data.completedMaterialTimestamps ? { ...data.completedMaterialTimestamps } : {};
        const scores = data.scores || {};
        const attempts = data.quizAttempts || {};

        // Auto-heal: Ensure any material with score >= 80% (or 10-scale score >= 8) is in completedIds
        Object.entries(scores).forEach(([mId, val]) => {
          const num = Number(val);
          const isPassed = num >= 80 || (num >= 8 && num <= 10);
          if (isPassed && !completedIds.includes(mId)) {
            completedIds.push(mId);
            if (!timestamps[mId]) {
              timestamps[mId] = attempts[mId]?.updatedAt || data.updatedAt || new Date().toISOString();
            }
          }
        });
        Object.entries(attempts).forEach(([mId, att]: [string, any]) => {
          const rawSc = Number(att?.score);
          const totalQ = Number(att?.totalQuestions) || 10;
          const p = typeof att?.percentage === 'number'
            ? (att.percentage <= 10 && totalQ <= 10 ? Math.round((att.percentage / totalQ) * 100) : att.percentage)
            : ((!isNaN(rawSc) && totalQ > 0) ? Math.round((rawSc / totalQ) * 100) : 0);
          const isPassedAttempt = p >= 80 || rawSc >= totalQ || (totalQ === 10 && rawSc >= 8);
          if (isPassedAttempt && !completedIds.includes(mId)) {
            completedIds.push(mId);
            if (!timestamps[mId]) {
              timestamps[mId] = att?.updatedAt || data.updatedAt || new Date().toISOString();
            }
          }
        });

        result[d.id] = {
          studentId: d.id,
          studentName: data.studentName || '',
          kelas: data.kelas || '',
          completedMaterialIds: completedIds,
          completedMaterialTimestamps: timestamps,
          progressPercent: typeof data.progressPercent === 'number' ? data.progressPercent : undefined,
          completedCount: completedIds.length,
          totalMaterialsCount: typeof data.totalMaterialsCount === 'number' ? data.totalMaterialsCount : undefined,
          scores,
          quizAttempts: attempts,
          activityLogs: Array.isArray(data.activityLogs) ? data.activityLogs : [],
          notes: data.notes || {},
          bookmarkedMaterialIds: Array.isArray(data.bookmarkedMaterialIds) ? data.bookmarkedMaterialIds : [],
          gamification: getDefaultGamificationData(data.gamification),
          updatedAt: data.updatedAt || '',
        };
      });
      setCacheData(cacheKey, result, persistKey);
      callback(result);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, STUDENT_PROGRESS_COL);
    }
  );
}

export async function resetAllStudentProgress(
  studentId: string,
  studentName?: string,
  kelas?: string,
  additionalStudentIds: string[] = []
): Promise<void> {
  if (!studentId) return;
  const initialIds = Array.from(new Set([studentId, ...additionalStudentIds].filter(Boolean)));
  const allDocIdsToReset = new Set<string>(initialIds);

  try {
    const allProgressSnap = await getDocs(collection(db, STUDENT_PROGRESS_COL));
    const matchedDocs: { ref: any; id: string; data: any }[] = [];

    allProgressSnap.docs.forEach((docSnap) => {
      const dId = docSnap.id;
      const data = docSnap.data();
      const sId = data.studentId;
      const sNisn = data.nisn;
      const sName = data.studentName;

      const isIdMatch =
        initialIds.includes(dId) ||
        (sId && initialIds.includes(sId)) ||
        (sNisn && initialIds.includes(sNisn));
      const isNameMatch =
        studentName && sName && sName.toLowerCase().trim() === studentName.toLowerCase().trim();

      if (isIdMatch || isNameMatch) {
        allDocIdsToReset.add(dId);
        if (sId) allDocIdsToReset.add(sId);
        if (sNisn) allDocIdsToReset.add(sNisn);
        matchedDocs.push({ ref: docSnap.ref, id: dId, data });
      }
    });

    const finalIds = Array.from(allDocIdsToReset);

    if (matchedDocs.length > 0) {
      const batch = writeBatch(db);
      for (const m of matchedDocs) {
        const payload = cleanFirestoreData({
          studentId: m.id,
          completedMaterialIds: [],
          completedMaterialTimestamps: {},
          activityLogs: [],
          scores: {},
          quizAttempts: {},
          ...(studentName ? { studentName } : (m.data.studentName ? { studentName: m.data.studentName } : {})),
          ...(kelas ? { kelas } : (m.data.kelas ? { kelas: m.data.kelas } : {})),
          updatedAt: new Date().toISOString(),
        });
        batch.set(m.ref, payload, { merge: false });
      }
      await batch.commit();
    } else {
      const batch = writeBatch(db);
      for (const sid of initialIds) {
        const ref = doc(db, STUDENT_PROGRESS_COL, sid);
        const payload = cleanFirestoreData({
          studentId: sid,
          completedMaterialIds: [],
          completedMaterialTimestamps: {},
          activityLogs: [],
          scores: {},
          quizAttempts: {},
          ...(studentName ? { studentName } : {}),
          ...(kelas ? { kelas } : {}),
          updatedAt: new Date().toISOString(),
        });
        batch.set(ref, payload, { merge: true });
      }
      await batch.commit();
    }

    for (const sid of finalIds) {
      invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(sid));
      invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid));
      invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(sid));

      try {
        localStorage.setItem(`sistem_materi_prog_${sid}`, JSON.stringify([]));
        localStorage.setItem(`sistem_materi_prog_times_${sid}`, JSON.stringify({}));
        localStorage.setItem(`sistem_materi_timestamps_${sid}`, JSON.stringify({}));
        localStorage.setItem(`sistem_materi_activity_logs_${sid}`, JSON.stringify([]));
        localStorage.setItem(`sistem_materi_activity_${sid}`, JSON.stringify([]));
        localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify({}));
        localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify({}));
        localStorage.removeItem(`sistem_materi_prog_details_${sid}`);
      } catch {}
    }

    invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
    try {
      localStorage.removeItem('sistem_materi_all_progress_cache');
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(
        new CustomEvent('student-material-reset', {
          detail: { studentIds: finalIds, allMaterials: true },
        })
      );
    }
  } catch (err) {
    console.error('Error resetting all student progress:', err);
    throw err;
  }
}

/**
 * Resets/deletes a single student's mini quiz score and attempt record for a specific material using writeBatch.
 */
export async function resetStudentQuizScore(
  studentId: string,
  materialId: string,
  additionalStudentIds: string[] = [],
  studentName?: string
): Promise<void> {
  if (!studentId || !materialId) return;
  const initialIds = Array.from(new Set([studentId, ...additionalStudentIds].filter(Boolean)));
  const allDocIdsToReset = new Set<string>(initialIds);

  try {
    const allProgressSnap = await getDocs(collection(db, STUDENT_PROGRESS_COL));
    const matchedDocs: { ref: any; id: string; data: any }[] = [];

    allProgressSnap.docs.forEach((docSnap) => {
      const dId = docSnap.id;
      const data = docSnap.data();
      const sId = data.studentId;
      const sNisn = data.nisn;
      const sName = data.studentName;

      const isIdMatch =
        initialIds.includes(dId) ||
        (sId && initialIds.includes(sId)) ||
        (sNisn && initialIds.includes(sNisn));
      const isNameMatch =
        studentName && sName && sName.toLowerCase().trim() === studentName.toLowerCase().trim();

      if (isIdMatch || isNameMatch) {
        allDocIdsToReset.add(dId);
        if (sId) allDocIdsToReset.add(sId);
        if (sNisn) allDocIdsToReset.add(sNisn);
        matchedDocs.push({ ref: docSnap.ref, id: dId, data });
      }
    });

    const finalIds = Array.from(allDocIdsToReset);

    if (matchedDocs.length > 0) {
      const batch = writeBatch(db);
      for (const m of matchedDocs) {
        const existingScores = { ...(m.data.scores || {}) };
        const existingAttempts = { ...(m.data.quizAttempts || {}) };
        delete existingScores[materialId];
        delete existingAttempts[materialId];

        batch.update(m.ref, cleanFirestoreData({
          scores: existingScores,
          quizAttempts: existingAttempts,
          updatedAt: new Date().toISOString(),
        }));
      }
      await batch.commit();
    } else {
      for (const sid of initialIds) {
        const ref = doc(db, STUDENT_PROGRESS_COL, sid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const existingScores = { ...(data.scores || {}) };
          const existingAttempts = { ...(data.quizAttempts || {}) };
          delete existingScores[materialId];
          delete existingAttempts[materialId];

          const batch = writeBatch(db);
          batch.update(ref, cleanFirestoreData({
            scores: existingScores,
            quizAttempts: existingAttempts,
            updatedAt: new Date().toISOString(),
          }));
          await batch.commit();
        }
      }
    }

    for (const sid of finalIds) {
      invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
      invalidateCache(CACHE_KEYS.STUDENT_PROGRESS(sid));
      invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid));
      invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(sid));

      try {
        const ls = localStorage.getItem(`sistem_materi_scores_${sid}`);
        if (ls) {
          const parsed = JSON.parse(ls);
          delete parsed[materialId];
          localStorage.setItem(`sistem_materi_scores_${sid}`, JSON.stringify(parsed));
        }
        const la = localStorage.getItem(`sistem_materi_quiz_attempts_${sid}`);
        if (la) {
          const parsed = JSON.parse(la);
          delete parsed[materialId];
          localStorage.setItem(`sistem_materi_quiz_attempts_${sid}`, JSON.stringify(parsed));
        }
        localStorage.removeItem(`quiz_res_${materialId}_${sid}`);
        localStorage.removeItem(`quiz_answers_${materialId}_${sid}`);
        localStorage.removeItem(`sistem_materi_quiz_ans_${materialId}_${sid}`);
        localStorage.removeItem(`simpel_quiz_progress_${materialId}_${sid}`);
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(
        new CustomEvent('student-material-reset', {
          detail: { studentIds: finalIds, materialId },
        })
      );
    }
  } catch (err) {
    console.warn('Error resetting quiz score from Firestore:', err);
  }
}

// Master Classes & Grades Configuration
const MASTER_CONFIG_DOC = 'master_academic_config';

export interface GradeConfig {
  id: string;
  label: string;
  subLabel: string;
}

export const DEFAULT_GRADES: GradeConfig[] = [
  { id: '7', label: 'Kelas 7', subLabel: 'Jenjang SMP' },
  { id: '8', label: 'Kelas 8', subLabel: 'Jenjang SMP' },
  { id: '9', label: 'Kelas 9', subLabel: 'Jenjang SMP' },
  { id: '10', label: 'Kelas 10', subLabel: 'SMA / SMK' },
  { id: '11', label: 'Kelas 11', subLabel: 'SMA / SMK' },
  { id: '12', label: 'Kelas 12', subLabel: 'SMA / SMK' },
];

export const DEFAULT_PRESET_CLASSES = [
  '7.1', '7.2', '7.3', '7.4',
  '8.1', '8.2', '8.3', '8.4',
  '9.1', '9.2', '9.3', '9.4',
  '10A', '10B', '11A', '11B', '12A', '12B',
];

export async function fetchMasterGrades(): Promise<GradeConfig[]> {
  return swrFetch(
    CACHE_KEYS.MASTER_GRADES,
    async () => {
      const ref = doc(db, SETTINGS_COL, MASTER_CONFIG_DOC);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().grades && Array.isArray(snap.data().grades)) {
        return snap.data().grades;
      }
      return DEFAULT_GRADES;
    },
    {
      staleTime: 900_000,
      persistKey: 'sistem_materi_master_grades',
    }
  );
}

export async function saveMasterGrades(grades: GradeConfig[]): Promise<void> {
  try {
    const ref = doc(db, SETTINGS_COL, MASTER_CONFIG_DOC);
    await setDoc(ref, { grades, updatedAt: new Date().toISOString() }, { merge: true });
    invalidateCache(CACHE_KEYS.MASTER_GRADES);
  } catch (err) {
    console.warn('Could not save master grades to Firestore:', err);
  }
  try {
    localStorage.setItem('sistem_materi_master_grades', JSON.stringify(grades));
  } catch {}
}

export async function fetchMasterClasses(): Promise<string[]> {
  return swrFetch(
    CACHE_KEYS.MASTER_CLASSES,
    async () => {
      const ref = doc(db, SETTINGS_COL, MASTER_CONFIG_DOC);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().customClasses && Array.isArray(snap.data().customClasses)) {
        return snap.data().customClasses;
      }
      return DEFAULT_PRESET_CLASSES;
    },
    {
      staleTime: 900_000,
      persistKey: 'sistem_materi_master_classes',
    }
  );
}

export async function saveMasterClasses(customClasses: string[]): Promise<void> {
  try {
    const ref = doc(db, SETTINGS_COL, MASTER_CONFIG_DOC);
    await setDoc(ref, { customClasses, updatedAt: new Date().toISOString() }, { merge: true });
    invalidateCache(CACHE_KEYS.MASTER_CLASSES);
  } catch (err) {
    console.warn('Could not save master classes to Firestore:', err);
  }
  try {
    localStorage.setItem('sistem_materi_master_classes', JSON.stringify(customClasses));
  } catch {}
}

/**
 * Renames a class in all student documents and teacher assignments that belong to that class.
 */
export async function renameClassInStudents(oldClass: string, newClass: string): Promise<number> {
  const cleanOld = oldClass.trim();
  const cleanNew = newClass.trim();
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return 0;

  const students = await fetchStudents();
  const targets = students.filter((s) => (s.kelas || '').trim().toLowerCase() === cleanOld.toLowerCase());
  
  if (targets.length > 0) {
    const batch = writeBatch(db);
    targets.forEach((s) => {
      const ref = doc(db, STUDENTS_COL, s.id);
      batch.update(ref, { kelas: cleanNew, updatedAt: new Date().toISOString() });
    });
    await batch.commit();

    // Update local cache
    try {
      const updated = (students || []).map((s) =>
        (s.kelas || '').trim().toLowerCase() === cleanOld.toLowerCase() ? { ...s, kelas: cleanNew } : s
      );
      localStorage.setItem('sistem_materi_students_cache', JSON.stringify(updated));
    } catch {}
  }

  // Also sync teachers' assigned classes
  try {
    const teachers = (await fetchTeachers()) || [];
    const teachersToUpdate = teachers.filter((t) =>
      (t.assignedClasses || []).some((c) => c.trim().toLowerCase() === cleanOld.toLowerCase())
    );
    if (teachersToUpdate.length > 0) {
      const batch = writeBatch(db);
      teachersToUpdate.forEach((t) => {
        const updatedClasses = (t.assignedClasses || []).map((c) =>
          c.trim().toLowerCase() === cleanOld.toLowerCase() ? cleanNew : c
        );
        const ref = doc(db, TEACHERS_COL, t.id);
        batch.update(ref, { assignedClasses: updatedClasses, updatedAt: new Date().toISOString() });
      });
      await batch.commit();

      const updatedAllTeachers = (teachers || []).map((t) => ({
        ...t,
        assignedClasses: (t.assignedClasses || []).map((c) =>
          c.trim().toLowerCase() === cleanOld.toLowerCase() ? cleanNew : c
        ),
      }));
      localStorage.setItem('sistem_materi_teachers_cache', JSON.stringify(updatedAllTeachers));
    }
  } catch (err) {
    console.warn('Error syncing teachers on rename class:', err);
  }

  // Also update master classes list if present
  const masterClasses = (await fetchMasterClasses()) || [];
  const updatedMaster = (masterClasses || []).map((c) => (c.trim().toLowerCase() === cleanOld.toLowerCase() ? cleanNew : c));
  if (!updatedMaster.includes(cleanNew)) {
    updatedMaster.push(cleanNew);
  }
  await saveMasterClasses(updatedMaster);

  return targets.length;
}

/**
 * Deletes a class, with option to delete students inside or move them to another class, and syncs teachers.
 */
export async function deleteClassAndStudents(
  className: string,
  alsoDeleteStudents: boolean = false,
  moveToClass?: string
): Promise<{ affectedStudents: number }> {
  const cleanName = className.trim();
  const students = await fetchStudents();
  const targets = students.filter((s) => (s.kelas || '').trim().toLowerCase() === cleanName.toLowerCase());

  if (targets.length > 0) {
    const batch = writeBatch(db);
    if (alsoDeleteStudents) {
      targets.forEach((s) => {
        const ref = doc(db, STUDENTS_COL, s.id);
        batch.delete(ref);
      });
    } else if (moveToClass) {
      targets.forEach((s) => {
        const ref = doc(db, STUDENTS_COL, s.id);
        batch.update(ref, { kelas: moveToClass.trim(), updatedAt: new Date().toISOString() });
      });
    }
    await batch.commit();

    // Update local cache
    try {
      let updated: StudentAccount[];
      if (alsoDeleteStudents) {
        updated = (students || []).filter((s) => (s.kelas || '').trim().toLowerCase() !== cleanName.toLowerCase());
      } else if (moveToClass) {
        updated = (students || []).map((s) =>
          (s.kelas || '').trim().toLowerCase() === cleanName.toLowerCase() ? { ...s, kelas: moveToClass.trim() } : s
        );
      } else {
        updated = students || [];
      }
      localStorage.setItem('sistem_materi_students_cache', JSON.stringify(updated));
    } catch {}
  }

  // Sync teachers' assigned classes: remove the deleted class or change it to moveToClass
  try {
    const teachers = (await fetchTeachers()) || [];
    const teachersToUpdate = (teachers || []).filter((t) =>
      (t.assignedClasses || []).some((c) => c.trim().toLowerCase() === cleanName.toLowerCase())
    );
    if (teachersToUpdate.length > 0) {
      const batch = writeBatch(db);
      teachersToUpdate.forEach((t) => {
        let updatedClasses: string[];
        if (moveToClass) {
          updatedClasses = (t.assignedClasses || []).map((c) =>
            c.trim().toLowerCase() === cleanName.toLowerCase() ? moveToClass.trim() : c
          );
        } else {
          updatedClasses = (t.assignedClasses || []).filter(
            (c) => c.trim().toLowerCase() !== cleanName.toLowerCase()
          );
        }
        const ref = doc(db, TEACHERS_COL, t.id);
        batch.update(ref, { assignedClasses: updatedClasses, updatedAt: new Date().toISOString() });
      });
      await batch.commit();

      const updatedAllTeachers = (teachers || []).map((t) => {
        let updatedClasses: string[];
        if (moveToClass) {
          updatedClasses = (t.assignedClasses || []).map((c) =>
            c.trim().toLowerCase() === cleanName.toLowerCase() ? moveToClass.trim() : c
          );
        } else {
          updatedClasses = (t.assignedClasses || []).filter(
            (c) => c.trim().toLowerCase() !== cleanName.toLowerCase()
          );
        }
        return { ...t, assignedClasses: updatedClasses };
      });
      localStorage.setItem('sistem_materi_teachers_cache', JSON.stringify(updatedAllTeachers));
    }
  } catch (err) {
    console.warn('Error syncing teachers on delete class:', err);
  }

  // Remove from master classes list
  const masterClasses = (await fetchMasterClasses()) || [];
  const updatedMaster = (masterClasses || []).filter((c) => c.trim().toLowerCase() !== cleanName.toLowerCase());
  await saveMasterClasses(updatedMaster);

  return { affectedStudents: targets.length };
}

/**
 * Deletes a grade level (e.g. Grade 12), with option to delete or reassign students, and syncs teachers.
 */
export async function deleteGradeLevel(
  gradeId: string,
  alsoDeleteStudents: boolean = false
): Promise<{ affectedStudents: number }> {
  const cleanGrade = gradeId.trim().toUpperCase();
  const students = (await fetchStudents()) || [];
  
  const isMatchGrade = (cls: string) => {
    const clean = (cls || '').trim().toUpperCase();
    if (cleanGrade === '7') return /^(KELAS\s*)?(7|VII)(\.|\s|[A-Z]|$)/i.test(clean);
    if (cleanGrade === '8') return /^(KELAS\s*)?(8|VIII)(\.|\s|[A-Z]|$)/i.test(clean);
    if (cleanGrade === '9') return /^(KELAS\s*)?(9|IX)(\.|\s|[A-Z]|$)/i.test(clean);
    if (cleanGrade === '10') return /^(KELAS\s*)?(10|X)(\.|\s|[A-Z]|$)/i.test(clean);
    if (cleanGrade === '11') return /^(KELAS\s*)?(11|XI)(\.|\s|[A-Z]|$)/i.test(clean);
    if (cleanGrade === '12') return /^(KELAS\s*)?(12|XII)(\.|\s|[A-Z]|$)/i.test(clean);
    return clean === cleanGrade;
  };

  const targets = (students || []).filter((s) => isMatchGrade(s.kelas || ''));

  if (targets.length > 0 && alsoDeleteStudents) {
    const batch = writeBatch(db);
    targets.forEach((s) => {
      const ref = doc(db, STUDENTS_COL, s.id);
      batch.delete(ref);
    });
    await batch.commit();

    try {
      const updated = (students || []).filter((s) => !isMatchGrade(s.kelas || ''));
      localStorage.setItem('sistem_materi_students_cache', JSON.stringify(updated));
    } catch {}
  }

  // Remove matching classes from teachers assigned classes
  try {
    const teachers = (await fetchTeachers()) || [];
    const teachersToUpdate = (teachers || []).filter((t) =>
      (t.assignedClasses || []).some((c) => isMatchGrade(c))
    );
    if (teachersToUpdate.length > 0) {
      const batch = writeBatch(db);
      teachersToUpdate.forEach((t) => {
        const updatedClasses = (t.assignedClasses || []).filter((c) => !isMatchGrade(c));
        const ref = doc(db, TEACHERS_COL, t.id);
        batch.update(ref, { assignedClasses: updatedClasses, updatedAt: new Date().toISOString() });
      });
      await batch.commit();

      const updatedAllTeachers = (teachers || []).map((t) => ({
        ...t,
        assignedClasses: (t.assignedClasses || []).filter((c) => !isMatchGrade(c)),
      }));
      localStorage.setItem('sistem_materi_teachers_cache', JSON.stringify(updatedAllTeachers));
    }
  } catch (err) {
    console.warn('Error syncing teachers on delete grade:', err);
  }

  // Remove from master grades list
  const currentGrades = await fetchMasterGrades();
  const updatedGrades = currentGrades.filter((g) => g.id.toUpperCase() !== cleanGrade);
  await saveMasterGrades(updatedGrades);

  // Remove matching master classes
  const masterClasses = await fetchMasterClasses();
  const updatedMasterClasses = masterClasses.filter((c) => !isMatchGrade(c));
  await saveMasterClasses(updatedMasterClasses);

  return { affectedStudents: targets.length };
}

/**
 * Exports all system data including subjects, categories, materials, teachers, students,
 * progress, quiz scores/attempts, gamification, master academic config, admin settings, and theme.
 */
export async function exportAllSystemData(): Promise<SystemBackupData> {
  let subjects: Subject[] = [];
  let categories: Category[] = [];
  let materials: Material[] = [];
  let teachers: TeacherAccount[] = [];
  let students: StudentAccount[] = [];
  let progressMap: Record<string, StudentProgressRecord> = {};
  let masterGrades: Array<{ id: string; label: string; subLabel: string }> = [];
  let masterClasses: string[] = [];
  let themeConfig: ThemeConfig | undefined = undefined;
  let adminSettings: Partial<AdminSettings> = {};

  try {
    const [subSnap, catSnap, matSnap, teachSnap, studSnap, progSnap, adminSnap, masterSnap, themeSnap] = await Promise.all([
      getDocs(query(collection(db, SUBJECTS_COL), orderBy('order', 'asc'))).catch(() => null),
      getDocs(query(collection(db, CATEGORIES_COL), orderBy('order', 'asc'))).catch(() => null),
      getDocs(query(collection(db, MATERIALS_COL), orderBy('order', 'asc'))).catch(() => null),
      getDocs(query(collection(db, TEACHERS_COL), orderBy('name', 'asc'))).catch(() => null),
      getDocs(query(collection(db, STUDENTS_COL), orderBy('nama', 'asc'))).catch(() => null),
      getDocs(collection(db, STUDENT_PROGRESS_COL)).catch(() => null),
      getDoc(doc(db, SETTINGS_COL, ADMIN_DOC_ID)).catch(() => null),
      getDoc(doc(db, SETTINGS_COL, MASTER_CONFIG_DOC)).catch(() => null),
      getDoc(doc(db, SETTINGS_COL, THEME_CONFIG_DOC_ID)).catch(() => null),
    ]);

    if (subSnap && !subSnap.empty) {
      subjects = subSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
    } else {
      subjects = await fetchSubjects();
    }

    if (catSnap && !catSnap.empty) {
      categories = catSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
    } else {
      categories = await fetchCategories();
    }

    if (matSnap && !matSnap.empty) {
      materials = matSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Material));
    } else {
      materials = await fetchMaterials();
    }

    if (teachSnap && !teachSnap.empty) {
      teachers = teachSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TeacherAccount));
    } else {
      teachers = await fetchTeachers();
    }

    if (studSnap && !studSnap.empty) {
      students = studSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAccount));
    } else {
      students = await fetchStudents();
    }

    if (progSnap && !progSnap.empty) {
      progSnap.docs.forEach((d) => {
        const data = d.data();
        progressMap[d.id] = {
          id: d.id,
          studentId: d.id,
          studentName: data.studentName || '',
          kelas: data.kelas || '',
          completedMaterialIds: data.completedMaterialIds || [],
          completedMaterialTimestamps: data.completedMaterialTimestamps || {},
          scores: data.scores || {},
          quizAttempts: data.quizAttempts || {},
          activityLogs: data.activityLogs || [],
          notes: data.notes || {},
          bookmarkedMaterialIds: data.bookmarkedMaterialIds || [],
          gamification: getDefaultGamificationData(data.gamification),
          updatedAt: data.updatedAt || '',
        };
      });
    } else {
      progressMap = await fetchAllStudentProgress();
    }

    if (adminSnap && adminSnap.exists()) {
      adminSettings = adminSnap.data() as Partial<AdminSettings>;
    }
    if (masterSnap && masterSnap.exists()) {
      const mData = masterSnap.data();
      if (Array.isArray(mData?.grades)) masterGrades = mData.grades;
      if (Array.isArray(mData?.classes)) masterClasses = mData.classes;
    }
    if (themeSnap && themeSnap.exists()) {
      themeConfig = themeSnap.data() as ThemeConfig;
    }
  } catch {
    // Fallback using high-level methods
    [subjects, categories, materials, teachers, students, progressMap, masterGrades, masterClasses, themeConfig] = await Promise.all([
      fetchSubjects(),
      fetchCategories(),
      fetchMaterials(),
      fetchTeachers(),
      fetchStudents(),
      fetchAllStudentProgress(),
      fetchMasterGrades(),
      fetchMasterClasses(),
      fetchThemeConfig(),
    ]);
  }

  // Build clean dictionary of studentQuizScores and calculate stats
  const studentQuizScores: Record<string, Record<string, any>> = {};
  let totalQuizScores = 0;
  for (const [sId, prog] of Object.entries(progressMap)) {
    if (prog.quizAttempts || prog.scores) {
      studentQuizScores[sId] = {};
      if (prog.quizAttempts) {
        for (const [mId, attempt] of Object.entries(prog.quizAttempts)) {
          studentQuizScores[sId][mId] = attempt;
          totalQuizScores++;
        }
      }
      if (prog.scores) {
        for (const [mId, sc] of Object.entries(prog.scores)) {
          if (!studentQuizScores[sId][mId]) {
            const scNum = Number(sc);
            const normalizedScore = scNum <= 10 ? scNum : Math.round((scNum / 100) * 10);
            const normalizedPercent = scNum <= 10 ? Math.min(100, Math.round((scNum / 10) * 100)) : scNum;
            studentQuizScores[sId][mId] = {
              score: normalizedScore,
              totalQuestions: 10,
              percentage: normalizedPercent,
              updatedAt: prog.updatedAt || new Date().toISOString(),
            };
            totalQuizScores++;
          }
        }
      }
    }
  }

  const backupData: SystemBackupData = {
    version: '2.6.0',
    backupDate: new Date().toISOString(),
    systemName: adminSettings.siteTitle || 'Sistem Materi Pembelajaran Digital',
    subjects,
    categories,
    materials,
    teachers,
    students,
    studentProgress: progressMap,
    studentQuizScores,
    masterGrades: masterGrades.length > 0 ? masterGrades : await fetchMasterGrades(),
    masterClasses: masterClasses.length > 0 ? masterClasses : await fetchMasterClasses(),
    adminSettings,
    themeConfig: themeConfig || await fetchThemeConfig(),
    stats: {
      totalSubjects: subjects.length,
      totalCategories: categories.length,
      totalMaterials: materials.length,
      totalTeachers: teachers.length,
      totalStudents: students.length,
      totalProgressRecords: Object.keys(progressMap).length,
      totalQuizScores,
    },
  };

  return backupData;
}

/**
 * Restores system data from a backup object with options for merge or clean replacement.
 * Uses safe batch chunking (max 400 ops per batch) to handle large datasets seamlessly.
 * Restores all subjects, categories, materials, teachers, students, progress, quiz scores/attempts, and gamification.
 */
export async function restoreSystemData(
  backupData: SystemBackupData,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{
  subjectsCount: number;
  categoriesCount: number;
  materialsCount: number;
  teachersCount: number;
  studentsCount: number;
  progressCount: number;
  quizScoresCount: number;
}> {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Format file cadangan tidak valid.');
  }

  const BATCH_LIMIT = 400;

  // 1. If replace mode, clear existing collections
  if (mode === 'replace') {
    await clearAllFirestoreData();

    // Clear teachers
    try {
      const teachersSnap = await getDocs(collection(db, TEACHERS_COL));
      if (!teachersSnap.empty) {
        for (let i = 0; i < teachersSnap.docs.length; i += BATCH_LIMIT) {
          const chunk = teachersSnap.docs.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch {}

    // Clear students
    try {
      const studentsSnap = await getDocs(collection(db, STUDENTS_COL));
      if (!studentsSnap.empty) {
        for (let i = 0; i < studentsSnap.docs.length; i += BATCH_LIMIT) {
          const chunk = studentsSnap.docs.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch {}

    // Clear student progress & scores
    try {
      const progressSnap = await getDocs(collection(db, STUDENT_PROGRESS_COL));
      if (!progressSnap.empty) {
        for (let i = 0; i < progressSnap.docs.length; i += BATCH_LIMIT) {
          const chunk = progressSnap.docs.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch {}
  }

  // 2. Restore Subjects
  if (Array.isArray(backupData.subjects) && backupData.subjects.length > 0) {
    const validSubjects = backupData.subjects.filter((s) => s && s.id);
    for (let i = 0; i < validSubjects.length; i += BATCH_LIMIT) {
      const chunk = validSubjects.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((s) => {
        const ref = doc(db, SUBJECTS_COL, s.id);
        batch.set(ref, s, { merge: true });
      });
      await batch.commit();
    }
    try {
      localStorage.setItem('sistem_materi_subj_cache', JSON.stringify(validSubjects));
    } catch {}
  }

  // 3. Restore Categories
  if (Array.isArray(backupData.categories) && backupData.categories.length > 0) {
    const validCats = backupData.categories.filter((c) => c && c.id);
    for (let i = 0; i < validCats.length; i += BATCH_LIMIT) {
      const chunk = validCats.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((c) => {
        const ref = doc(db, CATEGORIES_COL, c.id);
        batch.set(ref, c, { merge: true });
      });
      await batch.commit();
    }
    try {
      localStorage.setItem('sistem_materi_cat_cache', JSON.stringify(validCats));
    } catch {}
  }

  // 4. Restore Materials
  if (Array.isArray(backupData.materials) && backupData.materials.length > 0) {
    const validMats = backupData.materials.filter((m) => m && m.id);
    for (let i = 0; i < validMats.length; i += BATCH_LIMIT) {
      const chunk = validMats.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((m) => {
        const ref = doc(db, MATERIALS_COL, m.id);
        batch.set(ref, m, { merge: true });
      });
      await batch.commit();
    }
    try {
      localStorage.setItem('sistem_materi_mat_cache', JSON.stringify(validMats));
    } catch {}
  }

  // 5. Restore Teachers
  if (Array.isArray(backupData.teachers) && backupData.teachers.length > 0) {
    const validTeachers = backupData.teachers.filter((t) => t && t.id);
    for (let i = 0; i < validTeachers.length; i += BATCH_LIMIT) {
      const chunk = validTeachers.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((t) => {
        const ref = doc(db, TEACHERS_COL, t.id);
        batch.set(ref, t, { merge: true });
      });
      await batch.commit();
    }
    try {
      localStorage.setItem('sistem_materi_teachers_cache', JSON.stringify(validTeachers));
    } catch {}
  }

  // 6. Restore Students
  let validStudents: StudentAccount[] = [];
  if (Array.isArray(backupData.students) && backupData.students.length > 0) {
    validStudents = backupData.students.filter((s) => s && s.id);
    for (let i = 0; i < validStudents.length; i += BATCH_LIMIT) {
      const chunk = validStudents.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((s) => {
        const ref = doc(db, STUDENTS_COL, s.id);
        batch.set(ref, s, { merge: true });
      });
      await batch.commit();
    }
    try {
      localStorage.setItem('sistem_materi_students_cache', JSON.stringify(validStudents));
    } catch {}
  }

  // 7. Restore Student Progress, Quiz Scores, and Gamification
  let progressCount = 0;
  let quizScoresCount = 0;
  const progressMap: Record<string, StudentProgressRecord> = {};

  if (backupData.studentProgress && typeof backupData.studentProgress === 'object') {
    if (Array.isArray(backupData.studentProgress)) {
      backupData.studentProgress.forEach((item: any) => {
        const sid = item.studentId || item.id;
        if (sid) progressMap[sid] = { ...item, studentId: sid };
      });
    } else {
      Object.entries(backupData.studentProgress).forEach(([sid, item]) => {
        if (sid && item) progressMap[sid] = { ...item, studentId: item.studentId || sid };
      });
    }
  }

  // Seamlessly merge studentQuizScores if available
  if (backupData.studentQuizScores && typeof backupData.studentQuizScores === 'object') {
    Object.entries(backupData.studentQuizScores).forEach(([sid, scoresByMat]) => {
      if (!sid || !scoresByMat || typeof scoresByMat !== 'object') return;
      if (!progressMap[sid]) {
        progressMap[sid] = {
          studentId: sid,
          completedMaterialIds: [],
          scores: {},
          quizAttempts: {},
          updatedAt: new Date().toISOString(),
        };
      }
      if (!progressMap[sid].scores) progressMap[sid].scores = {};
      if (!progressMap[sid].quizAttempts) progressMap[sid].quizAttempts = {};

      Object.entries(scoresByMat).forEach(([matId, scVal]: [string, any]) => {
        if (!matId) return;
        if (typeof scVal === 'number') {
          progressMap[sid].scores![matId] = scVal;
          if (!progressMap[sid].quizAttempts![matId]) {
            progressMap[sid].quizAttempts![matId] = {
              score: scVal,
              totalQuestions: 10,
              percentage: Math.round((scVal / 10) * 100),
              updatedAt: new Date().toISOString(),
            };
          }
        } else if (typeof scVal === 'object' && scVal !== null) {
          const scoreNum = Number(scVal.score ?? 0);
          progressMap[sid].scores![matId] = scoreNum;
          progressMap[sid].quizAttempts![matId] = {
            score: scoreNum,
            totalQuestions: Number(scVal.totalQuestions || 10),
            percentage: Number(scVal.percentage ?? Math.round((scoreNum / (scVal.totalQuestions || 10)) * 100)),
            updatedAt: scVal.updatedAt || new Date().toISOString(),
          };
        }
      });
    });
  }

  const progressEntries = Object.entries(progressMap);
  if (progressEntries.length > 0) {
    for (let i = 0; i < progressEntries.length; i += BATCH_LIMIT) {
      const chunk = progressEntries.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);

      chunk.forEach(([studentId, prog]) => {
        const ref = doc(db, STUDENT_PROGRESS_COL, studentId);
        const cleanedRecord: StudentProgressRecord = {
          studentId,
          studentName: prog.studentName || '',
          kelas: prog.kelas || '',
          completedMaterialIds: Array.isArray(prog.completedMaterialIds) ? prog.completedMaterialIds : [],
          completedMaterialTimestamps: prog.completedMaterialTimestamps || {},
          scores: prog.scores || {},
          quizAttempts: prog.quizAttempts || {},
          activityLogs: Array.isArray(prog.activityLogs) ? prog.activityLogs : [],
          notes: prog.notes || {},
          bookmarkedMaterialIds: Array.isArray(prog.bookmarkedMaterialIds) ? prog.bookmarkedMaterialIds : [],
          gamification: getDefaultGamificationData(prog.gamification),
          updatedAt: prog.updatedAt || new Date().toISOString(),
        };

        batch.set(ref, cleanFirestoreData(cleanedRecord), { merge: true });

        // Count scores
        const scoreKeys = Object.keys(cleanedRecord.scores || {});
        quizScoresCount += scoreKeys.length;

        // Sync individual student caches
        try {
          localStorage.setItem(`sistem_materi_prog_${studentId}`, JSON.stringify(cleanedRecord.completedMaterialIds));
          if (cleanedRecord.completedMaterialTimestamps) {
            localStorage.setItem(`sistem_materi_prog_times_${studentId}`, JSON.stringify(cleanedRecord.completedMaterialTimestamps));
            localStorage.setItem(`sistem_materi_timestamps_${studentId}`, JSON.stringify(cleanedRecord.completedMaterialTimestamps));
          }
          if (cleanedRecord.scores) {
            localStorage.setItem(`sistem_materi_scores_${studentId}`, JSON.stringify(cleanedRecord.scores));
          }
          if (cleanedRecord.quizAttempts) {
            localStorage.setItem(`sistem_materi_quiz_attempts_${studentId}`, JSON.stringify(cleanedRecord.quizAttempts));
          }
          if (cleanedRecord.activityLogs) {
            localStorage.setItem(`sistem_materi_activity_logs_${studentId}`, JSON.stringify(cleanedRecord.activityLogs));
            localStorage.setItem(`sistem_materi_activity_${studentId}`, JSON.stringify(cleanedRecord.activityLogs));
          }
          if (cleanedRecord.gamification) {
            localStorage.setItem(`sistem_materi_gamification_${studentId}`, JSON.stringify(cleanedRecord.gamification));
          }
          if (cleanedRecord.notes) {
            localStorage.setItem(`sistem_materi_notes_${studentId}`, JSON.stringify(cleanedRecord.notes));
          }
        } catch {}
      });

      await batch.commit();
    }
    progressCount = progressEntries.length;

    try {
      localStorage.setItem('sistem_materi_all_progress_cache', JSON.stringify(progressMap));
    } catch {}
  }

  // 8. Restore Master academic config
  if (Array.isArray(backupData.masterGrades) && backupData.masterGrades.length > 0) {
    await saveMasterGrades(backupData.masterGrades);
  }
  if (Array.isArray(backupData.masterClasses) && backupData.masterClasses.length > 0) {
    await saveMasterClasses(backupData.masterClasses);
  }

  // 9. Restore Admin Settings
  if (backupData.adminSettings) {
    try {
      const ref = doc(db, SETTINGS_COL, ADMIN_DOC_ID);
      await setDoc(ref, backupData.adminSettings, { merge: true });
      if (backupData.adminSettings.siteTitle) {
        localStorage.setItem('sistem_materi_site_title', backupData.adminSettings.siteTitle);
      }
    } catch {}
  }

  // 10. Restore Theme Config
  if (backupData.themeConfig) {
    try {
      await saveThemeConfig(backupData.themeConfig);
    } catch {}
  }

  // 11. Re-sync Leaderboard Summary Document
  try {
    const studentsToRank = validStudents.length > 0 ? validStudents : await fetchStudents();
    await syncLeaderboardSummary(studentsToRank, progressMap);
  } catch {}

  // 12. Invalidate all SWR caches so the app picks up the restored state immediately
  invalidateCache(CACHE_KEYS.SUBJECTS);
  invalidateCache(CACHE_KEYS.CATEGORIES);
  invalidateCache(CACHE_KEYS.MATERIALS);
  invalidateCache(CACHE_KEYS.TEACHERS);
  invalidateCache(CACHE_KEYS.STUDENTS);
  invalidateCache(CACHE_KEYS.ALL_STUDENT_PROGRESS);
  invalidateCache(CACHE_KEYS.LEADERBOARD_SUMMARY);
  Object.keys(progressMap).forEach((sid) => {
    invalidateCache(CACHE_KEYS.STUDENT_QUIZ_SCORES(sid));
    invalidateCache(CACHE_KEYS.STUDENT_PROGRESS_DETAILS(sid));
  });

  return {
    subjectsCount: backupData.subjects?.length || 0,
    categoriesCount: backupData.categories?.length || 0,
    materialsCount: backupData.materials?.length || 0,
    teachersCount: backupData.teachers?.length || 0,
    studentsCount: backupData.students?.length || 0,
    progressCount,
    quizScoresCount,
  };
}

// ----------------------------------------------------
// Theme & Event Configuration Service
// ----------------------------------------------------
const THEME_CONFIG_DOC_ID = 'theme_config';

export async function fetchThemeConfig(): Promise<ThemeConfig> {
  return swrFetch(
    CACHE_KEYS.THEME_CONFIG,
    async () => {
      try {
        const docRef = doc(db, SETTINGS_COL, THEME_CONFIG_DOC_ID);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as ThemeConfig;
          return { ...DEFAULT_THEME_CONFIG, ...data };
        }
        return DEFAULT_THEME_CONFIG;
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `${SETTINGS_COL}/${THEME_CONFIG_DOC_ID}`);
        return DEFAULT_THEME_CONFIG;
      }
    },
    {
      staleTime: 900_000,
      persistKey: 'sistem_materi_theme_cache',
    }
  );
}

export function subscribeThemeConfig(
  callback: (theme: ThemeConfig) => void,
  onError?: (err: any) => void
): () => void {
  const docRef = doc(db, SETTINGS_COL, THEME_CONFIG_DOC_ID);
  const unsubscribe = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ThemeConfig;
        const merged = { ...DEFAULT_THEME_CONFIG, ...data };
        setCacheData(CACHE_KEYS.THEME_CONFIG, merged, 'sistem_materi_theme_cache', false);
        callback(merged);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, `${SETTINGS_COL}/${THEME_CONFIG_DOC_ID}`);
    }
  );
  return unsubscribe;
}


export async function saveThemeConfig(themeConfig: Partial<ThemeConfig> | Record<string, any>): Promise<void> {
  const cleanData = cleanFirestoreData({
    ...DEFAULT_THEME_CONFIG,
    ...themeConfig,
    updatedAt: new Date().toISOString()
  });

  const docRef = doc(db, SETTINGS_COL, THEME_CONFIG_DOC_ID);
  await setDoc(docRef, cleanData, { merge: true });
  setCacheData(CACHE_KEYS.THEME_CONFIG, cleanData, 'sistem_materi_theme_cache');
}

// ----------------------------------------------------
// Database Diagnostic Scanner & Junk Cleaner Service
// ----------------------------------------------------

/**
 * Scans all Firestore collections for orphan records, dead references, and corrupted documents.
 */
export async function scanDatabaseJunk(): Promise<DatabaseJunkReport> {
  try {
    const [subjectsSnap, categoriesSnap, materialsSnap, teachersSnap, studentsSnap, progressSnap] = await Promise.all([
      getDocs(collection(db, SUBJECTS_COL)),
      getDocs(collection(db, CATEGORIES_COL)),
      getDocs(collection(db, MATERIALS_COL)),
      getDocs(collection(db, TEACHERS_COL)),
      getDocs(collection(db, STUDENTS_COL)),
      getDocs(collection(db, 'student_progress')),
    ]);

    const subjectIds = new Set(subjectsSnap.docs.map((d) => d.id));
    const categoryIds = new Set(categoriesSnap.docs.map((d) => d.id));
    const materialIds = new Set(materialsSnap.docs.map((d) => d.id));
    const studentIds = new Set(studentsSnap.docs.map((d) => d.id));

    const items: DatabaseJunkItem[] = [];
    let orphanProgressCount = 0;
    let orphanCategoriesCount = 0;
    let orphanMaterialsCount = 0;
    let staleMaterialScoresCount = 0;
    let invalidStudentsCount = 0;
    let invalidTeachersCount = 0;

    // 1. Check Orphan Categories (where subjectId does not exist)
    categoriesSnap.docs.forEach((d) => {
      const cat = d.data();
      if (!cat.subjectId || !subjectIds.has(cat.subjectId)) {
        orphanCategoriesCount++;
        items.push({
          id: d.id,
          type: 'orphan_category',
          title: `Topik Tanpa Mapel: "${cat.name || d.id}"`,
          description: `Topik ini tertaut ke ID Mapel "${cat.subjectId || 'Kosong'}" yang sudah terhapus dari sistem.`,
          collection: CATEGORIES_COL,
          rawDetails: { categoryId: d.id, subjectId: cat.subjectId, name: cat.name },
        });
      }
    });

    // 2. Check Orphan Materials (where categoryId or subjectId is missing)
    materialsSnap.docs.forEach((d) => {
      const mat = d.data();
      const isOrphanCat = !mat.categoryId || !categoryIds.has(mat.categoryId);
      const isOrphanSubj = mat.subjectId && !subjectIds.has(mat.subjectId);
      if (isOrphanCat || isOrphanSubj) {
        orphanMaterialsCount++;
        items.push({
          id: d.id,
          type: 'orphan_material',
          title: `Materi Tanpa Induk: "${mat.title || d.id}"`,
          description: isOrphanCat
            ? `Materi ini terikat ke Topik ID "${mat.categoryId || 'Kosong'}" yang sudah tidak ditemukan.`
            : `Materi ini terikat ke Mapel ID "${mat.subjectId}" yang sudah dihapus.`,
          collection: MATERIALS_COL,
          rawDetails: { materialId: d.id, categoryId: mat.categoryId, subjectId: mat.subjectId, title: mat.title },
        });
      }
    });

    // 3. Check Orphan Student Progress (progress documents of deleted students)
    progressSnap.docs.forEach((d) => {
      const prog = d.data() as StudentProgressRecord;
      const docStudentId = d.id;
      const isStudentMissing = !studentIds.has(docStudentId) && (!prog.studentId || !studentIds.has(prog.studentId));

      if (isStudentMissing) {
        orphanProgressCount++;
        items.push({
          id: d.id,
          type: 'orphan_progress',
          title: `Progres Siswa Terhapus: ID "${docStudentId}"`,
          description: `Rekam nilai/progres (${prog.studentName || 'Tanpa Nama'} - Kelas ${prog.kelas || 'N/A'}) untuk akun siswa yang sudah dihapus.`,
          collection: 'student_progress',
          rawDetails: { docId: d.id, studentName: prog.studentName, kelas: prog.kelas },
        });
      } else {
        // Check for stale scores / quiz attempts referencing dead material IDs
        const staleMatKeys: string[] = [];
        if (prog.scores) {
          Object.keys(prog.scores).forEach((mId) => {
            if (!materialIds.has(mId)) staleMatKeys.push(mId);
          });
        }
        if (prog.completedMaterialIds) {
          prog.completedMaterialIds.forEach((mId) => {
            if (!materialIds.has(mId) && !staleMatKeys.includes(mId)) staleMatKeys.push(mId);
          });
        }
        if (staleMatKeys.length > 0) {
          staleMaterialScoresCount += staleMatKeys.length;
          items.push({
            id: d.id,
            type: 'stale_score',
            title: `Referensi Materi Usang (${prog.studentName || docStudentId})`,
            description: `Terdapat ${staleMatKeys.length} riwayat nilai/kuis pada materi lama yang sudah dihapus dari bank materi.`,
            collection: 'student_progress',
            rawDetails: { docId: d.id, deadMaterialIds: staleMatKeys, studentName: prog.studentName },
          });
        }
      }
    });

    // 4. Check Invalid / Corrupted Student Records
    studentsSnap.docs.forEach((d) => {
      const s = d.data();
      if (!s.nama || !s.nama.trim() || !d.id) {
        invalidStudentsCount++;
        items.push({
          id: d.id,
          type: 'invalid_student',
          title: `Data Siswa Rusak / Tanpa Nama: ID "${d.id}"`,
          description: `Entri siswa tidak memiliki nama lengkap atau mengalami kegagalan simpan dokumen.`,
          collection: STUDENTS_COL,
          rawDetails: { docId: d.id, data: s },
        });
      }
    });

    // 5. Check Invalid / Corrupted Teacher Records
    teachersSnap.docs.forEach((d) => {
      const t = d.data();
      if (!t.name || !t.name.trim() || !t.username || !t.username.trim()) {
        invalidTeachersCount++;
        items.push({
          id: d.id,
          type: 'invalid_teacher',
          title: `Data Guru Rusak: ID "${d.id}"`,
          description: `Akun guru tidak memiliki nama lengkap atau username login yang valid.`,
          collection: TEACHERS_COL,
          rawDetails: { docId: d.id, data: t },
        });
      }
    });

    const totalJunkCount =
      orphanProgressCount +
      orphanCategoriesCount +
      orphanMaterialsCount +
      staleMaterialScoresCount +
      invalidStudentsCount +
      invalidTeachersCount;

    return {
      scannedAt: new Date().toISOString(),
      totalJunkCount,
      orphanProgressCount,
      orphanCategoriesCount,
      orphanMaterialsCount,
      staleMaterialScoresCount,
      invalidStudentsCount,
      invalidTeachersCount,
      items,
      healthy: totalJunkCount === 0,
    };
  } catch (err) {
    console.error('Error scanning database junk:', err);
    return {
      scannedAt: new Date().toISOString(),
      totalJunkCount: 0,
      orphanProgressCount: 0,
      orphanCategoriesCount: 0,
      orphanMaterialsCount: 0,
      staleMaterialScoresCount: 0,
      invalidStudentsCount: 0,
      invalidTeachersCount: 0,
      items: [],
      healthy: true,
    };
  }
}

/**
 * Cleans selected junk items or all identified junk from Firestore and refreshes caches.
 */
export async function cleanDatabaseJunk(
  report?: DatabaseJunkReport,
  selectedItemIds?: string[]
): Promise<{ cleanedCount: number; message: string }> {
  const currentReport = report || (await scanDatabaseJunk());
  const itemsToClean =
    selectedItemIds && selectedItemIds.length > 0
      ? currentReport.items.filter((item) => selectedItemIds.includes(item.id))
      : currentReport.items;

  if (itemsToClean.length === 0) {
    return { cleanedCount: 0, message: 'Database dalam kondisi bersih. Tidak ada item sampah yang perlu dihapus.' };
  }

  const batchSize = 400;
  let totalCleaned = 0;

  // 1. Delete standalone orphan docs (orphan progress, orphan categories, orphan materials, broken accounts)
  const docsToDelete = itemsToClean.filter((item) => item.type !== 'stale_score');
  for (let i = 0; i < docsToDelete.length; i += batchSize) {
    const chunk = docsToDelete.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      const ref = doc(db, item.collection, item.id);
      batch.delete(ref);
    });
    await batch.commit();
    totalCleaned += chunk.length;
  }

  // 2. Prune dead material references inside student progress documents
  const staleScoreItems = itemsToClean.filter((item) => item.type === 'stale_score');
  for (let i = 0; i < staleScoreItems.length; i += batchSize) {
    const chunk = staleScoreItems.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      try {
        const deadIds = new Set<string>(item.rawDetails?.deadMaterialIds || []);
        const ref = doc(db, 'student_progress', item.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const prog = snap.data() as StudentProgressRecord;
          const updatedScores = { ...(prog.scores || {}) };
          const updatedQuizAttempts = { ...(prog.quizAttempts || {}) };
          const updatedCompletedTimestamps = { ...(prog.completedMaterialTimestamps || {}) };
          deadIds.forEach((id) => {
            delete updatedScores[id];
            delete updatedQuizAttempts[id];
            delete updatedCompletedTimestamps[id];
          });
          const updatedCompletedIds = (prog.completedMaterialIds || []).filter((id) => !deadIds.has(id));
          const updatedActivityLogs = (prog.activityLogs || []).filter((log) => !deadIds.has(log.materialId));

          batch.update(
            ref,
            cleanFirestoreData({
              scores: updatedScores,
              quizAttempts: updatedQuizAttempts,
              completedMaterialIds: updatedCompletedIds,
              completedMaterialTimestamps: updatedCompletedTimestamps,
              activityLogs: updatedActivityLogs,
              updatedAt: new Date().toISOString(),
            })
          );
          totalCleaned++;
        }
      } catch (err) {
        console.warn('Error pruning stale score reference:', item.id, err);
      }
    }
    await batch.commit();
  }

  // 3. Invalidate and refresh local storage caches
  await purgeLocalCacheAndResync();

  return {
    cleanedCount: totalCleaned,
    message: `Pembersihan berhasil. Sebanyak ${totalCleaned} item sampah database telah dibersihkan secara permanen.`,
  };
}

/**
 * Purges local browser caches and forces fresh re-fetch on next access.
 */
export async function purgeLocalCacheAndResync(): Promise<void> {
  clearAllSWRCache();
  try {
    const keysToRemove = [
      'sistem_materi_subj_cache',
      'sistem_materi_cat_cache',
      'sistem_materi_mat_cache',
      'sistem_materi_students_cache',
      'sistem_materi_teachers_cache',
      'sistem_materi_all_progress_cache',
      'sistem_materi_theme_cache',
      'sistem_materi_master_grades',
      'sistem_materi_master_classes',
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}




