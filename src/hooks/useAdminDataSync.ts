import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllStudentProgress,
  subscribeAllStudentProgress,
  resetAllStudentProgress,
  getAdminPin,
  setAdminPin as saveAdminPinToDb,
  getMinQuizScoreToUnlock,
  setMinQuizScoreToUnlock as saveMinQuizScoreToDb,
  scanDatabaseJunk,
  cleanDatabaseJunk,
  fetchMasterGrades,
  saveMasterGrades,
  fetchMasterClasses,
  saveMasterClasses,
  DEFAULT_GRADES,
  DEFAULT_PRESET_CLASSES,
  DEFAULT_MIN_QUIZ_SCORE,
  GradeConfig,
} from '../lib/dataService';
import { DatabaseJunkReport, StudentProgressRecord } from '../types';

interface UseAdminDataSyncOptions {
  onRefreshData?: () => Promise<void>;
  showNotify?: (type: 'success' | 'error', message: string) => void;
  selectedClass?: string;
}

export function useAdminDataSync({ onRefreshData, showNotify, selectedClass }: UseAdminDataSyncOptions = {}) {
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Student progress
  const [studentProgressMap, setStudentProgressMap] = useState<Record<string, StudentProgressRecord>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // Master Grades & Classes
  const [masterGrades, setMasterGrades] = useState<GradeConfig[]>(DEFAULT_GRADES);
  const [masterClasses, setMasterClasses] = useState<string[]>(DEFAULT_PRESET_CLASSES);

  // Database settings
  const [adminPin, setAdminPinState] = useState('');
  const [minQuizScore, setMinQuizScoreState] = useState<number>(DEFAULT_MIN_QUIZ_SCORE);

  // Junk Cleaner
  const [junkReport, setJunkReport] = useState<DatabaseJunkReport | null>(null);
  const [isScanningJunk, setIsScanningJunk] = useState(false);
  const [isCleaningJunk, setIsCleaningJunk] = useState(false);

  // Initial fetch for progress, grades, classes, and settings
  const loadInitialData = useCallback(async () => {
    setIsLoadingProgress(true);
    try {
      const [progress, grades, classes, pin, minScore] = await Promise.allSettled([
        fetchAllStudentProgress({ selectedClass }),
        fetchMasterGrades(),
        fetchMasterClasses(),
        getAdminPin(),
        getMinQuizScoreToUnlock(),
      ]);

      if (progress.status === 'fulfilled') {
        setStudentProgressMap(progress.value || {});
      }
      if (grades.status === 'fulfilled' && grades.value && grades.value.length > 0) {
        setMasterGrades(grades.value);
      }
      if (classes.status === 'fulfilled' && classes.value && classes.value.length > 0) {
        setMasterClasses(classes.value);
      }
      if (pin.status === 'fulfilled' && pin.value) {
        setAdminPinState(pin.value);
      }
      if (minScore.status === 'fulfilled' && typeof minScore.value === 'number') {
        setMinQuizScoreState(minScore.value);
      }

      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Error loading initial admin data:', err);
    } finally {
      setIsLoadingProgress(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Real-time Firestore subscription: updates studentProgressMap whenever any student completes materials or quizzes
  useEffect(() => {
    const unsub = subscribeAllStudentProgress(
      (newProgressMap) => {
        if (newProgressMap) {
          setStudentProgressMap(newProgressMap);
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        console.warn('Real-time student progress subscription error:', err);
      },
      selectedClass
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [selectedClass]);

  // Full Refresh Handler
  const refreshAllData = useCallback(async () => {
    setIsSyncing(true);
    try {
      if (onRefreshData) {
        await onRefreshData();
      }
      await loadInitialData();
      setLastSyncedAt(new Date());
      showNotify?.('success', 'Data sistem & database berhasil disinkronkan secara realtime!');
    } catch (err: any) {
      console.error('Failed to sync admin data:', err);
      showNotify?.('error', err?.message || 'Gagal menyinkronkan data sistem');
    } finally {
      setIsSyncing(false);
    }
  }, [onRefreshData, loadInitialData, showNotify]);

  // Reset Single Student Progress
  const handleResetStudentProgress = useCallback(
    async (studentId: string, studentName: string) => {
      try {
        await resetAllStudentProgress(studentId, studentName);
        setStudentProgressMap((prev) => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
        showNotify?.('success', `Progres belajar siswa "${studentName}" berhasil direset.`);
      } catch (err: any) {
        console.error('Failed to reset student progress:', err);
        showNotify?.('error', err?.message || 'Gagal mereset progres siswa.');
        throw err;
      }
    },
    [showNotify]
  );

  // Reset All Students Progress
  const handleResetAllProgress = useCallback(async () => {
    try {
      const studentIds = Object.keys(studentProgressMap);
      await Promise.allSettled(studentIds.map((id) => resetAllStudentProgress(id)));
      setStudentProgressMap({});
      showNotify?.('success', 'Seluruh progres belajar siswa berhasil direset.');
    } catch (err: any) {
      console.error('Failed to reset all progress:', err);
      showNotify?.('error', err?.message || 'Gagal mereset seluruh progres.');
      throw err;
    }
  }, [studentProgressMap, showNotify]);

  // Update PIN
  const handleSavePin = useCallback(
    async (newPin: string) => {
      try {
        await saveAdminPinToDb(newPin);
        setAdminPinState(newPin);
        showNotify?.('success', 'PIN Admin berhasil diperbarui!');
      } catch (err: any) {
        showNotify?.('error', err?.message || 'Gagal menyimpan PIN Admin');
        throw err;
      }
    },
    [showNotify]
  );

  // Update Min Quiz Score
  const handleSaveMinQuizScore = useCallback(
    async (score: number) => {
      try {
        await saveMinQuizScoreToDb(score);
        setMinQuizScoreState(score);
        showNotify?.('success', `Batas minimal kelulusan kuis berhasil disimpan (${score}/10 soal).`);
      } catch (err: any) {
        showNotify?.('error', err?.message || 'Gagal menyimpan batas kelulusan kuis');
        throw err;
      }
    },
    [showNotify]
  );

  // Scan Database Junk
  const handleScanJunk = useCallback(async () => {
    setIsScanningJunk(true);
    try {
      const report = await scanDatabaseJunk();
      setJunkReport(report);
      if (report.healthy) {
        showNotify?.('success', 'Database sehat! Tidak ditemukan item sampah atau relasi rusak.');
      } else {
        showNotify?.('error', `Ditemukan ${report.totalJunkCount} item sampah/relasi tidak valid di database.`);
      }
      return report;
    } catch (err: any) {
      console.error('Scan junk error:', err);
      showNotify?.('error', 'Gagal memindai sampah database.');
      return null;
    } finally {
      setIsScanningJunk(false);
    }
  }, [showNotify]);

  // Clean Database Junk
  const handleCleanJunk = useCallback(
    async (cleanAll = true, targetIds?: string[]) => {
      if (!junkReport) return '';
      setIsCleaningJunk(true);
      try {
        const idsToClean = cleanAll ? (junkReport?.items || []).map((i) => i.id) : targetIds || [];
        const res = await cleanDatabaseJunk(junkReport, idsToClean);
        showNotify?.('success', res.message);
        if (onRefreshData) await onRefreshData();
        const updatedReport = await scanDatabaseJunk();
        setJunkReport(updatedReport);
        return res.message;
      } catch (err: any) {
        console.error('Clean junk error:', err);
        showNotify?.('error', 'Gagal membersihkan sampah database: ' + (err?.message || ''));
        throw err;
      } finally {
        setIsCleaningJunk(false);
      }
    },
    [junkReport, onRefreshData, showNotify]
  );

  // Master Classes Management
  const handleAddMasterClass = useCallback(
    async (className: string) => {
      const trimmed = className.trim();
      if (!trimmed) return;
      if (masterClasses.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(`Kelas "${trimmed}" sudah ada dalam daftar.`);
      }
      const updated = [...masterClasses, trimmed].sort();
      await saveMasterClasses(updated);
      setMasterClasses(updated);
    },
    [masterClasses]
  );

  const handleDeleteMasterClass = useCallback(
    async (className: string) => {
      const updated = masterClasses.filter((c) => c.toLowerCase() !== className.toLowerCase());
      await saveMasterClasses(updated);
      setMasterClasses(updated);
    },
    [masterClasses]
  );

  return {
    isSyncing,
    lastSyncedAt,
    refreshAllData,
    studentProgressMap,
    isLoadingProgress,
    handleResetStudentProgress,
    handleResetAllProgress,
    masterGrades,
    setMasterGrades,
    masterClasses,
    setMasterClasses,
    handleAddMasterClass,
    handleDeleteMasterClass,
    adminPin,
    handleSavePin,
    minQuizScore,
    handleSaveMinQuizScore,
    junkReport,
    isScanningJunk,
    isCleaningJunk,
    handleScanJunk,
    handleCleanJunk,
  };
}
