import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { Subject, Category, Material } from '../../types';
import { getSubjectIcon } from '../../utils/subjectIcons';
import { DEFAULT_GRADES } from '../../lib/dataService';
import { extractGradeLevel } from '../../utils/classFilter';

interface CategoryListViewProps {
  categories: Category[];
  subjects: Subject[];
  materials: Material[];
  masterGrades?: Array<{ id: string; label: string; subLabel?: string }>;
  selectedSubjectFilter: string;
  onSelectSubjectFilter: (subjId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  collapsedSubjects: Record<string, boolean>;
  onToggleSubject: (subjId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpenAddCategory: (defaultSubjectId?: string, defaultGrade?: string) => void;
  onOpenEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string, categoryTitle: string) => void;
  onTogglePublish?: (category: Category) => void;
  onToggleLock?: (category: Category) => void;
  isTeacherRole?: boolean;
}

export const CategoryListView: React.FC<CategoryListViewProps> = ({
  categories = [],
  subjects = [],
  materials = [],
  masterGrades,
  selectedSubjectFilter,
  onSelectSubjectFilter,
  searchQuery,
  onSearchChange,
  collapsedSubjects,
  onToggleSubject,
  onExpandAll,
  onCollapseAll,
  onOpenAddCategory,
  onOpenEditCategory,
  onDeleteCategory,
  onToggleLock,
  isTeacherRole = false,
}) => {
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});

  // Dynamic available grades from masterGrades + any grade in categories
  const effectiveGrades = useMemo(() => {
    const map = new Map<string, { id: string; label: string; subLabel: string }>();

    const baseGrades = masterGrades && masterGrades.length > 0 ? masterGrades : DEFAULT_GRADES;
    (baseGrades || []).forEach((g) => {
      if (g && g.id) {
        map.set(g.id.toString().trim(), {
          id: g.id.toString().trim(),
          label: g.label || `Kelas ${g.id}`,
          subLabel: g.subLabel || '',
        });
      }
    });

    // Check if categories have any other distinct grade
    (categories || []).forEach((c) => {
      if (c && c.targetGrade && c.targetGrade !== 'all' && c.targetGrade !== 'umum') {
        const gradeLevel = extractGradeLevel(c.targetGrade);
        if (gradeLevel && gradeLevel !== 'all' && !map.has(gradeLevel)) {
          map.set(gradeLevel, {
            id: gradeLevel,
            label: `Kelas ${gradeLevel}`,
            subLabel: Number(gradeLevel) <= 6 ? 'Jenjang SD' : Number(gradeLevel) <= 9 ? 'Jenjang SMP' : 'SMA / SMK',
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.label.localeCompare(b.label);
    });
  }, [masterGrades, categories]);

  const toggleGradeCollapse = (key: string) => {
    setCollapsedGrades((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to match category targetGrade to a grade ID
  const isCategoryInGrade = (cat: Category, gradeId: string) => {
    const catGrade = extractGradeLevel(cat.targetGrade || 'all');
    if (gradeId === 'all') return true;
    if (gradeId === 'general') {
      return catGrade === 'all' || !cat.targetGrade || cat.targetGrade === 'all' || cat.targetGrade === 'umum';
    }
    return catGrade === gradeId || cat.targetGrade === gradeId;
  };

  // Filter categories by subject, search query, and grade filter
  const filteredCategories = useMemo(() => {
    return (categories || []).filter((c) => {
      if (!c) return false;
      const matchesSubj = selectedSubjectFilter === 'all' || c.subjectId === selectedSubjectFilter;
      const matchesSearch =
        !searchQuery ||
        (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesGrade =
        selectedGradeFilter === 'all'
          ? true
          : isCategoryInGrade(c, selectedGradeFilter);

      return matchesSubj && matchesSearch && matchesGrade;
    });
  }, [categories, selectedSubjectFilter, searchQuery, selectedGradeFilter]);

  // Group categories by Subject -> then inside subject, grouped by Grade
  const categoriesBySubjectAndGrade = useMemo(() => {
    const result: Record<
      string,
      {
        subject: Subject;
        totalCategories: number;
        byGrade: Array<{
          gradeId: string;
          gradeLabel: string;
          gradeSubLabel: string;
          categories: Category[];
        }>;
      }
    > = {};

    (subjects || []).forEach((s) => {
      if (!s || !s.id) return;

      const subjCats = (filteredCategories || []).filter((c) => (c.subjectId || 'informatika') === s.id);
      
      const gradeGroups: Array<{
        gradeId: string;
        gradeLabel: string;
        gradeSubLabel: string;
        categories: Category[];
      }> = [];

      // 1. Grade-specific groups (Kelas 7, Kelas 8, Kelas 9, etc.)
      effectiveGrades.forEach((g) => {
        if (selectedGradeFilter !== 'all' && selectedGradeFilter !== g.id) return;
        const matching = subjCats
          .filter((c) => isCategoryInGrade(c, g.id))
          .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        
        // Always show if selectedGradeFilter matches, or if there are categories or when viewing all without search
        if (matching.length > 0 || selectedGradeFilter === g.id || (!searchQuery && selectedSubjectFilter === s.id)) {
          gradeGroups.push({
            gradeId: g.id,
            gradeLabel: g.label,
            gradeSubLabel: g.subLabel,
            categories: matching,
          });
        }
      });

      // 2. General / All Grades group (Lintas Tingkat)
      if (selectedGradeFilter === 'all' || selectedGradeFilter === 'general') {
        const generalMatching = subjCats
          .filter((c) => isCategoryInGrade(c, 'general'))
          .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        
        if (generalMatching.length > 0 || selectedGradeFilter === 'general') {
          gradeGroups.push({
            gradeId: 'general',
            gradeLabel: 'Semua Jenjang / Umum',
            gradeSubLabel: 'Lintas Tingkat Kelas',
            categories: generalMatching,
          });
        }
      }

      result[s.id] = {
        subject: s,
        totalCategories: subjCats.length,
        byGrade: gradeGroups,
      };
    });

    return result;
  }, [subjects, filteredCategories, effectiveGrades, selectedGradeFilter, searchQuery, selectedSubjectFilter]);

  const getGradeTheme = (gradeId: string) => {
    switch (gradeId) {
      case '7':
        return {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          border: 'border-emerald-200/80',
          headerBg: 'bg-emerald-50/50',
          iconBg: 'bg-emerald-100 text-emerald-700',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        };
      case '8':
        return {
          badge: 'bg-violet-50 text-violet-700 border-violet-200',
          border: 'border-violet-200/80',
          headerBg: 'bg-violet-50/50',
          iconBg: 'bg-violet-100 text-violet-700',
          btnBg: 'bg-violet-600 hover:bg-violet-700 text-white',
        };
      case '9':
        return {
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          border: 'border-indigo-200/80',
          headerBg: 'bg-indigo-50/50',
          iconBg: 'bg-indigo-100 text-indigo-700',
          btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        };
      case '10':
      case '11':
      case '12':
        return {
          badge: 'bg-sky-50 text-sky-700 border-sky-200',
          border: 'border-sky-200/80',
          headerBg: 'bg-sky-50/50',
          iconBg: 'bg-sky-100 text-sky-700',
          btnBg: 'bg-sky-600 hover:bg-sky-700 text-white',
        };
      default:
        return {
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          border: 'border-slate-200',
          headerBg: 'bg-slate-50',
          iconBg: 'bg-slate-200 text-slate-700',
          btnBg: 'bg-slate-700 hover:bg-slate-800 text-white',
        };
    }
  };

  const getGradeBadgeLabel = (targetGrade?: string) => {
    if (!targetGrade || targetGrade === 'all' || targetGrade === 'umum') {
      return 'Semua Tingkat';
    }
    const clean = extractGradeLevel(targetGrade);
    const found = effectiveGrades.find((g) => g.id === clean);
    return found ? found.label : `Kelas ${clean}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              Bab & Topik Pembelajaran
            </h3>
            <p className="text-xs text-slate-500">
              Kelola topik yang terpisah rapi berdasarkan tingkat/jenjang kelas (Kelas 7, 8, 9, dst.)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              onOpenAddCategory(
                selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined,
                selectedGradeFilter !== 'all' && selectedGradeFilter !== 'general' ? selectedGradeFilter : undefined
              )
            }
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bab / Topik</span>
          </button>
        </div>
      </div>

      {/* Grade Quick Filter Bar & Search Toolbar (Hidden in Teacher Dashboard) */}
      {!isTeacherRole && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari judul bab, topik, atau deskripsi..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Subject Filter & Global Collapse/Expand */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <select
                value={selectedSubjectFilter}
                onChange={(e) => onSelectSubjectFilter(e.target.value)}
                className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Semua Mata Pelajaran</option>
                {(subjects || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onExpandAll}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Buka Semua Grup"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onCollapseAll}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Tutup Semua Grup"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grade Filter Tabs / Pills */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Pisahkan Tingkat:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedGradeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                selectedGradeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Tingkat
            </button>

            {(effectiveGrades || []).map((g) => {
              const isSelected = selectedGradeFilter === g.id;
              const countForGrade = (categories || []).filter((c) => isCategoryInGrade(c, g.id)).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGradeFilter(g.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{g.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {countForGrade}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedGradeFilter('general')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedGradeFilter === 'general'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Semua Jenjang / Umum</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedGradeFilter === 'general' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {(categories || []).filter((c) => isCategoryInGrade(c, 'general')).length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Accordion Grouped by Subject -> Divided strictly by Grade */}
      <div className="space-y-5">
        {(subjects || []).map((s) => {
          if (selectedSubjectFilter !== 'all' && selectedSubjectFilter !== s.id) return null;
          const subjData = categoriesBySubjectAndGrade[s.id];
          if (!subjData) return null;

          if (subjData.totalCategories === 0 && searchQuery) return null;

          const isSubjCollapsed = !!collapsedSubjects[s.id];

          return (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
            >
              {/* Subject Group Header */}
              <div
                onClick={() => onToggleSubject(s.id)}
                className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white text-indigo-600 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center">
                    {getSubjectIcon(s.icon || 'BookOpen', 'w-5 h-5')}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">{s.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      {subjData.totalCategories} Bab / Topik Terdaftar
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSubjCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Subject Content: Grade-Separated Containers */}
              {!isSubjCollapsed && (
                <div className="p-4 sm:p-5 space-y-5">
                  {subjData.byGrade.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
                      Belum ada bab/topik yang terdaftar pada mata pelajaran ini
                    </div>
                  ) : (
                    subjData.byGrade.map((gradeGroup) => {
                      const theme = getGradeTheme(gradeGroup.gradeId);
                      const collapseKey = `${s.id}_grade_${gradeGroup.gradeId}`;
                      const isGradeCollapsed = !!collapsedGrades[collapseKey];

                      return (
                        <div
                          key={gradeGroup.gradeId}
                          className={`rounded-xl border ${theme.border} overflow-hidden bg-white shadow-2xs`}
                        >
                          {/* Grade Section Header */}
                          <div
                            onClick={() => toggleGradeCollapse(collapseKey)}
                            className={`px-4 py-3 ${theme.headerBg} border-b ${theme.border} flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center font-extrabold text-xs shrink-0`}
                              >
                                <GraduationCap className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                                    {gradeGroup.gradeLabel}
                                  </span>
                                  {gradeGroup.gradeSubLabel && (
                                    <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                                      • {gradeGroup.gradeSubLabel}
                                    </span>
                                  )}
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${theme.badge}`}
                                  >
                                    {gradeGroup.categories.length} Topik
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenAddCategory(
                                    s.id,
                                    gradeGroup.gradeId !== 'general' ? gradeGroup.gradeId : 'all'
                                  );
                                }}
                                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${theme.btnBg}`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Bab {gradeGroup.gradeId !== 'general' ? gradeGroup.gradeLabel : ''}</span>
                              </button>

                              <button
                                type="button"
                                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              >
                                {isGradeCollapsed ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronUp className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Grade Topics List */}
                          {!isGradeCollapsed && (
                            <div className="divide-y divide-slate-100 p-2 sm:p-3">
                              {gradeGroup.categories.length === 0 ? (
                                <div className="py-5 text-center text-slate-400 text-xs font-semibold">
                                  Belum ada topik untuk {gradeGroup.gradeLabel}.
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenAddCategory(
                                        s.id,
                                        gradeGroup.gradeId !== 'general' ? gradeGroup.gradeId : 'all'
                                      )
                                    }
                                    className="text-indigo-600 font-bold ml-1 hover:underline cursor-pointer"
                                  >
                                    Buat bab sekarang
                                  </button>
                                </div>
                              ) : (
                                gradeGroup.categories.map((c) => {
                                  const matCount = (materials || []).filter(
                                    (m) => m && m.categoryId === c.id
                                  ).length;

                                  return (
                                    <div
                                      key={c.id}
                                      className="py-3 px-2 sm:px-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 rounded-xl transition-colors"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                          {c.order ?? '•'}
                                        </div>

                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                                              {c.title}
                                            </span>

                                            <span
                                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${theme.badge}`}
                                            >
                                              {getGradeBadgeLabel(c.targetGrade)}
                                            </span>

                                            {c.isPublished === false && (
                                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                                                Draft
                                              </span>
                                            )}

                                            {c.requirePreviousCompleted ? (
                                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                <span>Terkunci</span>
                                              </span>
                                            ) : (
                                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold flex items-center gap-1">
                                                <Unlock className="w-3 h-3" />
                                                <span>Bebas</span>
                                              </span>
                                            )}
                                          </div>

                                          {c.description && (
                                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                              {c.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                                          {matCount} Bahan Ajar
                                        </span>

                                        <div className="flex items-center gap-1">
                                          {onToggleLock && (
                                            <button
                                              type="button"
                                              id={`btn-toggle-lock-category-${c.id}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleLock(c);
                                              }}
                                              className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                                                c.requirePreviousCompleted
                                                  ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                              }`}
                                              title={
                                                c.requirePreviousCompleted
                                                  ? 'Topik Terkunci: Klik untuk Buka Bebas (Siswa bebas akses tanpa syarat)'
                                                  : 'Topik Terbuka Bebas: Klik untuk Kunci (Siswa wajib selesaikan topik sebelumnya)'
                                              }
                                            >
                                              {c.requirePreviousCompleted ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            id={`btn-edit-category-${c.id}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenEditCategory(c);
                                            }}
                                            className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer border border-slate-200"
                                            title="Edit Bab"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            id={`btn-delete-category-${c.id}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeleteCategory(c.id, c.title);
                                            }}
                                            className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-slate-200"
                                            title="Hapus Bab"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
