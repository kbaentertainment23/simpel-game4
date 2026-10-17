import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';
import { ALL_BADGES } from '../../utils/gamification';

export interface QuizGamificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedBadgeIds: string[];
}

export const QuizGamificationModal: React.FC<QuizGamificationModalProps> = ({
  isOpen,
  onClose,
  unlockedBadgeIds,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fadeIn">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base text-white">Lencana & Achievement Siswa</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
              {(ALL_BADGES || []).map((badge) => {
                const isUnlocked = unlockedBadgeIds.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all ${
                      isUnlocked
                        ? 'bg-slate-800/90 border-amber-500/40 text-white shadow-xs'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-500 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${badge.color} text-2xl flex items-center justify-center shrink-0 shadow-md`}
                    >
                      {badge.icon}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-white">{badge.title}</h4>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isUnlocked
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isUnlocked ? 'Terkumpul ✓' : 'Terkunci 🔒'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{badge.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Tutup Lencana
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
