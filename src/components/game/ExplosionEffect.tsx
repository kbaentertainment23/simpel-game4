import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Skull, Sparkles, AlertTriangle } from 'lucide-react';

interface ExplosionEffectProps {
  isActive: boolean;
  reason?: 'wrong_answer' | 'timeout' | null;
  message?: string;
  onDismiss?: () => void;
}

interface ParticleConfig {
  id: number;
  type: 'fire' | 'smoke' | 'spark' | 'debris';
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rotation: number;
}

export const ExplosionEffect: React.FC<ExplosionEffectProps> = React.memo(({
  isActive,
  reason = 'timeout',
  message,
  onDismiss,
}) => {
  // Generate deterministic randomized particle burst vectors around the blast epicenter
  const particles = useMemo<ParticleConfig[]>(() => {
    if (!isActive) return [];

    const items: ParticleConfig[] = [];
    const count = 38;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const distance = 80 + Math.random() * 260;
      const type: 'fire' | 'smoke' | 'spark' | 'debris' =
        i % 4 === 0 ? 'smoke' : i % 3 === 0 ? 'spark' : i % 5 === 0 ? 'debris' : 'fire';

      const colors = {
        fire: ['#f43f5e', '#ef4444', '#f97316', '#fbbf24', '#ffffff'],
        smoke: ['#334155', '#1e293b', '#475569', '#0f172a'],
        spark: ['#fef08a', '#fde047', '#fb923c', '#ffffff'],
        debris: ['#1e1b4b', '#450a0a', '#172554', '#020617'],
      };

      const colorPalette = colors[type];
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

      items.push({
        id: i,
        type,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: type === 'smoke' ? 24 + Math.random() * 32 : type === 'spark' ? 6 + Math.random() * 8 : 12 + Math.random() * 20,
        color,
        duration: type === 'smoke' ? 1.6 + Math.random() * 0.6 : 0.9 + Math.random() * 0.5,
        delay: Math.random() * 0.15,
        rotation: Math.random() * 360,
      });
    }

    return items;
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <div className="fixed inset-0 z-[120] pointer-events-auto flex items-center justify-center p-4 overflow-hidden select-none">
          {/* 1. Dramatic Flash Screen Underlay */}
          <motion.div
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="fixed inset-0 bg-gradient-to-tr from-rose-600 via-amber-500 to-white pointer-events-none"
          />

          {/* 2. Deep Tinted Darkness Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
            onClick={onDismiss}
          />

          {/* 3. Epic Shockwave Ring Expand */}
          <motion.div
            initial={{ scale: 0.1, opacity: 0.9, borderWidth: 16 }}
            animate={{ scale: 3.5, opacity: 0, borderWidth: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute rounded-full border-amber-400 pointer-events-none shadow-[0_0_80px_rgba(244,63,94,0.8)]"
            style={{ width: 140, height: 140 }}
          />

          {/* 4. Secondary Smoke Shockwave */}
          <motion.div
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 1.3, ease: 'easeOut', delay: 0.05 }}
            className="absolute rounded-full bg-radial from-rose-600/40 via-amber-500/20 to-transparent pointer-events-none"
            style={{ width: 220, height: 220 }}
          />

          {/* 5. Animated Fire & Smoke Particles (Framer Motion Particle Swarm) */}
          <div className="absolute pointer-events-none flex items-center justify-center">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0.2,
                  opacity: 1,
                  rotate: 0,
                }}
                animate={{
                  x: p.x,
                  y: p.y,
                  scale: p.type === 'smoke' ? [0.2, 1.4, 2.2] : [0.2, 1.2, 0],
                  opacity: [1, 0.9, 0],
                  rotate: p.rotation,
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: 'easeOut',
                }}
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  filter: p.type === 'spark' ? 'blur(0.5px) drop-shadow(0 0 6px #fde047)' : p.type === 'smoke' ? 'blur(8px)' : 'blur(2px) drop-shadow(0 0 8px #f43f5e)',
                  borderRadius: p.type === 'debris' ? '25%' : '50%',
                }}
                className="absolute"
              />
            ))}
          </div>

          {/* 6. Dramatic Center Shockwave Modal */}
          <motion.div
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 24,
              delay: 0.08,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-2 border-rose-500/90 rounded-3xl p-6 sm:p-7 text-center space-y-5 shadow-2xl shadow-rose-900/80 z-10"
          >
            {/* Center Exploded Icon Badge */}
            <div className="relative inline-block">
              <motion.div
                animate={{
                  rotate: [-3, 3, -3],
                  scale: [1, 1.05, 1],
                }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-rose-600/70 mx-auto border-2 border-amber-300"
              >
                <Skull className="w-12 h-12 text-amber-200" />
              </motion.div>

              {/* Ping explosion mark */}
              <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-md animate-bounce">
                💥
              </div>

              {/* Ambient flame badge */}
              <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-rose-600 text-amber-300 flex items-center justify-center shadow-md">
                <Flame className="w-4 h-4 fill-amber-300" />
              </div>
            </div>

            {/* Status Title & Message */}
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-300 border border-rose-500/50">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>{reason === 'wrong_answer' ? 'Defuse Gagal' : 'Waktu Habis'}</span>
              </span>

              <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {reason === 'wrong_answer' ? '💥 KABOOM!! JAWABAN SALAH!' : '⏰ KABOOM!! WAKTU HABIS!'}
              </h3>

              <p className="text-xs sm:text-sm text-rose-200/90 font-medium leading-relaxed">
                {message || (reason === 'wrong_answer'
                  ? 'Jawabanmu salah dan bom meledak seketika di tanganmu!'
                  : 'Waktu hitung mundur habis sebelum bom sempat kamu oper!')}
              </p>

              <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 text-[11px] text-slate-300 font-medium">
                Kamu sekarang berada di <strong className="text-amber-300">Mode Penonton (Spectator)</strong>. Tonton terus aksi seru teman sekelasmu hingga pemenang terakhir ditemukan!
              </div>
            </div>

            {/* Dismiss / Spectator Button */}
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/40 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Masuk Mode Penonton</span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

ExplosionEffect.displayName = 'ExplosionEffect';
