import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  FilePlus,
  Edit2,
  BookOpen,
  Sparkles,
  Trophy,
  Save,
  HelpCircle,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Shuffle,
  CheckSquare,
  BrainCircuit,
  ListChecks,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Material, Category, Subject, AuthSession, MaterialType, MaterialInteractiveConfig, QuizQuestion } from '../../types';
import { DEFAULT_GRADES } from '../../lib/dataService';
import { parseEmbedUrl, isGoogleFormUrl } from '../../utils/urlParser';
import { useMobileBackModal } from '../../utils/mobileNavigation';
import { fetchAIGeneratedQuizBank, generateFallbackQuizBank } from '../../utils/quizGenerator';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMaterial: Material | null;
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  masterGrades?: Array<{ id: string; label: string; subLabel: string }>;
  isTeacherRole?: boolean;
  assignedSubject?: Subject | null;
  authSession?: AuthSession | null;
  defaultSubjectId?: string;
  defaultCategoryId?: string;
  defaultGrade?: string;
  onSave: (materialData: Partial<Material>, isNew: boolean) => Promise<void>;
  onOpenGuide: () => void;
  showNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  orderSuggestion?: number;
}

export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  onClose,
  editingMaterial,
  subjects = [],
  categories = [],
  materials = [],
  masterGrades,
  isTeacherRole = false,
  assignedSubject = null,
  authSession = null,
  defaultSubjectId = '',
  defaultCategoryId = '',
  defaultGrade = 'all',
  onSave,
  onOpenGuide,
  showNotify,
}) => {
  useMobileBackModal('material-modal', isOpen, onClose);

  const activeGrades = masterGrades && masterGrades.length > 0 ? masterGrades : DEFAULT_GRADES;

  const [matModalTab, setMatModalTab] = useState<'basic' | 'quiz' | 'gamification'>('basic');
  const [matSubjectId, setMatSubjectId] = useState<string>('informatika');
  const [matCategoryId, setMatCategoryId] = useState<string>('');
  const [matTitle, setMatTitle] = useState<string>('');
  const [matOriginalUrl, setMatOriginalUrl] = useState<string>('');
  const [matGformSpreadsheetUrl, setMatGformSpreadsheetUrl] = useState<string>('');
  const [matDescription, setMatDescription] = useState<string>('');
  const [matLearningObjectives, setMatLearningObjectives] = useState<string>('');
  const [matOrder, setMatOrder] = useState<string>('');
  const [matTargetGrade, setMatTargetGrade] = useState<string>('all');
  const [matIsPublished, setMatIsPublished] = useState<boolean>(true);
  const [matReflectionQuestions, setMatReflectionQuestions] = useState<string>('');
  const [matRequirePreviousCompleted, setMatRequirePreviousCompleted] = useState<boolean>(false);
  const [matPrerequisiteMaterialId, setMatPrerequisiteMaterialId] = useState<string>('none');
  const [matIsAccessTimeRestricted, setMatIsAccessTimeRestricted] = useState<boolean>(false);
  const [matAccessStartDate, setMatAccessStartDate] = useState<string>('');
  const [matAccessEndDate, setMatAccessEndDate] = useState<string>('');
  const [matIsManuallyUnlocked, setMatIsManuallyUnlocked] = useState<boolean>(false);

  // Gamification & Interactive Configuration
  const [matEnableGamification, setMatEnableGamification] = useState<boolean>(false);
  const [matEnableTimeAttack, setMatEnableTimeAttack] = useState<boolean>(false);
  const [matTimeAttackSeconds, setMatTimeAttackSeconds] = useState<number>(30);
  const [matEnableLifelines, setMatEnableLifelines] = useState<boolean>(true);
  const [matEnableAITutor, setMatEnableAITutor] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingStatusText, setSavingStatusText] = useState<string>('');

  // AI Quiz Bank states in MaterialModal
  const [modalQuizBank, setModalQuizBank] = useState<QuizQuestion[]>([]);
  const [modalSelectedQuestionIds, setModalSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isGeneratingModalAI, setIsGeneratingModalAI] = useState<boolean>(false);
  const [modalAiStatusMessage, setModalAiStatusMessage] = useState<string>('');

  // Guards against unwanted re-initialization during background updates
  const isInitializedRef = useRef<boolean>(false);
  const activeEditingMaterialIdRef = useRef<string | null>(null);
  const [hasDraftRestored, setHasDraftRestored] = useState<boolean>(false);

  const DRAFT_STORAGE_KEY = 'sistem_materi_new_mat_draft';

  // Handle modal open/close body overflow and reset initialization refs on close
  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      activeEditingMaterialIdRef.current = null;
      setHasDraftRestored(false);
      return;
    }

    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isOpen]);

  // Initialize form fields ONLY when opening or switching editingMaterial.
  // Never re-run or wipe fields when background props (categories, subjects, etc.) re-render!
  useEffect(() => {
    if (!isOpen) return;

    const currentEditingId = editingMaterial ? editingMaterial.id : '__NEW__';
    if (isInitializedRef.current && activeEditingMaterialIdRef.current === currentEditingId) {
      // Form already active for this session - DO NOT wipe teacher input!
      return;
    }

    isInitializedRef.current = true;
    activeEditingMaterialIdRef.current = currentEditingId;

    if (editingMaterial) {
      // Find subject from category
      const parentCat = categories.find((c) => c.id === editingMaterial.categoryId);
      const subjId = parentCat?.subjectId || (isTeacherRole && assignedSubject ? assignedSubject.id : 'informatika');

      setMatSubjectId(subjId);
      setMatCategoryId(editingMaterial.categoryId || '');
      setMatTitle(editingMaterial.title || '');
      setMatOriginalUrl(editingMaterial.originalUrl || '');
      setMatGformSpreadsheetUrl(editingMaterial.gformSpreadsheetUrl || '');
      setMatDescription(editingMaterial.description || '');
      setMatLearningObjectives(editingMaterial.learningObjectives || '');
      setMatOrder(editingMaterial.order ? String(editingMaterial.order) : '');
      setMatTargetGrade(editingMaterial.targetGrade || 'all');
      setMatIsPublished(editingMaterial.isPublished !== false);
      setMatReflectionQuestions(
        editingMaterial.reflectionQuestions && editingMaterial.reflectionQuestions.length > 0
          ? editingMaterial.reflectionQuestions.join('\n')
          : ''
      );
      setMatRequirePreviousCompleted(editingMaterial.requirePreviousCompleted || false);
      setMatPrerequisiteMaterialId(editingMaterial.prerequisiteMaterialId || 'none');
      setMatIsAccessTimeRestricted(editingMaterial.isAccessTimeRestricted || false);
      setMatAccessStartDate(editingMaterial.accessStartDate || '');
      setMatAccessEndDate(editingMaterial.accessEndDate || '');
      setMatIsManuallyUnlocked(editingMaterial.isManuallyUnlocked || false);

      // Gamification
      const iConfig = editingMaterial.interactiveConfig || {};
      setMatEnableGamification(Boolean(iConfig.enableGamification));
      setMatEnableTimeAttack(Boolean(iConfig.enableTimeAttack));
      setMatTimeAttackSeconds(iConfig.timeAttackSeconds || 30);
      setMatEnableLifelines(iConfig.enableLifelines !== false);
      setMatEnableAITutor(Boolean(iConfig.enableAITutor));

      // Load quiz bank if exists
      if (editingMaterial.quizBankQuestions && editingMaterial.quizBankQuestions.length > 0) {
        setModalQuizBank(editingMaterial.quizBankQuestions);
        const selIds = new Set<string>(
          editingMaterial.quizSelectedQuestionIds && editingMaterial.quizSelectedQuestionIds.length > 0
            ? editingMaterial.quizSelectedQuestionIds
            : editingMaterial.quizBankQuestions.slice(0, 10).map((q) => q.id)
        );
        setModalSelectedQuestionIds(selIds);
      } else if (editingMaterial.quizQuestions && editingMaterial.quizQuestions.length > 0) {
        setModalQuizBank(editingMaterial.quizQuestions);
        setModalSelectedQuestionIds(new Set(editingMaterial.quizQuestions.map((q) => q.id)));
      } else {
        setModalQuizBank([]);
        setModalSelectedQuestionIds(new Set());
      }
      setHasDraftRestored(false);
    } else {
      // Create new material
      const initialSubjId =
        isTeacherRole && assignedSubject
          ? assignedSubject.id
          : defaultSubjectId || (subjects.length > 0 ? subjects[0].id : 'informatika');

      const availableCats = categories.filter((c) => (c.subjectId || 'informatika') === initialSubjId);
      const initialCatId =
        defaultCategoryId && availableCats.some((c) => c.id === defaultCategoryId)
          ? defaultCategoryId
          : availableCats.length > 0
          ? availableCats[0].id
          : '';

      const selectedCatObj = categories.find((c) => c.id === initialCatId);
      const initialGrade =
        defaultGrade && defaultGrade !== 'all' ? defaultGrade : selectedCatObj?.targetGrade || 'all';

      // Check if there is an autosaved draft in localStorage for adding new material
      let restoredDraft: any = null;
      try {
        const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          if (
            parsed &&
            (parsed.matTitle?.trim() ||
              parsed.matOriginalUrl?.trim() ||
              parsed.matLearningObjectives?.trim() ||
              parsed.matDescription?.trim())
          ) {
            restoredDraft = parsed;
          }
        }
      } catch {}

      if (restoredDraft) {
        setMatSubjectId(restoredDraft.matSubjectId || initialSubjId);
        setMatCategoryId(restoredDraft.matCategoryId || initialCatId);
        setMatTitle(restoredDraft.matTitle || '');
        setMatOriginalUrl(restoredDraft.matOriginalUrl || '');
        setMatGformSpreadsheetUrl(restoredDraft.matGformSpreadsheetUrl || '');
        setMatDescription(restoredDraft.matDescription || '');
        setMatLearningObjectives(restoredDraft.matLearningObjectives || '');
        setMatOrder(restoredDraft.matOrder || '');
        setMatTargetGrade(restoredDraft.matTargetGrade || initialGrade);
        setMatIsPublished(restoredDraft.matIsPublished !== false);
        setMatReflectionQuestions(restoredDraft.matReflectionQuestions || '');
        setMatRequirePreviousCompleted(Boolean(restoredDraft.matRequirePreviousCompleted));
        setMatPrerequisiteMaterialId(restoredDraft.matPrerequisiteMaterialId || 'none');
        setMatIsAccessTimeRestricted(Boolean(restoredDraft.matIsAccessTimeRestricted));
        setMatAccessStartDate(restoredDraft.matAccessStartDate || '');
        setMatAccessEndDate(restoredDraft.matAccessEndDate || '');
        setMatIsManuallyUnlocked(Boolean(restoredDraft.matIsManuallyUnlocked));
        setMatEnableGamification(Boolean(restoredDraft.matEnableGamification));
        setMatEnableTimeAttack(Boolean(restoredDraft.matEnableTimeAttack));
        setMatTimeAttackSeconds(restoredDraft.matTimeAttackSeconds || 30);
        setMatEnableLifelines(restoredDraft.matEnableLifelines !== false);
        setMatEnableAITutor(Boolean(restoredDraft.matEnableAITutor));
        setHasDraftRestored(true);
      } else {
        setMatSubjectId(initialSubjId);
        setMatCategoryId(initialCatId);
        setMatTitle('');
        setMatOriginalUrl('');
        setMatGformSpreadsheetUrl('');
        setMatDescription('');
        setMatLearningObjectives('');
        setMatOrder('');
        setMatTargetGrade(initialGrade);
        setMatIsPublished(true);
        setMatReflectionQuestions('');
        setMatRequirePreviousCompleted(false);
        setMatPrerequisiteMaterialId('none');
        setMatIsAccessTimeRestricted(false);
        setMatAccessStartDate('');
        setMatAccessEndDate('');
        setMatIsManuallyUnlocked(false);

        // Default gamification options
        setMatEnableGamification(false);
        setMatEnableTimeAttack(false);
        setMatTimeAttackSeconds(30);
        setMatEnableLifelines(true);
        setMatEnableAITutor(false);
        setHasDraftRestored(false);
      }

      setModalQuizBank([]);
      setModalSelectedQuestionIds(new Set());
    }
    setMatModalTab('basic');
  }, [
    isOpen,
    editingMaterial,
    categories,
    subjects,
    isTeacherRole,
    assignedSubject,
    defaultSubjectId,
    defaultCategoryId,
    defaultGrade,
  ]);

  // Debounced auto-save draft while teacher is filling out a new material
  useEffect(() => {
    if (!isOpen || editingMaterial) return;

    const hasContent =
      matTitle.trim().length > 0 ||
      matOriginalUrl.trim().length > 0 ||
      matLearningObjectives.trim().length > 0 ||
      matDescription.trim().length > 0;

    if (!hasContent) return;

    const timer = setTimeout(() => {
      try {
        const draft = {
          matTitle,
          matOriginalUrl,
          matGformSpreadsheetUrl,
          matDescription,
          matLearningObjectives,
          matSubjectId,
          matCategoryId,
          matOrder,
          matTargetGrade,
          matIsPublished,
          matReflectionQuestions,
          matRequirePreviousCompleted,
          matPrerequisiteMaterialId,
          matIsAccessTimeRestricted,
          matAccessStartDate,
          matAccessEndDate,
          matIsManuallyUnlocked,
          matEnableGamification,
          matEnableTimeAttack,
          matTimeAttackSeconds,
          matEnableLifelines,
          matEnableAITutor,
          savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {}
    }, 600);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    editingMaterial,
    matTitle,
    matOriginalUrl,
    matGformSpreadsheetUrl,
    matDescription,
    matLearningObjectives,
    matSubjectId,
    matCategoryId,
    matOrder,
    matTargetGrade,
    matIsPublished,
    matReflectionQuestions,
    matRequirePreviousCompleted,
    matPrerequisiteMaterialId,
    matIsAccessTimeRestricted,
    matAccessStartDate,
    matAccessEndDate,
    matIsManuallyUnlocked,
    matEnableGamification,
    matEnableTimeAttack,
    matTimeAttackSeconds,
    matEnableLifelines,
    matEnableAITutor,
  ]);

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setMatTitle('');
    setMatOriginalUrl('');
    setMatGformSpreadsheetUrl('');
    setMatDescription('');
    setMatLearningObjectives('');
    setMatOrder('');
    setMatReflectionQuestions('');
    setMatRequirePreviousCompleted(false);
    setMatPrerequisiteMaterialId('none');
    setMatIsAccessTimeRestricted(false);
    setMatAccessStartDate('');
    setMatAccessEndDate('');
    setMatIsManuallyUnlocked(false);
    setHasDraftRestored(false);
    showNotify('info', 'Draf bahan ajar telah dihapus. Anda dapat mengisi formulir dari awal.');
  };

  // Quiz Bank Handlers in Modal
  const handleToggleSelectQuestion = (qId: string) => {
    setModalSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        if (next.size <= 1) {
          showNotify('error', 'Minimal harus ada 1 butir soal yang dipilih!');
          return prev;
        }
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  const handleSelectRandom10 = () => {
    if (modalQuizBank.length === 0) return;
    const shuffled = [...modalQuizBank].sort(() => 0.5 - Math.random());
    const picked10 = shuffled.slice(0, Math.min(10, modalQuizBank.length));
    setModalSelectedQuestionIds(new Set(picked10.map((q) => q.id)));
    showNotify('success', `Berhasil memilih acak ${picked10.length} butir soal untuk siswa.`);
  };

  const handleSelectAll = () => {
    if (modalQuizBank.length === 0) return;
    setModalSelectedQuestionIds(new Set(modalQuizBank.map((q) => q.id)));
    showNotify('success', `Seluruh ${modalQuizBank.length} butir bank soal dipilih.`);
  };

  const handleGenerateAIQuizBank = async (forceRefresh: boolean = true) => {
    if (!matTitle.trim()) {
      showNotify('error', 'Judul bahan ajar wajib diisi terlebih dahulu!');
      setMatModalTab('basic');
      return;
    }
    const tpToUse = matLearningObjectives.trim();
    if (!tpToUse || tpToUse.length < 5) {
      showNotify(
        'error',
        'Tujuan Pembelajaran (TP) masih kosong! Tuliskan Tujuan Pembelajaran minimal 5 karakter terlebih dahulu agar AI menghasilkan soal yang relevan.'
      );
      setMatModalTab('basic');
      return;
    }

    setIsGeneratingModalAI(true);
    setModalAiStatusMessage(`Menghubungkan ke Gemini AI khusus materi "${matTitle.trim()}"...`);

    try {
      const catObj = categories.find((c) => c.id === matCategoryId);
      const subjObj =
        subjects.find((s) => s.id === (catObj?.subjectId || matSubjectId)) ||
        (isTeacherRole && assignedSubject ? assignedSubject : undefined);
      const targetGradeToUse =
        matTargetGrade && matTargetGrade !== 'all'
          ? matTargetGrade
          : (catObj?.targetGrade && catObj.targetGrade !== 'all' ? catObj.targetGrade : 'smp-7');

      setModalAiStatusMessage(`Merumuskan 30 butir bank soal berbasis TP khusus materi "${matTitle.trim()}"...`);

      const dummyMat: Material = {
        id: editingMaterial?.id || 'temp-new-mat',
        categoryId: matCategoryId,
        title: matTitle.trim(),
        type: 'video',
        originalUrl: matOriginalUrl,
        embedUrl: matOriginalUrl,
        description: matDescription.trim(),
        learningObjectives: tpToUse,
        order: 1,
        targetGrade: targetGradeToUse,
        isPublished: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await fetchAIGeneratedQuizBank(
        dummyMat,
        catObj?.title,
        subjObj?.name || 'Informatika',
        tpToUse,
        matDescription.trim(),
        forceRefresh
      );

      if (result && Array.isArray(result.quizQuestions) && result.quizQuestions.length >= 10) {
        const newQuestions = result.quizQuestions.slice(0, 30);
        setModalQuizBank(newQuestions);
        const newSelected = new Set<string>();
        const newSelected10 = newQuestions.slice(0, 10);
        newSelected10.forEach((q) => newSelected.add(q.id));
        setModalSelectedQuestionIds(newSelected);

        if (result.warning) {
          showNotify('info', `${result.warning} (30 butir bank soal kurasi materi siap digunakan)`);
        } else {
          showNotify(
            'success',
            `Berhasil! 30 butir bank soal AI khusus materi "${matTitle.trim()}" telah dirumuskan dan siap disimpan!`
          );
        }
      } else {
        const fallback = generateFallbackQuizBank(dummyMat, catObj?.title, subjObj?.name || 'Informatika', tpToUse).slice(0, 30);
        setModalQuizBank(fallback);
        const newSelected = new Set<string>();
        fallback.slice(0, 10).forEach((q) => newSelected.add(q.id));
        setModalSelectedQuestionIds(newSelected);
        showNotify('info', `Menggunakan 30 butir bank soal kurasi materi "${matTitle.trim()}".`);
      }
    } catch (err: any) {
      console.warn('Modal AI quiz generation error:', err);
      showNotify('error', `Gagal merumuskan soal AI: ${err?.message || 'Koneksi AI bermasalah'}`);
    } finally {
      setIsGeneratingModalAI(false);
      setModalAiStatusMessage('');
    }
  };

  // Categories filtered by chosen subject
  const availableCategories = categories.filter((c) => (c.subjectId || 'informatika') === matSubjectId);

  // Materials in the same category for prerequisite selection
  const sameCatMaterials = materials.filter(
    (m) => m.categoryId === matCategoryId && (!editingMaterial || m.id !== editingMaterial.id)
  );

  // Detect if the material link is a Google Form
  const isGoogleForm = useMemo(() => {
    return (
      isGoogleFormUrl(matOriginalUrl) ||
      parseEmbedUrl(matOriginalUrl).type === 'gform' ||
      (editingMaterial?.type === 'gform' && !matOriginalUrl.trim())
    );
  }, [matOriginalUrl, editingMaterial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitle.trim()) {
      setMatModalTab('basic');
      showNotify('error', 'Judul bahan ajar tidak boleh kosong');
      return;
    }
    if (!matCategoryId) {
      setMatModalTab('basic');
      showNotify('error', 'Pilih topik/bab kategori materi terlebih dahulu');
      return;
    }
    if (!matOriginalUrl.trim()) {
      setMatModalTab('basic');
      showNotify('error', 'Masukkan tautan Google Drive, Canva, YouTube, atau Google Form');
      return;
    }
    // Tujuan Pembelajaran (TP) is only required for non-Google Form materials
    if (!isGoogleForm && !matLearningObjectives.trim()) {
      setMatModalTab('basic');
      showNotify('error', 'Tujuan Pembelajaran (TP) wajib diisi oleh guru');
      return;
    }

    const sameCategoryMats = materials.filter((m) => m.categoryId === matCategoryId);
    const maxMatOrder = sameCategoryMats.reduce((max, m) => Math.max(max, m.order || 0), 0);
    const finalOrder =
      matOrder !== '' && !isNaN(Number(matOrder))
        ? Number(matOrder)
        : editingMaterial?.order || maxMatOrder + 1;

    // Check duplicate order
    const duplicateMat = sameCategoryMats.find(
      (m) => m.order === finalOrder && (!editingMaterial || m.id !== editingMaterial.id)
    );
    if (duplicateMat) {
      setMatModalTab('basic');
      showNotify(
        'error',
        `Urutan #${finalOrder} sudah digunakan oleh materi "${duplicateMat.title}". Silakan gunakan nomor urutan lain.`
      );
      return;
    }

    const parsed = parseEmbedUrl(matOriginalUrl);
    const finalType: MaterialType = isGoogleForm ? 'gform' : (parsed.type as MaterialType);

    setIsSaving(true);
    setSavingStatusText(
      isGoogleForm
        ? (editingMaterial ? 'Menyimpan perubahan bahan ajar...' : 'Menyimpan bahan ajar Google Form...')
        : (!editingMaterial
            ? 'AI sedang merumuskan 30 butir bank soal berbasis TP & materi...'
            : 'Menyimpan perubahan bahan ajar...')
    );
    try {
      const reflectionArray = matReflectionQuestions
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      const interactiveConfig: MaterialInteractiveConfig = {
        enableGamification: matEnableGamification,
        enableTimeAttack: matEnableTimeAttack,
        timeAttackSeconds: Number(matTimeAttackSeconds) || 30,
        enableLifelines: matEnableLifelines,
        enableAITutor: matEnableAITutor,
      };

      const payload: Partial<Material> = {
        title: matTitle.trim(),
        categoryId: matCategoryId,
        type: finalType,
        originalUrl: matOriginalUrl.trim(),
        embedUrl: parsed.embedUrl || matOriginalUrl.trim(),
        gformSpreadsheetUrl: matGformSpreadsheetUrl.trim() || undefined,
        description: matDescription.trim(),
        learningObjectives: matLearningObjectives.trim(),
        order: finalOrder,
        targetGrade: matTargetGrade || 'all',
        isPublished: matIsPublished,
        reflectionQuestions: reflectionArray,
        requirePreviousCompleted: matRequirePreviousCompleted,
        prerequisiteMaterialId: matRequirePreviousCompleted ? matPrerequisiteMaterialId : 'none',
        isAccessTimeRestricted: matIsAccessTimeRestricted,
        accessStartDate: matAccessStartDate || undefined,
        accessEndDate: matAccessEndDate || undefined,
        isManuallyUnlocked: matIsManuallyUnlocked,
        interactiveConfig,
        createdBy:
          isTeacherRole && authSession?.teacher
            ? (editingMaterial?.createdBy && editingMaterial.createdBy !== 'admin'
                ? editingMaterial.createdBy
                : (authSession.teacher.username || authSession.teacher.id))
            : (editingMaterial?.createdBy || 'admin'),
        updatedAt: new Date().toISOString(),
      };

      if (!isGoogleForm && modalQuizBank.length >= 10) {
        const selectedList = modalQuizBank.filter((q) => modalSelectedQuestionIds.has(q.id));
        const finalSelected = selectedList.length >= 1 ? selectedList : modalQuizBank.slice(0, 10);
        payload.quizBankQuestions = modalQuizBank;
        payload.quizSelectedQuestionIds = finalSelected.map((q) => q.id);
        payload.quizQuestions = finalSelected;
        payload.quizStatus = 'published';
        payload.quizCuratedAt = new Date().toISOString();
      }

      if (!editingMaterial) {
        payload.createdAt = new Date().toISOString();
      }

      await onSave(payload, !editingMaterial);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      onClose();
    } catch (err: any) {
      console.error('Error saving material:', err);
      showNotify('error', err.message || 'Gagal menyimpan bahan ajar');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto overscroll-contain animate-fadeIn">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              {editingMaterial ? <Edit2 className="w-5 h-5" /> : <FilePlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                {editingMaterial ? 'Edit Bahan Ajar / Modul' : 'Tambah Bahan Ajar Baru'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {editingMaterial
                  ? 'Perbarui tautan, urutan, atau pengaturan interaktif'
                  : 'Tambahkan modul presentasi, dokumen, video, atau kuis evaluasi'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 sm:px-6 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setMatModalTab('basic')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              matModalTab === 'basic'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Info & Tautan Materi</span>
          </button>
          <button
            type="button"
            onClick={() => setMatModalTab('quiz')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              matModalTab === 'quiz'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Mini Kuis & Soal AI</span>
            {modalQuizBank.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold flex items-center justify-center">
                ✓
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMatModalTab('gamification')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              matModalTab === 'gamification'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Gamifikasi & Interaktivitas</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* Restored Draft Alert Banner */}
            {hasDraftRestored && !editingMaterial && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Draf Otomatis Tersimpan:</strong> Isian sebelumnya berhasil dipulihkan otomatis agar data Anda tidak hilang.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="text-rose-600 hover:text-rose-800 font-semibold underline ml-3 shrink-0 cursor-pointer text-[11px]"
                >
                  Hapus Draf / Mulai Baru
                </button>
              </div>
            )}

            {/* TAB 1: BASIC INFO & LINK */}
            {matModalTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mata Pelajaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={matSubjectId}
                      onChange={(e) => {
                        const newSubjId = e.target.value;
                        setMatSubjectId(newSubjId);
                        const available = categories.filter((c) => (c.subjectId || 'informatika') === newSubjId);
                        if (available.length > 0) {
                          setMatCategoryId(available[0].id);
                          if (available[0].targetGrade) {
                            setMatTargetGrade(available[0].targetGrade);
                          }
                        } else {
                          setMatCategoryId('');
                        }
                      }}
                      disabled={isTeacherRole}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                      required
                    >
                      {(subjects || []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'Mapel'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Topik / Bab Materi <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={matCategoryId}
                      onChange={(e) => {
                        const newCatId = e.target.value;
                        setMatCategoryId(newCatId);
                        const selectedCat = (categories || []).find((c) => c && c.id === newCatId);
                        if (selectedCat && selectedCat.targetGrade) {
                          setMatTargetGrade(selectedCat.targetGrade);
                        }
                      }}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    >
                      {(availableCategories || []).length === 0 ? (
                        <option value="">(Belum ada topik pada mapel ini)</option>
                      ) : (
                        (availableCategories || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} {c.targetGrade && c.targetGrade !== 'all' ? `[Kelas ${c.targetGrade}]` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Bahan Ajar / Modul <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Modul 1.1 - Pengenalan Algoritma"
                    value={matTitle}
                    onChange={(e) => setMatTitle(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Tautan Bahan Ajar (Drive, Canva, YouTube, Form) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={onOpenGuide}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Panduan Link</span>
                    </button>
                  </div>
                  <input
                    type="url"
                    placeholder="Tempelkan link share Google Slides, Docs, PDF, Canva, YouTube, atau Google Form"
                    value={matOriginalUrl}
                    onChange={(e) => setMatOriginalUrl(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                {/* Google Form Notification & Spreadsheet Sync */}
                {isGoogleForm && (
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-2.5 animate-fadeIn">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100/90 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-emerald-900">
                          Tautan Google Form Terdeteksi (Mode Asesmen / Ujian Form)
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                          Materi ini langsung disematkan sebagai Google Form. <strong>Tidak perlu membuat soal mini kuis</strong> (soal evaluasi langsung dikerjakan siswa di form), dan <strong>Tujuan Pembelajaran (TP) bersifat opsional</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/60 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Integrasi Nilai Otomatis (Google Sheets Respon Form) - Opsional</span>
                      </div>
                      <input
                        type="url"
                        placeholder="Tempel link Google Sheet hasil tanggapan kuis / ujian"
                        value={matGformSpreadsheetUrl}
                        onChange={(e) => setMatGformSpreadsheetUrl(e.target.value)}
                        className="w-full py-2 px-3 bg-white border border-emerald-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <p className="text-[10px] text-emerald-700 leading-relaxed">
                        Sistem akan mencocokkan Nama/NIS siswa dari spreadsheet tanggapan dan otomatis memasukkan nilai ke dashboard rekap guru.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Urutan Nomor
                    </label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={matOrder}
                      onChange={(e) => setMatOrder(e.target.value)}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Jenjang Kelas
                    </label>
                    <select
                      value={matTargetGrade}
                      onChange={(e) => setMatTargetGrade(e.target.value)}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="all">Semua Jenjang (Lintas Kelas)</option>
                      {(activeGrades || []).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label} {g.subLabel ? `(${g.subLabel})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Publikasi
                    </label>
                    <select
                      value={matIsPublished ? 'published' : 'draft'}
                      onChange={(e) => setMatIsPublished(e.target.value === 'published')}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                    >
                      <option value="published">Dipublikasikan</option>
                      <option value="draft">Draft (Disembunyikan)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Tujuan Pembelajaran (TP) / Indikator Capaian{' '}
                      {isGoogleForm ? (
                        <span className="text-slate-400 font-normal text-xs ml-0.5">(Opsional)</span>
                      ) : (
                        <span className="text-rose-500 font-bold">*</span>
                      )}
                    </label>
                    {isGoogleForm ? (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Opsional untuk Google Form
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        Wajib Diisi
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    required={!isGoogleForm}
                    placeholder={
                      isGoogleForm
                        ? "Opsional: Indikator capaian atau ringkasan evaluasi Google Form..."
                        : "Contoh: Siswa mampu memahami struktur algoritma sekuensial..."
                    }
                    value={matLearningObjectives}
                    onChange={(e) => setMatLearningObjectives(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {isGoogleForm && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      TP tidak wajib diisi untuk link Google Form karena materi ini menggunakan instrumen form langsung tanpa mini kuis.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsi / Petunjuk Belajar
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Petunjuk singkat atau instruksi pengerjaan untuk siswa..."
                    value={matDescription}
                    onChange={(e) => setMatDescription(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Prerequisite & Schedule Restriction */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <label className="flex items-start gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={matRequirePreviousCompleted}
                        onChange={(e) => setMatRequirePreviousCompleted(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="block text-slate-900 font-bold">Kunci Materi (Wajib Selesaikan & Lulus Mini Kuis Materi Sebelumnya)</span>
                        <span className="block text-[11px] font-normal text-slate-500 mt-0.5 leading-relaxed">
                          Jika dicentang, siswa harus menjawab mini kuis materi sebelumnya dan mencapai nilai KKM agar materi ini terbuka. Jika tidak dicentang, siswa bebas membuka materi ini langsung tanpa syarat kuis.
                        </span>
                      </div>
                    </label>
                  </div>

                  {matRequirePreviousCompleted && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Syarat Khusus Modul Tertentu:
                      </label>
                      <select
                        value={matPrerequisiteMaterialId}
                        onChange={(e) => setMatPrerequisiteMaterialId(e.target.value)}
                        className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                      >
                        <option value="none">Materi Tepat Sebelum Nomor Ini</option>
                        {(sameCatMaterials || []).map((m) => (
                          <option key={m.id} value={m.id}>
                            #{m.order} - {m.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="border-t border-slate-200/80 pt-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={matIsAccessTimeRestricted}
                        onChange={(e) => setMatIsAccessTimeRestricted(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span>Batasi Jadwal Waktu Akses (Ujian Berjadwal)</span>
                    </label>

                    {matIsAccessTimeRestricted && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Waktu Mulai Akses
                          </label>
                          <input
                            type="datetime-local"
                            value={matAccessStartDate}
                            onChange={(e) => setMatAccessStartDate(e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Batas Akhir Akses
                          </label>
                          <input
                            type="datetime-local"
                            value={matAccessEndDate}
                            onChange={(e) => setMatAccessEndDate(e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: MINI KUIS & SOAL AI */}
            {matModalTab === 'quiz' && (
              <div className="space-y-4">
                {isGoogleForm ? (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-1">
                      <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                      <span>Bahan Ajar Berupa Google Form</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Materi dengan tipe Google Form mengevaluasi pemahaman siswa secara langsung di dalam kuesioner form. Bank soal mini kuis interaktif AI tidak diterapkan pada tipe ini.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Bank Soal Mini Kuis Section */}
                    <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200/60">
                        <div>
                          <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs">
                            <BrainCircuit className="w-4 h-4 text-indigo-600" />
                            <span>Bank Soal Mini Kuis (30 Butir Soal AI Berbasis TP)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            AI merumuskan butir soal berkualitas tinggi berbasis Tujuan Pembelajaran (TP) materi ini.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                          <button
                            id="btn-modal-refresh-bank-ai"
                            type="button"
                            onClick={() => handleGenerateAIQuizBank(true)}
                            disabled={isGeneratingModalAI || isSaving}
                            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer group"
                            title={`Formulasikan 30 butir bank soal khusus untuk materi "${matTitle || 'ini'}"`}
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 text-white transition-transform duration-500 group-hover:rotate-180 shrink-0 ${
                                isGeneratingModalAI ? 'animate-spin' : ''
                              }`}
                            />
                            <span>
                              {isGeneratingModalAI
                                ? 'Merumuskan Soal...'
                                : modalQuizBank.length > 0
                                 ? 'Refresh / Buat Ulang Soal AI'
                                 : 'Rumuskan 30 Soal AI Sekarang'}
                            </span>
                          </button>

                          {modalQuizBank.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={handleSelectRandom10}
                                disabled={isGeneratingModalAI}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                title="Acak 10 soal untuk siswa"
                              >
                                <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Pilih Acak 10</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleSelectAll}
                                disabled={isGeneratingModalAI}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                                <span>Pilih Semua</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status / Loading Notification */}
                      {isGeneratingModalAI && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800 font-medium animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                          <span>{modalAiStatusMessage || 'Sedang menghubungkan ke Gemini AI...'}</span>
                        </div>
                      )}

                      {/* Info if bank is empty */}
                      {!isGeneratingModalAI && modalQuizBank.length === 0 && (
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100/80 rounded-xl text-center space-y-2">
                          <div className="w-9 h-9 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-bold text-indigo-900">
                            30 Butir Soal Mini Kuis Siap Diformulasikan AI
                          </div>
                          <p className="text-[11px] text-indigo-700 max-w-lg mx-auto leading-relaxed">
                            Pastikan Anda sudah mengisi <strong>Judul Materi</strong> dan{' '}
                            <strong>Tujuan Pembelajaran (TP)</strong> pada tab <em>Info & Tautan Materi</em>. Klik tombol{' '}
                            <strong>"Rumuskan 30 Soal AI Sekarang"</strong> di atas untuk meninjau soal, ATAU langsung klik tombol simpan di bawah; sistem akan otomatis merumuskan bank soal berkualitas tinggi dengan mekanisme Gemini AI yang sama persis!
                          </p>
                        </div>
                      )}

                      {/* Question List Preview */}
                      {!isGeneratingModalAI && modalQuizBank.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs px-1">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <CheckCircle2
                                className={`w-3.5 h-3.5 ${
                                  modalSelectedQuestionIds.size >= 10 ? 'text-emerald-600' : 'text-amber-500'
                                }`}
                              />
                              <span>
                                <strong>{modalSelectedQuestionIds.size}</strong> dari {modalQuizBank.length} butir terpilih untuk siswa
                              </span>
                            </span>
                            <span className="text-[11px] text-slate-500">
                              (Centang kotak untuk memilih soal yang tampil ke siswa)
                            </span>
                          </div>

                          <div className="max-h-72 overflow-y-auto pr-1 space-y-2 divide-y divide-slate-100">
                            {modalQuizBank.map((q, idx) => {
                              const isSelected = modalSelectedQuestionIds.has(q.id);
                              return (
                                <div
                                  key={q.id}
                                  onClick={() => handleToggleSelectQuestion(q.id)}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-white border-indigo-200 shadow-xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleSelectQuestion(q.id)}
                                      className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-xs font-black text-slate-700">#{idx + 1}</span>
                                        <span
                                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                            q.cognitiveLevel?.includes('C4')
                                              ? 'bg-rose-100 text-rose-700'
                                              : q.cognitiveLevel?.includes('C3')
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-emerald-100 text-emerald-700'
                                          }`}
                                        >
                                          {q.cognitiveLevel || (idx < 10 ? 'C2' : idx < 20 ? 'C3' : 'C4 HOTS')}
                                        </span>
                                      </div>
                                      <div className="text-xs font-semibold text-slate-800 leading-snug mb-2">
                                        {q.question}
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600 mb-1.5">
                                        {q.options?.map((opt, optIdx) => {
                                          const isCorrect = optIdx === q.correctAnswerIndex;
                                          return (
                                            <div
                                              key={optIdx}
                                              className={`px-2 py-1 rounded-lg flex items-center gap-1.5 ${
                                                isCorrect
                                                  ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                                                  : 'bg-slate-100/70 text-slate-600'
                                              }`}
                                            >
                                              <span className="w-4 h-4 rounded-full bg-white text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200">
                                                {String.fromCharCode(65 + optIdx)}
                                              </span>
                                              <span className="truncate">{opt}</span>
                                              {isCorrect && <Check className="w-3 h-3 text-emerald-600 ml-auto shrink-0" />}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {q.explanation && (
                                        <div className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded-md">
                                          <strong>Penjelasan:</strong> {q.explanation}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reflection Questions Section */}
                    <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-indigo-800 font-bold text-xs">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>Pertanyaan Refleksi & Pemahaman Mandiri (Opsional)</span>
                      </div>
                      <p className="text-[11px] text-indigo-700 leading-relaxed">
                        Tuliskan 1 pertanyaan per baris. Siswa dapat menjawab poin-poin refleksi ini untuk penguatan pemahaman mandiri.
                      </p>
                      <textarea
                        rows={3}
                        placeholder="Contoh:&#10;1. Apa pengertian dari konsep materi ini?&#10;2. Sebutkan contoh penerapannya dalam kehidupan sehari-hari!"
                        value={matReflectionQuestions}
                        onChange={(e) => setMatReflectionQuestions(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 3: GAMIFICATION & INTERACTION */}
            {matModalTab === 'gamification' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-1">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    <span>Konfigurasi Gamifikasi & Pengalaman Belajar</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Aktifkan reward EXP, koin, streak harian, mode tantangan waktu, dan pendamping AI Tutor.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Sistem EXP & Lencana</span>
                      <span className="text-[10px] text-slate-500">Beri penghargaan XP saat siswa menyelesaikan modul</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={matEnableGamification}
                      onChange={(e) => setMatEnableGamification(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Fitur Bantuan (50:50 & Petunjuk AI)</span>
                      <span className="text-[10px] text-slate-500">Siswa dapat menggunakan bantuan cerdas saat kuis</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={matEnableLifelines}
                      onChange={(e) => setMatEnableLifelines(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">AI Tutor Companion</span>
                      <span className="text-[10px] text-slate-500">Penjelasan analogi interaktif dan narasi suara</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={matEnableAITutor}
                      onChange={(e) => setMatEnableAITutor(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                  </label>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Mode Tantangan Waktu (Time Attack)</span>
                        <span className="text-[10px] text-slate-500">Batasi durasi detik per pertanyaan</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={matEnableTimeAttack}
                        onChange={(e) => setMatEnableTimeAttack(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                    </label>

                    {matEnableTimeAttack && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs text-slate-600">Durasi Per Soal (Detik):</span>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          value={matTimeAttackSeconds}
                          onChange={(e) => setMatTimeAttackSeconds(Number(e.target.value) || 30)}
                          className="w-20 py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>{savingStatusText || 'Menyimpan...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    {editingMaterial
                      ? 'Simpan Perubahan'
                      : isGoogleForm
                      ? 'Tambah Bahan Ajar Google Form'
                      : 'Tambah Bahan Ajar & Buat Soal AI'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
