export type ThemeAccentColor = 'indigo' | 'crimson' | 'amber' | 'cyan' | 'emerald' | 'purple';

export interface ThemeConfig {
  isEventActive: boolean;
  eventPresetId: string; // 'default' | 'hut_ri' | 'hut_sekolah' | 'ujian' | 'hari_guru' | 'custom'
  title: string;
  subtitle: string;
  badgeText: string;
  customSecondaryBadge?: string;
  customQuote?: string;
  accentColor: ThemeAccentColor;
  bannerBgUrl?: string;
  showOrnaments: boolean;
  ornamentStyle?: 'ribbon' | 'sparkle' | 'stars' | 'confetti' | 'leaves';
  updatedAt?: string;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  isEventActive: false,
  eventPresetId: 'default',
  title: 'Portal Pembelajaran',
  subtitle: 'Masuk sebagai Siswa atau Guru untuk mengakses modul & kuis.',
  badgeText: 'SIMPEL • Kurikulum Merdeka',
  customSecondaryBadge: '',
  customQuote: '',
  accentColor: 'indigo',
  bannerBgUrl: '',
  showOrnaments: false,
  ornamentStyle: 'ribbon',
};

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  iconName: string;
  config: Partial<ThemeConfig>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Original Edukasi (Default)',
    description: 'Nuansa Indigo-Slate modern, bersih, profesional dan netral untuk kegiatan belajar sehari-hari.',
    iconName: 'GraduationCap',
    config: {
      isEventActive: false,
      eventPresetId: 'default',
      title: 'Portal Pembelajaran',
      subtitle: 'Masuk sebagai Siswa atau Guru untuk mengakses modul & kuis.',
      badgeText: 'SIMPEL • Kurikulum Merdeka',
      customSecondaryBadge: '',
      customQuote: '',
      accentColor: 'indigo',
      bannerBgUrl: '',
      showOrnaments: false,
      ornamentStyle: 'ribbon',
    },
  },
  {
    id: 'hut_ri',
    name: 'HUT Kemerdekaan RI (17 Agustus)',
    description: 'Nuansa Merah-Putih elegan, ornamen pita kebangsaan, dan semangat Dirgahayu Republik Indonesia.',
    iconName: 'Flag',
    config: {
      isEventActive: true,
      eventPresetId: 'hut_ri',
      title: 'Dirgahayu Republik Indonesia',
      subtitle: 'Semangat Kemerdekaan dalam Merdeka Belajar Menuju Generasi Emas Bangsa.',
      badgeText: '🇮🇩 Dirgahayu RI • 17 Agustus',
      customSecondaryBadge: 'Nusantara Baru Indonesia Maju',
      customQuote: 'Bangsa yang besar adalah bangsa yang menghargai jasa para pahlawannya.',
      accentColor: 'crimson',
      bannerBgUrl: '',
      showOrnaments: true,
      ornamentStyle: 'ribbon',
    },
  },
  {
    id: 'hut_sekolah',
    name: 'HUT / Dies Natalis Sekolah',
    description: 'Nuansa Emas/Sapphire megah, perayaan milad sekolah penuh kebanggaan dan rasa syukur.',
    iconName: 'Award',
    config: {
      isEventActive: true,
      eventPresetId: 'hut_sekolah',
      title: 'Selamat Ulang Tahun Sekolah',
      subtitle: 'Merayakan dedikasi, inovasi, dan prestasi tanpa henti bersama seluruh sivitas akademika.',
      badgeText: '🎉 Dies Natalis • Milad Sekolah',
      customSecondaryBadge: 'Mengabdi & Berprestasi',
      customQuote: 'Mencetak generasi unggul, berakhlak mulia, dan berwawasan global.',
      accentColor: 'amber',
      bannerBgUrl: '',
      showOrnaments: true,
      ornamentStyle: 'confetti',
    },
  },
  {
    id: 'ujian',
    name: 'Pekan Ujian & Asesmen Nasional',
    description: 'Nuansa Deep Blue/Cyan fokus, atmosfer integritas tinggi, ketelitian, dan kejujuran.',
    iconName: 'ShieldAlert',
    config: {
      isEventActive: true,
      eventPresetId: 'ujian',
      title: 'Pekan Asesmen & Ujian Berbasis Komputer',
      subtitle: 'Kerjakan dengan teliti, percaya diri, dan junjung tinggi integritas serta kejujuran.',
      badgeText: '📝 Pekan Asesmen & Ujian',
      customSecondaryBadge: 'Jujur & Berprestasi',
      customQuote: 'Prestasi itu penting, namun kejujuran adalah yang paling utama.',
      accentColor: 'cyan',
      bannerBgUrl: '',
      showOrnaments: true,
      ornamentStyle: 'sparkle',
    },
  },
  {
    id: 'hari_guru',
    name: 'Hari Guru Nasional & Hardiknas',
    description: 'Nuansa Emerald-Teal inspiratif sebagai bentuk penghormatan dan apresiasi kepada pahlawan tanpa tanda jasa.',
    iconName: 'Sparkles',
    config: {
      isEventActive: true,
      eventPresetId: 'hari_guru',
      title: 'Selamat Hari Guru Nasional',
      subtitle: 'Terima kasih Bapak dan Ibu Guru atas dedikasi dan lentera ilmu yang tak pernah padam.',
      badgeText: '🌟 Bergerak Bersama Rayakan Merdeka Belajar',
      customSecondaryBadge: 'Pahlawan Tanpa Tanda Jasa',
      customQuote: 'Guru adalah pelita dalam kegelapan, penuntun jalan meraih cita-cita.',
      accentColor: 'emerald',
      bannerBgUrl: '',
      showOrnaments: true,
      ornamentStyle: 'leaves',
    },
  },
];
