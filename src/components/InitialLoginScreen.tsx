import React, { useState, useEffect } from 'react';
import {
  Lock,
  GraduationCap,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  User,
  KeyRound,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  authenticateStudent,
  authenticateTeacher,
  verifyAdminPin,
  fetchStudentProgressDetails,
  fetchStudentQuizScores,
} from '../lib/dataService';
import { AuthSession } from '../types';
import { parseLogoUrl } from '../utils/urlParser';

interface InitialLoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
  onOpenAdminLogin?: () => void;
  siteLogoUrl?: string;
}

export const InitialLoginScreen: React.FC<InitialLoginScreenProps> = ({
  onLoginSuccess,
  onOpenAdminLogin,
  siteLogoUrl = '',
}) => {
  const [loginRole, setLoginRole] = useState<'student' | 'teacher' | 'admin'>('student');

  // Student Form State
  const [studentNisn, setStudentNisn] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  // Teacher Form State
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // Admin Form State
  const [adminPin, setAdminPinInput] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoImgError, setLogoImgError] = useState(false);

  const displayLogoUrl = siteLogoUrl ? parseLogoUrl(siteLogoUrl) : '';

  // Ensure document overflow is clean and free to scroll
  useEffect(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, []);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNisn = studentNisn.trim();
    const cleanPass = studentPassword.trim();
    if (!cleanNisn || !cleanPass) {
      setError('Silakan masukkan NIS / Username dan Password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const student = await authenticateStudent(cleanNisn, cleanPass);
      if (student) {
        // Pre-synchronize student progress directly from Firestore DB
        // so the dashboard opens immediately with 100% complete, synchronized progress
        const candidateIds = [student.id, student.nisn, student.username].filter(Boolean) as string[];
        try {
          await Promise.allSettled([
            fetchStudentProgressDetails(student.id, {
              forceRevalidate: true,
              additionalIds: candidateIds,
              studentName: student.nama,
              kelas: student.kelas,
            }),
            fetchStudentQuizScores(student.id, {
              forceRevalidate: true,
              additionalIds: candidateIds,
              studentName: student.nama,
            }),
          ]);
        } catch {}

        onLoginSuccess({ role: 'student', student });
      } else {
        setError('NIS atau Password tidak cocok. Pastikan NIS Anda sesuai dengan daftar siswa. Jika belum pernah diubah, gunakan password default: pass123');
      }
    } catch (err) {
      setError('Gagal memverifikasi akun siswa. Periksa koneksi internet Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherUsername.trim() || !teacherPassword.trim()) {
      setError('Silakan masukkan Username dan Password Guru');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const teacher = await authenticateTeacher(teacherUsername, teacherPassword);
      if (teacher) {
        onLoginSuccess({ role: 'teacher', teacher });
      } else {
        setError('Username atau Password Guru tidak ditemukan.');
      }
    } catch (err) {
      setError('Gagal memverifikasi akun guru.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPin.trim()) {
      setError('Masukkan PIN Sandi Admin');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const isValid = await verifyAdminPin(adminPin);
      if (isValid) {
        onLoginSuccess({ role: 'admin' });
      } else {
        setError('PIN Admin tidak valid. Coba lagi.');
      }
    } catch (err) {
      setError('Gagal memverifikasi PIN Admin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-gradient-to-br from-blue-50 via-slate-50 to-sky-100/80 text-slate-800 flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none selection:bg-blue-600 selection:text-white">
      {/* Background Ambient Lights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-blue-400/20 via-sky-300/10 to-transparent blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[350px] h-[350px] bg-sky-400/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 my-auto">
        
        {/* Main White Card with Soft Accent */}
        <div className="bg-white/95 border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-2xl shadow-slate-900/10 backdrop-blur-xl overflow-hidden relative flex flex-col max-h-[96dvh]">
          
          {/* Top Accent Bar */}
          <div className="h-1 sm:h-1.5 bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 w-full shrink-0" />

          {/* Discreet Admin Lock Button - Top Right Corner */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
            <button
              type="button"
              onClick={() => {
                if (loginRole === 'admin') {
                  setLoginRole('student');
                } else {
                  setLoginRole('admin');
                }
                setError('');
              }}
              className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer active:scale-95 ${
                loginRole === 'admin'
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                  : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100/80 border border-transparent hover:border-slate-200'
              }`}
              title={loginRole === 'admin' ? "Kembali ke Login Utama" : "Akses Sistem"}
            >
              <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </button>
          </div>

          {/* Logo & Header */}
          <div className="px-4 pt-4 pb-2 sm:p-8 sm:pb-4 sm:pt-7 text-center shrink-0">
            {/* Logo Icon Container */}
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-700 to-sky-600 flex items-center justify-center text-white shadow-md mb-2 sm:mb-3 border border-white/40 relative group">
              {displayLogoUrl && !logoImgError ? (
                <img
                  src={displayLogoUrl}
                  alt="Logo Sekolah"
                  className="w-full h-full object-contain p-1.5 sm:p-2 rounded-xl sm:rounded-2xl"
                  onError={() => setLogoImgError(true)}
                />
              ) : (
                <GraduationCap className="w-7 h-7 sm:w-9 sm:h-9 text-white transition-transform group-hover:scale-110 duration-300" />
              )}
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-blue-50 border border-blue-200/80 text-blue-700 rounded-full text-[10px] sm:text-[11px] font-extrabold mb-1 sm:mb-2">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>SIMPEL • Kurikulum Merdeka</span>
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight font-heading leading-snug">
              {loginRole === 'admin' 
                ? 'Login Administrator' 
                : 'Portal Pembelajaran'}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 font-medium max-w-xs mx-auto leading-tight line-clamp-1 sm:line-clamp-none">
              {loginRole === 'admin'
                ? 'Masukkan PIN Keamanan untuk membuka dashboard.'
                : 'Masuk sebagai Siswa atau Guru untuk mengakses modul & kuis.'}
            </p>
          </div>

          {/* Role Selection Tabs - Displaying ONLY Student and Teacher */}
          {loginRole !== 'admin' ? (
            <div className="px-4 sm:px-5 pb-1 sm:pb-2 shrink-0">
              <div className="relative flex bg-slate-100/90 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (loginRole !== 'student') {
                      setLoginRole('student');
                      setError('');
                    }
                  }}
                  className={`relative flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer transition-colors duration-200 z-10 select-none min-h-[38px] ${
                    loginRole === 'student' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {loginRole === 'student' && (
                    <motion.div
                      layoutId="activeLoginRolePill"
                      className="absolute inset-0 bg-gradient-to-r from-blue-600 to-sky-600 rounded-lg sm:rounded-xl shadow-md shadow-blue-600/25"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                    <GraduationCap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${loginRole === 'student' ? 'text-white' : 'text-slate-500'}`} />
                    <span>Akun Siswa</span>
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
                  className={`relative flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer transition-colors duration-200 z-10 select-none min-h-[38px] ${
                    loginRole === 'teacher' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {loginRole === 'teacher' && (
                    <motion.div
                      layoutId="activeLoginRolePill"
                      className="absolute inset-0 bg-gradient-to-r from-blue-600 to-sky-600 rounded-lg sm:rounded-xl shadow-md shadow-blue-600/25"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                    <UserCheck className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${loginRole === 'teacher' ? 'text-white' : 'text-slate-500'}`} />
                    <span>Akun Guru</span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-5 pb-1 sm:pb-2 shrink-0">
              <div className="flex items-center justify-between bg-blue-50/90 p-2 sm:p-2.5 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl border border-blue-200/90">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-extrabold text-blue-900">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Login Administrator</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('student');
                    setError('');
                  }}
                  className="text-[10px] sm:text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>← Siswa/Guru</span>
                </button>
              </div>
            </div>
          )}

          {/* Form Area */}
          <div className="px-4 py-3 sm:p-8 sm:pt-4 overflow-y-auto sm:overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {loginRole === 'student' ? (
                <motion.div
                  key="student-login-form"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 14 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <form onSubmit={handleStudentLogin} className="space-y-2.5 sm:space-y-4">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5 flex items-center justify-between">
                        <span>NIS (Nomor Induk Siswa)</span>
                        <span className="text-[10px] text-slate-400 font-mono">Nomor Induk</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Masukkan NIS Siswa"
                          value={studentNisn}
                          onChange={(e) => {
                            setStudentNisn(e.target.value);
                            setError('');
                          }}
                          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5 flex items-center justify-between">
                        <span>Password Siswa</span>
                        <span className="text-[10px] text-slate-500 font-normal lowercase">default: <strong className="text-blue-700 font-mono lowercase">pass123</strong></span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Masukkan Password"
                          value={studentPassword}
                          onChange={(e) => {
                            setStudentPassword(e.target.value);
                            setError('');
                          }}
                          className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                        <span className="leading-snug text-[11px] sm:text-xs">{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 sm:py-3.5 px-4 bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 hover:opacity-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 min-h-[42px] sm:min-h-[46px]"
                    >
                      {isLoading ? (
                        <span>Memeriksa Akun Siswa...</span>
                      ) : (
                        <>
                          <span>MASUK SEBAGAI SISWA</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              ) : loginRole === 'teacher' ? (
                <motion.div
                  key="teacher-login-form"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <form onSubmit={handleTeacherLogin} className="space-y-2.5 sm:space-y-4">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5">
                        Username Guru
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Masukkan Username Guru"
                          value={teacherUsername}
                          onChange={(e) => {
                            setTeacherUsername(e.target.value);
                            setError('');
                          }}
                          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5">
                        Password Guru
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Masukkan Password Guru"
                          value={teacherPassword}
                          onChange={(e) => {
                            setTeacherPassword(e.target.value);
                            setError('');
                          }}
                          className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                        <span className="leading-snug text-[11px] sm:text-xs">{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 sm:py-3.5 px-4 bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 min-h-[42px] sm:min-h-[46px]"
                    >
                      {isLoading ? (
                        <span>Memeriksa Akun Guru...</span>
                      ) : (
                        <>
                          <span>MASUK KE HALAMAN GURU</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="admin-login-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <form onSubmit={handleAdminLogin} className="space-y-2.5 sm:space-y-4">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5">
                        PIN Keamanan Admin
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="password"
                          placeholder="Masukkan PIN Admin"
                          value={adminPin}
                          onChange={(e) => {
                            setAdminPinInput(e.target.value);
                            setError('');
                          }}
                          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all font-mono tracking-widest"
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                        <span className="leading-snug text-[11px] sm:text-xs">{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 sm:py-3.5 px-4 bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 min-h-[42px] sm:min-h-[46px]"
                    >
                      {isLoading ? (
                        <span>Memeriksa PIN Admin...</span>
                      ) : (
                        <>
                          <span>MASUK KE HALAMAN ADMIN</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Info */}
          <div className="px-4 py-2.5 sm:px-6 sm:py-3.5 bg-slate-50/90 border-t border-slate-200/80 text-center shrink-0">
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
              Butuh bantuan akses akun? Hubungi Admin Sekolah.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
