import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { SubjectSelector, SubjectSelectorTab } from './components/SubjectSelector';
import { CategoryList } from './components/CategoryList';
import { CategoryDetail } from './components/CategoryDetail';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { DriveGuideModal } from './components/DriveGuideModal';
import { ExamExitModal } from './components/ExamExitModal';
import { AntiCheatModal } from './components/AntiCheatModal';
import { InitialLoginScreen } from './components/InitialLoginScreen';
import { MobileBottomNav, StudentNavTab } from './components/MobileBottomNav';
import { UserProfileModal } from './components/UserProfileModal';
import { StudentJoinGameModal } from './components/game/StudentJoinGameModal';
import { StudentGameView } from './components/game/StudentGameView';
import { EducationalBackground } from './components/EducationalBackground';
import { StudentPreviewBanner } from './components/StudentPreviewBanner';
import { AppFooter } from './components/AppFooter';
import { OfflineNotificationBanner } from './components/OfflineNotificationBanner';
import { GameSession } from './types/game';
import { Subject, Category, Material, TeacherAccount, StudentAccount, AuthSession, MaterialActivityLog } from './types';
import { normalizeCompletedMaterialIds } from './utils/prerequisites';
import {
  fetchSubjects,
  fetchCategories,
  fetchMaterials,
  fetchTeachers,
  fetchStudents,
  seedInitialDataIfNeeded,
  getSiteLogoUrl,
  saveStudentProgress,
  flushAllPendingProgressWrites,
  fetchStudentProgress,
  fetchStudentProgressDetails,
  fetchAllStudentProgress,
  saveStudentNotesAndBookmarks,
  purgeDemoAccountsAndData,
  fetchStudentQuizScores,
  subscribeStudentProgress,
  getInitialCacheArray,
  getInitialCacheValue,
  CACHE_KEYS,
  subscribeSubjects,
  subscribeCategories,
  subscribeMaterials,
  subscribeTeachers,
  subscribeStudents,
  subscribeToCache,
  repairAndSyncAllStudents,
  updateStudentOnlineStatus,
  markStudentOfflineImmediately,
  touchStudentActiveSession,
} from './lib/dataService';

import { INITIAL_SUBJECTS, INITIAL_CATEGORIES, INITIAL_MATERIALS } from './utils/initialData';
import { confirmExitExam, useExamSession } from './utils/examSession';
import { filterContentForStudent } from './utils/classFilter';
import { checkCategoryUnlockStatus, checkMaterialUnlockStatus } from './utils/prerequisites';
import { useMobileHardwareBack, useMobileBackModal } from './utils/mobileNavigation';
import { sanitizeAuthSession, sanitizeTeacherForPublic } from './utils/security';

const pageTransitionVariants = {
  initial: { opacity: 0, y: 14, scale: 0.994 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.994,
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function App() {
  const examSession = useExamSession();
  const [subjects, setSubjects] = useState<Subject[]>(() =>
    getInitialCacheArray<Subject>(CACHE_KEYS.SUBJECTS, 'sistem_materi_subj_cache')
  );

  const [categories, setCategories] = useState<Category[]>(() =>
    getInitialCacheArray<Category>(CACHE_KEYS.CATEGORIES, 'sistem_materi_cat_cache')
  );

  const [materials, setMaterials] = useState<Material[]>(() =>
    getInitialCacheArray<Material>(CACHE_KEYS.MATERIALS, 'sistem_materi_mat_cache')
  );

  const [siteLogoUrl, setSiteLogoUrl] = useState<string>(() =>
    getInitialCacheValue<string>(CACHE_KEYS.SITE_LOGO, 'sistem_materi_logo_url', '')
  );

  const [isLoading, setIsLoading] = useState(false);


  // Search & Navigation - ALWAYS start at Halaman Mata Pelajaran (subjects) on initial load!
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Admin & Teacher Auth Sessions & Modals
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem('sistem_materi_auth_session');
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (parsed) return sanitizeAuthSession(parsed);
      }
    } catch {}
    if (localStorage.getItem('sistem_materi_admin_auth') === 'true') {
      return { role: 'admin' };
    }
    return null;
  });

  const [viewMode, setViewMode] = useState<'dashboard' | 'student_preview'>('dashboard');

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return authSession?.role === 'admin' || localStorage.getItem('sistem_materi_admin_auth') === 'true';
  });
  const [teachers, setTeachers] = useState<TeacherAccount[]>(() =>
    getInitialCacheArray<TeacherAccount>(CACHE_KEYS.TEACHERS, 'sistem_materi_teachers_cache')
  );
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isJoinGameModalOpen, setIsJoinGameModalOpen] = useState(false);
  const [activeGameSession, setActiveGameSession] = useState<GameSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('active_icebreaking_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status !== 'ended') return parsed;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      if (activeGameSession && activeGameSession.status !== 'ended') {
        sessionStorage.setItem('active_icebreaking_session', JSON.stringify(activeGameSession));
      } else {
        sessionStorage.removeItem('active_icebreaking_session');
      }
    } catch {}
  }, [activeGameSession]);

  // Student progress & notes persistence (Keyed by candidate student IDs)
  const getCachedStudentData = <T,>(prefix: string, fallback: T): T => {
    if (!authSession?.student) return fallback;
    const candidates = [
      authSession.student.id,
      (authSession.student as any)?.nis,
      authSession.student.nisn,
      authSession.student.username,
    ].filter(Boolean);
    for (const sid of candidates) {
      try {
        const raw = localStorage.getItem(`${prefix}_${sid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(fallback)) {
            const normalized = normalizeCompletedMaterialIds(parsed);
            if (normalized.length > 0) return normalized as unknown as T;
          } else {
            if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) return parsed as unknown as T;
          }
        }
      } catch {}
    }
    return fallback;
  };

  const [completedMaterialIdsRaw, setCompletedMaterialIdsRaw] = useState<string[]>(() =>
    normalizeCompletedMaterialIds(getCachedStudentData<string[]>('sistem_materi_prog', []))
  );

  const completedMaterialIds = useMemo(
    () => normalizeCompletedMaterialIds(completedMaterialIdsRaw),
    [completedMaterialIdsRaw]
  );

  const setCompletedMaterialIds = useCallback(
    (action: string[] | ((prev: string[]) => string[])) => {
      setCompletedMaterialIdsRaw((prev) => {
        const safePrev = normalizeCompletedMaterialIds(prev);
        const next = typeof action === 'function' ? action(safePrev) : action;
        return normalizeCompletedMaterialIds(next);
      });
    },
    []
  );

  const [completedMaterialTimestamps, setCompletedMaterialTimestamps] = useState<Record<string, string>>(() =>
    getCachedStudentData<Record<string, string>>('sistem_materi_prog_times', {})
  );

  const [activityLogs, setActivityLogs] = useState<MaterialActivityLog[]>(() =>
    getCachedStudentData<MaterialActivityLog[]>('sistem_materi_activity_logs', [])
  );

  const [userNotes, setUserNotes] = useState<Record<string, string>>(() =>
    getCachedStudentData<Record<string, string>>('sistem_materi_notes', {})
  );

  const [bookmarkedMaterialIds, setBookmarkedMaterialIds] = useState<string[]>(() =>
    getCachedStudentData<string[]>('sistem_materi_bookmarks', [])
  );

  const [allStudentProgress, setAllStudentProgress] = useState<Record<string, any>>({});
  const [subjectSelectorTab, setSubjectSelectorTab] = useState<SubjectSelectorTab>('subjects');
  const [mobileNavTab, setMobileNavTab] = useState<StudentNavTab>('materials');
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);

  // Sync student progress on account switch or login with real-time onSnapshot synchronization
  useEffect(() => {
    if (authSession?.student) {
      const student = authSession.student;
      const studentId = student.id;
      const candidateIds = [
        student.id,
        student.nisn,
        student.username,
      ].filter(Boolean) as string[];

      // Load local cache for this student immediately from best candidate
      let initialProg: string[] = [];
      let initialTimes: Record<string, string> = {};
      let initialLogs: MaterialActivityLog[] = [];
      let initialNotes: Record<string, string> = {};
      let initialBookmarks: string[] = [];

      for (const sid of candidateIds) {
        try {
          const p = localStorage.getItem(`sistem_materi_prog_${sid}`);
          if (p && p !== 'null' && p !== 'undefined') {
            const parsed = JSON.parse(p);
            if (Array.isArray(parsed) && parsed.length > initialProg.length) initialProg = parsed;
          }
          const t = localStorage.getItem(`sistem_materi_prog_times_${sid}`);
          if (t && t !== 'null' && t !== 'undefined' && Object.keys(initialTimes).length === 0) {
            const parsed = JSON.parse(t);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) initialTimes = parsed;
          }
          const l = localStorage.getItem(`sistem_materi_activity_logs_${sid}`);
          if (l && l !== 'null' && l !== 'undefined' && initialLogs.length === 0) {
            const parsed = JSON.parse(l);
            if (Array.isArray(parsed)) initialLogs = parsed;
          }
          const n = localStorage.getItem(`sistem_materi_notes_${sid}`);
          if (n && n !== 'null' && n !== 'undefined' && Object.keys(initialNotes).length === 0) {
            const parsed = JSON.parse(n);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) initialNotes = parsed;
          }
          const b = localStorage.getItem(`sistem_materi_bookmarks_${sid}`);
          if (b && b !== 'null' && b !== 'undefined' && initialBookmarks.length === 0) {
            const parsed = JSON.parse(b);
            if (Array.isArray(parsed)) initialBookmarks = parsed;
          }
        } catch {}
      }

      if (initialProg.length > 0) setCompletedMaterialIds(initialProg);
      if (Object.keys(initialTimes).length > 0) setCompletedMaterialTimestamps(initialTimes);
      if (initialLogs.length > 0) setActivityLogs(initialLogs);
      if (Object.keys(initialNotes).length > 0) setUserNotes(initialNotes);
      if (initialBookmarks.length > 0) setBookmarkedMaterialIds(initialBookmarks);

      // Initial fresh sync from Firestore DB
      fetchStudentProgressDetails(studentId, {
        forceRevalidate: true,
        additionalIds: candidateIds,
        studentName: student.nama,
        kelas: student.kelas,
      })
        .then((details) => {
          if (details && Array.isArray(details.completedMaterialIds)) {
            setCompletedMaterialIds(details.completedMaterialIds);
            if (details.completedMaterialTimestamps) {
              setCompletedMaterialTimestamps(details.completedMaterialTimestamps);
            }
            if (details.activityLogs) setActivityLogs(details.activityLogs);
            if (details.notes) {
              setUserNotes(details.notes);
            }
            if (details.bookmarkedMaterialIds) {
              setBookmarkedMaterialIds(details.bookmarkedMaterialIds);
            }
          }
        })
        .catch(() => {});

      fetchStudentQuizScores(studentId, {
        forceRevalidate: true,
        additionalIds: candidateIds,
        studentName: student.nama,
      }).catch(() => {});

      // Real-time listener: updates instantly on multi-document synchronization
      const unsubProgress = subscribeStudentProgress(candidateIds, (record) => {
        if (record && Array.isArray(record.completedMaterialIds)) {
          setCompletedMaterialIds(record.completedMaterialIds);
          if (record.completedMaterialTimestamps) setCompletedMaterialTimestamps(record.completedMaterialTimestamps);
          if (record.activityLogs) setActivityLogs(record.activityLogs);
          if (record.notes) setUserNotes(record.notes);
          if (record.bookmarkedMaterialIds) setBookmarkedMaterialIds(record.bookmarkedMaterialIds);
        }
      });

      const handleResetEvent = (e: Event) => {
        const customEvent = e as CustomEvent;
        const detail = customEvent?.detail;
        const shouldReset =
          !detail ||
          detail.allStudents ||
          (detail.studentIds && detail.studentIds.some((id: string) => candidateIds.includes(id))) ||
          (detail.studentId && candidateIds.includes(detail.studentId));

        if (shouldReset) {
          if (detail?.materialId) {
            setCompletedMaterialIds((prev) => prev.filter((id) => id !== detail.materialId));
            setCompletedMaterialTimestamps((prev) => {
              const next = { ...prev };
              delete next[detail.materialId];
              return next;
            });
          } else {
            setCompletedMaterialIds([]);
            setCompletedMaterialTimestamps({});
            setActivityLogs([]);
          }
          fetchStudentProgressDetails(studentId, { forceRevalidate: true, additionalIds: candidateIds }).then((details) => {
            if (details) {
              setCompletedMaterialIds(normalizeCompletedMaterialIds(details.completedMaterialIds));
              setCompletedMaterialTimestamps(details.completedMaterialTimestamps || {});
              setActivityLogs(details.activityLogs || []);
            } else {
              setCompletedMaterialIds([]);
              setCompletedMaterialTimestamps({});
              setActivityLogs([]);
            }
          });
          fetchStudentQuizScores(studentId, { forceRevalidate: true, additionalIds: candidateIds }).catch(() => {});
        }
      };

      window.addEventListener('student-material-reset', handleResetEvent);

      return () => {
        unsubProgress();
        window.removeEventListener('student-material-reset', handleResetEvent);
      };
    } else {
      setCompletedMaterialIds([]);
      setCompletedMaterialTimestamps({});
      setActivityLogs([]);
      setUserNotes({});
      setBookmarkedMaterialIds([]);
    }
  }, [authSession?.student?.id, authSession?.student?.nisn]);

  // Load Data from Firestore in parallel
  const loadData = async (showLoading = false, force = false) => {
    if (showLoading && categories.length === 0) {
      setIsLoading(true);
    }
    try {
      const isStaff = authSession?.role === 'admin' || authSession?.role === 'teacher';
      const [subjData, catData, matData, logoData, teacherData] = await Promise.all([
        fetchSubjects({ forceRevalidate: force }).catch(() => {
          return getInitialCacheArray<Subject>(CACHE_KEYS.SUBJECTS, 'sistem_materi_subj_cache');
        }),
        fetchCategories({ forceRevalidate: force }).catch(() => {
          return getInitialCacheArray<Category>(CACHE_KEYS.CATEGORIES, 'sistem_materi_cat_cache');
        }),
        fetchMaterials(undefined, { forceRevalidate: force }).catch(() => {
          return getInitialCacheArray<Material>(CACHE_KEYS.MATERIALS, 'sistem_materi_mat_cache');
        }),
        getSiteLogoUrl().catch(() => ''),
        fetchTeachers({ forceRevalidate: force }).catch(() => {
          return getInitialCacheArray<TeacherAccount>(CACHE_KEYS.TEACHERS, 'sistem_materi_teachers_cache');
        }),
      ]);
      if (Array.isArray(subjData)) setSubjects(subjData);
      if (Array.isArray(catData)) setCategories(catData);
      if (Array.isArray(matData)) setMaterials(matData);
      if (logoData !== undefined) {
        setSiteLogoUrl(logoData);
      }
      if (Array.isArray(teacherData)) setTeachers(teacherData);
      try {
        localStorage.setItem('sistem_materi_teachers_cache', JSON.stringify(teacherData));
      } catch {}

      // Quota Optimization: Only load full student directory and progress when user is admin or teacher
      if (isStaff) {
        const [studentData, progressData] = await Promise.all([
          fetchStudents(),
          fetchAllStudentProgress().catch(() => ({})),
        ]);
        setStudents(studentData);
        if (progressData) {
          setAllStudentProgress(progressData);
        }
      }
    } catch (err) {
      console.error('Error loading data from Firestore:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reactive SWR Cache Listener:
  // When background HTTP revalidation completes in swrFetch, update React state immediately
  // without requiring page refreshes!
  useEffect(() => {
    const unsubSubj = subscribeToCache<Subject[]>(CACHE_KEYS.SUBJECTS, (newData) => {
      if (Array.isArray(newData)) setSubjects(newData);
    });
    const unsubCat = subscribeToCache<Category[]>(CACHE_KEYS.CATEGORIES, (newData) => {
      if (Array.isArray(newData)) setCategories(newData);
    });
    const unsubMat = subscribeToCache<Material[]>(CACHE_KEYS.MATERIALS, (newData) => {
      if (Array.isArray(newData)) setMaterials(newData);
    });
    const unsubTeach = subscribeToCache<TeacherAccount[]>(CACHE_KEYS.TEACHERS, (newData) => {
      if (Array.isArray(newData)) setTeachers(newData);
    });

    return () => {
      unsubSubj();
      unsubCat();
      unsubMat();
      unsubTeach();
    };
  }, []);

  useEffect(() => {
    loadData(false);
    seedInitialDataIfNeeded().catch(() => {});
  }, []);

  // Staff-Only Real-time Listeners: Curriculum, Teachers & Students listeners only active for Admin/Teacher
  // This saves thousands of real-time WebSocket connections and avoids quota exhaustion for 1,000+ students.
  useEffect(() => {
    const isStaff = authSession?.role === 'admin' || authSession?.role === 'teacher';
    if (!isStaff) return;

    const unsubCat = subscribeCategories((data) => {
      setCategories(data);
    });
    const unsubMat = subscribeMaterials((data) => {
      setMaterials(data);
    });
    const unsubSubj = subscribeSubjects((data) => {
      setSubjects(data);
    });
    const unsubTeach = subscribeTeachers((data) => {
      setTeachers(data);
    });
    const unsubStud = subscribeStudents((data) => {
      setStudents(data);
    });

    fetchStudents().then(setStudents).catch(() => {});
    fetchAllStudentProgress().then((prog) => {
      if (prog) {
        setAllStudentProgress(prog);
      }
    }).catch(() => {});

    return () => {
      unsubCat();
      unsubMat();
      unsubSubj();
      unsubTeach();
      unsubStud();
    };
  }, [authSession?.role]);

  // Real-time synchronization of teacher session with database updates
  useEffect(() => {
    if (authSession?.role === 'teacher' && authSession.teacher?.id && Array.isArray(teachers) && teachers.length > 0) {
      const freshTeacher = teachers.find((t) => t.id === authSession.teacher?.id);
      if (freshTeacher) {
        const currentT = authSession.teacher;
        const isDifferent =
          freshTeacher.name !== currentT.name ||
          freshTeacher.username !== currentT.username ||
          freshTeacher.nip !== currentT.nip ||
          freshTeacher.subjectId !== currentT.subjectId ||
          JSON.stringify(freshTeacher.assignedClasses || []) !== JSON.stringify(currentT.assignedClasses || []);

        if (isDifferent) {
          const updatedSession: AuthSession = {
            ...authSession,
            teacher: sanitizeTeacherForPublic(freshTeacher),
          };
          setAuthSession(updatedSession);
          try {
            localStorage.setItem('sistem_materi_auth_session', JSON.stringify(updatedSession));
          } catch {}
        }
      }
    }
  }, [teachers, authSession]);

  // On-demand loading for Leaderboard: fetch student directory and progress when leaderboard tab is active
  useEffect(() => {
    if (subjectSelectorTab === 'leaderboard') {
      if (students.length === 0) {
        fetchStudents().then(setStudents).catch(() => {});
      }
      if (Object.keys(allStudentProgress).length === 0) {
        fetchAllStudentProgress().then((prog) => {
          if (prog) setAllStudentProgress(prog);
        }).catch(() => {});
      }
    }
  }, [subjectSelectorTab, students.length, allStudentProgress]);

  // Ensure leftover subject/category selection keys are cleared on mount so dashboard always starts on Mata Pelajaran
  useEffect(() => {
    try {
      localStorage.removeItem('sistem_materi_selected_subject_id');
      localStorage.removeItem('sistem_materi_selected_category_id');
    } catch {}
  }, []);

  // Ensure selectedSubjectId stays in sync with selectedCategoryId
  useEffect(() => {
    if (selectedCategoryId && categories.length > 0) {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (cat && cat.subjectId && cat.subjectId !== selectedSubjectId) {
        setSelectedSubjectId(cat.subjectId);
      }
    }
  }, [selectedCategoryId, categories, selectedSubjectId]);

  // Always scroll immediately to the very top whenever view changes across all navigation levels
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (typeof document !== 'undefined') {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [selectedSubjectId, selectedCategoryId, viewMode]);

  const handleSelectSubject = (subjectId: string) => {
    confirmExitExam(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      setSelectedSubjectId(subjectId);
      setSelectedCategoryId(null);
      if (authSession?.role === 'student' && authSession?.student?.id) {
        const subName = subjects.find((s) => s.id === subjectId)?.name || subjectId;
        touchStudentActiveSession(authSession.student.id, {
          activeSubjectId: subjectId,
          activeSubjectName: subName,
          forceFlush: true,
        }).catch(() => {});
      }
    });
  };

  const handleBackToSubjects = () => {
    confirmExitExam(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      setSelectedSubjectId(null);
      setSelectedCategoryId(null);
      if (authSession?.role === 'student' && authSession?.student?.id) {
        touchStudentActiveSession(authSession.student.id, {
          activeSubjectId: null,
          activeSubjectName: null,
          forceFlush: true,
        }).catch(() => {});
      }
      if (typeof window !== 'undefined' && window.history.state?.appNavLevel === 'category_list') {
        try {
          window.history.back();
        } catch {}
      }
    });
  };

  const handleSelectCategory = (catId: string | null) => {
    confirmExitExam(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (catId) {
        const isStaff = authSession?.role === 'admin' || authSession?.role === 'teacher';
        if (!isStaff) {
          const targetCat = studentVisibleCategories.find((c) => c.id === catId);
          if (targetCat) {
            const unlockStatus = checkCategoryUnlockStatus(
              targetCat,
              studentVisibleCategories,
              studentVisibleMaterials,
              completedMaterialIds,
              authSession
            );
            if (!unlockStatus.isUnlocked) {
              return;
            }
          }
        }
        setSelectedCategoryId(catId);
      } else {
        if (typeof window !== 'undefined' && window.history.state?.appNavLevel === 'category_detail') {
          window.history.back();
        } else {
          setSelectedCategoryId(null);
        }
      }
    });
  };

  const handleDirectOpenMaterial = (subjectId: string, categoryId: string, materialId: string) => {
    confirmExitExam(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const isStaff = authSession?.role === 'admin' || authSession?.role === 'teacher';
      let targetMatId = materialId;

      if (!isStaff) {
        const targetCat = studentVisibleCategories.find((c) => c.id === categoryId);
        if (targetCat) {
          const unlockStatus = checkCategoryUnlockStatus(
            targetCat,
            studentVisibleCategories,
            studentVisibleMaterials,
            completedMaterialIds,
            authSession
          );
          if (!unlockStatus.isUnlocked) {
            return;
          }
        }

        // Verify if target material itself is unlocked
        const targetMat = studentVisibleMaterials.find((m) => m.id === materialId);
        if (targetMat) {
          const matUnlockStatus = checkMaterialUnlockStatus(
            targetMat,
            studentVisibleMaterials,
            studentVisibleCategories,
            completedMaterialIds,
            authSession
          );
          if (!matUnlockStatus.isUnlocked) {
            // Find the active unlocked material in that category instead
            const catMats = studentVisibleMaterials
              .filter((m) => m.categoryId === categoryId && m.isPublished !== false)
              .sort((a, b) => (a.order || 0) - (b.order || 0));

            let fallbackMatId = catMats[0]?.id || materialId;
            for (const m of catMats) {
              const status = checkMaterialUnlockStatus(
                m,
                studentVisibleMaterials,
                studentVisibleCategories,
                completedMaterialIds,
                authSession
              );
              if (status.isUnlocked) {
                fallbackMatId = m.id;
              } else {
                break;
              }
            }
            targetMatId = fallbackMatId;
          }
        }
      }
      setSelectedSubjectId(subjectId);
      setSelectedCategoryId(categoryId);
      if (authSession?.role === 'student' && authSession?.student?.id) {
        const subName = subjects.find((s) => s.id === subjectId)?.name || subjectId;
        touchStudentActiveSession(authSession.student.id, {
          activeSubjectId: subjectId,
          activeSubjectName: subName,
          forceFlush: true,
        }).catch(() => {});
      }
      try {
        localStorage.setItem(`sistem_materi_active_mat_${categoryId}`, targetMatId);
      } catch {}
    });
  };

  // Support Android physical / gesture Back Button & browser back navigation
  useMobileHardwareBack({
    selectedSubjectId,
    selectedCategoryId,
    onBackToSubjects: () => {
      setSelectedSubjectId(null);
      setSelectedCategoryId(null);
      if (authSession?.role === 'student' && authSession?.student?.id) {
        touchStudentActiveSession(authSession.student.id, {
          activeSubjectId: null,
          activeSubjectName: null,
          forceFlush: true,
        }).catch(() => {});
      }
    },
    onBackToCategories: () => {
      setSelectedCategoryId(null);
    },
  });

  // Intercept top-level modals for mobile hardware back button
  useMobileBackModal('app-guide-modal', isGuideOpen, () => setIsGuideOpen(false));
  useMobileBackModal('app-admin-login-modal', isAdminLoginOpen, () => setIsAdminLoginOpen(false));
  useMobileBackModal('app-admin-dashboard-modal', isAdminDashboardOpen, () => setIsAdminDashboardOpen(false));

  // Save student progress to localStorage & Firestore per student ID
  const handleToggleCompleted = (materialId: string, options?: { localOnly?: boolean }) => {
    const isNowCompleted = !completedMaterialIds.includes(materialId);
    const nextIds = isNowCompleted
      ? [...completedMaterialIds, materialId]
      : completedMaterialIds.filter((id) => id !== materialId);

    const nowIso = new Date().toISOString();
    const nextTimes = { ...completedMaterialTimestamps };
    let nextLogs = [...activityLogs];

    if (isNowCompleted) {
      nextTimes[materialId] = nowIso;
      const targetMat = materials.find((m) => m.id === materialId);
      const targetCat = categories.find((c) => c.id === targetMat?.categoryId);
      const targetSubj = subjects.find((s) => s.id === targetCat?.subjectId);
      const newLogEntry: MaterialActivityLog = {
        materialId,
        materialTitle: targetMat?.title || 'Materi Pembelajaran',
        categoryId: targetCat?.id,
        categoryTitle: targetCat?.title,
        subjectId: targetSubj?.id,
        subjectName: targetSubj?.name,
        completedAt: nowIso,
        type: targetMat?.type,
      };
      nextLogs = [newLogEntry, ...nextLogs.filter((l) => l.materialId !== materialId)];
    } else {
      delete nextTimes[materialId];
      nextLogs = nextLogs.filter((l) => l.materialId !== materialId);
    }

    setCompletedMaterialIds(nextIds);
    setCompletedMaterialTimestamps(nextTimes);
    setActivityLogs(nextLogs);

    if (authSession?.student) {
      const student = authSession.student;
      const studentId = student.id;
      const candidateIds = [
        student.id,
        student.nisn,
        student.username,
      ].filter(Boolean) as string[];

      // Real-time calculation of global completed count and percentage
      const completedCount = (studentPublishedMaterials || []).filter((m) => nextIds.includes(m.id)).length;
      const totalMaterialsCount = studentPublishedMaterials.length;
      const progressPercent = totalMaterialsCount > 0 ? Math.round((completedCount / totalMaterialsCount) * 100) : 0;

      try {
        candidateIds.forEach((sid) => {
          localStorage.setItem(`sistem_materi_prog_${sid}`, JSON.stringify(nextIds));
          localStorage.setItem(`sistem_materi_prog_times_${sid}`, JSON.stringify(nextTimes));
          localStorage.setItem(`sistem_materi_activity_logs_${sid}`, JSON.stringify(nextLogs));
          localStorage.setItem(`sistem_materi_prog_percent_${sid}`, JSON.stringify(progressPercent));
          localStorage.setItem(`sistem_materi_completed_count_${sid}`, JSON.stringify(completedCount));
          localStorage.setItem(`sistem_materi_total_materials_${sid}`, JSON.stringify(totalMaterialsCount));
        });
      } catch {}

      // If localOnly flag is set (e.g. from MiniQuizSection where saveStudentQuizScore already committed to Firestore),
      // avoid redundant double writes to conserve quota and database transactions.
      if (options?.localOnly) {
        return;
      }

      saveStudentProgress(
        studentId,
        nextIds,
        student.nama,
        student.kelas,
        nextTimes,
        nextLogs,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          progressPercent,
          completedCount,
          totalMaterialsCount,
        },
        candidateIds,
        { immediate: true, explicitSet: !isNowCompleted }
      );
    } else {
      try {
        localStorage.setItem('sistem_materi_completed', JSON.stringify(nextIds));
      } catch {}
    }
  };

  const handleSaveNote = (materialId: string, noteText: string) => {
    setUserNotes((prev) => {
      const next = { ...prev, [materialId]: noteText };
      if (authSession?.student) {
        const studentId = authSession.student.id;
        try {
          localStorage.setItem(`sistem_materi_notes_${studentId}`, JSON.stringify(next));
        } catch {}
        saveStudentNotesAndBookmarks(studentId, next, undefined);
      } else {
        try {
          localStorage.setItem('sistem_materi_notes', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const handleToggleBookmark = (materialId: string) => {
    setBookmarkedMaterialIds((prev) => {
      const isRemoving = prev.includes(materialId);
      const next = isRemoving
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId];
      if (authSession?.student) {
        const studentId = authSession.student.id;
        try {
          localStorage.setItem(`sistem_materi_bookmarks_${studentId}`, JSON.stringify(next));
        } catch {}
        saveStudentNotesAndBookmarks(studentId, undefined, next, { explicitSet: isRemoving });
      } else {
        try {
          localStorage.setItem('sistem_materi_bookmarks', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  // Auth Handlers (Admin / Teacher / Student)
  const handleAuthLoginSuccess = async (session: AuthSession) => {
    const cleanSession = sanitizeAuthSession(session);
    setAuthSession(cleanSession);
    setViewMode('dashboard');
    try {
      localStorage.setItem('sistem_materi_auth_session', JSON.stringify(cleanSession));
    } catch {}

    // ALWAYS reset selection on login so student starts at "Pilih Mata Pelajaran"!
    setSelectedSubjectId(null);
    localStorage.removeItem('sistem_materi_selected_subject_id');
    setSelectedCategoryId(null);
    localStorage.removeItem('sistem_materi_selected_category_id');

    // Trigger fresh load on login to immediately sync any newly added topics/subjects
    loadData(false, true).catch(() => {});

    if (session.student) {
      const student = session.student;
      const studentId = student.id;
      const candidateIds = [
        student.id,
        student.nisn,
        student.username,
      ].filter(Boolean) as string[];

      // Mark student online immediately in Firestore
      updateStudentOnlineStatus(studentId, true).catch(() => {});

      // Load best local cache across all candidate IDs immediately
      let initialProg: string[] = [];
      let initialTimes: Record<string, string> = {};
      let initialLogs: MaterialActivityLog[] = [];
      let initialNotes: Record<string, string> = {};
      let initialBookmarks: string[] = [];

      for (const sid of candidateIds) {
        try {
          const p = localStorage.getItem(`sistem_materi_prog_${sid}`);
          if (p && p !== 'null' && p !== 'undefined') {
            const parsed = JSON.parse(p);
            if (Array.isArray(parsed) && parsed.length > initialProg.length) initialProg = parsed;
          }
          const t = localStorage.getItem(`sistem_materi_prog_times_${sid}`);
          if (t && t !== 'null' && t !== 'undefined' && Object.keys(initialTimes).length === 0) {
            const parsed = JSON.parse(t);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) initialTimes = parsed;
          }
          const l = localStorage.getItem(`sistem_materi_activity_logs_${sid}`);
          if (l && l !== 'null' && l !== 'undefined' && initialLogs.length === 0) {
            const parsed = JSON.parse(l);
            if (Array.isArray(parsed)) initialLogs = parsed;
          }
          const n = localStorage.getItem(`sistem_materi_notes_${sid}`);
          if (n && n !== 'null' && n !== 'undefined' && Object.keys(initialNotes).length === 0) {
            const parsed = JSON.parse(n);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) initialNotes = parsed;
          }
          const b = localStorage.getItem(`sistem_materi_bookmarks_${sid}`);
          if (b && b !== 'null' && b !== 'undefined' && initialBookmarks.length === 0) {
            const parsed = JSON.parse(b);
            if (Array.isArray(parsed)) initialBookmarks = parsed;
          }
        } catch {}
      }

      if (initialProg.length > 0) setCompletedMaterialIds(initialProg);
      if (Object.keys(initialTimes).length > 0) setCompletedMaterialTimestamps(initialTimes);
      if (initialLogs.length > 0) setActivityLogs(initialLogs);
      if (Object.keys(initialNotes).length > 0) setUserNotes(initialNotes);
      if (initialBookmarks.length > 0) setBookmarkedMaterialIds(initialBookmarks);

      // Sync latest progress & quiz scores fresh from Firestore
      try {
        const [details] = await Promise.all([
          fetchStudentProgressDetails(studentId, {
            forceRevalidate: true,
            additionalIds: candidateIds,
            studentName: student.nama,
            kelas: student.kelas,
          }),
          fetchStudentQuizScores(studentId, {
            forceRevalidate: true,
            additionalIds: candidateIds,
            studentName: student.nama,
          }),
        ]);
        if (details && Array.isArray(details.completedMaterialIds)) {
          setCompletedMaterialIds(details.completedMaterialIds);
          if (details.completedMaterialTimestamps) {
            setCompletedMaterialTimestamps(details.completedMaterialTimestamps);
          }
          if (details.activityLogs) setActivityLogs(details.activityLogs);
          if (details.notes) setUserNotes(details.notes);
          if (details.bookmarkedMaterialIds) setBookmarkedMaterialIds(details.bookmarkedMaterialIds);
        }
      } catch {
        // Silently use cached progress
      }
    } else {
      setCompletedMaterialIds([]);
      setCompletedMaterialTimestamps({});
      setActivityLogs([]);
    }

    if (session.role === 'admin') {
      setIsAdmin(true);
      localStorage.setItem('sistem_materi_admin_auth', 'true');
    } else {
      setIsAdmin(false);
      localStorage.removeItem('sistem_materi_admin_auth');
    }
  };

  const handleAdminLogout = () => {
    // If student is logging out, instantly mark them offline in Firestore and clear student-specific local cache
    if (authSession?.role === 'student' && authSession?.student) {
      const student = authSession.student;
      const studentId = student.id;
      if (studentId) {
        markStudentOfflineImmediately(studentId);
        updateStudentOnlineStatus(studentId, false).catch(() => {});
      }

      // Flush any pending debounced progress writes to ensure no progress is lost before logout
      flushAllPendingProgressWrites().catch(() => {});

      // Clear student-specific local caches so that when another student logs in on the same lab computer,
      // no stale progress, quiz scores, notes, or gamification flash on screen
      const candidateIds = Array.from(
        new Set([student.id, student.nisn, student.username].filter(Boolean) as string[])
      );
      candidateIds.forEach((sid) => {
        try {
          localStorage.removeItem(`sistem_materi_prog_${sid}`);
          localStorage.removeItem(`sistem_materi_scores_${sid}`);
          localStorage.removeItem(`sistem_materi_notes_${sid}`);
          localStorage.removeItem(`sistem_materi_gamification_${sid}`);
          localStorage.removeItem(`sistem_materi_quiz_attempts_${sid}`);
          localStorage.removeItem(`sistem_materi_prog_times_${sid}`);
          localStorage.removeItem(`sistem_materi_timestamps_${sid}`);
          localStorage.removeItem(`sistem_materi_prog_percent_${sid}`);
          localStorage.removeItem(`sistem_materi_completed_count_${sid}`);
          localStorage.removeItem(`sistem_materi_total_materials_${sid}`);
          localStorage.removeItem(`sistem_materi_activity_logs_${sid}`);
          localStorage.removeItem(`sistem_materi_activity_${sid}`);
          localStorage.removeItem(`sistem_materi_bookmarks_${sid}`);
          localStorage.removeItem(`sistem_materi_prog_details_${sid}`);
        } catch {}
      });
    }

    setAuthSession(null);
    setIsAdmin(false);
    setViewMode('dashboard');
    setSelectedSubjectId(null);
    setSelectedCategoryId(null);
    setCompletedMaterialIds([]);
    setCompletedMaterialTimestamps({});
    setActivityLogs([]);
    setUserNotes({});
    setBookmarkedMaterialIds([]);
    localStorage.removeItem('sistem_materi_auth_session');
    localStorage.removeItem('sistem_materi_admin_auth');
    localStorage.removeItem('sistem_materi_selected_subject_id');
    localStorage.removeItem('sistem_materi_selected_category_id');
  };

  // Active subject refs for zero-waste presence & subject-specific duration tracking
  const activeSubjectIdRef = useRef<string | null>(selectedSubjectId);
  activeSubjectIdRef.current = selectedSubjectId;

  const activeSubjectNameRef = useRef<string | null>(null);
  activeSubjectNameRef.current = subjects.find((s) => s.id === selectedSubjectId)?.name || null;

  // Subject change listener: flush previous subject duration immediately and update activeSubjectId
  useEffect(() => {
    if (authSession?.role !== 'student' || !authSession?.student?.id) return;
    const studentId = authSession.student.id;
    const subName = selectedSubjectId
      ? (subjects.find((s) => s.id === selectedSubjectId)?.name || selectedSubjectId)
      : null;
    touchStudentActiveSession(studentId, {
      activeSubjectId: selectedSubjectId || null,
      activeSubjectName: subName,
      forceFlush: true,
    }).catch(() => {});
  }, [selectedSubjectId, authSession?.role, authSession?.student?.id, subjects]);

  // Real-time student presence & heartbeat: High-Precision Tab Visibility & Idle Detection (Zero-Waste Firestore)
  useEffect(() => {
    if (authSession?.role !== 'student' || !authSession?.student?.id) {
      return;
    }
    const studentId = authSession.student.id;
    const currentSubName = subjects.find((s) => s.id === activeSubjectIdRef.current)?.name || null;

    // Immediately mark student as online when session mounts without unearned initial accumulation
    touchStudentActiveSession(studentId, {
      activeSubjectId: activeSubjectIdRef.current,
      activeSubjectName: currentSubName,
      forceFlush: true,
      skipAccumulation: true,
    }).catch(() => {});

    let lastUserInteraction = Date.now();
    let lastThrottledMove = 0;
    const handleUserInteraction = (e?: Event) => {
      if (e?.type === 'mousemove' || e?.type === 'pointermove') {
        const now = Date.now();
        if (now - lastThrottledMove < 2000) return;
        lastThrottledMove = now;
      }
      lastUserInteraction = Date.now();
    };

    // Helper for cross-browser requestIdleCallback with timeout fallback
    let idleCallbackId: number | null = null;
    let fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleHeartbeatWrite = (forceFlush = false, skipAccumulation = false) => {
      const runTouch = () => {
        // Strict visibility and idle verification before dispatching write to Firestore
        const isDocVisible = typeof document !== 'undefined' && document.visibilityState === 'visible' && !document.hidden;
        const isIdle = Date.now() - lastUserInteraction > 180000; // > 3 mins idle

        if (!forceFlush && (!isDocVisible || isIdle)) {
          return;
        }

        touchStudentActiveSession(studentId, {
          activeSubjectId: activeSubjectIdRef.current,
          activeSubjectName: subjects.find((s) => s.id === activeSubjectIdRef.current)?.name || null,
          forceFlush,
          skipAccumulation,
        }).catch(() => {});
      };

      if (forceFlush) {
        // Immediate execution for state transitions (e.g. tab visibility switch or beforeunload)
        runTouch();
        return;
      }

      // Non-blocking dispatch via requestIdleCallback to keep rendering and user interactions 100% smooth
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        if (idleCallbackId !== null) {
          (window as any).cancelIdleCallback(idleCallbackId);
        }
        idleCallbackId = (window as any).requestIdleCallback(
          () => {
            idleCallbackId = null;
            runTouch();
          },
          { timeout: 2000 }
        );
      } else {
        if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
        fallbackTimeoutId = setTimeout(() => {
          fallbackTimeoutId = null;
          runTouch();
        }, 100);
      }
    };

    // High-Precision Drift-Corrected Heartbeat Tracker
    // Runs every 1000ms to strictly accumulate verified foreground active study time
    const TICK_INTERVAL_MS = 1000;
    const HEARTBEAT_THRESHOLD_MS = 20000; // Dispatch Firestore heartbeat every 20 seconds of active study
    const IDLE_TIMEOUT_MS = 180000; // 3 minutes idle cutoff

    let activeAccumulatedMs = 0;
    let lastTickTime = Date.now();

    const precisionInterval = setInterval(() => {
      const now = Date.now();
      const deltaMs = Math.min(2500, Math.max(0, now - lastTickTime));
      lastTickTime = now;

      // 1. Strict Visibility Check: only count time when tab is strictly visible in the foreground
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible' && !document.hidden;
      // 2. Strict User Idle Check: pause tracking if user hasn't interacted for > 3 minutes
      const isUserActive = (now - lastUserInteraction) <= IDLE_TIMEOUT_MS;

      if (!isVisible || !isUserActive) {
        // When not visible or idle, do not accumulate active study time!
        return;
      }

      activeAccumulatedMs += deltaMs;

      // Once 20 seconds of verified foreground active study time has accumulated, dispatch via requestIdleCallback
      if (activeAccumulatedMs >= HEARTBEAT_THRESHOLD_MS) {
        activeAccumulatedMs = 0;
        scheduleHeartbeatWrite(false, false);
      }
    }, TICK_INTERVAL_MS);

    // Passive activity listeners to track user presence accurately
    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });
    window.addEventListener('mousemove', handleUserInteraction, { passive: true });

    // Stricter Visibility & Focus Change Handling
    const handleVisibility = () => {
      const isNowVisible = typeof document !== 'undefined' && document.visibilityState === 'visible' && !document.hidden;

      if (isNowVisible) {
        // Tab brought to foreground: reset timers and touch session with skipAccumulation: true
        // so the student is marked online immediately, but offline/background time is NOT credited!
        lastUserInteraction = Date.now();
        lastTickTime = Date.now();
        activeAccumulatedMs = 0;
        scheduleHeartbeatWrite(true, true);
      } else {
        // Tab hidden, minimized, or switched: immediately flush accumulated seconds to Firestore!
        scheduleHeartbeatWrite(true, false);
        activeAccumulatedMs = 0;
        lastTickTime = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Also listen to window focus/blur for stricter foreground presence tracking
    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible' && !document.hidden) {
        lastUserInteraction = Date.now();
        lastTickTime = Date.now();
      }
    };
    const handleWindowBlur = () => {
      // When window loses focus, flush pending study time immediately
      scheduleHeartbeatWrite(true, false);
      activeAccumulatedMs = 0;
      lastTickTime = Date.now();
    };
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    // When browser tab is closed or window is navigated away, instantly fire multi-channel offline beacon
    const handleTabClose = () => {
      markStudentOfflineImmediately(studentId);
    };
    window.addEventListener('pagehide', handleTabClose);
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      clearInterval(precisionInterval);
      if (idleCallbackId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);

      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      window.removeEventListener('mousemove', handleUserInteraction);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handleTabClose);
      window.removeEventListener('beforeunload', handleTabClose);
      // Clean up presence on unmount / session change
      markStudentOfflineImmediately(studentId);
    };
  }, [authSession?.role, authSession?.student?.id, subjects]);

  // Class-based content filtering for students
  const {
    filteredSubjects: studentVisibleSubjects,
    filteredCategories: studentVisibleCategories,
    filteredMaterials: studentVisibleMaterials,
  } = useMemo(() => {
    const safeTeachers = Array.isArray(teachers) ? teachers : [];
    const safeSubjects = Array.isArray(subjects) ? subjects : [];
    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeMaterials = Array.isArray(materials) ? materials : [];

    if (authSession?.role === 'student' && authSession.student) {
      const filtered = filterContentForStudent(
        authSession.student,
        safeTeachers,
        safeSubjects,
        safeCategories,
        safeMaterials
      );
      return {
        filteredSubjects: Array.isArray(filtered.filteredSubjects) ? filtered.filteredSubjects : [],
        filteredCategories: Array.isArray(filtered.filteredCategories) ? filtered.filteredCategories : [],
        filteredMaterials: Array.isArray(filtered.filteredMaterials) ? filtered.filteredMaterials : [],
      };
    }
    const isStaff = authSession?.role === 'admin' || authSession?.role === 'teacher';
    if (!isStaff) {
      return {
        filteredSubjects: safeSubjects,
        filteredCategories: safeCategories.filter((c) => c && c.isPublished !== false),
        filteredMaterials: safeMaterials.filter((m) => m && m.isPublished),
      };
    }
    return {
      filteredSubjects: safeSubjects,
      filteredCategories: safeCategories,
      filteredMaterials: safeMaterials,
    };
  }, [authSession, teachers, subjects, categories, materials]);

  // Auto-reset selected subject & category if student has no access to them
  useEffect(() => {
    if (authSession?.role === 'student') {
      if (selectedSubjectId && !studentVisibleSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(null);
        setSelectedCategoryId(null);
        localStorage.removeItem('sistem_materi_selected_subject_id');
        localStorage.removeItem('sistem_materi_selected_category_id');
      } else if (selectedCategoryId && !studentVisibleCategories.some((c) => c.id === selectedCategoryId)) {
        setSelectedCategoryId(null);
        localStorage.removeItem('sistem_materi_selected_category_id');
      }
    }
  }, [authSession?.role, selectedSubjectId, selectedCategoryId, studentVisibleSubjects, studentVisibleCategories]);

  const currentSubject = (studentVisibleSubjects || []).find((s) => s && s.id === selectedSubjectId);
  const selectedCategory = (studentVisibleCategories || []).find((c) => c && c.id === selectedCategoryId);

  // Per-Subject Progress Calculation
  const activeSubjectCats = currentSubject
    ? (studentVisibleCategories || []).filter((c) => c && (c.subjectId === currentSubject.id || (!c.subjectId && currentSubject.id === 'informatika')))
    : [];
  const activeSubjectCatIds = (activeSubjectCats || []).map((c) => c?.id).filter(Boolean);
  const activeSubjectMaterials = currentSubject
    ? (studentVisibleMaterials || []).filter((m) => m && activeSubjectCatIds.includes(m.categoryId) && m.isPublished)
    : [];
  const activeSubjectCompletedCount = (activeSubjectMaterials || []).filter((m) =>
    normalizeCompletedMaterialIds(completedMaterialIds).includes(m.id)
  ).length;

  // Global Student Published Materials & Progress (Consistent with Dashboard Ringkasan Belajar)
  const studentPublishedMaterials = useMemo(() => {
    return (studentVisibleMaterials || []).filter((m) => m && m.isPublished);
  }, [studentVisibleMaterials]);

  const globalStudentCompletedCount = useMemo(() => {
    const safeCompleted = normalizeCompletedMaterialIds(completedMaterialIds);
    return studentPublishedMaterials.filter((m) => safeCompleted.includes(m.id)).length;
  }, [studentPublishedMaterials, completedMaterialIds]);

  const globalStudentTotalCount = studentPublishedMaterials.length;

  // Optimistic Save Handlers (instant real-time UI response)
  const handleSaveCategoryOptimistic = (cat: Category, isNew = false) => {
    setCategories((prev) => {
      const safePrev = prev || [];
      const exists = safePrev.some((c) => c && c.id === cat.id);
      const updated = exists ? safePrev.map((c) => (c && c.id === cat.id ? cat : c)) : [...safePrev, cat];
      const sorted = [...updated].sort((a, b) => (a?.order || 0) - (b?.order || 0));
      try {
        localStorage.setItem('sistem_materi_cat_cache', JSON.stringify(sorted));
      } catch {}
      return sorted;
    });
  };

  const handleSaveMaterialOptimistic = (mat: Material, isNew = false) => {
    setMaterials((prev) => {
      const safePrev = prev || [];
      const exists = safePrev.some((m) => m && m.id === mat.id);
      const updated = exists ? safePrev.map((m) => (m && m.id === mat.id ? mat : m)) : [...safePrev, mat];
      const sorted = [...updated].sort((a, b) => (a?.order || 0) - (b?.order || 0));
      try {
        localStorage.setItem('sistem_materi_mat_cache', JSON.stringify(sorted));
      } catch {}
      return sorted;
    });
  };

  const handleSaveSubjectOptimistic = (subj: Subject, isNew = false) => {
    setSubjects((prev) => {
      const safePrev = prev || [];
      const exists = safePrev.some((s) => s && s.id === subj.id);
      const updated = exists ? safePrev.map((s) => (s && s.id === subj.id ? subj : s)) : [...safePrev, subj];
      const sorted = [...updated].sort((a, b) => (a?.order || 0) - (b?.order || 0));
      try {
        localStorage.setItem('sistem_materi_subj_cache', JSON.stringify(sorted));
      } catch {}
      return sorted;
    });
  };

  // Optimistic Delete Handlers
  const handleDeleteSubjectOptimistic = (id: string) => {
    setSubjects((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem('sistem_materi_subj_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setCategories((prev) => {
      const updated = prev.filter((c) => c.subjectId !== id);
      try {
        localStorage.setItem('sistem_materi_cat_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleDeleteMaterialOptimistic = (id: string) => {
    setMaterials((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      try {
        localStorage.setItem('sistem_materi_mat_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleDeleteCategoryOptimistic = (id: string) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem('sistem_materi_cat_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setMaterials((prev) => {
      const updated = prev.filter((m) => m.categoryId !== id);
      try {
        localStorage.setItem('sistem_materi_mat_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  if (!authSession) {
    return (
      <InitialLoginScreen
        onLoginSuccess={handleAuthLoginSuccess}
        siteLogoUrl={siteLogoUrl}
      />
    );
  }

  if ((authSession.role === 'admin' || authSession.role === 'teacher') && viewMode === 'dashboard') {
    return (
      <>
        <AdminDashboard
          isOpen={true}
          onClose={handleAdminLogout}
          onLogout={handleAdminLogout}
          onSwitchToStudentView={() => setViewMode('student_preview')}
          subjects={subjects}
          categories={categories}
          materials={materials}
          teachers={teachers}
          students={students}
          authSession={authSession}
          onRefreshData={() => loadData(false, true)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onSaveSubjectOptimistic={handleSaveSubjectOptimistic}
          onSaveCategoryOptimistic={handleSaveCategoryOptimistic}
          onSaveMaterialOptimistic={handleSaveMaterialOptimistic}
          onDeleteSubjectOptimistic={handleDeleteSubjectOptimistic}
          onDeleteMaterialOptimistic={handleDeleteMaterialOptimistic}
          onDeleteCategoryOptimistic={handleDeleteCategoryOptimistic}
          siteLogoUrl={siteLogoUrl}
          onUpdateSiteLogoUrl={(newUrl) => setSiteLogoUrl(newUrl)}
        />
        <DriveGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-slate-50/90 text-slate-800 font-sans antialiased flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-x-clip bg-grid-pattern pb-[env(safe-area-inset-bottom,0px)]">
        
        {/* Student Preview Mode Banner for Admin/Teacher */}
        {(authSession.role === 'admin' || authSession.role === 'teacher') && viewMode === 'student_preview' && (
          <StudentPreviewBanner
            role={authSession.role}
            onExitPreview={() => setViewMode('dashboard')}
          />
        )}
        
        {/* Decorative Educational Background Ornaments & Glows */}
        {!examSession.isActive && <EducationalBackground />}

        {/* Navbar with subtle Admin login button top-right */}
        {!examSession.isActive && (
          <Navbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isAdmin={isAdmin}
            authSession={authSession}
            onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
            onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
            onLogoutAdmin={handleAdminLogout}
            completedCount={activeSubjectCompletedCount}
            totalMaterialsCount={activeSubjectMaterials.length}
            overallCompletedCount={globalStudentCompletedCount}
            overallTotalMaterialsCount={globalStudentTotalCount}
            selectedSubjectName={currentSubject?.name}
            onGoHome={handleBackToSubjects}
            logoUrl={siteLogoUrl}
            onOpenLeaderboard={() => {
              setSelectedSubjectId(null);
              setSelectedCategoryId(null);
              setSubjectSelectorTab('leaderboard');
              setMobileNavTab('leaderboard');
            }}
            onOpenIcebreakingGame={() => setIsJoinGameModalOpen(true)}
          />
        )}

        {/* Global Offline Mode & Firestore Sync Notification Banner */}
        <OfflineNotificationBanner isExamActive={examSession.isActive} />

        {/* Main Content View Container */}
        <main className={examSession.isActive ? "flex-1 w-full relative z-10 p-0 m-0" : "flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 pb-20 sm:pt-5 sm:pb-6 relative z-10"}>
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="py-24 flex flex-col items-center justify-center space-y-4"
              >
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm sm:text-base font-semibold text-slate-500">Menghubungkan ke Database Firestore...</p>
              </motion.div>
            ) : selectedCategory ? (
              <motion.div
                key={`category-detail-${selectedCategory.id}`}
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onAnimationStart={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                }}
              >
                <CategoryDetail
                  category={selectedCategory}
                  subjectName={subjects.find((s) => s.id === (selectedCategory.subjectId || selectedSubjectId))?.name}
                  materials={studentVisibleMaterials.filter((m) => m.categoryId === selectedCategory.id)}
                  allCategories={studentVisibleCategories}
                  allMaterials={studentVisibleMaterials}
                  completedMaterialIds={completedMaterialIds}
                  onToggleCompleted={handleToggleCompleted}
                  userNotes={userNotes}
                  onSaveNote={handleSaveNote}
                  bookmarkedMaterialIds={bookmarkedMaterialIds}
                  onToggleBookmark={handleToggleBookmark}
                  onBackToHome={() => handleSelectCategory(null)}
                  authSession={authSession}
                />
              </motion.div>
            ) : selectedSubjectId ? (
              <motion.div
                key={`category-list-${selectedSubjectId}`}
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onAnimationStart={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                }}
              >
                <CategoryList
                  currentSubject={currentSubject}
                  categories={studentVisibleCategories}
                  materials={studentVisibleMaterials}
                  searchQuery={searchQuery}
                  completedMaterialIds={completedMaterialIds}
                  onSelectCategory={(catId) => handleSelectCategory(catId)}
                  onBackToSubjects={handleBackToSubjects}
                  onOpenGuide={() => setIsGuideOpen(true)}
                  authSession={authSession}
                />
              </motion.div>
            ) : (
              <motion.div
                key="subject-selector"
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onAnimationStart={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                }}
              >
                <SubjectSelector
                  subjects={studentVisibleSubjects}
                  categories={studentVisibleCategories}
                  materials={studentVisibleMaterials}
                  teachers={teachers}
                  completedMaterialIds={completedMaterialIds}
                  completedMaterialTimestamps={completedMaterialTimestamps}
                  activityLogs={activityLogs}
                  searchQuery={searchQuery}
                  onSelectSubject={handleSelectSubject}
                  onDirectOpenMaterial={handleDirectOpenMaterial}
                  onOpenGuide={() => setIsGuideOpen(true)}
                  authSession={authSession}
                  bookmarkedMaterialIds={bookmarkedMaterialIds}
                  onToggleBookmark={handleToggleBookmark}
                  userNotes={userNotes}
                  onSaveNote={handleSaveNote}
                  students={students}
                  allStudentProgress={allStudentProgress}
                  activeTab={subjectSelectorTab}
                  onTabChange={(t) => {
                    setSubjectSelectorTab(t);
                    if (t === 'subjects') setMobileNavTab('materials');
                    else if (t === 'bookmarks') setMobileNavTab('bookmarks');
                    else if (t === 'leaderboard') setMobileNavTab('leaderboard');
                    else if (t === 'activity_log') setMobileNavTab('results');
                  }}
                  onOpenIcebreakingGame={() => setIsJoinGameModalOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        {!examSession.isActive && <AppFooter />}

        {/* Mobile Bottom Navigation for Students */}
        {authSession && (authSession.role === 'student' || viewMode === 'student_preview') && (
          <MobileBottomNav
            activeTab={mobileNavTab}
            onTabChange={(tab) => {
              setMobileNavTab(tab);
              if (authSession?.role === 'student' && authSession?.student?.id) {
                touchStudentActiveSession(authSession.student.id, {
                  activeSubjectId: null,
                  activeSubjectName: null,
                  forceFlush: true,
                }).catch(() => {});
              }
              if (tab === 'materials') {
                setSelectedSubjectId(null);
                setSelectedCategoryId(null);
                setSubjectSelectorTab('subjects');
              } else if (tab === 'bookmarks') {
                setSelectedSubjectId(null);
                setSelectedCategoryId(null);
                setSubjectSelectorTab('bookmarks');
              } else if (tab === 'leaderboard') {
                setSelectedSubjectId(null);
                setSelectedCategoryId(null);
                setSubjectSelectorTab('leaderboard');
              } else if (tab === 'results') {
                setSelectedSubjectId(null);
                setSelectedCategoryId(null);
                setSubjectSelectorTab('activity_log');
              } else if (tab === 'profile') {
                setIsMobileProfileOpen(true);
              }
            }}
            completedCount={globalStudentCompletedCount}
            totalMaterialsCount={globalStudentTotalCount}
            bookmarkedCount={bookmarkedMaterialIds.length}
            authSession={authSession}
            examActive={examSession.isActive}
          />
        )}

        {/* Mobile Profile Modal */}
        <UserProfileModal
          isOpen={isMobileProfileOpen}
          onClose={() => setIsMobileProfileOpen(false)}
          authSession={authSession}
          isAdmin={isAdmin}
          completedCount={globalStudentCompletedCount}
          totalMaterialsCount={globalStudentTotalCount}
          selectedSubjectName={currentSubject?.name}
          subjectCompletedCount={activeSubjectCompletedCount}
          subjectTotalCount={activeSubjectMaterials.length}
          onLogout={handleAdminLogout}
          onOpenAdminDashboard={() => {
            setIsMobileProfileOpen(false);
            setIsAdminDashboardOpen(true);
          }}
        />

        {/* Modals */}
        <DriveGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />

        <ExamExitModal />
        <AntiCheatModal />

        {/* Icebreaking Multiplayer Game Full-Screen View - Isolated Hardware Accelerated Wrapper */}
        {activeGameSession && (
          <div
            id="student-game-overlay-wrapper"
            className="fixed inset-0 z-50 overflow-hidden bg-slate-950"
            style={{
              backgroundColor: '#020617',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
          >
            <StudentGameView
              initialSession={activeGameSession}
              student={
                authSession?.student || {
                  id: authSession?.teacher?.id || 'preview_student',
                  nama: authSession?.teacher?.name || 'Siswa Pratinjau',
                  kelas: '7A',
                  username: 'siswa_preview',
                  noAbsen: '01',
                  nisn: '0000000000',
                  createdAt: '',
                  updatedAt: '',
                }
              }
              onExitGame={() => setActiveGameSession(null)}
            />
          </div>
        )}

        {/* Icebreaking Game Token Entry Modal */}
        {isJoinGameModalOpen && (
          <StudentJoinGameModal
            isOpen={isJoinGameModalOpen}
            onClose={() => setIsJoinGameModalOpen(false)}
            student={
              authSession?.student || {
                id: authSession?.teacher?.id || 'preview_student',
                nama: authSession?.teacher?.name || 'Siswa Pratinjau',
                kelas: '7A',
                username: 'siswa_preview',
                noAbsen: '01',
                nisn: '0000000000',
                createdAt: '',
                updatedAt: '',
              }
            }
            onJoined={(session) => {
              setActiveGameSession(session);
              setIsJoinGameModalOpen(false);
            }}
          />
        )}

      </div>
  );
}
