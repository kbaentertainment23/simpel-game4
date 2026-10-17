import React from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { GFormRespondentRow } from '../../utils/gformSheetSync';

export interface GFormRespondentDetailModalProps {
  viewingRespondent: GFormRespondentRow | null;
  onClose: () => void;
  kkmThreshold: number;
}

export const GFormRespondentDetailModal: React.FC<GFormRespondentDetailModalProps> = ({
  viewingRespondent,
  onClose,
  kkmThreshold,
}) => {
  if (!viewingRespondent || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto overscroll-contain animate-fadeIn"
      onClick={onClose}
    >
      <div
        data-modal-scrollable="true"
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden my-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white ${
                viewingRespondent.isPassed ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {viewingRespondent.isPassed ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                {viewingRespondent.studentName}
              </h3>
              <p className="text-xs text-slate-500">
                Kelas {viewingRespondent.kelas}{' '}
                {viewingRespondent.noAbsen ? `• Absen #${viewingRespondent.noAbsen}` : ''}
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

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Score Highlight Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                Hasil Nilai Ujian
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-black text-slate-900">
                  {viewingRespondent.normalizedScore}
                </span>
                <span className="text-xs text-slate-500 font-bold font-mono">
                  (Skor Asli: {viewingRespondent.rawScore})
                </span>
              </div>
            </div>
            <div>
              {viewingRespondent.isPassed ? (
                <span className="px-3 py-1 bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-extrabold rounded-full">
                  TUNTAS (≥ {kkmThreshold})
                </span>
              ) : (
                <span className="px-3 py-1 bg-rose-100 border border-rose-200 text-rose-800 text-xs font-extrabold rounded-full">
                  REMEDIAL (&lt; {kkmThreshold})
                </span>
              )}
            </div>
          </div>

          {/* Timestamp info */}
          <div className="text-xs text-slate-500 font-medium">
            Waktu Submit: <strong className="text-slate-800 font-bold">{viewingRespondent.timestamp || '-'}</strong>
          </div>

          {/* All Question & Answer Columns from Spreadsheet */}
          <div className="space-y-3 pt-2">
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
              Rincian Jawaban Responden:
            </h4>
            <div className="space-y-2.5">
              {Object.entries(viewingRespondent.rawAnswers || {}).map(([questionHeader, studentAnswer], idx) => {
                return (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs"
                  >
                    <span className="font-bold text-slate-700 block">
                      {questionHeader}
                    </span>
                    <div className="p-2 bg-white rounded-lg border border-slate-200/80 font-medium text-slate-900 break-words">
                      {studentAnswer || <span className="text-slate-400 italic">(Tidak diisi / Kosong)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup Rincian
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
