import React from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, X, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Material } from '../../types';
import { isGoogleSheetUrl, isPublishedCsvSheetUrl } from '../../utils/gformSheetSync';

export interface GFormEditSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMaterial: Material | null;
  editSpreadsheetInput: string;
  setEditSpreadsheetInput: (val: string) => void;
  saveSuccessMsg: string | null;
  saveErrorMsg: string | null;
  isSavingSpreadsheetLink: boolean;
  onSaveSpreadsheetLink: (e: React.FormEvent) => void;
}

export const GFormEditSpreadsheetModal: React.FC<GFormEditSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  activeMaterial,
  editSpreadsheetInput,
  setEditSpreadsheetInput,
  saveSuccessMsg,
  saveErrorMsg,
  isSavingSpreadsheetLink,
  onSaveSpreadsheetLink,
}) => {
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
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Hubungkan Google Spreadsheet
              </h3>
              <p className="text-[11px] text-slate-500">
                Materi: {activeMaterial?.title}
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

        <form onSubmit={onSaveSpreadsheetLink} className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {saveErrorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{saveErrorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Link Google Spreadsheet Hasil Ujian (Format .CSV) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
              value={editSpreadsheetInput}
              onChange={(e) => setEditSpreadsheetInput(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono text-[11px] focus:outline-none focus:ring-2 ${
                !editSpreadsheetInput
                  ? 'border-slate-200 text-slate-900 focus:ring-indigo-500/20 focus:border-indigo-500'
                  : isPublishedCsvSheetUrl(editSpreadsheetInput)
                  ? 'border-emerald-500 text-emerald-950 focus:ring-emerald-500/20 focus:border-emerald-500 bg-emerald-50/20'
                  : 'border-rose-400 text-rose-950 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/20'
              }`}
              required
            />

            {editSpreadsheetInput && (
              <div className={`mt-2 p-2.5 rounded-xl text-[11px] font-bold flex items-start gap-2 border ${
                isPublishedCsvSheetUrl(editSpreadsheetInput)
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : isGoogleSheetUrl(editSpreadsheetInput)
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}>
                {isPublishedCsvSheetUrl(editSpreadsheetInput) ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-emerald-900 block">Link Publik CSV Valid (/pub?output=csv)</span>
                      <span className="text-[10px] font-normal text-emerald-800">Sistem siap menyinkronkan data kuis siswa secara publik.</span>
                    </div>
                  </>
                ) : isGoogleSheetUrl(editSpreadsheetInput) ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-amber-900 block">Wajib Publikasikan sebagai CSV (/pub?output=csv)</span>
                      <span className="text-[10px] font-normal text-amber-800">
                        Buka file Spreadsheet &rarr; <strong>File</strong> &rarr; <strong>Bagikan</strong> &rarr; <strong>Publikasikan ke web</strong> &rarr; pilih <strong>Nilai yang Dipisahkan Koma (.csv)</strong> &rarr; <strong>Publikasikan</strong> &rarr; Salin link yang dihasilkan.
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-rose-900 block">Format URL Tidak Valid</span>
                      <span className="text-[10px] font-normal text-rose-800">URL harus diawali dengan <code>https://docs.google.com/spreadsheets/...</code> dan mengandung <code>/pub?output=csv</code>.</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 space-y-1.5">
            <span className="font-bold flex items-center gap-1.5 text-indigo-950">
              <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              Cara Mendapatkan Link Publik CSV:
            </span>
            <ol className="list-decimal list-inside space-y-0.5 text-indigo-900 leading-relaxed text-[11px] pl-1">
              <li>Buka Spreadsheet &rarr; Klik menu <strong>File</strong> &rarr; <strong>Bagikan (Share)</strong> &rarr; <strong>Publikasikan ke web</strong>.</li>
              <li>Pilih opsi dropdown <strong>"Nilai yang Dipisahkan Koma (.csv)"</strong>.</li>
              <li>Klik tombol <strong>Publikasikan</strong> dan salin tautan URL yang diberikan.</li>
            </ol>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSavingSpreadsheetLink}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSavingSpreadsheetLink ? 'Menyimpan...' : 'Simpan Link Sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
