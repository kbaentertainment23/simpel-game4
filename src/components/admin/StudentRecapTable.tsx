import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Award,
  Layers,
  GraduationCap,
  Wifi,
  Clock,
  Flame,
  ArrowUpDown,
  Hourglass,
} from 'lucide-react';
import { StudentAccount, Material, Category, Subject, TeacherAccount } from '../../types';
import * as XLSX from 'xlsx';
import { ConfirmResetModal } from './ConfirmResetModal';
import { getStudentOnlineStatus, formatStudyDuration, formatStudyDurationSeconds, areSubjectsMatching } from '../../lib/dataService';

interface StudentRecapTableProps {
  students: StudentAccount[];
  materials: Material[];
  categories: Category[];
  subjects: Subject[];
  studentProgressMap: Record<string, { completedMaterialIds: string[]; quizScores?: Record<string, number>; lastActive?: string; totalOnlineMinutes?: number; activityLogs?: any[] }>;
  isTeacherRole?: boolean;
  currentTeacher?: TeacherAccount | null;
  isLoading?: boolean;
  onRefresh: () => Promise<void>;
  onResetStudentProgress?: (studentId: string, studentName: string) => Promise<void>;
  onViewStudentDetail?: (student: StudentAccount) => void;
  onOpenQuizResults?: () => void;
}

export const StudentRecapTable: React.FC<StudentRecapTableProps> = ({
  students = [],
  materials = [],
  categories = [],
  subjects = [],
  studentProgressMap = {},
  isTeacherRole = false,
  currentTeacher = null,
  isLoading = false,
  onRefresh,
  onResetStudentProgress,
  onViewStudentDetail,
  onOpenQuizResults,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [progressTierFilter, setProgressTierFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all');
  const [statusAccessFilter, setStatusAccessFilter] = useState<'all' | 'online' | 'other_subject' | 'offline'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortOption, setSortOption] = useState<'default' | 'time_desc' | 'time_asc' | 'progress_desc' | 'name_asc'>('default');

  // Periodic tick to automatically refresh relative timestamps and active indicators every 10s
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Modal confirmation for resetting student progress
  const [resetTargetStudent, setResetTargetStudent] = useState<StudentAccount | null>(null);

  // Normalize and filter allowed students if teacher has assigned classes
  const teacherAssignedClasses = useMemo(() => {
    return isTeacherRole && Array.isArray(currentTeacher?.assignedClasses)
      ? currentTeacher.assignedClasses.map((c) => (c || '').trim()).filter(Boolean)
      : [];
  }, [isTeacherRole, currentTeacher]);

  const normalizeClass = (cls: string = ''): string => {
    return (cls || '').trim().toLowerCase().replace(/^kelas\s+/i, '');
  };

  const allowedStudents = useMemo(() => {
    const list = students || [];
    if (!isTeacherRole || teacherAssignedClasses.length === 0) {
      return list;
    }
    return list.filter((s) => {
      if (!s) return false;
      const norm = normalizeClass(s.kelas);
      return teacherAssignedClasses.some(
        (ac) => normalizeClass(ac) === norm || (ac || '').trim().toLowerCase() === (s.kelas || '').trim().toLowerCase()
      );
    });
  }, [students, isTeacherRole, teacherAssignedClasses]);

  // Unique classes for filter
  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    (allowedStudents || []).forEach((s) => {
      if (s?.kelas) set.add(s.kelas.trim());
    });
    return Array.from(set).sort();
  }, [allowedStudents]);

  // Target materials based on selected subject
  const effectiveSubjectId = isTeacherRole && currentTeacher?.subjectId ? currentTeacher.subjectId : selectedSubjectFilter;

  const targetMaterials = useMemo(() => {
    let targetCats = categories || [];
    if (effectiveSubjectId !== 'all') {
      targetCats = targetCats.filter((c) => (c?.subjectId || 'informatika') === effectiveSubjectId);
    }
    const catIds = new Set(targetCats.map((c) => c?.id).filter(Boolean));
    return (materials || []).filter((m) => m && catIds.has(m.categoryId) && m.isPublished !== false);
  }, [categories, materials, effectiveSubjectId]);

  // Computed student rows with progress info and online learning duration
  const processedData = useMemo(() => {
    const totalMatCount = targetMaterials.length;

    return (allowedStudents || []).map((s) => {
      const prog = (studentProgressMap && (studentProgressMap[s.id] || (s.nisn ? studentProgressMap[s.nisn] : undefined))) || { completedMaterialIds: [] };
      const completedIds = prog.completedMaterialIds || [];
      const doneCount = totalMatCount > 0 ? targetMaterials.filter((m) => completedIds.includes(m.id)).length : (prog.completedCount ?? completedIds.length);
      const percent = totalMatCount > 0 ? Math.round((doneCount / totalMatCount) * 100) : (prog.progressPercent ?? 0);

      // Determine online duration: subject-specific when a subject is filtered, or global for all subjects
      let onlineMinutes = 0;
      let durationInfo = { text: '0 mnt', fullText: 'Belum ada aktivitas' };

      const isSubjectSpecific = effectiveSubjectId !== 'all';
      if (isSubjectSpecific) {
        const cleanSubId = effectiveSubjectId.replace(/[^a-zA-Z0-9_-]/g, '_');

        // Check subjectOnlineSeconds flexibly across all matching subject keys
        let subjectSec = 0;
        if (s.subjectOnlineSeconds && typeof s.subjectOnlineSeconds === 'object') {
          for (const [key, val] of Object.entries(s.subjectOnlineSeconds)) {
            if (typeof val === 'number' && val > 0) {
              if (
                key === cleanSubId ||
                key === effectiveSubjectId ||
                areSubjectsMatching(key, effectiveSubjectId, subjects)
              ) {
                subjectSec += val;
              }
            }
          }
        }

        // Also check subjectOnlineMinutes flexibly across all matching keys
        let subjectMin = 0;
        if (s.subjectOnlineMinutes && typeof s.subjectOnlineMinutes === 'object') {
          for (const [key, val] of Object.entries(s.subjectOnlineMinutes)) {
            if (typeof val === 'number' && val > 0) {
              if (
                key === cleanSubId ||
                key === effectiveSubjectId ||
                areSubjectsMatching(key, effectiveSubjectId, subjects)
              ) {
                subjectMin += val;
              }
            }
          }
        }

        if (subjectSec > 0) {
          const formatted = formatStudyDurationSeconds(subjectSec);
          onlineMinutes = formatted.minutes;
          durationInfo = { text: formatted.text, fullText: formatted.fullText };
        } else if (subjectMin > 0) {
          onlineMinutes = subjectMin;
          durationInfo = formatStudyDuration(subjectMin);
        } else {
          onlineMinutes = 0;
          durationInfo = { text: '0 mnt', fullText: 'Belum ada aktivitas di mapel ini' };
        }
      } else {
        // Global duration across all subjects
        const totalSec = typeof s.totalOnlineSeconds === 'number' && s.totalOnlineSeconds > 0 ? s.totalOnlineSeconds : 0;
        const recordedMinutes =
          typeof s.totalOnlineMinutes === 'number' && s.totalOnlineMinutes >= 0
            ? s.totalOnlineMinutes
            : typeof (prog as any).totalOnlineMinutes === 'number' && (prog as any).totalOnlineMinutes >= 0
            ? (prog as any).totalOnlineMinutes
            : null;

        if (totalSec > 0) {
          const formatted = formatStudyDurationSeconds(totalSec);
          onlineMinutes = formatted.minutes;
          durationInfo = { text: formatted.text, fullText: formatted.fullText };
        } else if (recordedMinutes !== null && recordedMinutes > 0) {
          onlineMinutes = recordedMinutes;
          durationInfo = formatStudyDuration(onlineMinutes);
        } else {
          onlineMinutes = 0;
          durationInfo = { text: '0 mnt', fullText: 'Belum ada aktivitas' };
        }
      }

      const onlineInfo = getStudentOnlineStatus(s, prog, effectiveSubjectId, subjects);

      return {
        student: s,
        doneCount,
        totalMatCount,
        percent,
        onlineMinutes,
        durationInfo,
        lastActive: prog.lastActive,
        isOnline: onlineInfo.isOnline,
        isOnlineInLobby: onlineInfo.isOnlineInLobby,
        isOnlineInTargetSubject: onlineInfo.isOnlineInTargetSubject,
        isOnlineInOtherSubject: onlineInfo.isOnlineInOtherSubject,
        lastActiveText: onlineInfo.lastActiveText,
        locationLabel: onlineInfo.locationLabel,
        statusLabel: onlineInfo.statusLabel,
        subStatusText: onlineInfo.subStatusText,
        activeSubjectName: onlineInfo.activeSubjectName,
      };
    });
  }, [allowedStudents, targetMaterials, studentProgressMap, effectiveSubjectId, subjects, tick]);

  // Filtered and sorted rows
  const filteredData = useMemo(() => {
    const list = processedData.filter((item) => {
      const s = item.student;
      const matchesSearch =
        !searchQuery ||
        s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.nisn && s.nisn.includes(searchQuery)) ||
        (s.kelas && s.kelas.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesClass =
        selectedClassFilter === 'all' ||
        s.kelas?.toLowerCase() === selectedClassFilter.toLowerCase();

      let matchesTier = true;
      if (progressTierFilter === 'completed') {
        matchesTier = item.percent === 100;
      } else if (progressTierFilter === 'in_progress') {
        matchesTier = item.percent > 0 && item.percent < 100;
      } else if (progressTierFilter === 'not_started') {
        matchesTier = item.percent === 0;
      }

      let matchesAccess = true;
      if (statusAccessFilter === 'online') {
        matchesAccess = effectiveSubjectId !== 'all' ? item.isOnlineInTargetSubject : item.isOnline;
      } else if ((statusAccessFilter as string) === 'lobby') {
        matchesAccess = item.isOnlineInLobby;
      } else if (statusAccessFilter === 'other_subject') {
        matchesAccess = item.isOnlineInOtherSubject;
      } else if (statusAccessFilter === 'offline') {
        matchesAccess = !item.isOnline;
      }

      return matchesSearch && matchesClass && matchesTier && matchesAccess;
    });

    // Dynamic sorting: allows teacher to easily identify who studies longest
    if (sortOption === 'time_desc') {
      list.sort((a, b) => b.onlineMinutes - a.onlineMinutes);
    } else if (sortOption === 'time_asc') {
      list.sort((a, b) => a.onlineMinutes - b.onlineMinutes);
    } else if (sortOption === 'progress_desc') {
      list.sort((a, b) => b.percent - a.percent);
    } else if (sortOption === 'name_asc') {
      list.sort((a, b) => a.student.nama.localeCompare(b.student.nama));
    }

    return list;
  }, [processedData, searchQuery, selectedClassFilter, progressTierFilter, statusAccessFilter, sortOption]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    if (processedData.length === 0) {
      return {
        avgProgress: 0,
        completedCount: 0,
        activeCount: 0,
        onlineCount: 0,
        lobbyCount: 0,
        otherSubjectCount: 0,
        offlineCount: 0,
        totalStudyHours: 0,
        topActiveStudentName: null,
      };
    }
    const totalPercent = processedData.reduce((sum, item) => sum + item.percent, 0);
    const avgProgress = Math.round(totalPercent / processedData.length);
    const completedCount = processedData.filter((i) => i.percent === 100).length;
    const activeCount = processedData.filter((i) => i.percent > 0).length;
    const onlineCount = effectiveSubjectId !== 'all'
      ? processedData.filter((i) => i.isOnlineInTargetSubject).length
      : processedData.filter((i) => i.isOnline).length;
    const lobbyCount = processedData.filter((i) => i.isOnlineInLobby).length;
    const otherSubjectCount = processedData.filter((i) => i.isOnlineInOtherSubject).length;
    const offlineCount = processedData.filter((i) => !i.isOnline).length;

    const totalMinutes = processedData.reduce((sum, item) => sum + item.onlineMinutes, 0);
    const totalStudyHours = Math.round((totalMinutes / 60) * 10) / 10;
    const sortedByTime = [...processedData].sort((a, b) => b.onlineMinutes - a.onlineMinutes);
    const topActiveStudentName = sortedByTime[0]?.onlineMinutes > 0 ? sortedByTime[0].student.nama : null;

    return {
      avgProgress,
      completedCount,
      activeCount,
      onlineCount,
      lobbyCount,
      otherSubjectCount,
      offlineCount,
      totalStudyHours,
      topActiveStudentName,
    };
  }, [processedData, effectiveSubjectId]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const effectiveSubjectName = useMemo(() => {
    if (effectiveSubjectId === 'all') return 'Semua Mata Pelajaran';
    const sub = (subjects || []).find((s) => s.id === effectiveSubjectId);
    return sub?.name || effectiveSubjectId;
  }, [effectiveSubjectId, subjects]);

  const handleExportExcel = () => {
    try {
      const exportRows = (filteredData || []).map((item, idx) => ({
        No: idx + 1,
        'Nama Siswa': item.student.nama,
        'NIS': item.student.nisn || '-',
        'Kelas': item.student.kelas || '-',
        'Mata Pelajaran': effectiveSubjectName,
        'Status Akses': item.isOnline
          ? `ONLINE (${item.subStatusText})`
          : `OFFLINE (${item.lastActiveText || 'Tidak aktif'})`,
        'Materi Selesai': `${item.doneCount} / ${item.totalMatCount}`,
        'Persentase Progres': `${item.percent}%`,
        'Total Waktu Online': item.durationInfo.fullText,
        'Durasi (Menit)': item.onlineMinutes,
        'Aktivitas / Login Terakhir': item.lastActiveText || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Progres Siswa');
      const cleanSubjectTitle = effectiveSubjectName.replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(workbook, `Rekap_Siswa_${cleanSubjectTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg border border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-500/30">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
              Pemantauan & Rekapitulasi Progres Siswa
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            {isTeacherRole && currentTeacher?.assignedSubject
              ? `Mata Pelajaran: ${currentTeacher.assignedSubject}`
              : 'Pantau ketuntasan modul ajar dan nilai kuis per siswa secara realtime'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onOpenQuizResults && (
            <button
              type="button"
              onClick={onOpenQuizResults}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/30 cursor-pointer"
              title="Lihat Detail Nilai Kuis & Daftar Siswa Remedial / Belum Mengerjakan"
            >
              <Award className="w-3.5 h-3.5 text-slate-950" />
              <span>Hasil Kuis & Remedial</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Memuat...' : 'Refresh Data'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">Rata-Rata Ketuntasan</span>
            <span className="text-2xl font-black text-indigo-600 mt-1 block">{overallStats.avgProgress}%</span>
            <span className="text-[11px] text-slate-400">Dari total {targetMaterials.length} bahan ajar aktif</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">Siswa Tuntas 100%</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">{overallStats.completedCount}</span>
            <span className="text-[11px] text-slate-400">Telah menyelesaikan seluruh modul</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">Total Waktu Belajar</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-black text-blue-600 block">{overallStats.totalStudyHours}</span>
              <span className="text-xs font-bold text-blue-700">Jam</span>
            </div>
            <span className="text-[11px] text-slate-400">
              {overallStats.topActiveStudentName
                ? `Teraktif: ${overallStats.topActiveStudentName}`
                : `${overallStats.activeCount} dari ${allowedStudents.length} siswa aktif`}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">
              {effectiveSubjectId !== 'all' ? 'Siswa Online di Mapel Ini' : 'Siswa Sedang Online'}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600 block">{overallStats.onlineCount}</span>
              {overallStats.onlineCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {effectiveSubjectId !== 'all' ? 'Mapel Ini' : 'Aktif'}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">0 Aktif</span>
              )}
            </div>
            {effectiveSubjectId !== 'all' ? (
              <div className="flex flex-col gap-0.5 mt-1">
                {overallStats.otherSubjectCount > 0 && (
                  <span className="text-[11px] text-amber-700 font-semibold block">
                    🟡 {overallStats.otherSubjectCount} siswa di mapel lain
                  </span>
                )}
                {overallStats.lobbyCount > 0 && (
                  <span className="text-[11px] text-sky-700 font-semibold block">
                    🔵 {overallStats.lobbyCount} siswa di lobby mapel
                  </span>
                )}
                {overallStats.otherSubjectCount === 0 && overallStats.lobbyCount === 0 && (
                  <span className="text-[11px] text-slate-400">Semua siswa online aktif di mapel ini</span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 block mt-0.5">Sedang mengakses sistem sekarang</span>
            )}
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wifi className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama siswa, NIS, atau kelas..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Selector: Easily sort who studies longest */}
          <select
            value={sortOption}
            onChange={(e) => {
              setSortOption(e.target.value as any);
              setCurrentPage(1);
            }}
            className="py-2 px-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 focus:outline-none cursor-pointer"
            title="Urutkan daftar siswa"
          >
            <option value="default">Urutan: Standar (Kelas/Absen)</option>
            <option value="time_desc">⏱️ Waktu Online Terlama (Paling Rajin)</option>
            <option value="time_asc">⏱️ Waktu Online Tersingkat</option>
            <option value="progress_desc">📊 Progres Modul Tertinggi</option>
            <option value="name_asc">🔤 Nama Siswa (A-Z)</option>
          </select>

          {!isTeacherRole ? (
            <select
              value={selectedSubjectFilter}
              onChange={(e) => {
                setSelectedSubjectFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              title="Pilih lingkup waktu & materi per mata pelajaran"
            >
              <option value="all">🌐 Semua Mapel (Total Waktu Global)</option>
              {(subjects || []).map((s) => (
                <option key={s.id} value={s.id}>
                  📚 {s.name} (Khusus Waktu Mapel Ini)
                </option>
              ))}
            </select>
          ) : (
            <div className="py-2 px-3 bg-indigo-50/90 border border-indigo-200/80 rounded-xl text-xs font-bold text-indigo-900 flex items-center gap-1.5 shadow-2xs">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Mapel: {effectiveSubjectName}</span>
            </div>
          )}

          <select
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Kelas</option>
            {(uniqueClasses || []).map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>

          <select
            value={progressTierFilter}
            onChange={(e) => {
              setProgressTierFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Status Progres</option>
            <option value="completed">Tuntas (100%)</option>
            <option value="in_progress">Sedang Belajar (1-99%)</option>
            <option value="not_started">Belum Mulai (0%)</option>
          </select>

          <select
            value={statusAccessFilter}
            onChange={(e) => {
              setStatusAccessFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Status Akses</option>
            <option value="online">🟢 Online {effectiveSubjectId !== 'all' ? 'di Mapel Ini' : ''} ({overallStats.onlineCount})</option>
            {overallStats.lobbyCount > 0 && (
              <option value="lobby">🔵 Di Lobby Mapel ({overallStats.lobbyCount})</option>
            )}
            {effectiveSubjectId !== 'all' && (
              <option value="other_subject">🟡 Di Mapel Lain ({overallStats.otherSubjectCount})</option>
            )}
            <option value="offline">⚪ Offline ({overallStats.offlineCount})</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Tidak ada data progres siswa yang cocok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Modul Selesai</th>
                  <th className="py-3 px-4">Persentase Ketuntasan</th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer select-none hover:text-indigo-600 transition-colors group"
                    onClick={() => setSortOption((prev) => (prev === 'time_desc' ? 'time_asc' : 'time_desc'))}
                    title="Klik untuk mengurutkan berdasarkan lama waktu siswa online"
                  >
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <Clock className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
                      <span>Lama Online {effectiveSubjectId !== 'all' ? `(${effectiveSubjectName})` : '(Semua Mapel)'}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(paginatedData || []).map((item, idx) => {
                  const s = item.student;
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const is100 = item.percent === 100;
                  const isStarted = item.percent > 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{rowNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{s.nama}</div>
                        {s.nisn && <div className="text-[10px] text-slate-400 font-mono">NIS: {s.nisn}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px]">
                          {s.kelas || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {item.doneCount} <span className="text-slate-400">/ {item.totalMatCount}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden max-w-[140px]">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                is100
                                  ? 'bg-emerald-500'
                                  : isStarted
                                  ? 'bg-indigo-600'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono font-bold text-xs ${
                              is100 ? 'text-emerald-600' : isStarted ? 'text-indigo-600' : 'text-slate-400'
                            }`}
                          >
                            {item.percent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono font-bold text-[11px] border transition-all ${
                              item.onlineMinutes >= 120
                                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs font-extrabold'
                                : item.onlineMinutes >= 30
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                            title={`Total waktu siswa aktif membuka & mempelajari sistem: ${item.durationInfo.fullText}`}
                          >
                            {item.onlineMinutes >= 60 ? (
                              <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                            ) : (
                              <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                            )}
                            <span>{item.durationInfo.text}</span>
                          </span>
                          {item.onlineMinutes >= 120 && (
                            <span className="text-[9px] text-amber-600 font-extrabold mt-0.5 whitespace-nowrap">
                              Sangat Rajin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.isOnline ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
                                item.isOnlineInOtherSubject
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                              }`}
                            >
                              <span className="relative flex h-2 w-2">
                                <span
                                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                    item.isOnlineInOtherSubject ? 'bg-amber-400' : 'bg-emerald-400'
                                  }`}
                                ></span>
                                <span
                                  className={`relative inline-flex rounded-full h-2 w-2 ${
                                    item.isOnlineInOtherSubject ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                ></span>
                              </span>
                              Online
                            </span>
                            <span
                              className={`text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[140px] truncate ${
                                item.isOnlineInLobby
                                  ? 'text-sky-700'
                                  : item.isOnlineInOtherSubject
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                              title={item.subStatusText}
                            >
                              {item.subStatusText}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200/80">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                              Offline
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5 whitespace-nowrap">
                              {item.lastActiveText}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onViewStudentDetail && (
                            <button
                              type="button"
                              onClick={() => onViewStudentDetail(s)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                              title="Lihat Rincian Selesai"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onResetStudentProgress && (
                            <button
                              type="button"
                              id={`btn-reset-student-${s.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setResetTargetStudent(s);
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                              title="Reset Progres Siswa"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredData.length > 0 && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Menampilkan</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>dari <strong>{filteredData.length}</strong> siswa</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 font-semibold text-slate-700">
                Halaman {currentPage} dari {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal before Resetting */}
      {resetTargetStudent && (
        <ConfirmResetModal
          isOpen={!!resetTargetStudent}
          title="Konfirmasi Reset Progres Siswa"
          studentName={resetTargetStudent.nama}
          studentClass={resetTargetStudent.kelas}
          extraInfo={resetTargetStudent.nis ? `NIS: ${resetTargetStudent.nis}` : undefined}
          description={`Apakah Anda yakin ingin mereset seluruh progres belajar siswa "${resetTargetStudent.nama}"? Nilai kuis dan status selesai semua materi akan kembali ke 0. Tindakan ini hanya dijalankan setelah Anda mengklik tombol konfirmasi.`}
          confirmText="Ya, Reset Progres"
          onConfirm={async () => {
            if (onResetStudentProgress && resetTargetStudent) {
              await onResetStudentProgress(resetTargetStudent.id, resetTargetStudent.nama);
            }
            setResetTargetStudent(null);
          }}
          onClose={() => setResetTargetStudent(null)}
        />
      )}
    </div>
  );
};
