import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Flame,
  Zap,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Lightbulb,
  Clock,
  Trophy,
  Play,
  Maximize2,
  Minimize2,
  Focus,
  AlertTriangle,
  Download,
  LogOut,
  Star,
  Target,
  Lock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Material } from '../types';
import {
  getDefaultQuizQuestions,
  getEnrichmentQuizQuestions,
  fetchAIGeneratedQuiz,
  shuffleQuizQuestions,
  formatTargetGradeLabel,
} from '../utils/quizGenerator';
import { playCompletionSound, playPopSound } from '../utils/audioSynth';
import { generateResultImageCard } from '../utils/certificateGenerator';
import {
  getGamificationState,
  addExp,
  recordQuizCompletion,
  getCurrentLevelInfo,
  getDefaultGamificationData,
  ALL_BADGES,
  playAudioFx,
  BadgeInfo,
} from '../utils/gamification';
import {
  fetchAIAnalogy,
  fetchAIHint,
  speakText,
  stopSpeech,
} from '../utils/aiTutor';
import {
  saveStudentQuizScore,
  saveStudentGamification,
  fetchStudentQuizScores,
  StudentQuizScoreInfo,
  getMinQuizScoreToUnlock,
  DEFAULT_MIN_QUIZ_SCORE,
  updateMaterial,
} from '../lib/dataService';
import {
  isOptionCorrect,
  getNormalizedCorrectIndex,
  calculateQuizResult,
  normalizeQuizScoreRecord,
  normalizeKkmPercent,
} from '../utils/quizScoring';
import { QuizOptionCard } from './quiz/QuizOptionCard';
import { QuizTimeAttackBadge } from './quiz/QuizTimeAttackBadge';
import { QuizStepGrid } from './quiz/QuizStepGrid';
import { QuizQuestionCard } from './quiz/QuizQuestionCard';
import { QuizFeedbackBox } from './quiz/QuizFeedbackBox';
import { QuizLifelinesBar } from './quiz/QuizLifelinesBar';
import { QuizCompletedResultCard } from './quiz/QuizCompletedResultCard';
import { QuizGamificationModal } from './quiz/QuizGamificationModal';
import { QuizAiHintModal } from './quiz/QuizAiHintModal';
import { QuizAiTutorModal } from './quiz/QuizAiTutorModal';
import { QuizReviewExplanationsModal } from './quiz/QuizReviewExplanationsModal';
import { QuizExitConfirmModal } from './quiz/QuizExitConfirmModal';
import { QuizRefreshConfirmModal } from './quiz/QuizRefreshConfirmModal';

interface MiniQuizSectionProps {
  material: Material;
  categoryName?: string;
  subjectName?: string;
  isCompleted?: boolean;
  onToggleCompleted?: (materialId: string, options?: { localOnly?: boolean }) => void;
}

export const MiniQuizSection: React.FC<MiniQuizSectionProps> = ({
  material,
  categoryName,
  subjectName,
  isCompleted = false,
  onToggleCompleted,
}) => {
  // Authenticated Student identity state (automatically resolved from account)
  const [studentInfo, setStudentInfo] = useState<{
    id?: string;
    name: string;
    className: string;
    absen: string;
    nis?: string;
    nisn?: string;
    username?: string;
    role?: string;
  }>(() => {
    try {
      const raw = localStorage.getItem('sistem_materi_auth_session');
      if (raw && raw !== 'null' && raw !== 'undefined') {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.student) {
            return {
              id: parsed.student.id || '',
              name: parsed.student.nama || 'Siswa',
              className: parsed.student.kelas || 'Kelas',
              absen: parsed.student.noAbsen || '-',
              nisn: parsed.student.nisn || '',
              username: parsed.student.username || '',
              role: 'student',
            };
          }
          if (parsed.teacher) {
            return {
              id: parsed.teacher.id || '',
              name: parsed.teacher.name || 'Guru',
              className: 'Guru Pengampu',
              absen: '-',
              nisn: '',
              role: 'teacher',
            };
          }
          if (parsed.role === 'admin') {
            return {
              id: 'admin',
              name: 'Administrator',
              className: 'Admin',
              absen: '-',
              nisn: '',
              role: 'admin',
            };
          }
        }
      }
      const savedName = localStorage.getItem('simpel_student_name');
      const savedClass = localStorage.getItem('simpel_student_class');
      const savedAbsen = localStorage.getItem('simpel_student_absen');
      if (savedName) {
        return {
          name: savedName,
          className: savedClass || 'Kelas',
          absen: savedAbsen || '-',
          nisn: '',
          role: 'student',
        };
      }
    } catch {}
    return {
      name: 'Siswa Pembelajar',
      className: 'Kelas Siswa',
      absen: '01',
      nisn: '',
      role: 'student',
    };
  });

  const studentName = studentInfo.name;
  const studentClass = studentInfo.className;
  const studentAbsen = studentInfo.absen;

  // Quiz active state
  const [isQuizStarted, setIsQuizStarted] = useState(false);

  // Dynamic Quiz state
  const [questions, setQuestions] = useState(() => getDefaultQuizQuestions(material, categoryName, subjectName));
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGenerationStatus, setAiGenerationStatus] = useState<string>('');
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Mode Pengayaan (Enrichment Mode): aktif jika siswa dapat nilai 100 lalu me-refresh soal sisa bank soal
  const [isEnrichmentMode, setIsEnrichmentMode] = useState(false);
  const [enrichmentPoolSize, setEnrichmentPoolSize] = useState(0);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageDownloaded, setImageDownloaded] = useState(false);
  const [highestScoreRecord, setHighestScoreRecord] = useState<StudentQuizScoreInfo | null>(null);

  // Interactive Config parameters for current material
  const cfg = material.interactiveConfig || {};
  const enableGamification = cfg.enableGamification ?? false;
  const enableTimeAttack = cfg.enableTimeAttack ?? false;
  const timeAttackSeconds = cfg.timeAttackSeconds || 30;
  const enableLifelines = cfg.enableLifelines !== false; // Fitur unggulan: aktif secara default kecuali jika dimatikan guru
  const enableAITutor = cfg.enableAITutor ?? false;

  // Gamification state
  const [gamificationState, setGamificationState] = useState(() => getGamificationState());
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [newEarnedBadges, setNewEarnedBadges] = useState<BadgeInfo[]>([]);

  // Lifelines State (50:50 & AI Hint - 1x Kesempatan per sesi kuis)
  const [hasUsedFiftyFifty, setHasUsedFiftyFifty] = useState<boolean>(false);
  const [hasUsedAIHint, setHasUsedAIHint] = useState<boolean>(false);
  const [aiHintQuestionIndex, setAiHintQuestionIndex] = useState<number | null>(null);
  const [disabledOptions, setDisabledOptions] = useState<number[]>([]);
  const [showAIHintModal, setShowAIHintModal] = useState(false);
  const [aiHintText, setAiHintText] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [showSavedQuestionsReview, setShowSavedQuestionsReview] = useState(false);

  // AI Tutor & Audio State
  const [showAnalogiModal, setShowAnalogiModal] = useState(false);
  const [analogiText, setAnalogiText] = useState<string | null>(null);
  const [loadingAnalogi, setLoadingAnalogi] = useState(false);
  const [isSpeakingAudio, setIsSpeakingAudio] = useState(false);

  // Focus Mode state
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showRefreshConfirmModal, setShowRefreshConfirmModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Minimum passing score (KKM) configured by Admin
  const [minQuizScore, setMinQuizScore] = useState<number>(DEFAULT_MIN_QUIZ_SCORE);

  // Load KKM threshold from Admin settings
  useEffect(() => {
    let isMounted = true;
    getMinQuizScoreToUnlock()
      .then((val) => {
        if (isMounted) setMinQuizScore(val);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Load student's single highest score for this material
  useEffect(() => {
    let isMounted = true;

    const candidateIds = [
      studentInfo.id,
      studentInfo.nisn,
      studentInfo.username,
      studentInfo.name,
    ].filter(Boolean) as string[];

    const studentId = studentInfo.id || studentInfo.nisn || studentInfo.name || 'default_student';

    const loadHighestScore = async (force = false) => {
      try {
        const allScores = await fetchStudentQuizScores(studentId, {
          forceRevalidate: force,
          additionalIds: candidateIds,
        });
        if (isMounted) {
          if (allScores && allScores[material.id]) {
            setHighestScoreRecord(allScores[material.id]);
          } else {
            setHighestScoreRecord(null);
          }
        }
      } catch {
        if (isMounted) setHighestScoreRecord(null);
      }
    };
    loadHighestScore();

    const handleResetEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail;
      const isTargeted =
        !detail ||
        detail.allStudents ||
        (detail.studentIds && detail.studentIds.some((id: string) => candidateIds.includes(id))) ||
        (detail.studentId && candidateIds.includes(detail.studentId));

      if (isTargeted && (!detail?.materialId || detail.materialId === material.id)) {
        setHighestScoreRecord(null);
        setIsQuizCompleted(false);
        setIsQuizStarted(false);
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsAnswered(false);
        setUserAnswers([]);
        setShowReview(false);
        setScore(0);
        setIsEnrichmentMode(false);

        // Purge session quiz storage
        try {
          candidateIds.forEach((sid) => {
            localStorage.removeItem(`quiz_res_${material.id}_${sid}`);
            localStorage.removeItem(`quiz_answers_${material.id}_${sid}`);
            localStorage.removeItem(`sistem_materi_quiz_ans_${material.id}_${sid}`);
            localStorage.removeItem(`simpel_quiz_progress_${material.id}_${sid}`);
          });
        } catch {}

        loadHighestScore(true);
      }
    };

    const handleProgressSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail;
      const isTargeted =
        !detail ||
        detail.allStudents ||
        (detail.studentIds && detail.studentIds.some((id: string) => candidateIds.includes(id))) ||
        (detail.studentId && candidateIds.includes(detail.studentId));

      if (isTargeted) {
        const newRecord =
          detail?.highestScoreRecord ||
          detail?.record?.quizAttempts?.[material.id] ||
          detail?.quizAttempts?.[material.id];

        if (newRecord) {
          setHighestScoreRecord(newRecord);
        }
      }
    };

    window.addEventListener('student-material-reset', handleResetEvent);
    window.addEventListener('student-progress-sync', handleProgressSync);

    return () => {
      isMounted = false;
      window.removeEventListener('student-material-reset', handleResetEvent);
      window.removeEventListener('student-progress-sync', handleProgressSync);
    };
  }, [material.id, studentInfo.id, studentInfo.nisn, studentInfo.username, studentInfo.name]);

  // Status nilai sempurna (100% atau semua benar pada kuis resmi guru)
  const minQuizPercent = minQuizScore <= 10 ? minQuizScore * 10 : minQuizScore;
  const requiredCorrectCount = Math.max(1, Math.ceil((minQuizPercent / 100) * (questions?.length || 1)));

  // Status nilai sempurna (100% atau semua benar pada kuis resmi guru)
  const hasPerfectScore =
    (highestScoreRecord && (highestScoreRecord.percentage === 100 || (highestScoreRecord.totalQuestions > 0 && highestScoreRecord.score === highestScoreRecord.totalQuestions))) ||
    (!isEnrichmentMode && isQuizCompleted && score === questions.length && questions.length > 0);

  // Freeze background scrolling when Focus Mode is active
  useEffect(() => {
    if (isFocusMode && isQuizStarted) {
      const originalOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isFocusMode, isQuizStarted]);

  // Handle Fullscreen state tracking
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle Escape key
  useEffect(() => {
    if (!isFocusMode || !isQuizStarted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showExitConfirmModal) {
          setShowExitConfirmModal(false);
        } else if (isQuizCompleted) {
          handleExitQuiz();
        } else {
          setShowExitConfirmModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, isQuizStarted, isQuizCompleted, showExitConfirmModal]);

  const handleToggleFullscreen = () => {
    try {
      const doc = document as any;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
        else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  };

  // Listen to session storage changes
  useEffect(() => {
    const updateStudentData = () => {
      try {
        const raw = localStorage.getItem('sistem_materi_auth_session');
        if (raw && raw !== 'null' && raw !== 'undefined') {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (parsed.student) {
              setStudentInfo({
                name: parsed.student.nama || 'Siswa',
                className: parsed.student.kelas || 'Kelas',
                absen: parsed.student.noAbsen || '-',
                nisn: parsed.student.nisn || '',
                role: 'student',
              });
              return;
            }
            if (parsed.teacher) {
              setStudentInfo({
                name: parsed.teacher.name || 'Guru',
                className: 'Guru Pengampu',
                absen: '-',
                nisn: '',
                role: 'teacher',
              });
              return;
            }
            if (parsed.role === 'admin') {
              setStudentInfo({
                name: 'Administrator',
                className: 'Admin',
                absen: '-',
                nisn: '',
                role: 'admin',
              });
              return;
            }
          }
        }
      } catch {}
    };

    updateStudentData();
    window.addEventListener('storage', updateStudentData);
    return () => window.removeEventListener('storage', updateStudentData);
  }, []);

  // Timeout callback triggered by isolated QuizTimeAttackBadge
  const handleTimeOut = useCallback(() => {
    setIsAnswered((alreadyAnswered) => {
      if (alreadyAnswered) return true;
      setSelectedOption(-1);
      setUserAnswers((prev) => [...prev, -1]);
      playAudioFx('wrong');
      return true;
    });
  }, []);

  // Reset quiz state when material or topic changes
  useEffect(() => {
    setIsEnrichmentMode(false);
    setQuestions(getDefaultQuizQuestions(material, categoryName, subjectName));
    handleRestartQuiz();
  }, [material.id, categoryName, subjectName]);

  // Handler untuk memulai paket soal Pengayaan (diacak dari sisa bank soal yang belum dipilih guru)
  const handleStartEnrichmentQuiz = useCallback(() => {
    stopSpeech();
    setIsSpeakingAudio(false);
    playPopSound();
    const { questions: enrichmentQuestions, totalRemainingPool } = getEnrichmentQuizQuestions(
      material,
      categoryName,
      subjectName
    );

    setIsEnrichmentMode(true);
    setEnrichmentPoolSize(totalRemainingPool);
    setQuestions(enrichmentQuestions);

    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsQuizCompleted(false);
    setUserAnswers([]);
    setShowReview(false);
    setImageDownloaded(false);
    setHasUsedFiftyFifty(false);
    setHasUsedAIHint(false);
    setAiHintQuestionIndex(null);
    setAiHintText(null);
    setDisabledOptions([]);
    setIsQuizStarted(true);
    setIsFocusMode(true);
    setShowExitConfirmModal(false);
    setShowRefreshConfirmModal(false);

    setAiMessage(
      `🌟 Mode Pengayaan Aktif! Memuat ${enrichmentQuestions.length} butir soal yang diacak dari sisa bank soal guru (${totalRemainingPool} soal belum terpilih). Nilai kuis resmi kamu (100) tetap aman tersimpan!`
    );
    setTimeout(() => setAiMessage(null), 6000);
  }, [material, categoryName, subjectName]);

  // Handler untuk kembali ke kuis resmi yang dipilih oleh guru
  const handleReturnToOfficialQuiz = useCallback(() => {
    stopSpeech();
    setIsSpeakingAudio(false);
    playPopSound();
    setIsEnrichmentMode(false);
    const officialQuestions = getDefaultQuizQuestions(material, categoryName, subjectName);
    setQuestions(officialQuestions);
    handleRestartQuiz();
    setIsFocusMode(false);
  }, [material, categoryName, subjectName]);

  const handleGenerateAIQuiz = async (forceRefresh: boolean = true) => {
    playPopSound();
    setIsGeneratingAI(true);
    setAiGenerationStatus('Menghubungkan AI Flash...');

    const gradeLabel = formatTargetGradeLabel(material.targetGrade);
    const matTitle = (material?.title && material.title.trim()) || 'Materi Pembelajaran';
    setAiMessage(`AI Gemini Flash sedang menyusun 10 butir soal kuis untuk materi "${matTitle}" (${gradeLabel})...`);

    const stepTimer = setTimeout(() => {
      setAiGenerationStatus('Menyusun 10 butir soal...');
    }, 1200);

    try {
      const result = await fetchAIGeneratedQuiz(material, categoryName, subjectName, forceRefresh);
      clearTimeout(stepTimer);
      setIsGeneratingAI(false);
      setAiGenerationStatus('');

      if (result && result.quizQuestions.length > 0) {
        const newQuestions = result.quizQuestions;
        setQuestions(shuffleQuizQuestions(newQuestions));
        handleRestartQuiz();
        playCompletionSound();

        // Gantikan data soal lama di bank soal cadangan dengan butir soal yang baru dibuat
        if (material?.id) {
          updateMaterial(material.id, {
            quizBankQuestions: newQuestions,
            quizQuestions: newQuestions,
            quizSelectedQuestionIds: newQuestions.map((q) => q.id),
            quizCuratedAt: new Date().toISOString(),
          }).catch((err) => {
            console.warn('Gagal memperbarui bank soal cadangan materi:', err);
          });
        }

        setAiMessage(
          result.cached
            ? `⚡ Soal kuis AI siap seketika! 10 butir soal berpusat pada Tujuan Pembelajaran (TP) materi "${material.title}".`
            : `✨ Berhasil! 10 butir soal kuis baru berpusat pada Tujuan Pembelajaran (TP) materi "${material.title}" telah dibuat secara optimal oleh AI.`
        );
        setTimeout(() => setAiMessage(null), 5000);
      } else {
        setAiMessage(`ℹ️ Menggunakan 10 butir soal kurasi berpusat pada Tujuan Pembelajaran (TP) materi "${material.title}".`);
        setTimeout(() => setAiMessage(null), 5000);
      }
    } catch {
      clearTimeout(stepTimer);
      setIsGeneratingAI(false);
      setAiGenerationStatus('');
      setAiMessage(`ℹ️ Menggunakan 10 butir soal kurasi berpusat pada Tujuan Pembelajaran (TP) materi "${material.title}".`);
      setTimeout(() => setAiMessage(null), 5000);
    }
  };

  const handleStartQuiz = useCallback(() => {
    playPopSound();
    if (material.quizRandomize !== false) {
      setQuestions((prev) => shuffleQuizQuestions(prev));
    }
    // Pastikan seluruh state kuis dan bantuan (50:50 & Petunjuk AI) di-reset agar siswa mendapatkan 1x kesempatan baru
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsQuizCompleted(false);
    setUserAnswers([]);
    setShowReview(false);
    setImageDownloaded(false);
    setHasUsedFiftyFifty(false);
    setHasUsedAIHint(false);
    setAiHintQuestionIndex(null);
    setAiHintText(null);
    setDisabledOptions([]);
    setShowExitConfirmModal(false);
    setShowAIHintModal(false);
    setShowAnalogiModal(false);
    setIsQuizStarted(true);
    setIsFocusMode(true);
  }, [material.quizRandomize]);

  // Trigger celebratory fireworks animation with requestAnimationFrame
  const triggerCelebration = useCallback((intense = false) => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      try {
        if (intense) {
          // Grand finale fireworks burst
          const count = 200;
          const defaults = { origin: { y: 0.7 } };

          function fire(particleRatio: number, opts: confetti.Options) {
            confetti({
              ...defaults,
              ...opts,
              particleCount: Math.floor(count * particleRatio),
            });
          }

          fire(0.25, { spread: 26, startVelocity: 55 });
          fire(0.2, { spread: 60 });
          fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
          fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
          fire(0.1, { spread: 120, startVelocity: 45 });
        } else {
          // Single correct answer fireworks burst
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'],
          });
        }
      } catch {
        // Ignore if confetti not available
      }
    });
  }, []);

  const handleSelectOption = useCallback(
    (index: number) => {
      if (isAnswered) return;

      setSelectedOption(index);
      setIsAnswered(true);

      const currentQ = questions[currentQuestionIndex];
      const isCorrect = currentQ && isOptionCorrect(currentQ, index);

      setUserAnswers((prev) => [...prev, index]);

      if (isCorrect) {
        setScore((prev) => prev + 1);
        playCompletionSound();
        triggerCelebration(false);
        if (enableGamification) {
          const sId = studentInfo?.id || undefined;
          const { newState } = addExp(15, sId);
          setGamificationState(newState);
        }
      } else {
        playPopSound();
        playAudioFx('wrong');
      }
    },
    [isAnswered, questions, currentQuestionIndex, enableGamification, triggerCelebration, studentInfo]
  );

  const handleNextQuestion = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      stopSpeech();
      setIsSpeakingAudio(false);
      playPopSound();
      setDisabledOptions([]);

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedOption(null);
        setIsAnswered(false);
      } else {
        setIsQuizCompleted(true);

        // Calculate score deterministically from answers and questions to prevent any race condition or state desynchronization
        const effectiveAnswers = [...userAnswers];
        if (selectedOption !== null && effectiveAnswers[currentQuestionIndex] === undefined) {
          effectiveAnswers[currentQuestionIndex] = selectedOption;
        }
        const quizResult = calculateQuizResult(questions, effectiveAnswers, minQuizScore);
        const finalCalculatedScore = quizResult.score;
        const totalQ = quizResult.totalQuestions;
        const isPassedAttempt = quizResult.isPassed;
        const requiredCorrectCount = quizResult.requiredCorrectCount;
        const minQuizPercent = quizResult.minQuizPercent;

        setScore(finalCalculatedScore);

        if (isPassedAttempt) {
          playCompletionSound();
          triggerCelebration(true);
        } else {
          playAudioFx('wrong');
        }

        // Persist highest score & gamification (only 1 atomic writeBatch for maximum efficiency)
        let computedGamification: any = undefined;
        if (enableGamification) {
          const sId = studentInfo?.id || undefined;
          const { state, newBadges } = recordQuizCompletion(finalCalculatedScore, totalQ, enableTimeAttack, sId);
          const bonusExp = finalCalculatedScore === totalQ ? 100 : isPassedAttempt ? 60 : 25;
          const { newState } = addExp(bonusExp, sId);
          setGamificationState(newState);
          if (newBadges.length > 0) {
            setNewEarnedBadges(newBadges);
          }
          computedGamification = getDefaultGamificationData(newState);
        }

        // Aturan: Hanya simpan nilai kuis resmi yang dipilih oleh guru.
        // Hasil dari soal refresh/pengayaan tidak disimpan karena hanya sebagai latihan pengayaan mandiri.
        if (!isEnrichmentMode) {
          const candidateStudentIds = Array.from(new Set([
            studentInfo.id,
            studentInfo.nisn,
            studentInfo.username,
            studentInfo.name,
          ].filter(Boolean) as string[]));
          const studentId = studentInfo.id || studentInfo.nisn || studentInfo.username || studentInfo.name || 'default_student';

          saveStudentQuizScore(
            studentId,
            material.id,
            finalCalculatedScore,
            totalQ,
            studentInfo.name,
            studentInfo.className,
            candidateStudentIds,
            computedGamification
          )
            .then((res) => {
              setHighestScoreRecord({
                score: res.highestScore,
                totalQuestions: res.totalQuestions,
                percentage: res.highestPercentage,
                updatedAt: new Date().toISOString(),
              });

              // Only mark material completed if student achieves passing KKM score (persentase >= KKM atau jumlah benar >= KKM)
              const isPassed = isPassedAttempt || res.highestPercentage >= minQuizPercent || res.highestScore >= requiredCorrectCount;
              if (isPassed && onToggleCompleted && !isCompleted) {
                onToggleCompleted(material.id, { localOnly: true });
              }
            })
            .catch((err) => {
              console.error('Gagal menyimpan nilai kuis siswa:', err);
            });
        } else if (enableGamification && studentInfo?.id && computedGamification) {
          saveStudentGamification(studentInfo.id, computedGamification).catch(() => {});
        }
      }
    },
    [
      currentQuestionIndex,
      questions,
      userAnswers,
      minQuizScore,
      studentInfo,
      material.id,
      onToggleCompleted,
      isCompleted,
      enableGamification,
      enableTimeAttack,
      triggerCelebration,
      isEnrichmentMode,
    ]
  );

  const handleExitQuiz = useCallback(() => {
    stopSpeech();
    setIsSpeakingAudio(false);
    setIsFocusMode(false);
    setIsQuizStarted(false);
    setIsQuizCompleted(false);
    setShowExitConfirmModal(false);
    setShowReview(false);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setUserAnswers([]);
    setHasUsedFiftyFifty(false);
    setHasUsedAIHint(false);
    setAiHintQuestionIndex(null);
    setAiHintText(null);
    setDisabledOptions([]);
    if (isEnrichmentMode) {
      setIsEnrichmentMode(false);
      setQuestions(getDefaultQuizQuestions(material, categoryName, subjectName));
    }
  }, [isEnrichmentMode, material, categoryName, subjectName]);

  const handleRestartQuiz = useCallback(() => {
    stopSpeech();
    setIsSpeakingAudio(false);
    setQuestions((prev) => shuffleQuizQuestions(prev));
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsQuizCompleted(false);
    setUserAnswers([]);
    setShowReview(false);
    setHasUsedFiftyFifty(false);
    setHasUsedAIHint(false);
    setAiHintQuestionIndex(null);
    setAiHintText(null);
    setDisabledOptions([]);
    setIsQuizStarted(false);
    setIsFocusMode(false);
    setShowExitConfirmModal(false);
  }, []);

  const handlePlayAgain = () => {
    stopSpeech();
    setIsSpeakingAudio(false);
    playPopSound();

    // Reset quiz state immediately to start screen
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsQuizCompleted(false);
    setUserAnswers([]);
    setShowReview(false);
    setHasUsedFiftyFifty(false);
    setHasUsedAIHint(false);
    setAiHintQuestionIndex(null);
    setAiHintText(null);
    setDisabledOptions([]);
    setIsQuizStarted(true);
    setIsFocusMode(true);
    setShowExitConfirmModal(false);

    if (isEnrichmentMode) {
      // Dalam mode pengayaan, mengulang kuis akan mengambil paket acak baru dari sisa bank soal
      const { questions: newEnrichmentQs, totalRemainingPool } = getEnrichmentQuizQuestions(
        material,
        categoryName,
        subjectName
      );
      setQuestions(newEnrichmentQs);
      setEnrichmentPoolSize(totalRemainingPool);
    } else {
      // Kuis resmi: muat ulang soal resmi yang dipilih oleh guru (diacak jika quizRandomize aktif)
      const officialQuestions = getDefaultQuizQuestions(material, categoryName, subjectName);
      setQuestions(material.quizRandomize !== false ? shuffleQuizQuestions(officialQuestions) : officialQuestions);
    }
  };

  // 50:50 Lifeline Handler (1x kesempatan per sesi kuis)
  const handleUseFiftyFifty = useCallback(() => {
    if (hasUsedFiftyFifty || isAnswered) return;
    playPopSound();
    const currentQ = (questions || [])[currentQuestionIndex];
    if (!currentQ || !Array.isArray(currentQ.options)) return;
    const correctIdx = getNormalizedCorrectIndex(currentQ);
    const wrongIndices = (currentQ.options || [])
      .map((_, i) => i)
      .filter((i) => i !== correctIdx);

    const shuffledWrong = [...wrongIndices].sort(() => 0.5 - Math.random());
    const toDisable = shuffledWrong.slice(0, 2);
    setDisabledOptions(toDisable);
    setHasUsedFiftyFifty(true);
  }, [hasUsedFiftyFifty, currentQuestionIndex, isAnswered, questions]);

  // AI Hint Lifeline Handler (1x kesempatan per sesi kuis)
  const handleGetAIHint = useCallback(async () => {
    if (isAnswered || !questions[currentQuestionIndex]) return;
    if (hasUsedAIHint && aiHintQuestionIndex !== currentQuestionIndex) return;

    playPopSound();
    setShowAIHintModal(true);

    // Jika hint untuk soal ini sudah pernah diambil, cukup tampilkan kembali tanpa memanggil API ulang
    if (aiHintQuestionIndex === currentQuestionIndex && aiHintText) {
      return;
    }

    setLoadingHint(true);
    setHasUsedAIHint(true);
    setAiHintQuestionIndex(currentQuestionIndex);
    const hint = await fetchAIHint(
      questions[currentQuestionIndex].question,
      questions[currentQuestionIndex].options,
      material.title
    );
    setAiHintText(hint);
    setLoadingHint(false);
  }, [isAnswered, questions, currentQuestionIndex, hasUsedAIHint, aiHintQuestionIndex, aiHintText, material.title]);

  // AI Tutor Analogi Handler
  const handleGetAnalogi = useCallback(async () => {
    if (!questions[currentQuestionIndex]) return;
    playPopSound();
    setShowAnalogiModal(true);
    setLoadingAnalogi(true);
    const currentQ = questions[currentQuestionIndex];
    const resultAnalogy = await fetchAIAnalogy(currentQ.question, currentQ.options);
    setAnalogiText(resultAnalogy);
    setLoadingAnalogi(false);
  }, [questions, currentQuestionIndex]);

  // TTS Voice Handler
  const handleToggleTTS = useCallback(
    (textToSpeak: string) => {
      if (isSpeakingAudio) {
        stopSpeech();
        setIsSpeakingAudio(false);
      } else {
        const success = speakText(textToSpeak, () => setIsSpeakingAudio(false));
        if (success) setIsSpeakingAudio(true);
      }
    },
    [isSpeakingAudio]
  );

  const finalScorePercent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const isCurrentAttemptPassed =
    finalScorePercent >= minQuizPercent ||
    score >= requiredCorrectCount ||
    (questions.length > 0 && score >= questions.length);

  const handleDownloadResultImage = async (customScoreData?: {
    score: number;
    totalQuestions: number;
    scorePercent: number;
  }) => {
    playPopSound();
    setIsGeneratingImage(true);

    const targetScore = customScoreData ? customScoreData.score : score;
    const targetTotal = customScoreData ? customScoreData.totalQuestions : (questions.length || 10);
    const targetPercent = customScoreData ? customScoreData.scorePercent : finalScorePercent;

    try {
      const dataUrl = await generateResultImageCard({
        studentName: studentName.trim(),
        studentClass: studentClass.trim(),
        studentAbsen: studentAbsen.trim(),
        materialTitle: material.title,
        subjectName: subjectName || '',
        categoryName: categoryName || '',
        score: targetScore,
        totalQuestions: targetTotal,
        scorePercent: targetPercent,
        completionDate: new Date().toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'short',
        }),
      });

      if (dataUrl) {
        const link = document.createElement('a');
        const cleanName = (studentName || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `Kartu_Hasil_MiniKuis_${cleanName}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setImageDownloaded(true);
        setTimeout(() => setImageDownloaded(false), 6000);
      }
    } catch (err) {
      console.error('Gagal membuat gambar kartu hasil:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5 min-w-0 max-w-full overflow-hidden">
      
      {/* Header & Mode Switcher Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                Mini Kuis Interaktif
              </h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                Latihan Mandiri
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 inline-flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-indigo-600" />
                <span>Target: {formatTargetGradeLabel(material.targetGrade)}</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-normal mt-0.5">
              Uji pemahamanmu setelah membaca materi. Hasil kuis dapat dibagikan langsung!
            </p>
          </div>
        </div>

        {/* Mode Switcher & Tombol Refresh Pengayaan (Hanya jika siswa sudah dapat nilai 100) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          {isEnrichmentMode ? (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                id="btn-header-enrichment-refresh"
                type="button"
                onClick={handleStartEnrichmentQuiz}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm hover:shadow active:scale-[0.98] shrink-0 border border-emerald-300/40 group"
                title="Acak butir soal pengayaan baru dari sisa bank soal guru"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-200 transition-transform duration-500 group-hover:rotate-180 shrink-0" />
                <span>Acak Sisa Bank Soal</span>
              </button>
              <button
                id="btn-header-return-official"
                type="button"
                onClick={handleReturnToOfficialQuiz}
                className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 border border-slate-200"
                title="Kembali ke paket soal kuis resmi guru"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Kuis Utama</span>
              </button>
            </div>
          ) : hasPerfectScore ? (
            <button
              id="btn-header-enrichment-refresh"
              type="button"
              onClick={handleStartEnrichmentQuiz}
              className="w-full sm:w-auto px-4 py-2 sm:py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm hover:shadow active:scale-[0.98] shrink-0 border border-emerald-300/40 group"
              title="Nilai kuis kamu sudah sempurna 100! Buka soal pengayaan acak dari sisa bank soal guru"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-200 transition-transform duration-500 group-hover:rotate-180 shrink-0" />
              <span>Refresh Soal Pengayaan</span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-black tracking-wide uppercase text-emerald-100">
                Acak Sisa Bank Soal
              </span>
            </button>
          ) : null}

          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100/90 px-3.5 py-2 min-h-[40px] rounded-xl sm:rounded-2xl w-full sm:w-auto justify-center sm:justify-start shrink-0 shadow-2xs">
            <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold text-indigo-900">
              {questions.length} Butir Soal Kuis
            </span>
          </div>
        </div>
      </div>

      {/* Gamification Level, EXP & Daily Streak Banner */}
      {enableGamification && (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white rounded-2xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs border border-indigo-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/80 border border-indigo-400/40 text-xl flex items-center justify-center shadow-xs">
              {getCurrentLevelInfo(gamificationState.exp).icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  Level {gamificationState.level}: {getCurrentLevelInfo(gamificationState.exp).title}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-indigo-200 border border-white/10">
                  {gamificationState.exp} EXP
                </span>
              </div>
              {/* EXP Progress Bar */}
              <div className="w-36 sm:w-48 bg-white/20 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      ((gamificationState.exp - getCurrentLevelInfo(gamificationState.exp).minExp) /
                        (getCurrentLevelInfo(gamificationState.exp).nextLevelMinExp - getCurrentLevelInfo(gamificationState.exp).minExp)) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30 text-amber-300 font-extrabold text-xs">
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{gamificationState.dailyStreak} Hari Streak</span>
            </div>

            <button
              type="button"
              onClick={() => setShowBadgesModal(true)}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center gap-1 transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Lencana ({gamificationState.unlockedBadges.length}/{ALL_BADGES.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* AI STATUS / NOTIFICATION BANNER */}
      {aiMessage && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-purple-900 font-medium animate-fadeIn">
          {isGeneratingAI ? (
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          )}
          <span>{aiMessage}</span>
        </div>
      )}

      {/* STUDENT IDENTITY CARD & QUIZ LAUNCHER */}
      <div className="bg-gradient-to-br from-indigo-50/80 via-slate-50 to-purple-50/70 border border-indigo-100/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Student Profile Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-3.5 border-b border-indigo-100/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-700 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-md shadow-indigo-300/40 shrink-0 ring-2 ring-white">
              {studentName ? studentName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">
                  {studentName}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/80 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Akun Terverifikasi</span>
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
                <span>
                  Kelas <strong className="text-indigo-900 font-extrabold">{studentClass}</strong>
                </span>
                {studentAbsen && studentAbsen !== '-' && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>
                      No. Absen <strong className="text-slate-900 font-extrabold">{studentAbsen}</strong>
                    </span>
                  </>
                )}
                {studentInfo.nisn && studentInfo.nisn.trim() !== '' && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>
                      NIS <strong className="text-slate-900 font-extrabold">{studentInfo.nisn}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isCompleted ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Materi Selesai ✓</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Siap Mengerjakan</span>
              </div>
            )}
          </div>
        </div>

        {/* Pre-flight Quiz Overview Card (When Quiz has NOT started yet) */}
        {!isQuizStarted && !isQuizCompleted && (
          <div className="space-y-3.5 pt-1">
            {/* Status Draf / Target Class Check Callouts */}
            {(() => {
              const isStudent = (studentInfo.role || 'student') === 'student';
              const isDraft = material.quizStatus === 'draft';
              const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const hasTargetClasses = Array.isArray(material.quizTargetClasses) && material.quizTargetClasses.length > 0;
              const isClassAllowed = !hasTargetClasses || material.quizTargetClasses!.some((tc) => {
                const tcNorm = norm(tc);
                const stNorm = norm(studentClass);
                return tcNorm === stNorm || stNorm.includes(tcNorm) || tcNorm.includes(stNorm);
              });

              if (isDraft && isStudent) {
                return (
                  <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl flex items-start gap-3 shadow-xs">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-amber-950 text-sm">Paket Soal Kuis Masih Berstatus Draf</h4>
                      <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                        Paket kuis untuk materi ini sedang dalam tahap kurasi dan peninjauan oleh guru pengampu dan belum diterbitkan. Silakan fokus mempelajari ringkasan materi pembelajaran terlebih dahulu!
                      </p>
                    </div>
                  </div>
                );
              }

              if (hasTargetClasses && !isClassAllowed && isStudent) {
                return (
                  <div className="p-4 bg-rose-50/90 border-2 border-rose-300 rounded-2xl flex items-start gap-3 shadow-xs">
                    <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-rose-950 text-sm">Kuis Dikhususkan untuk Kelas Tertentu</h4>
                      <p className="text-xs text-rose-900/90 mt-1 leading-relaxed">
                        Kuis materi ini hanya ditujukan untuk kelas: <strong className="font-black text-rose-950">{material.quizTargetClasses?.join(', ')}</strong>. Kelas Anda ({studentClass}) tidak termasuk dalam distribusi kuis materi ini.
                      </p>
                    </div>
                  </div>
                );
              }

              if (!isStudent && (isDraft || hasTargetClasses)) {
                return (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full font-black text-[11px] bg-indigo-200 text-indigo-900">
                        Mode Pratinjau Guru
                      </span>
                      {isDraft && (
                        <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[11px] bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                          Status: DRAF (Belum Terbit ke Siswa)
                        </span>
                      )}
                      {hasTargetClasses && (
                        <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[11px] bg-blue-100 text-blue-900 border border-blue-200">
                          Target Kelas: {material.quizTargetClasses?.join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="text-indigo-700 font-medium">Guru dapat mencoba kuis secara langsung untuk pengujian</span>
                  </div>
                );
              }

              return null;
            })()}

            {/* KKM Passing Criteria Banner */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-indigo-50/90 via-sky-50/60 to-purple-50/50 border-2 border-indigo-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-indigo-950">Syarat Ketuntasan KKM:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-black text-xs shadow-2xs">
                      Minimal {requiredCorrectCount} dari {questions.length || 10} Soal Benar ({minQuizPercent}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-900/80 font-medium mt-0.5 leading-relaxed">
                    Siswa wajib mencapai nilai minimal KKM ini agar materi ini tercatat selesai dan materi berikutnya terbuka.
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-start sm:self-auto">
                {highestScoreRecord ? (
                  ((highestScoreRecord.percentage ?? 0) >= minQuizPercent || highestScoreRecord.score >= requiredCorrectCount) ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tuntas KKM ✓</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Belum KKM ({highestScoreRecord.score}/{highestScoreRecord.totalQuestions})</span>
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Wajib Dikerjakan</span>
                  </span>
                )}
              </div>
            </div>

            {/* Highest Score Saved Record Banner */}
            {highestScoreRecord && (
              <div className="p-4 bg-gradient-to-r from-amber-500/15 via-indigo-50/50 to-purple-50/40 border-2 border-amber-300/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950 flex items-center justify-center font-black shadow-md shrink-0">
                    <Trophy className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">Nilai Tertinggi Tersimpan:</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-2xs">
                        {highestScoreRecord.percentage}% ({highestScoreRecord.score}/{highestScoreRecord.totalQuestions} Benar)
                      </span>
                      {((highestScoreRecord.percentage ?? 0) >= minQuizPercent || highestScoreRecord.score >= requiredCorrectCount) ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Tuntas (Lulus KKM) ✓
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                          Belum KKM (Perlu Kuis Ulang)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                      Sistem menyimpan 1 nilai tertinggi. Jika belum mencapai KKM (min. {minQuizPercent}% / {requiredCorrectCount} benar), kamu dapat mengulangi kuis kapan saja.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setShowSavedQuestionsReview(true);
                    }}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-white hover:bg-slate-50 text-indigo-950 border border-indigo-200 hover:border-indigo-400 font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                    title="Buka pembahasan materi dan kunci jawaban soal kuis ini"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Review Pembahasan Soal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadResultImage({
                      score: highestScoreRecord.score,
                      totalQuestions: highestScoreRecord.totalQuestions,
                      scorePercent: highestScoreRecord.percentage,
                    })}
                    disabled={isGeneratingImage}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shrink-0 disabled:opacity-50"
                    title="Unduh kartu hasil nilai tertinggi dalam format PNG"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Download className="w-4 h-4 text-white" />
                    )}
                    <span>Unduh Kartu Nilai (PNG)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tujuan Pembelajaran (TP) Student Callout */}
            {material.learningObjectives && material.learningObjectives.trim() && (
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-blue-50/50 border border-indigo-200/90 rounded-2xl space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black text-indigo-950">
                    Tujuan Pembelajaran (TP) Materi Ini:
                  </span>
                </div>
                <p className="text-xs text-indigo-900/90 font-medium pl-8 whitespace-pre-line leading-relaxed">
                  {material.learningObjectives.trim()}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white p-3 rounded-xl border border-indigo-100/90 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Jumlah Soal</span>
                  <span className="font-extrabold text-slate-800 truncate block">{questions.length} Soal Pilihan Ganda</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100/90 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Penilaian</span>
                  <span className="font-extrabold text-slate-800 truncate block">Interaktif & Otomatis</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100/90 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Reward EXP</span>
                  <span className="font-extrabold text-slate-800 truncate block">+15 EXP Tiap Jawaban Benar</span>
                </div>
              </div>
            </div>

            {/* Start Button & Mode Fokus Callout */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                  <Focus className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Mode Fokus Bebas Gangguan Otomatis Aktif</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Saat kuis dimulai, layar akan otomatis terkunci fokus pada kuis untuk mencegah pergeseran dan distraksi.
                </p>
              </div>

              {(() => {
                const isStudent = (studentInfo.role || 'student') === 'student';
                const isDraft = material.quizStatus === 'draft';
                const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const hasTargetClasses = Array.isArray(material.quizTargetClasses) && material.quizTargetClasses.length > 0;
                const isClassAllowed = !hasTargetClasses || material.quizTargetClasses!.some((tc) => {
                  const tcNorm = norm(tc);
                  const stNorm = norm(studentClass);
                  return tcNorm === stNorm || stNorm.includes(tcNorm) || tcNorm.includes(stNorm);
                });

                if (isStudent && isDraft) {
                  return (
                    <div className="px-5 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>Kuis Belum Terbuka (Status Draf)</span>
                    </div>
                  );
                }

                if (isStudent && hasTargetClasses && !isClassAllowed) {
                  return (
                    <div className="px-5 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>Khusus Kelas {material.quizTargetClasses?.join(', ')}</span>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    {hasPerfectScore && (
                      <button
                        id="btn-preflight-enrichment"
                        type="button"
                        onClick={handleStartEnrichmentQuiz}
                        className="px-4.5 py-3 min-h-[48px] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shrink-0 border border-emerald-300/40 group"
                        title="Nilai kamu sudah 100! Kerjakan soal pengayaan acak dari sisa bank soal guru"
                      >
                        <RefreshCw className="w-4 h-4 text-emerald-200 transition-transform duration-500 group-hover:rotate-180 shrink-0" />
                        <span>Refresh Soal Pengayaan</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleStartQuiz}
                      className="px-6 py-3 min-h-[48px] bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 active:scale-98 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer ring-2 ring-indigo-300/40 shrink-0"
                    >
                      <Play className="w-4 h-4 fill-white text-white shrink-0" />
                      <span>{highestScoreRecord ? 'Ulangi Kuis Resmi (Mode Fokus)' : 'Mulai Mini Kuis (Mode Fokus)'}</span>
                      <ArrowRight className="w-4 h-4 shrink-0 stroke-[2.5]" />
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Active Quiz Paused/Minimized Inline Notice */}
        {isQuizStarted && !isQuizCompleted && !isFocusMode && (
          <div className="p-3.5 bg-indigo-900/90 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-indigo-700 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-amber-300">
                <Focus className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-white block">Sesi Kuis Sedang Berlangsung</span>
                <span className="text-[11px] text-indigo-200">
                  Soal #{currentQuestionIndex + 1} dari {questions.length} • Skor Sementara: {score}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsFocusMode(true)}
                className="flex-1 sm:flex-none px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Buka Mode Fokus</span>
              </button>
              <button
                type="button"
                onClick={handleRestartQuiz}
                className="px-3 py-2 bg-white/10 hover:bg-rose-500/20 text-indigo-200 hover:text-rose-200 rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
                title="Batalkan & Ulangi Kuis"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MINI KUIS SECTION (INLINE FALLBACK WHEN NOT IN FULLSCREEN FOCUS MODE) */}
      {!isFocusMode && (
        <div className="min-w-0">
          {!isQuizStarted && !isQuizCompleted ? null : isQuizCompleted ? (
            /* QUIZ COMPLETED RESULT CARD (INLINE - COLORFUL & JOYFUL FOR KIDS) */
            <QuizCompletedResultCard
              material={material}
              finalScorePercent={finalScorePercent}
              minQuizPercent={minQuizPercent}
              score={score}
              requiredCorrectCount={requiredCorrectCount}
              isCurrentAttemptPassed={isCurrentAttemptPassed}
              studentName={studentName}
              studentClass={studentClass}
              studentAbsen={studentAbsen}
              questions={questions}
              userAnswers={userAnswers}
              isEnrichmentMode={isEnrichmentMode}
              highestScoreRecord={highestScoreRecord}
              handlePlayAgain={handlePlayAgain}
              handleReturnToOfficialQuiz={handleReturnToOfficialQuiz}
              handleStartEnrichmentQuiz={handleStartEnrichmentQuiz}
              handleDownloadResultImage={handleDownloadResultImage}
              isGeneratingImage={isGeneratingImage}
              imageDownloaded={imageDownloaded}
              showReview={showReview}
              setShowReview={setShowReview}
              isFocusMode={isFocusMode}
              setIsFocusMode={setIsFocusMode}
            />
          ) : (
            /* ACTIVE QUIZ QUESTION INLINE FALLBACK */
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Sesi kuis sedang berjalan. Klik tombol di bawah untuk masuk ke tampilan fokus layar penuh.
              </p>
              <button
                type="button"
                onClick={() => setIsFocusMode(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Focus className="w-4 h-4" />
                <span>Masuk ke Mode Fokus Kuis</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* BADGES & GAMIFICATION MODAL */}
      <QuizGamificationModal
        isOpen={showBadgesModal}
        onClose={() => setShowBadgesModal(false)}
        unlockedBadgeIds={gamificationState.unlockedBadges}
      />

      {/* AI HINT MODAL */}
      <QuizAiHintModal
        isOpen={showAIHintModal}
        onClose={() => setShowAIHintModal(false)}
        loading={loadingHint}
        hintText={aiHintText}
      />

      {/* AI TUTOR ANALOGI MODAL */}
      <QuizAiTutorModal
        isOpen={showAnalogiModal}
        onClose={() => setShowAnalogiModal(false)}
        loading={loadingAnalogi}
        analogiText={analogiText}
        onToggleTTS={handleToggleTTS}
      />

      {/* SAVED QUESTIONS & CONCEPT EXPLANATIONS REVIEW MODAL */}
      <QuizReviewExplanationsModal
        isOpen={showSavedQuestionsReview}
        onClose={() => setShowSavedQuestionsReview(false)}
        material={material}
        questions={questions}
      />

      {/* FULL-SCREEN FOCUS MODE PORTAL */}
      {isFocusMode && isQuizStarted && typeof document !== 'undefined' && createPortal(
        <div
          id="mini-quiz-focus-overlay"
          className="fixed inset-0 z-[99990] bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fadeIn select-none"
        >
          {/* TOP FOCUS CONTROL BAR */}
          <header
            id="mini-quiz-focus-header"
            className="h-14 sm:h-16 px-3.5 sm:px-6 bg-slate-900/95 border-b border-slate-800/90 flex items-center justify-between gap-2.5 sm:gap-4 shrink-0 shadow-md backdrop-blur-md z-10"
          >
            {/* Left: Material Info & Focus Badge */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-[11px] font-black shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="hidden sm:inline">Mode Fokus</span>
                <span>Mini Kuis</span>
              </div>

              <div className="min-w-0 hidden xs:block">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                  {subjectName && <span className="font-semibold text-indigo-300 truncate">{subjectName}</span>}
                  {categoryName && (
                    <>
                      <span>•</span>
                      <span className="truncate">{categoryName}</span>
                    </>
                  )}
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[200px] sm:max-w-md">
                  {material.title}
                </div>
              </div>
            </div>

            {/* Center / Right: Progress, Score & Controls */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Score Counter */}
              <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-black text-amber-300">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Skor:</span>
                <span>{score}/{questions.length}</span>
              </div>

              {/* Time Attack Countdown */}
              {enableTimeAttack && (
                <QuizTimeAttackBadge
                  totalSeconds={timeAttackSeconds}
                  questionIndex={currentQuestionIndex}
                  isAnswered={isAnswered}
                  isCompleted={isQuizCompleted}
                  onTimeOut={handleTimeOut}
                />
              )}

              {/* Refresh / Acak Soal Pengayaan Button (Hanya jika dalam mode pengayaan) */}
              {isEnrichmentMode && (
                <button
                  id="btn-focus-refresh-questions"
                  type="button"
                  onClick={handlePlayAgain}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/80 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer group"
                  title="Acak soal pengayaan lainnya dari sisa bank soal guru"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-300 transition-transform duration-500 group-hover:rotate-180" />
                  <span className="hidden md:inline">Acak Pengayaan</span>
                </button>
              )}

              {/* Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700 cursor-pointer"
                title={isFullscreen ? 'Keluar dari Layar Penuh' : 'Mode Layar Penuh'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Exit / Minimize Focus Mode Button */}
              <button
                type="button"
                onClick={() => {
                  if (isQuizCompleted) {
                    handleExitQuiz();
                  } else {
                    setShowExitConfirmModal(true);
                  }
                }}
                className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Keluar dari Mode Fokus"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </header>

          {/* MAIN SCROLLABLE CONTENT BODY (OVERSCROLL CONTAINED & DISTRACTION-FREE) */}
          <main
            id="mini-quiz-focus-main-content"
            className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 md:p-8 flex flex-col justify-start items-center bg-radial from-slate-900 via-slate-950 to-black"
          >
            <div className="w-full max-w-3xl space-y-4 sm:space-y-6 my-auto py-2 sm:py-4">
              {isQuizCompleted ? (
                /* QUIZ COMPLETED CARD IN FOCUS MODE (COLORFUL & JOYFUL FOR KIDS) */
                <QuizCompletedResultCard
                  material={material}
                  finalScorePercent={finalScorePercent}
                  minQuizPercent={minQuizPercent}
                  score={score}
                  requiredCorrectCount={requiredCorrectCount}
                  isCurrentAttemptPassed={isCurrentAttemptPassed}
                  studentName={studentName}
                  studentClass={studentClass}
                  studentAbsen={studentAbsen}
                  questions={questions}
                  userAnswers={userAnswers}
                  isEnrichmentMode={isEnrichmentMode}
                  highestScoreRecord={highestScoreRecord}
                  handlePlayAgain={handlePlayAgain}
                  handleReturnToOfficialQuiz={handleReturnToOfficialQuiz}
                  handleStartEnrichmentQuiz={handleStartEnrichmentQuiz}
                  handleDownloadResultImage={handleDownloadResultImage}
                  isGeneratingImage={isGeneratingImage}
                  imageDownloaded={imageDownloaded}
                  showReview={showReview}
                  setShowReview={setShowReview}
                  isFocusMode={isFocusMode}
                  setIsFocusMode={setIsFocusMode}
                />
              ) : (
                /* ACTIVE QUIZ QUESTION IN FOCUS MODE (OPTIMIZED 60 FPS MEMOIZED TREE) */
                <div className="space-y-4 sm:space-y-5">
                  {/* Interactive Progress Map & Stats Bar */}
                  <QuizStepGrid
                    questionsCount={(questions || []).length}
                    currentIndex={currentQuestionIndex}
                    isAnswered={isAnswered}
                    userAnswers={userAnswers}
                    questions={questions}
                    enableLifelines={enableLifelines}
                    enableAITutor={enableAITutor}
                    hasUsedFiftyFifty={hasUsedFiftyFifty}
                    hasUsedAIHint={hasUsedAIHint}
                    onUseFiftyFifty={handleUseFiftyFifty}
                    onGetAIHint={handleGetAIHint}
                    onGetAnalogi={handleGetAnalogi}
                  />

                  {/* Animated Question Content Container */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQuestionIndex}
                      initial={{ opacity: 0, y: 15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -15, scale: 0.98 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="space-y-4"
                    >
                      {/* Question Text Box */}
                      {questions && questions[currentQuestionIndex] && (
                        <QuizQuestionCard
                          questionIndex={currentQuestionIndex}
                          questionText={questions[currentQuestionIndex].question}
                          enableAITutor={enableAITutor}
                          isSpeakingAudio={isSpeakingAudio}
                          onToggleTTS={() =>
                            handleToggleTTS(
                              `${questions[currentQuestionIndex].question}. Pilihan jawaban: ${(questions[
                                currentQuestionIndex
                              ]?.options || []).join(', ')}`
                            )
                          }
                        />
                      )}

                      {/* Interactive Lifelines Bar (50:50 & Petunjuk AI) */}
                      {enableLifelines && (
                        <QuizLifelinesBar
                          enableLifelines={enableLifelines}
                          enableAITutor={enableAITutor}
                          hasUsedFiftyFifty={hasUsedFiftyFifty}
                          hasUsedAIHint={hasUsedAIHint}
                          disabledOptionsCount={disabledOptions.length}
                          isAnswered={isAnswered}
                          isCurrentQuestionHint={aiHintQuestionIndex === currentQuestionIndex}
                          loadingHint={loadingHint}
                          loadingAnalogi={loadingAnalogi}
                          onUseFiftyFifty={handleUseFiftyFifty}
                          onGetAIHint={handleGetAIHint}
                          onGetAnalogi={handleGetAnalogi}
                        />
                      )}

                      {/* Active Inline AI Hint Card - Memudahkan siswa membaca petunjuk sambil memilih opsi */}
                      {aiHintText && aiHintQuestionIndex === currentQuestionIndex && (
                        <motion.div
                          id="active-ai-hint-card"
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className="p-3.5 sm:p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-2 border-amber-400/80 rounded-2xl sm:rounded-3xl shadow-xl space-y-1.5 select-none"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-indigo-900/60 pb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                                <Lightbulb className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                              </div>
                              <span className="text-xs font-black text-amber-300">
                                Petunjuk Pintar AI Aktif
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full">
                                1x Bantuan Terpakai
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowAIHintModal(true)}
                                className="text-[10px] font-bold text-amber-200 hover:text-white bg-amber-400/20 hover:bg-amber-400/30 px-2 py-0.5 rounded-md border border-amber-400/40 cursor-pointer"
                              >
                                Layar Penuh
                              </button>
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
                            {aiHintText}
                          </p>
                        </motion.div>
                      )}

                      {/* Options List */}
                      {questions && questions[currentQuestionIndex] && (
                        <div className="space-y-3">
                          {(questions[currentQuestionIndex].options || []).map((optionText, idx) => {
                            const isSelected = selectedOption === idx;
                            const isCorrect = idx === questions[currentQuestionIndex].correctAnswerIndex;
                            const isDisabled5050 = disabledOptions.includes(idx);

                            return (
                              <QuizOptionCard
                                key={idx}
                                index={idx}
                                text={optionText}
                                isSelected={isSelected}
                                isCorrect={isCorrect}
                                isAnswered={isAnswered}
                                isDisabled5050={isDisabled5050}
                                onSelect={handleSelectOption}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Feedback Explanation & Next Button */}
                      {isAnswered && questions[currentQuestionIndex] && (
                        <QuizFeedbackBox
                          explanation={
                            questions[currentQuestionIndex].explanation ||
                            'Jawaban yang tepat berdasarkan konsep dan substansi materi pembelajaran.'
                          }
                          isLastQuestion={currentQuestionIndex >= questions.length - 1}
                          onNext={handleNextQuestion}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>
          </main>

          {/* EXIT CONFIRMATION MODAL INSIDE FOCUS PORTAL */}
          <QuizExitConfirmModal
            isOpen={showExitConfirmModal}
            onClose={() => setShowExitConfirmModal(false)}
            onConfirmExit={handleRestartQuiz}
          />

          {/* REFRESH / REGENERATE CONFIRMATION MODAL INSIDE FOCUS PORTAL */}
          <QuizRefreshConfirmModal
            isOpen={showRefreshConfirmModal}
            onClose={() => setShowRefreshConfirmModal(false)}
            onConfirmRefresh={() => {
              setShowRefreshConfirmModal(false);
              handleGenerateAIQuiz(true);
            }}
          />
        </div>,
        document.body
      )}

    </div>
  );
};
