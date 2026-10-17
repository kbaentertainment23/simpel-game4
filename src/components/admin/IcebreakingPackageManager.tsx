import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  ArrowRight,
  Check,
  Package,
} from 'lucide-react';
import { IcebreakingPackage, IcebreakingQuestionItem } from '../../types/game';
import { ICEBREAKING_QUESTIONS } from '../../data/icebreakingQuestions';
import {
  subscribeIcebreakingPackages,
  saveIcebreakingPackage,
  deleteIcebreakingPackage,
} from '../../lib/gameService';

interface IcebreakingPackageManagerProps {
  currentTeacher?: { id: string; name: string } | null;
  onOpenHostRoom?: (packageId?: string) => void;
  showNotify?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

const DEFAULT_CATEGORIES = [
  'Trivia Populer & Lucu',
  'Teka-teki Logika Santai',
  'Sains & Alam Seru',
  'Wawasan Umum & Budaya',
  'Matematika & Nalar Cepat',
  'Bahasa & Kata Santai',
];

export const IcebreakingPackageManager: React.FC<IcebreakingPackageManagerProps> = ({
  currentTeacher,
  onOpenHostRoom,
  showNotify,
}) => {
  const [packages, setPackages] = useState<IcebreakingPackage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Trivia Populer & Lucu');
  const [formIsPublished, setFormIsPublished] = useState<boolean>(true);
  const [formQuestions, setFormQuestions] = useState<IcebreakingQuestionItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal State for Delete
  const [deleteTarget, setDeleteTarget] = useState<IcebreakingPackage | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Real-time listener to Firestore icebreaking_packages collection
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeIcebreakingPackages((data) => {
      setPackages(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchSearch =
        pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.description && pkg.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pkg.category && pkg.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCat = selectedCategory === 'ALL' || pkg.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [packages, searchQuery, selectedCategory]);

  // Open modal for new package
  const handleOpenAddModal = () => {
    setEditingPackageId(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('Trivia Populer & Lucu');
    setFormIsPublished(true);
    // Provide 2 clean starter questions
    setFormQuestions([
      {
        id: `q_${Date.now()}_1`,
        questionText: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
      },
      {
        id: `q_${Date.now()}_2`,
        questionText: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
      },
    ]);
    setIsModalOpen(true);
  };

  // Open modal for editing existing package
  const handleOpenEditModal = (pkg: IcebreakingPackage) => {
    setEditingPackageId(pkg.id);
    setFormTitle(pkg.title);
    setFormDescription(pkg.description || '');
    setFormCategory(pkg.category || 'Trivia Populer & Lucu');
    setFormIsPublished(pkg.isPublished ?? true);
    setFormQuestions(
      (pkg.questions || []).map((q, idx) => ({
        id: q.id || `q_${Date.now()}_${idx}`,
        questionText: q.questionText || '',
        options: [
          q.options?.[0] || '',
          q.options?.[1] || '',
          q.options?.[2] || '',
          q.options?.[3] || '',
        ],
        correctAnswerIndex:
          typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
            ? q.correctAnswerIndex
            : 0,
        explanation: q.explanation || '',
      }))
    );
    setIsModalOpen(true);
  };

  // Import 40 Default Questions as starter / template
  const handleImportDefaultQuestions = (replace: boolean = false) => {
    const imported: IcebreakingQuestionItem[] = ICEBREAKING_QUESTIONS.map((q, idx) => ({
      id: `default_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
      questionText: q.questionText,
      options: [q.options[0], q.options[1], q.options[2], q.options[3]],
      correctAnswerIndex: 0,
      explanation: q.explanation || '',
    }));

    if (replace) {
      setFormQuestions(imported);
      if (!formTitle) setFormTitle('Paket Trivia Lengkap (40 Soal Default)');
      if (!formDescription) setFormDescription('Koleksi komprehensif 40 soal trivia dan logika ceria bawaan sistem.');
      showNotify?.('info', '40 butir soal bawaan sistem berhasil diimpor sebagai template!');
    } else {
      setFormQuestions((prev) => [...prev, ...imported]);
      showNotify?.('info', `Ditambahkan ${imported.length} soal default ke dalam daftar pertanyaan.`);
    }
  };

  // Create package instantly with 40 default questions from main view
  const handleQuickCreateDefaultPackage = async () => {
    try {
      setIsSaving(true);
      const defaultQuestions: IcebreakingQuestionItem[] = ICEBREAKING_QUESTIONS.map((q, idx) => ({
        id: `def_q_${idx + 1}_${Date.now()}`,
        questionText: q.questionText,
        options: [q.options[0], q.options[1], q.options[2], q.options[3]],
        correctAnswerIndex: 0,
        explanation: q.explanation || '',
      }));

      await saveIcebreakingPackage({
        title: 'Master Trivia Seru Bawaan Sistem (40 Soal)',
        description: 'Paket resmi bank soal default mencakup logika nalar, trivia alam, hewan, dan pengetahuan umum.',
        category: 'Trivia Populer & Lucu',
        questions: defaultQuestions,
        createdBy: currentTeacher?.name || 'admin',
        isPublished: true,
      });

      showNotify?.('success', 'Paket soal default (40 soal) berhasil dibuat di Firestore!');
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal membuat paket default');
    } finally {
      setIsSaving(false);
    }
  };

  // Add a blank question item
  const handleAddQuestionItem = () => {
    setFormQuestions((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}_${prev.length + 1}`,
        questionText: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
      },
    ]);
  };

  // Remove a question item
  const handleRemoveQuestionItem = (index: number) => {
    if (formQuestions.length <= 1) {
      showNotify?.('warning', 'Paket harus memiliki minimal 1 butir soal pertanyaan.');
      return;
    }
    setFormQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Update question text
  const handleUpdateQuestionText = (index: number, text: string) => {
    setFormQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], questionText: text };
      return copy;
    });
  };

  // Update option text
  const handleUpdateOptionText = (qIndex: number, optIndex: number, text: string) => {
    setFormQuestions((prev) => {
      const copy = [...prev];
      const opts = [...(copy[qIndex].options || ['', '', '', ''])] as [string, string, string, string];
      opts[optIndex] = text;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  // Update correct answer index
  const handleSetCorrectIndex = (qIndex: number, optIndex: number) => {
    setFormQuestions((prev) => {
      const copy = [...prev];
      copy[qIndex] = { ...copy[qIndex], correctAnswerIndex: optIndex };
      return copy;
    });
  };

  // Save form handler
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      showNotify?.('warning', 'Judul paket soal wajib diisi.');
      return;
    }

    if (formQuestions.length === 0) {
      showNotify?.('warning', 'Paket wajib memiliki minimal 1 butir pertanyaan.');
      return;
    }

    // Validation: check each question has questionText and 4 non-empty options
    for (let i = 0; i < formQuestions.length; i++) {
      const q = formQuestions[i];
      if (!q.questionText.trim()) {
        showNotify?.('warning', `Soal #${i + 1} belum memiliki teks pertanyaan.`);
        return;
      }
      for (let o = 0; o < 4; o++) {
        if (!q.options[o]?.trim()) {
          showNotify?.('warning', `Soal #${i + 1} opsi ${String.fromCharCode(65 + o)} masih kosong.`);
          return;
        }
      }
    }

    try {
      setIsSaving(true);
      await saveIcebreakingPackage({
        id: editingPackageId || undefined,
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory.trim(),
        questions: formQuestions,
        createdBy: currentTeacher?.name || 'admin',
        isPublished: formIsPublished,
      });

      showNotify?.('success', `Paket "${formTitle}" dengan ${formQuestions.length} butir soal berhasil disimpan!`);
      setIsModalOpen(false);
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal menyimpan paket soal.');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await deleteIcebreakingPackage(deleteTarget.id);
      showNotify?.('success', `Paket "${deleteTarget.title}" berhasil dihapus dari sistem.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showNotify?.('error', err.message || 'Gagal menghapus paket.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-rose-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-rose-500/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-400/30 rounded-full text-xs font-bold text-rose-300">
              <Package className="w-3.5 h-3.5" />
              <span>Koleksi Soal Kustom Dinamis</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Manajemen Paket Soal Ice Breaking
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Kelola paket dan butir soal kustom untuk permainan <strong>Bomb Passthrough</strong>.
              Setiap paket yang dipublikasikan di sini dapat dipilih langsung oleh semua guru saat membuka ruangan permainan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Paket Baru</span>
            </button>

            {packages.length === 0 && (
              <button
                type="button"
                onClick={handleQuickCreateDefaultPackage}
                disabled={isSaving}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Salin 40 Soal Default</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari paket atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({packages.length})
          </button>
          {DEFAULT_CATEGORIES.map((cat) => {
            const count = packages.filter((p) => p.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Package List Grid */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Memuat paket soal dari Firestore...</p>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Package className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-800">
              {searchQuery ? 'Tidak Ada Paket yang Cocok' : 'Belum Ada Paket Soal Kustom'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? 'Coba ganti kata kunci pencarian atau bersihkan filter kategori.'
                : 'Buat paket soal baru atau salin 40 butir bank soal default untuk memperkaya variasi pertanyaan di kelas.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-200 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Paket Baru Sekarang</span>
            </button>
            <button
              type="button"
              onClick={handleQuickCreateDefaultPackage}
              disabled={isSaving}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Salin 40 Soal Default Sistem</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black rounded-lg uppercase tracking-wide">
                    {pkg.category || 'Trivia'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {pkg.isPublished ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3 h-3" /> Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Draf
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-rose-600 transition-colors line-clamp-1">
                    {pkg.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {pkg.description || 'Tidak ada deskripsi tambahan.'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">Jumlah Pertanyaan:</span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-black">
                    {pkg.questions?.length || pkg.totalQuestions || 0} Soal
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 font-medium">
                  Update: {pkg.updatedAt ? new Date(pkg.updatedAt).toLocaleDateString('id-ID') : '-'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(pkg)}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    title="Edit Paket & Soal"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(pkg)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    title="Hapus Paket"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {onOpenHostRoom && (
                    <button
                      type="button"
                      onClick={() => onOpenHostRoom(pkg.id)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="Gunakan untuk Membuka Room"
                    >
                      <span>Host</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Package */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200/90 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {editingPackageId ? 'Edit Paket Soal Ice Breaking' : 'Buat Paket Soal Baru'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Atur judul, kategori, serta daftar butir pertanyaan & kunci jawabannya.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSavePackage} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Judul Paket Soal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Trivia Sains & Alam Kelas 7"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Kategori Materi / Topik
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="Kustom / Khusus">Kustom / Khusus</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Status Publikasi
                  </label>
                  <div className="flex items-center gap-2 pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPublished}
                        onChange={(e) => setFormIsPublished(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                      <span className="ml-3 text-xs font-bold text-slate-700">
                        {formIsPublished ? 'Publikasikan untuk semua guru' : 'Simpan sebagai Draf'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Deskripsi Singkat (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Deskripsi atau catatan pengantar sebelum permainan dimulai..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none font-medium"
                  />
                </div>
              </div>

              {/* Questions Section Header */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-rose-600" />
                    <span>Daftar Butir Soal</span>
                  </h4>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-xs font-black">
                    {formQuestions.length} Butir
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleImportDefaultQuestions(false)}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Impor Soal Default</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddQuestionItem}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Butir Soal</span>
                  </button>
                </div>
              </div>

              {/* Questions Dynamic List */}
              <div className="space-y-4">
                {formQuestions.map((q, qIndex) => (
                  <div
                    key={q.id || qIndex}
                    className="bg-slate-50/90 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-7 h-7 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                        {qIndex + 1}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
                          Kunci Benar: Opsi {String.fromCharCode(65 + q.correctAnswerIndex)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionItem(qIndex)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Hapus butir soal ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question text */}
                    <div>
                      <input
                        type="text"
                        required
                        placeholder={`Tulis pertanyaan soal #${qIndex + 1}...`}
                        value={q.questionText}
                        onChange={(e) => handleUpdateQuestionText(qIndex, e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    {/* Options Grid (A, B, C, D) */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                        <span>Pilihan Jawaban (Klik huruf/opsi untuk menentukan kunci benar):</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Opsi hijau = Jawaban benar
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[0, 1, 2, 3].map((optIndex) => {
                          const isCorrect = q.correctAnswerIndex === optIndex;
                          const letter = String.fromCharCode(65 + optIndex);
                          return (
                            <div
                              key={optIndex}
                              className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                                isCorrect
                                  ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSetCorrectIndex(qIndex, optIndex)}
                                className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                                title={`Jadikan opsi ${letter} sebagai kunci jawaban benar`}
                              >
                                {letter}
                              </button>
                              <input
                                type="text"
                                required
                                placeholder={`Pilihan ${letter}...`}
                                value={q.options[optIndex] || ''}
                                onChange={(e) => handleUpdateOptionText(qIndex, optIndex, e.target.value)}
                                className="w-full px-2 py-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                              />
                              {isCorrect && (
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md shrink-0">
                                  BENAR
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Add Question Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddQuestionItem}
                  className="w-full py-3 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Butir Soal Baru</span>
                </button>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Paket Soal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">Hapus Paket Soal Ini?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Paket <strong>"{deleteTarget.title}"</strong> ({deleteTarget.questions?.length || 0} soal) akan dihapus secara permanen dari Firestore. Guru tidak akan dapat memilih paket ini lagi untuk permainan berikutnya.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Paket</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
