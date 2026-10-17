import React from 'react';
import { Sparkles } from 'lucide-react';

export interface StudentPreviewBannerProps {
  role: 'admin' | 'teacher';
  onExitPreview: () => void;
}

export const StudentPreviewBanner: React.FC<StudentPreviewBannerProps> = ({
  role,
  onExitPreview,
}) => {
  return (
    <div className="sticky top-0 z-50 bg-indigo-900 text-white px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 shadow-md border-b border-indigo-700">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
        <span className="truncate sm:whitespace-normal">
          <span className="sm:hidden">Mode Pratinjau Siswa Aktif</span>
          <span className="hidden sm:inline">Mode Pratinjau Siswa — Anda sedang melihat tampilan portal siswa.</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onExitPreview}
        className="w-full sm:w-auto px-2.5 sm:px-3 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-lg transition-colors cursor-pointer text-xs shrink-0 shadow-xs text-center"
      >
        <span className="sm:hidden">Kembali ke Halaman {role === 'teacher' ? 'Guru' : 'Admin'}</span>
        <span className="hidden sm:inline">Kembali ke Halaman {role === 'teacher' ? 'Guru' : 'Admin'}</span>
      </button>
    </div>
  );
};
