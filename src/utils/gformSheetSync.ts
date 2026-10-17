// Utility to fetch, parse, and synchronize Google Form results via Google Sheet links without requiring Google login

export interface GFormRespondentRow {
  rowId: string;
  timestamp: string;
  studentName: string;
  kelas: string;
  noAbsen?: string;
  nisn?: string;
  rawScore: string;
  numericScore: number;
  maxScore: number;
  normalizedScore: number; // Scaled 0 - 100
  isPassed: boolean;
  rawAnswers: Record<string, string>;
  submittedDateObj?: Date | null;
}

export interface GFormSheetStats {
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passedCount: number;
  remedialCount: number;
  passPercentage: number;
  gradeDistribution: {
    gradeA: number; // 90 - 100
    gradeB: number; // 80 - 89
    gradeC: number; // 70 - 79
    gradeD: number; // < 70
  };
  classBreakdown: Record<string, { total: number; avgScore: number; passed: number; remedial: number }>;
}

export interface GFormParsedSheetData {
  spreadsheetId: string;
  gid: string;
  originalUrl: string;
  sheetTitle?: string;
  headers: string[];
  detectedColumns: {
    timestampIndex: number;
    scoreIndex: number;
    nameIndex: number;
    classIndex: number;
    absenIndex: number;
    nisnIndex: number;
    emailIndex: number;
  };
  rows: GFormRespondentRow[];
  stats: GFormSheetStats;
  lastFetched: string;
}

/**
 * Checks if a given URL is a Google Form URL
 */
export function isGoogleFormUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return clean.includes('docs.google.com/forms') || clean.includes('forms.gle');
}

/**
 * Checks if a given URL is a Google Sheet URL
 */
export function isGoogleSheetUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return clean.includes('docs.google.com/spreadsheets');
}

/**
 * Checks if a given URL is a valid published Google Spreadsheet CSV URL (contains '/pub' and 'output=csv')
 */
export function isPublishedCsvSheetUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.includes('docs.google.com/spreadsheets') &&
    clean.includes('/pub') &&
    clean.includes('output=csv')
  );
}

/**
 * Extracts spreadsheet ID and GID from any Google Sheet URL
 */
export function extractGoogleSheetDetails(url: string): {
  sheetId: string | null;
  gid: string;
  valid: boolean;
} {
  if (!url || typeof url !== 'string') {
    return { sheetId: null, gid: '0', valid: false };
  }

  const clean = url.trim();
  const idMatch = clean.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (!idMatch || !idMatch[1]) {
    return { sheetId: null, gid: '0', valid: false };
  }

  const sheetId = idMatch[1];
  let gid = '0';

  const gidMatch = clean.match(/[?&#]gid=([0-9]+)/);
  if (gidMatch && gidMatch[1]) {
    gid = gidMatch[1];
  }

  return { sheetId, gid, valid: true };
}

/**
 * Constructs direct public CSV and GViz URLs
 */
export function getGoogleSheetEndpoints(url: string): {
  gvizJsonUrl: string;
  gvizCsvUrl: string;
  exportCsvUrl: string;
  embedHtmlUrl: string;
  openUrl: string;
} | null {
  const { sheetId, gid, valid } = extractGoogleSheetDetails(url);
  if (!valid || !sheetId) return null;

  return {
    gvizJsonUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`,
    gvizCsvUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
    exportCsvUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    embedHtmlUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/htmlembed?widget=true&headers=false&gid=${gid}`,
    openUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`,
  };
}

/**
 * Parses score strings like "80 / 100", "16 / 20", "90/100", "85", "100.00"
 */
export function parseScoreString(raw: any): {
  numericScore: number;
  maxScore: number;
  normalizedScore: number;
} {
  if (raw === null || raw === undefined || raw === '') {
    return { numericScore: 0, maxScore: 100, normalizedScore: 0 };
  }

  const str = String(raw).trim();

  // Pattern: "80 / 100" or "80/100" or "16 / 20"
  const fractionMatch = str.match(/^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/);
  if (fractionMatch) {
    const obtained = parseFloat(fractionMatch[1]);
    const total = parseFloat(fractionMatch[2]);
    if (!isNaN(obtained) && !isNaN(total) && total > 0) {
      const normalized = Math.round((obtained / total) * 100 * 10) / 10;
      return {
        numericScore: obtained,
        maxScore: total,
        normalizedScore: Math.min(100, Math.max(0, normalized)),
      };
    }
  }

  // Pure number
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (!isNaN(num)) {
    // If score is > 100, assume max score is higher or 100
    const maxScore = num > 100 ? num : 100;
    const normalized = maxScore === 100 ? num : Math.round((num / maxScore) * 100);
    return {
      numericScore: num,
      maxScore,
      normalizedScore: Math.min(100, Math.max(0, normalized)),
    };
  }

  return { numericScore: 0, maxScore: 100, normalizedScore: 0 };
}

/**
 * Normalizes attendance number (e.g. "05" -> "5", "No. 12" -> "12")
 */
export function cleanAbsenNumber(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str || str === '-' || str === '–') return '';

  const match = str.match(/(?:no\.?|absen|presensi|nomor|#)?\s*([0-9]{1,3})\b/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      return String(num);
    }
  }
  return str;
}

/**
 * Extracts attendance number if written inside student name (e.g. "05. Budi" -> name: "Budi", absen: "5")
 */
export function extractAbsenAndName(rawName: string, rawAbsen?: string): {
  cleanName: string;
  cleanAbsen?: string;
} {
  let cleanName = (rawName || '').trim();
  let cleanAbsen = rawAbsen ? cleanAbsenNumber(rawAbsen) : undefined;

  // Pattern 1: "05. Budi Santoso", "12 - Siti", "(3) Ahmad", "[01] Agus", "05 Budi"
  const prefixMatch = cleanName.match(/^[\(\[\{]?\s*([0-9]{1,2})\s*[\)\]\}\.\-_/:]+\s*(.+)$/);
  if (prefixMatch) {
    if (!cleanAbsen) {
      cleanAbsen = String(parseInt(prefixMatch[1], 10));
    }
    cleanName = prefixMatch[2].trim();
  } else {
    // Pattern 2: "Budi Santoso (12)" or "Budi Santoso - 12"
    const suffixMatch = cleanName.match(/^(.+?)\s*[\(\[\{-]\s*(?:no\.?|absen|presensi)?\s*([0-9]{1,2})\s*[\)\]\}]?$/i);
    if (suffixMatch) {
      if (!cleanAbsen) {
        cleanAbsen = String(parseInt(suffixMatch[2], 10));
      }
      cleanName = suffixMatch[1].trim();
    }
  }

  return { cleanName, cleanAbsen };
}

/**
 * Intelligent header column detection
 */
function detectColumnIndices(headers: string[]): {
  timestampIndex: number;
  scoreIndex: number;
  nameIndex: number;
  classIndex: number;
  absenIndex: number;
  nisnIndex: number;
  emailIndex: number;
} {
  let timestampIndex = -1;
  let scoreIndex = -1;
  let nameIndex = -1;
  let classIndex = -1;
  let absenIndex = -1;
  // Per instruction: NIS is NOT in Google Form responses and must not be populated from questions
  const nisnIndex = -1;
  let emailIndex = -1;

  headers.forEach((h, index) => {
    const clean = h.trim().toLowerCase();

    // Timestamp
    if (
      timestampIndex === -1 &&
      clean.length <= 40 &&
      (clean.includes('timestamp') ||
        clean.includes('waktu') ||
        clean.includes('tanggal') ||
        clean.includes('date') ||
        clean.includes('submitted'))
    ) {
      timestampIndex = index;
    }

    // Score / Nilai
    if (
      scoreIndex === -1 &&
      clean.length <= 35 &&
      (clean === 'skor' ||
        clean === 'score' ||
        clean === 'nilai' ||
        clean.includes('skor /') ||
        clean.includes('score /') ||
        clean.includes('total score') ||
        clean.includes('total skor') ||
        clean.includes('nilai akhir') ||
        /^skor\b/i.test(clean) ||
        /^score\b/i.test(clean))
    ) {
      scoreIndex = index;
    }

    // Absen / No Absen / Presensi / Urut (Check BEFORE class/name so it doesn't get misidentified)
    if (
      absenIndex === -1 &&
      clean.length <= 40 &&
      !/^(apa|jelaskan|sebutkan|bagaimana|manakah|mengapa|berikut|tuliskan)\b/i.test(clean) &&
      (clean.includes('no absen') ||
        clean.includes('nomor absen') ||
        clean.includes('no. absen') ||
        clean.includes('no.absen') ||
        clean.includes('nomor urut') ||
        clean.includes('no urut') ||
        clean.includes('no. urut') ||
        clean.includes('no.urut') ||
        clean.includes('presensi') ||
        clean.includes('kehadiran') ||
        clean.includes('daftar hadir') ||
        /^(absen|absensi|presensi|no\s*urut|nomor\s*urut)\s*([:\-\(]|$)/i.test(clean) ||
        clean === 'absen' ||
        clean === 'absensi' ||
        clean === 'presensi' ||
        clean === 'no' ||
        clean === 'no.')
    ) {
      absenIndex = index;
    }

    // Class / Rombel (Ensure it doesn't match exam questions about OOP classes or IP Address classes)
    if (
      classIndex === -1 &&
      clean.length <= 40 &&
      !/^(apa|jelaskan|sebutkan|bagaimana|manakah|mengapa|berikut|tuliskan|pilih\s+jawaban)\b/i.test(clean) &&
      !clean.includes('ip address') &&
      !clean.includes('pemrograman') &&
      (clean.includes('pilih kelas') ||
        clean.includes('kelas /') ||
        clean.includes('kelas/') ||
        /^(kelas|rombel|tingkat|jurusan)\s*([:\-\(]|$)/i.test(clean) ||
        clean === 'kelas' ||
        clean === 'rombel' ||
        clean === 'class' ||
        clean === 'tingkat')
    ) {
      classIndex = index;
    }

    // Student Name
    if (
      nameIndex === -1 &&
      clean.length <= 45 &&
      !/^(apa|jelaskan|sebutkan|bagaimana|manakah|mengapa|berikut|tuliskan)\b/i.test(clean) &&
      (clean.includes('nama lengkap') ||
        clean.includes('nama siswa') ||
        clean.includes('nama peserta') ||
        clean.includes('nama murid') ||
        clean.includes('nama anda') ||
        clean.includes('student name') ||
        /^(nama|name)\s*([:\-\(]|$)/i.test(clean) ||
        clean === 'nama' ||
        clean === 'name')
    ) {
      nameIndex = index;
    }

    // Email
    if (
      emailIndex === -1 &&
      clean.length <= 30 &&
      (clean.includes('email') || clean.includes('surel') || clean.includes('e-mail'))
    ) {
      emailIndex = index;
    }
  });

  // Smart fallbacks if not detected by exact keywords:
  // Usually in Google Forms: Col 0 = Timestamp, Col 1 = Score, Col 2 = Name, Col 3 = Class
  if (timestampIndex === -1 && headers.length > 0) timestampIndex = 0;
  if (scoreIndex === -1 && headers.length > 1 && /skor|score|nilai/i.test(headers[1])) scoreIndex = 1;
  if (nameIndex === -1 && headers.length > 2) nameIndex = 2;
  if (classIndex === -1 && headers.length > 3 && !headers[3].includes('?')) classIndex = 3;
  if (absenIndex === -1 && headers.length > 4 && !headers[4].includes('?') && /^(no|absen|presensi|urut)/i.test(headers[4].trim())) {
    absenIndex = 4;
  }

  return {
    timestampIndex,
    scoreIndex,
    nameIndex,
    classIndex,
    absenIndex,
    nisnIndex: -1,
    emailIndex,
  };
}

/**
 * Calculates aggregate stats from parsed rows
 */
export function calculateSheetStats(
  rows: GFormRespondentRow[],
  kkmThreshold = 75
): GFormSheetStats {
  if (rows.length === 0) {
    return {
      totalSubmissions: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passedCount: 0,
      remedialCount: 0,
      passPercentage: 0,
      gradeDistribution: { gradeA: 0, gradeB: 0, gradeC: 0, gradeD: 0 },
      classBreakdown: {},
    };
  }

  let totalScore = 0;
  let highest = -Infinity;
  let lowest = Infinity;
  let passedCount = 0;
  let remedialCount = 0;

  const gradeDistribution = { gradeA: 0, gradeB: 0, gradeC: 0, gradeD: 0 };
  const classBreakdown: Record<string, { total: number; sumScore: number; avgScore: number; passed: number; remedial: number }> = {};

  rows.forEach((r) => {
    const score = r.normalizedScore;
    totalScore += score;

    if (score > highest) highest = score;
    if (score < lowest) lowest = score;

    if (score >= kkmThreshold) {
      passedCount++;
      r.isPassed = true;
    } else {
      remedialCount++;
      r.isPassed = false;
    }

    if (score >= 90) gradeDistribution.gradeA++;
    else if (score >= 80) gradeDistribution.gradeB++;
    else if (score >= 70) gradeDistribution.gradeC++;
    else gradeDistribution.gradeD++;

    const cls = (r.kelas || 'Tanpa Kelas').trim() || 'Tanpa Kelas';
    if (!classBreakdown[cls]) {
      classBreakdown[cls] = { total: 0, sumScore: 0, avgScore: 0, passed: 0, remedial: 0 };
    }
    classBreakdown[cls].total++;
    classBreakdown[cls].sumScore += score;
    if (score >= kkmThreshold) {
      classBreakdown[cls].passed++;
    } else {
      classBreakdown[cls].remedial++;
    }
  });

  const finalClassBreakdown: Record<string, { total: number; avgScore: number; passed: number; remedial: number }> = {};
  for (const [cls, data] of Object.entries(classBreakdown)) {
    finalClassBreakdown[cls] = {
      total: data.total,
      avgScore: Math.round((data.sumScore / data.total) * 10) / 10,
      passed: data.passed,
      remedial: data.remedial,
    };
  }

  return {
    totalSubmissions: rows.length,
    averageScore: Math.round((totalScore / rows.length) * 10) / 10,
    highestScore: highest === -Infinity ? 0 : highest,
    lowestScore: lowest === Infinity ? 0 : lowest,
    passedCount,
    remedialCount,
    passPercentage: Math.round((passedCount / rows.length) * 100 * 10) / 10,
    gradeDistribution,
    classBreakdown: finalClassBreakdown,
  };
}

/**
 * Splits CSV text into 2D array while honoring quoted cells with commas and newlines
 */
function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // Skip CRLF
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Main Fetch & Sync function: Downloads public Google Sheet data and parses it into typed responses
 */
export async function syncGoogleSheetExamData(
  sheetUrl: string,
  kkmThreshold = 75
): Promise<{ success: boolean; data?: GFormParsedSheetData; error?: string }> {
  if (!sheetUrl || !isGoogleSheetUrl(sheetUrl)) {
    return {
      success: false,
      error: 'Link yang dimasukkan bukan link Google Spreadsheet yang valid.',
    };
  }

  const endpoints = getGoogleSheetEndpoints(sheetUrl);
  if (!endpoints) {
    return {
      success: false,
      error: 'Format URL Google Spreadsheet tidak dikenali.',
    };
  }

  const { sheetId, gid } = extractGoogleSheetDetails(sheetUrl);
  if (!sheetId) {
    return { success: false, error: 'ID Spreadsheet tidak ditemukan dari link.' };
  }

  // Attempt 0: Direct Published CSV fetch (if URL is already published with /pub and output=csv)
  if (isPublishedCsvSheetUrl(sheetUrl)) {
    try {
      const pubCsvResponse = await fetch(sheetUrl, { method: 'GET' });
      if (pubCsvResponse.ok) {
        const csvText = await pubCsvResponse.text();
        if (!csvText.includes('<!DOCTYPE html') && !csvText.includes('<html')) {
          const parsedGrid = parseCsv(csvText);
          if (parsedGrid.length > 0) {
            const headers = parsedGrid[0];
            const dataRows = parsedGrid.slice(1);
            const detectedCols = detectColumnIndices(headers);

            const respondentRows: GFormRespondentRow[] = dataRows
              .map((row, rIdx) => {
                const getVal = (colIdx: number) => (colIdx >= 0 && colIdx < row.length ? row[colIdx].trim() : '');

                const rawTimestamp = getVal(detectedCols.timestampIndex);
                const rawScore = getVal(detectedCols.scoreIndex);
                const rawStudentName = getVal(detectedCols.nameIndex);
                const rawClass = getVal(detectedCols.classIndex);
                const rawAbsen = getVal(detectedCols.absenIndex);

                if (!rawStudentName && !rawScore && !rawTimestamp) return null;

                const { cleanName, cleanAbsen } = extractAbsenAndName(rawStudentName, rawAbsen);
                const studentName = cleanName || (rawStudentName ? rawStudentName : `Responden #${rIdx + 1}`);
                const kelas = rawClass ? rawClass.trim() : '-';
                const noAbsen = cleanAbsen || undefined;

                const scoreData = parseScoreString(rawScore);
                const rawAnswers: Record<string, string> = {};
                headers.forEach((h, cIdx) => {
                  rawAnswers[h] = getVal(cIdx);
                });

                let dateObj: Date | null = null;
                if (rawTimestamp) {
                  const d = new Date(rawTimestamp);
                  if (!isNaN(d.getTime())) dateObj = d;
                }

                return {
                  rowId: `gform_pubcsv_row_${rIdx + 1}`,
                  timestamp: rawTimestamp,
                  studentName,
                  kelas,
                  noAbsen,
                  nisn: undefined,
                  rawScore,
                  numericScore: scoreData.numericScore,
                  maxScore: scoreData.maxScore,
                  normalizedScore: scoreData.normalizedScore,
                  isPassed: scoreData.normalizedScore >= kkmThreshold,
                  rawAnswers,
                  submittedDateObj: dateObj,
                };
              })
              .filter(Boolean) as GFormRespondentRow[];

            const stats = calculateSheetStats(respondentRows, kkmThreshold);

            return {
              success: true,
              data: {
                spreadsheetId: sheetId || 'published_sheet',
                gid,
                originalUrl: sheetUrl,
                sheetTitle: `Hasil Ujian (${respondentRows.length} Siswa)`,
                headers,
                detectedColumns: detectedCols,
                rows: respondentRows,
                stats,
                lastFetched: new Date().toISOString(),
              },
            };
          }
        }
      }
    } catch (directPubErr) {
      console.warn('Direct published CSV fetch failed, continuing to alternative endpoints...', directPubErr);
    }
  }

  // Attempt 1: Google Visualization API (GViz) JSON endpoint
  try {
    const response = await fetch(endpoints.gvizJsonUrl, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
    });

    if (response.ok) {
      const text = await response.text();

      // Validate if it's the GViz response
      if (text.includes('google.visualization.Query.setResponse')) {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = text.substring(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonStr);

          if (parsed.status === 'error') {
            const errReason = parsed.errors?.[0]?.detailed_message || parsed.errors?.[0]?.message || 'Akses ditolak';
            return {
              success: false,
              error: `Google Spreadsheet menolak akses (${errReason}). Pastikan opsi Bagikan (Share) telah diatur ke "Siapa saja yang memiliki link: Pelihat" (Anyone with the link can view).`,
            };
          }

          const table = parsed.table;
          if (table && table.cols && table.rows) {
            const headers: string[] = table.cols.map((col: any, idx: number) => {
              return (col.label || col.id || `Kolom ${idx + 1}`).trim();
            });

            const detectedCols = detectColumnIndices(headers);

            const respondentRows: GFormRespondentRow[] = table.rows
              .map((r: any, rIdx: number) => {
                const cells = r.c || [];
                const getVal = (colIdx: number): string => {
                  if (colIdx < 0 || colIdx >= cells.length || !cells[colIdx]) return '';
                  const cell = cells[colIdx];
                  if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
                  if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
                  return '';
                };

                const rawTimestamp = detectedCols.timestampIndex >= 0 ? getVal(detectedCols.timestampIndex) : '';
                const rawScore = detectedCols.scoreIndex >= 0 ? getVal(detectedCols.scoreIndex) : '';
                const rawStudentName = detectedCols.nameIndex >= 0 ? getVal(detectedCols.nameIndex) : '';
                const rawClass = detectedCols.classIndex >= 0 ? getVal(detectedCols.classIndex) : '';
                const rawAbsen = detectedCols.absenIndex >= 0 ? getVal(detectedCols.absenIndex) : '';

                // Skip completely empty rows
                if (!rawStudentName && !rawScore && !rawTimestamp) return null;

                const { cleanName, cleanAbsen } = extractAbsenAndName(rawStudentName, rawAbsen);
                const studentName = cleanName || (rawStudentName ? rawStudentName : `Responden #${rIdx + 1}`);
                const kelas = rawClass ? rawClass.trim() : '-';
                const noAbsen = cleanAbsen || undefined;

                const scoreData = parseScoreString(rawScore);

                const rawAnswers: Record<string, string> = {};
                headers.forEach((h, cIdx) => {
                  rawAnswers[h] = getVal(cIdx);
                });

                let dateObj: Date | null = null;
                if (rawTimestamp) {
                  const d = new Date(rawTimestamp);
                  if (!isNaN(d.getTime())) dateObj = d;
                }

                return {
                  rowId: `gform_row_${rIdx + 1}`,
                  timestamp: rawTimestamp,
                  studentName,
                  kelas,
                  noAbsen,
                  nisn: undefined,
                  rawScore: rawScore || `${scoreData.numericScore}/${scoreData.maxScore}`,
                  numericScore: scoreData.numericScore,
                  maxScore: scoreData.maxScore,
                  normalizedScore: scoreData.normalizedScore,
                  isPassed: scoreData.normalizedScore >= kkmThreshold,
                  rawAnswers,
                  submittedDateObj: dateObj,
                } as GFormRespondentRow;
              })
              .filter(Boolean) as GFormRespondentRow[];

            const stats = calculateSheetStats(respondentRows, kkmThreshold);

            return {
              success: true,
              data: {
                spreadsheetId: sheetId,
                gid,
                originalUrl: sheetUrl,
                sheetTitle: `Hasil Ujian (${respondentRows.length} Siswa)`,
                headers,
                detectedColumns: detectedCols,
                rows: respondentRows,
                stats,
                lastFetched: new Date().toISOString(),
              },
            };
          }
        }
      }
    }
  } catch (gvizErr) {
    console.warn('GViz JSON fetch failed, attempting CSV fallback...', gvizErr);
  }

  // Attempt 2: Direct CSV Export Fallback
  try {
    const csvResponse = await fetch(endpoints.exportCsvUrl, {
      method: 'GET',
    });

    if (csvResponse.ok) {
      const csvText = await csvResponse.text();

      // If Google redirected to HTML login page
      if (csvText.includes('<!DOCTYPE html') || csvText.includes('<html')) {
        return {
          success: false,
          error:
            'Spreadsheet belum dibuka untuk publik. Silakan buka Google Sheet Anda -> Klik tombol Bagikan (Share) di pojok kanan atas -> Ubah Akses Umum menjadi "Siapa saja yang memiliki link" (Pelihat) agar dapat disinkronkan otomatis tanpa login.',
        };
      }

      const parsedGrid = parseCsv(csvText);
      if (parsedGrid.length === 0) {
        return {
          success: false,
          error: 'Spreadsheet kosong atau tidak memiliki data jawaban responden.',
        };
      }

      const headers = parsedGrid[0];
      const dataRows = parsedGrid.slice(1);
      const detectedCols = detectColumnIndices(headers);

      const respondentRows: GFormRespondentRow[] = dataRows
        .map((row, rIdx) => {
          const getVal = (colIdx: number) => (colIdx >= 0 && colIdx < row.length ? row[colIdx].trim() : '');

          const rawTimestamp = getVal(detectedCols.timestampIndex);
          const rawScore = getVal(detectedCols.scoreIndex);
          const rawStudentName = getVal(detectedCols.nameIndex);
          const rawClass = getVal(detectedCols.classIndex);
          const rawAbsen = getVal(detectedCols.absenIndex);

          if (!rawStudentName && !rawScore && !rawTimestamp) return null;

          const { cleanName, cleanAbsen } = extractAbsenAndName(rawStudentName, rawAbsen);
          const studentName = cleanName || (rawStudentName ? rawStudentName : `Responden #${rIdx + 1}`);
          const kelas = rawClass ? rawClass.trim() : '-';
          const noAbsen = cleanAbsen || undefined;

          const scoreData = parseScoreString(rawScore);

          const rawAnswers: Record<string, string> = {};
          headers.forEach((h, cIdx) => {
            rawAnswers[h] = getVal(cIdx);
          });

          let dateObj: Date | null = null;
          if (rawTimestamp) {
            const d = new Date(rawTimestamp);
            if (!isNaN(d.getTime())) dateObj = d;
          }

          return {
            rowId: `gform_row_csv_${rIdx + 1}`,
            timestamp: rawTimestamp,
            studentName,
            kelas,
            noAbsen,
            nisn: undefined,
            rawScore: rawScore || `${scoreData.numericScore}/${scoreData.maxScore}`,
            numericScore: scoreData.numericScore,
            maxScore: scoreData.maxScore,
            normalizedScore: scoreData.normalizedScore,
            isPassed: scoreData.normalizedScore >= kkmThreshold,
            rawAnswers,
            submittedDateObj: dateObj,
          } as GFormRespondentRow;
        })
        .filter(Boolean) as GFormRespondentRow[];

      const stats = calculateSheetStats(respondentRows, kkmThreshold);

      return {
        success: true,
        data: {
          spreadsheetId: sheetId,
          gid,
          originalUrl: sheetUrl,
          sheetTitle: `Hasil Ujian (${respondentRows.length} Siswa)`,
          headers,
          detectedColumns: detectedCols,
          rows: respondentRows,
          stats,
          lastFetched: new Date().toISOString(),
        },
      };
    }
  } catch (csvErr: any) {
    return {
      success: false,
      error: `Gagal menghubungkan ke Google Spreadsheet: ${csvErr.message || 'Koneksi terputus'}. Pastikan spreadsheet telah diatur publik (Pelihat).`,
    };
  }

  return {
    success: false,
    error:
      'Gagal mengambil data dari Google Spreadsheet. Pastikan opsi Bagikan diatur ke "Siapa saja yang memiliki link: Pelihat".',
  };
}
