import React from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, Sparkles } from 'lucide-react';

export interface GFormGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GFormGuideModal: React.FC<GFormGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto overscroll-contain animate-fadeIn"
      onClick={onClose}
    >
      <div
        data-modal-scrollable="true"
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden my-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Panduan Berbagi Google Sheet
              </h3>
              <p className="text-[11px] text-slate-500">
                Agar hasil ujian dapat disinkronkan otomatis tanpa login
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

        <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs text-slate-700 leading-relaxed">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Sinkronisasi Otomatis 100% Aman &amp; Cepat
            </span>
            <p className="text-emerald-800 text-[11px]">
              Sistem membaca data secara langsung melalui Google Visualization Endpoint tanpa perlu login akun Google lagi.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
              3 Langkah Mudah Menghubungkan Spreadsheet (.CSV):
            </h4>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <strong className="text-slate-900 block font-extrabold">Buka Tab Jawaban di Google Form</strong>
                <span className="text-slate-600 text-[11px]">
                  Buka Google Form Anda &rarr; klik tab <strong>Jawaban (Responses)</strong> &rarr; klik icon hijau <strong>Link ke Spreadsheet</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <strong className="text-slate-900 block font-extrabold">Publikasikan ke Web sebagai CSV</strong>
                <span className="text-slate-600 text-[11px] block mt-0.5">
                  Di Google Spreadsheet, klik menu <strong>File</strong> &rarr; <strong>Bagikan (Share)</strong> &rarr; <strong>Publikasikan ke web (Publish to web)</strong> &rarr; ubah format dropdown menjadi <strong>"Nilai yang Dipisahkan Koma (.csv)"</strong> &rarr; klik tombol <strong>Publikasikan</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <strong className="text-slate-900 block font-extrabold">Salin Link Publikasi &amp; Tempel di Sistem</strong>
                <span className="text-slate-600 text-[11px] block mt-0.5">
                  Salin link publikasi tersebut (yang mengandung <code>/pub?output=csv</code>) lalu tempelkan ke form materi. Klik Simpan dan data hasil ujian akan langsung tersinkronisasi otomatis tanpa login Google!
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
