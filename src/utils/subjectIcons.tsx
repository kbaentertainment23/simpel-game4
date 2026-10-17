import React from 'react';
import {
  Code2,
  Cpu,
  Network,
  Database,
  Terminal,
  Globe,
  Calculator,
  Percent,
  Binary,
  Compass,
  Ruler,
  BrainCircuit,
  Atom,
  FlaskConical,
  Dna,
  Microscope,
  Zap,
  Landmark,
  Scale,
  TrendingUp,
  Coins,
  Users,
  BookOpen,
  Languages,
  MessageSquare,
  Feather,
  Palette,
  Music,
  Clapperboard,
  Scissors,
  Dumbbell,
  Activity,
  Trophy,
  HeartHandshake,
  GraduationCap,
  BookMarked,
  Award,
  Sparkles,
  Laptop,
  Flame,
  Sun,
  Flower2,
  Scroll,
  BookHeart,
  Church,
  Moon,
  ShieldCheck,
} from 'lucide-react';

export interface IconOption {
  key: string;
  label: string;
  category: string;
  icon: React.ReactNode;
}

export const ICON_CATEGORIES = [
  'Semua',
  'Informatika & TIK',
  'Matematika & Logika',
  'Sains (IPA)',
  'IPS & Ekonomi',
  'Bahasa & Sastra',
  'Seni, PJOK & Prakarya',
  'Agama & Umum',
] as const;

export const SUBJECT_ICON_LIST: IconOption[] = [
  // Informatika & TIK
  { key: 'Code2', label: 'Informatika / Pemrograman', category: 'Informatika & TIK', icon: <Code2 className="w-5 h-5" /> },
  { key: 'Laptop', label: 'TIK / Komputer', category: 'Informatika & TIK', icon: <Laptop className="w-5 h-5" /> },
  { key: 'Cpu', label: 'Hardware / Sistem Komputer', category: 'Informatika & TIK', icon: <Cpu className="w-5 h-5" /> },
  { key: 'Network', label: 'Jaringan & Internet', category: 'Informatika & TIK', icon: <Network className="w-5 h-5" /> },
  { key: 'Database', label: 'Basis Data & Analisis', category: 'Informatika & TIK', icon: <Database className="w-5 h-5" /> },
  { key: 'Terminal', label: 'Algoritma / Coding', category: 'Informatika & TIK', icon: <Terminal className="w-5 h-5" /> },

  // Matematika & Logika
  { key: 'Calculator', label: 'Matematika Dasar / Berhitung', category: 'Matematika & Logika', icon: <Calculator className="w-5 h-5" /> },
  { key: 'BrainCircuit', label: 'Berpikir Komputasional / Logika', category: 'Matematika & Logika', icon: <BrainCircuit className="w-5 h-5" /> },
  { key: 'Compass', label: 'Geometri / Pengukuran', category: 'Matematika & Logika', icon: <Compass className="w-5 h-5" /> },
  { key: 'Ruler', label: 'Pengukuran / Arsitektur', category: 'Matematika & Logika', icon: <Ruler className="w-5 h-5" /> },
  { key: 'Percent', label: 'Statistika / Peluang', category: 'Matematika & Logika', icon: <Percent className="w-5 h-5" /> },
  { key: 'Binary', label: 'Matematika Diskrit / Biner', category: 'Matematika & Logika', icon: <Binary className="w-5 h-5" /> },

  // Sains (IPA)
  { key: 'Atom', label: 'Fisika / Sains Umum', category: 'Sains (IPA)', icon: <Atom className="w-5 h-5" /> },
  { key: 'FlaskConical', label: 'Kimia / Praktikum Lab', category: 'Sains (IPA)', icon: <FlaskConical className="w-5 h-5" /> },
  { key: 'Dna', label: 'Biologi / Genetika', category: 'Sains (IPA)', icon: <Dna className="w-5 h-5" /> },
  { key: 'Microscope', label: 'Biologi / Observasi', category: 'Sains (IPA)', icon: <Microscope className="w-5 h-5" /> },
  { key: 'Zap', label: 'Fisika Energi & Listrik', category: 'Sains (IPA)', icon: <Zap className="w-5 h-5" /> },

  // IPS & Ekonomi
  { key: 'Globe', label: 'Geografi / Lingkungan', category: 'IPS & Ekonomi', icon: <Globe className="w-5 h-5" /> },
  { key: 'Landmark', label: 'Sejarah / Pancasila / PPKn', category: 'IPS & Ekonomi', icon: <Landmark className="w-5 h-5" /> },
  { key: 'Scale', label: 'Hukum / Tata Negara / PPKn', category: 'IPS & Ekonomi', icon: <Scale className="w-5 h-5" /> },
  { key: 'TrendingUp', label: 'Ekonomi / Bisnis', category: 'IPS & Ekonomi', icon: <TrendingUp className="w-5 h-5" /> },
  { key: 'Coins', label: 'Akuntansi / Keuangan', category: 'IPS & Ekonomi', icon: <Coins className="w-5 h-5" /> },
  { key: 'Users', label: 'Sosiologi / Antropologi', category: 'IPS & Ekonomi', icon: <Users className="w-5 h-5" /> },

  // Bahasa & Sastra
  { key: 'BookOpen', label: 'Bahasa Indonesia / Literasi', category: 'Bahasa & Sastra', icon: <BookOpen className="w-5 h-5" /> },
  { key: 'Languages', label: 'Bahasa Inggris / Asing', category: 'Bahasa & Sastra', icon: <Languages className="w-5 h-5" /> },
  { key: 'MessageSquare', label: 'Sastra / Komunikasi', category: 'Bahasa & Sastra', icon: <MessageSquare className="w-5 h-5" /> },
  { key: 'Feather', label: 'Seni Menulis / Puisi', category: 'Bahasa & Sastra', icon: <Feather className="w-5 h-5" /> },

  // Seni, PJOK & Prakarya
  { key: 'Palette', label: 'Seni Budaya / Seni Rupa', category: 'Seni, PJOK & Prakarya', icon: <Palette className="w-5 h-5" /> },
  { key: 'Music', label: 'Seni Musik', category: 'Seni, PJOK & Prakarya', icon: <Music className="w-5 h-5" /> },
  { key: 'Clapperboard', label: 'Seni Teater / Film', category: 'Seni, PJOK & Prakarya', icon: <Clapperboard className="w-5 h-5" /> },
  { key: 'Scissors', label: 'Prakarya & Kewirausahaan (PKWU)', category: 'Seni, PJOK & Prakarya', icon: <Scissors className="w-5 h-5" /> },
  { key: 'Dumbbell', label: 'PJOK / Olahraga', category: 'Seni, PJOK & Prakarya', icon: <Dumbbell className="w-5 h-5" /> },
  { key: 'Activity', label: 'Kesehatan / Kebugaran', category: 'Seni, PJOK & Prakarya', icon: <Activity className="w-5 h-5" /> },

  // Agama & Umum
  { key: 'Flame', label: 'Pendidikan Agama Hindu (Agni / Yadnya)', category: 'Agama & Umum', icon: <Flame className="w-5 h-5" /> },
  { key: 'Sun', label: 'Pendidikan Agama Hindu (Surya / Gayatri)', category: 'Agama & Umum', icon: <Sun className="w-5 h-5" /> },
  { key: 'Flower2', label: 'Pendidikan Agama Hindu (Padma / Sembahyang)', category: 'Agama & Umum', icon: <Flower2 className="w-5 h-5" /> },
  { key: 'Scroll', label: 'Pendidikan Agama Hindu (Kitab Suci Veda)', category: 'Agama & Umum', icon: <Scroll className="w-5 h-5" /> },
  { key: 'BookHeart', label: 'Pendidikan Agama & Budi Pekerti', category: 'Agama & Umum', icon: <BookHeart className="w-5 h-5" /> },
  { key: 'HeartHandshake', label: 'Budi Pekerti & Karakter', category: 'Agama & Umum', icon: <HeartHandshake className="w-5 h-5" /> },
  { key: 'Moon', label: 'Pendidikan Agama Islam', category: 'Agama & Umum', icon: <Moon className="w-5 h-5" /> },
  { key: 'Church', label: 'Pendidikan Agama Kristen / Katolik', category: 'Agama & Umum', icon: <Church className="w-5 h-5" /> },
  { key: 'ShieldCheck', label: 'Dharma & Etika Kebajikan', category: 'Agama & Umum', icon: <ShieldCheck className="w-5 h-5" /> },
  { key: 'GraduationCap', label: 'Modul Umum / Akademik', category: 'Agama & Umum', icon: <GraduationCap className="w-5 h-5" /> },
  { key: 'BookMarked', label: 'Kurikulum Merdeka / CP', category: 'Agama & Umum', icon: <BookMarked className="w-5 h-5" /> },
  { key: 'Award', label: 'Prestasi / Intrakurikuler', category: 'Agama & Umum', icon: <Award className="w-5 h-5" /> },
  { key: 'Sparkles', label: 'Projek P5 / Ekstrakurikuler', category: 'Agama & Umum', icon: <Sparkles className="w-5 h-5" /> },
  { key: 'Trophy', label: 'Olimpiade / Lomba', category: 'Agama & Umum', icon: <Trophy className="w-5 h-5" /> },
];

export function getSubjectIcon(key?: string, className = 'w-5 h-5'): React.ReactNode {
  if (!key) return <BookOpen className={className} />;
  const found = SUBJECT_ICON_LIST.find((item) => item.key.toLowerCase() === key.toLowerCase());
  if (found) {
    return React.cloneElement(found.icon as React.ReactElement, { className });
  }
  // Fallbacks for known keys or default
  switch (key) {
    case 'Code2': return <Code2 className={className} />;
    case 'BrainCircuit': return <BrainCircuit className={className} />;
    case 'Cpu': return <Cpu className={className} />;
    case 'Network': return <Network className={className} />;
    case 'Database': return <Database className={className} />;
    case 'Flame': return <Flame className={className} />;
    case 'Sun': return <Sun className={className} />;
    case 'Flower2': return <Flower2 className={className} />;
    case 'Scroll': return <Scroll className={className} />;
    case 'BookHeart': return <BookHeart className={className} />;
    default: return <BookOpen className={className} />;
  }
}
