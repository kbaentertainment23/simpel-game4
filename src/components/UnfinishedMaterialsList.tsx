import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  BookOpen,
  ArrowRight,
  Sparkles,
  Award,
  Filter,
  Search,
  CheckCircle2,
  FileText,
  Video,
  Presentation,
  CheckSquare,
} from 'lucide-react';
import { Subject, Category, Material, AuthSession } from '../types';
import { getSubjectIcon } from '../utils/subjectIcons';

interface UnfinishedMaterialsListProps {
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  completedMaterialIds: string[];
  onDirectOpenMaterial: (subjectId: string, categoryId: string, materialId: string) => void;
  authSession?: AuthSession | null;
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

export const UnfinishedMaterialsList: React.FC<UnfinishedMaterialsListProps> = ({
  subjects = [],
  categories = [],
  materials = [],
  completedMaterialIds = [],
  onDirectOpenMaterial,
  authSession,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  const safeCompletedIds = completedMaterialIds || [];
  const safeMaterials = materials || [];
  const safeCategories = categories || [];
  const safeSubjects = subjects || [];

  // List of all published materials that are not yet completed
  const unfinishedList = useMemo(() => {
    return safeMaterials
      .filter((m) => m && m.isPublished && !safeCompletedIds.includes(m.id))
      .map((mat) => {
        const cat = safeCategories.find((c) => c && c.id === mat.categoryId);
        const subj = safeSubjects.find((s) => s && s.id === cat?.subjectId);
        return {
          material: mat,
          category: cat,
          subject: subj,
        };
      })
      .filter((item) => item.category && item.subject);
  }, [safeMaterials, safeCompletedIds, safeCategories, safeSubjects]);

  // Filtered by subject and search
  const filteredList = useMemo(() => {
    return unfinishedList.filter(({ material, category, subject }) => {
      if (selectedSubjectFilter !== 'all' && subject?.id !== selectedSubjectFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (material?.title || '').toLowerCase().includes(q);
        const descMatch = (material?.description || '').toLowerCase().includes(q);
        const catMatch = (category?.title || '').toLowerCase().includes(q);
        const subjMatch = (subject?.name || '').toLowerCase().includes(q);
        return titleMatch || descMatch || catMatch || subjMatch;
      }
      return true;
    });
  }, [unfinishedList, selectedSubjectFilter, searchQuery]);

  const totalPublishedCount = safeMaterials.filter((m) => m && m.isPublished).length;
  const totalCompletedCount = safeMaterials.filter((m) => m && m.isPublished && safeCompletedIds.includes(m.id)).length;
  const progressPct = totalPublishedCount > 0 ? Math.round((totalCompletedCount / totalPublishedCount) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      
      {/* Header Alert Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white border border-rose-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/30 text-rose-200 border border-rose-400/40 flex items-center gap-1.5 backdrop-blur-xs">
                <AlertCircle className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
                <span>Daftar Tugas Pending</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-200 border border-amber-300/40">
                {unfinishedList.length} Belum Selesai
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Materi Belum Diselesaikan
            </h2>
            <p className="text-xs sm:text-sm text-rose-100/80 font-medium mt-1">
              Gunakan pintasan di bawah untuk langsung membuka dan menyelesaikan materi yang masih tersisa.
            </p>
          </div>

          {/* Quick Progress Box */}
          <div className="bg-slate-800/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-700/80 shrink-0 min-w-[200px] shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-slate-300">Progres Belajar</span>
              <span className="text-xs font-black text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-300/40">
                {progressPct}%
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/60 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[11px] font-extrabold text-slate-300 mt-1.5 text-right">
              {totalCompletedCount} dari {totalPublishedCount} Materi Selesai
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
            placeholder="Cari materi belum selesai..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
          />
        </div>

        {/* Subject Filter dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
          >
            <option value="all">Semua Mata Pelajaran ({(unfinishedList || []).length})</option>
            {(subjects || []).map((s) => {
              const count = (unfinishedList || []).filter((item) => item.subject?.id === s.id).length;
              return (
                <option key={s.id} value={s.id}>
                  {s.name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Material List */}
      {unfinishedList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-emerald-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-xs border border-emerald-100">
            <Award className="w-8 h-8 text-amber-500 animate-bounce" />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-1">
            Luar Biasa! Semua Materi Telah Selesai
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-2 leading-relaxed font-medium">
            Tidak ada materi yang tertinggal. Anda telah menuntaskan seluruh modul pembelajaran yang tersedia di kelas Anda.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold rounded-full text-xs border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
            <span>Tingkat Ketuntasan 100%</span>
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
          <p className="text-sm font-bold text-slate-600">Tidak ada materi yang sesuai dengan pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {(filteredList || []).map(({ material, category, subject }, idx) => {
            const typeInfo = getMaterialTypeDetails(material.type);
            const TypeIcon = typeInfo.icon;

            return (
              <div
                key={material.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-rose-300 p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 group relative overflow-hidden"
              >
                {/* Left accent bar */}
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-rose-500 group-hover:w-1.5 transition-all" />

                <div className="space-y-2 pl-1.5">
                  {/* Subject & Category tags */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {subject && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {getSubjectIcon(subject.icon || subject.name, 'w-3 h-3')}
                        <span>{subject.name}</span>
                      </span>
                    )}
                    {category && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <BookOpen className="w-3 h-3 text-slate-500" />
                        <span className="truncate max-w-[130px]">{category.title}</span>
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold border ${typeInfo.color}`}>
                      <TypeIcon className="w-3 h-3" />
                      <span>{typeInfo.label}</span>
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug group-hover:text-rose-600 transition-colors">
                      {material.title}
                    </h4>
                    {material.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-medium">
                        {material.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Action Shortcut */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 pl-1.5">
                  <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span>Belum Selesai</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (subject?.id && category?.id) {
                        onDirectOpenMaterial(subject.id, category.id, material.id);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-md group/btn"
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
