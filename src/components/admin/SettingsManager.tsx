import React, { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  Palette,
  KeyRound,
  Target,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Save,
  Image as ImageIcon,
  HelpCircle,
  FileJson,
  FileSpreadsheet,
  Layers,
  Settings,
  Sparkles,
  GraduationCap,
  Award,
  BookOpen,
  Users,
  Check,
  Info,
  X,
  Wrench,
} from 'lucide-react';
import { DatabaseJunkReport, SystemBackupData } from '../../types';
import { GradeConfig } from '../../lib/dataService';
import {
  downloadJsonBackup,
  exportAllDataToExcel,
  parseBackupJsonFile,
  parseBackupExcelFile,
} from '../../utils/excelImportExport';
import { exportAllSystemData, restoreSystemData } from '../../lib/dataService';
import { runQuizScoreAuditAndRepair, QuizScoreAuditReport } from '../../utils/quizScoreAudit';

interface SettingsManagerProps {
  // Junk Cleaner
  junkReport: DatabaseJunkReport | null;
  isScanningJunk: boolean;
  isCleaningJunk: boolean;
  onScanJunk: () => Promise<DatabaseJunkReport | null>;
  onCleanJunk: (cleanAll?: boolean, targetIds?: string[]) => Promise<string>;

  // Branding
  siteLogoUrl: string;
  onSaveLogo: (url: string) => Promise<void>;

  // Security PIN
  onSavePin: (pin: string) => Promise<void>;

  // Quiz Settings
  minQuizScore: number;
  onSaveMinQuizScore: (score: number) => Promise<void>;

  // Master Grades & Classes
  masterGrades: GradeConfig[];
  masterClasses: string[];
  onAddMasterClass: (name: string) => Promise<void>;
  onDeleteMasterClass: (name: string) => Promise<void>;

  // Refresh
  onRefreshData: () => Promise<void>;
  showNotify: (type: 'success' | 'error', message: string) => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  junkReport,
  isScanningJunk,
  isCleaningJunk,
  onScanJunk,
  onCleanJunk,
  siteLogoUrl,
  onSaveLogo,
  onSavePin,
  minQuizScore,
  onSaveMinQuizScore,
  masterGrades,
  masterClasses,
  onAddMasterClass,
  onDeleteMasterClass,
  onRefreshData,
  showNotify,
}) => {
  type SettingsSubTab = 'cleaner' | 'backup' | 'branding' | 'security' | 'quiz';
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('cleaner');

  // Logo State
  const [logoInput, setLogoInput] = useState(siteLogoUrl);
  const [isSavingLogo, setIsSavingLogo] = useState(false);

  // Security PIN State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Quiz Score State (Percentage %, default 80%)
  const [quizScoreInput, setQuizScoreInput] = useState(() => (minQuizScore <= 10 ? minQuizScore * 10 : (minQuizScore || 80)));
  const [isSavingQuizScore, setIsSavingQuizScore] = useState(false);

  useEffect(() => {
    if (minQuizScore !== undefined) {
      setQuizScoreInput(minQuizScore <= 10 ? minQuizScore * 10 : minQuizScore);
    }
  }, [minQuizScore]);

  // Backup & Restore State
  const [isBackingUpJson, setIsBackingUpJson] = useState(false);
  const [isBackingUpExcel, setIsBackingUpExcel] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedRestoreData, setParsedRestoreData] = useState<SystemBackupData | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [restoreConfirmKeyword, setRestoreConfirmKeyword] = useState('');
  const [isExecutingRestore, setIsExecutingRestore] = useState(false);

  // Quiz Audit & Repair State
  const [isAuditingQuiz, setIsAuditingQuiz] = useState(false);
  const [isHealingQuiz, setIsHealingQuiz] = useState(false);
  const [quizAuditReport, setQuizAuditReport] = useState<QuizScoreAuditReport | null>(null);
  const [lastHealSummary, setLastHealSummary] = useState<{ repairedCount: number } | null>(null);

  const handleRunAudit = async () => {
    setIsAuditingQuiz(true);
    try {
      const res = await runQuizScoreAuditAndRepair(true);
      setQuizAuditReport(res.report);
      setLastHealSummary(null);
      if (res.report.totalDiscrepanciesFound === 0) {
        showNotify('success', 'Semua nilai kuis siswa sinkron dan valid!');
      } else {
        showNotify('success', `Pemindaian selesai: Ditemukan ${res.report.totalDiscrepanciesFound} ketidaksesuaian nilai.`);
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal memeriksa integritas nilai');
    } finally {
      setIsAuditingQuiz(false);
    }
  };

  const handleRunRepair = async () => {
    setIsHealingQuiz(true);
    try {
      const res = await runQuizScoreAuditAndRepair(false);
      setQuizAuditReport(res.report);
      setLastHealSummary({ repairedCount: res.repairedCount });
      showNotify('success', `Berhasil memperbaiki & menyelaraskan ${res.repairedCount} nilai kuis siswa!`);
      await onRefreshData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal memperbaiki nilai kuis');
    } finally {
      setIsHealingQuiz(false);
    }
  };

  const handleSaveLogoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLogo(true);
    try {
      await onSaveLogo(logoInput.trim());
      showNotify('success', 'Logo sekolah berhasil diperbarui!');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan logo');
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleSavePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim()) {
      showNotify('error', 'PIN tidak boleh kosong');
      return;
    }
    if (newPin !== confirmPin) {
      showNotify('error', 'Konfirmasi PIN tidak cocok');
      return;
    }
    setIsSavingPin(true);
    try {
      await onSavePin(newPin.trim());
      setNewPin('');
      setConfirmPin('');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan PIN');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleSaveQuizScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scoreVal = Number(quizScoreInput);
    if (isNaN(scoreVal) || scoreVal < 10 || scoreVal > 100) {
      showNotify('error', 'Persentase KKM kuis harus antara 10% sampai 100%');
      return;
    }
    setIsSavingQuizScore(true);
    try {
      await onSaveMinQuizScore(scoreVal);
      showNotify('success', `Standar KKM Kuis berhasil disimpan: minimal ${scoreVal}% dari jumlah soal!`);
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan persentase KKM kuis');
    } finally {
      setIsSavingQuizScore(false);
    }
  };

  const handleDownloadBackupJson = async () => {
    setIsBackingUpJson(true);
    try {
      const data = await exportAllSystemData();
      downloadJsonBackup(data);
      showNotify('success', 'Cadangan JSON berhasil diunduh!');
    } catch (err) {
      showNotify('error', 'Gagal membuat cadangan JSON');
    } finally {
      setIsBackingUpJson(false);
    }
  };

  const handleDownloadBackupExcel = async () => {
    setIsBackingUpExcel(true);
    try {
      const data = await exportAllSystemData();
      exportAllDataToExcel(data);
      showNotify('success', 'Cadangan Excel (multi-sheet) berhasil diunduh!');
    } catch (err) {
      showNotify('error', 'Gagal membuat cadangan Excel');
    } finally {
      setIsBackingUpExcel(false);
    }
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    try {
      let parsed: SystemBackupData;
      if (file.name.toLowerCase().endsWith('.json')) {
        parsed = await parseBackupJsonFile(file);
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        parsed = await parseBackupExcelFile(file);
      } else {
        throw new Error('Hanya mendukung format .json atau .xlsx');
      }
      setParsedRestoreData(parsed);
    } catch (err: any) {
      setParsedRestoreData(null);
      showNotify('error', err.message || 'Gagal membaca file cadangan');
    }
  };

  const handleExecuteRestore = async () => {
    if (!parsedRestoreData) return;
    if (restoreConfirmKeyword.trim().toUpperCase() !== 'RESTORE') {
      showNotify('error', 'Ketik kata "RESTORE" untuk konfirmasi');
      return;
    }
    setIsExecutingRestore(true);
    try {
      const res = await restoreSystemData(parsedRestoreData, restoreMode);
      await onRefreshData();
      showNotify(
        'success',
        `Pemulihan sukses! (${res.subjectsCount} mapel, ${res.categoriesCount} topik, ${res.materialsCount} materi, ${res.teachersCount} guru, ${res.studentsCount} siswa, ${res.progressCount} progres belajar, ${res.quizScoresCount} riwayat nilai kuis)`
      );
      setIsRestoreModalOpen(false);
      setRestoreFile(null);
      setParsedRestoreData(null);
      setRestoreConfirmKeyword('');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal memulihkan database');
    } finally {
      setIsExecutingRestore(false);
    }
  };

  const previewStats = parsedRestoreData ? {
    subjects: parsedRestoreData.subjects?.length || 0,
    categories: parsedRestoreData.categories?.length || 0,
    materials: parsedRestoreData.materials?.length || 0,
    teachers: parsedRestoreData.teachers?.length || 0,
    students: parsedRestoreData.students?.length || 0,
    progress: Object.keys(parsedRestoreData.studentProgress || {}).length,
    quizScores: (() => {
      if (parsedRestoreData.stats?.totalQuizScores !== undefined) {
        return parsedRestoreData.stats.totalQuizScores;
      }
      let count = 0;
      Object.values(parsedRestoreData.studentProgress || {}).forEach((p: any) => {
        const sKeys = Object.keys(p?.scores || {});
        const aKeys = Object.keys(p?.quizAttempts || {});
        count += new Set([...sKeys, ...aKeys]).size;
      });
      return count;
    })(),
  } : null;

  return (
    <div className="space-y-6">
      {/* Sub Tabs Navigation */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('cleaner')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'cleaner'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Pembersih Database</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('backup')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'backup'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Cadangan & Pemulihan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('branding')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'branding'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Logo & Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'security'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>PIN Admin</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('quiz')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'quiz'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Standar Kelulusan Kuis</span>
        </button>
      </div>

      {/* Sub Tab: Cleaner */}
      {activeSubTab === 'cleaner' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <span>Pembersih Relasi & Item Sampah Database</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Pindai materi/topik yatim piatu yang tidak terhubung dengan mata pelajaran aktif atau data siswa tidak valid
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onScanJunk}
                disabled={isScanningJunk}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningJunk ? 'animate-spin' : ''}`} />
                <span>{isScanningJunk ? 'Memindai...' : 'Pindai Database'}</span>
              </button>

              {junkReport && junkReport.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => onCleanJunk(true)}
                  disabled={isCleaningJunk}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isCleaningJunk ? 'Membersihkan...' : `Bersihkan (${junkReport.items.length}) Item`}</span>
                </button>
              )}
            </div>
          </div>

          {junkReport ? (
            junkReport.healthy ? (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-xs">Database Bersih & Optimal!</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Tidak ditemukan relasi putus atau materi yatim piatu.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2">
                <div className="font-bold text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Ditemukan {junkReport.totalJunkCount} item yang tidak valid:</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  {(junkReport?.items || []).map((item) => (
                    <div key={item.id} className="p-2.5 bg-white rounded-lg border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{item.title || item.id}</div>
                        {item.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                        )}
                      </div>
                      <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-mono text-[10px] self-start sm:self-center shrink-0">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-xs">
              Klik "Pindai Database" untuk menganalisis integritas relasi data sekolah
            </div>
          )}
        </div>
      )}

      {/* Sub Tab: Backup & Restore */}
      {activeSubTab === 'backup' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">
                  Pusat Cadangan & Pemulihan Sistem (Full Backup & Restore)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cadangkan dan pulihkan seluruh data sekolah secara menyeluruh—termasuk mata pelajaran, bab materi, akun guru, akun siswa, progres belajar per siswa, serta seluruh riwayat nilai kuis dan gamifikasi.
                </p>
              </div>
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-3">
            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>1. Ekspor & Unduh Cadangan Database</span>
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option JSON */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100 rounded-2xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                        <FileJson className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-sm text-slate-900">Cadangan Penuh JSON</span>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
                      Direkomendasikan
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Menyimpan seluruh relasi data dalam format JSON murni dengan presisi 100%: progres belajar, timestamps aktivitas, gamifikasi XP & lencana, catatan siswa, dan riwayat nilai kuis per materi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  disabled={isBackingUpJson}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileJson className="w-4 h-4" />
                  <span>{isBackingUpJson ? 'Menyiapkan Cadangan JSON...' : 'Unduh Cadangan JSON (.json)'}</span>
                </button>
              </div>

              {/* Option Excel */}
              <div className="p-4 bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-100 rounded-2xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-sm text-slate-900">Cadangan Multi-Sheet Excel</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                      8+ Sheet Tabuler
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Mengekspor data ke file Excel terpisah: Mapel, Topik, Materi, Guru, Siswa, Progres, Pengaturan, serta sheet khusus <strong>"Nilai & Kuis Siswa"</strong> untuk analisis dan rekap nilai per siswa.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBackupExcel}
                  disabled={isBackingUpExcel}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isBackingUpExcel ? 'Menyiapkan File Excel...' : 'Unduh Cadangan Excel (.xlsx)'}</span>
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Restore Section */}
          <div className="space-y-4">
            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. Pemulihan Sistem (Restore dari File Cadangan)</span>
            </h5>

            {!parsedRestoreData ? (
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-2xl p-6 transition-all text-center">
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <div className="font-bold text-sm text-slate-800">Pilih File Cadangan untuk Dipulihkan</div>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Mendukung file cadangan berformat <strong>.JSON</strong> atau <strong>.XLSX</strong> yang dihasilkan dari menu cadangan sistem ini.
                </p>
                <div className="mt-4 inline-block">
                  <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors inline-flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih File dari Komputer</span>
                    <input
                      type="file"
                      accept=".json,.xlsx,.xls"
                      onChange={handleRestoreFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-5">
                {/* File Header & Reset */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span>{restoreFile?.name}</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                          File Valid
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Ukuran: {Math.round((restoreFile?.size || 0) / 1024)} KB &bull; Tanggal: {parsedRestoreData.backupDate ? new Date(parsedRestoreData.backupDate).toLocaleString('id-ID') : 'Terkini'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRestoreFile(null);
                      setParsedRestoreData(null);
                      setRestoreConfirmKeyword('');
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Ganti File</span>
                  </button>
                </div>

                {/* Pratinjau Data Metrics */}
                <div>
                  <div className="font-bold text-xs text-slate-700 mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Ringkasan Data yang Akan Dipulihkan:</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-slate-500">Mata Pelajaran</div>
                      <div className="text-base font-extrabold text-indigo-600 mt-0.5">{previewStats?.subjects}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-slate-500">Topik / Bab</div>
                      <div className="text-base font-extrabold text-indigo-600 mt-0.5">{previewStats?.categories}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-slate-500">Materi Belajar</div>
                      <div className="text-base font-extrabold text-indigo-600 mt-0.5">{previewStats?.materials}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-slate-500">Akun Guru</div>
                      <div className="text-base font-extrabold text-emerald-600 mt-0.5">{previewStats?.teachers}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-slate-500">Akun Siswa</div>
                      <div className="text-base font-extrabold text-emerald-600 mt-0.5">{previewStats?.students}</div>
                    </div>
                    <div className="p-3 bg-white border border-amber-200 bg-amber-50/40 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-amber-800">Progres Siswa</div>
                      <div className="text-base font-extrabold text-amber-700 mt-0.5">{previewStats?.progress}</div>
                    </div>
                    <div className="p-3 bg-white border border-purple-200 bg-purple-50/40 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-purple-800">Nilai Kuis</div>
                      <div className="text-base font-extrabold text-purple-700 mt-0.5">{previewStats?.quizScores}</div>
                    </div>
                  </div>
                </div>

                {/* Mode Pemulihan */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">Pilih Metode Pemulihan Data:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      onClick={() => setRestoreMode('replace')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        restoreMode === 'replace'
                          ? 'bg-indigo-50/60 border-indigo-500 ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'replace'}
                        onChange={() => setRestoreMode('replace')}
                        className="mt-0.5 text-indigo-600 cursor-pointer"
                      />
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">Ganti Bersih (Clean Replace)</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Mengosongkan data lama di database sekolah dan menuliskan seluruh data dari file cadangan secara bersih. Direkomendasikan untuk sinkronisasi penuh.
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setRestoreMode('merge')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        restoreMode === 'merge'
                          ? 'bg-indigo-50/60 border-indigo-500 ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'merge'}
                        onChange={() => setRestoreMode('merge')}
                        className="mt-0.5 text-indigo-600 cursor-pointer"
                      />
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">Gabungkan (Merge Data)</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Mempertahankan materi & progres yang sudah ada, lalu memperbarui atau menyisipkan data dari file cadangan.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Safety Confirmation & Execute */}
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span className="font-bold text-xs">Konfirmasi Keamanan Pemulihan Database</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Tindakan ini akan memutakhirkan basis data sekolah pada Firestore Cloud. Untuk mencegah ketidaksengajaan, ketik kata <strong>RESTORE</strong> di bawah ini untuk mengaktifkan tombol pemulihan.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder='Ketik "RESTORE" di sini'
                      value={restoreConfirmKeyword}
                      onChange={(e) => setRestoreConfirmKeyword(e.target.value)}
                      className="w-full sm:w-64 py-2 px-3 bg-white border border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isExecutingRestore || restoreConfirmKeyword.trim().toUpperCase() !== 'RESTORE'}
                      className="w-full sm:w-auto px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isExecutingRestore ? 'animate-spin' : ''}`} />
                      <span>{isExecutingRestore ? 'Memulihkan Data & Menyelaraskan Peringkat...' : 'Mulai Pemulihan Sekarang'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub Tab: Branding */}
      {activeSubTab === 'branding' && (
        <form onSubmit={handleSaveLogoSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-indigo-600" />
              <span>Logo & Identitas Sekolah</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Atur URL logo sekolah untuk ditampilkan pada header portal siswa dan guru
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">URL Gambar Logo Sekolah</label>
            <input
              type="url"
              placeholder="https://contoh-sekolah.sch.id/logo.png"
              value={logoInput}
              onChange={(e) => setLogoInput(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingLogo}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingLogo ? 'Menyimpan...' : 'Simpan Logo'}
            </button>
          </div>
        </form>
      )}

      {/* Sub Tab: Security PIN */}
      {activeSubTab === 'security' && (
        <form onSubmit={handleSavePinSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 max-w-lg">
          <div>
            <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              <span>Ganti PIN Keamanan Super Admin</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              PIN ini digunakan untuk login ke portal kontrol admin utama
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PIN Baru (Angka/Karakter)</label>
              <input
                type="password"
                placeholder="Masukkan PIN baru"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Konfirmasi PIN Baru</label>
              <input
                type="password"
                placeholder="Ulangi PIN baru"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingPin}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingPin ? 'Menyimpan...' : 'Perbarui PIN'}
            </button>
          </div>
        </form>
      )}

      {/* Sub Tab: Quiz Settings */}
      {activeSubTab === 'quiz' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveQuizScoreSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 max-w-xl">
          <div>
            <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              <span>Standar Minimal Kelulusan Kuis AI (KKM Persentase)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Tentukan persentase minimal jawaban benar (default <strong>80%</strong>) dari berapapun jumlah soal yang dipilih guru (1 - 20 soal dari 30 bank soal) agar siswa dapat lulus kuis dan membuka materi berikutnya.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Persentase KKM Lulus (10% - 100%):
            </label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  value={quizScoreInput}
                  onChange={(e) => setQuizScoreInput(Number(e.target.value))}
                  className="w-32 py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">%</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[70, 75, 80, 85, 90].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuizScoreInput(preset)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      quizScoreInput === preset
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-extrabold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}% {preset === 80 && '(Default)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Simulasi Standar KKM {quizScoreInput}%:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                <li>Kuis 10 Soal: Minimal benar <strong>{Math.ceil((quizScoreInput / 100) * 10)}</strong> soal</li>
                <li>Kuis 15 Soal: Minimal benar <strong>{Math.ceil((quizScoreInput / 100) * 15)}</strong> soal</li>
                <li>Kuis 20 Soal: Minimal benar <strong>{Math.ceil((quizScoreInput / 100) * 20)}</strong> soal</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingQuizScore}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingQuizScore ? 'Menyimpan...' : 'Simpan Persentase KKM'}
            </button>
          </div>
        </form>

        {/* Audit & Auto-Heal Card for Quiz Scores */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 max-w-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                <span>Audit & Penyelarasan Nilai Kuis Siswa</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pindai dan perbaiki otomatis format nilai warisan (skala 1-10 vs 100%) dan selaraskan rekap kelulusan KKM siswa agar konsisten di seluruh aplikasi.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isAuditingQuiz || isHealingQuiz}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAuditingQuiz ? 'animate-spin' : ''}`} />
                <span>{isAuditingQuiz ? 'Memindai...' : 'Pindai Integritas'}</span>
              </button>

              {quizAuditReport && quizAuditReport.healableCount > 0 && (
                <button
                  type="button"
                  onClick={handleRunRepair}
                  disabled={isHealingQuiz || isAuditingQuiz}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isHealingQuiz ? 'animate-spin' : ''}`} />
                  <span>{isHealingQuiz ? 'Menyelaraskan...' : `Perbaiki (${quizAuditReport.healableCount}) Nilai`}</span>
                </button>
              )}
            </div>
          </div>

          {lastHealSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <strong>Penyelarasan Berhasil!</strong> Sebanyak {lastHealSummary.repairedCount} entri nilai kuis telah diperbaiki dan disinkronkan ke database.
              </div>
            </div>
          )}

          {quizAuditReport ? (
            quizAuditReport.totalDiscrepanciesFound === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-xs">Semua Data Nilai Sempurna!</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Tidak ada nilai kuis yang bermasalah atau format nilai yang tidak konsisten dari {quizAuditReport.totalStudentsScanned} siswa yang dipindai.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-3">
                <div className="font-bold text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>
                    Ditemukan {quizAuditReport.totalDiscrepanciesFound} catatan nilai yang perlu diselaraskan ({quizAuditReport.healableCount} dapat diperbaiki otomatis):
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 text-xs">
                  {quizAuditReport.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-lg border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-slate-800">
                          {item.studentName || item.studentId}
                        </span>
                        {item.studentClass && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                            {item.studentClass}
                          </span>
                        )}
                        <div className="text-slate-500 mt-0.5">{item.issue}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.proposedPercentage !== undefined && (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            → {item.proposedPercentage}%
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            item.action === 'healable'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.action === 'healable' ? 'Otomatis' : 'Review'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="p-5 text-center text-slate-400 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-xs">
              Klik "Pindai Integritas" untuk memeriksa apakah terdapat nilai kuis yang tersimpan dalam format lama atau tidak sinkron.
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
