import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles,
  BookOpen,
  Layers,
  CheckCircle2,
  AlertCircle,
  Save,
  Shuffle,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Check,
  Edit3,
  BarChart3,
  GraduationCap,
  Lock,
  Trophy,
  Sliders,
  Download,
  X,
  RotateCcw,
  CheckSquare,
  Square,
  HelpCircle,
  FileSpreadsheet,
  Target,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Users,
  Clock,
} from 'lucide-react';
import {
  Subject,
  Category,
  Material,
  QuizQuestion,
  MaterialType,
  TeacherAccount,
  StudentAccount,
} from '../../types';
import {
  fetchAIGeneratedQuizBank,
  generateFallbackQuizBank,
} from '../../utils/quizGenerator';
import { isMaterialGoogleForm } from '../../utils/urlParser';
import {
  updateMaterial,
  fetchMaterialStudentQuizScores,
  MaterialStudentQuizScoreRecord,
  getMinQuizScoreToUnlock,
  DEFAULT_MIN_QUIZ_SCORE,
  resetStudentMaterialProgress,
  resetAllStudentsMaterialProgress,
} from '../../lib/dataService';
import { ConfirmResetModal } from './ConfirmResetModal';
import { BankSoalQuestionModal } from './bankSoal/BankSoalQuestionModal';
import { BankSoalResetAllModal } from './bankSoal/BankSoalResetAllModal';
import { BankSoalSettingsTab } from './bankSoal/BankSoalSettingsTab';
import { ProgressTrackerModal } from '../quiz/ProgressTrackerModal';

interface BankSoalManagerProps {
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  teachers?: TeacherAccount[];
  students?: StudentAccount[];
  masterClasses?: string[];
  masterGrades?: Array<{ id: string; label: string; subLabel?: string }>;
  isTeacherRole?: boolean;
  currentTeacher?: TeacherAccount | null;
  onRefreshData: () => Promise<void>;
  onSaveMaterialOptimistic?: (material: Material, isNew?: boolean) => void;
  showNotify: (type: 'success' | 'error', message: string) => void;
}

export const BankSoalManager: React.FC<BankSoalManagerProps> = ({
  subjects = [],
  categories = [],
  materials = [],
  teachers = [],
  students = [],
  masterClasses = [],
  masterGrades = [],
  isTeacherRole = false,
  currentTeacher = null,
  onRefreshData,
  onSaveMaterialOptimistic,
  showNotify,
}) => {
  // -------------------------------------------------------------
  // Filter & Search State (Identical to MaterialListView)
  // -------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Accordion Collapse States
  const [collapsedSubjects, setCollapsedSubjects] = useState<Record<string, boolean>>({});
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Active Material being managed
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'questions' | 'scores' | 'settings'>('questions');

  // Active Material Quiz State
  const [bankQuestions, setBankQuestions] = useState<QuizQuestion[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isEditingTP, setIsEditingTP] = useState(false);
  const [editedTP, setEditedTP] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Settings for the active material's quiz
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [isRandomized, setIsRandomized] = useState<boolean>(true);
  const [quizStatus, setQuizStatus] = useState<'draft' | 'published'>('published');

  // Modal / Inline editor for a single question
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [isAddingNewQuestion, setIsAddingNewQuestion] = useState(false);

  // Student Evaluation Scores for active material
  const [evalScores, setEvalScores] = useState<MaterialStudentQuizScoreRecord[]>([]);
  const [minQuizScore, setMinQuizScore] = useState<number>(DEFAULT_MIN_QUIZ_SCORE);
  const [isLoadingScores, setIsLoadingScores] = useState(false);
  const [evalSearchQuery, setEvalSearchQuery] = useState('');
  const [evalClassFilter, setEvalClassFilter] = useState('ALL');
  const [evalStatusFilter, setEvalStatusFilter] = useState<'all' | 'passed' | 'remedial'>('all');
  const [isProgressTrackerModalOpen, setIsProgressTrackerModalOpen] = useState(false);
  const [progressTrackerInitialTab, setProgressTrackerInitialTab] = useState<'not_attempted' | 'remedial' | 'passed' | 'all'>('not_attempted');

  // Load KKM setting from Admin Settings
  useEffect(() => {
    let isMounted = true;
    getMinQuizScoreToUnlock()
      .then((val) => {
        if (isMounted) {
          const percent = val <= 10 ? val * 10 : val;
          setMinQuizScore(percent);
        }
      })
      .catch(() => {
        if (isMounted) setMinQuizScore(DEFAULT_MIN_QUIZ_SCORE);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Reset student progress state
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmResetStudent, setConfirmResetStudent] = useState<MaterialStudentQuizScoreRecord | null>(null);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);

  // Vercel Serverless / Gemini API Health State
  const [serverAIStatus, setServerAIStatus] = useState<{
    checked: boolean;
    hasGeminiKey: boolean;
    keyVariableDetected?: string;
    hint?: string;
  }>({ checked: false, hasGeminiKey: true });

  useEffect(() => {
    let isMounted = true;
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        if (isMounted && data) {
          setServerAIStatus({
            checked: true,
            hasGeminiKey: Boolean(data.hasGeminiKey),
            keyVariableDetected: data.keyVariableDetected,
            hint: data.hint,
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setServerAIStatus({ checked: true, hasGeminiKey: true });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // -------------------------------------------------------------
  // Filter Subjects by Teacher Role
  // -------------------------------------------------------------
  const availableSubjects = useMemo(() => {
    if (isTeacherRole && currentTeacher?.subjectId) {
      const matched = subjects.filter((s) => s.id === currentTeacher.subjectId);
      return matched.length > 0 ? matched : subjects;
    }
    return subjects;
  }, [subjects, isTeacherRole, currentTeacher]);

  // Categories Map
  const categoriesMap = useMemo(() => {
    const map = new Map<string, Category>();
    (categories || []).forEach((c) => {
      if (c?.id) map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // Effective Master Grades
  const effectiveGrades = useMemo(() => {
    if (masterGrades && masterGrades.length > 0) return masterGrades;
    return [
      { id: '7', label: 'Kelas 7', subLabel: 'Fase D (SMP)' },
      { id: '8', label: 'Kelas 8', subLabel: 'Fase D (SMP)' },
      { id: '9', label: 'Kelas 9', subLabel: 'Fase D (SMP)' },
    ];
  }, [masterGrades]);

  // Helper: Extract Grade Level
  const extractGradeLevel = useCallback((val?: string): string => {
    if (!val || val === 'all' || val === 'umum' || val === 'semua' || val === '*') return 'all';
    const clean = String(val).trim().toLowerCase();
    const match = clean.match(/\d+/);
    return match ? match[0] : clean;
  }, []);

  // Helper: Get Material Grade
  const getMaterialGrade = useCallback(
    (m: Material): string => {
      if (m.targetGrade) {
        return extractGradeLevel(m.targetGrade);
      }
      const cat = categoriesMap.get(m.categoryId);
      if (cat?.targetGrade) {
        return extractGradeLevel(cat.targetGrade);
      }
      return 'all';
    },
    [categoriesMap, extractGradeLevel]
  );

  // Helper: Grade Theme Colors
  const getGradeTheme = (gradeId: string) => {
    switch (gradeId) {
      case '7':
        return {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          border: 'border-emerald-200/80',
          headerBg: 'bg-emerald-50/50',
          iconBg: 'bg-emerald-100 text-emerald-700',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        };
      case '8':
        return {
          badge: 'bg-violet-50 text-violet-700 border-violet-200',
          border: 'border-violet-200/80',
          headerBg: 'bg-violet-50/50',
          iconBg: 'bg-violet-100 text-violet-700',
          btnBg: 'bg-violet-600 hover:bg-violet-700 text-white',
        };
      case '9':
        return {
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          border: 'border-indigo-200/80',
          headerBg: 'bg-indigo-50/50',
          iconBg: 'bg-indigo-100 text-indigo-700',
          btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        };
      default:
        return {
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          border: 'border-slate-200',
          headerBg: 'bg-slate-50',
          iconBg: 'bg-slate-200 text-slate-700',
          btnBg: 'bg-slate-700 hover:bg-slate-800 text-white',
        };
    }
  };

  const getTypeBadge = (type: MaterialType) => {
    switch (type) {
      case 'video':
      case 'youtube':
        return (
          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
            Video
          </span>
        );
      case 'canva':
        return (
          <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded text-[10px] font-bold">
            Canva
          </span>
        );
      case 'pdf':
        return (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
            PDF
          </span>
        );
      case 'gdrive':
        return (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
            Dokumen / Slide
          </span>
        );
      case 'gform':
        return (
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
            Google Form
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded text-[10px] font-bold">
            {type}
          </span>
        );
    }
  };

  const getGradeBadgeLabel = (targetGrade?: string) => {
    if (!targetGrade || targetGrade === 'all' || targetGrade === 'umum') {
      return 'Semua Tingkat';
    }
    const clean = extractGradeLevel(targetGrade);
    const found = effectiveGrades.find((g) => g.id === clean);
    return found ? found.label : `Kelas ${clean}`;
  };

  // -------------------------------------------------------------
  // Filtered Materials
  // -------------------------------------------------------------
  const filteredMaterials = useMemo(() => {
    return (materials || []).filter((m) => {
      // Teacher subject filter
      if (isTeacherRole && currentTeacher?.subjectId) {
        const cat = categoriesMap.get(m.categoryId);
        if (cat && cat.subjectId && cat.subjectId !== currentTeacher.subjectId) {
          return false;
        }
      }

      // Subject Filter
      if (selectedSubjectFilter !== 'all') {
        const cat = categoriesMap.get(m.categoryId);
        if (!cat || (cat.subjectId || 'informatika') !== selectedSubjectFilter) {
          return false;
        }
      }

      // Category Filter
      if (selectedCategoryFilter !== 'all' && m.categoryId !== selectedCategoryFilter) {
        return false;
      }

      // Grade Filter
      if (selectedGradeFilter !== 'all') {
        const mGrade = getMaterialGrade(m);
        if (selectedGradeFilter === 'general' && mGrade !== 'all') return false;
        if (selectedGradeFilter !== 'general' && mGrade !== selectedGradeFilter) return false;
      }

      // Status Filter
      if (statusFilter === 'published') {
        const isPub = m.quizStatus === 'published' && (m.quizQuestions?.length || 0) >= 10;
        if (!isPub) return false;
      } else if (statusFilter === 'draft') {
        const isPub = m.quizStatus === 'published' && (m.quizQuestions?.length || 0) >= 10;
        if (isPub) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = categoriesMap.get(m.categoryId);
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchDesc = m.description?.toLowerCase().includes(q) || false;
        const matchTP = m.learningObjectives?.toLowerCase().includes(q) || false;
        const matchCat = cat?.title.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc && !matchTP && !matchCat) {
          return false;
        }
      }

      return true;
    });
  }, [
    materials,
    isTeacherRole,
    currentTeacher,
    selectedSubjectFilter,
    selectedCategoryFilter,
    selectedGradeFilter,
    statusFilter,
    searchQuery,
    categoriesMap,
    getMaterialGrade,
  ]);

  // -------------------------------------------------------------
  // Grouping by Subject -> Grade -> Category
  // -------------------------------------------------------------
  const groupedDataBySubject = useMemo(() => {
    const result: Record<
      string,
      {
        subject: Subject;
        totalMaterials: number;
        byGrade: Array<{
          gradeId: string;
          gradeLabel: string;
          gradeSubLabel?: string;
          totalCount: number;
          categoriesWithMaterials: Array<{
            category: Category;
            materials: Material[];
          }>;
        }>;
      }
    > = {};

    availableSubjects.forEach((s) => {
      const subjCats = (categories || []).filter((c) => (c.subjectId || 'informatika') === s.id);
      const subjCatIds = new Set(subjCats.map((c) => c.id));
      const subjMats = filteredMaterials.filter((m) => subjCatIds.has(m.categoryId));

      const gradeGroups: Array<{
        gradeId: string;
        gradeLabel: string;
        gradeSubLabel?: string;
        totalCount: number;
        categoriesWithMaterials: Array<{
          category: Category;
          materials: Material[];
        }>;
      }> = [];

      // 1. Specific Grades (7, 8, 9, etc.)
      effectiveGrades.forEach((g) => {
        if (selectedGradeFilter !== 'all' && selectedGradeFilter !== g.id) return;

        const matsForGrade = subjMats.filter((m) => getMaterialGrade(m) === g.id);
        const matchedCats: Array<{ category: Category; materials: Material[] }> = [];

        subjCats.forEach((c) => {
          const catGrade = extractGradeLevel(c.targetGrade);
          const isCatMatch = catGrade === g.id || catGrade === 'all';
          const matsForCat = matsForGrade.filter((m) => m.categoryId === c.id);

          if (matsForCat.length > 0 || (isCatMatch && selectedGradeFilter === g.id)) {
            matchedCats.push({
              category: c,
              materials: matsForCat.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
            });
          }
        });

        if (matchedCats.length > 0 || selectedGradeFilter === g.id) {
          gradeGroups.push({
            gradeId: g.id,
            gradeLabel: g.label,
            gradeSubLabel: g.subLabel,
            totalCount: matsForGrade.length,
            categoriesWithMaterials: matchedCats,
          });
        }
      });

      // 2. General / Lintas Jenjang
      if (selectedGradeFilter === 'all' || selectedGradeFilter === 'general') {
        const generalMats = subjMats.filter((m) => getMaterialGrade(m) === 'all');
        const matchedCats: Array<{ category: Category; materials: Material[] }> = [];

        subjCats.forEach((c) => {
          const catGrade = extractGradeLevel(c.targetGrade || 'all');
          const isCatGeneral = catGrade === 'all';
          const matsForCat = generalMats.filter((m) => m.categoryId === c.id);

          if (matsForCat.length > 0 || (isCatGeneral && selectedGradeFilter === 'general')) {
            matchedCats.push({
              category: c,
              materials: matsForCat.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
            });
          }
        });

        if (matchedCats.length > 0 || selectedGradeFilter === 'general') {
          gradeGroups.push({
            gradeId: 'general',
            gradeLabel: 'Semua Jenjang / Lintas Tingkat',
            gradeSubLabel: 'Materi Umum / Fleksibel',
            totalCount: generalMats.length,
            categoriesWithMaterials: matchedCats,
          });
        }
      }

      result[s.id] = {
        subject: s,
        totalMaterials: subjMats.length,
        byGrade: gradeGroups,
      };
    });

    return result;
  }, [
    availableSubjects,
    categories,
    filteredMaterials,
    effectiveGrades,
    selectedGradeFilter,
    getMaterialGrade,
    extractGradeLevel,
  ]);

  // Expand / Collapse Handlers
  const toggleSubject = (sId: string) => {
    setCollapsedSubjects((prev) => ({ ...prev, [sId]: !prev[sId] }));
  };

  const toggleGrade = (key: string) => {
    setCollapsedGrades((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCategory = (cId: string) => {
    setCollapsedCategories((prev) => {
      const isCurrentlyCollapsed = prev[cId] !== false;
      return { ...prev, [cId]: !isCurrentlyCollapsed };
    });
  };

  const handleExpandAll = () => {
    setCollapsedSubjects({});
    setCollapsedGrades({});
    const catMap: Record<string, boolean> = {};
    categories.forEach((c) => (catMap[c.id] = false));
    setCollapsedCategories(catMap);
  };

  const handleCollapseAll = () => {
    const subjMap: Record<string, boolean> = {};
    availableSubjects.forEach((s) => (subjMap[s.id] = true));
    setCollapsedSubjects(subjMap);
    const catMap: Record<string, boolean> = {};
    categories.forEach((c) => (catMap[c.id] = true));
    setCollapsedCategories(catMap);
  };

  // -------------------------------------------------------------
  // Currently Active Material Object
  // -------------------------------------------------------------
  const activeMaterial = useMemo(() => {
    if (!activeMaterialId) return null;
    return materials.find((m) => m.id === activeMaterialId) || null;
  }, [materials, activeMaterialId]);

  const activeMaterialIdRef = useRef<string | null>(activeMaterialId);
  useEffect(() => {
    activeMaterialIdRef.current = activeMaterialId;
  }, [activeMaterialId]);

  // Initialize questions and settings whenever activeMaterialId changes
  useEffect(() => {
    if (!activeMaterial) {
      setBankQuestions([]);
      setSelectedQuestionIds(new Set());
      setTargetClasses([]);
      setIsRandomized(true);
      setQuizStatus('published');
      setEditedTP('');
      return;
    }

    // If active material is a Google Form, mini quiz questions do not apply
    if (isMaterialGoogleForm(activeMaterial)) {
      setBankQuestions([]);
      setSelectedQuestionIds(new Set());
      setTargetClasses([]);
      setIsRandomized(true);
      setQuizStatus('published');
      setEditedTP(activeMaterial.learningObjectives || '');
      return;
    }

    setEditedTP(activeMaterial.learningObjectives || '');

    // Target classes
    if (activeMaterial.quizTargetClasses && Array.isArray(activeMaterial.quizTargetClasses)) {
      setTargetClasses(activeMaterial.quizTargetClasses);
    } else if (currentTeacher?.assignedClasses && currentTeacher.assignedClasses.length > 0) {
      setTargetClasses(currentTeacher.assignedClasses);
    } else {
      setTargetClasses([]);
    }

    // Randomize setting
    setIsRandomized(activeMaterial.quizRandomize !== false);

    // Status
    setQuizStatus(activeMaterial.quizStatus || 'published');

    const catObj = categoriesMap.get(activeMaterial.categoryId);
    const subjObj = availableSubjects.find((s) => s.id === catObj?.subjectId);

    // Load or generate questions for THIS SPECIFIC MATERIAL
    if (activeMaterial.quizBankQuestions && activeMaterial.quizBankQuestions.length > 0) {
      // 1. Material has saved 30 bank questions
      setBankQuestions(activeMaterial.quizBankQuestions);
      if (activeMaterial.quizSelectedQuestionIds && activeMaterial.quizSelectedQuestionIds.length > 0) {
        setSelectedQuestionIds(new Set(activeMaterial.quizSelectedQuestionIds));
      } else {
        const auto10 = new Set(activeMaterial.quizBankQuestions.slice(0, 10).map((q) => q.id));
        setSelectedQuestionIds(auto10);
      }
    } else if (activeMaterial.quizQuestions && activeMaterial.quizQuestions.length > 0) {
      // 2. Material has curated questions, fill pool up to 30
      const existing = activeMaterial.quizQuestions;
      const fallback30 = generateFallbackQuizBank(
        activeMaterial,
        catObj?.title,
        subjObj?.name,
        activeMaterial.learningObjectives
      );

      const merged: QuizQuestion[] = [...existing];
      const existingQuestionsText = new Set(existing.map((q) => q.question.trim().toLowerCase()));
      for (const fb of fallback30) {
        if (merged.length >= 30) break;
        if (!existingQuestionsText.has(fb.question.trim().toLowerCase())) {
          merged.push({
            ...fb,
            id: `qb-${merged.length + 1}`,
          });
        }
      }

      setBankQuestions(merged);
      const selected = new Set(existing.map((q) => q.id));
      if (selected.size < 10) {
        merged.slice(0, 10).forEach((q) => selected.add(q.id));
      }
      setSelectedQuestionIds(selected);
    } else {
      // 3. Brand new material or legacy material without bank questions:
      // Show instant contextual fallback so UI is immediately interactive
      const generatedPool = generateFallbackQuizBank(
        activeMaterial,
        catObj?.title,
        subjObj?.name,
        activeMaterial.learningObjectives
      );
      setBankQuestions(generatedPool);
      const auto10 = new Set(generatedPool.slice(0, 10).map((q) => q.id));
      setSelectedQuestionIds(auto10);

      // Automatically trigger Gemini AI generation in background (identical to "Refresh Soal")
      // so teacher immediately gets tailored questions without having to click refresh manually
      const targetMatId = activeMaterial.id;
      const tpToUse = (activeMaterial.learningObjectives || '').trim();
      fetchAIGeneratedQuizBank(
        activeMaterial,
        catObj?.title,
        subjObj?.name,
        tpToUse,
        activeMaterial.description,
        true
      ).then(async (aiResult) => {
        if (aiResult && Array.isArray(aiResult.quizQuestions) && aiResult.quizQuestions.length >= 10) {
          if (activeMaterialIdRef.current === targetMatId) {
            setBankQuestions(aiResult.quizQuestions);
            const newAuto10 = new Set(aiResult.quizQuestions.slice(0, 10).map((q) => q.id));
            setSelectedQuestionIds(newAuto10);
          }
          try {
            await updateMaterial(targetMatId, {
              quizBankQuestions: aiResult.quizQuestions,
              quizSelectedQuestionIds: aiResult.quizQuestions.slice(0, 10).map((q) => q.id),
              quizQuestions: aiResult.quizQuestions.slice(0, 10),
              quizStatus: 'published',
              quizCuratedAt: new Date().toISOString(),
            });
            onRefreshData?.();
          } catch (e) {
            console.warn('Auto-save AI bank questions error:', e);
          }
        }
      }).catch((err) => {
        console.warn('Auto fetch AI bank error:', err);
      });
    }
  }, [activeMaterialId, activeMaterial?.id, currentTeacher]);

  // Load student evaluation scores for active material
  useEffect(() => {
    if (!activeMaterial || activeSubTab !== 'scores') return;

    let isMounted = true;
    setIsLoadingScores(true);

    const activeSelectedCount =
      selectedQuestionIds.size > 0
        ? selectedQuestionIds.size
        : (activeMaterial.quizSelectedQuestionIds?.length || activeMaterial.quizQuestions?.length || 10);

    fetchMaterialStudentQuizScores(
      activeMaterial.id,
      students || [],
      minQuizScore,
      activeSelectedCount,
      evalClassFilter
    )
      .then((scores) => {
        if (isMounted) setEvalScores(scores);
      })
      .catch((err) => {
        console.warn('Error fetching student quiz scores:', err);
        if (isMounted) setEvalScores([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingScores(false);
      });

    // Real-time listener for reset events across components/tabs
    const handleResetEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail;
      if (detail && (!detail.materialId || detail.materialId === activeMaterial.id)) {
        if (detail.allStudents) {
          setEvalScores([]);
        } else if (detail.studentIds && Array.isArray(detail.studentIds)) {
          setEvalScores((prev) =>
            prev.filter(
              (r) => !detail.studentIds.includes(r.studentId) && !detail.studentIds.includes(r.id)
            )
          );
        }
      }
    };

    window.addEventListener('student-material-reset', handleResetEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('student-material-reset', handleResetEvent);
    };
  }, [activeMaterial?.id, activeSubTab, students, minQuizScore, selectedQuestionIds.size]);

  // -------------------------------------------------------------
  // Question Selection Helpers (1 to 20 Questions from 30 Bank)
  // -------------------------------------------------------------
  const toggleSelectQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        if (next.size >= 20) {
          showNotify('error', 'Maksimal memilih 20 butir soal untuk kuis siswa (dari 30 bank soal). Sisa soal akan digunakan sebagai pengayaan.');
          return prev;
        }
        next.add(qId);
      }
      return next;
    });
  };

  const handleSelectCount = (count: number) => {
    const targetCount = Math.min(count, 20, bankQuestions.length);
    const chosen = new Set(bankQuestions.slice(0, targetCount).map((q) => q.id));
    setSelectedQuestionIds(chosen);
    showNotify('success', `${chosen.size} butir soal berhasil dipilih untuk kuis siswa.`);
  };

  const handleSelectRandomCount = (count: number) => {
    if (bankQuestions.length === 0) return;
    const targetCount = Math.min(count, 20, bankQuestions.length);
    const shuffled = [...bankQuestions].sort(() => Math.random() - 0.5);
    const chosen = new Set(shuffled.slice(0, targetCount).map((q) => q.id));
    setSelectedQuestionIds(chosen);
    showNotify('success', `${chosen.size} butir soal acak berhasil dipilih untuk siswa.`);
  };

  const handleSelectAll = () => {
    // Select maximum allowed (20 questions) from bank
    const max20 = new Set(bankQuestions.slice(0, Math.min(20, bankQuestions.length)).map((q) => q.id));
    setSelectedQuestionIds(max20);
    showNotify('success', `${max20.size} butir soal terpilih (Maksimal 20 butir). Sisa ${Math.max(0, bankQuestions.length - max20.size)} butir soal menjadi materi pengayaan.`);
  };

  const handleResetSelection = () => {
    setSelectedQuestionIds(new Set());
  };

  // -------------------------------------------------------------
  // AI Generator: Gemini 2.5 Flash
  // -------------------------------------------------------------
  const handleGenerateAI = async (forceRefresh: boolean = true) => {
    if (!activeMaterial) return;

    if (!activeMaterial.title || !activeMaterial.title.trim()) {
      showNotify('error', 'Judul bahan ajar belum diisi.');
      return;
    }

    const tpToUse = (isEditingTP ? editedTP : activeMaterial.learningObjectives || '').trim();
    if (!tpToUse || tpToUse.length < 5) {
      showNotify(
        'error',
        'Tujuan Pembelajaran (TP) masih kosong! Tuliskan Tujuan Pembelajaran terlebih dahulu agar AI menghasilkan soal yang relevan.'
      );
      setIsEditingTP(true);
      return;
    }

    setIsGeneratingAI(true);
    setAiStatusMessage(`Menghubungkan ke Gemini AI khusus materi "${activeMaterial.title}"...`);

    try {
      const catObj = categoriesMap.get(activeMaterial.categoryId);
      const subjObj = availableSubjects.find((s) => s.id === catObj?.subjectId);

      setAiStatusMessage(`Merumuskan 30 butir bank soal berbasis TP khusus materi "${activeMaterial.title}"...`);

      const result = await fetchAIGeneratedQuizBank(
        {
          ...activeMaterial,
          learningObjectives: tpToUse,
        },
        catObj?.title,
        subjObj?.name,
        tpToUse,
        activeMaterial.description,
        forceRefresh
      );

      if (result && Array.isArray(result.quizQuestions) && result.quizQuestions.length >= 10) {
        const newQuestions = result.quizQuestions.slice(0, 30);
        setBankQuestions(newQuestions);
        const newSelected = new Set<string>();
        const newSelected10 = newQuestions.slice(0, 10);
        newSelected10.forEach((q) => newSelected.add(q.id));
        setSelectedQuestionIds(newSelected);

        // Gantikan data soal lama di bank soal cadangan materi dengan butir soal yang baru dibuat
        const newSelectedIds = newSelected10.map((q) => q.id);
        const updates: Partial<Material> = {
          quizBankQuestions: newQuestions,
          quizSelectedQuestionIds: newSelectedIds,
          quizQuestions: newSelected10,
          quizStatus: 'published',
          quizCuratedAt: new Date().toISOString(),
        };

        if (editedTP.trim() && editedTP.trim() !== (activeMaterial.learningObjectives || '').trim()) {
          updates.learningObjectives = editedTP.trim();
        }

        try {
          await updateMaterial(activeMaterial.id, updates);
          onSaveMaterialOptimistic?.(
            {
              ...activeMaterial,
              ...updates,
            },
            false
          );
          onRefreshData?.();
        } catch (saveErr) {
          console.warn('Gagal menyimpan pembaruan bank soal materi:', saveErr);
        }

        if (result.isFallback || result.modelUsed === 'curated-fallback' || result.warning) {
          showNotify(
            'info',
            result.warning ||
              `Mode Kurasi: GEMINI_API_KEY belum terpasang di Vercel Settings. Bank soal materi "${activeMaterial.title}" dimuat dari 30 butir kurasi resmi.`
          );
        } else {
          showNotify(
            'success',
            `Berhasil! 30 butir soal baru berhasil dirumuskan secara dinamis oleh Gemini AI (${result.modelUsed || 'Gemini Flash'})!`
          );
        }
      } else {
        const fallback = generateFallbackQuizBank(activeMaterial, catObj?.title, subjObj?.name, tpToUse).slice(0, 30);
        setBankQuestions(fallback);
        const newSelected = new Set<string>();
        const newSelected10 = fallback.slice(0, 10);
        newSelected10.forEach((q) => newSelected.add(q.id));
        setSelectedQuestionIds(newSelected);

        // Simpan bank soal kurasi ke materi
        const newSelectedIds = newSelected10.map((q) => q.id);
        const updates: Partial<Material> = {
          quizBankQuestions: fallback,
          quizSelectedQuestionIds: newSelectedIds,
          quizQuestions: newSelected10,
          quizStatus: 'published',
          quizCuratedAt: new Date().toISOString(),
        };

        try {
          await updateMaterial(activeMaterial.id, updates);
          onSaveMaterialOptimistic?.(
            {
              ...activeMaterial,
              ...updates,
            },
            false
          );
          onRefreshData?.();
        } catch (saveErr) {
          console.warn('Gagal menyimpan fallback bank soal:', saveErr);
        }

        if (result?.error) {
          showNotify(
            'info',
            `Bank soal kurasi resmi untuk materi "${activeMaterial.title}" berhasil dimuat dan disimpan.`
          );
        } else {
          showNotify('success', `30 butir bank soal khusus materi "${activeMaterial.title}" berhasil disusun!`);
        }
      }
    } catch (err: any) {
      console.warn('AI Quiz generation error:', err);
      const catObj = categoriesMap.get(activeMaterial.categoryId);
      const subjObj = availableSubjects.find((s) => s.id === catObj?.subjectId);
      const fallback = generateFallbackQuizBank(activeMaterial, catObj?.title, subjObj?.name, tpToUse);
      setBankQuestions(fallback);
      const newSelected = new Set<string>();
      fallback.slice(0, 10).forEach((q) => newSelected.add(q.id));
      setSelectedQuestionIds(newSelected);
      showNotify(
        'warning',
        `Koneksi AI mengalami kendala (${err?.message || 'Error'}). Menggunakan bank soal kurasi cadangan.`
      );
    } finally {
      setIsGeneratingAI(false);
      setAiStatusMessage('');
    }
  };

  // -------------------------------------------------------------
  // Question Editing & Addition Handlers
  // -------------------------------------------------------------
  const handleSaveQuestionEdit = (updatedQ: QuizQuestion) => {
    setBankQuestions((prev) => prev.map((q) => (q.id === updatedQ.id ? updatedQ : q)));
    setEditingQuestion(null);
    showNotify('success', 'Perubahan butir soal berhasil disimpan di bank soal.');
  };

  const handleAddNewQuestion = (newQ: QuizQuestion) => {
    setBankQuestions((prev) => [newQ, ...prev]);
    setSelectedQuestionIds((prev) => new Set(prev).add(newQ.id));
    setIsAddingNewQuestion(false);
    showNotify('success', 'Butir soal baru berhasil ditambahkan ke bank soal materi ini.');
  };

  const handleDeleteQuestion = (qId: string) => {
    setBankQuestions((prev) => prev.filter((q) => q.id !== qId));
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      next.delete(qId);
      return next;
    });
    showNotify('success', 'Butir soal dihapus dari bank soal materi ini.');
  };

  // -------------------------------------------------------------
  // Save TP changes to Firestore
  // -------------------------------------------------------------
  const handleSaveTP = async () => {
    if (!activeMaterial) return;
    try {
      await updateMaterial(activeMaterial.id, {
        learningObjectives: editedTP.trim(),
      });
      onSaveMaterialOptimistic?.(
        {
          ...activeMaterial,
          learningObjectives: editedTP.trim(),
        },
        false
      );
      setIsEditingTP(false);
      showNotify('success', 'Tujuan Pembelajaran (TP) materi ini berhasil diperbarui!');
    } catch (err: any) {
      showNotify('error', 'Gagal memperbarui TP: ' + (err?.message || 'Error'));
    }
  };

  // -------------------------------------------------------------
  // Save & Publish to Firestore for THIS Specific Material
  // -------------------------------------------------------------
  const handleSaveQuizToMaterial = async () => {
    if (!activeMaterial) return;

    if (selectedQuestionIds.size < 1) {
      showNotify(
        'error',
        'Pilihan belum memenuhi syarat! Silakan pilih antara 1 hingga maksimal 20 butir soal untuk kuis siswa.'
      );
      return;
    }

    if (selectedQuestionIds.size > 20) {
      showNotify(
        'error',
        `Maksimal 20 butir soal untuk kuis siswa! Anda saat ini memilih ${selectedQuestionIds.size} butir soal. Silakan kurangi hingga maksimal 20 butir soal.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const selectedList = bankQuestions.filter((q) => selectedQuestionIds.has(q.id));

      const updates: Partial<Material> = {
        quizBankQuestions: bankQuestions,
        quizSelectedQuestionIds: Array.from(selectedQuestionIds),
        quizQuestions: selectedList,
        quizTargetClasses: targetClasses,
        quizRandomize: isRandomized,
        quizStatus: quizStatus,
        quizCuratedAt: new Date().toISOString(),
      };

      if (editedTP.trim() && editedTP.trim() !== (activeMaterial.learningObjectives || '').trim()) {
        updates.learningObjectives = editedTP.trim();
      }

      await updateMaterial(activeMaterial.id, updates);

      onSaveMaterialOptimistic?.(
        {
          ...activeMaterial,
          ...updates,
        },
        false
      );

      showNotify(
        'success',
        quizStatus === 'published'
          ? `Sukses! Paket kuis (${selectedList.length} soal) berhasil diterbitkan untuk siswa pada materi "${activeMaterial.title}".`
          : `Sukses! Bank soal disimpan sebagai draf pada materi "${activeMaterial.title}".`
      );
    } catch (err: any) {
      console.error('Failed to save quiz bank:', err);
      showNotify('error', 'Gagal menyimpan bank soal: ' + (err?.message || 'Error'));
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Evaluation Score Metrics & Filtered Scores
  // -------------------------------------------------------------
  const scoreMetrics = useMemo(() => {
    const targetStudents = (students || []).filter(
      (s) =>
        evalClassFilter === 'ALL' ||
        (s?.kelas && s.kelas.trim().toLowerCase() === evalClassFilter.trim().toLowerCase())
    );
    const totalTargetCount = targetStudents.length;

    const currentMaterialMaxQ =
      selectedQuestionIds.size > 0
        ? selectedQuestionIds.size
        : (activeMaterial?.quizSelectedQuestionIds?.length || activeMaterial?.quizQuestions?.length || 10);
    const maxQ = currentMaterialMaxQ > 0 ? currentMaterialMaxQ : 10;
    const reqCorrect = Math.max(1, Math.ceil((minQuizScore / 100) * maxQ));

    // Deduplicate eval scores first
    const seen = new Set<string>();
    const matchingEval: MaterialStudentQuizScoreRecord[] = [];
    evalScores.forEach((r) => {
      const key = (
        r.studentId ||
        r.id ||
        `${r.studentName.toLowerCase().trim()}_${r.studentClass.toLowerCase().trim()}`
      )
        .toLowerCase()
        .trim();
      if (!seen.has(key)) {
        seen.add(key);
        if (evalClassFilter === 'ALL' || r.studentClass === evalClassFilter) {
          matchingEval.push(r);
        }
      }
    });

    let passedCount = 0;
    let remedialCount = 0;

    matchingEval.forEach((r) => {
      const isPassed =
        r.isPassed || r.score >= maxQ || r.score >= reqCorrect || (r.percentage ?? 0) >= minQuizScore;
      if (isPassed) passedCount++;
      else remedialCount++;
    });

    const attemptedCount = matchingEval.length;
    const unattemptedCount = Math.max(0, totalTargetCount - attemptedCount);

    return {
      totalTargetCount,
      attemptedCount,
      passedCount,
      remedialCount,
      unattemptedCount,
      pendingAndRemedialCount: unattemptedCount + remedialCount,
    };
  }, [students, evalScores, evalClassFilter, selectedQuestionIds.size, activeMaterial, minQuizScore]);

  const filteredEvalScores = useMemo(() => {
    const seen = new Set<string>();
    const deduplicated: MaterialStudentQuizScoreRecord[] = [];

    evalScores.forEach((record) => {
      const key = (
        record.studentId ||
        record.id ||
        `${record.studentName.toLowerCase().trim()}_${record.studentClass.toLowerCase().trim()}`
      )
        .toLowerCase()
        .trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(record);
      }
    });

    const currentMaterialMaxQ =
      selectedQuestionIds.size > 0
        ? selectedQuestionIds.size
        : (activeMaterial?.quizSelectedQuestionIds?.length || activeMaterial?.quizQuestions?.length || 10);
    const maxQ = currentMaterialMaxQ > 0 ? currentMaterialMaxQ : 10;
    const reqCorrect = Math.max(1, Math.ceil((minQuizScore / 100) * maxQ));

    return deduplicated.filter((record) => {
      const matchesSearch =
        !evalSearchQuery ||
        record.studentName.toLowerCase().includes(evalSearchQuery.toLowerCase()) ||
        record.studentClass.toLowerCase().includes(evalSearchQuery.toLowerCase()) ||
        (record.studentAbsen && record.studentAbsen.includes(evalSearchQuery));
      const matchesClass = evalClassFilter === 'ALL' || record.studentClass === evalClassFilter;
      if (!matchesSearch || !matchesClass) return false;

      if (evalStatusFilter === 'all') return true;
      const isPassed =
        record.isPassed ||
        record.score >= maxQ ||
        record.score >= reqCorrect ||
        (record.percentage ?? 0) >= minQuizScore;
      if (evalStatusFilter === 'passed') return isPassed;
      if (evalStatusFilter === 'remedial') return !isPassed;
      return true;
    });
  }, [
    evalScores,
    evalSearchQuery,
    evalClassFilter,
    evalStatusFilter,
    selectedQuestionIds.size,
    activeMaterial,
    minQuizScore,
  ]);

  const handleExportEvalCSV = () => {
    if (filteredEvalScores.length === 0) {
      showNotify('error', 'Belum ada data nilai kuis untuk diekspor.');
      return;
    }

    const currentMaterialMaxQ =
      selectedQuestionIds.size > 0
        ? selectedQuestionIds.size
        : (activeMaterial?.quizSelectedQuestionIds?.length || activeMaterial?.quizQuestions?.length || 10);

    const headers = [
      'No',
      'Nama Siswa',
      'Kelas',
      'No. Absen',
      'Jumlah Benar',
      'Batas Tertinggi Soal',
      'Nilai Akhir (%)',
      'Standar KKM',
      'Ketuntasan TP',
      'Waktu Pengerjaan',
    ];
    const rows = filteredEvalScores.map((s, idx) => {
      const maxQ = currentMaterialMaxQ > 0 ? currentMaterialMaxQ : (s.totalQuestions || 10);
      const reqCorrect = Math.max(1, Math.ceil((minQuizScore / 100) * maxQ));

      let displayScore = s.score;
      let displayPercent = s.percentage;
      if (displayScore >= maxQ) {
        displayScore = maxQ;
        displayPercent = 100;
      } else if (displayPercent === undefined || isNaN(displayPercent) || (displayPercent <= maxQ && displayPercent === displayScore && displayPercent > 0)) {
        displayPercent = Math.min(100, Math.round((displayScore / maxQ) * 100));
      }

      const isPassed = s.isPassed || displayScore >= maxQ || displayScore >= reqCorrect || displayPercent >= minQuizScore;

      return [
        idx + 1,
        `"${s.studentName.replace(/"/g, '""')}"`,
        `"${s.studentClass}"`,
        `"${s.studentAbsen || '-'}"`,
        displayScore,
        maxQ,
        displayPercent,
        `"${minQuizScore}% (Min. ${reqCorrect} Benar)"`,
        isPassed ? 'TUNTAS' : 'BELUM TUNTAS (REMEDIAL)',
        `"${new Date(s.completedAt).toLocaleString('id-ID')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Rekap_Nilai_Kuis_${activeMaterial?.title ? activeMaterial.title.replace(/\s+/g, '_') : 'Materi'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotify('success', 'Rekap nilai kuis berhasil diunduh (CSV).');
  };

  // -------------------------------------------------------------
  // Reset Single Student Progress for Active Material (Instant & Real-time)
  // -------------------------------------------------------------
  const handleResetStudentDirect = async (student: MaterialStudentQuizScoreRecord) => {
    if (!student || !activeMaterial) return;
    if (resettingStudentId === student.studentId) return;

    const targetStudentId = student.studentId;
    const targetStudentName = student.studentName;
    const targetId = student.id;

    setIsResetting(true);
    setResettingStudentId(targetStudentId);

    // 1. OPTIMISTIC REAL-TIME REMOVAL: Seketika hilangkan data dari tabel tanpa refresh browser (0 ms)
    const previousScores = [...evalScores];
    setEvalScores((prev) =>
      prev.filter(
        (r) =>
          r.studentId !== targetStudentId &&
          r.id !== targetStudentId &&
          r.id !== targetId &&
          r.studentName?.toLowerCase().trim() !== targetStudentName?.toLowerCase().trim()
      )
    );

    try {
      const matched = students?.find(
        (s) =>
          s.id === targetStudentId ||
          s.nisn === targetStudentId ||
          (s.nama && s.nama.toLowerCase().trim() === targetStudentName.toLowerCase().trim())
      );
      const additionalIds = matched ? [matched.id, matched.nisn].filter(Boolean) : [];

      const res = await resetStudentMaterialProgress(
        targetStudentId,
        activeMaterial.id,
        additionalIds
      );

      if (res.success) {
        showNotify(
          'success',
          `Sukses! Pengerjaan kuis siswa "${targetStudentName}" telah direset secara real-time. Materi "${activeMaterial.title}" kembali ke kondisi awal.`
        );
        // Sync background data
        onRefreshData?.().catch(() => {});
      } else {
        // Rollback state if backend operation returned unsuccessful
        setEvalScores(previousScores);
        showNotify('error', res.message || 'Gagal mereset data siswa.');
      }
    } catch (err: any) {
      console.error('Failed to reset student quiz:', err);
      // Rollback state on exception
      setEvalScores(previousScores);
      showNotify('error', 'Terjadi kesalahan saat mereset: ' + (err?.message || 'Error'));
    } finally {
      setIsResetting(false);
      setResettingStudentId(null);
    }
  };

  // -------------------------------------------------------------
  // Reset All Students Progress for Active Material (Instant & Real-time)
  // -------------------------------------------------------------
  const handleConfirmResetAll = async () => {
    if (!activeMaterial) return;

    const previousScores = [...evalScores];
    setIsResettingAll(true);
    setShowResetAllConfirm(false);
    // Optimistic real-time clear
    setEvalScores([]);

    try {
      const res = await resetAllStudentsMaterialProgress(activeMaterial.id);
      if (res.success) {
        showNotify(
          'success',
          `Berhasil mereset seluruh pengerjaan kuis untuk materi "${activeMaterial.title}" (${res.count} siswa direset) secara real-time.`
        );
        onRefreshData?.().catch(() => {});
      } else {
        setEvalScores(previousScores);
        showNotify('error', res.message || 'Gagal mereset semua data siswa.');
      }
    } catch (err: any) {
      console.error('Failed to reset all students quiz:', err);
      setEvalScores(previousScores);
      showNotify('error', 'Terjadi kesalahan: ' + (err?.message || 'Error'));
    } finally {
      setIsResettingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          Header Banner (Identical to Material View)
          ------------------------------------------------------------- */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
              <span>Bank Soal Mini Kuis AI per Bahan Ajar</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full">
                Gemini 2.5 Flash
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Susunan terstruktur sama persis dengan halaman materi. Soal terpisah rapi untuk setiap materi dan dibuat
              oleh AI dominan berbasis Tujuan Pembelajaran (TP).
            </p>
          </div>
        </div>

        {activeMaterial && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMaterialId(null)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Tutup Editor Soal</span>
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          Filter Toolbar & Search Bar (Hidden in Teacher Dashboard)
          ------------------------------------------------------------- */}
      {!isTeacherRole && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari materi, bab topik, atau indikator TP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Subject Filter */}
              <select
                value={selectedSubjectFilter}
                onChange={(e) => {
                  setSelectedSubjectFilter(e.target.value);
                  setSelectedCategoryFilter('all');
                }}
                className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="all">Semua Mapel</option>
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Category / Bab Filter */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="all">Semua Bab</option>
                {(categories || [])
                  .filter(
                    (c) =>
                      selectedSubjectFilter === 'all' ||
                      (c.subjectId || 'informatika') === selectedSubjectFilter
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="all">Semua Status Kuis</option>
                <option value="published">Kuis Aktif (≥10 Soal)</option>
                <option value="draft">Draf / Belum Disimpan</option>
              </select>

              {/* Expand / Collapse All */}
              <button
                type="button"
                onClick={handleExpandAll}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Buka Semua Grup"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Tutup Semua Grup"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grade Quick Filter Bar (Identical to MaterialListView) */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Pisahkan Tingkat:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedGradeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                selectedGradeFilter === 'all'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Tingkat
            </button>

            {effectiveGrades.map((g) => {
              const isSelected = selectedGradeFilter === g.id;
              const countForGrade = (materials || []).filter((m) => getMaterialGrade(m) === g.id).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGradeFilter(g.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{g.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {countForGrade}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedGradeFilter('general')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedGradeFilter === 'general'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Semua Jenjang / Umum</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedGradeFilter === 'general' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {(materials || []).filter((m) => getMaterialGrade(m) === 'all').length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          Material Hierarchy (Identical to MaterialListView)
          Mata Pelajaran -> Jenjang Kelas -> Kategori / Bab -> Materi Cards
          ------------------------------------------------------------- */}
      <div className="space-y-5">
        {availableSubjects.map((s) => {
          if (selectedSubjectFilter !== 'all' && selectedSubjectFilter !== s.id) return null;
          const subjData = groupedDataBySubject[s.id];
          if (!subjData) return null;
          if (subjData.totalMaterials === 0 && searchQuery) return null;

          const isSubjCollapsed = !!collapsedSubjects[s.id];

          return (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
            >
              {/* Subject Header */}
              <div
                onClick={() => toggleSubject(s.id)}
                className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white text-amber-600 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">{s.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      {subjData.totalMaterials} Materi Terdaftar • Bank Soal AI Terpisah per Materi
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    {isSubjCollapsed ? 'Buka Mapel' : 'Tutup Mapel'}
                  </span>
                  {isSubjCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Subject Content */}
              {!isSubjCollapsed && (
                <div className="p-4 sm:p-5 space-y-5">
                  {subjData.byGrade.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
                      Belum ada bahan ajar yang terdaftar pada mata pelajaran ini
                    </div>
                  ) : (
                    subjData.byGrade.map((gradeGroup) => {
                      const theme = getGradeTheme(gradeGroup.gradeId);
                      const collapseKey = `${s.id}_mat_grade_${gradeGroup.gradeId}`;
                      const isGradeCollapsed = !!collapsedGrades[collapseKey];

                      return (
                        <div
                          key={gradeGroup.gradeId}
                          className={`rounded-xl border ${theme.border} overflow-hidden bg-white shadow-2xs`}
                        >
                          {/* Grade Header */}
                          <div
                            onClick={() => toggleGrade(collapseKey)}
                            className={`px-4 py-3 ${theme.headerBg} border-b ${theme.border} flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center font-extrabold text-xs shrink-0`}
                              >
                                <GraduationCap className="w-4 h-4" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                                  {gradeGroup.gradeLabel}
                                </span>
                                {gradeGroup.gradeSubLabel && (
                                  <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                                    • {gradeGroup.gradeSubLabel}
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${theme.badge}`}
                                >
                                  {gradeGroup.totalCount} Materi
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-slate-400">
                              {isGradeCollapsed ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronUp className="w-4 h-4" />
                              )}
                            </div>
                          </div>

                          {/* Grade Categories */}
                          {!isGradeCollapsed && (
                            <div className="p-3 space-y-3">
                              {gradeGroup.categoriesWithMaterials.map(({ category: c, materials: catMats }) => {
                                if (selectedCategoryFilter !== 'all' && selectedCategoryFilter !== c.id) {
                                  return null;
                                }
                                // Default collapsed (closed) initially so only topics are shown, expand if explicitly false or searching
                                const isCatCollapsed = searchQuery.trim() ? !!collapsedCategories[c.id] : (collapsedCategories[c.id] !== false);

                                return (
                                  <div
                                    key={c.id}
                                    className={`transition-all duration-200 overflow-hidden ${
                                      !isCatCollapsed
                                        ? 'border-2 border-blue-600 bg-white rounded-2xl shadow-md shadow-blue-100/50 ring-4 ring-blue-500/10'
                                        : 'border border-slate-200/90 rounded-xl bg-white shadow-2xs hover:border-blue-300'
                                    }`}
                                  >
                                    {/* Category Header */}
                                    <div
                                      onClick={() => toggleCategory(c.id)}
                                      className={`p-3 transition-all duration-200 flex items-center justify-between cursor-pointer select-none ${
                                        !isCatCollapsed
                                          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-b border-blue-700/80 shadow-xs'
                                          : 'bg-slate-50/80 hover:bg-blue-50/50 text-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                            !isCatCollapsed
                                              ? 'bg-white/20 border border-white/30 text-white shadow-2xs'
                                              : 'bg-slate-100 border border-slate-200 text-amber-600'
                                          }`}
                                        >
                                          <Layers className="w-4 h-4" />
                                        </div>
                                        <span
                                          className={`truncate ${
                                            !isCatCollapsed
                                              ? 'font-black text-xs sm:text-sm text-white tracking-wide'
                                              : 'font-bold text-xs sm:text-sm text-slate-800'
                                          }`}
                                        >
                                          {c.title}
                                        </span>
                                        <span
                                          className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                                            !isCatCollapsed
                                              ? 'bg-white/20 text-white border border-white/25'
                                              : 'text-slate-500 bg-slate-100'
                                          }`}
                                        >
                                          {catMats.length} materi
                                        </span>

                                        {!isCatCollapsed && (
                                          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-slate-950 uppercase tracking-wide shrink-0 shadow-2xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-900 animate-pulse" />
                                            Sedang Dibuka
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <div
                                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors ${
                                            !isCatCollapsed
                                              ? 'text-white bg-white/15 hover:bg-white/25'
                                              : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                          }`}
                                        >
                                          <span className="hidden sm:inline">
                                            {!isCatCollapsed ? 'Tutup' : 'Buka'}
                                          </span>
                                          {!isCatCollapsed ? (
                                            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" />
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Materials List in Category */}
                                    {!isCatCollapsed && (
                                      <div className="divide-y divide-slate-100">
                                        {catMats.length === 0 ? (
                                          <div className="text-center text-slate-400 text-xs py-3">
                                            Belum ada bahan ajar di bab ini.
                                          </div>
                                        ) : (
                                          catMats.map((m) => {
                                            const isSelectedActive = activeMaterialId === m.id;
                                            const isQuizCurated =
                                              m.quizStatus === 'published' &&
                                              (m.quizQuestions?.length || 0) >= 10;
                                            const questionsCount =
                                              m.quizBankQuestions?.length ||
                                              (m.quizQuestions?.length ? 30 : 30);

                                            return (
                                              <div
                                                key={m.id}
                                                className={`transition-all ${
                                                  isSelectedActive
                                                    ? 'bg-amber-50/30 ring-2 ring-amber-400/50 rounded-xl my-2'
                                                    : 'hover:bg-slate-50/70'
                                                }`}
                                              >
                                                {/* Material Summary Row */}
                                                <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                                                    <div className="shrink-0 mt-0.5 sm:mt-0">
                                                      {getTypeBadge(m.type)}
                                                    </div>

                                                    <div className="min-w-0">
                                                      <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                                                          {m.title}
                                                        </span>

                                                        <span
                                                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${theme.badge}`}
                                                        >
                                                          {getGradeBadgeLabel(m.targetGrade || c.targetGrade)}
                                                        </span>

                                                        {/* Status Badge */}
                                                        {isMaterialGoogleForm(m) ? (
                                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                                            Form Langsung (Tanpa Mini Kuis)
                                                          </span>
                                                        ) : isQuizCurated ? (
                                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            Kuis Aktif ({m.quizQuestions?.length} Soal)
                                                          </span>
                                                        ) : (
                                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                                            <Sparkles className="w-3 h-3 text-amber-600" />
                                                            30 Soal AI Siap
                                                          </span>
                                                        )}
                                                      </div>

                                                      {/* TP Snippet */}
                                                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                                        <strong className="text-slate-700 font-semibold">
                                                          TP:{' '}
                                                        </strong>
                                                        {m.learningObjectives ||
                                                          (isMaterialGoogleForm(m)
                                                            ? 'TP Opsional (Instrumen evaluasi langsung di Google Form)'
                                                            : m.description) ||
                                                          'Tujuan Pembelajaran belum diisi secara spesifik.'}
                                                      </p>
                                                    </div>
                                                  </div>

                                                  {/* Actions for this Material */}
                                                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                                    {isMaterialGoogleForm(m) ? (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          if (isSelectedActive) {
                                                            setActiveMaterialId(null);
                                                          } else {
                                                            setActiveMaterialId(m.id);
                                                          }
                                                        }}
                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                                          isSelectedActive
                                                            ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                                                            : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-200'
                                                        }`}
                                                      >
                                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                                        <span>
                                                          {isSelectedActive ? 'Tutup Info Form' : 'Info Google Form'}
                                                        </span>
                                                        {isSelectedActive ? (
                                                          <ChevronUp className="w-3.5 h-3.5" />
                                                        ) : (
                                                          <ChevronDown className="w-3.5 h-3.5" />
                                                        )}
                                                      </button>
                                                    ) : (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          if (isSelectedActive) {
                                                            setActiveMaterialId(null);
                                                          } else {
                                                            setActiveMaterialId(m.id);
                                                            setActiveSubTab('questions');
                                                          }
                                                        }}
                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                                          isSelectedActive
                                                            ? 'bg-amber-600 text-white ring-2 ring-amber-300'
                                                            : 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}
                                                      >
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        <span>
                                                          {isSelectedActive
                                                            ? 'Tutup Bank Soal'
                                                            : `Buka Bank Soal (30 Soal AI)`}
                                                        </span>
                                                        {isSelectedActive ? (
                                                          <ChevronUp className="w-3.5 h-3.5" />
                                                        ) : (
                                                          <ChevronDown className="w-3.5 h-3.5" />
                                                        )}
                                                      </button>
                                                    )}

                                                    {!isMaterialGoogleForm(m) && (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setActiveMaterialId(m.id);
                                                          setActiveSubTab('scores');
                                                        }}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                                        title="Lihat Rekap Nilai Kuis Siswa"
                                                      >
                                                        <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                                                        <span className="hidden sm:inline">Rekap Nilai</span>
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>

                                                {/* -------------------------------------------------------------
                                                    DEDICATED QUIZ MANAGER (FOR THIS SPECIFIC MATERIAL ONLY)
                                                    ------------------------------------------------------------- */}
                                                {isSelectedActive && activeMaterial && (
                                                  isMaterialGoogleForm(activeMaterial) ? (
                                                    <div className="p-4 sm:p-6 bg-blue-50/50 border-t border-blue-200/80 rounded-b-xl space-y-4">
                                                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-blue-200/60">
                                                        <div>
                                                          <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-black text-[10px] rounded uppercase tracking-wider">
                                                              Materi Google Form
                                                            </span>
                                                            <span className="text-xs text-slate-500 font-medium">
                                                              Bab: {c.title}
                                                            </span>
                                                          </div>
                                                          <h4 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                                            {activeMaterial.title}
                                                          </h4>
                                                        </div>
                                                      </div>

                                                      <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-2xs space-y-4">
                                                        <div className="flex items-start gap-3">
                                                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                                                            <FileSpreadsheet className="w-5 h-5" />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <h5 className="text-sm font-bold text-slate-900">
                                                              Instrumen Evaluasi Tersemat di Google Form
                                                            </h5>
                                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                              Materi ini menggunakan tautan Google Form langsung sehingga <strong>tidak memerlukan perumusan butir mini kuis</strong> di sistem ini. Seluruh butir soal atau asesmen dikerjakan siswa langsung melalui formulir Google Form.
                                                            </p>
                                                          </div>
                                                        </div>

                                                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                          <div className="min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-800 block">Tautan Formulir:</span>
                                                            <span className="text-xs text-slate-500 font-mono truncate block">
                                                              {activeMaterial.originalUrl || activeMaterial.embedUrl}
                                                            </span>
                                                          </div>
                                                          {(activeMaterial.originalUrl || activeMaterial.embedUrl) && (
                                                            <a
                                                              href={activeMaterial.originalUrl || activeMaterial.embedUrl}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors shrink-0"
                                                            >
                                                              <span>Buka Form</span>
                                                              <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                          )}
                                                        </div>

                                                        {activeMaterial.gformSpreadsheetUrl ? (
                                                          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                              <span className="text-xs font-bold text-emerald-900 block">Google Sheets Tanggapan Siswa:</span>
                                                              <span className="text-xs text-emerald-700 font-mono truncate block">
                                                                {activeMaterial.gformSpreadsheetUrl}
                                                              </span>
                                                            </div>
                                                            <a
                                                              href={activeMaterial.gformSpreadsheetUrl}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors shrink-0"
                                                            >
                                                              <FileSpreadsheet className="w-3.5 h-3.5" />
                                                              <span>Buka Spreadsheet</span>
                                                              <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                          </div>
                                                        ) : (
                                                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                                            <span>
                                                              Google Spreadsheet tanggapan belum dihubungkan. Anda dapat menautkannya melalui menu <strong>Kelola Materi &gt; Edit</strong> untuk sinkronisasi nilai otomatis.
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="p-4 sm:p-6 bg-amber-50/40 border-t border-amber-200/80 rounded-b-xl space-y-5">
                                                    {/* Material Dedicated Header & Sub-Tabs */}
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-amber-200/60">
                                                      <div>
                                                        <div className="flex items-center gap-2">
                                                          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-black text-[10px] rounded uppercase tracking-wider">
                                                            Bank Soal Khusus Materi
                                                          </span>
                                                          <span className="text-xs text-slate-500 font-medium">
                                                            Bab: {c.title}
                                                          </span>
                                                        </div>
                                                        <h4 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                                          {activeMaterial.title}
                                                        </h4>
                                                      </div>

                                                      {/* Sub-Tabs */}
                                                      <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start md:self-auto">
                                                        <button
                                                          type="button"
                                                          onClick={() => setActiveSubTab('questions')}
                                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                            activeSubTab === 'questions'
                                                              ? 'bg-amber-600 text-white shadow-xs'
                                                              : 'text-slate-600 hover:bg-slate-100'
                                                          }`}
                                                        >
                                                          <Sparkles className="w-3.5 h-3.5" />
                                                          <span>30 Butir Soal AI</span>
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() => setActiveSubTab('scores')}
                                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                            activeSubTab === 'scores'
                                                              ? 'bg-blue-600 text-white shadow-xs'
                                                              : 'text-slate-600 hover:bg-slate-100'
                                                          }`}
                                                        >
                                                          <BarChart3 className="w-3.5 h-3.5" />
                                                          <span>Progres Siswa</span>
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() => setActiveSubTab('settings')}
                                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                            activeSubTab === 'settings'
                                                              ? 'bg-slate-800 text-white shadow-xs'
                                                              : 'text-slate-600 hover:bg-slate-100'
                                                          }`}
                                                        >
                                                          <Sliders className="w-3.5 h-3.5" />
                                                          <span>Pengaturan Kuis</span>
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* AI Status Progress Bar */}
                                                    {isGeneratingAI && (
                                                      <div className="p-4 bg-amber-100/90 border border-amber-300 rounded-2xl flex items-center gap-3 animate-pulse">
                                                        <Sparkles className="w-5 h-5 text-amber-700 animate-spin" />
                                                        <div className="flex-1">
                                                          <p className="text-xs font-bold text-amber-900">
                                                            {aiStatusMessage || 'Gemini AI sedang merumuskan 30 butir soal...'}
                                                          </p>
                                                          <p className="text-[11px] text-amber-700">
                                                            Soal difokuskan dominan pada Tujuan Pembelajaran (TP) materi ini.
                                                          </p>
                                                        </div>
                                                      </div>
                                                    )}

                                                    {/* TAB 1: 30 Questions Manager */}
                                                    {activeSubTab === 'questions' && (
                                                      <div className="space-y-5">
                                                        {/* TP (Tujuan Pembelajaran) Card */}
                                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                                                          <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                              <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                                                                <Target className="w-4 h-4" />
                                                              </div>
                                                              <div>
                                                                <h5 className="font-extrabold text-xs text-slate-800">
                                                                  Tujuan Pembelajaran (TP) Acuan Soal
                                                                </h5>
                                                                <p className="text-[10px] text-slate-500">
                                                                  AI merancang 30 soal dengan bobot ~70-80% langsung menguji pencapaian TP ini
                                                                </p>
                                                              </div>
                                                            </div>

                                                            <div>
                                                              {isEditingTP ? (
                                                                <div className="flex items-center gap-1.5">
                                                                  <button
                                                                    type="button"
                                                                    onClick={handleSaveTP}
                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                                                                  >
                                                                    <Check className="w-3.5 h-3.5" />
                                                                    <span>Simpan TP</span>
                                                                  </button>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                      setIsEditingTP(false);
                                                                      setEditedTP(activeMaterial.learningObjectives || '');
                                                                    }}
                                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg cursor-pointer"
                                                                  >
                                                                    Batal
                                                                  </button>
                                                                </div>
                                                              ) : (
                                                                <button
                                                                  type="button"
                                                                  onClick={() => setIsEditingTP(true)}
                                                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                                                                >
                                                                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                                                  <span>Edit TP</span>
                                                                </button>
                                                              )}
                                                            </div>
                                                          </div>

                                                          {isEditingTP ? (
                                                            <textarea
                                                              rows={3}
                                                              value={editedTP}
                                                              onChange={(e) => setEditedTP(e.target.value)}
                                                              placeholder="Tuliskan butir-butir Tujuan Pembelajaran (TP) materi ini..."
                                                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                                                            />
                                                          ) : (
                                                            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                              {activeMaterial.learningObjectives ? (
                                                                activeMaterial.learningObjectives
                                                              ) : (
                                                                <span className="text-slate-400 italic">
                                                                  Belum ada deskripsi Tujuan Pembelajaran spesifik. Klik &apos;Edit TP&apos; untuk menuliskan TP materi ini.
                                                                </span>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>

                                                        {/* Vercel AI Key Diagnostic Banner */}
                                                        {serverAIStatus.checked && !serverAIStatus.hasGeminiKey && (
                                                          <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
                                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                            <div className="space-y-1.5 flex-1">
                                                              <div className="font-extrabold text-amber-950 flex items-center gap-1.5 flex-wrap">
                                                                <span>Kunci Gemini AI Belum Terdeteksi di Vercel</span>
                                                                <span className="px-1.5 py-0.5 bg-amber-200/80 text-amber-900 font-bold text-[10px] rounded-md">Mode Kurasi Cadangan Aktif</span>
                                                              </div>
                                                              <p className="text-[11px] text-amber-800 leading-relaxed">
                                                                Tombol refresh saat ini menggunakan 30 butir bank soal kurasi resmi kurikulum agar aplikasi tetap berjalan lancar tanpa error. Agar tombol ini merumuskan soal baru secara dinamis via Google Gemini AI:
                                                              </p>
                                                              <div className="text-[11px] text-amber-900 font-medium bg-amber-100/70 p-2.5 rounded-xl border border-amber-200/80 space-y-1">
                                                                <div>1. Buka <strong>Vercel Dashboard</strong> &rarr; Pilih Proyek &rarr; Tab <strong>Settings</strong> &rarr; <strong>Environment Variables</strong>.</div>
                                                                <div>2. Tambahkan variable: <code className="bg-white/90 px-1 py-0.5 rounded font-mono font-bold text-amber-950">GEMINI_API_KEY</code> dengan API Key dari Google AI Studio.</div>
                                                                <div>3. Buka tab <strong>Deployments</strong> &rarr; klik menu titik tiga (<strong>...</strong>) &rarr; pilih <strong>Redeploy</strong> agar kunci terbaca oleh serverless Vercel.</div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        )}

                                                        {/* Action Toolbar & Counter */}
                                                         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                                                           {/* Left: Counter badge & Enrichment indicator */}
                                                           <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                             <div
                                                               className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-2 ${
                                                                 selectedQuestionIds.size >= 1 && selectedQuestionIds.size <= 20
                                                                   ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                                   : "bg-rose-50 text-rose-800 border border-rose-200"
                                                               }`}
                                                             >
                                                               <CheckCircle2
                                                                 className={`w-4 h-4 ${
                                                                   selectedQuestionIds.size >= 1 && selectedQuestionIds.size <= 20
                                                                     ? "text-emerald-600"
                                                                     : "text-rose-500"
                                                                 }`}
                                                               />
                                                               <span>
                                                                 <strong>{selectedQuestionIds.size}</strong> dari {bankQuestions.length || 30} Soal Terpilih untuk Siswa (Maks. 20)
                                                               </span>
                                                             </div>

                                                             {selectedQuestionIds.size >= 1 && selectedQuestionIds.size <= 20 ? (
                                                               <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-bold inline-flex items-center gap-1">
                                                                 <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                                                 <span>{Math.max(0, bankQuestions.length - selectedQuestionIds.size)} Soal Sisa untuk Pengayaan Siswa Juara 100%</span>
                                                               </span>
                                                             ) : selectedQuestionIds.size === 0 ? (
                                                               <span className="text-[11px] text-rose-600 font-bold">
                                                                 (Pilih antara 1 hingga 20 butir soal)
                                                               </span>
                                                             ) : (
                                                               <span className="text-[11px] text-rose-600 font-bold">
                                                                 (Maksimal 20 butir soal! Kurangi {selectedQuestionIds.size - 20} butir)
                                                               </span>
                                                             )}
                                                           </div>

                                                           {/* Right: Quick Action Buttons */}
                                                           <div className="flex items-center gap-1.5 flex-wrap">
                                                             <button
                                                               id="btn-admin-refresh-bank-ai"
                                                               type="button"
                                                               onClick={() => handleGenerateAI(true)}
                                                               disabled={isGeneratingAI}
                                                               className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer group"
                                                               title={
                                                                 !serverAIStatus.hasGeminiKey
                                                                   ? `Refresh 30 butir bank soal kurasi materi "${activeMaterial.title}" (Kunci GEMINI_API_KEY belum terpasang di Vercel)`
                                                                   : `Refresh dan formulasikan ulang 30 butir bank soal khusus untuk materi "${activeMaterial.title}" tanpa mempengaruhi materi lain`
                                                               }
                                                             >
                                                               <RefreshCw className={`w-3.5 h-3.5 text-white transition-transform duration-500 group-hover:rotate-180 shrink-0 ${isGeneratingAI ? "animate-spin" : ""}`} />
                                                               <span>{isGeneratingAI ? "Merumuskan Soal..." : "Refresh / Buat Ulang Soal AI"}</span>
                                                               {serverAIStatus.checked && !serverAIStatus.hasGeminiKey && (
                                                                 <span className="px-1 py-0.2 bg-black/20 text-white/90 text-[9px] rounded font-medium">Kurasi</span>
                                                               )}
                                                             </button>

                                                             {/* Quick selection presets */}
                                                             <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                                                               <button
                                                                 type="button"
                                                                 onClick={() => handleSelectRandomCount(10)}
                                                                 className="px-2 py-1 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                                                 title="Pilih 10 butir soal acak"
                                                               >
                                                                 Acak 10
                                                               </button>
                                                               <button
                                                                 type="button"
                                                                 onClick={() => handleSelectRandomCount(15)}
                                                                 className="px-2 py-1 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                                                 title="Pilih 15 butir soal acak"
                                                               >
                                                                 Acak 15
                                                               </button>
                                                               <button
                                                                 type="button"
                                                                 onClick={() => handleSelectRandomCount(20)}
                                                                 className="px-2 py-1 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                                                 title="Pilih 20 butir soal acak (Maksimal)"
                                                               >
                                                                 Acak 20
                                                               </button>
                                                             </div>

                                                             <button
                                                               type="button"
                                                               onClick={handleSelectAll}
                                                               className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                                               title="Pilih maksimal 20 butir soal"
                                                             >
                                                               <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                                                               <span>Pilih 20 (Maks)</span>
                                                             </button>

                                                             <button
                                                               type="button"
                                                               onClick={handleResetSelection}
                                                               className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                                             >
                                                               <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                                                               <span>Reset</span>
                                                             </button>

                                                             <button
                                                               type="button"
                                                               onClick={() => setIsAddingNewQuestion(true)}
                                                               className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                                             >
                                                               <Plus className="w-3.5 h-3.5" />
                                                               <span>Tambah Soal</span>
                                                             </button>

                                                             <button
                                                               type="button"
                                                               onClick={handleSaveQuizToMaterial}
                                                               disabled={isSaving || selectedQuestionIds.size < 1 || selectedQuestionIds.size > 20}
                                                               className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-emerald-200 cursor-pointer ml-auto md:ml-0"
                                                             >
                                                               <Save className="w-3.5 h-3.5" />
                                                               <span>{isSaving ? "Menyimpan..." : `Simpan Kuis (${selectedQuestionIds.size} Soal)`}</span>
                                                             </button>
                                                           </div>
                                                         </div>

                                                         {/* Questions Grid / List (30 Items) */}
                                                        <div className="space-y-3">
                                                          {bankQuestions.length === 0 ? (
                                                            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs font-semibold space-y-3">
                                                              <p>Belum ada bank soal yang tersimpan untuk materi ini.</p>
                                                              <button
                                                                type="button"
                                                                onClick={() => handleGenerateAI(true)}
                                                                disabled={isGeneratingAI}
                                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-sm"
                                                              >
                                                                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                                                                <span>{isGeneratingAI ? 'Menyusun Soal AI...' : 'Buat 30 Soal Baru dengan AI (Refresh)'}</span>
                                                              </button>
                                                            </div>
                                                          ) : (
                                                            bankQuestions.map((q, index) => {
                                                              const isSelected = selectedQuestionIds.has(q.id);
                                                              const bloomsTaxonomy =
                                                                index % 4 === 0
                                                                  ? 'C4 (Analisis HOTS)'
                                                                  : index % 3 === 0
                                                                  ? 'C3 (Aplikasi)'
                                                                  : index % 2 === 0
                                                                  ? 'C2 (Pemahaman)'
                                                                  : 'C1 (Mengingat)';

                                                              return (
                                                                <div
                                                                  key={q.id || index}
                                                                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                                                    isSelected
                                                                      ? 'bg-white border-emerald-300 shadow-sm ring-2 ring-emerald-500/10'
                                                                      : 'bg-white/80 border-slate-200 opacity-80 hover:opacity-100'
                                                                  }`}
                                                                >
                                                                  {/* Question Header */}
                                                                  <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center">
                                                                        #{index + 1}
                                                                      </span>

                                                                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                        {bloomsTaxonomy}
                                                                      </span>

                                                                      {isSelected ? (
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                          ✓ Masuk Kuis Siswa
                                                                        </span>
                                                                      ) : (
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                                                          Cadangan di Bank Soal
                                                                        </span>
                                                                      )}
                                                                    </div>

                                                                    {/* Selection & Edit Controls */}
                                                                    <div className="flex items-center gap-2">
                                                                      <button
                                                                        type="button"
                                                                        onClick={() => toggleSelectQuestion(q.id)}
                                                                        className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                                                          isSelected
                                                                            ? 'bg-emerald-600 text-white'
                                                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                                        }`}
                                                                      >
                                                                        {isSelected ? (
                                                                          <>
                                                                            <CheckSquare className="w-3.5 h-3.5" />
                                                                            <span>Dipilih</span>
                                                                          </>
                                                                        ) : (
                                                                          <>
                                                                            <Square className="w-3.5 h-3.5" />
                                                                            <span>Pilih Soal</span>
                                                                          </>
                                                                        )}
                                                                      </button>

                                                                      <button
                                                                        type="button"
                                                                        onClick={() => setEditingQuestion(q)}
                                                                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 cursor-pointer"
                                                                        title="Edit Butir Soal"
                                                                      >
                                                                        <Edit3 className="w-3.5 h-3.5" />
                                                                      </button>

                                                                      <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteQuestion(q.id)}
                                                                        className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg border border-slate-200 cursor-pointer"
                                                                        title="Hapus Butir Soal"
                                                                      >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                      </button>
                                                                    </div>
                                                                  </div>

                                                                  {/* Question Prompt */}
                                                                  <p className="text-xs sm:text-sm font-bold text-slate-900 mt-3 leading-relaxed">
                                                                    {q.question}
                                                                  </p>

                                                                  {/* Choices A, B, C, D */}
                                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                                                    {(q.options || []).map((opt, optIdx) => {
                                                                      const correctIdx = typeof q.correctAnswerIndex === 'number'
                                                                        ? q.correctAnswerIndex
                                                                        : typeof (q as any).correctAnswer === 'number'
                                                                          ? (q as any).correctAnswer
                                                                          : 0;
                                                                      const isCorrect = optIdx === correctIdx;
                                                                      const optLetter = String.fromCharCode(65 + optIdx);

                                                                      return (
                                                                        <div
                                                                          key={optIdx}
                                                                          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition-colors ${
                                                                            isCorrect
                                                                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold'
                                                                              : 'bg-slate-50 border-slate-200/80 text-slate-700'
                                                                          }`}
                                                                        >
                                                                          <span
                                                                            className={`w-5 h-5 rounded font-black text-[11px] flex items-center justify-center shrink-0 ${
                                                                              isCorrect
                                                                                ? 'bg-emerald-600 text-white'
                                                                                : 'bg-slate-200 text-slate-600'
                                                                            }`}
                                                                          >
                                                                            {optLetter}
                                                                          </span>
                                                                          <span className="flex-1">{opt}</span>
                                                                          {isCorrect && (
                                                                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                          )}
                                                                        </div>
                                                                      );
                                                                    })}
                                                                  </div>

                                                                  {/* Explanation */}
                                                                  {q.explanation && (
                                                                    <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 flex items-start gap-2">
                                                                      <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                                                      <div>
                                                                        <strong className="text-slate-700">
                                                                          Pembahasan Pedagogis:{' '}
                                                                        </strong>
                                                                        {q.explanation}
                                                                      </div>
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              );
                                                            })
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}

                                                    {/* TAB 2: Student Quiz Scores for this Material */}
                                                    {activeSubTab === 'scores' && (
                                                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                                          <div>
                                                            <h5 className="font-extrabold text-sm text-slate-900">
                                                              Rekap Hasil Pengerjaan Siswa
                                                            </h5>
                                                            <p className="text-xs text-slate-500">
                                                              Batas Tertinggi Soal:{' '}
                                                              <span className="font-extrabold text-indigo-700">
                                                                {selectedQuestionIds.size > 0
                                                                  ? selectedQuestionIds.size
                                                                  : activeMaterial?.quizSelectedQuestionIds?.length || activeMaterial?.quizQuestions?.length || 10}{' '}
                                                                Butir
                                                              </span>{' '}
                                                              &bull; Standar KKM:{' '}
                                                              <span className="font-extrabold text-indigo-700">{minQuizScore}%</span>{' '}
                                                              (Minimal{' '}
                                                              <span className="font-extrabold text-emerald-700">
                                                                {Math.max(
                                                                  1,
                                                                  Math.ceil(
                                                                    (minQuizScore / 100) *
                                                                      (selectedQuestionIds.size > 0
                                                                        ? selectedQuestionIds.size
                                                                        : activeMaterial?.quizSelectedQuestionIds?.length || activeMaterial?.quizQuestions?.length || 10)
                                                                  )
                                                                )}{' '}
                                                                jawaban benar
                                                              </span>
                                                              )
                                                            </p>
                                                          </div>

                                                          <div className="flex items-center gap-2 flex-wrap">
                                                            <button
                                                              id="btn-open-progress-tracker-modal"
                                                              type="button"
                                                              onClick={() => {
                                                                setProgressTrackerInitialTab('not_attempted');
                                                                setIsProgressTrackerModalOpen(true);
                                                              }}
                                                              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-200 cursor-pointer border border-indigo-500 hover:scale-[1.02] active:scale-95"
                                                              title="Pantau siswa yang belum mengerjakan kuis dan siswa yang memerlukan remedial per kelas"
                                                            >
                                                              <Users className="w-4 h-4 text-white" />
                                                              <span>Pelacak Progres & Remedial</span>
                                                              {scoreMetrics.pendingAndRemedialCount > 0 && (
                                                                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow-xs">
                                                                  {scoreMetrics.pendingAndRemedialCount}
                                                                </span>
                                                              )}
                                                            </button>

                                                            <button
                                                              type="button"
                                                              onClick={handleExportEvalCSV}
                                                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 border border-emerald-200 cursor-pointer"
                                                            >
                                                              <Download className="w-3.5 h-3.5" />
                                                              <span>Ekspor CSV</span>
                                                            </button>
                                                          </div>
                                                        </div>

                                                        {/* Quick Stat KPI Cards per Active Material */}
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                                                          <div
                                                            onClick={() => {
                                                              setProgressTrackerInitialTab('all');
                                                              setIsProgressTrackerModalOpen(true);
                                                            }}
                                                            className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl cursor-pointer hover:bg-indigo-100/70 transition-all shadow-2xs group"
                                                            title="Klik untuk membuka pelacak progres seluruh siswa"
                                                          >
                                                            <div className="flex items-center justify-between text-indigo-800 text-[10px] font-extrabold uppercase">
                                                              <span>Target Siswa</span>
                                                              <Users className="w-3.5 h-3.5 text-indigo-600" />
                                                            </div>
                                                            <div className="text-lg font-black text-indigo-950 mt-1">
                                                              {scoreMetrics.totalTargetCount}
                                                              <span className="text-[11px] font-normal text-slate-500 ml-1">Siswa</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-indigo-600 block mt-0.5 group-hover:underline">
                                                              {scoreMetrics.attemptedCount} Telah Mengerjakan &rarr;
                                                            </span>
                                                          </div>

                                                          <div
                                                            onClick={() => {
                                                              setEvalStatusFilter(evalStatusFilter === 'passed' ? 'all' : 'passed');
                                                            }}
                                                            className={`p-3 rounded-xl border cursor-pointer transition-all shadow-2xs ${
                                                              evalStatusFilter === 'passed'
                                                                ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-500/20'
                                                                : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/70'
                                                            }`}
                                                            title="Klik untuk memfilter daftar siswa yang tuntas KKM"
                                                          >
                                                            <div className="flex items-center justify-between text-emerald-800 text-[10px] font-extrabold uppercase">
                                                              <span>Tuntas KKM (&ge;{minQuizScore}%)</span>
                                                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                            </div>
                                                            <div className="text-lg font-black text-emerald-950 mt-1">
                                                              {scoreMetrics.passedCount}
                                                              <span className="text-[11px] font-normal text-slate-500 ml-1">
                                                                ({scoreMetrics.attemptedCount > 0 ? Math.round((scoreMetrics.passedCount / scoreMetrics.attemptedCount) * 100) : 0}%)
                                                              </span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                                                              {evalStatusFilter === 'passed' ? '✓ Filter Aktif' : 'Filter Tabel Tuntas'}
                                                            </span>
                                                          </div>

                                                          <div
                                                            onClick={() => {
                                                              setProgressTrackerInitialTab('remedial');
                                                              setIsProgressTrackerModalOpen(true);
                                                            }}
                                                            className={`p-3 rounded-xl border cursor-pointer transition-all shadow-2xs group ${
                                                              scoreMetrics.remedialCount > 0
                                                                ? 'bg-rose-50 border-rose-300 hover:bg-rose-100/80 ring-1 ring-rose-400/30'
                                                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                            title="Klik untuk membuka rincian siswa yang memerlukan remedial"
                                                          >
                                                            <div className="flex items-center justify-between text-rose-800 text-[10px] font-extrabold uppercase">
                                                              <span>Perlu Remedial</span>
                                                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                                            </div>
                                                            <div className="text-lg font-black text-rose-950 mt-1">
                                                              {scoreMetrics.remedialCount}
                                                              <span className="text-[11px] font-normal text-slate-500 ml-1">Siswa</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-rose-600 block mt-0.5 group-hover:underline">
                                                              Buka Rincian Remedial &rarr;
                                                            </span>
                                                          </div>

                                                          <div
                                                            onClick={() => {
                                                              setProgressTrackerInitialTab('not_attempted');
                                                              setIsProgressTrackerModalOpen(true);
                                                            }}
                                                            className={`p-3 rounded-xl border cursor-pointer transition-all shadow-2xs group ${
                                                              scoreMetrics.unattemptedCount > 0
                                                                ? 'bg-amber-50 border-amber-300 hover:bg-amber-100/80 ring-1 ring-amber-400/30'
                                                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                            title="Klik untuk membuka daftar siswa yang belum mengerjakan kuis"
                                                          >
                                                            <div className="flex items-center justify-between text-amber-800 text-[10px] font-extrabold uppercase">
                                                              <span>Belum Mengerjakan</span>
                                                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                            </div>
                                                            <div className="text-lg font-black text-amber-950 mt-1">
                                                              {scoreMetrics.unattemptedCount}
                                                              <span className="text-[11px] font-normal text-slate-500 ml-1">Siswa</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-amber-700 block mt-0.5 group-hover:underline">
                                                              Buka Siswa Belum Kuis &rarr;
                                                            </span>
                                                          </div>
                                                        </div>

                                                        {/* Filter Class & Search for Scores */}
                                                        <div className="flex items-center gap-2 flex-wrap pt-1">
                                                          {/* Quick Status Filter Pills */}
                                                          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                                                            <button
                                                              type="button"
                                                              onClick={() => setEvalStatusFilter('all')}
                                                              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                                                evalStatusFilter === 'all'
                                                                  ? 'bg-white text-slate-900 shadow-2xs'
                                                                  : 'text-slate-600 hover:text-slate-900'
                                                              }`}
                                                            >
                                                              Semua ({scoreMetrics.attemptedCount})
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => setEvalStatusFilter('passed')}
                                                              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                                                evalStatusFilter === 'passed'
                                                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                                                  : 'text-emerald-700 hover:bg-white/50'
                                                              }`}
                                                            >
                                                              Tuntas ({scoreMetrics.passedCount})
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => setEvalStatusFilter('remedial')}
                                                              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                                                evalStatusFilter === 'remedial'
                                                                  ? 'bg-rose-600 text-white shadow-2xs'
                                                                  : 'text-rose-700 hover:bg-white/50'
                                                              }`}
                                                            >
                                                              Remedial ({scoreMetrics.remedialCount})
                                                            </button>
                                                          </div>

                                                          {scoreMetrics.unattemptedCount > 0 && (
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                setProgressTrackerInitialTab('not_attempted');
                                                                setIsProgressTrackerModalOpen(true);
                                                              }}
                                                              className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                                              title="Buka daftar siswa yang belum mengerjakan kuis"
                                                            >
                                                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                              <span>{scoreMetrics.unattemptedCount} Belum Kuis</span>
                                                            </button>
                                                          )}

                                                          <div className="relative flex-1 min-w-[180px]">
                                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                            <input
                                                              type="text"
                                                              placeholder="Cari nama siswa atau no. absen..."
                                                              value={evalSearchQuery}
                                                              onChange={(e) => setEvalSearchQuery(e.target.value)}
                                                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                            />
                                                          </div>

                                                          <select
                                                            value={evalClassFilter}
                                                            onChange={(e) => setEvalClassFilter(e.target.value)}
                                                            className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                                                          >
                                                            <option value="ALL">Semua Kelas</option>
                                                            {masterClasses.map((cls) => (
                                                              <option key={cls} value={cls}>
                                                                Kelas {cls}
                                                              </option>
                                                            ))}
                                                          </select>

                                                          {filteredEvalScores.length > 0 && (
                                                            <button
                                                              id="btn-trigger-reset-all-students"
                                                              type="button"
                                                              onClick={() => setShowResetAllConfirm(true)}
                                                              className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs"
                                                              title="Reset semua pengerjaan kuis materi ini untuk seluruh siswa"
                                                            >
                                                              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                                                              <span>Reset Semua ({filteredEvalScores.length})</span>
                                                            </button>
                                                          )}
                                                        </div>

                                                        {/* Scores Table */}
                                                        {isLoadingScores ? (
                                                          <div className="py-8 text-center text-xs text-slate-400 font-semibold">
                                                            Memuat nilai siswa...
                                                          </div>
                                                        ) : filteredEvalScores.length === 0 ? (
                                                          <div className="py-8 text-center text-xs text-slate-400 font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                            Belum ada siswa yang menyelesaikan kuis untuk materi ini.
                                                          </div>
                                                        ) : (
                                                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                                                            <table className="w-full text-left text-xs">
                                                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                                                                <tr>
                                                                  <th className="py-2.5 px-3">No</th>
                                                                  <th className="py-2.5 px-3">Nama Siswa</th>
                                                                  <th className="py-2.5 px-3">Kelas</th>
                                                                  <th className="py-2.5 px-3">Absen</th>
                                                                  <th className="py-2.5 px-3 text-center">Jumlah Benar</th>
                                                                  <th className="py-2.5 px-3 text-center">Batas Max Soal</th>
                                                                  <th className="py-2.5 px-3 text-center">Nilai Akhir (%)</th>
                                                                  <th className="py-2.5 px-3 text-center">Status TP</th>
                                                                  <th className="py-2.5 px-3">Waktu Selesai</th>
                                                                  <th className="py-2.5 px-3 text-center">Aksi</th>
                                                                </tr>
                                                              </thead>
                                                              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                                                {filteredEvalScores.map((s, idx) => {
                                                                  const currentMaterialMaxQ =
                                                                    selectedQuestionIds.size > 0
                                                                      ? selectedQuestionIds.size
                                                                      : (activeMaterial?.quizSelectedQuestionIds?.length || activeMaterial?.quizQuestions?.length || 10);
                                                                  const maxQ = currentMaterialMaxQ > 0 ? currentMaterialMaxQ : (s.totalQuestions || 10);
                                                                  const reqCorrect = Math.max(1, Math.ceil((minQuizScore / 100) * maxQ));

                                                                  let displayScore = s.score;
                                                                  let displayPercent = s.percentage;
                                                                  if (displayScore >= maxQ) {
                                                                    displayScore = maxQ;
                                                                    displayPercent = 100;
                                                                  } else if (displayPercent === undefined || isNaN(displayPercent) || (displayPercent <= maxQ && displayPercent === displayScore && displayPercent > 0)) {
                                                                    displayPercent = Math.min(100, Math.round((displayScore / maxQ) * 100));
                                                                  }

                                                                  const isPassed = s.isPassed || displayScore >= maxQ || displayScore >= reqCorrect || displayPercent >= minQuizScore;
                                                                  const isThisResetting = isResetting && resettingStudentId === s.studentId;
                                                                  return (
                                                                    <tr key={s.id || idx} className="hover:bg-slate-50/70 transition-colors">
                                                                      <td className="py-2.5 px-3 text-slate-500">{idx + 1}</td>
                                                                      <td className="py-2.5 px-3 font-bold">{s.studentName}</td>
                                                                      <td className="py-2.5 px-3">{s.studentClass}</td>
                                                                      <td className="py-2.5 px-3 text-slate-500">
                                                                        {s.studentAbsen || '-'}
                                                                      </td>
                                                                      <td className="py-2.5 px-3 text-center font-extrabold">
                                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-black border border-slate-200">
                                                                          {displayScore}
                                                                        </span>
                                                                      </td>
                                                                      <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                                                                        {maxQ}
                                                                      </td>
                                                                      <td className="py-2.5 px-3 text-center font-extrabold">
                                                                        <span
                                                                          className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                                                            isPassed
                                                                              ? 'bg-emerald-100 text-emerald-800'
                                                                              : 'bg-rose-100 text-rose-800'
                                                                          }`}
                                                                        >
                                                                          {displayPercent}
                                                                        </span>
                                                                      </td>
                                                                      <td className="py-2.5 px-3 text-center">
                                                                        <span
                                                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                            isPassed
                                                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                          }`}
                                                                        >
                                                                          {isPassed ? 'Tuntas' : 'Remidial'}
                                                                        </span>
                                                                      </td>
                                                                      <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                                                                        {new Date(s.completedAt).toLocaleString('id-ID')}
                                                                      </td>
                                                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                        <button
                                                                          id={`btn-reset-student-progress-${s.studentId}`}
                                                                          type="button"
                                                                          onClick={() => setConfirmResetStudent(s)}
                                                                          disabled={isThisResetting}
                                                                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 active:scale-95 transition-all duration-150 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed group"
                                                                          title={`Reset pengerjaan kuis siswa ${s.studentName} secara real-time`}
                                                                        >
                                                                          {isThisResetting ? (
                                                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 group-hover:text-white" />
                                                                          ) : (
                                                                            <RotateCcw className="w-3.5 h-3.5 text-rose-600 group-hover:text-white transition-colors" />
                                                                          )}
                                                                          <span>Reset</span>
                                                                        </button>
                                                                      </td>
                                                                    </tr>
                                                                  );
                                                                })}
                                                              </tbody>
                                                            </table>
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}

                                                    {/* TAB 3: Quiz Settings */}
                                                    {activeSubTab === 'settings' && (
                                                      <BankSoalSettingsTab
                                                        quizStatus={quizStatus}
                                                        setQuizStatus={setQuizStatus}
                                                        isRandomized={isRandomized}
                                                        setIsRandomized={setIsRandomized}
                                                        masterClasses={masterClasses}
                                                        targetClasses={targetClasses}
                                                        setTargetClasses={setTargetClasses}
                                                        isSaving={isSaving}
                                                        onSaveSettings={handleSaveQuizToMaterial}
                                                      />
                                                    )}
                                                  </div>
                                                  )
                                                )}
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* -------------------------------------------------------------
          Edit / Add Question Modal
          ------------------------------------------------------------- */}
      {(editingQuestion || isAddingNewQuestion) && (
        <BankSoalQuestionModal
          initialQuestion={
            editingQuestion || {
              id: `q-custom-${Date.now()}`,
              question: '',
              options: ['', '', '', ''],
              correctAnswerIndex: 0,
              explanation: '',
            }
          }
          isNew={isAddingNewQuestion}
          onClose={() => {
            setEditingQuestion(null);
            setIsAddingNewQuestion(false);
          }}
          onSave={(q) => {
            if (isAddingNewQuestion) {
              handleAddNewQuestion(q);
            } else {
              handleSaveQuestionEdit(q);
            }
          }}
        />
      )}

      {/* -------------------------------------------------------------
          Reset All Students Progress Confirmation Modal
          ------------------------------------------------------------- */}
      <BankSoalResetAllModal
        isOpen={showResetAllConfirm}
        onClose={() => setShowResetAllConfirm(false)}
        materialTitle={activeMaterial?.title}
        studentCount={filteredEvalScores.length}
        isResetting={isResettingAll}
        onConfirmReset={handleConfirmResetAll}
      />

      {/* Modal Konfirmasi Reset Siswa Tunggal */}
      {confirmResetStudent && (
        <ConfirmResetModal
          isOpen={!!confirmResetStudent}
          title="Konfirmasi Reset Kuis Siswa"
          studentName={confirmResetStudent.studentName}
          studentClass={confirmResetStudent.studentClass}
          extraInfo={`Materi: ${activeMaterial?.title || ''}`}
          description={`Apakah Anda yakin ingin mereset pengerjaan kuis siswa "${confirmResetStudent.studentName}" pada materi ini? Nilai kuis akan dihapus sehingga siswa dapat mengerjakan ulang dari awal.`}
          confirmText="Ya, Reset Kuis"
          onConfirm={async () => {
            if (confirmResetStudent) {
              const target = confirmResetStudent;
              setConfirmResetStudent(null);
              await handleResetStudentDirect(target);
            }
          }}
          onClose={() => setConfirmResetStudent(null)}
        />
      )}

      {/* -------------------------------------------------------------
          Pelacak Progres Siswa & Remedial Modal
          ------------------------------------------------------------- */}
      {isProgressTrackerModalOpen && activeMaterial && (
        <ProgressTrackerModal
          isOpen={isProgressTrackerModalOpen}
          onClose={() => setIsProgressTrackerModalOpen(false)}
          activeMaterial={activeMaterial}
          students={students}
          categories={categories}
          subjects={subjects}
          masterClasses={masterClasses}
          minQuizScore={minQuizScore}
          initialClass={evalClassFilter !== 'ALL' ? evalClassFilter : 'all'}
          initialTab={progressTrackerInitialTab}
          onResetStudent={async (sId, sName) => {
            const matchedRec = evalScores.find(
              (r) =>
                r.studentId === sId ||
                r.id === sId ||
                r.studentName.toLowerCase().trim() === sName.toLowerCase().trim()
            );
            if (matchedRec) {
              await handleResetStudentDirect(matchedRec);
            } else {
              await resetStudentMaterialProgress(sId, activeMaterial.id);
            }
          }}
          showNotify={showNotify}
        />
      )}
    </div>
  );
};
