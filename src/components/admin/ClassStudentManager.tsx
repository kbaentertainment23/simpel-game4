import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  UserPlus,
  Upload,
  Download,
  Search,
  Filter,
  Edit2,
  Trash2,
  X,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import { StudentAccount } from '../../types';
import * as XLSX from 'xlsx';
import { useMobileBackModal } from '../../utils/mobileNavigation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { repairAndSyncAllStudents } from '../../lib/dataService';
import {
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  CopyCheck,
} from 'lucide-react';

interface ClassStudentManagerProps {
  students: StudentAccount[];
  masterClasses: string[];
  masterGrades: Array<{ id: string; label: string; subLabel: string }>;
  onSaveStudent: (studentData: Partial<StudentAccount>, isNew: boolean) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  onAddMasterClass: (className: string) => Promise<void>;
  onDeleteMasterClass: (className: string) => Promise<void>;
  onOpenImportModal: () => void;
  showNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ClassStudentManager: React.FC<ClassStudentManagerProps> = ({
  students = [],
  masterClasses = [],
  masterGrades = [],
  onSaveStudent,
  onDeleteStudent,
  onAddMasterClass,
  onDeleteMasterClass,
  onOpenImportModal,
  showNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Student Edit / Add Modal state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentAccount | null>(null);
  const [formName, setFormName] = useState('');
  const [formNoAbsen, setFormNoAbsen] = useState('');
  const [formNisn, setFormNisn] = useState('');
  const [formKelas, setFormKelas] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  // Class Management Modal state
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('7');
  const [isSavingClass, setIsSavingClass] = useState(false);

  // Download Per Class Modal state
  const [isDownloadClassModalOpen, setIsDownloadClassModalOpen] = useState(false);

  // In-App Confirm Delete State
  const [deleteStudentTarget, setDeleteStudentTarget] = useState<StudentAccount | null>(null);

  // Sync & Repair Students State
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useMobileBackModal('student-edit-modal', isStudentModalOpen, () => setIsStudentModalOpen(false));
  useMobileBackModal('master-class-modal', isClassModalOpen, () => setIsClassModalOpen(false));
  useMobileBackModal('download-class-modal', isDownloadClassModalOpen, () => setIsDownloadClassModalOpen(false));

  const handleRepairAndSync = async () => {
    setIsSyncing(true);
    try {
      const res = await repairAndSyncAllStudents();
      showNotify(
        'success',
        `Pemeriksaan selesai! ${res.total} siswa terdaftar di database telah diperiksa. ${res.fixed} akun telah disinkronkan & diperbarui. Semua siswa dipastikan dapat login.`
      );
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyinkronkan akun siswa');
    } finally {
      setIsSyncing(false);
    }
  };

  const uniqueClassNames = useMemo(() => {
    const set = new Set<string>();
    (masterClasses || []).forEach((mc) => {
      if (mc && typeof mc === 'string') set.add(mc.trim());
    });
    (students || []).forEach((s) => {
      if (s?.kelas) set.add(s.kelas.trim());
    });
    return Array.from(set).sort();
  }, [masterClasses, students]);

  const filteredStudents = useMemo(() => {
    return (students || []).filter((s) => {
      if (!s) return false;
      const sName = s.nama || '';
      const sNisn = s.nisn || s.username || '';
      const sKelas = s.kelas || '';
      const sAbsen = s.noAbsen || '';
      const matchesSearch =
        !searchQuery ||
        sName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sNisn.includes(searchQuery) ||
        sAbsen.includes(searchQuery) ||
        sKelas.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClass =
        selectedClassFilter === 'all' ||
        sKelas.toLowerCase() === selectedClassFilter.toLowerCase();

      const matchesStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'online' && Boolean(s.isOnline)) ||
        (selectedStatusFilter === 'offline' && !s.isOnline);

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [students, searchQuery, selectedClassFilter, selectedStatusFilter]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleOpenAddStudent = (defaultClass?: string) => {
    setEditingStudent(null);
    setFormName('');
    setFormNoAbsen('');
    setFormNisn('');
    setFormKelas(defaultClass || (uniqueClassNames.length > 0 ? uniqueClassNames[0] : ''));
    setFormPassword('');
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudent = (student: StudentAccount) => {
    setEditingStudent(student);
    setFormName(student.nama || '');
    setFormNoAbsen(student.noAbsen || '');
    setFormNisn(student.nisn || student.username || '');
    setFormKelas(student.kelas || '');
    setFormPassword('');
    setIsStudentModalOpen(true);
  };

  const handleSaveStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotify('error', 'Nama siswa tidak boleh kosong');
      return;
    }
    if (!formKelas.trim()) {
      showNotify('error', 'Kelas siswa tidak boleh kosong');
      return;
    }

    setIsSavingStudent(true);
    try {
      const payload: Partial<StudentAccount> = {
        nama: formName.trim(),
        noAbsen: formNoAbsen.trim(),
        nisn: formNisn.trim() || undefined,
        username: formNisn.trim() || undefined,
        kelas: formKelas.trim(),
        password: editingStudent
          ? (formPassword.trim() ? formPassword.trim() : undefined)
          : (formPassword.trim() || 'pass123'),
        updatedAt: new Date().toISOString(),
      };

      if (!editingStudent) {
        payload.createdAt = new Date().toISOString();
      }

      await onSaveStudent(payload, !editingStudent);
      setIsStudentModalOpen(false);
      showNotify('success', editingStudent ? 'Data siswa berhasil diperbarui' : 'Siswa baru berhasil ditambahkan');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan data siswa');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleCreateClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      showNotify('error', 'Nama kelas tidak boleh kosong');
      return;
    }

    setIsSavingClass(true);
    try {
      await onAddMasterClass(newClassName.trim());
      setNewClassName('');
      showNotify('success', `Kelas "${newClassName}" berhasil ditambahkan`);
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menambahkan kelas');
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Nomor Absen': 1,
        'Nama': 'Ahmad Fauzi',
        'NIS': '1234001',
        'Kelas': '7A',
        'Password': 'pass123'
      },
      {
        'Nomor Absen': 2,
        'Nama': 'Siti Nurhaliza',
        'NIS': '1234002',
        'Kelas': '7A',
        'Password': 'pass123'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 30 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
    XLSX.writeFile(wb, 'Template_Import_Siswa.xlsx');
  };

  /**
   * Unduh data siswa per kelas dengan kolom:
   * Nomor Absen, Nama, NIS, Kelas, dan Password
   */
  const downloadStudentsForClass = (targetClass: string) => {
    const classStudents = (students || []).filter(
      (s) => s && (s.kelas || '').trim().toLowerCase() === targetClass.trim().toLowerCase()
    );

    if (classStudents.length === 0) {
      showNotify('info', `Tidak ada data siswa terdaftar di Kelas ${targetClass}`);
      return;
    }

    // Urutkan siswa berdasarkan nomor absen secara numerik, lalu berdasarkan nama
    const sorted = [...classStudents].sort((a, b) => {
      const numA = parseInt(a.noAbsen || '', 10);
      const numB = parseInt(b.noAbsen || '', 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return (a.nama || '').localeCompare(b.nama || '', 'id');
    });

    const exportData = sorted.map((s, idx) => {
      const noAbsenVal = s.noAbsen && !isNaN(Number(s.noAbsen)) ? Number(s.noAbsen) : (s.noAbsen || idx + 1);
      return {
        'Nomor Absen': noAbsenVal,
        'Nama': s.nama || '-',
        'NIS': s.nisn || s.username || '-',
        'Kelas': s.kelas || targetClass,
        'Password': s.password || 'pass123',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 14 }, // Nomor Absen
      { wch: 32 }, // Nama
      { wch: 20 }, // NIS
      { wch: 12 }, // Kelas
      { wch: 18 }, // Password
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = `Kelas ${targetClass}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const safeClassName = targetClass.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Data_Siswa_Kelas_${safeClassName}.xlsx`);
    showNotify('success', `Berhasil mengunduh data ${exportData.length} siswa Kelas ${targetClass}`);
  };

  /**
   * Unduh seluruh siswa dari semua kelas
   */
  const handleExportAllStudents = () => {
    if ((students || []).length === 0) {
      showNotify('info', 'Belum ada data siswa untuk diunduh');
      return;
    }

    const sorted = [...(students || [])].sort((a, b) => {
      const classComp = (a.kelas || '').localeCompare(b.kelas || '', 'id');
      if (classComp !== 0) return classComp;
      const numA = parseInt(a.noAbsen || '', 10);
      const numB = parseInt(b.noAbsen || '', 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return (a.nama || '').localeCompare(b.nama || '', 'id');
    });

    const exportData = sorted.map((s, idx) => {
      const noAbsenVal = s.noAbsen && !isNaN(Number(s.noAbsen)) ? Number(s.noAbsen) : (s.noAbsen || idx + 1);
      return {
        'Nomor Absen': noAbsenVal,
        'Nama': s.nama || '-',
        'NIS': s.nisn || s.username || '-',
        'Kelas': s.kelas || '-',
        'Password': s.password || 'pass123',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 14 }, // Nomor Absen
      { wch: 32 }, // Nama
      { wch: 20 }, // NIS
      { wch: 12 }, // Kelas
      { wch: 18 }, // Password
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Semua Siswa');
    XLSX.writeFile(wb, `Data_Siswa_Semua_Kelas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotify('success', `Berhasil mengunduh data ${exportData.length} siswa`);
  };

  const handleExportStudents = () => {
    if (selectedClassFilter !== 'all') {
      downloadStudentsForClass(selectedClassFilter);
    } else {
      setIsDownloadClassModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              Direktori & Manajemen Akun Siswa
            </h3>
            <p className="text-xs text-slate-500">
              Kelola data peserta didik, rombongan belajar (rombel), dan akun login portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={handleRepairAndSync}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Pastikan dan sinkronkan semua akun siswa di database agar password dan NIS bisa langsung digunakan untuk login"
          >
            <KeyRound className={`w-3.5 h-3.5 text-amber-700 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Login Siswa'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClassModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>Kelola Kelas</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDownloadClassModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200/80 shadow-2xs cursor-pointer"
            title="Unduh Data Siswa Per Kelas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Unduh Per Kelas</span>
          </button>

          <button
            type="button"
            onClick={onOpenImportModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Import masal akun siswa dari file Excel (.xlsx / .csv)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Download Template Format Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Template</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddStudent()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama siswa, NIS, no absen, atau kelas..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Kelas ({(students || []).length} Siswa)</option>
            {(uniqueClassNames || []).map((c) => {
              const count = (students || []).filter((s) => s.kelas?.toLowerCase() === c.toLowerCase()).length;
              return (
                <option key={c} value={c}>
                  Kelas {c} ({count} siswa)
                </option>
              );
            })}
          </select>

          {/* Filter Status Online / Offline */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => {
              setSelectedStatusFilter(e.target.value as 'all' | 'online' | 'offline');
              setCurrentPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="online">🟢 Online (Sedang Aktif)</option>
            <option value="offline">⚪ Offline</option>
          </select>

          <button
            type="button"
            onClick={handleExportStudents}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title={selectedClassFilter !== 'all' ? `Unduh data siswa Kelas ${selectedClassFilter}` : 'Unduh data siswa per kelas'}
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>{selectedClassFilter !== 'all' ? `Unduh Kelas ${selectedClassFilter}` : 'Unduh Per Kelas'}</span>
          </button>
        </div>
      </div>

      {/* Table of Students */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Belum ada data siswa yang cocok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">No. Absen</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">NIS</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span>Password Akses</span>
                      <button
                        type="button"
                        onClick={() => setShowAllPasswords((prev) => !prev)}
                        className="p-1 hover:bg-slate-200 text-slate-500 rounded transition-colors cursor-pointer"
                        title={showAllPasswords ? 'Sembunyikan password' : 'Lihat semua password'}
                      >
                        {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(paginatedStudents || []).map((s, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-mono font-bold text-xs">
                        {s.noAbsen ? `#${s.noAbsen}` : <span className="text-slate-400 font-normal">{rowNumber}</span>}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{s.nama}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-semibold">{s.nisn || s.username || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold text-[10px]">
                          {s.kelas || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700 select-all">
                            {showAllPasswords ? (s.password || (s.isDefaultPassword ? 'pass123' : '••••••••')) : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const pwdText = s.password || (s.isDefaultPassword ? 'pass123' : '••••••••');
                              const text = `NIS: ${s.nisn || s.username || ''}\nPassword: ${pwdText}`;
                              navigator.clipboard.writeText(text);
                              setCopiedId(s.id);
                              showNotify('info', `Kredensial login ${s.nama} disalin`);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-1 hover:bg-slate-200 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                            title="Salin NIS & Password Siswa"
                          >
                            {copiedId === s.id ? (
                              <CopyCheck className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Indikator Visual Status Online / Akses Mapel Lain / Offline */}
                          <div className="flex flex-col items-end">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                                s.isOnline
                                  ? s.isOnlineInOtherSubject
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                              }`}
                              title={
                                s.isOnline
                                  ? `Siswa sedang Online - ${s.subStatusText || (s.activeSubjectName ? `di mapel ${s.activeSubjectName}` : 'di lobby mapel')}`
                                  : `Siswa Offline (${s.lastActiveText || s.lastActive || 'Tidak aktif'})`
                              }
                            >
                              <span className="relative flex h-2 w-2">
                                {s.isOnline && (
                                  <span
                                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                      s.isOnlineInOtherSubject ? 'bg-amber-400' : 'bg-emerald-400'
                                    }`}
                                  ></span>
                                )}
                                <span
                                  className={`relative inline-flex rounded-full h-2 w-2 ${
                                    s.isOnline ? (s.isOnlineInOtherSubject ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-400'
                                  }`}
                                ></span>
                              </span>
                              <span className="text-[10px] font-semibold">
                                {s.isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            <span
                              className="text-[9px] text-slate-500 font-medium mt-0.5 max-w-[120px] truncate"
                              title={
                                s.isOnline
                                  ? s.subStatusText || (s.activeSubjectName ? `di ${s.activeSubjectName}` : 'di lobby mapel')
                                  : s.lastActiveText || 'Offline'
                              }
                            >
                              {s.isOnline
                                ? s.subStatusText || (s.activeSubjectName ? `di ${s.activeSubjectName}` : 'di lobby mapel')
                                : s.lastActiveText || 'Offline'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenEditStudent(s)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Siswa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-student-${s.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteStudentTarget(s);
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Akun Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
        {filteredStudents.length > 0 && (
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
              <span>dari <strong>{filteredStudents.length}</strong> siswa</span>
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

      {/* Student Add / Edit Modal */}
      {isStudentModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          id="modal-student-overlay"
          className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto pt-16 sm:pt-6 animate-fadeIn"
          onClick={() => setIsStudentModalOpen(false)}
        >
          <div 
            id="modal-student-dialog"
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl sm:max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-7 py-4 sm:py-5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                  {editingStudent ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    {editingStudent ? 'Edit Akun Siswa' : 'Tambah Siswa Baru'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {editingStudent ? 'Perbarui NIS, nomor absen, rombel, atau password akun siswa' : 'Buat akun login portal belajar untuk siswa baru'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-student-modal"
                onClick={() => setIsStudentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl cursor-pointer transition-colors"
                title="Tutup form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="form-student-data" onSubmit={handleSaveStudentSubmit} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {/* Nama Lengkap Siswa (Melebar 2 kolom penuh) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Lengkap Siswa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-student-name"
                    placeholder="Contoh: Muhammad Rizky Pratama"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    required
                  />
                </div>

                {/* Nomor Absen (Kolom Kiri) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nomor Absen
                  </label>
                  <input
                    type="text"
                    id="input-student-no-absen"
                    placeholder="Contoh: 1, 2, 3..."
                    value={formNoAbsen}
                    onChange={(e) => setFormNoAbsen(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  />
                </div>

                {/* NIS (Nomor Induk Siswa) (Kolom Kanan) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    NIS (Nomor Induk Siswa)
                  </label>
                  <input
                    type="text"
                    id="input-student-nis"
                    placeholder="Contoh: 1234001"
                    value={formNisn}
                    onChange={(e) => setFormNisn(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  />
                </div>

                {/* Kelas / Rombongan Belajar (Melebar 2 kolom penuh) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kelas / Rombongan Belajar <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="input-student-class"
                      placeholder="Contoh: 7A, 8B, 9C"
                      value={formKelas}
                      onChange={(e) => setFormKelas(e.target.value)}
                      className="flex-1 py-2.5 px-3.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                      required
                    />
                    {masterClasses.length > 0 && (
                      <select
                        id="select-student-master-class"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) setFormKelas(e.target.value);
                        }}
                        className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                        title="Pilih dari Master Kelas"
                      >
                        <option value="">Pilih...</option>
                        {masterClasses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Password Login Siswa (Melebar 2 kolom) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Password Login Siswa
                  </label>
                  <input
                    type="text"
                    id="input-student-password"
                    placeholder={editingStudent ? "Biarkan kosong untuk mempertahankan password" : "Default: pass123"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {editingStudent
                      ? 'Biarkan kosong untuk mempertahankan password akun siswa ini.'
                      : 'Kosongkan jika ingin memakai kata sandi bawaan sistem (pass123).'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  id="btn-cancel-student"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="btn-submit-student"
                  disabled={isSavingStudent}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isSavingStudent ? 'Menyimpan...' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Class Manager Modal */}
      {isClassModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          id="modal-class-overlay"
          className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto pt-16 sm:pt-6 animate-fadeIn"
          onClick={() => setIsClassModalOpen(false)}
        >
          <div 
            id="modal-class-dialog"
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Kelola Daftar Master Kelas
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tambah atau hapus rombongan belajar (rombel) yang tersedia di sekolah
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-class-modal"
                onClick={() => setIsClassModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Form Add New Class */}
              <form onSubmit={handleCreateClassSubmit} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="font-bold text-xs text-slate-800">Tambah Kelas Baru:</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nama Kelas (Contoh: 7A, 8B)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                    required
                  />
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(e.target.value)}
                    className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    {(masterGrades || []).map((g) => (
                      <option key={g.id} value={g.id}>
                        Jenjang {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSavingClass}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingClass ? 'Menyimpan...' : 'Tambah ke Daftar Kelas'}</span>
                </button>
              </form>

              {/* Master Class List */}
              <div className="space-y-2">
                <div className="font-bold text-xs text-slate-700">Daftar Kelas Terdaftar:</div>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {(masterClasses || []).length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">Belum ada master kelas khusus</div>
                  ) : (
                    (masterClasses || []).map((className) => {
                      const countInClass = (students || []).filter(
                        (s) => s.kelas?.toLowerCase() === className.toLowerCase()
                      ).length;

                      return (
                        <div
                          key={className}
                          className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs hover:bg-slate-100/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">
                              Kelas {className}
                            </span>
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-500 font-medium">
                              {countInClass} siswa
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => downloadStudentsForClass(className)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                              title={`Unduh Data Siswa Kelas ${className} (.xlsx)`}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              id={`btn-delete-class-${className}`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await onDeleteMasterClass(className);
                                  showNotify('info', `Kelas ${className} berhasil dihapus dari daftar`);
                                } catch (err) {
                                  console.error('Failed to delete master class:', err);
                                  showNotify('error', `Gagal menghapus Kelas ${className}`);
                                }
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsClassModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Download Per Class Modal */}
      {isDownloadClassModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          id="modal-download-class-overlay"
          className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto pt-16 sm:pt-6 animate-fadeIn"
          onClick={() => setIsDownloadClassModalOpen(false)}
        >
          <div
            id="modal-download-class-dialog"
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Unduh Data Siswa Per Kelas
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Format: Nomor Absen, Nama, NIS, Kelas, dan Password (pass123)
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-download-class-modal"
                onClick={() => setIsDownloadClassModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3">
                <div className="text-xs text-indigo-900">
                  <div className="font-bold">Unduh Seluruh Data Siswa</div>
                  <div className="text-[11px] text-indigo-700">Total {(students || []).length} siswa dari semua kelas</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleExportAllStudents();
                    setIsDownloadClassModalOpen(false);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Semua Kelas</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-xs text-slate-700">Pilih Kelas untuk Diunduh:</div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
                  {(uniqueClassNames || []).length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">Belum ada kelas atau siswa terdaftar</div>
                  ) : (
                    (uniqueClassNames || []).map((c) => {
                      const count = (students || []).filter(
                        (s) => s && s.kelas?.toLowerCase() === c.toLowerCase()
                      ).length;

                      return (
                        <div
                          key={c}
                          className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                              {c.slice(0, 3)}
                            </div>
                            <div>
                              <div className="font-extrabold text-xs text-slate-900">Kelas {c}</div>
                              <div className="text-[10px] text-slate-500">{count} siswa terdaftar</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              downloadStudentsForClass(c);
                            }}
                            className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Unduh (.xlsx)</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDownloadClassModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* In-App Confirm Delete Modal for Student */}
      {deleteStudentTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteStudentTarget}
          title="Hapus Data Siswa"
          itemType="data siswa"
          itemName={deleteStudentTarget.nama}
          description={`Apakah Anda yakin ingin menghapus data siswa "${deleteStudentTarget.nama}" (${deleteStudentTarget.nisn || deleteStudentTarget.username || '-'}) kelas ${deleteStudentTarget.kelas}? Riwayat progres dan nilai kuis siswa ini akan terhapus.`}
          onConfirm={async () => {
            await onDeleteStudent(deleteStudentTarget.id);
            setDeleteStudentTarget(null);
          }}
          onClose={() => setDeleteStudentTarget(null)}
        />
      )}
    </div>
  );
};
