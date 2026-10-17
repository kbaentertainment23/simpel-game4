import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BookOpen,
  FolderPlus,
  Edit2,
  Save,
  Trash2,
  Layers,
  Palette,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { Subject, Category, AuthSession } from '../../types';
import { DEFAULT_GRADES } from '../../lib/dataService';
import { IconPicker } from '../IconPicker';
import { useMobileBackModal } from '../../utils/mobileNavigation';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSubject: Subject | null;
  subjects: Subject[];
  onSave: (subjectData: Partial<Subject>, isNew: boolean) => Promise<void>;
  showNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  editingSubject,
  subjects,
  onSave,
  showNotify,
}) => {
  useMobileBackModal('subject-modal', isOpen, onClose);

  const [subjName, setSubjName] = useState<string>('');
  const [subjCode, setSubjCode] = useState<string>('');
  const [subjDescription, setSubjDescription] = useState<string>('');
  const [subjIcon, setSubjIcon] = useState<string>('BookOpen');
  const [subjColor, setSubjColor] = useState<string>('indigo');
  const [subjOrder, setSubjOrder] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isInitializedRef = useRef<boolean>(false);
  const activeEditingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      activeEditingIdRef.current = null;
      return;
    }

    const currentId = editingSubject ? editingSubject.id : '__NEW__';
    if (isInitializedRef.current && activeEditingIdRef.current === currentId) {
      return;
    }
    isInitializedRef.current = true;
    activeEditingIdRef.current = currentId;

    if (editingSubject) {
      setSubjName(editingSubject.name || '');
      setSubjCode(editingSubject.code || '');
      setSubjDescription(editingSubject.description || '');
      setSubjIcon(editingSubject.icon || 'BookOpen');
      setSubjColor(editingSubject.color || 'indigo');
      setSubjOrder(editingSubject.order ? String(editingSubject.order) : '');
    } else {
      setSubjName('');
      setSubjCode('');
      setSubjDescription('');
      setSubjIcon('BookOpen');
      setSubjColor('indigo');
      setSubjOrder('');
    }
  }, [isOpen, editingSubject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjName.trim()) {
      showNotify('error', 'Nama mata pelajaran tidak boleh kosong');
      return;
    }

    const maxOrder = (subjects || []).reduce((max, s) => Math.max(max, s.order || 0), 0);
    const finalOrder =
      subjOrder !== '' && !isNaN(Number(subjOrder))
        ? Number(subjOrder)
        : editingSubject?.order || maxOrder + 1;

    setIsSaving(true);
    try {
      const payload: Partial<Subject> = {
        name: subjName.trim(),
        code: subjCode.trim() || undefined,
        description: subjDescription.trim() || undefined,
        icon: subjIcon || 'BookOpen',
        color: subjColor || 'indigo',
        order: finalOrder,
        updatedAt: new Date().toISOString(),
      };

      if (!editingSubject) {
        payload.createdAt = new Date().toISOString();
      }

      await onSave(payload, !editingSubject);
      onClose();
    } catch (err: any) {
      console.error('Error saving subject:', err);
      showNotify('error', err.message || 'Gagal menyimpan mata pelajaran');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto overscroll-contain animate-fadeIn">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              {editingSubject ? <Edit2 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                {editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {editingSubject ? 'Perbarui informasi mata pelajaran' : 'Tambahkan kurikulum mata pelajaran baru ke sistem'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Matematika, IPA, Pemrograman"
                value={subjName}
                onChange={(e) => setSubjName(e.target.value)}
                className="w-full py-2.5 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode Singkatan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: MTK, IPA, INF"
                  value={subjCode}
                  onChange={(e) => setSubjCode(e.target.value.toUpperCase())}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Urutan
                </label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={subjOrder}
                  onChange={(e) => setSubjOrder(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Ikon Mata Pelajaran
              </label>
              <IconPicker value={subjIcon} onChange={setSubjIcon} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deskripsi Singkat
              </label>
              <textarea
                rows={2}
                placeholder="Deskripsi materi atau cakupan mapel..."
                value={subjDescription}
                onChange={(e) => setSubjDescription(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : editingSubject ? 'Simpan Perubahan' : 'Tambah Mapel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory: Category | null;
  subjects: Subject[];
  categories?: Category[];
  masterGrades?: Array<{ id: string; label: string; subLabel: string }>;
  isTeacherRole?: boolean;
  assignedSubject?: Subject | null;
  authSession?: AuthSession | null;
  defaultSubjectId?: string;
  defaultGrade?: string;
  onSave: (categoryData: Partial<Category>, isNew: boolean) => Promise<void>;
  showNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
  orderSuggestion?: number;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  editingCategory,
  subjects = [],
  categories = [],
  masterGrades,
  isTeacherRole = false,
  assignedSubject = null,
  authSession = null,
  defaultSubjectId = '',
  defaultGrade = 'all',
  onSave,
  showNotify = (_type: 'success' | 'error' | 'info', _message: string) => {},
}) => {
  useMobileBackModal('category-modal', isOpen, onClose);

  const activeGrades = masterGrades && masterGrades.length > 0 ? masterGrades : DEFAULT_GRADES;

  const [catSubjectId, setCatSubjectId] = useState<string>('informatika');
  const [catTitle, setCatTitle] = useState<string>('');
  const [catDescription, setCatDescription] = useState<string>('');
  const [catIcon, setCatIcon] = useState<string>('Layers');
  const [catColor, setCatColor] = useState<string>('violet');
  const [catOrder, setCatOrder] = useState<string>('');
  const [catTargetGrade, setCatTargetGrade] = useState<string>('all');
  const [catIsPublished, setCatIsPublished] = useState<boolean>(true);
  const [catRequirePreviousCompleted, setCatRequirePreviousCompleted] = useState<boolean>(false);
  const [catPrerequisiteCategoryId, setCatPrerequisiteCategoryId] = useState<string>('none');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isInitializedRef = useRef<boolean>(false);
  const activeEditingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      activeEditingIdRef.current = null;
      return;
    }

    const currentId = editingCategory ? editingCategory.id : '__NEW__';
    if (isInitializedRef.current && activeEditingIdRef.current === currentId) {
      return;
    }
    isInitializedRef.current = true;
    activeEditingIdRef.current = currentId;

    if (editingCategory) {
      setCatSubjectId(editingCategory.subjectId || 'informatika');
      setCatTitle(editingCategory.title || '');
      setCatDescription(editingCategory.description || '');
      setCatIcon(editingCategory.icon || 'Layers');
      setCatColor(editingCategory.color || 'violet');
      setCatOrder(editingCategory.order ? String(editingCategory.order) : '');
      setCatTargetGrade(editingCategory.targetGrade || 'all');
      setCatIsPublished(editingCategory.isPublished !== false);
      setCatRequirePreviousCompleted(editingCategory.requirePreviousCompleted || false);
      setCatPrerequisiteCategoryId(editingCategory.prerequisiteCategoryId || 'none');
    } else {
      const initialSubj =
        isTeacherRole && assignedSubject
          ? assignedSubject.id
          : defaultSubjectId || ((subjects || []).length > 0 ? subjects[0].id : 'informatika');

      setCatSubjectId(initialSubj);
      setCatTitle('');
      setCatDescription('');
      setCatIcon('Layers');
      setCatColor('violet');
      setCatOrder('');
      setCatTargetGrade(defaultGrade || 'all');
      setCatIsPublished(true);
      setCatRequirePreviousCompleted(false);
      setCatPrerequisiteCategoryId('none');
    }
  }, [isOpen, editingCategory, subjects, isTeacherRole, assignedSubject, defaultSubjectId, defaultGrade]);

  const sameSubjCategories = (categories || []).filter(
    (c) => (c.subjectId || 'informatika') === catSubjectId && (!editingCategory || c.id !== editingCategory.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim()) {
      showNotify('error', 'Judul topik/bab materi tidak boleh kosong');
      return;
    }

    const sameSubjectCats = (categories || []).filter(
      (c) => (c.subjectId || 'informatika') === (catSubjectId || 'informatika')
    );
    const maxCatOrder = sameSubjectCats.reduce((max, c) => Math.max(max, c.order || 0), 0);
    const finalOrder =
      catOrder !== '' && !isNaN(Number(catOrder))
        ? Number(catOrder)
        : editingCategory?.order || maxCatOrder + 1;

    setIsSaving(true);
    try {
      const payload: Partial<Category> = {
        subjectId: catSubjectId || 'informatika',
        title: catTitle.trim(),
        description: catDescription.trim(),
        icon: catIcon || 'Layers',
        color: catColor || 'violet',
        order: finalOrder,
        targetGrade: catTargetGrade || 'all',
        isPublished: catIsPublished,
        requirePreviousCompleted: catRequirePreviousCompleted,
        prerequisiteCategoryId: catRequirePreviousCompleted ? catPrerequisiteCategoryId : 'none',
        createdBy:
          isTeacherRole && authSession?.teacher
            ? (editingCategory?.createdBy && editingCategory.createdBy !== 'admin'
                ? editingCategory.createdBy
                : (authSession.teacher.username || authSession.teacher.id))
            : (editingCategory?.createdBy || 'admin'),
        updatedAt: new Date().toISOString(),
      };

      if (!editingCategory) {
        payload.createdAt = new Date().toISOString();
      }

      await onSave(payload, !editingCategory);
      onClose();
    } catch (err: any) {
      console.error('Error saving category:', err);
      showNotify('error', err.message || 'Gagal menyimpan topik');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto overscroll-contain animate-fadeIn">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              {editingCategory ? <Edit2 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                {editingCategory ? 'Edit Topik / Bab Materi' : 'Tambah Topik / Bab Baru'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {editingCategory ? 'Perbarui informasi bab atau unit ajar' : 'Buat kelompok bab atau unit ajar baru'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={catSubjectId}
                  onChange={(e) => setCatSubjectId(e.target.value)}
                  disabled={isTeacherRole}
                  className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                  required
                >
                  {(subjects || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || 'Mapel'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Jenjang Kelas
                </label>
                <select
                  value={catTargetGrade}
                  onChange={(e) => setCatTargetGrade(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Semua Jenjang (Lintas Kelas)</option>
                  {(activeGrades || []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label} {g.subLabel ? `(${g.subLabel})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Judul Topik / Bab <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Bab 1 - Berpikir Komputasional"
                value={catTitle}
                onChange={(e) => setCatTitle(e.target.value)}
                className="w-full py-2.5 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Urutan
                </label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={catOrder}
                  onChange={(e) => setCatOrder(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Publikasi
                </label>
                <select
                  value={catIsPublished ? 'published' : 'draft'}
                  onChange={(e) => setCatIsPublished(e.target.value === 'published')}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="published">Dipublikasikan</option>
                  <option value="draft">Draft (Disembunyikan)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Ikon Topik
              </label>
              <IconPicker value={catIcon} onChange={setCatIcon} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deskripsi Singkat Bab
              </label>
              <textarea
                rows={2}
                placeholder="Deskripsi singkat topik pembahasan..."
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Prerequisite Topic Requirement */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <label className="flex items-start gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catRequirePreviousCompleted}
                  onChange={(e) => setCatRequirePreviousCompleted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-indigo-600 rounded"
                />
                <div>
                  <span className="block text-slate-900 font-bold">Kunci Topik (Wajib Selesaikan Seluruh Materi Topik Sebelumnya)</span>
                  <span className="block text-[11px] font-normal text-slate-500 mt-0.5 leading-relaxed">
                    Jika dicentang, siswa wajib menuntaskan semua materi di topik sebelumnya terlebih dahulu. Jika tidak dicentang, topik ini terbuka bebas dan siswa bisa langsung masuk.
                  </span>
                </div>
              </label>

              {catRequirePreviousCompleted && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Prasyarat Topik Tertentu:
                  </label>
                  <select
                    value={catPrerequisiteCategoryId}
                    onChange={(e) => setCatPrerequisiteCategoryId(e.target.value)}
                    className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                  >
                    <option value="none">Topik Tepat Sebelum Nomor Ini</option>
                    {(sameSubjCategories || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.order} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

          </div>

          <div className="px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : editingCategory ? 'Simpan Perubahan' : 'Tambah Topik'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
