import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  X,
  Smartphone,
  Monitor,
  Calendar,
  Layers,
  Sparkles,
  Download
} from 'lucide-react';
import { StudentAccount, Subject, Material } from '../../types';
import { useMobileBackModal } from '../../utils/mobileNavigation';
import { useBodyScrollLock } from '../../utils/scrollLock';
import * as XLSX from 'xlsx';

export interface AntiCheatRecord {
  id: string;
  studentId: string;
  studentName: string;
  kelas: string;
  nisn?: string;
  materialId?: string;
  materialTitle?: string;
  violationsCount: number;
  maxViolations: number;
  violationHistory: string[];
  lastViolationTime?: string;
  isTerminated: boolean;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  createdAt?: string;
  updatedAt?: string;
}

interface AntiCheatLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentAccount[];
  materials?: Material[];
  customLogs?: AntiCheatRecord[];
}

export const AntiCheatLogsModal: React.FC<AntiCheatLogsModalProps> = ({
  isOpen,
  onClose,
  students = [],
  materials = [],
  customLogs = []
}) => {
  useMobileBackModal('anticheat-logs-modal', isOpen, onClose);
  useBodyScrollLock(isOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'violated' | 'clean' | 'terminated'>('all');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    (students || []).forEach((s) => {
      if (s?.kelas) set.add(s.kelas.trim());
    });
    return Array.from(set).sort();
  }, [students]);

  // Combine custom logs or generate structured monitoring data
  const processedLogs = useMemo(() => {
    if (customLogs && customLogs.length > 0) {
      return customLogs;
    }
    // Fallback if no raw anti-cheat logs collection, populate from student account roster
    return (students || []).map((s) => ({
      id: s.id,
      studentId: s.id,
      studentName: s.nama,
      kelas: s.kelas,
      nisn: s.nisn,
      violationsCount: 0,
      maxViolations: 3,
      violationHistory: [],
      isTerminated: false,
      deviceType: 'desktop' as const,
      updatedAt: s.updatedAt,
    }));
  }, [customLogs, students]);

  const filteredLogs = useMemo(() => {
    return processedLogs.filter((log) => {
      const matchesSearch =
        !searchQuery ||
        log.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.nisn && log.nisn.includes(searchQuery)) ||
        (log.kelas && log.kelas.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesClass =
        selectedClassFilter === 'all' ||
        log.kelas?.toLowerCase() === selectedClassFilter.toLowerCase();

      let matchesStatus = true;
      if (statusFilter === 'violated') {
        matchesStatus = log.violationsCount > 0 && !log.isTerminated;
      } else if (statusFilter === 'terminated') {
        matchesStatus = log.isTerminated;
      } else if (statusFilter === 'clean') {
        matchesStatus = log.violationsCount === 0;
      }

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [processedLogs, searchQuery, selectedClassFilter, statusFilter]);

  const stats = useMemo(() => {
    let clean = 0;
    let warning = 0;
    let terminated = 0;
    processedLogs.forEach((l) => {
      if (l.isTerminated) terminated++;
      else if (l.violationsCount > 0) warning++;
      else clean++;
    });
    return { clean, warning, terminated, total: processedLogs.length };
  }, [processedLogs]);

  const handleExportExcel = () => {
    try {
      const exportData = filteredLogs.map((log, idx) => ({
        No: idx + 1,
        'Nama Siswa': log.studentName,
        'Kelas': log.kelas || '-',
        'NIS': log.nisn || '-',
        'Jumlah Pelanggaran': log.violationsCount,
        'Batas Maksimal': log.maxViolations,
        'Status Ujian': log.isTerminated ? 'DIBLOKIR / DIDISKUALIFIKASI' : log.violationsCount > 0 ? 'Peringatan' : 'Tertib / Bersih',
        'Riwayat Pelanggaran': log.violationHistory.join(' | ') || 'Tidak ada pelanggaran',
        'Waktu Terakhir': log.lastViolationTime || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Log Anti-Cheat');
      XLSX.writeFile(workbook, `Log_AntiCheat_Siswa_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Failed to export anti-cheat logs:', err);
    }
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div 
        data-modal-scrollable="true"
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                Monitoring Log Anti-Cheat & Integritas Ujian
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Real-time
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Memantau perpindahan tab browser, keluar dari layar penuh, dan status integritas siswa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Header Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 sm:p-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 block">Siswa Tertib</span>
              <span className="text-sm sm:text-lg font-black text-emerald-600">{stats.clean}</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 block">Peringatan (1-2x)</span>
              <span className="text-sm sm:text-lg font-black text-amber-600">{stats.warning}</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 block">Diskualifikasi</span>
              <span className="text-sm sm:text-lg font-black text-rose-600">{stats.terminated}</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama siswa atau NIS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Kelas</option>
              {(uniqueClasses || []).map((c) => (
                <option key={c} value={c}>Kelas {c}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="clean">Hanya Tertib</option>
              <option value="violated">Pernah Melanggar</option>
              <option value="terminated">Didiskualifikasi</option>
            </select>
          </div>
        </div>

        {/* Table Content with high performance virtualization ready */}
        <div className="overflow-y-auto p-4 flex-1 space-y-2.5">
          {(filteredLogs || []).length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold">Tidak ada log aktivitas yang cocok dengan filter</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Siswa</th>
                    <th className="py-2.5 px-3">Kelas</th>
                    <th className="py-2.5 px-3 text-center">Status Integritas</th>
                    <th className="py-2.5 px-3 text-center">Pelanggaran</th>
                    <th className="py-2.5 px-3">Detail & Waktu Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(filteredLogs || []).map((log) => {
                    const isDanger = log.isTerminated;
                    const isWarn = log.violationsCount > 0 && !log.isTerminated;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{log.studentName}</div>
                          {log.nisn && <div className="text-[10px] text-slate-400 font-mono">NIS: {log.nisn}</div>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px]">
                            {log.kelas || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isDanger ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[10px]">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Diskualifikasi (3/3)
                            </span>
                          ) : isWarn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Peringatan ({log.violationsCount}/{log.maxViolations})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Tertib & Bersih
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span className={isDanger ? 'text-rose-600' : isWarn ? 'text-amber-600' : 'text-slate-400'}>
                            {log.violationsCount}x
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          {log.violationHistory.length > 0 ? (
                            <div className="space-y-0.5 max-w-xs text-slate-600">
                              <p className="truncate font-medium">{log.violationHistory[log.violationHistory.length - 1]}</p>
                              <span className="text-[10px] text-slate-400 block font-mono">{log.lastViolationTime || '-'}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Tidak ada catatan pelanggaran</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Total {filteredLogs.length} siswa terpantau
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
