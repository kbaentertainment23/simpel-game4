import React from 'react';
import {
  Atom,
  Rocket,
  Calculator,
  BrainCircuit,
  Lightbulb,
  Compass,
} from 'lucide-react';

export const EducationalBackground: React.FC = React.memo(() => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Soft Radial Ambient Color Glows */}
      <div className="absolute -top-24 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      {/* Floating Educational Doodles & Badges */}
      <div className="hidden lg:block">
        <div className="absolute top-28 left-8 text-indigo-400/25 animate-float">
          <Atom className="w-14 h-14" />
        </div>
        <div className="absolute top-44 right-12 text-sky-400/25 animate-float-delayed">
          <Rocket className="w-12 h-12" />
        </div>
        <div className="absolute top-1/2 left-6 text-purple-400/20 animate-float-delayed">
          <Calculator className="w-11 h-11" />
        </div>
        <div className="absolute top-2/3 right-10 text-emerald-400/20 animate-float">
          <BrainCircuit className="w-12 h-12" />
        </div>
        <div className="absolute bottom-28 left-14 text-amber-400/25 animate-float">
          <Lightbulb className="w-12 h-12" />
        </div>
        <div className="absolute bottom-20 right-20 text-rose-400/20 animate-float-delayed">
          <Compass className="w-11 h-11" />
        </div>
      </div>
    </div>
  );
});

EducationalBackground.displayName = 'EducationalBackground';
