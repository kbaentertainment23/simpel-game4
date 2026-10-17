import { Material } from '../types';

export type GFormAccessStatus =
  | 'unrestricted'
  | 'not_started'
  | 'active'
  | 'expired'
  | 'manually_unlocked';

export interface GFormAccessCheckResult {
  isAccessible: boolean;
  status: GFormAccessStatus;
  statusLabel: string;
  statusBadgeColor: string; // Tailwind class
  statusDescription: string;
  startDate: Date | null;
  endDate: Date | null;
  formattedStart: string;
  formattedEnd: string;
  remainingTimeText?: string;
  isExpired: boolean;
  isNotStarted: boolean;
  isManuallyUnlocked: boolean;
  isRestricted: boolean;
}

/**
 * Formats an ISO string or datetime-local string to readable Indonesian date-time.
 * Example: "2025-10-20T08:00" -> "Senin, 20 Okt 2025, 08:00 WIB"
 */
export function formatAccessDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' WIB';
  } catch {
    return dateStr;
  }
}

/**
 * Calculates human readable remaining time between now and target date.
 */
export function formatRemainingTime(targetDate: Date): string {
  const diffMs = targetDate.getTime() - Date.now();
  if (diffMs <= 0) return 'Waktu habis';

  const diffSec = Math.floor(diffMs / 1000);
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  if (days > 0) {
    return `${days} hari ${hours} jam`;
  }
  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }
  return `${minutes} menit`;
}

/**
 * Checks whether a Google Form material is accessible for the user right now.
 */
export function checkGFormAccess(
  material: Material,
  isTeacherOrAdmin: boolean = false
): GFormAccessCheckResult {
  // Non-gform materials are always unrestricted
  if (material.type !== 'gform') {
    return {
      isAccessible: true,
      status: 'unrestricted',
      statusLabel: 'Terbuka',
      statusBadgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      statusDescription: 'Materi terbuka tanpa batasan jadwal.',
      startDate: null,
      endDate: null,
      formattedStart: '-',
      formattedEnd: '-',
      isExpired: false,
      isNotStarted: false,
      isManuallyUnlocked: false,
      isRestricted: false,
    };
  }

  const isRestricted = Boolean(material.isAccessTimeRestricted);
  const startStr = material.accessStartDate?.trim();
  const endStr = material.accessEndDate?.trim();
  const isManuallyUnlocked = Boolean(material.isManuallyUnlocked);

  // If time restriction is not active and no dates are specified
  if (!isRestricted && !startStr && !endStr) {
    return {
      isAccessible: true,
      status: 'unrestricted',
      statusLabel: 'Akses Bebas (Tanpa Batas Waktu)',
      statusBadgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      statusDescription: 'Google Form ini tidak memiliki batasan jadwal pengerjaan.',
      startDate: null,
      endDate: null,
      formattedStart: '-',
      formattedEnd: '-',
      isExpired: false,
      isNotStarted: false,
      isManuallyUnlocked: false,
      isRestricted: false,
    };
  }

  const now = new Date();
  const startDate = startStr ? new Date(startStr) : null;
  const endDate = endStr ? new Date(endStr) : null;

  const validStart = startDate && !isNaN(startDate.getTime()) ? startDate : null;
  const validEnd = endDate && !isNaN(endDate.getTime()) ? endDate : null;

  const formattedStart = validStart ? formatAccessDateTime(startStr) : 'Langsung Buka';
  const formattedEnd = validEnd ? formatAccessDateTime(endStr) : 'Tidak Terbatas';

  // 1. Check if Manually Unlocked by Admin or Teacher (Bypass lock)
  if (isManuallyUnlocked) {
    return {
      isAccessible: true,
      status: 'manually_unlocked',
      statusLabel: 'Dibuka Manual (Guru/Admin)',
      statusBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      statusDescription: 'Ujian ini telah dibuka kembali oleh guru / administrator untuk siswa.',
      startDate: validStart,
      endDate: validEnd,
      formattedStart,
      formattedEnd,
      remainingTimeText: 'Akses dibuka khusus',
      isExpired: false,
      isNotStarted: false,
      isManuallyUnlocked: true,
      isRestricted: true,
    };
  }

  // 2. Check if before start date
  if (validStart && now < validStart) {
    const isAccessible = isTeacherOrAdmin; // Teachers can preview ahead of time
    return {
      isAccessible,
      status: 'not_started',
      statusLabel: 'Belum Dimulai',
      statusBadgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
      statusDescription: `Ujian Google Form baru dapat diakses pada ${formattedStart}.`,
      startDate: validStart,
      endDate: validEnd,
      formattedStart,
      formattedEnd,
      remainingTimeText: `Mulai dalam ${formatRemainingTime(validStart)}`,
      isExpired: false,
      isNotStarted: true,
      isManuallyUnlocked: false,
      isRestricted: true,
    };
  }

  // 3. Check if after end date
  if (validEnd && now > validEnd) {
    const isAccessible = isTeacherOrAdmin; // Teachers can review
    return {
      isAccessible,
      status: 'expired',
      statusLabel: 'Waktu Habis & Terkunci',
      statusBadgeColor: 'bg-rose-50 text-rose-800 border-rose-300',
      statusDescription: `Batas waktu pengerjaan telah berakhir pada ${formattedEnd}. Ujian otomatis dikunci.`,
      startDate: validStart,
      endDate: validEnd,
      formattedStart,
      formattedEnd,
      remainingTimeText: 'Waktu ujian telah berakhir',
      isExpired: true,
      isNotStarted: false,
      isManuallyUnlocked: false,
      isRestricted: true,
    };
  }

  // 4. In active window
  return {
    isAccessible: true,
    status: 'active',
    statusLabel: 'Sesi Ujian Aktif',
    statusBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    statusDescription: validEnd
      ? `Sesi pengerjaan aktif hingga ${formattedEnd}.`
      : 'Sesi pengerjaan sedang aktif.',
    startDate: validStart,
    endDate: validEnd,
    formattedStart,
    formattedEnd,
    remainingTimeText: validEnd ? `Sisa waktu: ${formatRemainingTime(validEnd)}` : undefined,
    isExpired: false,
    isNotStarted: false,
    isManuallyUnlocked: false,
    isRestricted: true,
  };
}
