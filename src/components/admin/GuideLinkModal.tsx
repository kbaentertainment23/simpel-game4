import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Presentation, FileText, Video, HelpCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { useMobileBackModal } from '../../utils/mobileNavigation';
import { useBodyScrollLock } from '../../utils/scrollLock';

interface GuideLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideLinkModal: React.FC<GuideLinkModalProps> = ({ isOpen, onClose }) => {
  // Support Android hardware back button / swipe-to-close on mobile
  useMobileBackModal('guide-link-modal', isOpen, onClose);

  // Freeze background completely while modal is open
  useBodyScrollLock(isOpen);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        data-modal-scrollable="true"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Panduan Memasukkan Tautan Bahan Ajar</h3>
              <p className="text-[11px] text-slate-400">Sistem otomatis mengonversi format tautan ke mode Embed & Live Preview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
            aria-label="Tutup Panduan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div data-modal-scrollable="true" className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm flex-1">
          
          {/* Section 1: Google Drive */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-700 font-bold border-b border-indigo-100 pb-2">
              <Presentation className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
              <span>1. Google Drive (PDF, Video, Slides, Docs, Spreadsheet)</span>
            </div>
            
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed pl-1">
              <li>Buka file di <strong className="text-slate-800">Google Drive</strong> Anda.</li>
              <li>Klik tombol <strong className="text-indigo-600">Bagikan (Share)</strong> di pojok kanan atas.</li>
              <li>Ubah Akses Umum menjadi <strong className="text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-semibold">Siapa saja yang memiliki link (Anyone with the link)</strong>.</li>
              <li>Klik <strong className="text-slate-800">Salin Link (Copy Link)</strong> lalu tempelkan di form materi.</li>
            </ol>

            <div className="p-2.5 bg-white border border-indigo-100 rounded-xl font-mono text-[11px] text-slate-600 space-y-1">
              <p>• Video / PDF: <span className="text-indigo-600">https://drive.google.com/file/d/ID_FILE/view</span></p>
              <p>• Google Slides: <span className="text-indigo-600">https://docs.google.com/presentation/d/ID_SLIDES/edit</span></p>
            </div>
          </div>

          {/* Section 2: YouTube Video */}
          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-rose-700 font-bold border-b border-rose-100 pb-2">
              <Video className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0" />
              <span>2. Video YouTube & YouTube Shorts</span>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed pl-1">
              <li>Buka video di <strong className="text-slate-800">YouTube</strong>.</li>
              <li>Klik tombol <strong className="text-rose-600">Bagikan (Share)</strong> &rarr; <strong className="text-slate-800">Salin Link</strong>.</li>
              <li>Sistem akan menyematkan video YouTube tanpa iklan yang mengganggu.</li>
            </ol>
          </div>

          {/* Section 3: Canva */}
          <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-purple-700 font-bold border-b border-purple-100 pb-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
              <span>3. Presentasi / Desain Canva</span>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed pl-1">
              <li>Buka desain di <strong className="text-slate-800">Canva</strong>.</li>
              <li>Klik tombol <strong className="text-purple-600">Bagikan (Share)</strong> &rarr; <strong className="text-slate-800">Sematkan (Embed)</strong> atau <strong className="text-slate-800">Tautan Tampilan Publik</strong>.</li>
              <li>Salin link tersebut dan tempelkan pada kolom Tautan Bahan Ajar.</li>
            </ol>
          </div>

          {/* Section 4: Google Form & Spreadsheet Sync */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-700 font-bold border-b border-emerald-100 pb-2">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
              <span>4. Google Form & Sinkronisasi Nilai Otomatis</span>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed pl-1">
              <li>Untuk kuis/ujian Google Form, tempel link form pada kolom <strong className="text-emerald-700">Tautan Bahan Ajar</strong>.</li>
              <li>Buka tab <strong className="text-slate-800">Jawaban (Responses)</strong> di Google Form &rarr; Klik ikon Google Sheets hijau untuk membuat spreadsheet tanggapan.</li>
              <li>Salin link Google Sheets tersebut dan tempelkan pada kolom <strong className="text-emerald-700">Link Spreadsheet Respon</strong> agar nilai siswa tersinkron otomatis ke dashboard rekap.</li>
            </ol>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Konversi otomatis berlaku saat disimpan
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
