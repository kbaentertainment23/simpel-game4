import React from 'react';
import { Save } from 'lucide-react';

export interface BankSoalSettingsTabProps {
  quizStatus: 'draft' | 'published';
  setQuizStatus: (status: 'draft' | 'published') => void;
  isRandomized: boolean;
  setIsRandomized: (rand: boolean) => void;
  masterClasses: string[];
  targetClasses: string[];
  setTargetClasses: React.Dispatch<React.SetStateAction<string[]>>;
  isSaving: boolean;
  onSaveSettings: () => void;
}

export const BankSoalSettingsTab: React.FC<BankSoalSettingsTabProps> = ({
  quizStatus,
  setQuizStatus,
  isRandomized,
  setIsRandomized,
  masterClasses,
  targetClasses,
  setTargetClasses,
  isSaving,
  onSaveSettings,
}) => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
      <h5 className="font-extrabold text-sm text-slate-900 pb-2 border-b border-slate-100">
        Pengaturan Distribusi Kuis Siswa
      </h5>

      <div className="space-y-4">
        {/* Quiz Status */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              Status Publikasi Kuis
            </span>
            <span className="text-[11px] text-slate-500">
              Jika Diterbitkan, siswa pada kelas terpilih dapat langsung mengerjakan kuis
            </span>
          </div>
          <select
            value={quizStatus}
            onChange={(e) => setQuizStatus(e.target.value as 'draft' | 'published')}
            className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="published">Diterbitkan (Aktif)</option>
            <option value="draft">Draf (Hanya Guru)</option>
          </select>
        </div>

        {/* Randomize order */}
        <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              Acak Urutan Soal & Pilihan Jawaban
            </span>
            <span className="text-[11px] text-slate-500">
              Setiap siswa mendapatkan urutan soal dan opsi jawaban yang berbeda
            </span>
          </div>
          <input
            type="checkbox"
            checked={isRandomized}
            onChange={(e) => setIsRandomized(e.target.checked)}
            className="w-4 h-4 text-amber-600 rounded"
          />
        </label>

        {/* Target Classes */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <span className="text-xs font-bold text-slate-800 block">
            Target Kelas Pengampu
          </span>
          <span className="text-[11px] text-slate-500 block">
            Pilih kelas yang berhak dan ditugaskan mengerjakan kuis materi ini (kosongkan jika semua kelas)
          </span>
          <div className="flex items-center gap-1.5 flex-wrap pt-2">
            {masterClasses.map((cls) => {
              const isChecked = targetClasses.includes(cls);
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => {
                    setTargetClasses((prev) =>
                      prev.includes(cls)
                        ? prev.filter((c) => c !== cls)
                        : [...prev, cls]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cls}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save settings button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onSaveSettings}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
