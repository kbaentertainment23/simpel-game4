import * as XLSX from 'xlsx';
import { StudentAccount, TeacherAccount, Subject, Category, Material, SystemBackupData, StudentProgressRecord, AdminSettings } from '../types';
import { getDefaultGamificationData } from './gamification';

export interface ParsedStudentRow {
  nama: string;
  kelas: string;
  noAbsen: string;
  nisn: string;
  username: string;
  password: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParsedTeacherRow {
  name: string;
  nip: string;
  username: string;
  password: string;
  subjectId: string;
  subjectName: string;
  assignedClasses: string[];
  isValid: boolean;
  errorMessage?: string;
}


/**
 * Generates and downloads a clean, beautifully formatted Excel template for Student Import.
 */
export function downloadStudentTemplate(): void {
  const sampleData = [
    {
      'Nama Lengkap': 'Andi Pratama',
      'Kelas': '8.1',
      'No. Absen': '1',
      'NIS': '1234001',
      'Password (Opsional)': 'pass123',
    },
    {
      'Nama Lengkap': 'Budi Santoso',
      'Kelas': '8.1',
      'No. Absen': '2',
      'NIS': '1234002',
      'Password (Opsional)': 'pass123',
    },
    {
      'Nama Lengkap': 'Dian Permata',
      'Kelas': '8.2',
      'No. Absen': '1',
      'NIS': '2234001',
      'Password (Opsional)': 'pass123',
    },
    {
      'Nama Lengkap': 'Fajar Nugraha',
      'Kelas': '8.11',
      'No. Absen': '1',
      'NIS': '1123401',
      'Password (Opsional)': 'pass123',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for neat display
  worksheet['!cols'] = [
    { wch: 28 }, // Nama Lengkap
    { wch: 12 }, // Kelas
    { wch: 14 }, // No. Absen
    { wch: 20 }, // NIS
    { wch: 22 }, // Password
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');

  // Add an instruction sheet for clarity
  const instructionData = [
    { 'PANDUAN PENGISIAN TEMPLATE IMPORT SISWA': 'Petunjuk Tambahan:' },
    { 'PANDUAN PENGISIAN TEMPLATE IMPORT SISWA': '1. Kolom Nama Lengkap, Kelas, dan NIS WAJIB diisi.' },
    { 'PANDUAN PENGISIAN TEMPLATE IMPORT SISWA': '2. NIS (Nomor Induk Siswa) digunakan siswa sebagai username untuk masuk ke portal.' },
    { 'PANDUAN PENGISIAN TEMPLATE IMPORT SISWA': '3. Jika Password dikosongkan, sistem otomatis memberikan password default "pass123".' },
    { 'PANDUAN PENGISIAN TEMPLATE IMPORT SISWA': '4. Jangan mengubah nama header di baris pertama lembar "Data Siswa".' },
  ];
  const instructionSheet = XLSX.utils.json_to_sheet(instructionData);
  instructionSheet['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Petunjuk Pengisian');

  XLSX.writeFile(workbook, 'Template_Import_Akun_Siswa.xlsx');
}

/**
 * Generates and downloads a clean, beautifully formatted Excel template for Teacher Import.
 */
export function downloadTeacherTemplate(subjects: Subject[] = []): void {
  const safeSubjects = subjects || [];
  const subjectListStr = safeSubjects.length > 0
    ? safeSubjects.map(s => `${s.name} (${s.code || 'Tanpa Kode'})`).join(', ')
    : 'Belum ada mata pelajaran. Buat mata pelajaran terlebih dahulu di admin.';

  const sampleData = [
    {
      'Nama Lengkap Guru': 'Drs. Bambang Wijaya, M.Pd.',
      'NIP / NIK (Opsional)': '198001012005011001',
      'Username Login': 'bambang_ipa',
      'Password Login': 'gurupass123',
      'Mata Pelajaran Pengampuan': safeSubjects[0] ? safeSubjects[0].name : 'IPA',
      'Kelas Mengajar (Contoh: 7.1, 7.2)': '7.1, 7.2',
    },
    {
      'Nama Lengkap Guru': 'Siti Aminah, S.Pd.',
      'NIP / NIK (Opsional)': '198502022010012002',
      'Username Login': 'siti_mtk',
      'Password Login': 'gurupass123',
      'Mata Pelajaran Pengampuan': safeSubjects[1] ? safeSubjects[1].name : (safeSubjects[0] ? safeSubjects[0].name : 'Matematika'),
      'Kelas Mengajar (Contoh: 7.1, 7.2)': '8.1, 8.2',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 32 }, // Nama Lengkap
    { wch: 24 }, // NIP/NIK
    { wch: 20 }, // Username
    { wch: 20 }, // Password
    { wch: 35 }, // Mata Pelajaran
    { wch: 32 }, // Kelas Mengajar
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Guru');

  // Add Instructions & Subject Reference sheet
  const refData = [
    { 'PETUNJUK IMPORT GURU': '1. Kolom Nama Lengkap Guru, Username Login, dan Password Login WAJIB diisi.' },
    { 'PETUNJUK IMPORT GURU': '2. Isikan kolom Mata Pelajaran Pengampuan dengan nama atau kode mata pelajaran yang sudah ada di sistem.' },
    { 'PETUNJUK IMPORT GURU': `DAFTAR MATA PELAJARAN TERSEDIA DI SISTEM:` },
    ...safeSubjects.map(s => ({
      'PETUNJUK IMPORT GURU': `• ${s.name} ${s.code ? `[Kode: ${s.code}]` : ''}`
    }))
  ];
  const refSheet = XLSX.utils.json_to_sheet(refData);
  refSheet['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, refSheet, 'Petunjuk & Daftar Mapel');

  XLSX.writeFile(workbook, 'Template_Import_Akun_Guru.xlsx');
}

/**
 * Parses an uploaded Excel or CSV file for Students, including duplicate detection in-sheet.
 */
export async function parseStudentExcelFile(file: File): Promise<ParsedStudentRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });

  const allParsedRows: ParsedStudentRow[] = [];
  const seenNisns = new Map<string, number>();
  const seenUsernames = new Map<string, number>();

  // Filter out obvious instruction / cover sheets
  const candidateSheets: string[] = [];
  for (const sName of workbook.SheetNames) {
    const sLower = sName.toLowerCase().trim();
    if (
      !sLower.includes('petunjuk') &&
      !sLower.includes('panduan') &&
      !sLower.includes('cover') &&
      !sLower.includes('instruksi') &&
      !sLower.includes('readme')
    ) {
      candidateSheets.push(sName);
    }
  }

  const sheetsToScan = candidateSheets.length > 0 ? candidateSheets : workbook.SheetNames;

  for (const sheetName of sheetsToScan) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to raw 2D array to locate table header row (accommodates school title banners up to 50 rows)
    const sheetMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (!sheetMatrix || sheetMatrix.length === 0) continue;

    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(sheetMatrix.length, 50); r++) {
      const row = sheetMatrix[r] || [];
      const joined = row
        .map((c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
        .join(' ');
      // Look for key student columns in the row
      if (
        (joined.includes('nama') &&
          (joined.includes('nis') ||
            joined.includes('kelas') ||
            joined.includes('absen') ||
            joined.includes('urut') ||
            joined.includes('gender') ||
            joined.includes('kelamin') ||
            joined.includes('ttl') ||
            joined.includes('lahir') ||
            joined.includes('rombel'))) ||
        joined.includes('namasiswa') ||
        joined.includes('namapesertadidik') ||
        (joined.includes('nis') && joined.includes('kelas'))
      ) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      if (sheetsToScan.length === 1) {
        headerRowIdx = 0;
      } else {
        continue; // Skip non-student sheets (e.g. metadata or summary sheets)
      }
    }

    // Read objects from the detected header row with formatted text
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
      range: headerRowIdx,
    });

    // Detect if sheetName itself represents a class (e.g. "7A", "VII-B", "Kelas 8.1", "IX-C")
    const cleanSheetName = sheetName.trim();
    const sheetClassFallback = /^(kelas\s*)?([0-9]{1,2}|vii|viii|ix|x|xi|xii)[a-z0-9\-\.\s]*$/i.test(cleanSheetName)
      ? cleanSheetName
      : '';

    for (const row of rawRows) {
      const findValue = (keys: string[], excludeSubstrings: string[] = []): string => {
        // Pass 1: exact match on sanitized header
        for (const k of Object.keys(row)) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (excludeSubstrings.some((ex) => cleanK.includes(ex))) continue;

          for (const targetKey of keys) {
            const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanK === cleanTarget) {
              const val = String(row[k] ?? '').trim();
              if (val) return val;
            }
          }
        }

        // Pass 2: prefix or substring match if no exact match found
        for (const k of Object.keys(row)) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (excludeSubstrings.some((ex) => cleanK.includes(ex))) continue;

          for (const targetKey of keys) {
            const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanK.startsWith(cleanTarget) || cleanK.includes(cleanTarget)) {
              const val = String(row[k] ?? '').trim();
              if (val) return val;
            }
          }
        }
        return '';
      };

      const nama = findValue(
        ['namalengkap', 'namapesertadidik', 'namasiswa', 'nama', 'fullname', 'studentname'],
        ['ayah', 'ibu', 'wali', 'orangtua', 'guru', 'pengajar', 'sekolah', 'instansi']
      );

      let kelas = findValue(
        ['kelas', 'kelastugas', 'rombel', 'rombonganbelajar', 'tingkat', 'grade', 'class'],
        []
      );

      // Fallback kelas from sheet name if column is absent
      if (!kelas && sheetClassFallback) {
        kelas = sheetClassFallback;
      }

      const noAbsen = findValue(
        ['noabsen', 'nomorabsen', 'absen', 'nourut', 'no', 'nomor'],
        ['induk', 'nis', 'telepon', 'hp', 'wa', 'telp', 'ujian', 'peserta']
      );

      // CRITICAL: Exclude 'kelamin', 'gender', 'jk' so 'Jenis Kelamin' never collides with 'nis'
      const rawNis = findValue(
        ['nis', 'nisn', 'nomorinduk', 'nomorinduksiswa', 'nomornis', 'nomornisn', 'noinduk', 'nonis', 'nonisn', 'idlogin'],
        ['kelamin', 'gender', 'jk', 'jenis', 'absen', 'urut', 'hp', 'wa', 'telp', 'status', 'agama']
      );

      // Normalize NIS: strip trailing decimals, apostrophes, and handle scientific float notation
      let nisn = rawNis.replace(/^'+/, '').replace(/\.0+$/, '').trim();
      if (/^[0-9]+(\.[0-9]+)?[eE]\+[0-9]+$/.test(nisn)) {
        try {
          nisn = BigInt(Math.round(Number(nisn))).toString();
        } catch {
          // fallback
        }
      }

      // If row has no name and no NIS, it's completely empty / padding row
      if (!nama && !nisn) continue;

      const currentRowGlobalIdx = allParsedRows.length;
      let isAutoGeneratedNis = false;

      // Smart fallback: If NIS is empty but student has a Name, auto-generate a provisional NIS so import is not blocked
      if (!nisn && nama) {
        const cleanClass = (kelas || 'SISWA').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
        const absenPart = noAbsen ? String(noAbsen).padStart(2, '0') : String(currentRowGlobalIdx + 1).padStart(3, '0');
        nisn = `${cleanClass}_${absenPart}`;
        isAutoGeneratedNis = true;
      }

      const usernameRaw = findValue(['usernamelogin', 'username', 'user', 'idlogin', 'akun'], ['guru', 'admin']) || nisn;
      let username = usernameRaw.replace(/^'+/, '').replace(/\.0+$/, '').trim();
      const password = findValue(['passwordlogin', 'password', 'pass', 'katasandi']) || 'pass123';

      let isValid = true;
      const errs: string[] = [];

      if (!nama) {
        isValid = false;
        errs.push('Nama belum diisi');
      }
      if (!kelas) {
        isValid = false;
        errs.push('Kelas belum diisi');
      }
      if (!nisn) {
        isValid = false;
        errs.push('NIS belum diisi');
      }

      // Check deduplication within file
      if (nisn) {
        if (isAutoGeneratedNis && seenNisns.has(nisn)) {
          nisn = `${nisn}_${currentRowGlobalIdx + 1}`;
          username = nisn;
        }

        if (seenNisns.has(nisn)) {
          isValid = false;
          errs.push(`Duplikasi NIS dalam file (Baris #${seenNisns.get(nisn)! + 1})`);
        } else {
          seenNisns.set(nisn, currentRowGlobalIdx);
        }
      }

      if (username) {
        const cleanU = username.toLowerCase();
        if (seenUsernames.has(cleanU)) {
          isValid = false;
          errs.push(`Duplikasi Username dalam file (Baris #${seenUsernames.get(cleanU)! + 1})`);
        } else {
          seenUsernames.set(cleanU, currentRowGlobalIdx);
        }
      }

      if (isAutoGeneratedNis) {
        errs.push('(NIS dibuat otomatis)');
      }

      allParsedRows.push({
        nama,
        kelas,
        noAbsen,
        nisn,
        username,
        password: password || 'pass123',
        isValid,
        errorMessage: errs.join(', '),
      });
    }
  }

  return allParsedRows;
}

/**
 * Parses an uploaded Excel or CSV file for Teachers, including duplicate detection in-sheet.
 */
export async function parseTeacherExcelFile(
  file: File,
  subjects: Subject[]
): Promise<ParsedTeacherRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });

  let targetSheetName = workbook.SheetNames[0];
  for (const sName of workbook.SheetNames) {
    const sLower = sName.toLowerCase();
    if (sLower.includes('guru') || sLower.includes('teacher') || sLower.includes('pendidik') || sLower.includes('data')) {
      targetSheetName = sName;
      break;
    }
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) return [];

  // Locate header row dynamically
  const sheetMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(sheetMatrix.length, 15); r++) {
    const row = sheetMatrix[r] || [];
    const joined = row
      .map((c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
      .join(' ');
    if (
      joined.includes('nama') ||
      joined.includes('nip') ||
      joined.includes('guru') ||
      joined.includes('mapel')
    ) {
      headerRowIdx = r;
      break;
    }
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
    range: headerRowIdx,
  });

  const seenUsernames = new Map<string, number>();
  const seenNips = new Map<string, number>();

  const parsedRows: ParsedTeacherRow[] = rawRows.map((row, idx) => {
    const findValue = (keys: string[]): string => {
      for (const k of Object.keys(row)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const targetKey of keys) {
          if (cleanK === targetKey.toLowerCase().replace(/[^a-z0-9]/g, '') || cleanK.includes(targetKey.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    const name = findValue(['namalengkapguru', 'nama', 'namaguru', 'namalengkap']);
    const nip = findValue(['nipnik', 'nip', 'nik']);
    const username = findValue(['usernamelogin', 'username', 'user']);
    const password = findValue(['passwordlogin', 'password', 'pass']) || 'gurupass123';
    const subjectInput = findValue(['matapelajaranpengampuan', 'matapelajaran', 'mapel', 'subject']);
    const classesInput = findValue(['kelasmengajar', 'kelasamfuan', 'kelas', 'assignedclasses']);

    const assignedClasses = classesInput
      ? classesInput.split(/[,;\n]+/).map(c => c.trim()).filter(Boolean)
      : [];

    // Match subject with available subjects
    let subjectId = '';
    let subjectName = subjectInput || 'Belum Ditentukan';

    if (subjectInput && subjects.length > 0) {
      const cleanInput = subjectInput.toLowerCase().trim();
      const matched = subjects.find(
        s => s.name.toLowerCase().includes(cleanInput) ||
             cleanInput.includes(s.name.toLowerCase()) ||
             (s.code && s.code.toLowerCase().trim() === cleanInput)
      );
      if (matched) {
        subjectId = matched.id;
        subjectName = matched.name;
      } else {
        // Fallback to first available subject if name doesn't match
        subjectId = subjects[0].id;
        subjectName = `${subjects[0].name} (Otomatis)`;
      }
    } else if (subjects.length > 0) {
      subjectId = subjects[0].id;
      subjectName = subjects[0].name;
    }

    let isValid = true;
    const errs: string[] = [];

    if (!name) {
      isValid = false;
      errs.push('Nama Guru belum diisi');
    }
    if (!username) {
      isValid = false;
      errs.push('Username belum diisi');
    }

    if (username) {
      const cleanU = username.toLowerCase();
      if (seenUsernames.has(cleanU)) {
        isValid = false;
        errs.push(`Duplikasi Username dalam file (Baris #${seenUsernames.get(cleanU)! + 1})`);
      } else {
        seenUsernames.set(cleanU, idx);
      }
    }

    if (nip) {
      if (seenNips.has(nip)) {
        isValid = false;
        errs.push(`Duplikasi NIP/NIK dalam file (Baris #${seenNips.get(nip)! + 1})`);
      } else {
        seenNips.set(nip, idx);
      }
    }

    return {
      name,
      nip,
      username,
      password: password || 'gurupass123',
      subjectId,
      subjectName,
      assignedClasses,
      isValid,
      errorMessage: errs.join(', '),
    };
  });

  return parsedRows.filter(r => r.name || r.username);
}


/**
 * Exports a list of student accounts to a formatted Excel file with requested columns:
 * Nomor Absen, Nama, NIS, Kelas, Password.
 */
export function exportStudentsToExcel(students: StudentAccount[] = [], fileName: string = 'Data_Siswa.xlsx'): void {
  const sorted = [...students].sort((a, b) => {
    const classComp = (a.kelas || '').localeCompare(b.kelas || '', 'id');
    if (classComp !== 0) return classComp;
    const numA = parseInt(a.noAbsen || '', 10);
    const numB = parseInt(b.noAbsen || '', 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return (a.nama || '').localeCompare(b.nama || '', 'id');
  });

  const data = sorted.map((s, idx) => {
    const noAbsenVal = s.noAbsen && !isNaN(Number(s.noAbsen)) ? Number(s.noAbsen) : (s.noAbsen || idx + 1);
    return {
      'Nomor Absen': noAbsenVal,
      'Nama': s.nama || '-',
      'NIS': s.nisn || s.username || '-',
      'Kelas': s.kelas || '-',
      'Password': s.password || (s.isDefaultPassword ? 'pass123' : '••••••••'),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 14 }, // Nomor Absen
    { wch: 32 }, // Nama
    { wch: 20 }, // NIS
    { wch: 12 }, // Kelas
    { wch: 18 }, // Password
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');
  XLSX.writeFile(workbook, fileName);
}

/**
 * Exports student accounts of a specific class to Excel with standard columns:
 * Nomor Absen, Nama, NIS, Kelas, Password.
 */
export function exportStudentsByClassToExcel(students: StudentAccount[] = [], className: string): void {
  const classStudents = students.filter(
    s => (s.kelas || '').trim().toLowerCase() === className.trim().toLowerCase()
  );
  const sorted = [...classStudents].sort((a, b) => {
    const numA = parseInt(a.noAbsen || '', 10);
    const numB = parseInt(b.noAbsen || '', 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return (a.nama || '').localeCompare(b.nama || '', 'id');
  });

  const data = sorted.map((s, idx) => {
    const noAbsenVal = s.noAbsen && !isNaN(Number(s.noAbsen)) ? Number(s.noAbsen) : (s.noAbsen || idx + 1);
    return {
      'Nomor Absen': noAbsenVal,
      'Nama': s.nama || '-',
      'NIS': s.nisn || s.username || '-',
      'Kelas': s.kelas || className,
      'Password': s.password || (s.isDefaultPassword ? 'pass123' : '••••••••'),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 14 }, // Nomor Absen
    { wch: 32 }, // Nama
    { wch: 20 }, // NIS
    { wch: 12 }, // Kelas
    { wch: 18 }, // Password
  ];

  const workbook = XLSX.utils.book_new();
  const sheetTitle = `Kelas ${className}`.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
  const safeClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `Data_Siswa_Kelas_${safeClassName}.xlsx`);
}

/**
 * Exports a list of teacher accounts to a formatted Excel file.
 */
export function exportTeachersToExcel(teachers: TeacherAccount[] = [], subjects: Subject[] = [], fileName: string = 'Data_Akun_Guru.xlsx'): void {
  const data = (teachers || []).map((t, idx) => {
    const subj = (subjects || []).find(s => s && s.id === t.subjectId);
    return {
      'No.': idx + 1,
      'Nama Guru': t.name,
      'NIP / NIK': t.nip || '-',
      'Mata Pelajaran': subj ? `${subj.name} (${subj.code || '-'})` : '-',
      'Kelas Mengajar': (t.assignedClasses && t.assignedClasses.length > 0) ? t.assignedClasses.join(', ') : 'Semua Kelas',
      'Username Login': t.username,
      'Password': t.password || '••••••••',
      'Tanggal Dibuat': t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID') : '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 22 },
    { wch: 25 },
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Guru');
  XLSX.writeFile(workbook, fileName);
}

export interface StudentProgressExportRow {
  student: StudentAccount;
  completedCount: number;
  totalCount: number;
  percentage: number;
  subjectName: string;
  isOnline?: boolean;
  statusAccessText?: string;
  durationText?: string;
  lastActive?: number;
}

/**
 * Exports detailed student progress summary to a formatted Excel file.
 */
export function exportStudentProgressToExcel(
  rows: StudentProgressExportRow[],
  fileName: string = 'Rekap_Progres_Belajar_Siswa.xlsx'
): void {
  const data = rows.map((r, idx) => {
    let statusText = 'Belum Mulai';
    if (r.percentage === 100) statusText = 'TUNTAS (100%)';
    else if (r.percentage > 0) statusText = `Sedang Berjalan (${r.percentage}%)`;

    const statusAkses = r.statusAccessText || (r.isOnline ? 'ONLINE (Sedang Akses)' : 'OFFLINE');

    return {
      'No.': idx + 1,
      'No. Absen': r.student.noAbsen || '-',
      'Nama Siswa': r.student.nama,
      'Kelas': r.student.kelas,
      'NIS': r.student.nisn,
      'Status Akses': statusAkses,
      'Mata Pelajaran': r.subjectName,
      'Total Waktu Online': r.durationText || '-',
      'Materi Selesai': r.completedCount,
      'Total Materi': r.totalCount,
      'Progres (%)': `${r.percentage}%`,
      'Status Ketuntasan': statusText,
      'Aktivitas Terakhir': r.lastActive
        ? new Date(r.lastActive).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Belum Ada Aktivitas',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 6 },  // No.
    { wch: 12 }, // No. Absen
    { wch: 28 }, // Nama Siswa
    { wch: 12 }, // Kelas
    { wch: 18 }, // NIS
    { wch: 20 }, // Status Akses
    { wch: 22 }, // Mata Pelajaran
    { wch: 16 }, // Materi Selesai
    { wch: 14 }, // Total Materi
    { wch: 14 }, // Progres (%)
    { wch: 24 }, // Status Ketuntasan
    { wch: 24 }, // Aktivitas Terakhir
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Progres Siswa');
  XLSX.writeFile(workbook, fileName);
}

/**
 * Downloads a complete JSON snapshot file of the entire system data.
 */
export function downloadJsonBackup(backupData: SystemBackupData, fileName?: string): void {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const finalName = fileName || `Backup_Sistem_Materi_${dateStr}.json`;
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports all system tables (Mapel, Topik, Materi, Guru, Siswa, Progres, Nilai & Kuis, Pengaturan) into a multi-sheet Excel file.
 */
export function exportAllDataToExcel(backupData: SystemBackupData, fileName?: string): void {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const finalName = fileName || `Backup_Lengkap_Sistem_${dateStr}.xlsx`;
  const workbook = XLSX.utils.book_new();

  const progressEntries = Object.values(backupData.studentProgress || {});
  let totalQuizScoresCount = 0;
  progressEntries.forEach((p) => {
    const scoreKeys = Object.keys(p.scores || {});
    const attemptKeys = Object.keys(p.quizAttempts || {});
    const uniqueMatIds = new Set([...scoreKeys, ...attemptKeys]);
    totalQuizScoresCount += uniqueMatIds.size;
  });

  // 1. Sheet Info Ringkasan
  const infoData = [
    { 'Properti': 'Versi Backup', 'Nilai': backupData.version || '2.6.0' },
    { 'Properti': 'Tanggal Backup', 'Nilai': new Date(backupData.backupDate).toLocaleString('id-ID') },
    { 'Properti': 'Nama Sistem', 'Nilai': backupData.systemName || 'Sistem Materi Pembelajaran Digital' },
    { 'Properti': 'Total Mata Pelajaran', 'Nilai': backupData.subjects?.length || 0 },
    { 'Properti': 'Total Topik / Kategori', 'Nilai': backupData.categories?.length || 0 },
    { 'Properti': 'Total Materi Pembelajaran', 'Nilai': backupData.materials?.length || 0 },
    { 'Properti': 'Total Akun Guru', 'Nilai': backupData.teachers?.length || 0 },
    { 'Properti': 'Total Akun Siswa', 'Nilai': backupData.students?.length || 0 },
    { 'Properti': 'Total Siswa Memiliki Progres', 'Nilai': progressEntries.length },
    { 'Properti': 'Total Rekaman Nilai Kuis Tersimpan', 'Nilai': totalQuizScoresCount },
  ];
  const infoSheet = XLSX.utils.json_to_sheet(infoData);
  infoSheet['!cols'] = [{ wch: 34 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Ringkasan Sistem');

  // 2. Sheet Mata Pelajaran
  const subjectsData = (backupData.subjects || []).map((s, idx) => ({
    'No.': idx + 1,
    'ID Mapel': s.id,
    'Nama Mata Pelajaran': s.name,
    'Kode Mapel': s.code || '',
    'Deskripsi': s.description || '',
    'Ikon': s.icon || '',
    'Warna': s.color || '',
    'Urutan': s.order,
  }));
  const subSheet = XLSX.utils.json_to_sheet(subjectsData);
  subSheet['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 35 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, subSheet, 'Mata Pelajaran');

  // 3. Sheet Topik / Kategori
  const categoriesData = (backupData.categories || []).map((c, idx) => ({
    'No.': idx + 1,
    'ID Topik': c.id,
    'ID Mapel Terkait': c.subjectId || '',
    'Judul Topik': c.title,
    'Target Jenjang': c.targetGrade || '',
    'Status Publikasi': c.isPublished !== false ? 'PUBLISHED' : 'DRAFT',
    'Deskripsi': c.description || '',
    'Ikon': c.icon || '',
    'Warna': c.color || '',
    'Urutan': c.order,
  }));
  const catSheet = XLSX.utils.json_to_sheet(categoriesData);
  catSheet['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 35 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, catSheet, 'Topik Pembelajaran');

  // 4. Sheet Materi
  const materialsData = (backupData.materials || []).map((m, idx) => ({
    'No.': idx + 1,
    'ID Materi': m.id,
    'ID Topik': m.categoryId,
    'Judul Materi': m.title,
    'Tipe Konten': m.type,
    'URL Asli': m.originalUrl,
    'URL Embed': m.embedUrl,
    'Target Jenjang': m.targetGrade || '',
    'Status Publikasi': m.isPublished ? 'PUBLISHED' : 'DRAFT',
    'Urutan': m.order,
    'Tujuan Pembelajaran (TP)': m.learningObjectives || '',
    'Deskripsi / Catatan': m.description || '',
    'Jumlah Soal Kuis': m.quizQuestions?.length || 0,
    'Jumlah Flashcard': m.flashcards?.length || 0,
    'Data Interaktif JSON': m.interactiveConfig ? JSON.stringify(m.interactiveConfig) : '',
    'Soal Kuis JSON': m.quizQuestions ? JSON.stringify(m.quizQuestions) : '',
    'Flashcard JSON': m.flashcards ? JSON.stringify(m.flashcards) : '',
  }));
  const matSheet = XLSX.utils.json_to_sheet(materialsData);
  matSheet['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 32 }, { wch: 14 },
    { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 10 },
    { wch: 35 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(workbook, matSheet, 'Materi Pembelajaran');

  // 5. Sheet Akun Guru
  const teachersData = (backupData.teachers || []).map((t, idx) => ({
    'No.': idx + 1,
    'ID Guru': t.id,
    'Nama Lengkap Guru': t.name,
    'NIP / NIK': t.nip || '',
    'Username Login': t.username,
    'Password Login': t.password || '••••••••',
    'ID Mapel Pengampuan': t.subjectId || '',
    'Kelas Mengajar': (t.assignedClasses || []).join(', '),
  }));
  const teacherSheet = XLSX.utils.json_to_sheet(teachersData);
  teacherSheet['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, teacherSheet, 'Akun Guru');

  // 6. Sheet Akun Siswa
  const studentsData = (backupData.students || []).map((s, idx) => ({
    'No.': idx + 1,
    'ID Siswa': s.id,
    'Nama Lengkap Siswa': s.nama,
    'Kelas': s.kelas,
    'No. Absen': s.noAbsen || '',
    'NIS': s.nisn,
    'Username Login': s.username || s.nisn,
    'Password Login': s.password || (s.isDefaultPassword ? 'pass123' : '••••••••'),
  }));
  const studentSheet = XLSX.utils.json_to_sheet(studentsData);
  studentSheet['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, studentSheet, 'Akun Siswa');

  // 7. Sheet Progres Siswa (Lengkap dengan Progres, Nilai, Gamifikasi, dan Catatan)
  const progressData = progressEntries.map((p, idx) => ({
    'No.': idx + 1,
    'ID Siswa': p.studentId,
    'Nama Siswa': p.studentName || '',
    'Kelas': p.kelas || '',
    'Jumlah Materi Selesai': (p.completedMaterialIds || []).length,
    'Daftar ID Materi Selesai': (p.completedMaterialIds || []).join(', '),
    'Nilai Kuis JSON': p.scores ? JSON.stringify(p.scores) : '',
    'Riwayat Kuis JSON': p.quizAttempts ? JSON.stringify(p.quizAttempts) : '',
    'Timestamps JSON': p.completedMaterialTimestamps ? JSON.stringify(p.completedMaterialTimestamps) : '',
    'Activity Logs JSON': p.activityLogs ? JSON.stringify(p.activityLogs) : '',
    'Gamifikasi JSON': p.gamification ? JSON.stringify(p.gamification) : '',
    'Catatan Siswa JSON': p.notes ? JSON.stringify(p.notes) : '',
    'Materi Ditandai JSON': p.bookmarkedMaterialIds ? JSON.stringify(p.bookmarkedMaterialIds) : '',
    'Terakhir Diperbarui': p.updatedAt || '',
  }));
  const progSheet = XLSX.utils.json_to_sheet(progressData);
  progSheet['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 22 },
    { wch: 35 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
    { wch: 30 }, { wch: 30 }, { wch: 24 }, { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(workbook, progSheet, 'Progres Siswa');

  // 8. Sheet Khusus: Nilai & Kuis Siswa (Row-by-Row untuk Analisis & Rekap)
  const matTitleMap = new Map((backupData.materials || []).map((m) => [m.id, m.title]));
  const quizRows: Array<{
    'No.': number;
    'ID Siswa': string;
    'Nama Siswa': string;
    'Kelas': string;
    'ID Materi': string;
    'Judul Materi': string;
    'Skor Benar': number;
    'Total Soal': number;
    'Nilai Akhir (0-100)': number;
    'Status': string;
    'Waktu Pengerjaan': string;
    'Detail Jawaban JSON': string;
  }> = [];

  progressEntries.forEach((p) => {
    const handledMatIds = new Set<string>();

    if (p.quizAttempts && typeof p.quizAttempts === 'object') {
      Object.entries(p.quizAttempts).forEach(([matId, attempt]: [string, any]) => {
        if (!matId || !attempt) return;
        handledMatIds.add(matId);
        const score = Number(attempt.score ?? 0);
        const totalQ = Number(attempt.totalQuestions || 10);
        const percentage = Number(attempt.percentage ?? Math.round((score / totalQ) * 100));
        quizRows.push({
          'No.': quizRows.length + 1,
          'ID Siswa': p.studentId,
          'Nama Siswa': p.studentName || '',
          'Kelas': p.kelas || '',
          'ID Materi': matId,
          'Judul Materi': matTitleMap.get(matId) || matId,
          'Skor Benar': score,
          'Total Soal': totalQ,
          'Nilai Akhir (0-100)': percentage,
          'Status': percentage >= 70 ? 'LULUS' : 'BELUM LULUS',
          'Waktu Pengerjaan': attempt.updatedAt || p.updatedAt || '',
          'Detail Jawaban JSON': attempt.answers ? JSON.stringify(attempt.answers) : '',
        });
      });
    }

    if (p.scores && typeof p.scores === 'object') {
      Object.entries(p.scores).forEach(([matId, scVal]) => {
        if (!matId || handledMatIds.has(matId)) return;
        const score = Number(scVal || 0);
        const totalQ = 10;
        const percentage = Math.round((score / totalQ) * 100);
        quizRows.push({
          'No.': quizRows.length + 1,
          'ID Siswa': p.studentId,
          'Nama Siswa': p.studentName || '',
          'Kelas': p.kelas || '',
          'ID Materi': matId,
          'Judul Materi': matTitleMap.get(matId) || matId,
          'Skor Benar': score,
          'Total Soal': totalQ,
          'Nilai Akhir (0-100)': percentage,
          'Status': percentage >= 70 ? 'LULUS' : 'BELUM LULUS',
          'Waktu Pengerjaan': p.updatedAt || '',
          'Detail Jawaban JSON': '',
        });
      });
    }
  });

  const quizSheet = XLSX.utils.json_to_sheet(quizRows.length > 0 ? quizRows : [
    {
      'No.': 1,
      'ID Siswa': '-',
      'Nama Siswa': 'Belum ada rekaman nilai kuis',
      'Kelas': '-',
      'ID Materi': '-',
      'Judul Materi': '-',
      'Skor Benar': 0,
      'Total Soal': 0,
      'Nilai Akhir (0-100)': 0,
      'Status': '-',
      'Waktu Pengerjaan': '-',
      'Detail Jawaban JSON': '',
    }
  ]);
  quizSheet['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 22 },
    { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
    { wch: 24 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(workbook, quizSheet, 'Nilai & Kuis Siswa');

  // 9. Sheet Pengaturan & Konfigurasi
  const configData = [
    { 'Parameter': 'adminSettings', 'Deskripsi': 'Konfigurasi Admin & PIN', 'Data JSON': JSON.stringify(backupData.adminSettings || {}) },
    { 'Parameter': 'masterGrades', 'Deskripsi': 'Master Jenjang Akademik', 'Data JSON': JSON.stringify(backupData.masterGrades || []) },
    { 'Parameter': 'masterClasses', 'Deskripsi': 'Master Daftar Kelas', 'Data JSON': JSON.stringify(backupData.masterClasses || []) },
    { 'Parameter': 'themeConfig', 'Deskripsi': 'Tema & Kustomisasi Tampilan', 'Data JSON': JSON.stringify(backupData.themeConfig || {}) },
  ];
  const configSheet = XLSX.utils.json_to_sheet(configData);
  configSheet['!cols'] = [{ wch: 20 }, { wch: 32 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, configSheet, 'Pengaturan Sistem');

  XLSX.writeFile(workbook, finalName);
}

/**
 * Parses an uploaded backup JSON file into SystemBackupData.
 */
export async function parseBackupJsonFile(file: File): Promise<SystemBackupData> {
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') {
      throw new Error('Format JSON tidak valid');
    }

    // Normalize studentProgress if given as array
    let normalizedProgress: Record<string, StudentProgressRecord> = {};
    if (data.studentProgress) {
      if (Array.isArray(data.studentProgress)) {
        data.studentProgress.forEach((p: any) => {
          const sid = p.studentId || p.id;
          if (sid) normalizedProgress[sid] = { ...p, studentId: sid };
        });
      } else if (typeof data.studentProgress === 'object') {
        normalizedProgress = data.studentProgress;
      }
    }

    // Merge studentQuizScores if available
    if (data.studentQuizScores && typeof data.studentQuizScores === 'object') {
      Object.entries(data.studentQuizScores).forEach(([sid, scores]: [string, any]) => {
        if (!sid || typeof scores !== 'object') return;
        if (!normalizedProgress[sid]) {
          normalizedProgress[sid] = {
            studentId: sid,
            completedMaterialIds: [],
            scores: {},
            quizAttempts: {},
            updatedAt: new Date().toISOString(),
          };
        }
        if (!normalizedProgress[sid].scores) normalizedProgress[sid].scores = {};
        if (!normalizedProgress[sid].quizAttempts) normalizedProgress[sid].quizAttempts = {};

        Object.entries(scores).forEach(([mId, scVal]: [string, any]) => {
          if (typeof scVal === 'number') {
            normalizedProgress[sid].scores![mId] = scVal;
          } else if (typeof scVal === 'object' && scVal !== null) {
            normalizedProgress[sid].scores![mId] = Number(scVal.score ?? 0);
            normalizedProgress[sid].quizAttempts![mId] = scVal;
          }
        });
      });
    }

    // Compute stats
    let totalQuizScores = 0;
    Object.values(normalizedProgress).forEach((p) => {
      const sKeys = Object.keys(p.scores || {});
      const aKeys = Object.keys(p.quizAttempts || {});
      totalQuizScores += new Set([...sKeys, ...aKeys]).size;
    });

    return {
      version: data.version || '2.6.0',
      backupDate: data.backupDate || new Date().toISOString(),
      systemName: data.systemName || 'Sistem Materi Pembelajaran',
      subjects: Array.isArray(data.subjects) ? data.subjects : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      materials: Array.isArray(data.materials) ? data.materials : [],
      teachers: Array.isArray(data.teachers) ? data.teachers : [],
      students: Array.isArray(data.students) ? data.students : [],
      studentProgress: normalizedProgress,
      studentQuizScores: data.studentQuizScores,
      masterGrades: Array.isArray(data.masterGrades) ? data.masterGrades : undefined,
      masterClasses: Array.isArray(data.masterClasses) ? data.masterClasses : undefined,
      adminSettings: data.adminSettings,
      themeConfig: data.themeConfig,
      stats: {
        totalSubjects: Array.isArray(data.subjects) ? data.subjects.length : 0,
        totalCategories: Array.isArray(data.categories) ? data.categories.length : 0,
        totalMaterials: Array.isArray(data.materials) ? data.materials.length : 0,
        totalTeachers: Array.isArray(data.teachers) ? data.teachers.length : 0,
        totalStudents: Array.isArray(data.students) ? data.students.length : 0,
        totalProgressRecords: Object.keys(normalizedProgress).length,
        totalQuizScores,
      },
    };
  } catch (err: any) {
    throw new Error('Gagal memproses file JSON cadangan: ' + (err.message || 'Format tidak valid'));
  }
}

/**
 * Parses an uploaded backup multi-sheet Excel file into SystemBackupData.
 * Restores subjects, categories, materials, teachers, students, progress, quiz scores, and settings.
 */
export async function parseBackupExcelFile(file: File): Promise<SystemBackupData> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const getSheetData = (nameCandidates: string[]): Record<string, any>[] => {
    for (const cand of nameCandidates) {
      const found = workbook.SheetNames.find((n) => n.toLowerCase().trim() === cand.toLowerCase().trim());
      if (found && workbook.Sheets[found]) {
        return XLSX.utils.sheet_to_json(workbook.Sheets[found], { defval: '' });
      }
    }
    return [];
  };

  // 1. Parse Subjects
  const rawSub = getSheetData(['Mata Pelajaran', 'Subjects', 'Mapel']);
  const subjects: Subject[] = rawSub.map((r, idx) => ({
    id: String(r['ID Mapel'] || r['id'] || `subj_${Date.now()}_${idx}`),
    name: String(r['Nama Mata Pelajaran'] || r['name'] || '').trim(),
    code: String(r['Kode Mapel'] || r['code'] || '').trim() || undefined,
    description: String(r['Deskripsi'] || r['description'] || '').trim() || undefined,
    icon: String(r['Ikon'] || r['icon'] || 'BookOpen').trim(),
    color: String(r['Warna'] || r['color'] || 'blue').trim(),
    order: Number(r['Urutan'] || r['order'] || idx + 1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })).filter((s) => s.name);

  // 2. Parse Categories
  const rawCat = getSheetData(['Topik Pembelajaran', 'Topik', 'Categories', 'Kategori']);
  const categories: Category[] = rawCat.map((r, idx) => ({
    id: String(r['ID Topik'] || r['id'] || `cat_${Date.now()}_${idx}`),
    subjectId: String(r['ID Mapel Terkait'] || r['subjectId'] || '').trim() || undefined,
    title: String(r['Judul Topik'] || r['title'] || '').trim(),
    targetGrade: String(r['Target Jenjang'] || r['targetGrade'] || '').trim() || undefined,
    isPublished: String(r['Status Publikasi'] || r['isPublished'] || '').toUpperCase() !== 'DRAFT',
    description: String(r['Deskripsi'] || r['description'] || '').trim(),
    icon: String(r['Ikon'] || r['icon'] || 'Folder').trim(),
    color: String(r['Warna'] || r['color'] || 'blue').trim(),
    order: Number(r['Urutan'] || r['order'] || idx + 1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })).filter((c) => c.title);

  // 3. Parse Materials
  const rawMat = getSheetData(['Materi Pembelajaran', 'Materi', 'Materials']);
  const materials: Material[] = rawMat.map((r, idx) => {
    let quizQuestions = undefined;
    let flashcards = undefined;
    let interactiveConfig = undefined;

    try {
      if (r['Soal Kuis JSON']) quizQuestions = JSON.parse(r['Soal Kuis JSON']);
    } catch {}
    try {
      if (r['Flashcard JSON']) flashcards = JSON.parse(r['Flashcard JSON']);
    } catch {}
    try {
      if (r['Data Interaktif JSON']) interactiveConfig = JSON.parse(r['Data Interaktif JSON']);
    } catch {}

    const typeStr = String(r['Tipe Konten'] || r['type'] || 'pdf').toLowerCase().trim();
    const validTypes = ['gdrive', 'canva', 'pdf', 'youtube', 'video', 'gform', 'other'];
    const type = (validTypes.includes(typeStr) ? typeStr : 'pdf') as any;

    return {
      id: String(r['ID Materi'] || r['id'] || `mat_${Date.now()}_${idx}`),
      categoryId: String(r['ID Topik'] || r['categoryId'] || '').trim(),
      title: String(r['Judul Materi'] || r['title'] || '').trim(),
      type,
      originalUrl: String(r['URL Asli'] || r['originalUrl'] || '').trim(),
      embedUrl: String(r['URL Embed'] || r['embedUrl'] || r['URL Asli'] || '').trim(),
      targetGrade: String(r['Target Jenjang'] || r['targetGrade'] || '').trim() || undefined,
      isPublished: String(r['Status Publikasi'] || r['isPublished'] || '').toUpperCase() !== 'DRAFT',
      order: Number(r['Urutan'] || r['order'] || idx + 1),
      learningObjectives: String(r['Tujuan Pembelajaran (TP)'] || r['Tujuan Pembelajaran'] || r['learningObjectives'] || '').trim() || undefined,
      description: String(r['Deskripsi / Catatan'] || r['description'] || '').trim() || undefined,
      quizQuestions,
      flashcards,
      interactiveConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }).filter((m) => m.title && m.categoryId);

  // 4. Parse Teachers
  const rawTeachers = getSheetData(['Akun Guru', 'Teachers', 'Guru']);
  const teachers: TeacherAccount[] = rawTeachers.map((r, idx) => {
    const classesStr = String(r['Kelas Mengajar'] || r['assignedClasses'] || '');
    const assignedClasses = classesStr ? classesStr.split(/[,;\n]+/).map((c) => c.trim()).filter(Boolean) : [];
    return {
      id: String(r['ID Guru'] || r['id'] || `t_${Date.now()}_${idx}`),
      name: String(r['Nama Lengkap Guru'] || r['name'] || '').trim(),
      nip: String(r['NIP / NIK'] || r['nip'] || '').trim() || undefined,
      username: String(r['Username Login'] || r['username'] || '').trim(),
      password: String(r['Password Login'] || r['password'] || 'gurupass123').trim(),
      subjectId: String(r['ID Mapel Pengampuan'] || r['subjectId'] || '').trim(),
      assignedClasses,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }).filter((t) => t.name && t.username);

  // 5. Parse Students
  const rawStudents = getSheetData(['Akun Siswa', 'Students', 'Siswa']);
  const students: StudentAccount[] = rawStudents.map((r, idx) => ({
    id: String(r['ID Siswa'] || r['id'] || `s_${Date.now()}_${idx}`),
    nama: String(r['Nama Lengkap Siswa'] || r['nama'] || '').trim(),
    kelas: String(r['Kelas'] || r['kelas'] || '').trim(),
    noAbsen: String(r['No. Absen'] || r['noAbsen'] || '').trim(),
    nisn: String(r['NIS'] || r['nis'] || r['NISN'] || r['nisn'] || '').trim(),
    username: String(r['Username Login'] || r['username'] || r['NIS'] || r['NISN'] || '').trim(),
    password: String(r['Password Login'] || r['password'] || 'pass123').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })).filter((s) => s.nama && s.nisn);

  // 6. Parse Progress
  const rawProg = getSheetData(['Progres Siswa', 'Student Progress', 'Progres', 'Progres Belajar Siswa']);
  const studentProgress: Record<string, StudentProgressRecord> = {};
  rawProg.forEach((r) => {
    const studentId = String(r['ID Siswa'] || r['studentId'] || '').trim();
    if (!studentId) return;

    const idsStr = String(r['Daftar ID Materi Selesai'] || r['completedMaterialIds'] || '');
    const completedMaterialIds = idsStr ? idsStr.split(/[,;\n]+/).map((i) => i.trim()).filter(Boolean) : [];

    let completedMaterialTimestamps: Record<string, string> = {};
    let activityLogs = [];
    let scores: Record<string, number> = {};
    let quizAttempts: Record<string, any> = {};
    let rawGamification: any = null;
    let notes: Record<string, string> = {};
    let bookmarkedMaterialIds: string[] = [];

    try {
      if (r['Timestamps JSON']) completedMaterialTimestamps = JSON.parse(r['Timestamps JSON']);
    } catch {}
    try {
      if (r['Activity Logs JSON']) activityLogs = JSON.parse(r['Activity Logs JSON']);
    } catch {}
    try {
      if (r['Nilai Kuis JSON']) scores = JSON.parse(r['Nilai Kuis JSON']);
    } catch {}
    try {
      if (r['Riwayat Kuis JSON']) quizAttempts = JSON.parse(r['Riwayat Kuis JSON']);
    } catch {}
    try {
      if (r['Gamifikasi JSON']) rawGamification = JSON.parse(r['Gamifikasi JSON']);
    } catch {}
    try {
      if (r['Catatan Siswa JSON']) notes = JSON.parse(r['Catatan Siswa JSON']);
    } catch {}
    try {
      if (r['Materi Ditandai JSON']) bookmarkedMaterialIds = JSON.parse(r['Materi Ditandai JSON']);
    } catch {}

    const gamification = getDefaultGamificationData(rawGamification);

    studentProgress[studentId] = {
      studentId,
      studentName: String(r['Nama Siswa'] || r['studentName'] || '').trim(),
      kelas: String(r['Kelas'] || r['kelas'] || '').trim(),
      completedMaterialIds,
      completedMaterialTimestamps,
      scores,
      quizAttempts,
      activityLogs,
      gamification,
      notes,
      bookmarkedMaterialIds,
      updatedAt: String(r['Terakhir Diperbarui'] || r['updatedAt'] || new Date().toISOString()),
    };
  });

  // 7. Parse Sheet Nilai & Kuis Siswa if available
  const rawQuiz = getSheetData(['Nilai & Kuis Siswa', 'Nilai Siswa', 'Quiz Scores', 'Nilai Kuis']);
  rawQuiz.forEach((r) => {
    const studentId = String(r['ID Siswa'] || r['studentId'] || '').trim();
    const materialId = String(r['ID Materi'] || r['materialId'] || '').trim();
    if (!studentId || !materialId || studentId === '-') return;

    if (!studentProgress[studentId]) {
      studentProgress[studentId] = {
        studentId,
        studentName: String(r['Nama Siswa'] || '').trim(),
        kelas: String(r['Kelas'] || '').trim(),
        completedMaterialIds: [],
        scores: {},
        quizAttempts: {},
        gamification: getDefaultGamificationData(null),
        notes: {},
        bookmarkedMaterialIds: [],
        updatedAt: new Date().toISOString(),
      };
    }
    if (!studentProgress[studentId].scores) studentProgress[studentId].scores = {};
    if (!studentProgress[studentId].quizAttempts) studentProgress[studentId].quizAttempts = {};

    const score = Number(r['Skor Benar'] ?? r['score'] ?? 0);
    const totalQuestions = Number(r['Total Soal'] ?? r['totalQuestions'] ?? 10);
    const percentage = Number(r['Nilai Akhir (0-100)'] ?? r['percentage'] ?? Math.round((score / totalQuestions) * 100));
    const updatedAt = String(r['Waktu Pengerjaan'] || r['updatedAt'] || new Date().toISOString());

    let answers = undefined;
    try {
      if (r['Detail Jawaban JSON']) answers = JSON.parse(r['Detail Jawaban JSON']);
    } catch {}

    studentProgress[studentId].scores![materialId] = score;
    studentProgress[studentId].quizAttempts![materialId] = {
      score,
      totalQuestions,
      percentage,
      updatedAt,
      answers,
    };
  });

  // 8. Parse Pengaturan & Konfigurasi if available
  let adminSettings: Partial<AdminSettings> | undefined = undefined;
  let masterGrades: Array<{ id: string; label: string; subLabel: string }> | undefined = undefined;
  let masterClasses: string[] | undefined = undefined;
  let themeConfig: any = undefined;

  const rawConfig = getSheetData(['Pengaturan Sistem', 'Pengaturan & Konfigurasi', 'Settings', 'Config']);
  rawConfig.forEach((r) => {
    const param = String(r['Parameter'] || r['Key'] || '').trim();
    const dataJson = String(r['Data JSON'] || r['Value'] || '').trim();
    if (!dataJson) return;

    try {
      if (param === 'adminSettings') adminSettings = JSON.parse(dataJson);
      else if (param === 'masterGrades') masterGrades = JSON.parse(dataJson);
      else if (param === 'masterClasses') {
        masterClasses = Array.isArray(JSON.parse(dataJson)) ? JSON.parse(dataJson) : dataJson.split(/[,;\n]+/).map((c) => c.trim()).filter(Boolean);
      } else if (param === 'themeConfig') themeConfig = JSON.parse(dataJson);
    } catch {}
  });

  // Calculate total scores count
  let totalQuizScores = 0;
  Object.values(studentProgress).forEach((p) => {
    const sKeys = Object.keys(p.scores || {});
    const aKeys = Object.keys(p.quizAttempts || {});
    totalQuizScores += new Set([...sKeys, ...aKeys]).size;
  });

  return {
    version: '2.6.0',
    backupDate: new Date().toISOString(),
    systemName: adminSettings?.siteTitle || 'Sistem Materi Pembelajaran Digital',
    subjects,
    categories,
    materials,
    teachers,
    students,
    studentProgress,
    masterGrades,
    masterClasses,
    adminSettings,
    themeConfig,
    stats: {
      totalSubjects: subjects.length,
      totalCategories: categories.length,
      totalMaterials: materials.length,
      totalTeachers: teachers.length,
      totalStudents: students.length,
      totalProgressRecords: Object.keys(studentProgress).length,
      totalQuizScores,
    },
  };
}


