import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, X } from 'lucide-react';
import { QuizQuestion } from '../../../types';

export interface BankSoalQuestionModalProps {
  initialQuestion: QuizQuestion;
  isNew?: boolean;
  onClose: () => void;
  onSave: (question: QuizQuestion) => void;
}

export const BankSoalQuestionModal: React.FC<BankSoalQuestionModalProps> = ({
  initialQuestion,
  isNew = false,
  onClose,
  onSave,
}) => {
  const [questionText, setQuestionText] = useState(initialQuestion.question || '');
  const [options, setOptions] = useState<string[]>(
    initialQuestion.options && initialQuestion.options.length === 4
      ? [...initialQuestion.options]
      : ['', '', '', '']
  );
  const initialCorrect =
    typeof initialQuestion.correctAnswerIndex === 'number'
      ? initialQuestion.correctAnswerIndex
      : typeof (initialQuestion as any).correctAnswer === 'number'
      ? (initialQuestion as any).correctAnswer
      : 0;
  const [correctAnswer, setCorrectAnswer] = useState<number>(initialCorrect);
  const [explanation, setExplanation] = useState(initialQuestion.explanation || '');

  useEffect(() => {
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = originalBodyWidth;
      document.body.style.paddingRight = originalBodyPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    if (options.some((opt) => !opt.trim())) return;

    onSave({
      ...initialQuestion,
      id: initialQuestion.id,
      question: questionText.trim(),
      options: options.map((o) => o.trim()),
      correctAnswerIndex: correctAnswer,
      ...({ correctAnswer } as any),
      explanation: explanation.trim(),
      cognitiveLevel: initialQuestion.cognitiveLevel || 'C2',
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-10 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                {isNew ? 'Tambah Butir Soal Baru' : 'Edit Butir Soal'}
              </h4>
              <p className="text-[11px] text-slate-500">
                Lengkapi teks pertanyaan, 4 pilihan ganda, dan kunci jawaban
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Question Text */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pertanyaan / Butir Soal:
            </label>
            <textarea
              required
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Tuliskan soal pilihan ganda di sini..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Pilihan Jawaban (Klik lingkaran untuk memilih Kunci Jawaban Benar):
            </label>
            {options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isCorrect = correctAnswer === idx;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded-xl border ${
                    isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(idx)}
                    className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer transition-colors ${
                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {letter}
                  </button>
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[idx] = e.target.value;
                      setOptions(updated);
                    }}
                    placeholder={`Pilihan ${letter}...`}
                    className="flex-1 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                  {isCorrect && (
                    <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded">
                      Kunci Jawaban
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pembahasan Pedagogis (Opsional):
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Jelaskan mengapa pilihan tersebut benar untuk umpan balik siswa..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-xs"
            >
              Simpan Butir Soal
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
