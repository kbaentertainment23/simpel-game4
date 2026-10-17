import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Download,
  BookOpen,
  Filter,
  Layers,
  ArrowRight,
  Send,
  Search,
} from 'lucide-react';
import { StudentAccount, Subject, Category, Material } from '../types';
import * as XLSX from 'xlsx';

interface ProgressAnalyticsProps {
  students: StudentAccount[];
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  studentProgressMap: Record<string, { completedMaterialIds: string[]; updatedAt?: string }>;
  isTeacherRole?: boolean;
  assignedSubject?: Subject | null;
  onSelectStudent?: (student: StudentAccount) => void;
  onFilterByClass?: (className: string) => void;
}

export const ProgressAnalytics: React.FC<ProgressAnalyticsProps> = ({
  students = [],
  subjects = [],
  categories = [],
  materials = [],
  studentProgressMap = {},
  isTeacherRole,
  assignedSubject,
  onSelectStudent,
  onFilterByClass,
}) => {
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'rombel_summary' | 'followup' | 'subject_summary'>('rombel_summary');
  const [followUpFilter, setFollowUpFilter] = useState<'all_uncompleted' | 'zero_only' | 'under_50'>('all_uncompleted');
  const [followUpSearch, setFollowUpSearch] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Helper calculation for each student
  const studentStats = useMemo(() => {
    return (students || []).map((s) => {
      const prog = (studentProgressMap || {})[s.id] || (studentProgressMap || {})[s.nisn];
      const completedIds = prog?.completedMaterialIds || [];
      
      const targetMaterials = (materials || []).filter((m) => m.isPublished !== false);
      const doneCount = targetMaterials.length > 0 ? targetMaterials.filter((m) => completedIds.includes(m.id)).length : (prog?.completedCount ?? completedIds.length);
      const totalCount = targetMaterials.length > 0 ? targetMaterials.length : (prog?.totalMaterialsCount ?? 0);
      const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : (prog?.progressPercent ?? 0);

      return {
        student: s,
        completedIds,
        doneCount,
        totalCount,
        percent,
        updatedAt: prog?.updatedAt,
      };
    });
  }, [students, studentProgressMap, materials]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    let completedCount = 0;
    let inProgressCount = 0;
    let zeroCount = 0;
    let totalPercentSum = 0;

    (studentStats || []).forEach((s) => {
      totalPercentSum += s.percent;
      if (s.percent === 100) completedCount++;
      else if (s.percent > 0) inProgressCount++;
      else zeroCount++;
    });

    const totalStudents = (studentStats || []).length;
    const avgPercent = totalStudents > 0 ? Math.round(totalPercentSum / totalStudents) : 0;

    return {
      totalStudents,
      completedCount,
      inProgressCount,
      zeroCount,
      avgPercent,
    };
  }, [studentStats]);

  // Rombel / Class Performance Analytics Table Data
  const classPerformanceData = useMemo(() => {
    const classMap: Record<
      string,
      { total: number; sumPercent: number; completed: number; inProgress: number; zero: number }
    > = {};

    (studentStats || []).forEach((s) => {
      const cls = (s.student?.kelas || 'Tanpa Kelas').trim();
      if (!classMap[cls]) {
        classMap[cls] = { total: 0, sumPercent: 0, completed: 0, inProgress: 0, zero: 0 };
      }
      classMap[cls].total += 1;
      classMap[cls].sumPercent += s.percent;
      if (s.percent === 100) classMap[cls].completed += 1;
      else if (s.percent > 0) classMap[cls].inProgress += 1;
      else classMap[cls].zero += 1;
    });

    return Object.entries(classMap)
      .map(([className, data]) => {
        const avg = Math.round(data.sumPercent / data.total);
        let categoryStatus = 'Perlu Perhatian';
        let statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
        if (avg >= 80) {
          categoryStatus = 'Sangat Baik';
          statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        } else if (avg >= 60) {
          categoryStatus = 'Baik';
          statusColor = 'text-indigo-700 bg-indigo-50 border-indigo-200';
        } else if (avg >= 40) {
          categoryStatus = 'Sedang';
          statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
        }

        return {
          kelas: className,
          rawClass: className,
          rataRata: avg,
          jumlahSiswa: data.total,
          tuntas: data.completed,
          proses: data.inProgress,
          belumMulai: data.zero,
          tuntasPercent: Math.round((data.completed / data.total) * 100),
          categoryStatus,
          statusColor,
        };
      })
      .sort((a, b) => a.rawClass.localeCompare(b.rawClass, undefined, { numeric: true, sensitivity: 'base' }));
  }, [studentStats]);

  // Subject Performance Data
  const subjectPerformanceData = useMemo(() => {
    return (subjects || []).map((subj) => {
      const subjCats = (categories || []).filter((c) => c && (c.subjectId || 'informatika') === subj.id);
      const subjCatIds = (subjCats || []).map((c) => c?.id).filter(Boolean);
      const subjMats = (materials || []).filter((m) => m && subjCatIds.includes(m.categoryId) && m.isPublished !== false);

      if (subjMats.length === 0 || (students || []).length === 0) {
        return {
          subjectId: subj.id,
          subjectName: subj.name,
          subjectCode: subj.code || subj.id,
          totalMaterials: subjMats.length,
          totalCategories: subjCats.length,
          avgPercent: 0,
          completedStudentCount: 0,
        };
      }

      let sumSubjectPercent = 0;
      let fullCompletedStudents = 0;

      (students || []).forEach((s) => {
        if (!s) return;
        const prog = (studentProgressMap || {})[s.id] || (studentProgressMap || {})[s.nisn];
        const completedIds = prog?.completedMaterialIds || [];
        const done = subjMats.filter((m) => completedIds.includes(m.id)).length;
        const p = Math.round((done / subjMats.length) * 100);
        sumSubjectPercent += p;
        if (p === 100) fullCompletedStudents++;
      });

      const studentCount = (students || []).length;
      const avg = studentCount > 0 ? Math.round(sumSubjectPercent / studentCount) : 0;

      return {
        subjectId: subj.id,
        subjectName: subj.name,
        subjectCode: subj.code || subj.name.substring(0, 4),
        totalMaterials: subjMats.length,
        totalCategories: subjCats.length,
        avgPercent: avg,
        completedStudentCount: fullCompletedStudents,
      };
    });
  }, [subjects, categories, materials, students, studentProgressMap]);

  // Follow-up Students List
  const uncompletedStudents = useMemo(() => {
    return studentStats
      .filter((s) => {
        let matchFilter = true;
        if (followUpFilter === 'zero_only') matchFilter = s.percent === 0;
        else if (followUpFilter === 'under_50') matchFilter = s.percent < 50;
        else matchFilter = s.percent < 100;

        if (!matchFilter) return false;

        if (followUpSearch.trim()) {
          const q = followUpSearch.toLowerCase();
          const matchName = s.student.nama.toLowerCase().includes(q);
          const matchNisn = s.student.nisn.toLowerCase().includes(q);
          const matchClass = (s.student.kelas || '').toLowerCase().includes(q);
          return matchName || matchNisn || matchClass;
        }

        return true;
      })
      .sort((a, b) => a.percent - b.percent);
  }, [studentStats, followUpFilter, followUpSearch]);

  // Copy Follow-up List for WhatsApp Reminder
  const handleCopyFollowUpList = () => {
    if ((uncompletedStudents || []).length === 0) return;
    const lines = (uncompletedStudents || []).map(
      (s, idx) => `${idx + 1}. *${s?.student?.nama || 'Siswa'}* (Kelas ${s?.student?.kelas || '-'}, Absen #${s?.student?.noAbsen || '-'}) - Progres: ${s?.percent || 0}% (${s?.doneCount || 0}/${s?.totalCount || 0} materi)`
    );
    const header = `📢 *PENGINGAT KETUNTASAN BELAJAR SISWA*\n` +
      `📅 Tanggal: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}\n` +
      `📌 Mapel: ${assignedSubject ? assignedSubject.name : 'Sistem Materi Pembelajaran'}\n` +
      `👥 Total Siswa Perlu Bimbingan: ${(uncompletedStudents || []).length} Siswa\n` +
      `-------------------------------------------\n\n` +
      `Mohon kepada nama-nama siswa di bawah ini untuk segera login dan menuntaskan materi serta tes pembelajaran:\n\n`;
    const footer = `\n\n-------------------------------------------\nTerima kasih atas perhatian dan kerja samanya. 🙏`;
    const text = header + lines.join('\n') + footer;

    navigator.clipboard.writeText(text);
    setCopiedText('copied');
    setTimeout(() => setCopiedText(null), 3000);
  };

  // Export Follow-up List to Excel
  const handleExportFollowUpExcel = () => {
    if ((uncompletedStudents || []).length === 0) return;

    const data = (uncompletedStudents || []).map((s, idx) => ({
      'No.': idx + 1,
      'Nama Siswa': s?.student?.nama || '-',
      'Kelas': s?.student?.kelas || '-',
      'No. Absen': s?.student?.noAbsen || '-',
      'NIS': s?.student?.nisn || '-',
      'Persentase Ketuntasan': `${s?.percent || 0}%`,
      'Materi Selesai': s?.doneCount || 0,
      'Total Bahan Ajar': s?.totalCount || 0,
      'Status': s?.percent === 0 ? 'Belum Mulai (0%)' : 'Sedang Berjalan (Belum 100%)',
      'Terakhir Aktif': s?.updatedAt ? new Date(s.updatedAt).toLocaleString('id-ID') : 'Belum Ada',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa_Perlu_Tindak_Lanjut');
    XLSX.writeFile(wb, `Rekap_Siswa_Belum_Tuntas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export Class Summary to Excel
  const handleExportClassSummaryExcel = () => {
    if ((classPerformanceData || []).length === 0) return;

    const data = (classPerformanceData || []).map((d, idx) => ({
      'No.': idx + 1,
      'Rombel / Kelas': d.kelas,
      'Total Siswa': d.jumlahSiswa,
      'Rata-rata Ketuntasan': `${d.rataRata}%`,
      'Siswa Tuntas (100%)': d.tuntas,
      'Persentase Tuntas': `${d.tuntasPercent}%`,
      'Siswa Sedang Proses': d.proses,
      'Siswa Belum Mulai': d.belumMulai,
      'Kategori Kinerja': d.categoryStatus,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Analitik_Rombel');
    XLSX.writeFile(wb, `Rekap_Analitik_Rombel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-2xs shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
              Analitik & Rekapitulasi Pembelajaran
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isTeacherRole && assignedSubject
                ? `Mata Pelajaran: ${assignedSubject.name} • Laporan ketuntasan dan tindak lanjut siswa`
                : 'Laporan komprehensif ketuntasan materi, rekapitulasi rombel, dan evaluasi hasil belajar'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveAnalyticsTab('rombel_summary')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeAnalyticsTab === 'rombel_summary'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80 font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Rekap per Rombel ({classPerformanceData.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAnalyticsTab('followup')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeAnalyticsTab === 'followup'
                ? 'bg-white text-rose-700 shadow-2xs border border-slate-200/80 font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Tindak Lanjut Siswa</span>
            {studentStats.filter((s) => s.percent < 100).length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black">
                {studentStats.filter((s) => s.percent < 100).length}
              </span>
            )}
          </button>

          {!isTeacherRole && subjects.length > 1 && (
            <button
              type="button"
              onClick={() => setActiveAnalyticsTab('subject_summary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeAnalyticsTab === 'subject_summary'
                  ? 'bg-white text-purple-700 shadow-2xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-500" />
              <span>Rekap per Mapel</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: REKAPITULASI ANALITIK PER ROMBEL (TABEL DATA KINERJA KELAS) */}
      {activeAnalyticsTab === 'rombel_summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
          {/* Table Header Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Tabel Kinerja & Ketuntasan Rombongan Belajar (Rombel)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Rangkuman persentase penyelesaian materi dan pembagian status siswa di setiap rombel
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportClassSummaryExcel}
              disabled={classPerformanceData.length === 0}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Rekap Excel</span>
            </button>
          </div>

          {/* Table View */}
          {classPerformanceData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Belum ada data rombel/kelas untuk ditampilkan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No.</th>
                    <th className="py-3 px-4">Rombel / Kelas</th>
                    <th className="py-3 px-3 text-center">Jumlah Siswa</th>
                    <th className="py-3 px-4 min-w-[180px]">Rata-rata Ketuntasan</th>
                    <th className="py-3 px-3 text-center">Tuntas (100%)</th>
                    <th className="py-3 px-3 text-center">Sedang Proses</th>
                    <th className="py-3 px-3 text-center">Belum Mulai</th>
                    <th className="py-3 px-3 text-center">Kategori</th>
                    <th className="py-3 px-4 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {(classPerformanceData || []).map((row, idx) => (
                    <tr
                      key={row.kelas}
                      className="hover:bg-indigo-50/20 transition-colors group"
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          Kelas {row.kelas}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-bold">
                          {row.jumlahSiswa} Siswa
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-900">{row.rataRata}%</span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {row.tuntas}/{row.jumlahSiswa} lulus
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                row.rataRata >= 80
                                  ? 'bg-emerald-500'
                                  : row.rataRata >= 50
                                  ? 'bg-indigo-600'
                                  : row.rataRata >= 25
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${row.rataRata}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-extrabold rounded-md border border-emerald-200">
                          {row.tuntas} ({row.tuntasPercent}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md border border-indigo-100">
                          {row.proses}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200">
                          {row.belumMulai}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-black rounded-lg border ${row.statusColor}`}
                        >
                          {row.categoryStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onFilterByClass && onFilterByClass(row.rawClass)}
                          className="px-2.5 py-1.5 bg-white hover:bg-indigo-600 hover:text-white active:scale-95 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer mx-auto"
                          title={`Buka tabel siswa khusus Kelas ${row.kelas}`}
                        >
                          <span>Lihat Siswa</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAFTAR TINDAK LANJUT SISWA (INTERAKTIF & TABULAR) */}
      {activeAnalyticsTab === 'followup' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-4 sm:p-5">
          {/* Header & Action Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <h4 className="font-black text-sm sm:text-base text-slate-900">
                  Daftar Siswa Perlu Bimbingan / Belum Tuntas
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Gunakan fitur ini untuk menyalin daftar siswa yang tertinggal atau mengunduh data pengingat belajar.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyFollowUpList}
                disabled={uncompletedStudents.length === 0}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Salin teks pengingat berformat WhatsApp siap kirim ke grup kelas/wali murid"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Send className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Tersalin untuk WhatsApp!' : 'Salin Format WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportFollowUpExcel}
                disabled={uncompletedStudents.length === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Kategori:
              </span>
              <button
                type="button"
                onClick={() => setFollowUpFilter('all_uncompleted')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  followUpFilter === 'all_uncompleted'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Semua Belum Tuntas (&lt; 100%) ({studentStats.filter((s) => s.percent < 100).length})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('zero_only')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  followUpFilter === 'zero_only'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                }`}
              >
                Belum Mulai (0%) ({studentStats.filter((s) => s.percent === 0).length})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('under_50')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  followUpFilter === 'under_50'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                Progres &lt; 50% ({studentStats.filter((s) => s.percent < 50).length})
              </button>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari siswa di daftar ini..."
                value={followUpSearch}
                onChange={(e) => setFollowUpSearch(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Uncompleted Students Table */}
          {uncompletedStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h5 className="font-extrabold text-slate-800 text-sm">Semua Siswa Telah Tuntas!</h5>
              <p className="text-xs text-slate-500">Tidak ada siswa yang tertinggal dalam kriteria filter ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 uppercase tracking-wider font-extrabold text-[10px] border-b border-slate-200">
                    <th className="py-2.5 px-3 text-center w-12">No.</th>
                    <th className="py-2.5 px-3.5">Nama Siswa</th>
                    <th className="py-2.5 px-3 text-center">Kelas</th>
                    <th className="py-2.5 px-3 text-center">No. Absen</th>
                    <th className="py-2.5 px-3.5">NIS</th>
                    <th className="py-2.5 px-3.5 min-w-[140px]">Progres Ketuntasan</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(uncompletedStudents || []).map((s, idx) => (
                    <tr
                      key={s?.student?.id || idx}
                      className="hover:bg-rose-50/30 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {s?.student?.nama || 'Siswa'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] rounded-md border border-indigo-100">
                          Kelas {s?.student?.kelas || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        #{s?.student?.noAbsen || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-slate-600">{s?.student?.nisn || '-'}</td>
                      <td className="py-2.5 px-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-black text-slate-800">{s?.percent || 0}%</span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              {s?.doneCount || 0}/{s?.totalCount || 0} materi
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                (s?.percent || 0) > 50
                                  ? 'bg-indigo-600'
                                  : (s?.percent || 0) > 0
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${s?.percent || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            (s?.percent || 0) === 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {(s?.percent || 0) === 0 ? 'Belum Mulai' : 'Dalam Proses'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => s?.student && onSelectStudent && onSelectStudent(s.student)}
                          className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-extrabold cursor-pointer active:scale-95 transition-all"
                          title="Buka rincian progres materi siswa ini di tabel utama"
                        >
                          Rincian
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REKAPITULASI PER MATA PELAJARAN (ADMIN ONLY) */}
      {activeAnalyticsTab === 'subject_summary' && !isTeacherRole && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              <span>Tabel Ketuntasan Rata-rata per Mata Pelajaran</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan tingkat penyelesaian seluruh siswa di setiap mata pelajaran yang terdaftar
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No.</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-3 text-center">Kode Mapel</th>
                  <th className="py-3 px-3 text-center">Total Topik</th>
                  <th className="py-3 px-3 text-center">Bahan Ajar / Tes</th>
                  <th className="py-3 px-4 min-w-[180px]">Rata-rata Ketuntasan</th>
                  <th className="py-3 px-3 text-center">Siswa Tuntas 100%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(subjectPerformanceData || []).map((subj, idx) => (
                  <tr key={subj.subjectId} className="hover:bg-purple-50/20 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">{subj.subjectName}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">{subj.subjectCode}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{subj.totalCategories} Topik</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{subj.totalMaterials} Item</td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-slate-900">{subj.avgPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              subj.avgPercent >= 80
                                ? 'bg-emerald-500'
                                : subj.avgPercent >= 50
                                ? 'bg-purple-600'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${subj.avgPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-0.5 bg-purple-50 text-purple-800 font-extrabold rounded-md border border-purple-200">
                        {subj.completedStudentCount} Siswa
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
