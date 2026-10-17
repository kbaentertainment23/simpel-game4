import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Sparkles,
  Trophy,
  Layers,
  ExternalLink,
  Copy,
  Check,
  MoreVertical,
} from 'lucide-react';
import { Subject, Category, Material, MaterialType } from '../../types';
import { getSubjectIcon } from '../../utils/subjectIcons';
import { DEFAULT_GRADES } from '../../lib/dataService';
import { extractGradeLevel } from '../../utils/classFilter';

interface MaterialListViewProps {
  materials: Material[];
  categories: Category[];
  subjects: Subject[];
  masterGrades?: Array<{ id: string; label: string; subLabel?: string }>;
  selectedSubjectFilter: string;
  onSelectSubjectFilter: (subjId: string) => void;
  selectedCategoryFilter: string;
  onSelectCategoryFilter: (catId: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  collapsedSubjects: Record<string, boolean>;
  collapsedCategories: Record<string, boolean>;
  onToggleSubject: (subjId: string) => void;
  onToggleCategory: (catId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpenAddMaterial: (defaultSubjectId?: string, defaultCategoryId?: string, defaultGrade?: string) => void;
  onOpenEditMaterial: (material: Material) => void;
  onDeleteMaterial: (materialId: string, materialTitle: string) => void;
  onToggleLock?: (material: Material) => void;
  isTeacherRole?: boolean;
}

export const MaterialListView: React.FC<MaterialListViewProps> = ({
  materials = [],
  categories = [],
  subjects = [],
  masterGrades,
  selectedSubjectFilter,
  onSelectSubjectFilter,
  selectedCategoryFilter,
  onSelectCategoryFilter,
  typeFilter,
  onTypeFilterChange,
  searchQuery,
  onSearchChange,
  collapsedSubjects,
  collapsedCategories,
  onToggleSubject,
  onToggleCategory,
  onExpandAll,
  onCollapseAll,
  onOpenAddMaterial,
  onOpenEditMaterial,
  onDeleteMaterial,
  onToggleLock,
  isTeacherRole = false,
}) => {
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});
  const [activeDropdownMatId, setActiveDropdownMatId] = useState<string | null>(null);
  const [copiedMatId, setCopiedMatId] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdownMatId(null);
    };
    if (activeDropdownMatId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeDropdownMatId]);

  // Copy material link helper
  const handleCopyLink = async (m: Material) => {
    const urlToCopy = m.originalUrl || m.embedUrl || `${window.location.origin}/?material=${m.id}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = urlToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedMatId(m.id);
      setTimeout(() => {
        setCopiedMatId((prev) => (prev === m.id ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy material link:', err);
    }
  };

  // Category map for quick lookup
  const categoriesMap = useMemo(() => {
    const map = new Map<string, Category>();
    (categories || []).forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // Dynamic available grades from masterGrades + any grade in categories or materials
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

    // Check categories
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

    // Check materials
    (materials || []).forEach((m) => {
      if (m && m.targetGrade && m.targetGrade !== 'all' && m.targetGrade !== 'umum') {
        const gradeLevel = extractGradeLevel(m.targetGrade);
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
  }, [masterGrades, categories, materials]);

  const toggleGradeCollapse = (key: string) => {
    setCollapsedGrades((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to determine effective grade of a material
  const getMaterialGrade = (m: Material): string => {
    if (m.targetGrade && m.targetGrade !== 'all' && m.targetGrade !== 'umum') {
      return extractGradeLevel(m.targetGrade);
    }
    const parentCat = categoriesMap.get(m.categoryId);
    if (parentCat?.targetGrade && parentCat.targetGrade !== 'all' && parentCat.targetGrade !== 'umum') {
      return extractGradeLevel(parentCat.targetGrade);
    }
    return 'all';
  };

  // Filter materials based on search, subject, category, type, and grade
  const filteredMaterials = useMemo(() => {
    return (materials || []).filter((m) => {
      if (!m) return false;
      const parentCat = categoriesMap.get(m.categoryId);
      const matSubjId = parentCat?.subjectId || (m as any).subjectId || 'informatika';

      const matchesSubj = selectedSubjectFilter === 'all' || matSubjId === selectedSubjectFilter;
      const matchesCat = selectedCategoryFilter === 'all' || m.categoryId === selectedCategoryFilter;
      const matchesType = typeFilter === 'all' || m.type === typeFilter;
      const matchesSearch =
        !searchQuery ||
        (m.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matGrade = getMaterialGrade(m);
      let matchesGrade = true;
      if (selectedGradeFilter !== 'all') {
        if (selectedGradeFilter === 'general') {
          matchesGrade = matGrade === 'all';
        } else {
          matchesGrade = matGrade === selectedGradeFilter;
        }
      }

      return matchesSubj && matchesCat && matchesType && matchesSearch && matchesGrade;
    });
  }, [materials, categoriesMap, selectedSubjectFilter, selectedCategoryFilter, typeFilter, searchQuery, selectedGradeFilter]);

  // Group materials by Subject -> then by Grade -> then by Category
  const groupedDataBySubject = useMemo(() => {
    const result: Record<
      string,
      {
        subject: Subject;
        totalMaterials: number;
        byGrade: Array<{
          gradeId: string;
          gradeLabel: string;
          gradeSubLabel: string;
          totalCount: number;
          categoriesWithMaterials: Array<{
            category: Category;
            materials: Material[];
          }>;
        }>;
      }
    > = {};

    (subjects || []).forEach((s) => {
      if (!s || !s.id) return;
      const subjCats = (categories || []).filter((c) => (c.subjectId || 'informatika') === s.id);
      const subjCatIds = new Set(subjCats.map((c) => c.id));

      const subjMats = (filteredMaterials || []).filter(
        (m) => subjCatIds.has(m.categoryId) || (m as any).subjectId === s.id
      );

      const gradeGroups: Array<{
        gradeId: string;
        gradeLabel: string;
        gradeSubLabel: string;
        totalCount: number;
        categoriesWithMaterials: Array<{
          category: Category;
          materials: Material[];
        }>;
      }> = [];

      // 1. Specific Grades (Kelas 7, Kelas 8, Kelas 9, etc.)
      effectiveGrades.forEach((g) => {
        if (selectedGradeFilter !== 'all' && selectedGradeFilter !== g.id) return;

        const gradeMats = subjMats.filter((m) => getMaterialGrade(m) === g.id);

        // Find categories that either belong to this grade or have materials for this grade
        const matchedCats: Array<{ category: Category; materials: Material[] }> = [];

        subjCats.forEach((c) => {
          const catGrade = extractGradeLevel(c.targetGrade || 'all');
          const isCatForThisGrade = catGrade === g.id;
          const matsForCat = gradeMats.filter((m) => m.categoryId === c.id);

          if (matsForCat.length > 0 || isCatForThisGrade) {
            matchedCats.push({
              category: c,
              materials: matsForCat.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
            });
          }
        });

        if (matchedCats.length > 0 || selectedGradeFilter === g.id || (!searchQuery && selectedSubjectFilter === s.id)) {
          gradeGroups.push({
            gradeId: g.id,
            gradeLabel: g.label,
            gradeSubLabel: g.subLabel,
            totalCount: gradeMats.length,
            categoriesWithMaterials: matchedCats,
          });
        }
      });

      // 2. General / Lintas Jenjang Grade
      if (selectedGradeFilter === 'all' || selectedGradeFilter === 'general') {
        const generalMats = subjMats.filter((m) => getMaterialGrade(m) === 'all');
        const matchedCats: Array<{ category: Category; materials: Material[] }> = [];

        subjCats.forEach((c) => {
          const catGrade = extractGradeLevel(c.targetGrade || 'all');
          const isCatGeneral = catGrade === 'all';
          const matsForCat = generalMats.filter((m) => m.categoryId === c.id);

          if (matsForCat.length > 0 || (isCatGeneral && selectedGradeFilter === 'general')) {
            matchedCats.push({
              category: c,
              materials: matsForCat.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
            });
          }
        });

        if (matchedCats.length > 0 || selectedGradeFilter === 'general') {
          gradeGroups.push({
            gradeId: 'general',
            gradeLabel: 'Semua Jenjang / Lintas Tingkat',
            gradeSubLabel: 'Materi Umum / Fleksibel',
            totalCount: generalMats.length,
            categoriesWithMaterials: matchedCats,
          });
        }
      }

      result[s.id] = {
        subject: s,
        totalMaterials: subjMats.length,
        byGrade: gradeGroups,
      };
    });

    return result;
  }, [subjects, categories, filteredMaterials, effectiveGrades, selectedGradeFilter, searchQuery, selectedSubjectFilter]);

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

  const getTypeBadge = (type: MaterialType) => {
    switch (type) {
      case 'video':
      case 'youtube':
        return (
          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
            Video
          </span>
        );
      case 'canva':
        return (
          <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded text-[10px] font-bold">
            Canva
          </span>
        );
      case 'pdf':
        return (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
            PDF
          </span>
        );
      case 'gdrive':
        return (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
            Dokumen / Slide
          </span>
        );
      case 'gform':
        return (
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
            Google Form
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded text-[10px] font-bold">
            {type}
          </span>
        );
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
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              Direktori Bahan Ajar & Modul
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bahan ajar terpisah rapi per tingkat kelas (Kelas 7, Kelas 8, Kelas 9, dst.)
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-add-material-main-cta"
          onClick={() =>
            onOpenAddMaterial(
              selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined,
              selectedCategoryFilter !== 'all' ? selectedCategoryFilter : undefined,
              selectedGradeFilter !== 'all' && selectedGradeFilter !== 'general' ? selectedGradeFilter : undefined
            )
          }
          className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/50 cursor-pointer min-h-[44px] shrink-0 active:scale-[0.99]"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Tambah Bahan Ajar</span>
        </button>
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
                placeholder="Cari judul materi, topik, atau deskripsi..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Filters & Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedSubjectFilter}
                onChange={(e) => {
                  onSelectSubjectFilter(e.target.value);
                  onSelectCategoryFilter('all');
                }}
                className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Semua Mapel</option>
                {(subjects || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => onSelectCategoryFilter(e.target.value)}
                className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Semua Bab</option>
                {(categories || [])
                  .filter((c) => selectedSubjectFilter === 'all' || (c.subjectId || 'informatika') === selectedSubjectFilter)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => onTypeFilterChange(e.target.value)}
                className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Semua Tipe</option>
                <option value="video">Video</option>
                <option value="slide">Slide / Dokumen</option>
                <option value="pdf">PDF</option>
                <option value="quiz">Mini Kuis</option>
                <option value="gform">Google Form</option>
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

          {/* Grade Quick Filter Bar */}
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
              const countForGrade = (materials || []).filter((m) => getMaterialGrade(m) === g.id).length;
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
                {(materials || []).filter((m) => getMaterialGrade(m) === 'all').length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Accordion Grouped by Subject -> Then Divided Strictly by Grade */}
      <div className="space-y-5">
        {(subjects || []).map((s) => {
          if (selectedSubjectFilter !== 'all' && selectedSubjectFilter !== s.id) return null;
          const subjData = groupedDataBySubject[s.id];
          if (!subjData) return null;

          if (subjData.totalMaterials === 0 && searchQuery) return null;

          const isSubjCollapsed = !!collapsedSubjects[s.id];

          return (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs transition-all"
            >
              {/* Subject Header */}
              <div
                onClick={() => onToggleSubject(s.id)}
                className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors rounded-t-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white text-indigo-600 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center">
                    {getSubjectIcon(s.icon || 'BookOpen', 'w-5 h-5')}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">{s.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      {subjData.totalMaterials} Bahan Ajar Terdaftar
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
                      Belum ada bahan ajar yang terdaftar pada mata pelajaran ini
                    </div>
                  ) : (
                    subjData.byGrade.map((gradeGroup) => {
                      const theme = getGradeTheme(gradeGroup.gradeId);
                      const collapseKey = `${s.id}_mat_grade_${gradeGroup.gradeId}`;
                      const isGradeCollapsed = !!collapsedGrades[collapseKey];

                      return (
                        <div
                          key={gradeGroup.gradeId}
                          className={`rounded-xl border ${theme.border} bg-white shadow-2xs`}
                        >
                          {/* Grade Section Header */}
                          <div
                            onClick={() => toggleGradeCollapse(collapseKey)}
                            className={`px-4 py-3 ${theme.headerBg} border-b ${theme.border} flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity rounded-t-xl`}
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
                                    {gradeGroup.totalCount} Bahan Ajar
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstCat = gradeGroup.categoriesWithMaterials[0]?.category;
                                  onOpenAddMaterial(
                                    s.id,
                                    firstCat?.id,
                                    gradeGroup.gradeId !== 'general' ? gradeGroup.gradeId : 'all'
                                  );
                                }}
                                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${theme.btnBg}`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah di {gradeGroup.gradeLabel}</span>
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

                          {/* Grade Content: Categories and their Materials */}
                          {!isGradeCollapsed && (
                            <div className="p-3 space-y-3">
                              {gradeGroup.categoriesWithMaterials.length === 0 ? (
                                <div className="py-5 text-center text-slate-400 text-xs font-semibold">
                                  Belum ada bahan ajar untuk {gradeGroup.gradeLabel}.
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenAddMaterial(
                                        s.id,
                                        undefined,
                                        gradeGroup.gradeId !== 'general' ? gradeGroup.gradeId : 'all'
                                      )
                                    }
                                    className="text-indigo-600 font-bold ml-1 hover:underline cursor-pointer"
                                  >
                                    Tambah sekarang
                                  </button>
                                </div>
                              ) : (
                                gradeGroup.categoriesWithMaterials.map(({ category: c, materials: catMats }) => {
                                  if (selectedCategoryFilter !== 'all' && selectedCategoryFilter !== c.id) return null;
                                  // Default collapsed (closed) initially so only topics are shown, expand if explicitly false or searching
                                  const isCatCollapsed = searchQuery.trim() ? !!collapsedCategories[c.id] : (collapsedCategories[c.id] !== false);

                                  return (
                                    <div
                                      key={c.id}
                                      className={`transition-all duration-200 ${
                                        !isCatCollapsed
                                          ? 'border-2 border-blue-600 bg-white rounded-2xl shadow-md shadow-blue-100/50 ring-4 ring-blue-500/10'
                                          : 'border border-slate-200/90 rounded-xl bg-white shadow-2xs hover:border-blue-300'
                                      }`}
                                    >
                                      {/* Category Header within this Grade */}
                                      <div
                                        onClick={() => onToggleCategory(c.id)}
                                        className={`p-3 transition-all duration-200 flex items-center justify-between cursor-pointer select-none ${
                                          !isCatCollapsed
                                            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-b border-blue-700/80 rounded-t-[14px] shadow-xs'
                                            : 'bg-slate-50/80 hover:bg-blue-50/50 text-slate-800 rounded-xl'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                              !isCatCollapsed
                                                ? 'bg-white/20 border border-white/30 text-white shadow-2xs'
                                                : 'bg-slate-100 border border-slate-200 text-slate-500'
                                            }`}
                                          >
                                            <Layers className="w-4 h-4" />
                                          </div>
                                          <span
                                            className={`truncate ${
                                              !isCatCollapsed
                                                ? 'font-black text-xs sm:text-sm text-white tracking-wide'
                                                : 'font-bold text-xs sm:text-sm text-slate-800'
                                            }`}
                                          >
                                            {c.title}
                                          </span>
                                          <span
                                            className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                                              !isCatCollapsed
                                                ? 'bg-white/20 text-white border border-white/25'
                                                : 'text-slate-500 bg-slate-100'
                                            }`}
                                          >
                                            {catMats.length} materi
                                          </span>

                                          {!isCatCollapsed && (
                                            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-slate-950 uppercase tracking-wide shrink-0 shadow-2xs">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-900 animate-pulse" />
                                              Sedang Dibuka
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenAddMaterial(
                                                s.id,
                                                c.id,
                                                gradeGroup.gradeId !== 'general' ? gradeGroup.gradeId : 'all'
                                              );
                                            }}
                                            className={`px-2.5 py-1 font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs ${
                                              !isCatCollapsed
                                                ? 'bg-white hover:bg-blue-50 text-blue-700 border border-white'
                                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                            }`}
                                          >
                                            <Plus className={`w-3.5 h-3.5 ${!isCatCollapsed ? 'text-blue-700 stroke-[2.5]' : 'text-indigo-600'}`} />
                                            <span>Materi Baru</span>
                                          </button>

                                          <div
                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors ${
                                              !isCatCollapsed
                                                ? 'text-white bg-white/15 hover:bg-white/25'
                                                : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                            }`}
                                          >
                                            <span className="hidden sm:inline">
                                              {!isCatCollapsed ? 'Tutup' : 'Buka'}
                                            </span>
                                            {!isCatCollapsed ? (
                                              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4" />
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Materials list in this Category */}
                                      {!isCatCollapsed && (
                                        <div className="divide-y divide-slate-100 p-2.5 sm:p-3 bg-blue-50/15 rounded-b-[14px]">
                                          {catMats.length === 0 ? (
                                            <div className="text-center text-slate-500 text-xs py-5 font-semibold bg-white/70 rounded-xl border border-dashed border-blue-200">
                                              Belum ada bahan ajar di bab ini untuk {gradeGroup.gradeLabel}.
                                            </div>
                                          ) : (
                                            catMats.map((m) => {
                                              const isDropdownOpen = activeDropdownMatId === m.id;

                                              return (
                                                <div
                                                  key={m.id}
                                                  className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-colors border border-transparent hover:border-slate-200/80 ${
                                                    isDropdownOpen ? 'relative z-30' : 'relative z-0'
                                                  }`}
                                                >
                                                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                                  <div className="shrink-0 mt-0.5 sm:mt-0">{getTypeBadge(m.type)}</div>
                                                  <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                                        {m.title}
                                                      </span>

                                                      <span
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${theme.badge}`}
                                                      >
                                                        {getGradeBadgeLabel(m.targetGrade || c.targetGrade)}
                                                      </span>

                                                      {m.isPublished === false && (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">
                                                          Draft
                                                        </span>
                                                      )}

                                                      {m.requirePreviousCompleted ? (
                                                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10px] font-bold flex items-center gap-1" title="Terkunci: Siswa wajib lulus kuis KKM materi sebelumnya">
                                                          <Lock className="w-3 h-3 text-purple-600" />
                                                          <span className="hidden sm:inline">Terkunci</span>
                                                        </span>
                                                      ) : (
                                                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center gap-1" title="Bebas: Siswa bebas membuka tanpa kuis">
                                                          <Unlock className="w-3 h-3 text-emerald-600" />
                                                          <span className="hidden sm:inline">Bebas</span>
                                                        </span>
                                                      )}

                                                      {m.interactiveConfig?.enableGamification && (
                                                        <span className="p-0.5 text-amber-500" title="Gamifikasi Aktif">
                                                          <Trophy className="w-3.5 h-3.5" />
                                                        </span>
                                                      )}

                                                      {m.interactiveConfig?.enableAITutor && (
                                                        <span className="p-0.5 text-indigo-500" title="AI Tutor Aktif">
                                                          <Sparkles className="w-3.5 h-3.5" />
                                                        </span>
                                                      )}
                                                    </div>

                                                    {m.description && (
                                                      <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 mt-0.5">
                                                        {m.description}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>

                                                {/* Action Controls Group */}
                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                                  {/* Quick Lock / Unlock Toggle */}
                                                  {onToggleLock && (
                                                    <button
                                                      type="button"
                                                      id={`btn-toggle-lock-material-${m.id}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleLock(m);
                                                      }}
                                                      className={`px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer border flex items-center gap-1.5 min-h-[40px] shadow-xs ${
                                                        m.requirePreviousCompleted
                                                          ? 'bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 border-purple-200/90'
                                                          : 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border-emerald-200/90'
                                                      }`}
                                                      title={
                                                        m.requirePreviousCompleted
                                                          ? 'Materi Terkunci: Klik untuk Buka Bebas (Siswa bebas membaca tanpa kuis)'
                                                          : 'Materi Bebas: Klik untuk Kunci (Siswa wajib lulus kuis KKM materi sebelumnya)'
                                                      }
                                                    >
                                                      {m.requirePreviousCompleted ? (
                                                        <>
                                                          <Lock className="w-3.5 h-3.5 text-purple-600" />
                                                          <span className="hidden sm:inline">Kunci</span>
                                                        </>
                                                      ) : (
                                                        <>
                                                          <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                                          <span className="hidden sm:inline">Bebas</span>
                                                        </>
                                                      )}
                                                    </button>
                                                  )}

                                                  {/* Primary Action: Edit */}
                                                  <button
                                                    type="button"
                                                    id={`btn-edit-material-${m.id}`}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      onOpenEditMaterial(m);
                                                    }}
                                                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-indigo-200/90 flex items-center gap-1.5 min-h-[40px] shadow-xs"
                                                    title="Edit Bahan Ajar"
                                                  >
                                                    <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                                                    <span>Edit</span>
                                                  </button>

                                                  {/* Secondary Actions: Open & Copy Link */}
                                                  <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200">
                                                    {(m.originalUrl || m.embedUrl) && (
                                                      <a
                                                        href={m.originalUrl || m.embedUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-2 text-slate-600 hover:text-sky-600 hover:bg-white rounded-lg transition-colors flex items-center justify-center min-w-[38px] min-h-[38px]"
                                                        title="Buka Pratinjau Materi (Tab Baru)"
                                                        aria-label="Buka Pratinjau Materi"
                                                      >
                                                        <ExternalLink className="w-4 h-4" />
                                                      </a>
                                                    )}
                                                    <button
                                                      type="button"
                                                      id={`btn-copy-link-${m.id}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyLink(m);
                                                      }}
                                                      className={`p-2 rounded-lg transition-colors flex items-center justify-center min-w-[38px] min-h-[38px] cursor-pointer ${
                                                        copiedMatId === m.id
                                                          ? 'bg-emerald-500 text-white shadow-xs'
                                                          : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                                      }`}
                                                      title={copiedMatId === m.id ? 'Tautan Berhasil Disalin!' : 'Salin Tautan Materi'}
                                                      aria-label="Salin Tautan Materi"
                                                    >
                                                      {copiedMatId === m.id ? (
                                                        <Check className="w-4 h-4 stroke-[2.5]" />
                                                      ) : (
                                                        <Copy className="w-4 h-4" />
                                                      )}
                                                    </button>
                                                  </div>

                                                  {/* Dropdown Options: Hapus & More Actions */}
                                                  <div className={`relative ${isDropdownOpen ? 'z-50' : ''}`}>
                                                    <button
                                                      type="button"
                                                      id={`btn-more-material-${m.id}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdownMatId(isDropdownOpen ? null : m.id);
                                                      }}
                                                      className={`p-2 rounded-xl transition-colors border flex items-center justify-center min-w-[40px] min-h-[40px] cursor-pointer ${
                                                        isDropdownOpen
                                                          ? 'bg-slate-200 text-slate-900 border-slate-300 shadow-xs'
                                                          : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border-slate-200'
                                                      }`}
                                                      title="Pilihan Lainnya"
                                                      aria-label="Pilihan Lainnya"
                                                      aria-expanded={isDropdownOpen}
                                                      aria-haspopup="true"
                                                    >
                                                      <MoreVertical className="w-4 h-4" />
                                                    </button>

                                                    {/* Dropdown Menu - Muncul di atas tombol */}
                                                    {isDropdownOpen && (
                                                      <>
                                                        {/* Subtle transparent overlay backdrop to dismiss popup */}
                                                        <div
                                                          className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[0.5px] transition-opacity cursor-default"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveDropdownMatId(null);
                                                          }}
                                                          aria-hidden="true"
                                                        />

                                                        <div
                                                          id="actions-menu-popup"
                                                          onClick={(e) => e.stopPropagation()}
                                                          className="absolute right-0 bottom-full mb-1.5 w-52 bg-white border border-slate-200/90 rounded-xl shadow-2xl shadow-slate-400/40 py-1.5 z-[9999] min-w-[208px] ring-1 ring-slate-900/5 animate-in fade-in zoom-in-95 duration-100 origin-bottom-right"
                                                        >
                                                        {(m.originalUrl || m.embedUrl) && (
                                                          <a
                                                            href={m.originalUrl || m.embedUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                                                            onClick={() => setActiveDropdownMatId(null)}
                                                          >
                                                            <ExternalLink className="w-4 h-4 text-sky-500" />
                                                            <span>Buka di Tab Baru</span>
                                                          </a>
                                                        )}
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            handleCopyLink(m);
                                                            setActiveDropdownMatId(null);
                                                          }}
                                                          className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                        >
                                                          <Copy className="w-4 h-4 text-slate-500" />
                                                          <span>Salin Tautan</span>
                                                        </button>
                                                        <div className="my-1 border-t border-slate-100" />
                                                        <button
                                                          type="button"
                                                          id={`btn-delete-material-${m.id}`}
                                                          onClick={() => {
                                                            setActiveDropdownMatId(null);
                                                            onDeleteMaterial(m.id, m.title);
                                                          }}
                                                          className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                        >
                                                          <Trash2 className="w-4 h-4 text-rose-500" />
                                                          <span>Hapus Bahan Ajar</span>
                                                        </button>
                                                      </div>
                                                    </>
                                                  )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          }))}
                                          {catMats.length > 0 && (
                                            <div className="pt-3 pb-1 flex items-center justify-between px-2 text-[11px] border-t border-blue-100">
                                              <span className="text-slate-500 font-medium hidden sm:inline">
                                                Menampilkan {catMats.length} bahan ajar di bab "{c.title}"
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => onToggleCategory(c.id)}
                                                className="text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-1.5 hover:underline cursor-pointer py-1.5 px-3 rounded-lg bg-white/90 hover:bg-white border border-blue-200 shadow-2xs transition-all ml-auto"
                                              >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                                <span>Tutup Bab Ini</span>
                                              </button>
                                            </div>
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
