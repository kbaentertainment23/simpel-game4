import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Users,
  GraduationCap,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { Subject, StudentAccount, TeacherAccount } from '../types';
import {
  downloadStudentTemplate,
  downloadTeacherTemplate,
  parseStudentExcelFile,
  parseTeacherExcelFile,
  ParsedStudentRow,
  ParsedTeacherRow,
} from '../utils/excelImportExport';
import { bulkCreateStudents, bulkCreateTeachers, fetchStudents, fetchTeachers } from '../lib/dataService';

export interface ImportExcelModalProps {
  isOpen?: boolean;
  onClose: () => void;
  type: 'students' | 'teachers';
  subjects: Subject[];
  onSuccess?: (count?: number, message?: string) => void | Promise<void>;
}

export type DuplicateStrategy = 'skip' | 'update' | 'reject';

export interface AugmentedStudentRow extends ParsedStudentRow {
  isAlreadyInDb?: boolean;
  actionType: 'create' | 'update' | 'skip' | 'invalid';
}

export interface AugmentedTeacherRow extends ParsedTeacherRow {
  isAlreadyInDb?: boolean;
  actionType: 'create' | 'update' | 'skip' | 'invalid';
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen = true,
  onClose,
  type,
  subjects,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawStudentRows, setRawStudentRows] = useState<ParsedStudentRow[]>([]);
  const [rawTeacherRows, setRawTeacherRows] = useState<ParsedTeacherRow[]>([]);
  const [existingStudentsMap, setExistingStudentsMap] = useState<Map<string, StudentAccount>>(new Map());
  const [existingTeachersMap, setExistingTeachersMap] = useState<Map<string, TeacherAccount>>(new Map());

  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [filterTab, setFilterTab] = useState<'all' | 'ready' | 'issues'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (isOpen === false) return null;

  const isStudent = type === 'students';

  const handleDownloadTemplate = () => {
    if (isStudent) {
      downloadStudentTemplate();
    } else {
      downloadTeacherTemplate(subjects);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsLoading(true);
    setErrorMsg('');
    setCurrentPage(1);
    setSearchQuery('');

    try {
      if (isStudent) {
        const [parsedRows, existing] = await Promise.all([
          parseStudentExcelFile(file),
          fetchStudents(),
        ]);

        const sMap = new Map<string, StudentAccount>();
        (existing || []).forEach((s) => {
          if (s?.nisn) sMap.set(s.nisn.trim(), s);
          if (s?.username) sMap.set(s.username.trim().toLowerCase(), s);
        });
        setExistingStudentsMap(sMap);
        setRawStudentRows(parsedRows || []);

        if (!parsedRows || parsedRows.length === 0) {
          setErrorMsg('Tidak ada baris data yang ditemukan dalam file Excel ini. Pastikan format kolom sesuai template.');
        }
      } else {
        const [parsedRows, existing] = await Promise.all([
          parseTeacherExcelFile(file, subjects),
          fetchTeachers(),
        ]);

        const tMap = new Map<string, TeacherAccount>();
        (existing || []).forEach((t) => {
          if (t?.username) tMap.set(t.username.trim().toLowerCase(), t);
          if (t?.nip) tMap.set(t.nip.trim(), t);
        });
        setExistingTeachersMap(tMap);
        setRawTeacherRows(parsedRows || []);

        if (!parsedRows || parsedRows.length === 0) {
          setErrorMsg('Tidak ada baris data yang ditemukan dalam file Excel ini. Pastikan format kolom sesuai template.');
        }
      }
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      setErrorMsg('Gagal membaca file Excel. Pastikan format file .xlsx, .xls, atau .csv valid.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFile = () => {
    setSelectedFile(null);
    setRawStudentRows([]);
    setRawTeacherRows([]);
    setErrorMsg('');
    setCurrentPage(1);
    setSearchQuery('');
    setImportProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Compute augmented student rows based on duplicate strategy
  const augmentedStudentRows: AugmentedStudentRow[] = useMemo(() => {
    return rawStudentRows.map((r) => {
      const cleanNisn = (r.nisn || '').trim();
      const cleanUser = (r.username || cleanNisn).trim().toLowerCase();
      const inDb = (cleanNisn && existingStudentsMap.has(cleanNisn)) || (cleanUser && existingStudentsMap.has(cleanUser));

      let actionType: 'create' | 'update' | 'skip' | 'invalid' = 'create';
      const extraErrors: string[] = [];

      if (!r.isValid) {
        actionType = 'invalid';
      } else if (inDb) {
        if (duplicateStrategy === 'skip') {
          actionType = 'skip';
        } else if (duplicateStrategy === 'update') {
          actionType = 'update';
        } else {
          actionType = 'invalid';
          extraErrors.push('NIS/Username sudah terdaftar di sistem');
        }
      }

      const combinedError = [r.errorMessage, ...extraErrors].filter(Boolean).join(', ');

      return {
        ...r,
        isAlreadyInDb: Boolean(inDb),
        actionType,
        errorMessage: combinedError,
      };
    });
  }, [rawStudentRows, existingStudentsMap, duplicateStrategy]);

  // Compute augmented teacher rows based on duplicate strategy
  const augmentedTeacherRows: AugmentedTeacherRow[] = useMemo(() => {
    return rawTeacherRows.map((r) => {
      const cleanUser = (r.username || '').trim().toLowerCase();
      const cleanNip = (r.nip || '').trim();
      const inDb = (cleanUser && existingTeachersMap.has(cleanUser)) || (cleanNip && existingTeachersMap.has(cleanNip));

      let actionType: 'create' | 'update' | 'skip' | 'invalid' = 'create';
      const extraErrors: string[] = [];

      if (!r.isValid) {
        actionType = 'invalid';
      } else if (inDb) {
        if (duplicateStrategy === 'skip') {
          actionType = 'skip';
        } else if (duplicateStrategy === 'update') {
          actionType = 'update';
        } else {
          actionType = 'invalid';
          extraErrors.push('Username/NIP sudah terdaftar di sistem');
        }
      }

      const combinedError = [r.errorMessage, ...extraErrors].filter(Boolean).join(', ');

      return {
        ...r,
        isAlreadyInDb: Boolean(inDb),
        actionType,
        errorMessage: combinedError,
      };
    });
  }, [rawTeacherRows, existingTeachersMap, duplicateStrategy]);

  // Total and ready counts
  const totalCount = isStudent ? augmentedStudentRows.length : augmentedTeacherRows.length;
  const readyRows = useMemo(() => {
    if (isStudent) {
      return augmentedStudentRows.filter((r) => r.actionType === 'create' || r.actionType === 'update');
    }
    return augmentedTeacherRows.filter((r) => r.actionType === 'create' || r.actionType === 'update');
  }, [isStudent, augmentedStudentRows, augmentedTeacherRows]);

  const skippedCount = useMemo(() => {
    if (isStudent) return augmentedStudentRows.filter((r) => r.actionType === 'skip').length;
    return augmentedTeacherRows.filter((r) => r.actionType === 'skip').length;
  }, [isStudent, augmentedStudentRows, augmentedTeacherRows]);

  const invalidCount = useMemo(() => {
    if (isStudent) return augmentedStudentRows.filter((r) => r.actionType === 'invalid').length;
    return augmentedTeacherRows.filter((r) => r.actionType === 'invalid').length;
  }, [isStudent, augmentedStudentRows, augmentedTeacherRows]);

  // Filtered rows for the preview table
  const displayedRows = useMemo(() => {
    const list = isStudent ? augmentedStudentRows : augmentedTeacherRows;
    return list.filter((r) => {
      // Tab filter
      if (filterTab === 'ready' && r.actionType !== 'create' && r.actionType !== 'update') return false;
      if (filterTab === 'issues' && r.actionType !== 'invalid' && r.actionType !== 'skip') return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (isStudent) {
          const sr = r as AugmentedStudentRow;
          return (
            (sr.nama || '').toLowerCase().includes(q) ||
            (sr.nisn || '').toLowerCase().includes(q) ||
            (sr.kelas || '').toLowerCase().includes(q)
          );
        } else {
          const tr = r as AugmentedTeacherRow;
          return (
            (tr.name || '').toLowerCase().includes(q) ||
            (tr.username || '').toLowerCase().includes(q) ||
            (tr.nip || '').toLowerCase().includes(q) ||
            (tr.subjectName || '').toLowerCase().includes(q)
          );
        }
      }
      return true;
    });
  }, [isStudent, augmentedStudentRows, augmentedTeacherRows, filterTab, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(displayedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedRows.slice(start, start + pageSize);
  }, [displayedRows, currentPage, pageSize]);

  const handleExecuteImport = async () => {
    if (readyRows.length === 0) {
      setErrorMsg('Tidak ada baris data valid yang siap diimpor.');
      return;
    }

    setIsImporting(true);
    setErrorMsg('');
    setImportProgress({ current: 0, total: readyRows.length });

    try {
      if (isStudent) {
        const payload = (readyRows as AugmentedStudentRow[]).map((r) => ({
          nama: r.nama,
          kelas: r.kelas,
          noAbsen: r.noAbsen,
          nisn: r.nisn,
          username: r.username || r.nisn,
          password: r.password || 'pass123',
        }));

        await bulkCreateStudents(payload, {
          updateExisting: duplicateStrategy === 'update',
          onProgress: (current, total) => {
            setImportProgress({ current, total });
          },
        });

        const successMsg = `Berhasil mengimpor ${readyRows.length} data siswa secara masal!${
          skippedCount > 0 ? ` (${skippedCount} data lama dilewati)` : ''
        }`;

        onSuccess?.(readyRows.length, successMsg);
      } else {
        const payload = (readyRows as AugmentedTeacherRow[]).map((r) => ({
          name: r.name,
          nip: r.nip,
          username: r.username,
          password: r.password || 'gurupass123',
          subjectId: r.subjectId,
          assignedClasses: r.assignedClasses || [],
        }));

        await bulkCreateTeachers(payload);

        const successMsg = `Berhasil mengimpor ${readyRows.length} data guru secara masal!${
          skippedCount > 0 ? ` (${skippedCount} data lama dilewati)` : ''
        }`;

        onSuccess?.(readyRows.length, successMsg);
      }

      handleResetFile();
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan data ke server. Silakan coba lagi.');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                isStudent
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {isStudent ? <GraduationCap className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                {isStudent ? 'Import Masal Akun Siswa (Excel / CSV)' : 'Import Masal Akun Guru (Excel / CSV)'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isStudent
                  ? 'Unggah file Excel untuk mendaftarkan ratusan siswa sekaligus lengkap dengan NIS, kelas, dan akun login.'
                  : 'Unggah file Excel untuk mendaftarkan akun guru, NIP, mapel ampu, dan kelas mengajar.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Step 1: Download Template */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/80 p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-blue-950">
                  Unduh Template Resmi Format Excel ({isStudent ? 'Siswa' : 'Guru'})
                </h4>
                <p className="text-xs text-blue-800/80 mt-0.5 leading-relaxed">
                  Gunakan format template ini untuk pengisian data masal agar judul kolom otomatis terdeteksi dengan tepat.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template .xlsx</span>
            </button>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload Drop Zone / Selected File */}
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-indigo-50/30 p-8 rounded-2xl text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto mb-3 bg-white group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center transition-all">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                Klik atau Tarik File Excel (.xlsx / .csv) Ke Sini
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Mendukung file Excel sekolah, Dapodik, EMIS, atau template AI Studio
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-100/90 p-3 sm:px-4 rounded-xl border border-slate-200 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Ukuran: {(selectedFile.size / 1024).toFixed(1)} KB • Total dibaca:{' '}
                      <strong>{totalCount} baris</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetFile}
                  className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
                >
                  Ganti File
                </button>
              </div>

              {/* Duplicate Strategy Option - Crucial for Large Datasets */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Kebijakan Jika Akun NIS/Username Sudah Ada di Database:</span>
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setDuplicateStrategy('skip')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        duplicateStrategy === 'skip'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Lewati yang Sudah Ada (Aman)
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplicateStrategy('update')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        duplicateStrategy === 'update'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Perbarui Data Kelas/Profil
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplicateStrategy('reject')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        duplicateStrategy === 'reject'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Tolak Duplikasi
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {duplicateStrategy === 'skip' &&
                    '💡 Rekomendasi: Data siswa baru akan tetap diimpor, sedangkan akun yang NIS-nya sudah ada akan dilewati tanpa membatalkan import.'}
                  {duplicateStrategy === 'update' &&
                    '💡 Data siswa yang NIS-nya sudah terdaftar akan diperbarui kelas dan nomor absennya sesuai file Excel.'}
                  {duplicateStrategy === 'reject' &&
                    '💡 Menandai baris NIS yang sudah ada sebagai eror/ditolak.'}
                </p>
              </div>

              {/* Alert when all rows are skipped or no ready rows */}
              {totalCount > 0 && readyRows.length === 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-amber-900">
                        {skippedCount > 0
                          ? `Semua (${skippedCount}) data siswa dalam file ini sudah terdaftar di database.`
                          : 'Tidak ada baris data valid yang siap diimpor.'}
                      </p>
                      <p className="text-amber-800/80 mt-0.5">
                        {skippedCount > 0
                          ? 'Jika Anda ingin memperbarui profil/kelas/absen siswa lama dari file Excel ini, aktifkan mode "Perbarui Data Kelas/Profil" di sebelah kanan.'
                          : 'Pastikan file Excel Anda memuat kolom Nama, Kelas, dan NIS sesuai template.'}
                      </p>
                    </div>
                  </div>
                  {skippedCount > 0 && duplicateStrategy !== 'update' && (
                    <button
                      type="button"
                      onClick={() => setDuplicateStrategy('update')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shrink-0 cursor-pointer transition-all shadow-xs active:scale-95"
                    >
                      Aktifkan Perbarui Data
                    </button>
                  )}
                </div>
              )}

              {/* Summary Stats Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div
                  onClick={() => setFilterTab('all')}
                  className={`p-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                    filterTab === 'all'
                      ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Total Baris Dibaca:</span>
                  <span className="font-mono font-black">{totalCount}</span>
                </div>

                <div
                  onClick={() => setFilterTab('ready')}
                  className={`p-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                    filterTab === 'ready'
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Siap Diimpor:</span>
                  </span>
                  <span className="font-mono font-black">{readyRows.length}</span>
                </div>

                <div
                  onClick={() => setFilterTab('issues')}
                  className={`p-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                    filterTab === 'issues'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Dilewati / Eror:</span>
                  </span>
                  <span className="font-mono font-black">{skippedCount + invalidCount}</span>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama, NIS, atau kelas di pratinjau..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="text-xs text-slate-500 font-semibold">
                  Menampilkan {displayedRows.length} data{' '}
                  {totalPages > 1 && `(Halaman ${currentPage} dari ${totalPages})`}
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="border border-slate-300 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto shadow-2xs">
                {isLoading ? (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                    <p className="text-xs font-bold">Membaca isi file Excel...</p>
                  </div>
                ) : displayedRows.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Tidak ada data yang sesuai dengan filter.
                  </div>
                ) : isStudent ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-2.5 border border-slate-700 text-center w-12">No</th>
                        <th className="p-2.5 border border-slate-700 text-center w-28">Status</th>
                        <th className="p-2.5 border border-slate-700">Nama Lengkap</th>
                        <th className="p-2.5 border border-slate-700 text-center w-20">Kelas</th>
                        <th className="p-2.5 border border-slate-700 text-center w-16">Absen</th>
                        <th className="p-2.5 border border-slate-700">NIS (Username)</th>
                        <th className="p-2.5 border border-slate-700">Password</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {(paginatedRows as AugmentedStudentRow[]).map((row, idx) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                        const isActionOk = row.actionType === 'create' || row.actionType === 'update';
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              row.actionType === 'invalid'
                                ? 'bg-rose-50/50'
                                : row.actionType === 'skip'
                                ? 'bg-slate-50/60'
                                : row.actionType === 'update'
                                ? 'bg-amber-50/40'
                                : ''
                            }`}
                          >
                            <td className="p-2 border border-slate-200 text-center font-mono text-slate-500">
                              {globalIdx}
                            </td>
                            <td className="p-2 border border-slate-200 text-center">
                              {row.actionType === 'create' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Baru
                                </span>
                              )}
                              {row.actionType === 'update' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Update
                                </span>
                              )}
                              {row.actionType === 'skip' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  Dilewati
                                </span>
                              )}
                              {row.actionType === 'invalid' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  Eror
                                </span>
                              )}
                            </td>
                            <td className="p-2 border border-slate-200 font-bold text-slate-900">
                              <div>{row.nama || '-'}</div>
                              {row.errorMessage && (
                                <div className="text-[10px] font-normal text-rose-600 mt-0.5">
                                  ⚠️ {row.errorMessage}
                                </div>
                              )}
                            </td>
                            <td className="p-2 border border-slate-200 text-center font-semibold text-slate-700">
                              {row.kelas || '-'}
                            </td>
                            <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">
                              {row.noAbsen || '-'}
                            </td>
                            <td className="p-2 border border-slate-200 font-mono text-indigo-700 font-bold">
                              {row.nisn || '-'}
                            </td>
                            <td className="p-2 border border-slate-200 font-mono text-slate-600">
                              {row.password}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-2.5 border border-slate-700 text-center w-12">No</th>
                        <th className="p-2.5 border border-slate-700 text-center w-28">Status</th>
                        <th className="p-2.5 border border-slate-700">Nama Guru</th>
                        <th className="p-2.5 border border-slate-700">NIP / NIK</th>
                        <th className="p-2.5 border border-slate-700">Username</th>
                        <th className="p-2.5 border border-slate-700">Mata Pelajaran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {(paginatedRows as AugmentedTeacherRow[]).map((row, idx) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              row.actionType === 'invalid'
                                ? 'bg-rose-50/50'
                                : row.actionType === 'skip'
                                ? 'bg-slate-50/60'
                                : row.actionType === 'update'
                                ? 'bg-amber-50/40'
                                : ''
                            }`}
                          >
                            <td className="p-2 border border-slate-200 text-center font-mono text-slate-500">
                              {globalIdx}
                            </td>
                            <td className="p-2 border border-slate-200 text-center">
                              {row.actionType === 'create' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Baru
                                </span>
                              )}
                              {row.actionType === 'update' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Update
                                </span>
                              )}
                              {row.actionType === 'skip' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  Dilewati
                                </span>
                              )}
                              {row.actionType === 'invalid' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  Eror
                                </span>
                              )}
                            </td>
                            <td className="p-2 border border-slate-200 font-bold text-slate-900">
                              <div>{row.name || '-'}</div>
                              {row.errorMessage && (
                                <div className="text-[10px] font-normal text-rose-600 mt-0.5">
                                  ⚠️ {row.errorMessage}
                                </div>
                              )}
                            </td>
                            <td className="p-2 border border-slate-200 font-mono text-slate-600">
                              {row.nip || '-'}
                            </td>
                            <td className="p-2 border border-slate-200 font-mono text-indigo-700 font-bold">
                              {row.username || '-'}
                            </td>
                            <td className="p-2 border border-slate-200 font-semibold text-emerald-700">
                              {row.subjectName}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 py-1 text-xs font-mono font-bold bg-slate-100 rounded-lg">
                      {currentPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={!selectedFile || readyRows.length === 0 || isImporting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-95"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  Menyimpan {readyRows.length} Data Masal...
                </span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>
                  Import {readyRows.length} Akun Sekarang
                  {skippedCount > 0 ? ` (${skippedCount} dilewati)` : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
