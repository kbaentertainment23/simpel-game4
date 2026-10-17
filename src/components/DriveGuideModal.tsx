import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Presentation, FileText, Video } from 'lucide-react';
import { useMobileBackModal } from '../utils/mobileNavigation';
import { useBodyScrollLock } from '../utils/scrollLock';

interface DriveGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DriveGuideModal: React.FC<DriveGuideModalProps> = ({ isOpen, onClose }) => {
  // Support Android hardware back button / swipe-to-close on mobile
  useMobileBackModal('drive-guide-modal', isOpen, onClose);

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
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Panduan Memasukkan Link Materi (Drive, Canva, YouTube)</h3>
              <p className="text-[11px] text-slate-400">Sistem akan otomatis mengonversi link ke mode Embed interaktif</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Tutup Panduan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div data-modal-scrollable="true" className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-700 text-sm flex-1">
          
          {/* Section 1: Google Drive */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-700 font-bold border-b border-slate-200 pb-2">
              <Presentation className="w-5 h-5 text-indigo-600" />
              <span>1. Google Drive (PDF, Video, Slides, Docs, Spreadsheet)</span>
            </div>
            
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 leading-relaxed pl-1">
              <li>Buka file video, PDF, atau presentasi di <strong className="text-slate-800">Google Drive</strong> Anda.</li>
              <li>Klik tombol <strong className="text-indigo-600">Bagikan (Share)</strong> di pojok kanan atas.</li>
              <li>Ubah Akses Umum menjadi <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">Siapa saja yang memiliki link (Anyone with the link)</strong>.</li>
              <li>Klik <strong className="text-slate-800">Salin Link (Copy Link)</strong>.</li>
              <li>Tempelkan link tersebut langsung di form Admin. Sistem kami akan mengonversinya ke pemutar video/viewer otomatis!</li>
            </ol>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <span className="font-semibold text-slate-700 block">Contoh Format URL Google Drive:</span>
              <div className="space-y-1 font-mono text-[11px] text-slate-600">
                <p>• Video / PDF: <span className="text-indigo-600">https://drive.google.com/file/d/ID_FILE/view</span></p>
                <p>• Google Slides: <span className="text-indigo-600">https://docs.google.com/presentation/d/ID_SLIDES/edit</span></p>
              </div>
            </div>
          </div>

          {/* Section 2: YouTube Video */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-bold border-b border-slate-200 pb-2">
              <Video className="w-5 h-5 text-rose-600" />
              <span>2. Video YouTube</span>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 leading-relaxed pl-1">
              <li>Buka video di <strong className="text-slate-800">YouTube</strong> atau YouTube Shorts.</li>
              <li>Klik tombol <strong className="text-rose-600">Bagikan (Share)</strong> di bawah video.</li>
              <li>Klik <strong className="text-slate-800">Salin Link (Copy Link)</strong> atau salin URL di address bar browser.</li>
              <li>Tempelkan di form Admin. Sistem akan otomatis memasang pemutar video YouTube interaktif.</li>
            </ol>

            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-2 text-xs">
              <span className="font-semibold text-rose-900 block">Contoh Format URL YouTube:</span>
              <div className="font-mono text-[11px] text-rose-800 space-y-1">
                <p>• URL Biasa: https://www.youtube.com/watch?v=ID_VIDEO</p>
                <p>• URL Pendek: https://youtu.be/ID_VIDEO</p>
              </div>
            </div>
          </div>

          {/* Section 3: Canva */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-700 font-bold border-b border-slate-200 pb-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <span>3. Presentasi Canva</span>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 leading-relaxed pl-1">
              <li>Buka desain presentasi di <strong className="text-slate-800">Canva</strong>.</li>
              <li>Klik tombol <strong className="text-purple-600">Bagikan (Share)</strong> &rarr; <strong className="text-slate-800">Sematkan (Embed)</strong> atau <strong className="text-slate-800">Tautan Tampilan Publik</strong>.</li>
              <li>Salin link tersebut dan tempelkan di form Admin.</li>
            </ol>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
