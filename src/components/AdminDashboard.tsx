import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { Subject, Category, Material, TeacherAccount, StudentAccount, AuthSession, QuizQuestion } from '../types';
import { fetchAIGeneratedQuizBank, generateFallbackQuizBank } from '../utils/quizGenerator';
import { isMaterialGoogleForm } from '../utils/urlParser';
import {
  createSubject,
  updateSubject,
  deleteSubject,
  createCategory,
  updateCategory,
  deleteCategory,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  createStudent,
  updateStudent,
  deleteStudent,
  setSiteLogoUrl,
  getStudentOnlineStatus,
} from '../lib/dataService';
import {
  AdminHeader,
  AdminSidebar,
  AdminTabType,
  AdminTabCounts,
  GuideLinkModal,
  AntiCheatLogsModal,
  MaterialModal,
  SubjectModal,
  CategoryModal,
  TeacherManager,
  SettingsManager,
  SubjectListView,
  CategoryListView,
  MaterialListView,
  ConfirmDeleteModal,
  IcebreakingMonitor,
  IcebreakingPackageManager,
} from './admin';
import { useAdminDataSync } from '../hooks/useAdminDataSync';
import { useAdminFilters } from '../hooks/useAdminFilters';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  GraduationCap,
  BookOpen,
  BarChart3,
  BrainCircuit,
  Lightbulb,
  Rocket,
  Atom,
  Loader2,
  Bomb,
  Radio,
  Package,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

// Dynamic Lazy-Loaded Heavy Components (Code Splitting & Bundle Optimization)
const StudentRecapTable = lazy(() =>
  import('./admin/StudentRecapTable').then((m) => ({ default: m.StudentRecapTable }))
);
const BankSoalManager = lazy(() =>
  import('./admin/BankSoalManager').then((m) => ({ default: m.BankSoalManager }))
);
const ClassStudentManager = lazy(() =>
  import('./admin/ClassStudentManager').then((m) => ({ default: m.ClassStudentManager }))
);
const LinkTesterTab = lazy(() =>
  import('./admin/LinkTesterTab').then((m) => ({ default: m.LinkTesterTab }))
);
const GFormExamResults = lazy(() =>
  import('./GFormExamResults').then((m) => ({ default: m.GFormExamResults }))
);
import { ImportExcelModal } from './ImportExcelModal';
const TeacherGameHost = lazy(() =>
  import('./game/TeacherGameHost').then((m) => ({ default: m.TeacherGameHost }))
);
import { ProgressTrackerModal } from './quiz/ProgressTrackerModal';

// Fallback loader for dynamically loaded modules
const AdminTabLoader: React.FC<{ label?: string }> = ({ label = 'Memuat Modul...' }) => (
  <div className="flex flex-col items-center justify-center py-20 px-4 bg-white/80 rounded-2xl border border-slate-200/80 shadow-xs animate-fadeIn">
    <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 mb-3 animate-pulse">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
    <p className="text-sm font-bold text-slate-700">{label}</p>
    <p className="text-xs text-slate-400 mt-1">Menyiapkan komponen dan data secara dinamis</p>
  </div>
);

interface AdminDashboardProps {
  isOpen?: boolean;
  onClose: () => void;
  onLogout?: () => void;
  onSwitchToStudentView?: () => void;
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  teachers?: TeacherAccount[];
  students?: StudentAccount[];
  authSession?: AuthSession | null;
  onRefreshData: () => Promise<void>;
  onOpenGuide: () => void;
  onSaveSubjectOptimistic?: (subject: Subject, isNew?: boolean) => void;
  onSaveCategoryOptimistic?: (category: Category, isNew?: boolean) => void;
  onSaveMaterialOptimistic?: (material: Material, isNew?: boolean) => void;
  onDeleteSubjectOptimistic?: (id: string) => void;
  onDeleteMaterialOptimistic?: (id: string) => void;
  onDeleteCategoryOptimistic?: (id: string) => void;
  siteLogoUrl?: string;
  onUpdateSiteLogoUrl?: (url: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen = true,
  onClose,
  onLogout,
  onSwitchToStudentView,
  subjects = [],
  categories = [],
  materials = [],
  teachers = [],
  students = [],
  authSession = null,
  onRefreshData,
  onOpenGuide,
  onSaveSubjectOptimistic,
  onSaveCategoryOptimistic,
  onSaveMaterialOptimistic,
  onDeleteSubjectOptimistic,
  onDeleteMaterialOptimistic,
  onDeleteCategoryOptimistic,
  siteLogoUrl = '',
  onUpdateSiteLogoUrl,
}) => {
  // Role & Permissions
  const isTeacherRole = authSession?.role === 'teacher';
  const matchedTeacher = useMemo(() => {
    if (!isTeacherRole || !authSession?.teacher?.id) return null;
    return (teachers || []).find((t) => t.id === authSession.teacher?.id) || null;
  }, [isTeacherRole, authSession?.teacher?.id, teachers]);

  const currentTeacher = matchedTeacher || authSession?.teacher;
  const assignedSubject = useMemo(
    () => subjects.find((s) => s.id === currentTeacher?.subjectId),
    [subjects, currentTeacher?.subjectId]
  );
  const availableSubjects = useMemo(() => {
    if (isTeacherRole && currentTeacher) {
      const filtered = subjects.filter((s) => s.id === currentTeacher.subjectId);
      if (filtered.length > 0) return filtered;
      return [
        assignedSubject || {
          id: currentTeacher.subjectId || 'informatika',
          name: (currentTeacher.subjectId || 'Informatika').toUpperCase(),
          icon: 'BookOpen',
          code: '',
        },
      ];
    }
    return subjects;
  }, [isTeacherRole, currentTeacher?.subjectId, assignedSubject, subjects]);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<AdminTabType>(isTeacherRole ? 'categories' : 'subjects');

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Data Sync Hook
  const teacherClass = isTeacherRole && currentTeacher?.assignedClasses && currentTeacher.assignedClasses.length === 1
    ? currentTeacher.assignedClasses[0]
    : undefined;

  const {
    isSyncing,
    refreshAllData,
    studentProgressMap,
    isLoadingProgress,
    handleResetStudentProgress,
    handleResetAllProgress,
    masterGrades,
    masterClasses,
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
  } = useAdminDataSync({ onRefreshData, showNotify, selectedClass: teacherClass });

  // Filters & Accordion Hook
  const {
    subjSearchQuery,
    setSubjSearchQuery,
    subjSortBy,
    setSubjSortBy,
    catSearchQuery,
    setCatSearchQuery,
    selectedSubjIdFilter,
    setSelectedSubjIdFilter,
    selectedCatIdFilter,
    setSelectedCatIdFilter,
    matSearchQuery,
    setMatSearchQuery,
    matTypeFilter,
    setMatTypeFilter,
    collapsedCatSubjects,
    collapsedMatSubjects,
    collapsedMatCategories,
    toggleCatSubject,
    toggleMatSubject,
    toggleMatCategory,
    expandAllCatGroups,
    collapseAllCatGroups,
    expandAllMatGroups,
    collapseAllMatGroups,
  } = useAdminFilters(subjects, categories);

  // Modals visibility state
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAntiCheatLogsOpen, setIsAntiCheatLogsOpen] = useState(false);
  const [importModalType, setImportModalType] = useState<'students' | 'teachers' | null>(null);
  const [icebreakingSubView, setIcebreakingSubView] = useState<'monitor' | 'host' | 'packages'>('monitor');
  const [selectedHostPackageId, setSelectedHostPackageId] = useState<string | null>(null);

  // Subject Modal
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultCategorySubjId, setDefaultCategorySubjId] = useState<string>('');
  const [defaultCategoryGrade, setDefaultCategoryGrade] = useState<string>('all');

  // Material Modal
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [defaultMatSubjId, setDefaultMatSubjId] = useState<string>('');
  const [defaultMatCatId, setDefaultMatCatId] = useState<string>('');
  const [defaultMatGrade, setDefaultMatGrade] = useState<string>('all');

  // In-App Confirm Delete Modal State (replaces blocked window.confirm in iframes)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'subject' | 'category' | 'material';
    id: string;
    name: string;
    description?: string;
  } | null>(null);

  // Quick Real-time Progress Tracker Modal for Teachers
  const [isDashboardProgressTrackerOpen, setIsDashboardProgressTrackerOpen] = useState(false);
  const [trackerInitialTab, setTrackerInitialTab] = useState<'not_attempted' | 'remedial' | 'passed' | 'all'>('not_attempted');

  const teacherMaterials = useMemo(() => {
    const teacherCats = (categories || []).filter(
      (c) => !isTeacherRole || !currentTeacher?.subjectId || (c.subjectId || 'informatika') === currentTeacher.subjectId
    );
    const catIds = new Set(teacherCats.map((c) => c.id));
    return (materials || []).filter((m) => catIds.has(m.categoryId) && !isMaterialGoogleForm(m));
  }, [isTeacherRole, currentTeacher?.subjectId, categories, materials]);

  const currentTrackerMaterial = useMemo(() => {
    return teacherMaterials[0] || (materials || [])[0] || null;
  }, [materials, teacherMaterials]);

  // Redirect teacher if on admin-only tab
  useEffect(() => {
    if (isTeacherRole && ['subjects', 'teachers', 'students', 'settings'].includes(activeTab)) {
      setActiveTab('categories');
    }
  }, [isTeacherRole, activeTab]);

  // Map and enrich student accounts with real-time isOnline status and latest activity
  const mappedStudents: StudentAccount[] = useMemo(() => {
    const teacherSubjectId = isTeacherRole && currentTeacher?.subjectId ? currentTeacher.subjectId : undefined;
    return (students || []).map((s) => {
      const prog = studentProgressMap
        ? (studentProgressMap[s.id] || (s.nisn ? studentProgressMap[s.nisn] : undefined))
        : null;
      const statusInfo = getStudentOnlineStatus(s, prog, teacherSubjectId, subjects);
      return {
        ...s,
        isOnline: statusInfo.isOnline,
        isOnlineInLobby: statusInfo.isOnlineInLobby,
        isOnlineInTargetSubject: statusInfo.isOnlineInTargetSubject,
        isOnlineInOtherSubject: statusInfo.isOnlineInOtherSubject,
        statusLabel: statusInfo.statusLabel,
        locationLabel: statusInfo.locationLabel,
        subStatusText: statusInfo.subStatusText,
        activeSubjectName: statusInfo.activeSubjectName || s.activeSubjectName,
        lastActiveText: statusInfo.lastActiveText,
        lastActive: s.lastActive || prog?.lastActive || s.updatedAt,
      };
    });
  }, [students, studentProgressMap, isTeacherRole, currentTeacher?.subjectId, subjects]);

  const onlineStudentsCount = useMemo(() => {
    return mappedStudents.filter((s) => s.isOnline).length;
  }, [mappedStudents]);

  // Real-time Teacher Student Progress & Remedial Overview
  const teacherProgressSummary = useMemo(() => {
    if (!isTeacherRole) return null;

    const teacherClasses = (currentTeacher?.assignedClasses || []).map((c) => c.trim().toLowerCase());
    const relevantStudents = (mappedStudents || []).filter((s) => {
      if (teacherClasses.length === 0) return true;
      const sKelas = (s.kelas || '').trim().toLowerCase();
      return teacherClasses.includes(sKelas);
    });

    const totalStudents = relevantStudents.length || (mappedStudents || []).length;
    const onlineStudents = relevantStudents.filter((s) => s.isOnline).length;

    let tuntasCount = 0;
    let remedialCount = 0;
    let notAttemptedCount = 0;
    let totalScoreSum = 0;
    let scoredStudentsCount = 0;

    const activeMatId = currentTrackerMaterial?.id;

    relevantStudents.forEach((st) => {
      const prog = studentProgressMap
        ? studentProgressMap[st.id] || (st.nisn ? studentProgressMap[st.nisn] : undefined)
        : null;

      if (!activeMatId) return;

      const score = prog?.scores?.[activeMatId];
      const attempt = prog?.quizAttempts?.[activeMatId];
      const isCompleted = Array.isArray(prog?.completedMaterialIds) && prog.completedMaterialIds.includes(activeMatId);

      const hasAttempted = score !== undefined || attempt !== undefined || isCompleted;

      if (!hasAttempted) {
        notAttemptedCount++;
      } else {
        const effectiveScore = attempt?.score ?? score ?? 0;
        const totalQ = attempt?.totalQuestions || currentTrackerMaterial?.quizQuestions?.length || 10;
        const pct = attempt?.percentage ?? (totalQ > 0 ? Math.round((effectiveScore / totalQ) * 100) : effectiveScore);

        totalScoreSum += pct;
        scoredStudentsCount++;

        if (pct >= 80 || isCompleted) {
          tuntasCount++;
        } else {
          remedialCount++;
        }
      }
    });

    const totalTeacherMaterials = teacherMaterials.length;
    let totalCompletedModules = 0;
    relevantStudents.forEach((st) => {
      const prog = studentProgressMap
        ? studentProgressMap[st.id] || (st.nisn ? studentProgressMap[st.nisn] : undefined)
        : null;
      if (prog?.completedMaterialIds && totalTeacherMaterials > 0) {
        const completedTeacherMats = prog.completedMaterialIds.filter((id) =>
          teacherMaterials.some((m) => m.id === id)
        ).length;
        totalCompletedModules += completedTeacherMats;
      }
    });

    const avgCompletionPercent =
      totalStudents > 0 && totalTeacherMaterials > 0
        ? Math.min(100, Math.round((totalCompletedModules / (totalStudents * totalTeacherMaterials)) * 100))
        : 0;

    const avgScore = scoredStudentsCount > 0 ? Math.round(totalScoreSum / scoredStudentsCount) : 0;

    return {
      totalStudents,
      onlineStudents,
      tuntasCount,
      remedialCount,
      notAttemptedCount,
      avgCompletionPercent,
      avgScore,
      scoredStudentsCount,
    };
  }, [isTeacherRole, currentTeacher?.assignedClasses, mappedStudents, currentTrackerMaterial, studentProgressMap, teacherMaterials]);

  // Tab counts
  const tabCounts: AdminTabCounts = useMemo(() => {
    const safeCategories = categories || [];
    const safeMaterials = materials || [];
    const safeSubjects = subjects || [];
    const safeStudents = mappedStudents || [];
    const safeTeachers = teachers || [];

    const relevantCategories = isTeacherRole && currentTeacher?.subjectId
      ? safeCategories.filter((c) => c && (c.subjectId || 'informatika') === currentTeacher.subjectId)
      : safeCategories;
    
    const relevantCatIds = new Set((relevantCategories || []).map((c) => c?.id).filter(Boolean));
    const relevantMaterials = isTeacherRole
      ? safeMaterials.filter((m) => m && relevantCatIds.has(m.categoryId))
      : safeMaterials;

    return {
      categories: relevantCategories.length,
      materials: relevantMaterials.length,
      bankSoal: relevantMaterials.length,
      subjects: safeSubjects.length,
      students: safeStudents.length,
      teachers: safeTeachers.length,
    };
  }, [categories, materials, subjects, students, teachers, isTeacherRole, currentTeacher]);

  const allAvailableClasses = useMemo(() => {
    const set = new Set<string>();
    (masterClasses || []).forEach((mc) => {
      if (mc && typeof mc === 'string') set.add(mc.trim());
    });
    (students || []).forEach((s) => {
      if (s?.kelas) set.add(s.kelas.trim());
    });
    return Array.from(set).sort();
  }, [masterClasses, students]);

  // --- CRUD Handlers ---

  // Subject CRUD
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setIsSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (s: Subject) => {
    setEditingSubject(s);
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = async (data: Partial<Subject>, isNew: boolean) => {
    const now = new Date().toISOString();
    if (isNew) {
      const newSubject: Subject = {
        id: data.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || Date.now().toString(),
        name: data.name || '',
        code: data.code || '',
        description: data.description || '',
        icon: data.icon || 'BookOpen',
        order: data.order ?? subjects.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      await createSubject(newSubject);
      onSaveSubjectOptimistic?.(newSubject, true);
    } else if (editingSubject) {
      const updatedSubject: Subject = {
        ...editingSubject,
        ...data,
        updatedAt: now,
      };
      await updateSubject(editingSubject.id, updatedSubject);
      onSaveSubjectOptimistic?.(updatedSubject, false);
    }
    await onRefreshData();
    setIsSubjectModalOpen(false);
    showNotify('success', isNew ? 'Mata pelajaran berhasil ditambahkan' : 'Mata pelajaran berhasil diperbarui');
  };

  const handleDeleteSubject = (id: string, name: string) => {
    setDeleteConfirmTarget({
      type: 'subject',
      id,
      name,
      description: `Menghapus mata pelajaran "${name}" akan sekaligus menghapus semua bab dan bahan ajar yang terhubung di dalamnya.`
    });
  };

  // Category CRUD
  const handleOpenAddCategory = (defaultSubjId?: string, defaultGrade?: string) => {
    setEditingCategory(null);
    setDefaultCategorySubjId(defaultSubjId || (availableSubjects.length > 0 ? availableSubjects[0].id : ''));
    setDefaultCategoryGrade(defaultGrade || 'all');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (c: Category) => {
    setEditingCategory(c);
    setDefaultCategorySubjId(c.subjectId || '');
    setDefaultCategoryGrade(c.targetGrade || 'all');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (data: Partial<Category>, isNew: boolean) => {
    const now = new Date().toISOString();
    if (isNew) {
      const newCat: Category = {
        id: Date.now().toString(),
        subjectId: data.subjectId || defaultCategorySubjId,
        title: data.title || '',
        description: data.description || '',
        icon: data.icon || 'BrainCircuit',
        order: data.order ?? categories.length + 1,
        targetGrade: data.targetGrade || 'all',
        isPublished: data.isPublished ?? true,
        requirePreviousCompleted: data.requirePreviousCompleted ?? false,
        createdAt: now,
        updatedAt: now,
      };
      await createCategory(newCat);
      onSaveCategoryOptimistic?.(newCat, true);
    } else if (editingCategory) {
      const updatedCat: Category = {
        ...editingCategory,
        ...data,
        updatedAt: now,
      };
      await updateCategory(editingCategory.id, updatedCat);
      onSaveCategoryOptimistic?.(updatedCat, false);
    }
    await onRefreshData();
    setIsCategoryModalOpen(false);
    showNotify('success', isNew ? 'Bab pembelajaran berhasil ditambahkan' : 'Bab pembelajaran berhasil diperbarui');
  };

  const handleDeleteCategory = (id: string, title: string) => {
    setDeleteConfirmTarget({
      type: 'category',
      id,
      name: title,
      description: `Menghapus bab "${title}" akan sekaligus menghapus seluruh bahan ajar di dalam bab ini.`
    });
  };

  const handleToggleCategoryLock = async (cat: Category) => {
    const nextLock = !cat.requirePreviousCompleted;
    try {
      const updatedCat: Category = {
        ...cat,
        requirePreviousCompleted: nextLock,
        prerequisiteCategoryId: nextLock ? (cat.prerequisiteCategoryId || 'previous') : 'none',
        updatedAt: new Date().toISOString(),
      };
      await updateCategory(cat.id, updatedCat);
      onSaveCategoryOptimistic?.(updatedCat, false);
      showNotify(
        'success',
        nextLock
          ? `Topik "${cat.title}" dikunci (siswa wajib selesaikan bab sebelumnya).`
          : `Topik "${cat.title}" dibuka bebas untuk semua siswa.`
      );
    } catch (err) {
      console.error('Gagal mengubah kunci topik:', err);
      showNotify('error', 'Gagal mengubah status kunci topik.');
    }
  };

  // Material CRUD
  const handleOpenAddMaterial = (defaultSubjId?: string, defaultCatId?: string, defaultGrade?: string) => {
    setEditingMaterial(null);
    setDefaultMatSubjId(defaultSubjId || (availableSubjects.length > 0 ? availableSubjects[0].id : ''));
    setDefaultMatCatId(defaultCatId || (categories.length > 0 ? categories[0].id : ''));
    setDefaultMatGrade(defaultGrade || 'all');
    setIsMaterialModalOpen(true);
  };

  const handleOpenEditMaterial = (m: Material) => {
    setEditingMaterial(m);
    const parentCat = categories.find((c) => c.id === m.categoryId);
    setDefaultMatSubjId(parentCat?.subjectId || '');
    setDefaultMatCatId(m.categoryId);
    setDefaultMatGrade(m.targetGrade || 'all');
    setIsMaterialModalOpen(true);
  };

  const handleSaveMaterial = async (data: Partial<Material>, isNew: boolean) => {
    const now = new Date().toISOString();
    const isGForm = isMaterialGoogleForm(data) || data.type === 'gform';

    if (isNew) {
      const newMat: Material = {
        id: Date.now().toString(),
        categoryId: data.categoryId || defaultMatCatId,
        title: data.title || '',
        type: isGForm ? 'gform' : (data.type || 'video'),
        originalUrl: data.originalUrl || '',
        embedUrl: data.embedUrl || '',
        description: data.description || '',
        learningObjectives: data.learningObjectives || '',
        order: data.order ?? materials.length + 1,
        targetGrade: data.targetGrade || 'all',
        isPublished: data.isPublished ?? true,
        requirePreviousCompleted: data.requirePreviousCompleted ?? false,
        reflectionQuestions: data.reflectionQuestions,
        gformSpreadsheetUrl: data.gformSpreadsheetUrl,
        interactiveConfig: {
          enableGamification: data.interactiveConfig?.enableGamification ?? false,
          enableLifelines: data.interactiveConfig?.enableLifelines ?? false,
          enableAITutor: data.interactiveConfig?.enableAITutor ?? false,
          enableTimeAttack: data.interactiveConfig?.enableTimeAttack ?? false,
          timeAttackSeconds: data.interactiveConfig?.timeAttackSeconds ?? 30,
        },
        quizBankQuestions: [],
        quizQuestions: [],
        quizSelectedQuestionIds: [],
        quizStatus: 'published',
        createdAt: now,
        updatedAt: now,
      };

      // --------------------------------------------------------------------------
      // Check if questions were already curated/generated in MaterialModal
      if (!isGForm && data.quizBankQuestions && data.quizBankQuestions.length >= 10) {
        newMat.quizBankQuestions = data.quizBankQuestions;
        newMat.quizSelectedQuestionIds = data.quizSelectedQuestionIds || data.quizBankQuestions.slice(0, 10).map((q) => q.id);
        newMat.quizQuestions = data.quizQuestions || data.quizBankQuestions.slice(0, 10);
        newMat.quizStatus = 'published';
        newMat.quizCuratedAt = now;
      } else if (!isGForm) {
        // AUTO-GENERATE 30-ITEM AI QUIZ BANK ON INITIAL MATERIAL CREATION
        // EXACT SAME MECHANISM AS "REFRESH / BUAT ULANG SOAL AI (KHUSUS MATERI INI)"
        const catObj = categories.find((c) => c.id === newMat.categoryId);
        const subjObj = subjects.find((s) => s.id === catObj?.subjectId) || availableSubjects.find((s) => s.id === catObj?.subjectId);
        const tpToUse = (newMat.learningObjectives || '').trim();
        const effectiveGrade =
          newMat.targetGrade && newMat.targetGrade !== 'all'
            ? newMat.targetGrade
            : catObj?.targetGrade && catObj.targetGrade !== 'all'
            ? catObj.targetGrade
            : 'smp-7';

        newMat.targetGrade = effectiveGrade;

        try {
          const aiResult = await fetchAIGeneratedQuizBank(
            newMat,
            catObj?.title,
            subjObj?.name || 'Informatika',
            tpToUse,
            newMat.description,
            true // force fresh AI generation with Gemini like "Refresh Soal"
          );

          let finalPool: QuizQuestion[] = [];
          if (aiResult && Array.isArray(aiResult.quizQuestions) && aiResult.quizQuestions.length >= 10) {
            finalPool = aiResult.quizQuestions;
          } else {
            finalPool = generateFallbackQuizBank(newMat, catObj?.title, subjObj?.name || 'Informatika', tpToUse);
          }

          const selected10 = finalPool.slice(0, 10);
          newMat.quizBankQuestions = finalPool;
          newMat.quizSelectedQuestionIds = selected10.map((q) => q.id);
          newMat.quizQuestions = selected10;
          newMat.quizStatus = 'published';
          newMat.quizCuratedAt = now;
        } catch (genErr) {
          console.warn('Auto AI quiz generation on material creation error:', genErr);
          const fallbackPool = generateFallbackQuizBank(newMat, catObj?.title, subjObj?.name || 'Informatika', tpToUse);
          const selected10 = fallbackPool.slice(0, 10);
          newMat.quizBankQuestions = fallbackPool;
          newMat.quizSelectedQuestionIds = selected10.map((q) => q.id);
          newMat.quizQuestions = selected10;
          newMat.quizStatus = 'published';
          newMat.quizCuratedAt = now;
        }
      }

      const createdMat = await createMaterial(newMat);
      onSaveMaterialOptimistic?.(createdMat || newMat, true);
    } else if (editingMaterial) {
      const updatedMat: Material = {
        ...editingMaterial,
        ...data,
        type: isGForm ? 'gform' : (data.type || editingMaterial.type),
        updatedAt: now,
      };

      // If user updated or generated quiz bank in modal
      if (!isGForm && data.quizBankQuestions && data.quizBankQuestions.length >= 10) {
        updatedMat.quizBankQuestions = data.quizBankQuestions;
        updatedMat.quizSelectedQuestionIds = data.quizSelectedQuestionIds || data.quizBankQuestions.slice(0, 10).map((q) => q.id);
        updatedMat.quizQuestions = data.quizQuestions || data.quizBankQuestions.slice(0, 10);
        updatedMat.quizStatus = 'published';
        updatedMat.quizCuratedAt = now;
      } else if (
        !isGForm &&
        (!updatedMat.quizBankQuestions || updatedMat.quizBankQuestions.length === 0) &&
        (!updatedMat.quizQuestions || updatedMat.quizQuestions.length === 0)
      ) {
        // If existing material has no quiz bank yet, populate it via AI
        const catObj = categories.find((c) => c.id === updatedMat.categoryId);
        const subjObj = subjects.find((s) => s.id === catObj?.subjectId) || availableSubjects.find((s) => s.id === catObj?.subjectId);
        const tpToUse = (updatedMat.learningObjectives || '').trim();
        const effectiveGrade =
          updatedMat.targetGrade && updatedMat.targetGrade !== 'all'
            ? updatedMat.targetGrade
            : catObj?.targetGrade && catObj.targetGrade !== 'all'
            ? catObj.targetGrade
            : 'smp-7';

        updatedMat.targetGrade = effectiveGrade;

        try {
          const aiResult = await fetchAIGeneratedQuizBank(
            updatedMat,
            catObj?.title,
            subjObj?.name || 'Informatika',
            tpToUse,
            updatedMat.description,
            true
          );
          const finalPool =
            aiResult && Array.isArray(aiResult.quizQuestions) && aiResult.quizQuestions.length >= 10
              ? aiResult.quizQuestions
              : generateFallbackQuizBank(updatedMat, catObj?.title, subjObj?.name || 'Informatika', tpToUse);
          const selected10 = finalPool.slice(0, 10);
          updatedMat.quizBankQuestions = finalPool;
          updatedMat.quizSelectedQuestionIds = selected10.map((q) => q.id);
          updatedMat.quizQuestions = selected10;
          updatedMat.quizStatus = 'published';
          updatedMat.quizCuratedAt = now;
        } catch {
          // Keep existing without breaking
        }
      }

      await updateMaterial(editingMaterial.id, updatedMat);
      onSaveMaterialOptimistic?.(updatedMat, false);
    }
    await onRefreshData();
    setIsMaterialModalOpen(false);
    showNotify(
      'success',
      isGForm
        ? (isNew ? 'Bahan ajar Google Form berhasil ditambahkan!' : 'Bahan ajar Google Form berhasil diperbarui!')
        : (isNew
            ? 'Bahan ajar baru & 30 butir bank soal AI berhasil dirumuskan otomatis!'
            : 'Bahan ajar berhasil diperbarui')
    );
  };

  const handleDeleteMaterial = (id: string, title: string) => {
    setDeleteConfirmTarget({
      type: 'material',
      id,
      name: title,
      description: `Bahan ajar "${title}" akan dihapus dari sistem dan tidak dapat diakses lagi oleh siswa.`
    });
  };

  const handleToggleMaterialLock = async (mat: Material) => {
    const nextLock = !mat.requirePreviousCompleted;
    try {
      const updatedMat: Material = {
        ...mat,
        requirePreviousCompleted: nextLock,
        prerequisiteMaterialId: nextLock ? (mat.prerequisiteMaterialId || 'previous') : 'none',
        updatedAt: new Date().toISOString(),
      };
      await updateMaterial(mat.id, updatedMat);
      onSaveMaterialOptimistic?.(updatedMat, false);
      showNotify(
        'success',
        nextLock
          ? `Materi "${mat.title}" dikunci (siswa wajib lulus mini kuis materi sebelumnya).`
          : `Materi "${mat.title}" dibuka bebas untuk semua siswa.`
      );
    } catch (err) {
      console.error('Gagal mengubah kunci materi:', err);
      showNotify('error', 'Gagal mengubah status kunci materi.');
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, id, name } = deleteConfirmTarget;
    try {
      if (type === 'subject') {
        await deleteSubject(id);
        onDeleteSubjectOptimistic?.(id);
        await onRefreshData();
        showNotify('success', `Mata pelajaran "${name}" berhasil dihapus`);
      } else if (type === 'category') {
        await deleteCategory(id);
        onDeleteCategoryOptimistic?.(id);
        await onRefreshData();
        showNotify('success', `Bab "${name}" berhasil dihapus`);
      } else if (type === 'material') {
        await deleteMaterial(id);
        onDeleteMaterialOptimistic?.(id);
        await onRefreshData();
        showNotify('success', `Bahan ajar "${name}" berhasil dihapus`);
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      showNotify('error', `Gagal menghapus: ${err?.message || 'Terjadi kesalahan sistem'}`);
    }
  };

  // Student CRUD
  const handleSaveStudent = async (data: Partial<StudentAccount>, isNew: boolean) => {
    if (isNew) {
      await createStudent(data as Omit<StudentAccount, 'id'>);
    } else if (data.id) {
      await updateStudent(data.id, data);
    }
    await onRefreshData();
  };

  const handleDeleteStudent = async (id: string) => {
    await deleteStudent(id);
    await onRefreshData();
    showNotify('success', 'Akun siswa berhasil dihapus');
  };

  // Teacher CRUD
  const handleSaveTeacher = async (data: Partial<TeacherAccount>, isNew: boolean) => {
    if (isNew) {
      await createTeacher(data as Omit<TeacherAccount, 'id'>);
    } else if (data.id) {
      await updateTeacher(data.id, data);
    }
    await onRefreshData();
  };

  const handleDeleteTeacher = async (id: string) => {
    await deleteTeacher(id);
    await onRefreshData();
    showNotify('success', 'Akun guru berhasil dihapus');
  };

  // Logo update
  const handleSaveLogo = async (url: string) => {
    await setSiteLogoUrl(url);
    onUpdateSiteLogoUrl?.(url);
    await onRefreshData();
  };

  if (!isOpen) return null;

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-slate-50/90 text-slate-800 font-sans antialiased flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-x-clip bg-grid-pattern pb-[env(safe-area-inset-bottom,0px)]">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-[999999] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-extrabold animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Decorative Educational Background Ornaments & Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        {/* Floating Doodles (desktop view) */}
        <div className="hidden lg:block">
          <div className="absolute top-28 left-8 text-indigo-400/20 animate-float">
            <Atom className="w-14 h-14" />
          </div>
          <div className="absolute top-44 right-12 text-sky-400/20 animate-float-delayed">
            <Rocket className="w-12 h-12" />
          </div>
          <div className="absolute top-1/2 left-6 text-purple-400/15 animate-float-delayed">
            <BrainCircuit className="w-11 h-11" />
          </div>
          <div className="absolute bottom-28 left-14 text-amber-400/20 animate-float">
            <Lightbulb className="w-12 h-12" />
          </div>
        </div>
      </div>

      {/* Pinned Top Navigation Bar (AdminHeader + AdminSidebar stay fixed at top on scroll, layer z-40) */}
      <div className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs transition-all">
        <AdminHeader
          siteLogoUrl={siteLogoUrl}
          authSession={authSession}
          isTeacherRole={isTeacherRole}
          currentTeacher={currentTeacher}
          assignedSubject={assignedSubject}
          isSyncing={isSyncing}
          onRefreshData={refreshAllData}
          onOpenGuide={() => setIsGuideOpen(true)}
          onSwitchToStudentView={onSwitchToStudentView}
          onLogout={onLogout}
          onClose={onClose}
        />

        {/* Dedicated Main Navigation Mode Switcher: Curriculum Management vs Live Game Monitoring */}
        <div className="w-full bg-slate-50 border-t border-slate-200/90 py-1.5 px-3 sm:px-6 lg:px-8">
          <div className="max-w-[1480px] mx-auto flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'icebreaking') {
                    setActiveTab(isTeacherRole ? 'categories' : 'subjects');
                  }
                }}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab !== 'icebreaking'
                    ? 'bg-indigo-600 text-white shadow-xs font-black scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Curriculum Management</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('icebreaking')}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === 'icebreaking'
                    ? 'bg-rose-600 text-white shadow-xs font-black scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Live Game Monitoring</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${
                    activeTab === 'icebreaking' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  Live
                </span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              {activeTab === 'icebreaking' ? (
                <span className="text-rose-600 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Mode Pemantauan Permainan Icebreaking Aktif
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Pengelolaan Kurikulum & Modul Ajar
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isTeacherRole={isTeacherRole}
          counts={tabCounts}
        />
      </div>

      {/* Main Content Layout Container */}
      <main className="flex-1 w-full max-w-[1480px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 relative space-y-6">
        
        {/* Dynamic Hero Banner (Matching Student Portal Hero Styling) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 sm:p-5 lg:p-6 border border-indigo-500/30 shadow-lg animate-fadeIn">
          {/* Ambient Glows */}
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 items-center">
            
            {/* Left Column: Badges & Titles */}
            <div className="space-y-2 sm:space-y-2.5 lg:col-span-7">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/15 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 backdrop-blur-md">
                  <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                  <span>{isTeacherRole ? 'Portal Guru Pengampu' : 'Pusat Kontrol Super Admin'}</span>
                </span>

                {isTeacherRole ? (
                  <>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 flex items-center gap-1.5 backdrop-blur-md">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                      <span>{assignedSubject?.name || currentTeacher?.subjectId || 'Mata Pelajaran'}</span>
                    </span>

                    {currentTeacher?.assignedClasses && currentTeacher.assignedClasses.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1.5 backdrop-blur-md">
                        <Users className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Kelas {currentTeacher.assignedClasses.join(', ')}</span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-purple-500/20 text-purple-200 border border-purple-400/30 flex items-center gap-1.5 backdrop-blur-md">
                    <GraduationCap className="w-3.5 h-3.5 text-purple-300" />
                    <span>Kurikulum Merdeka 2026</span>
                  </span>
                )}

                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-rose-500/20 text-rose-200 border border-rose-400/30 flex items-center gap-1.5 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Cloud Database Siap</span>
                </span>
              </div>

              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug drop-shadow-xs">
                  {activeTab === 'icebreaking'
                    ? 'Pemantauan & Pengendalian Permainan Icebreaking'
                    : isTeacherRole
                    ? `Selamat Datang, ${currentTeacher?.name || 'Bapak/Ibu Guru'}!`
                    : 'Dasbor Administrasi & Manajemen Kurikulum'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-3xl pt-0.5">
                  {activeTab === 'icebreaking'
                    ? 'Pantau pergerakan bom antar siswa, jawaban benar/salah, pembekuan waktu, serta kontrol jeda dan oper manual secara real-time.'
                    : isTeacherRole
                    ? `Kelola bab pembelajaran, unggah bahan ajar interaktif, konfigurasi kuis evaluasi, serta pantau rekapan progres belajar siswa secara real-time.`
                    : `Pusat kendali master data mata pelajaran, kurikulum, akun guru pengampu, database siswa, dan pengawasan ujian.`}
                </p>
              </div>
            </div>

            {/* Right Column: Quick Metrics & Summary Card */}
            <div className="w-full bg-slate-900/80 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-4 space-y-2.5 shadow-md lg:col-span-5">
              <div className="flex items-center justify-between gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-extrabold text-white">
                    {isTeacherRole ? 'Ringkasan Progres & Kelas' : 'Ringkasan Sistem SIMPEL'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real-Time</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                {isTeacherRole ? (
                  <>
                    <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl p-2 flex flex-col justify-between">
                      <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                        <Users className="w-3 h-3 text-amber-300" />
                        Siswa Aktif
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-sm sm:text-base font-black text-amber-300">
                          {teacherProgressSummary?.onlineStudents || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          / {teacherProgressSummary?.totalStudents || students.length}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl p-2 flex flex-col justify-between">
                      <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        Ketuntasan
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-sm sm:text-base font-black text-emerald-400">
                          {teacherProgressSummary?.avgCompletionPercent || 0}%
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTrackerInitialTab('passed');
                        setIsDashboardProgressTrackerOpen(true);
                      }}
                      className="bg-white/5 hover:bg-emerald-500/15 transition-all border border-white/10 hover:border-emerald-500/30 rounded-xl p-2 flex flex-col justify-between text-left cursor-pointer group"
                      title="Klik untuk melihat siswa tuntas"
                    >
                      <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 group-hover:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Tuntas Kuis
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-sm sm:text-base font-black text-emerald-300">
                          {teacherProgressSummary?.tuntasCount || 0}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">siswa</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTrackerInitialTab('remedial');
                        setIsDashboardProgressTrackerOpen(true);
                      }}
                      className="bg-white/5 hover:bg-rose-500/15 transition-all border border-white/10 hover:border-rose-500/30 rounded-xl p-2 flex flex-col justify-between text-left cursor-pointer group"
                      title="Klik untuk melihat siswa perlu remedial"
                    >
                      <span className="text-[10px] font-semibold text-rose-200 flex items-center gap-1 group-hover:text-rose-300">
                        <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
                        Remedial
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-sm sm:text-base font-black text-rose-400">
                          {teacherProgressSummary?.remedialCount || 0}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">siswa</span>
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-300">Mapel</span>
                      <span className="text-xs sm:text-sm font-black text-indigo-400">{subjects.length}</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-300">Bab</span>
                      <span className="text-xs sm:text-sm font-black text-violet-400">{categories.length}</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-300">Guru</span>
                      <span className="text-xs sm:text-sm font-black text-cyan-400">{teachers.length}</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-300">Siswa</span>
                      <span className="text-xs sm:text-sm font-black text-amber-300">{students.length}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>



        {/* Tab Content Views */}
        <div className="w-full">
          <Suspense fallback={<AdminTabLoader />}>
            {/* 1. Subjects Tab */}
          {activeTab === 'subjects' && !isTeacherRole && (
            <SubjectListView
              subjects={subjects}
              categories={categories}
              materials={materials}
              searchQuery={subjSearchQuery}
              onSearchChange={setSubjSearchQuery}
              sortBy={subjSortBy}
              onSortByChange={setSubjSortBy}
              onOpenAddSubject={handleOpenAddSubject}
              onOpenEditSubject={handleOpenEditSubject}
              onDeleteSubject={handleDeleteSubject}
            />
          )}

          {/* 2. Categories Tab */}
          {activeTab === 'categories' && (
            <CategoryListView
              categories={categories}
              subjects={availableSubjects}
              materials={materials}
              masterGrades={masterGrades}
              selectedSubjectFilter={selectedSubjIdFilter}
              onSelectSubjectFilter={setSelectedSubjIdFilter}
              searchQuery={catSearchQuery}
              onSearchChange={setCatSearchQuery}
              collapsedSubjects={collapsedCatSubjects}
              onToggleSubject={toggleCatSubject}
              onExpandAll={expandAllCatGroups}
              onCollapseAll={collapseAllCatGroups}
              onOpenAddCategory={handleOpenAddCategory}
              onOpenEditCategory={handleOpenEditCategory}
              onDeleteCategory={handleDeleteCategory}
              onToggleLock={handleToggleCategoryLock}
              isTeacherRole={isTeacherRole}
            />
          )}

          {/* 3. Materials Tab */}
          {activeTab === 'materials' && (
            <MaterialListView
              materials={materials}
              categories={categories}
              subjects={availableSubjects}
              masterGrades={masterGrades}
              selectedSubjectFilter={selectedSubjIdFilter}
              onSelectSubjectFilter={setSelectedSubjIdFilter}
              selectedCategoryFilter={selectedCatIdFilter}
              onSelectCategoryFilter={setSelectedCatIdFilter}
              typeFilter={matTypeFilter}
              onTypeFilterChange={setMatTypeFilter}
              searchQuery={matSearchQuery}
              onSearchChange={setMatSearchQuery}
              collapsedSubjects={collapsedMatSubjects}
              collapsedCategories={collapsedMatCategories}
              onToggleSubject={toggleMatSubject}
              onToggleCategory={toggleMatCategory}
              onExpandAll={expandAllMatGroups}
              onCollapseAll={collapseAllMatGroups}
              onOpenAddMaterial={handleOpenAddMaterial}
              onOpenEditMaterial={handleOpenEditMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              onToggleLock={handleToggleMaterialLock}
              isTeacherRole={isTeacherRole}
            />
          )}

          {/* Bank Soal Mini Kuis AI Tab */}
          {activeTab === 'bank_soal' && (
            <BankSoalManager
              subjects={availableSubjects}
              categories={categories}
              materials={materials}
              teachers={teachers}
              students={mappedStudents}
              masterClasses={allAvailableClasses}
              masterGrades={masterGrades}
              isTeacherRole={isTeacherRole}
              currentTeacher={currentTeacher}
              onRefreshData={refreshAllData}
              onSaveMaterialOptimistic={onSaveMaterialOptimistic}
              showNotify={showNotify}
            />
          )}

          {/* Icebreaking Multiplayer Game Tab */}
          {activeTab === 'icebreaking' && (
            <div className="space-y-4">
              {/* Sub-view switcher toolbar */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs max-w-xl">
                <button
                  type="button"
                  onClick={() => setIcebreakingSubView('monitor')}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    icebreakingSubView === 'monitor'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Live Monitor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIcebreakingSubView('host')}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    icebreakingSubView === 'host'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-200 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Bomb className="w-3.5 h-3.5" />
                  <span>Host Room</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIcebreakingSubView('packages')}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    icebreakingSubView === 'packages'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-200 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Paket Soal</span>
                </button>
              </div>

              {icebreakingSubView === 'monitor' ? (
                <IcebreakingMonitor
                  currentTeacher={currentTeacher}
                  targetClass={teacherClass}
                  isTeacherRole={isTeacherRole}
                  onOpenHostNewRoom={() => setIcebreakingSubView('host')}
                  showNotify={showNotify}
                />
              ) : icebreakingSubView === 'host' ? (
                <TeacherGameHost
                  currentTeacher={currentTeacher}
                  masterClasses={allAvailableClasses}
                  subjects={subjects}
                  isTeacherRole={isTeacherRole}
                  initialPackageId={selectedHostPackageId || undefined}
                  showNotify={showNotify}
                />
              ) : (
                <IcebreakingPackageManager
                  currentTeacher={currentTeacher}
                  onOpenHostRoom={(pkgId) => {
                    setSelectedHostPackageId(pkgId || null);
                    setIcebreakingSubView('host');
                  }}
                  showNotify={showNotify}
                />
              )}
            </div>
          )}

          {/* 4. Google Form Exam Results Tab */}
          {activeTab === 'gform_results' && (
            <GFormExamResults
              materials={materials}
              subjects={availableSubjects}
              categories={categories}
              students={mappedStudents}
              teachers={teachers}
              currentTeacher={currentTeacher}
              isTeacherRole={isTeacherRole}
              onUpdateMaterial={(mat) => handleSaveMaterial(mat, false)}
              onRefreshAllData={refreshAllData}
              onOpenAntiCheatLogs={() => setIsAntiCheatLogsOpen(true)}
            />
          )}

          {/* 5. Student Progress Analytics Tab */}
          {activeTab === 'progress' && (
            <StudentRecapTable
              students={mappedStudents}
              materials={materials}
              categories={categories}
              subjects={subjects}
              studentProgressMap={studentProgressMap}
              isTeacherRole={isTeacherRole}
              currentTeacher={currentTeacher}
              isLoading={isLoadingProgress}
              onRefresh={refreshAllData}
              onResetStudentProgress={handleResetStudentProgress}
              onResetAllProgress={handleResetAllProgress}
              onOpenQuizResults={() => {
                setTrackerInitialTab('remedial');
                setIsDashboardProgressTrackerOpen(true);
              }}
              showNotify={showNotify}
            />
          )}

          {/* 7. Students & Classes Management Tab */}
          {activeTab === 'students' && !isTeacherRole && (
            <ClassStudentManager
              students={mappedStudents}
              masterClasses={masterClasses}
              masterGrades={masterGrades}
              onSaveStudent={handleSaveStudent}
              onDeleteStudent={handleDeleteStudent}
              onAddMasterClass={handleAddMasterClass}
              onDeleteMasterClass={handleDeleteMasterClass}
              onOpenImportModal={() => setImportModalType('students')}
              showNotify={showNotify}
            />
          )}

          {/* 8. Teachers Management Tab */}
          {activeTab === 'teachers' && !isTeacherRole && (
            <TeacherManager
              teachers={teachers}
              subjects={subjects}
              allAvailableClasses={allAvailableClasses}
              onSaveTeacher={handleSaveTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onOpenImportModal={() => setImportModalType('teachers')}
              showNotify={showNotify}
            />
          )}

          {/* 9. Link Tester Simulator Tab */}
          {activeTab === 'tester' && <LinkTesterTab />}

          {/* 10. System Settings Tab */}
          {activeTab === 'settings' && !isTeacherRole && (
            <SettingsManager
              junkReport={junkReport}
              isScanningJunk={isScanningJunk}
              isCleaningJunk={isCleaningJunk}
              onScanJunk={handleScanJunk}
              onCleanJunk={handleCleanJunk}
              siteLogoUrl={siteLogoUrl}
              onSaveLogo={handleSaveLogo}
              onSavePin={handleSavePin}
              minQuizScore={minQuizScore}
              onSaveMinQuizScore={handleSaveMinQuizScore}
              masterGrades={masterGrades}
              masterClasses={masterClasses}
              onAddMasterClass={handleAddMasterClass}
              onDeleteMasterClass={handleDeleteMasterClass}
              onRefreshData={refreshAllData}
              showNotify={showNotify}
            />
          )}
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200/70 py-3 sm:py-4 text-center text-xs sm:text-sm text-slate-500 mt-auto relative z-10">
        <div className="w-full max-w-[1480px] mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium text-slate-500 text-xs sm:text-sm">
            © {new Date().getFullYear()} <span className="font-extrabold text-indigo-700 tracking-wider">SIMPEL</span> — Sistem Informasi Materi Pembelajaran Elektronik
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>{isTeacherRole ? 'Panel Guru Pengampu' : 'Panel Super Admin'}</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold">Terhubung Cloud</span>
          </div>
        </div>
      </footer>

      {/* --- Modals --- */}

      {/* 1. Subject Modal */}
      {isSubjectModalOpen && (
        <SubjectModal
          isOpen={isSubjectModalOpen}
          onClose={() => setIsSubjectModalOpen(false)}
          editingSubject={editingSubject}
          onSave={handleSaveSubject}
          orderSuggestion={subjects.length + 1}
        />
      )}

      {/* 2. Category Modal */}
      {isCategoryModalOpen && (
        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          editingCategory={editingCategory}
          subjects={availableSubjects}
          categories={categories}
          masterGrades={masterGrades}
          defaultSubjectId={defaultCategorySubjId}
          defaultGrade={defaultCategoryGrade}
          onSave={handleSaveCategory}
          orderSuggestion={categories.length + 1}
        />
      )}

      {/* 3. Material Modal */}
      {isMaterialModalOpen && (
        <MaterialModal
          isOpen={isMaterialModalOpen}
          onClose={() => setIsMaterialModalOpen(false)}
          editingMaterial={editingMaterial}
          subjects={availableSubjects}
          categories={categories}
          materials={materials}
          masterGrades={masterGrades}
          defaultSubjectId={defaultMatSubjId}
          defaultCategoryId={defaultMatCatId}
          defaultGrade={defaultMatGrade}
          onSave={handleSaveMaterial}
          orderSuggestion={materials.length + 1}
          onOpenGuide={() => setIsGuideOpen(true)}
          showNotify={showNotify}
        />
      )}

      {/* 4. Guide Link Modal */}
      <GuideLinkModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* 5. Anti-Cheat Integrity Logs Modal */}
      <AntiCheatLogsModal
        isOpen={isAntiCheatLogsOpen}
        onClose={() => setIsAntiCheatLogsOpen(false)}
        students={students}
        materials={materials}
      />

      {/* 6. Excel Import Modal */}
      {importModalType && (
        <ImportExcelModal
          isOpen={true}
          type={importModalType}
          subjects={subjects}
          onClose={() => setImportModalType(null)}
          onSuccess={async () => {
            setImportModalType(null);
            await onRefreshData();
            showNotify('success', `Data ${importModalType === 'students' ? 'siswa' : 'guru'} berhasil diimpor!`);
          }}
        />
      )}

      {/* 7. In-App Confirmation Modal for Delete Operations */}
      {deleteConfirmTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteConfirmTarget}
          title={
            deleteConfirmTarget.type === 'subject'
              ? 'Hapus Mata Pelajaran'
              : deleteConfirmTarget.type === 'category'
              ? 'Hapus Bab Pembelajaran'
              : 'Hapus Bahan Ajar'
          }
          itemType={
            deleteConfirmTarget.type === 'subject'
              ? 'mata pelajaran'
              : deleteConfirmTarget.type === 'category'
              ? 'bab'
              : 'bahan ajar'
          }
          itemName={deleteConfirmTarget.name}
          description={deleteConfirmTarget.description}
          onConfirm={handleExecuteDelete}
          onClose={() => setDeleteConfirmTarget(null)}
        />
      )}

      {/* 8. Teacher Dashboard Progress Tracker Modal */}
      {isDashboardProgressTrackerOpen && currentTrackerMaterial && (
        <ProgressTrackerModal
          isOpen={isDashboardProgressTrackerOpen}
          onClose={() => setIsDashboardProgressTrackerOpen(false)}
          activeMaterial={currentTrackerMaterial}
          students={mappedStudents}
          categories={categories}
          subjects={availableSubjects}
          masterClasses={allAvailableClasses}
          minQuizScore={minQuizScore}
          initialClass={teacherClass || 'all'}
          initialTab={trackerInitialTab}
          onResetStudent={async (studentId, studentName) => {
            await handleResetStudentProgress(studentId, studentName);
          }}
          showNotify={showNotify}
        />
      )}
    </div>
  );
};
