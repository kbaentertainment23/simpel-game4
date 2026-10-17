import React, { useMemo } from 'react';
import { BookOpen, Plus, Search, Edit2, Trash2, Layers, ArrowUpDown } from 'lucide-react';
import { Subject, Category, Material } from '../../types';
import { getSubjectIcon } from '../../utils/subjectIcons';

interface SubjectListViewProps {
  subjects: Subject[];
  categories: Category[];
  materials: Material[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: 'order' | 'name' | 'topics';
  onSortByChange: (sort: 'order' | 'name' | 'topics') => void;
  onOpenAddSubject: () => void;
  onOpenEditSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: string, subjectName: string) => void;
}

export const SubjectListView: React.FC<SubjectListViewProps> = ({
  subjects = [],
  categories = [],
  materials = [],
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  onOpenAddSubject,
  onOpenEditSubject,
  onDeleteSubject,
}) => {
  const filteredSubjects = useMemo(() => {
    let list = subjects.filter((s) => {
      return (
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });

    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'topics') {
      list = [...list].sort((a, b) => {
        const aCount = categories.filter((c) => c.subjectId === a.id).length;
        const bCount = categories.filter((c) => c.subjectId === b.id).length;
        return bCount - aCount;
      });
    } else {
      list = [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }

    return list;
  }, [subjects, categories, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              Master Mata Pelajaran
            </h3>
            <p className="text-xs text-slate-500">
              Kelola kurikulum mata pelajaran utama yang tersedia di sistem
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAddSubject}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Mata Pelajaran</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari mata pelajaran berdasarkan nama atau kode..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="order">Urutan Default</option>
              <option value="name">Nama (A-Z)</option>
              <option value="topics">Jumlah Bab Terbanyak</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Subjects */}
      {(filteredSubjects || []).length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <BookOpen className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold">Tidak ada mata pelajaran ditemukan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(filteredSubjects || []).map((s) => {
            const topicCount = (categories || []).filter((c) => c && c.subjectId === s.id).length;
            const matCount = (materials || []).filter((m) => m && m.subjectId === s.id).length;

            return (
              <div
                key={s.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex items-center justify-center">
                      {getSubjectIcon(s.icon || 'BookOpen', 'w-6 h-6')}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        id={`btn-edit-subject-${s.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditSubject(s);
                        }}
                        className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title="Edit Mapel"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        id={`btn-delete-subject-${s.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSubject(s.id, s.name);
                        }}
                        className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Mapel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-extrabold text-base text-slate-900 mb-1">{s.name}</h4>
                  {s.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{s.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-semibold">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{topicCount} Bab / Topik</span>
                  </span>
                  <span>{matCount} Bahan Ajar</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
