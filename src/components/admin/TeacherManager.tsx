import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  KeyRound,
  Copy,
  CopyCheck,
  AtSign,
} from 'lucide-react';
import { TeacherAccount, Subject } from '../../types';
import { downloadTeacherTemplate, exportTeachersToExcel } from '../../utils/excelImportExport';
import { useMobileBackModal } from '../../utils/mobileNavigation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TeacherManagerProps {
  teachers: TeacherAccount[];
  subjects: Subject[];
  allAvailableClasses: string[];
  onSaveTeacher: (teacherData: Partial<TeacherAccount>, isNew: boolean) => Promise<void>;
  onDeleteTeacher: (teacherId: string) => Promise<void>;
  onOpenImportModal: () => void;
  showNotify: (type: 'success' | 'error', message: string) => void;
}

// Generate an intuitive, lowercase username from teacher's name or NIP
const generateSuggestedUsername = (nameStr: string, nipStr?: string): string => {
  const cleanNip = (nipStr || '').trim();
  const cleanName = (nameStr || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(drs|dr|dra|ir|m\.pd|s\.pd|s\.kom|m\.kom|se|s\.t|m\.t|h\.|hj\.|m\.si|s\.si|m\.hum|s\.sos)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');

  if (cleanName.length >= 3) {
    return cleanName.slice(0, 20);
  }
  if (cleanNip.length >= 3) {
    return cleanNip.replace(/[^a-z0-9]/g, '').slice(0, 20);
  }
  return cleanName || '';
};

export const TeacherManager: React.FC<TeacherManagerProps> = ({
  teachers = [],
  subjects = [],
  allAvailableClasses = [],
  onSaveTeacher,
  onDeleteTeacher,
  onOpenImportModal,
  showNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherAccount | null>(null);
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [password, setPassword] = useState('');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset Password Modal
  const [resetPasswordTeacher, setResetPasswordTeacher] = useState<TeacherAccount | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('guru123');

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<TeacherAccount | null>(null);

  useMobileBackModal('teacher-modal', isModalOpen, () => setIsModalOpen(false));
  useMobileBackModal('teacher-reset-pwd-modal', !!resetPasswordTeacher, () => setResetPasswordTeacher(null));

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        (t.name && t.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.nip && t.nip.includes(searchQuery)) ||
        (t.username && t.username.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSubject = selectedSubjectFilter === 'all' || t.subjectId === selectedSubjectFilter;

      return matchesSearch && matchesSubject;
    });
  }, [teachers, searchQuery, selectedSubjectFilter]);

  // Real-time username duplicate check
  const isUsernameTaken = useMemo(() => {
    const cleanU = username.trim().toLowerCase();
    if (!cleanU) return false;
    return teachers.some(
      (t) => t.id !== editingTeacher?.id && t.username && t.username.trim().toLowerCase() === cleanU
    );
  }, [username, teachers, editingTeacher]);

  const handleOpenAdd = (defaultSubj?: string) => {
    setEditingTeacher(null);
    setName('');
    setNip('');
    setUsername('');
    setIsUsernameManuallyEdited(false);
    setSubjectId(defaultSubj || (subjects.length > 0 ? subjects[0].id : ''));
    setPassword('guru123');
    setAssignedClasses([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: TeacherAccount) => {
    setEditingTeacher(t);
    setName(t.name || '');
    setNip(t.nip || '');
    setUsername(t.username || '');
    setIsUsernameManuallyEdited(true);
    setSubjectId(t.subjectId || (subjects.length > 0 ? subjects[0].id : ''));
    setPassword('');
    setAssignedClasses(t.assignedClasses || []);
    setIsModalOpen(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showNotify('error', 'Nama guru tidak boleh kosong');
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!cleanUsername) {
      showNotify('error', 'Username login guru wajib diisi');
      return;
    }
    if (cleanUsername.length < 3) {
      showNotify('error', 'Username login guru minimal 3 karakter');
      return;
    }
    if (isUsernameTaken) {
      showNotify('error', `Username "@${cleanUsername}" sudah digunakan oleh guru lain. Silakan gunakan username lain.`);
      return;
    }

    if (!subjectId.trim()) {
      showNotify('error', 'Pilih mata pelajaran yang diampu');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<TeacherAccount> = {
        ...(editingTeacher ? { id: editingTeacher.id } : {}),
        name: name.trim(),
        nip: nip.trim(),
        username: cleanUsername,
        subjectId: subjectId.trim(),
        password: editingTeacher
          ? (password.trim() ? password.trim() : undefined)
          : (password.trim() || 'guru123'),
        assignedClasses,
        updatedAt: new Date().toISOString(),
      };

      if (!editingTeacher) {
        payload.createdAt = new Date().toISOString();
      }

      await onSaveTeacher(payload, !editingTeacher);
      setIsModalOpen(false);
      showNotify('success', editingTeacher ? 'Data guru berhasil diperbarui' : 'Guru baru berhasil ditambahkan');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan data guru');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleClass = (cls: string) => {
    setAssignedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls].sort()
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              Direktori & Manajemen Akun Guru
            </h3>
            <p className="text-xs text-slate-500">
              Kelola data guru pengampu, mata pelajaran, alokasi kelas mengajar, dan kredensial login
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={onOpenImportModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>

          <button
            type="button"
            onClick={() => downloadTeacherTemplate(subjects)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Download Template Format Excel Guru"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Template</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const selectedSubj = subjects.find((s) => s.id === selectedSubjectFilter);
              const fileName =
                selectedSubjectFilter !== 'all' && selectedSubj
                  ? `Data_Guru_${selectedSubj.name.replace(/\s+/g, '_')}.xlsx`
                  : 'Data_Seluruh_Guru.xlsx';
              exportTeachersToExcel(filteredTeachers, subjects, fileName);
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Ekspor</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAdd(selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Guru</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama guru, NIP, atau username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Mata Pelajaran ({(teachers || []).length} Guru)</option>
            {(subjects || []).map((s) => {
              const count = (teachers || []).filter((t) => t.subjectId === s.id).length;
              return (
                <option key={s.id} value={s.id}>
                  {s.name} ({count} guru)
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={() => setShowAllPasswords(!showAllPasswords)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showAllPasswords ? 'Tutup PIN' : 'Lihat PIN'}</span>
          </button>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredTeachers.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Belum ada data guru yang cocok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Nama Lengkap & ID Login (Username)</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4">Alokasi Kelas Mengajar</th>
                  <th className="py-3 px-4">Password Akses</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(filteredTeachers || []).map((t, idx) => {
                  const subj = (subjects || []).find((s) => s.id === t.subjectId);
                  const isCopiedUser = copiedId === `user-${t.id}`;
                  const isCopiedNip = copiedId === `nip-${t.id}`;
                  const isCopiedPwd = copiedId === `pwd-${t.id}`;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {/* Username Badge */}
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md font-mono text-[11px] font-bold">
                            <AtSign className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{t.username || '-'}</span>
                            {t.username && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(`user-${t.id}`, t.username)}
                                className="text-indigo-400 hover:text-indigo-700 ml-0.5 cursor-pointer"
                                title="Salin Username Login Guru"
                              >
                                {isCopiedUser ? (
                                  <CopyCheck className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* NIP Badge */}
                          {t.nip && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-md font-mono text-[10px]">
                              <span>NIP: {t.nip}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(`nip-${t.id}`, t.nip!)}
                                className="text-slate-400 hover:text-slate-700 ml-0.5 cursor-pointer"
                                title="Salin NIP"
                              >
                                {isCopiedNip ? (
                                  <CopyCheck className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-[11px]">
                          {subj?.name || t.subjectId || 'Umum'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {Array.isArray(t.assignedClasses) && t.assignedClasses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(t.assignedClasses || []).map((c) => (
                              <span
                                key={c}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Semua Kelas</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">
                            {showAllPasswords ? (t.password || (t.passwordHash ? '••••••••' : 'guru123')) : '••••••••'}
                          </span>
                          {showAllPasswords && (
                            <button
                              type="button"
                              onClick={() => {
                                const pwdText = t.password || (t.passwordHash ? '••••••••' : 'guru123');
                                handleCopyText(`pwd-${t.id}`, pwdText);
                              }}
                              className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                              title="Salin Password Guru"
                            >
                              {isCopiedPwd ? (
                                <CopyCheck className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Guru"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-teacher-${t.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(t);
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Akun Guru"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Teacher Add / Edit Modal */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          id="modal-teacher-overlay"
          className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto pt-16 sm:pt-6 animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            id="modal-teacher-dialog"
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl sm:max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  {editingTeacher ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    {editingTeacher ? 'Edit Akun Guru' : 'Tambah Guru Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Atur mata pelajaran pengampuan dan hak akses guru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Guru (dengan Gelar) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Drs. I Made Sudarma, M.Pd."
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (!editingTeacher && !isUsernameManuallyEdited) {
                      const suggested = generateSuggestedUsername(val, nip);
                      setUsername(suggested);
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIP / No. Identitas
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 198005122005011003"
                    value={nip}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNip(val);
                      if (!editingTeacher && !isUsernameManuallyEdited && !name.trim()) {
                        const suggested = generateSuggestedUsername(name, val);
                        setUsername(suggested);
                      }
                    }}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    required
                  >
                    <option value="">Pilih Mapel...</option>
                    {(subjects || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kredensial Login Guru (Username & Password) */}
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    Kredensial Login Guru
                  </span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-100/80 font-bold px-2 py-0.5 rounded-full">
                    Wajib untuk Masuk Portal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Username Login Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Username Guru (ID Login) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = generateSuggestedUsername(name, nip);
                          if (suggested) {
                            setUsername(suggested);
                            setIsUsernameManuallyEdited(false);
                          }
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        title="Buat saran username otomatis dari nama guru"
                      >
                        Saran Otomatis
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-indigo-500 font-mono font-bold text-xs">
                        @
                      </div>
                      <input
                        type="text"
                        placeholder="contoh: budi, sudarma, dll"
                        value={username}
                        onChange={(e) => {
                          setIsUsernameManuallyEdited(true);
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
                        }}
                        className={`w-full py-2 pl-7 pr-3 bg-white border rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 ${
                          isUsernameTaken
                            ? 'border-rose-300 focus:ring-rose-500/20 text-rose-700'
                            : 'border-slate-200 focus:ring-indigo-500/20'
                        }`}
                        required
                      />
                    </div>
                    {isUsernameTaken ? (
                      <p className="text-[10px] text-rose-600 font-semibold mt-1">
                        ⚠️ Username "@ {username}" sudah dipakai guru lain.
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Kombinasi huruf kecil, angka, titik (.), atau garis bawah (_).
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Password Login {!editingTeacher && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder={editingTeacher ? 'Kosongkan jika tidak ingin mengubah' : 'Default: guru123'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      required={!editingTeacher}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {editingTeacher
                        ? 'Biarkan kosong untuk mempertahankan password akun guru ini.'
                        : 'Kunci masuk portal. Standar default: guru123'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alokasi Kelas yang Diajar (Opsional)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Pilih kelas yang diampu guru ini (kosongkan jika mengajar semua kelas):
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {(allAvailableClasses || []).map((cls) => {
                    const isChecked = assignedClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => handleToggleClass(cls)}
                        className={`p-2 rounded-lg text-xs font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{cls}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Akun Guru'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteTarget}
          title="Hapus Akun Guru"
          itemType="akun guru"
          itemName={deleteTarget.name}
          description={`Apakah Anda yakin ingin menghapus akun guru "${deleteTarget.name}" (${deleteTarget.username})? Guru ini tidak akan dapat login lagi.`}
          onConfirm={async () => {
            await onDeleteTeacher(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
