import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  Calendar,
  Search,
  BookOpen,
  ArrowRight,
  Sparkles,
  Filter,
  FileText,
  Video,
  Presentation,
  CheckSquare,
} from 'lucide-react';
import { MaterialActivityLog, Subject, Category, Material, AuthSession } from '../types';
import { getSubjectIcon } from '../utils/subjectIcons';
import { normalizeCompletedMaterialIds } from '../utils/prerequisites';

interface StudentActivityLogProps {
  activityLogs: MaterialActivityLog[];
  completedMaterialTimestamps?: Record<string, string>;
  completedMaterialIds: string[];
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  onDirectOpenMaterial: (subjectId: string, categoryId: string, materialId: string) => void;
  authSession?: AuthSession | null;
}

// Indonesian Day & Month names
const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatIndonesianDateTime(isoString: string): { fullDate: string; time: string; relativeTime: string } {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return { fullDate: '-', time: '-', relativeTime: '-' };
    }
    const dayName = INDO_DAYS[date.getDay()];
    const day = date.getDate();
    const month = INDO_MONTHS[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const fullDate = `${dayName}, ${day} ${month} ${year}`;
    const time = `${hours}:${minutes} WIB`;

    // Relative time calculation
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHour / 24);

    let relativeTime = '';
    if (diffSec < 60) relativeTime = 'Baru saja';
    else if (diffMin < 60) relativeTime = `${diffMin} menit yang lalu`;
    else if (diffHour < 24) relativeTime = `${diffHour} jam yang lalu`;
    else if (diffDays === 1) relativeTime = 'Kemarin';
    else if (diffDays < 7) relativeTime = `${diffDays} hari yang lalu`;
    else relativeTime = `${day} ${month}`;

    return { fullDate, time, relativeTime };
  } catch {
    return { fullDate: '-', time: '-', relativeTime: '-' };
  }
}

function getMaterialTypeDetails(type?: string) {
  switch (type) {
    case 'youtube':
      return { label: 'Video YouTube', icon: Video, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    case 'drive_video':
      return { label: 'Video Drive', icon: Video, color: 'text-sky-600 bg-sky-50 border-sky-200' };
    case 'drive_pdf':
      return { label: 'Dokumen PDF', icon: FileText, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    case 'google_slides':
    case 'canva':
      return { label: 'Presentasi / Canva', icon: Presentation, color: 'text-purple-600 bg-purple-50 border-purple-200' };
    case 'google_forms':
      return { label: 'Google Form', icon: CheckSquare, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    case 'quiz':
      return { label: 'Kuis Interaktif', icon: Sparkles, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
    default:
      return { label: 'Materi Belajar', icon: BookOpen, color: 'text-slate-600 bg-slate-50 border-slate-200' };
  }
}

export const StudentActivityLog: React.FC<StudentActivityLogProps> = ({
  activityLogs = [],
  completedMaterialTimestamps = {},
  completedMaterialIds = [],
  subjects = [],
  categories = [],
  materials = [],
  onDirectOpenMaterial,
  authSession,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  // Build unified log entries ensuring all completed materials have a record even if completed earlier
  const unifiedLogs = useMemo(() => {
    // Start with explicitly saved logs
    const existingLogMap = new Map<string, MaterialActivityLog>();
    const safeCompletedIds = normalizeCompletedMaterialIds(completedMaterialIds);
    (activityLogs || []).forEach((log) => {
      if (log?.materialId && safeCompletedIds.includes(log.materialId)) {
        existingLogMap.set(log.materialId, log);
      }
    });

    // Also synthesize logs for any completed materials with timestamps that might not be in activityLogs array
    safeCompletedIds.forEach((matId) => {
      if (!existingLogMap.has(matId)) {
        const mat = (materials || []).find((m) => m.id === matId);
        if (mat) {
          const cat = (categories || []).find((c) => c.id === mat.categoryId);
          const subj = (subjects || []).find((s) => s.id === cat?.subjectId);
          const timestamp = (completedMaterialTimestamps || {})[matId] || mat.updatedAt || new Date().toISOString();
          existingLogMap.set(matId, {
            materialId: mat.id,
            materialTitle: mat.title,
            categoryId: cat?.id,
            categoryTitle: cat?.title,
            subjectId: subj?.id,
            subjectName: subj?.name,
            completedAt: timestamp,
            type: mat.type,
          });
        }
      }
    });

    const list = Array.from(existingLogMap.values());
    // Sort descending by completedAt timestamp (newest first)
    list.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return list;
  }, [activityLogs, completedMaterialIds, completedMaterialTimestamps, materials, categories, subjects]);

  // Filtered logs based on search and subject
  const filteredLogs = useMemo(() => {
    return unifiedLogs.filter((log) => {
      // Subject filter
      if (selectedSubjectFilter !== 'all') {
        const mat = materials.find((m) => m.id === log.materialId);
        const cat = categories.find((c) => c.id === (log.categoryId || mat?.categoryId));
        const effectiveSubjId = log.subjectId || cat?.subjectId;
        if (effectiveSubjId !== selectedSubjectFilter) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = log.materialTitle.toLowerCase().includes(q);
        const catMatch = (log.categoryTitle || '').toLowerCase().includes(q);
        const subjMatch = (log.subjectName || '').toLowerCase().includes(q);
        return titleMatch || catMatch || subjMatch;
      }

      return true;
    });
  }, [unifiedLogs, selectedSubjectFilter, searchQuery, materials, categories]);

  // Total unique active study days
  const activeDaysCount = useMemo(() => {
    const daySet = new Set<string>();
    unifiedLogs.forEach((log) => {
      try {
        const d = new Date(log.completedAt);
        if (!isNaN(d.getTime())) {
          daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      } catch {}
    });
    return daySet.size;
  }, [unifiedLogs]);

  // Most recent completed log
  const latestLog = unifiedLogs.length > 0 ? unifiedLogs[0] : null;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 text-white border border-indigo-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 flex items-center gap-1.5 backdrop-blur-xs">
                <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Riwayat Belajar Siswa</span>
              </span>
              {authSession?.student && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 truncate max-w-full">
                  {authSession.student.nama} (Kelas {authSession.student.kelas})
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight break-words">
              Aktivitas Penyelesaian Materi
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/80 font-medium mt-1 break-words">
              Catatan kronologis waktu dan tanggal Anda berhasil menyelesaikan modul materi dan latihan.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-white/15 text-center">
              <div className="text-base sm:text-2xl font-black text-amber-300">{unifiedLogs.length}</div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-300">Materi Tuntas</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-white/15 text-center">
              <div className="text-base sm:text-2xl font-black text-emerald-300">{activeDaysCount}</div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-300">Hari Belajar Aktif</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-white/15 text-center col-span-2 sm:col-span-1">
              <div className="text-xs sm:text-sm font-black text-cyan-300 truncate">
                {latestLog ? formatIndonesianDateTime(latestLog.completedAt).relativeTime : '-'}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-300">Aktivitas Terakhir</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari dalam riwayat aktivitas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
          />
        </div>

        {/* Subject Filter dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">Semua Mata Pelajaran ({(unifiedLogs || []).length})</option>
            {(subjects || []).map((s) => {
              const count = (unifiedLogs || []).filter((l) => {
                const mat = (materials || []).find((m) => m.id === l.materialId);
                const cat = (categories || []).find((c) => c.id === (l.categoryId || mat?.categoryId));
                return (l.subjectId || cat?.subjectId) === s.id;
              }).length;
              return (
                <option key={s.id} value={s.id}>
                  {s.name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Activity Timeline List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mx-auto mb-3 shadow-xs">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
            {searchQuery || selectedSubjectFilter !== 'all' ? 'Tidak Ada Riwayat yang Cocok' : 'Belum Ada Riwayat Aktivitas'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            {searchQuery || selectedSubjectFilter !== 'all'
              ? 'Coba ubah kata kunci pencarian atau pilih filter semua mata pelajaran.'
              : 'Selesaikan materi pembelajaran dengan menekan tombol "Tandai Selesai" di akhir modul untuk mencatat riwayat belajar Anda di sini.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(filteredLogs || []).map((log, idx) => {
            const mat = (materials || []).find((m) => m.id === log.materialId);
            const cat = (categories || []).find((c) => c.id === (log.categoryId || mat?.categoryId));
            const subj = (subjects || []).find((s) => s.id === (log.subjectId || cat?.subjectId));
            const effectiveSubjId = subj?.id || '';
            const effectiveCatId = cat?.id || '';
            const { fullDate, time, relativeTime } = formatIndonesianDateTime(log.completedAt);
            const typeInfo = getMaterialTypeDetails(log.type || mat?.type);
            const TypeIcon = typeInfo.icon;

            return (
              <div
                key={`${log.materialId}-${idx}`}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 p-3 sm:p-4.5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 group"
              >
                {/* Left info */}
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                  {/* Completion check icon */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs group-hover:scale-105 transition-transform">
                    <CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </div>

                  {/* Text details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {subj && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {getSubjectIcon(subj.icon, 'w-3 h-3')}
                          <span>{subj.name}</span>
                        </span>
                      )}
                      {cat && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <BookOpen className="w-3 h-3 text-slate-500" />
                          <span className="truncate max-w-[120px] sm:max-w-[150px]">{cat.title}</span>
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold border ${typeInfo.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        <span>{typeInfo.label}</span>
                      </span>
                    </div>

                    {/* Material title */}
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors break-words">
                      {log.materialTitle || mat?.title || 'Materi Pembelajaran'}
                    </h4>

                    {/* Timestamp info */}
                    <div className="flex items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-slate-500 font-medium pt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{fullDate}</span>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{time}</span>
                      </span>
                      <span className="text-indigo-600 font-bold hidden sm:inline">({relativeTime})</span>
                    </div>
                  </div>
                </div>

                {/* Right action button */}
                <div className="flex items-center justify-end sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (effectiveSubjId && effectiveCatId) {
                        onDirectOpenMaterial(effectiveSubjId, effectiveCatId, log.materialId);
                      }
                    }}
                    className="w-full sm:w-auto px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-extrabold transition-all duration-200 border border-indigo-200 hover:border-indigo-600 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs group/btn"
                  >
                    <span>Buka Materi</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
