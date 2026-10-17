import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  Search,
  Download,
  Printer,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Award,
  Users,
  BarChart3,
  Sparkles,
  Eye,
  Sliders,
  Check,
  X,
  Clock,
  BookOpen,
  FileText,
  Link as LinkIcon,
  Info,
  Trophy,
  Copy,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Material, Subject, Category, StudentAccount, TeacherAccount } from '../types';
import {
  GFormParsedSheetData,
  GFormRespondentRow,
  syncGoogleSheetExamData,
  isGoogleFormUrl,
  isGoogleSheetUrl,
  isPublishedCsvSheetUrl,
  getGoogleSheetEndpoints,
} from '../utils/gformSheetSync';
import { updateMaterial } from '../lib/dataService';
import { useBodyScrollLock } from '../utils/scrollLock';
import { useMobileBackModal } from '../utils/mobileNavigation';
import { GFormEditSpreadsheetModal } from './gform/GFormEditSpreadsheetModal';
import { GFormRespondentDetailModal } from './gform/GFormRespondentDetailModal';
import { GFormGuideModal } from './gform/GFormGuideModal';

interface GFormExamResultsProps {
  materials: Material[];
  subjects: Subject[];
  categories: Category[];
  students: StudentAccount[];
  teachers?: TeacherAccount[];
  currentTeacher?: TeacherAccount | null;
  isTeacherRole?: boolean;
  onUpdateMaterial?: (mat: Material) => void;
  onRefreshAllData?: () => Promise<void>;
  onOpenAntiCheatLogs?: () => void;
}

export const GFormExamResults: React.FC<GFormExamResultsProps> = ({
  materials = [],
  subjects = [],
  categories = [],
  students = [],
  teachers = [],
  currentTeacher,
  isTeacherRole = false,
  onUpdateMaterial,
  onRefreshAllData,
  onOpenAntiCheatLogs,
}) => {
  // Set of identifiers for the logged-in teacher (id, username, name, nip)
  const currentTeacherTokens = useMemo(() => {
    if (!isTeacherRole || !currentTeacher) return null;
    const tokens = new Set<string>();
    const add = (val?: string) => {
      if (!val) return;
      const clean = val.trim().toLowerCase();
      if (clean) {
        tokens.add(clean);
        tokens.add(clean.replace(/^@/, ''));
      }
    };
    add(currentTeacher.id);
    add(currentTeacher.username);
    add(currentTeacher.name);
    add(currentTeacher.nip);
    return tokens;
  }, [isTeacherRole, currentTeacher]);

  // Fast lookup map for teacher names (used by Admin to display creator badge)
  const teacherLookupMap = useMemo(() => {
    const map = new Map<string, TeacherAccount>();
    (teachers || []).forEach((t) => {
      if (!t) return;
      if (t.id) map.set(t.id.trim().toLowerCase(), t);
      if (t.username) {
        const u = t.username.trim().toLowerCase();
        map.set(u, t);
        map.set(`@${u}`, t);
      }
      if (t.name) map.set(t.name.trim().toLowerCase(), t);
      if (t.nip) map.set(t.nip.trim().toLowerCase(), t);
    });
    return map;
  }, [teachers]);

  // Filter materials that are Google Form quizzes
  // STRICT ISOLATION: A teacher ONLY sees Google Form materials they created themselves!
  const gformMaterials = useMemo(() => {
    return (materials || []).filter((m) => {
      if (!m) return false;
      const isGFormType = m.type === 'gform';
      const isGFormLink = isGoogleFormUrl(m.originalUrl);
      const hasSpreadsheet = Boolean(m.gformSpreadsheetUrl);

      if (!isGFormType && !isGFormLink && !hasSpreadsheet) {
        return false;
      }

      // Teacher role scoping: strictly ONLY show materials created by this teacher
      if (isTeacherRole) {
        if (!currentTeacher || !currentTeacherTokens) {
          // If teacher profile is not loaded, withhold to prevent any data leak
          return false;
        }

        const cat = (categories || []).find((c) => c && c.id === m.categoryId);
        const subjId = cat?.subjectId || 'informatika';

        // 1. Subject constraint: teacher only sees their own subject
        if (currentTeacher.subjectId && subjId !== currentTeacher.subjectId) {
          return false;
        }

        // 2. Strict creator matching: only the teacher who created it can see it (e.g. budi123)
        const cleanMatCreator = (m.createdBy || '').trim().toLowerCase().replace(/^@/, '');
        const cleanCatCreator = (cat?.createdBy || '').trim().toLowerCase().replace(/^@/, '');

        const isCreatedByThisTeacher =
          (cleanMatCreator && cleanMatCreator !== 'admin' && currentTeacherTokens.has(cleanMatCreator)) ||
          (cleanCatCreator && cleanCatCreator !== 'admin' && currentTeacherTokens.has(cleanCatCreator));

        if (!isCreatedByThisTeacher) {
          return false;
        }
      }

      return true;
    });
  }, [materials, categories, isTeacherRole, currentTeacher, currentTeacherTokens]);

  // Selected Material for viewing
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');

  // Auto-select first available material
  useEffect(() => {
    if (gformMaterials.length > 0) {
      if (!selectedMaterialId || !gformMaterials.some((m) => m.id === selectedMaterialId)) {
        setSelectedMaterialId(gformMaterials[0].id);
      }
    } else {
      setSelectedMaterialId('');
    }
  }, [gformMaterials, selectedMaterialId]);

  const activeMaterial = useMemo(() => {
    return gformMaterials.find((m) => m.id === selectedMaterialId) || null;
  }, [gformMaterials, selectedMaterialId]);

  // Subject & Category info for active material
  const activeCategory = useMemo(() => {
    if (!activeMaterial) return null;
    return categories.find((c) => c.id === activeMaterial.categoryId) || null;
  }, [activeMaterial, categories]);

  const activeSubject = useMemo(() => {
    if (!activeCategory) return null;
    return subjects.find((s) => s.id === activeCategory.subjectId) || null;
  }, [activeCategory, subjects]);

  // Quick edit spreadsheet link modal / state
  const [isEditSpreadsheetModalOpen, setIsEditSpreadsheetModalOpen] = useState(false);
  const [editSpreadsheetInput, setEditSpreadsheetInput] = useState('');
  const [isSavingSpreadsheetLink, setIsSavingSpreadsheetLink] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [parsedData, setParsedData] = useState<GFormParsedSheetData | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // KKM Threshold (Default: 75)
  const [kkmThreshold, setKkmThreshold] = useState<number>(75);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'remedial'>('all');
  const [sortBy, setSortBy] = useState<'highest' | 'lowest' | 'recent' | 'name' | 'absen'>('highest');
  
  // Replaced "unsubmitted" with "remedial_insights" (Statistik & Tindak Lanjut)
  const [activeViewTab, setActiveViewTab] = useState<'table' | 'class_analysis' | 'remedial_insights' | 'embed_sheet'>('table');

  // Selected respondent details drawer/modal
  const [viewingRespondent, setViewingRespondent] = useState<GFormRespondentRow | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [copiedRemedialNames, setCopiedRemedialNames] = useState(false);

  // Freeze background and handle mobile/keyboard dismissal for all modals
  const isAnyGFormModalOpen = isGuideModalOpen || isEditSpreadsheetModalOpen || Boolean(viewingRespondent);
  useBodyScrollLock(isAnyGFormModalOpen);
  useMobileBackModal('gform-guide-modal', isGuideModalOpen, () => setIsGuideModalOpen(false));
  useMobileBackModal('gform-edit-sheet-modal', isEditSpreadsheetModalOpen, () => setIsEditSpreadsheetModalOpen(false));
  useMobileBackModal('gform-respondent-modal', Boolean(viewingRespondent), () => setViewingRespondent(null));

  useEffect(() => {
    if (!isAnyGFormModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isGuideModalOpen) setIsGuideModalOpen(false);
        else if (isEditSpreadsheetModalOpen) setIsEditSpreadsheetModalOpen(false);
        else if (viewingRespondent) setViewingRespondent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyGFormModalOpen, isGuideModalOpen, isEditSpreadsheetModalOpen, viewingRespondent]);

  // Synchronize Google Sheet data
  const handleSyncData = useCallback(async () => {
    if (!activeMaterial?.gformSpreadsheetUrl) {
      setParsedData(null);
      setSyncError(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await syncGoogleSheetExamData(activeMaterial.gformSpreadsheetUrl, kkmThreshold);
      if (result.success && result.data) {
        setParsedData(result.data);
        setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setSyncError(result.error || 'Gagal menyinkronkan data Google Spreadsheet');
      }
    } catch (err: any) {
      setSyncError(err.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      setIsSyncing(false);
    }
  }, [activeMaterial?.gformSpreadsheetUrl, kkmThreshold]);

  // Sync on material change or KKM change
  useEffect(() => {
    if (activeMaterial?.gformSpreadsheetUrl) {
      handleSyncData();
    } else {
      setParsedData(null);
      setSyncError(null);
    }
  }, [activeMaterial?.id, activeMaterial?.gformSpreadsheetUrl, kkmThreshold, handleSyncData]);

  // Quick save spreadsheet link
  const handleSaveSpreadsheetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMaterial) return;

    const cleanUrl = editSpreadsheetInput.trim();
    if (cleanUrl) {
      if (!isPublishedCsvSheetUrl(cleanUrl)) {
        setSaveErrorMsg(
          'URL Spreadsheet harus berupa link publik CSV yang valid (wajib mengandung "/pub?output=csv"). Silakan ikuti panduan: File > Bagikan > Publikasikan ke web > Pilih format CSV.'
        );
        return;
      }
    }

    setIsSavingSpreadsheetLink(true);
    setSaveErrorMsg('');
    setSaveSuccessMsg('');

    try {
      const updatedMat: Material = {
        ...activeMaterial,
        gformSpreadsheetUrl: cleanUrl,
        createdBy:
          activeMaterial.createdBy && activeMaterial.createdBy !== 'admin'
            ? activeMaterial.createdBy
            : isTeacherRole && currentTeacher
            ? (currentTeacher.username || currentTeacher.id)
            : activeMaterial.createdBy || 'admin',
        updatedAt: new Date().toISOString(),
      };

      await updateMaterial(activeMaterial.id, updatedMat);

      if (onUpdateMaterial) {
        onUpdateMaterial(updatedMat);
      }

      setSaveSuccessMsg('Link Google Spreadsheet CSV berhasil disimpan!');
      setTimeout(() => {
        setIsEditSpreadsheetModalOpen(false);
        setSaveSuccessMsg('');
        if (cleanUrl) {
          handleSyncData();
        }
      }, 1000);

      onRefreshAllData?.();
    } catch (err) {
      setSaveErrorMsg('Gagal menyimpan link ke database');
    } finally {
      setIsSavingSpreadsheetLink(false);
    }
  };

  // Open edit modal helper
  const handleOpenEditModal = () => {
    setEditSpreadsheetInput(activeMaterial?.gformSpreadsheetUrl || '');
    setSaveErrorMsg('');
    setSaveSuccessMsg('');
    setIsEditSpreadsheetModalOpen(true);
  };

  // Active material or category target grade (e.g., '7', '8', '9', 'smp-7')
  const activeTargetGrade = useMemo(() => {
    if (activeMaterial?.targetGrade && activeMaterial.targetGrade !== 'all' && activeMaterial.targetGrade !== 'umum') {
      return activeMaterial.targetGrade;
    }
    if (activeCategory?.targetGrade && activeCategory.targetGrade !== 'all' && activeCategory.targetGrade !== 'umum') {
      return activeCategory.targetGrade;
    }
    return null;
  }, [activeMaterial?.targetGrade, activeCategory?.targetGrade]);

  // Helper to normalize and check class & grade matching (prevents grades and unassigned classes from mixing)
  const isClassMatchedWithTeacher = useCallback(
    (rowClass: string) => {
      if (!rowClass || rowClass === '-') return true;

      // 1. Grade-level isolation: prevent students from different grades from leaking into the results
      if (activeTargetGrade) {
        const targetDigitMatch = activeTargetGrade.match(/\d+/);
        if (targetDigitMatch) {
          const targetDigit = targetDigitMatch[0];
          const rowDigitMatch = rowClass.match(/\d+/);
          if (rowDigitMatch && rowDigitMatch[0] !== targetDigit) {
            return false;
          }
        }
      }

      // 2. Teacher assigned classes isolation:
      if (!isTeacherRole || !currentTeacher?.assignedClasses || currentTeacher.assignedClasses.length === 0) {
        return true;
      }
      const norm = rowClass.trim().toLowerCase().replace(/^kelas\s+/i, '');
      return currentTeacher.assignedClasses.some((tc) => {
        const normTc = tc.trim().toLowerCase().replace(/^kelas\s+/i, '');
        return normTc === norm || tc.trim().toLowerCase() === rowClass.trim().toLowerCase();
      });
    },
    [isTeacherRole, currentTeacher, activeTargetGrade]
  );

  // Enrich parsed data rows with master registered students directory (fallback for missing absen/class)
  const enrichedRows = useMemo(() => {
    if (!parsedData?.rows) return [];
    return parsedData.rows.map((row) => {
      let finalAbsen = row.noAbsen;
      let finalClass = row.kelas && row.kelas !== '-' ? row.kelas : '';

      // If absen or class is missing, attempt smart matching with registered student master data
      if ((!finalAbsen || !finalClass) && students && students.length > 0) {
        const cleanRowName = (row.studentName || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        if (cleanRowName.length >= 3) {
          const matchedStudent =
            students.find((s) => {
              const cleanSName = (s.nama || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cleanSName !== cleanRowName) return false;
              if (finalClass && s.kelas) {
                const rk = finalClass.toLowerCase().replace(/[^a-z0-9]/g, '');
                const sk = s.kelas.toLowerCase().replace(/[^a-z0-9]/g, '');
                return rk === sk || rk.includes(sk) || sk.includes(rk);
              }
              return true;
            }) ||
            students.find((s) => {
              const cleanSName = (s.nama || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanSName === cleanRowName;
            }) ||
            students.find((s) => {
              const cleanSName = (s.nama || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              return (
                cleanSName.length > 5 &&
                cleanRowName.length > 5 &&
                (cleanSName.includes(cleanRowName) || cleanRowName.includes(cleanSName))
              );
            });

          if (matchedStudent) {
            if (!finalAbsen && matchedStudent.noAbsen) {
              finalAbsen = String(matchedStudent.noAbsen);
            }
            if (!finalClass && matchedStudent.kelas) {
              finalClass = matchedStudent.kelas;
            }
          }
        }
      }

      return {
        ...row,
        noAbsen: finalAbsen,
        kelas: finalClass || '-',
      };
    });
  }, [parsedData?.rows, students]);

  // Scoped rows respecting teacher assigned classes
  const scopedRows = useMemo(() => {
    if (!enrichedRows) return [];
    if (!isTeacherRole || !currentTeacher?.assignedClasses || currentTeacher.assignedClasses.length === 0) {
      return enrichedRows;
    }
    return enrichedRows.filter((r) => isClassMatchedWithTeacher(r.kelas));
  }, [enrichedRows, isTeacherRole, currentTeacher, isClassMatchedWithTeacher]);

  // Available classes detected from spreadsheet rows (scoped to teacher)
  const detectedClasses = useMemo(() => {
    if (!scopedRows || scopedRows.length === 0) {
      if (isTeacherRole && currentTeacher?.assignedClasses && currentTeacher.assignedClasses.length > 0) {
        return [...currentTeacher.assignedClasses].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      }
      return [];
    }
    const set = new Set<string>();
    scopedRows.forEach((r) => {
      const cls = (r.kelas || '').trim();
      if (cls && cls !== '-') set.add(cls);
    });
    if (isTeacherRole && currentTeacher?.assignedClasses) {
      currentTeacher.assignedClasses.forEach((ac) => {
        if (ac && ac.trim()) set.add(ac.trim());
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [scopedRows, isTeacherRole, currentTeacher]);

  // Filtered and sorted respondent rows
  const filteredRows = useMemo(() => {
    if (!scopedRows) return [];

    return scopedRows
      .filter((row) => {
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = row.studentName.toLowerCase().includes(q);
          const matchClass = row.kelas.toLowerCase().includes(q);
          const matchAbsen = row.noAbsen ? row.noAbsen.toLowerCase().includes(q) : false;
          if (!matchName && !matchClass && !matchAbsen) return false;
        }

        // Class filter
        if (selectedClassFilter !== 'all') {
          const normSelected = selectedClassFilter.trim().toLowerCase().replace(/^kelas\s+/i, '');
          const normRow = row.kelas.trim().toLowerCase().replace(/^kelas\s+/i, '');
          if (normRow !== normSelected && row.kelas.trim().toLowerCase() !== selectedClassFilter.trim().toLowerCase()) {
            return false;
          }
        }

        // Status filter (Passed / Remedial)
        if (statusFilter === 'passed') {
          if (!row.isPassed) return false;
        } else if (statusFilter === 'remedial') {
          if (row.isPassed) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.normalizedScore - a.normalizedScore;
        if (sortBy === 'lowest') return a.normalizedScore - b.normalizedScore;
        if (sortBy === 'name') return a.studentName.localeCompare(b.studentName, 'id');
        if (sortBy === 'absen') {
          const numA = parseInt(a.noAbsen || '999', 10);
          const numB = parseInt(b.noAbsen || '999', 10);
          return numA - numB;
        }
        if (sortBy === 'recent') {
          const timeA = a.submittedDateObj ? a.submittedDateObj.getTime() : 0;
          const timeB = b.submittedDateObj ? b.submittedDateObj.getTime() : 0;
          return timeB - timeA;
        }
        return 0;
      });
  }, [scopedRows, searchQuery, selectedClassFilter, statusFilter, sortBy]);

  // Top performers (Top 5 scores)
  const topPerformers = useMemo(() => {
    if (!scopedRows) return [];
    return [...scopedRows]
      .sort((a, b) => b.normalizedScore - a.normalizedScore)
      .slice(0, 5);
  }, [scopedRows]);

  // Remedial students list (Score < KKM)
  const remedialStudents = useMemo(() => {
    if (!scopedRows) return [];
    return scopedRows
      .filter((r) => !r.isPassed)
      .sort((a, b) => a.normalizedScore - b.normalizedScore);
  }, [scopedRows]);

  // Copy Remedial Students Names to Clipboard
  const handleCopyRemedialList = () => {
    if ((remedialStudents || []).length === 0) return;
    const textList = (remedialStudents || [])
      .map((r, i) => `${i + 1}. ${r.studentName} (Kelas: ${r.kelas}) - Nilai: ${r.normalizedScore}`)
      .join('\n');
    const header = `Daftar Siswa Remedial - ${activeMaterial?.title || 'Ujian'} (KKM: ${kkmThreshold})\nTotal: ${(remedialStudents || []).length} Siswa\n\n`;
    navigator.clipboard.writeText(header + textList);
    setCopiedRemedialNames(true);
    setTimeout(() => setCopiedRemedialNames(false), 2500);
  };

  // Export to Excel handler
  const handleExportToExcel = () => {
    if (!filteredRows || filteredRows.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const title = activeMaterial?.title || 'Hasil_Ujian_Google_Form';
    const cleanFileName = `Rekap_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_KKM${kkmThreshold}.xlsx`;

    const exportData = (filteredRows || []).map((r, idx) => ({
      'Peringkat': idx + 1,
      'Nama Siswa': r.studentName,
      'Kelas': r.kelas,
      'No. Absen': r.noAbsen || '-',
      'Nilai Asli': r.rawScore,
      'Nilai Konversi (0-100)': r.normalizedScore,
      'Status KKM': r.isPassed ? 'TUNTAS' : 'REMEDIAL',
      'Waktu Kirim': r.timestamp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');
    XLSX.writeFile(workbook, cleanFileName);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  const sheetEndpoints = activeMaterial?.gformSpreadsheetUrl
    ? getGoogleSheetEndpoints(activeMaterial.gformSpreadsheetUrl)
    : null;

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* 1. Header Card: Clear Purpose & High-Contrast Action Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Rekap &amp; Hasil Ujian Google Form
                </h2>
              </div>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Pantau respon siswa secara otomatis dari Google Spreadsheet publik (.CSV) tanpa perlu login otentikasi Google.
            </p>

            {/* Teacher Isolation Indicator */}
            {isTeacherRole && currentTeacher && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50/90 border border-indigo-200/80 rounded-xl text-xs mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-indigo-950 font-bold">
                  Mode Khusus Guru: <span className="font-extrabold underline decoration-indigo-300">{currentTeacher.name}</span> (@{currentTeacher.username})
                </span>
                <span className="hidden sm:inline text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200/60 shadow-2xs ml-1">
                  Data Terisolasi &amp; Mandiri
                </span>
              </div>
            )}
          </div>

          {/* Action Toolbar with Clear Visual Hierarchy */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Action Button: Sinkronkan */}
            {activeMaterial?.gformSpreadsheetUrl && (
              <button
                type="button"
                onClick={handleSyncData}
                disabled={isSyncing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                title="Perbarui data respon terkini dari Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
              </button>
            )}

            {/* Secondary Action: Link Spreadsheet */}
            {activeMaterial && (
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Atur atau ubah link Google Spreadsheet CSV"
              >
                <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>{activeMaterial.gformSpreadsheetUrl ? 'Ubah Link Sheet' : '+ Hubungkan Sheet'}</span>
              </button>
            )}

            {/* Tertiary Action: Panduan */}
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Lihat cara publikasi Google Sheets ke CSV"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Panduan</span>
            </button>
          </div>
        </div>

        {/* Material Selection Row */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <label className="text-xs font-extrabold text-slate-700 shrink-0 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pilih Ujian / Form:</span>
            </label>

            {gformMaterials.length === 0 ? (
              <span className="text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 font-semibold">
                {isTeacherRole
                  ? `Belum ada materi Google Form buatan akun guru ${currentTeacher?.name || currentTeacher?.username || 'Anda'}.`
                  : 'Belum ada materi pembelajaran dengan tipe Google Form.'}
              </span>
            ) : (
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full sm:max-w-md py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                {(gformMaterials || []).map((mat) => {
                  const cat = (categories || []).find((c) => c && c.id === mat.categoryId);
                  const subj = (subjects || []).find((s) => s && s.id === cat?.subjectId);
                  const hasSheet = Boolean(mat.gformSpreadsheetUrl);

                  let creatorBadge = '';
                  if (!isTeacherRole) {
                    const rawCreator = mat.createdBy || cat?.createdBy || 'admin';
                    const matchedTeacher = teacherLookupMap.get(rawCreator.toLowerCase().replace(/^@/, ''));
                    creatorBadge = matchedTeacher
                      ? ` • Guru: ${matchedTeacher.name}`
                      : rawCreator !== 'admin'
                      ? ` • Oleh: ${rawCreator}`
                      : ' • Admin';
                  }

                  return (
                    <option key={mat.id} value={mat.id}>
                      {subj ? `[${subj.name}] ` : ''}{mat.title}{creatorBadge} {hasSheet ? '✓ (Sheet Terhubung)' : '⚠ (Belum Ada Sheet)'}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Quick external links */}
          {activeMaterial && (
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={activeMaterial.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Buka form di tab baru"
              >
                <ExternalLink className="w-3 h-3 text-slate-500" />
                <span>Buka Form</span>
              </a>

              {sheetEndpoints?.openUrl && (
                <a
                  href={sheetEndpoints.openUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200/70"
                  title="Buka Spreadsheet di tab baru"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  <span>Buka Sheet</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Empty State when no Google Form materials are found for this teacher */}
      {gformMaterials.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-extrabold text-slate-900">
              {isTeacherRole
                ? `Belum Ada Materi Ujian Google Form untuk Akun ${currentTeacher?.name || currentTeacher?.username || 'Anda'}`
                : 'Belum Ada Materi Ujian Google Form'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isTeacherRole ? (
                <>
                  Sistem menerapkan <strong>isolasi data privasi penuh</strong>: halaman rekap ini hanya menampilkan data materi Google Form yang dibuat oleh akun guru Anda (<strong>{currentTeacher?.username}</strong>). Data respon dan nilai siswa tidak akan bercampur dengan mata pelajaran atau guru lain.
                </>
              ) : (
                <>
                  Belum ada bahan ajar dengan tipe Google Form atau tautan spreadsheet respon yang terdaftar di sistem.
                </>
              )}
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Lihat Panduan Integrasi Spreadsheet</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Banner: If No Sheet Connected */}
      {activeMaterial && !activeMaterial.gformSpreadsheetUrl && (
        <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-5 sm:p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-amber-700" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Link Spreadsheet Belum Dihubungkan
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Materi <strong>"{activeMaterial.title}"</strong> belum memiliki link Google Spreadsheet CSV untuk menarik hasil respon siswa.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Hubungkan Sheet (.CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Panduan</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Sync Error Box */}
      {syncError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Gagal Membaca Data Spreadsheet</span>
              <p className="text-rose-700 mt-0.5">{syncError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Panduan
            </button>
            <button
              type="button"
              onClick={handleSyncData}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Active Analytics & Summary Cards */}
      {parsedData && (
        <>
          {/* Executive Stats Cards with Distinct Accents */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Responden (Slate/Neutral) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Total Responden
                </span>
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {parsedData.stats.totalSubmissions}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Respon ujian tercatat
                </div>
              </div>
            </div>

            {/* Card 2: Rata-Rata Nilai (Emerald / Amber) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Rata-Rata Nilai
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  parsedData.stats.averageScore >= kkmThreshold
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className={`text-2xl sm:text-3xl font-black ${
                  parsedData.stats.averageScore >= kkmThreshold ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {parsedData.stats.averageScore}
                  <span className="text-xs font-bold text-slate-400 ml-1">/100</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  KKM Acuan: <strong className="text-slate-800">{kkmThreshold}</strong>
                </div>
              </div>
            </div>

            {/* Card 3: Nilai Tertinggi & Terendah */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Rentang Skor
                </span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Award className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black text-emerald-600">
                    {parsedData.stats.highestScore}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">Maks</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-xl sm:text-2xl font-black text-rose-600">
                    {parsedData.stats.lowestScore}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">Min</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Skala nilai 0 - 100
                </div>
              </div>
            </div>

            {/* Card 4: Ketuntasan Belajar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Tingkat Ketuntasan
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-black text-indigo-700">
                  {parsedData.stats.passPercentage}%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <span className="text-emerald-700 font-bold">{parsedData.stats.passedCount} Tuntas</span>
                  <span>•</span>
                  <span className="text-rose-700 font-bold">{parsedData.stats.remedialCount} Remedial</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Main Content Panel: Clean Tabs & Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* View Navigation Tabs */}
            <div className="px-4 sm:px-6 pt-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {/* Tab 1: Tabel Lengkap */}
                <button
                  type="button"
                  onClick={() => setActiveViewTab('table')}
                  className={`py-2 px-3.5 font-bold text-xs rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 border-t border-x ${
                    activeViewTab === 'table'
                      ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                      : 'bg-transparent text-slate-500 hover:text-slate-800 border-transparent'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Daftar Nilai Siswa</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold">
                    {filteredRows.length}
                  </span>
                </button>

                {/* Tab 2: Analisis Kelas */}
                <button
                  type="button"
                  onClick={() => setActiveViewTab('class_analysis')}
                  className={`py-2 px-3.5 font-bold text-xs rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 border-t border-x ${
                    activeViewTab === 'class_analysis'
                      ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                      : 'bg-transparent text-slate-500 hover:text-slate-800 border-transparent'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Analisis Rombel / Kelas</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-md bg-slate-100 text-slate-600 font-mono font-bold">
                    {Object.keys(parsedData.stats.classBreakdown).length}
                  </span>
                </button>

                {/* Tab 3: Statistik & Remedial (Replacement for unsubmitted) */}
                <button
                  type="button"
                  onClick={() => setActiveViewTab('remedial_insights')}
                  className={`py-2 px-3.5 font-bold text-xs rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 border-t border-x ${
                    activeViewTab === 'remedial_insights'
                      ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                      : 'bg-transparent text-slate-500 hover:text-slate-800 border-transparent'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Statistik &amp; Remedial</span>
                  {remedialStudents.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] rounded-md bg-rose-100 text-rose-800 font-mono font-bold">
                      {remedialStudents.length} Remedial
                    </span>
                  )}
                </button>

                {/* Tab 4: Live Sheet */}
                {sheetEndpoints?.embedHtmlUrl && (
                  <button
                    type="button"
                    onClick={() => setActiveViewTab('embed_sheet')}
                    className={`py-2 px-3.5 font-bold text-xs rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 border-t border-x ${
                      activeViewTab === 'embed_sheet'
                        ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                        : 'bg-transparent text-slate-500 hover:text-slate-800 border-transparent'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Live Spreadsheet</span>
                  </button>
                )}
              </div>

              {/* Toolbar Right: Sync info, Excel, Print */}
              <div className="flex items-center gap-2 pb-2 sm:pb-0">
                {lastSyncTime && (
                  <span className="text-[11px] text-slate-400 hidden lg:flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{lastSyncTime}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Unduh data tabel dalam format Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  title="Cetak tampilan tabel hasil ujian"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cetak</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3.5 sm:p-4 bg-slate-50/50 border-b border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* 1. Live Search */}
                <div className="relative lg:col-span-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa, NIS, atau no. absen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8.5 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 2. Class Filter */}
                <div>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="all">Semua Kelas ({(parsedData?.rows || []).length})</option>
                    {(detectedClasses || []).map((cls) => {
                      const count = (parsedData?.rows || []).filter((r) => (r.kelas || '').trim().toLowerCase() === cls.trim().toLowerCase()).length;
                      return (
                        <option key={cls} value={cls}>
                          Kelas {cls} ({count} siswa)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 3. Status Filter (Passed / Remedial) */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="all">Semua Ketuntasan</option>
                    <option value="passed">Hanya Tuntas (≥ {kkmThreshold})</option>
                    <option value="remedial">Hanya Remedial (&lt; {kkmThreshold})</option>
                  </select>
                </div>

                {/* 4. Sort By */}
                <div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="highest">Nilai Tertinggi</option>
                    <option value="lowest">Nilai Terendah</option>
                    <option value="recent">Waktu Terkini</option>
                    <option value="name">Nama Siswa (A-Z)</option>
                    <option value="absen">No. Absen</option>
                  </select>
                </div>
              </div>

              {/* KKM Slider & Grade Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <label className="text-xs font-extrabold text-slate-700">
                    Batas KKM:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={50}
                      max={95}
                      step={1}
                      value={kkmThreshold}
                      onChange={(e) => setKkmThreshold(parseInt(e.target.value) || 75)}
                      className="w-24 accent-indigo-600 cursor-pointer"
                    />
                    <span className="w-8 px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-black rounded-md text-center">
                      {kkmThreshold}
                    </span>
                  </div>
                </div>

                {/* Grade distribution badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                    A (90-100): <strong>{parsedData.stats.gradeDistribution.gradeA}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-bold text-[11px]">
                    B (80-89): <strong>{parsedData.stats.gradeDistribution.gradeB}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px]">
                    C (70-79): <strong>{parsedData.stats.gradeDistribution.gradeC}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold text-[11px]">
                    D (&lt;70): <strong>{parsedData.stats.gradeDistribution.gradeD}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* TAB VIEW 1: DATA TABLE */}
            {activeViewTab === 'table' && (
              <div className="overflow-x-auto">
                {filteredRows.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <Search className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-medium">Tidak ada data responden yang sesuai dengan filter atau kata kunci pencarian.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-3.5 w-14 text-center">Rank</th>
                        <th className="py-3 px-4">Nama Siswa</th>
                        <th className="py-3 px-4">Kelas &amp; Absen</th>
                        <th className="py-3 px-4 text-center">Nilai Ujian</th>
                        <th className="py-3 px-4 text-center">Status KKM</th>
                        <th className="py-3 px-4">Waktu Kirim</th>
                        <th className="py-3 px-4 text-center w-24">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(filteredRows || []).map((row, idx) => {
                        const rankNumber = idx + 1;
                        return (
                          <tr
                            key={row.rowId}
                            className="hover:bg-indigo-50/30 transition-colors group"
                          >
                            {/* Rank */}
                            <td className="py-3 px-3.5 text-center font-bold">
                              {rankNumber === 1 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-xs shadow-2xs font-black">
                                  🥇
                                </span>
                              ) : rankNumber === 2 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs shadow-2xs font-black">
                                  🥈
                                </span>
                              ) : rankNumber === 3 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-950 text-xs shadow-2xs font-black">
                                  🥉
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono font-bold text-xs">
                                  #{rankNumber}
                                </span>
                              )}
                            </td>

                            {/* Name */}
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {row.studentName}
                              </div>
                            </td>

                            {/* Class & Attendance */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[11px]">
                                  {row.kelas || '-'}
                                </span>
                                {row.noAbsen ? (
                                  <span className="text-[11px] text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                                    Absen #{row.noAbsen}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    (Tanpa Absen)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Score */}
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span
                                  className={`text-sm font-black ${
                                    row.isPassed ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {row.normalizedScore}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({row.rawScore})
                                </span>
                              </div>
                            </td>

                            {/* Status KKM */}
                            <td className="py-3 px-4 text-center">
                              {row.isPassed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  <span>TUNTAS</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  <X className="w-3 h-3" />
                                  <span>REMEDIAL</span>
                                </span>
                              )}
                            </td>

                            {/* Timestamp */}
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {row.timestamp || '-'}
                            </td>

                            {/* Action */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setViewingRespondent(row)}
                                className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Eye className="w-3 h-3 text-indigo-600" />
                                <span>Detail</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB VIEW 2: CLASS ANALYSIS */}
            {activeViewTab === 'class_analysis' && (
              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(parsedData.stats?.classBreakdown || {}).map(([clsName, rawStats]) => {
                    const cStats = rawStats as {
                      total: number;
                      avgScore: number;
                      passed: number;
                      remedial: number;
                      highest: number;
                      lowest: number;
                    };
                    const passPercent = Math.round((cStats.passed / (cStats.total || 1)) * 100);
                    return (
                      <div
                        key={clsName}
                        className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-sm text-slate-900">
                              Kelas {clsName}
                            </h4>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-xs font-bold">
                              {cStats.total} Siswa
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <span className="text-xs text-slate-500 font-medium">Rata-Rata Kelas:</span>
                            <span
                              className={`text-base font-black ${
                                cStats.avgScore >= kkmThreshold ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {cStats.avgScore} <span className="text-xs text-slate-400">/100</span>
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-600">Ketuntasan (KKM: {kkmThreshold})</span>
                              <span className="text-indigo-700">{passPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                              <div
                                className="bg-emerald-500 h-full transition-all"
                                style={{ width: `${passPercent}%` }}
                              />
                              <div
                                className="bg-rose-400 h-full transition-all"
                                style={{ width: `${100 - passPercent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                              <span className="text-emerald-700 font-bold">{cStats.passed} Tuntas</span>
                              <span className="text-rose-700 font-bold">{cStats.remedial} Remedial</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClassFilter(clsName);
                            setActiveViewTab('table');
                          }}
                          className="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center mt-2 shadow-2xs"
                        >
                          Lihat Siswa Kelas {clsName}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB VIEW 3: STATISTIK & TINDAK LANJUT REMEDIAL (REPLACEMENT FOR UN-SUBMITTED) */}
            {activeViewTab === 'remedial_insights' && (
              <div className="p-4 sm:p-6 space-y-6">
                {/* 2 Column Layout: Top Performers & Remedial Action List */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  
                  {/* Left Column: Top 5 Siswa Berprestasi */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">
                          Top 5 Nilai Tertinggi
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Siswa dengan perolehan skor terbaik pada ujian ini
                        </p>
                      </div>
                    </div>

                    {(topPerformers || []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">Belum ada data nilai</p>
                    ) : (
                      <div className="space-y-2">
                        {(topPerformers || []).map((p, idx) => {
                          const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                          return (
                            <div
                              key={p.rowId}
                              className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-lg shrink-0">{medals[idx]}</span>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-xs text-slate-900 truncate">
                                    {p.studentName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-medium">
                                    Kelas {p.kelas} {p.noAbsen ? `• Absen #${p.noAbsen}` : ''}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-sm font-black text-emerald-600">
                                  {p.normalizedScore}
                                </span>
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  Skor {p.rawScore}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Tindak Lanjut Remedial */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">
                            Daftar Siswa Perlu Remedial
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Nilai di bawah batas KKM ({kkmThreshold})
                          </p>
                        </div>
                      </div>

                      {remedialStudents.length > 0 && (
                        <button
                          type="button"
                          onClick={handleCopyRemedialList}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Salin daftar nama siswa remedial ke clipboard"
                        >
                          {copiedRemedialNames ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Salin Daftar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {(remedialStudents || []).length === 0 ? (
                      <div className="py-8 text-center bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                        <h5 className="font-extrabold text-xs text-emerald-900">Semua Siswa Tuntas!</h5>
                        <p className="text-[11px] text-emerald-700">Tidak ada siswa yang memperoleh nilai di bawah batas KKM ({kkmThreshold}).</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {(remedialStudents || []).map((r) => {
                          const gap = kkmThreshold - r.normalizedScore;
                          return (
                            <div
                              key={r.rowId}
                              className="p-3 bg-white rounded-xl border border-rose-100 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="min-w-0">
                                <div className="font-extrabold text-xs text-slate-900 truncate">
                                  {r.studentName}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 font-bold">
                                    Kelas {r.kelas}
                                  </span>
                                  {r.noAbsen && <span>• Absen #{r.noAbsen}</span>}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-sm font-black text-rose-600">
                                  {r.normalizedScore}
                                </span>
                                <span className="block text-[10px] text-rose-500 font-medium">
                                  Kurang {gap} poin
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* TAB VIEW 4: LIVE EMBEDDED GOOGLE SHEET */}
            {activeViewTab === 'embed_sheet' && sheetEndpoints?.embedHtmlUrl && (
              <div className="p-4 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    Menampilkan Lembar Google Spreadsheet Langsung:
                  </span>
                  <a
                    href={sheetEndpoints.openUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Layar Penuh di Google Sheets</span>
                  </a>
                </div>
                <div className="w-full h-[600px] rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-inner">
                  <iframe
                    src={sheetEndpoints.embedHtmlUrl}
                    title="Live Google Sheet"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 6. MODAL: EDIT / CONNECT SPREADSHEET LINK */}
      <GFormEditSpreadsheetModal
        isOpen={isEditSpreadsheetModalOpen}
        onClose={() => setIsEditSpreadsheetModalOpen(false)}
        activeMaterial={activeMaterial}
        editSpreadsheetInput={editSpreadsheetInput}
        setEditSpreadsheetInput={setEditSpreadsheetInput}
        saveSuccessMsg={saveSuccessMsg}
        saveErrorMsg={saveErrorMsg}
        isSavingSpreadsheetLink={isSavingSpreadsheetLink}
        onSaveSpreadsheetLink={handleSaveSpreadsheetLink}
      />

      {/* 7. MODAL: DETAILED RESPONDENT ANSWERS DRAWER */}
      <GFormRespondentDetailModal
        viewingRespondent={viewingRespondent}
        onClose={() => setViewingRespondent(null)}
        kkmThreshold={kkmThreshold}
      />

      {/* 8. MODAL: SHARING GUIDE TOOLTIP / POPUP */}
      <GFormGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
};
