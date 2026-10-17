import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldAlert, ArrowRight, KeyRound, User, GraduationCap, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { verifyAdminPin, authenticateTeacher } from '../lib/dataService';
import { AuthSession } from '../types';
import { useMobileBackModal } from '../utils/mobileNavigation';
import { useBodyScrollLock } from '../utils/scrollLock';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  // Support Android hardware back button / swipe-to-close on mobile
  useMobileBackModal('admin-login-modal', isOpen, onClose);

  const [loginRole, setLoginRole] = useState<'admin' | 'teacher'>('admin');
  
  // Admin PIN State
  const [pin, setPin] = useState('');
  
  // Teacher Credentials State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setPin('');
      setUsername('');
      setPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Masukkan PIN Admin');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const isValid = await verifyAdminPin(pin);
      if (isValid) {
        onSuccess({ role: 'admin' });
        setPin('');
        onClose();
      } else {
        setError('PIN Admin tidak valid. Coba lagi.');
      }
    } catch (err) {
      setError('Gagal memverifikasi PIN Admin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Masukkan Username dan Password Guru');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const teacher = await authenticateTeacher(username, password);
      if (teacher) {
        onSuccess({ role: 'teacher', teacher });
        setUsername('');
        setPassword('');
        onClose();
      } else {
        setError('Username atau Password Guru tidak ditemukan.');
      }
    } catch (err) {
      setError('Gagal memverifikasi akun guru.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200 pointer-events-auto touch-none select-none overscroll-none">
      <div 
        data-modal-scrollable="true"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto overscroll-contain pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-700 via-blue-800 to-sky-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
              {loginRole === 'admin' ? <KeyRound className="w-5 h-5 text-sky-200" /> : <GraduationCap className="w-5 h-5 text-sky-200" />}
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-white">Portal Masuk Pengelola</h3>
              <p className="text-xs text-blue-100 font-medium">Pilih peran akses Admin atau Guru</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Role Switcher */}
        <div className="relative flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (loginRole !== 'admin') {
                setLoginRole('admin');
                setError('');
              }
            }}
            className={`relative flex-1 py-2 px-3 text-xs font-extrabold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer z-10 select-none ${
              loginRole === 'admin' ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {loginRole === 'admin' && (
              <motion.div
                layoutId="adminModalRolePill"
                className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/80"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Login Admin</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (loginRole !== 'teacher') {
                setLoginRole('teacher');
                setError('');
              }
            }}
            className={`relative flex-1 py-2 px-3 text-xs font-extrabold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer z-10 select-none ${
              loginRole === 'teacher' ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {loginRole === 'teacher' && (
              <motion.div
                layoutId="adminModalRolePill"
                className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/80"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Login Guru</span>
            </span>
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {loginRole === 'admin' ? (
              <motion.div
                key="admin-modal-form"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <form onSubmit={handleSubmitAdmin} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      PIN / Sandi Keamanan Admin
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        placeholder="Masukkan PIN Admin"
                        value={pin}
                        onChange={(e) => {
                          setPin(e.target.value);
                          setError('');
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono tracking-widest text-slate-900"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Akses penuh ke seluruh materi, topik, mapel &amp; akun guru.</p>
                  </div>

                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <span>Memeriksa...</span>
                      ) : (
                        <>
                          <span>Buka Akses Admin</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="teacher-modal-form"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <form onSubmit={handleSubmitTeacher} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Username atau NIP Guru
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Masukkan username atau NIP guru"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setError('');
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Password Guru
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        placeholder="Masukkan password guru"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError('');
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Guru mengelola topik dan materi pada mata pelajaran yang telah ditugaskan.
                  </p>

                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <span>Memeriksa...</span>
                      ) : (
                        <>
                          <span>Buka Akses Guru</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
