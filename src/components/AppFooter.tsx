import React from 'react';

export const AppFooter: React.FC = React.memo(() => {
  return (
    <footer className="hidden md:block bg-white/80 backdrop-blur-md border-t border-slate-200/70 py-3 sm:py-4 text-center text-xs sm:text-sm text-slate-500 mt-6 sm:mt-8 relative z-10">
      <div className="w-full px-3 sm:px-6 lg:px-8 flex items-center justify-center">
        <p className="font-medium text-slate-500 text-xs sm:text-sm">
          © {new Date().getFullYear()}{' '}
          <span className="font-extrabold text-indigo-700 tracking-wider">SIMPEL</span> — Sistem Informasi Materi Pembelajaran Elektronik
        </p>
      </div>
    </footer>
  );
});

AppFooter.displayName = 'AppFooter';
