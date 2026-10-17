import { MaterialType, Material } from '../types';

export interface ParsedUrlResult {
  embedUrl: string;
  type: MaterialType;
  isValid: boolean;
  message?: string;
  guideTip?: string;
  platformName?: string;
}

/**
 * Checks if a given URL points to a Google Form (docs.google.com/forms or forms.gle)
 */
export function isGoogleFormUrl(inputUrl?: string | null): boolean {
  if (!inputUrl || typeof inputUrl !== 'string') return false;
  const cleanUrl = inputUrl.trim().toLowerCase();
  return (
    cleanUrl.includes('docs.google.com/forms') ||
    cleanUrl.includes('forms.gle') ||
    cleanUrl.includes('google.com/forms')
  );
}

/**
 * Checks if a material is a Google Form based on type, originalUrl, or embedUrl
 */
export function isMaterialGoogleForm(material?: Partial<Material> | null): boolean {
  if (!material) return false;
  if (material.type === 'gform') return true;
  if (isGoogleFormUrl(material.originalUrl)) return true;
  if (isGoogleFormUrl(material.embedUrl)) return true;
  return false;
}

export function parseEmbedUrl(inputUrl: string): ParsedUrlResult {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return {
      embedUrl: '',
      type: 'other',
      isValid: false,
      message: 'URL tidak boleh kosong',
      guideTip: 'Masukkan tautan dari Google Sheets, Google Form, Canva, YouTube, atau Google Drive.',
    };
  }

  let cleanUrl = inputUrl.trim();

  // If user pasted an iframe HTML snippet like <iframe src="..."></iframe>
  const iframeMatch = cleanUrl.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    cleanUrl = iframeMatch[1];
  }

  // 0. Google Form URL Handling (Sumatif / Tes / Kuis Evaluasi)
  if (cleanUrl.includes('docs.google.com/forms') || cleanUrl.includes('forms.gle')) {
    let embedUrl = cleanUrl;
    const isShortLink = cleanUrl.includes('forms.gle');
    
    // Replace /edit or /responses with /viewform
    if (embedUrl.includes('/edit')) {
      embedUrl = embedUrl.replace(/\/edit(\?.*)?$/, '/viewform');
    } else if (embedUrl.includes('/responses')) {
      embedUrl = embedUrl.replace(/\/responses(\?.*)?$/, '/viewform');
    }

    // Ensure embedded=true parameter
    if (!embedUrl.includes('embedded=true')) {
      embedUrl = embedUrl.includes('?') ? `${embedUrl}&embedded=true` : `${embedUrl}?embedded=true`;
    }

    return {
      embedUrl,
      type: 'gform',
      isValid: true,
      platformName: 'Google Forms',
      message: isShortLink
        ? 'Tautan forms.gle terdeteksi. Disematkan otomatis.'
        : 'Berhasil mengonversi Google Form (Mode Sematkan Siap)',
      guideTip:
        'Catatan: Jika siswa melihat tulisan "Anda memerlukan izin", buka Google Form > Setelan > Matikan opsi "Batasi untuk pengguna di organisasi Anda".',
    };
  }

  // 1. YouTube Video URL Handling
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
    let videoId = '';
    const watchMatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    const shortMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);

    if (watchMatch && watchMatch[1]) videoId = watchMatch[1];
    else if (shortMatch && shortMatch[1]) videoId = shortMatch[1];
    else if (embedMatch && embedMatch[1]) videoId = embedMatch[1];
    else if (shortsMatch && shortsMatch[1]) videoId = shortsMatch[1];

    if (videoId) {
      const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
      return {
        embedUrl,
        type: 'youtube',
        isValid: true,
        platformName: 'YouTube Video',
        message: 'Berhasil mengonversi Video YouTube',
        guideTip: 'Video YouTube siap diputar langsung di portal siswa tanpa iklan luar yang mengganggu.',
      };
    }
  }

  // 2. Canva Presentation & Design URL Handling
  if (cleanUrl.includes('canva.com')) {
    let embedUrl = cleanUrl;

    if (embedUrl.includes('/edit')) {
      embedUrl = embedUrl.replace(/\/edit(\?.*)?$/, '/view?embed');
    } else if (embedUrl.includes('/view')) {
      embedUrl = embedUrl.replace(/\/view(\?.*)?$/, '/view?embed');
    } else if (embedUrl.includes('/watch')) {
      embedUrl = embedUrl.replace(/\/watch(\?.*)?$/, '/view?embed');
    } else if (!embedUrl.includes('?embed') && !embedUrl.includes('&embed')) {
      embedUrl = embedUrl.split('?')[0] + '?embed';
    }

    return {
      embedUrl,
      type: 'canva',
      isValid: true,
      platformName: 'Canva Presentation',
      message: 'Berhasil mengonversi Presentasi Canva (Mode Embed)',
      guideTip: 'Pastikan desain Canva telah diatur aksesnya ke "Siapa saja yang memiliki link bisa melihat".',
    };
  }

  // 3. Google Sheets (Spreadsheet Universal Preview)
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    const sheetIdMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetIdMatch && sheetIdMatch[1]) {
      const sheetId = sheetIdMatch[1];
      // Capture optional sheet gid (tab)
      const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
      const gidParam = gidMatch ? `#gid=${gidMatch[1]}` : '';

      // Mode Preview Universal - Langsung tampil tanpa perlu "Publish to web"
      const embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/preview${gidParam}`;
      return {
        embedUrl,
        type: 'gdrive',
        isValid: true,
        platformName: 'Google Sheets',
        message: 'Berhasil mengonversi Google Spreadsheet (Mode Preview Universal)',
        guideTip: 'Dokumen langsung tampil tanpa wajib melakukan "Publikasikan ke Web". Pastikan akses file diatur ke "Siapa saja dengan link" (Pelihat).',
      };
    }
  }

  // 4. Google Slides Presentation
  if (cleanUrl.includes('docs.google.com/presentation')) {
    const slideIdMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (slideIdMatch && slideIdMatch[1]) {
      const slideId = slideIdMatch[1];
      const embedUrl = `https://docs.google.com/presentation/d/${slideId}/embed?start=false&loop=false&delayms=3000`;
      return {
        embedUrl,
        type: 'gdrive',
        isValid: true,
        platformName: 'Google Slides',
        message: 'Berhasil mengonversi Google Slides Presentation',
        guideTip: 'Slide presentasi dapat dibuka per halaman oleh siswa langsung di dalam aplikasi.',
      };
    }
  }

  // 5. Google Docs Document
  if (cleanUrl.includes('docs.google.com/document')) {
    const docIdMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (docIdMatch && docIdMatch[1]) {
      const docId = docIdMatch[1];
      const embedUrl = `https://docs.google.com/document/d/${docId}/preview`;
      return {
        embedUrl,
        type: 'gdrive',
        isValid: true,
        platformName: 'Google Docs',
        message: 'Berhasil mengonversi Dokumen Google Docs',
        guideTip: 'Pastikan setelan berbagi diatur ke "Pelihat" (Viewer) agar dapat dibaca oleh seluruh siswa.',
      };
    }
  }

  // 6. Google Drive File (PDF, Video, Modul Ajar, etc.)
  if (cleanUrl.includes('drive.google.com')) {
    const fileIdMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      return {
        embedUrl,
        type: 'gdrive',
        isValid: true,
        platformName: 'Google Drive File',
        message: 'Berhasil mengonversi Google Drive File Viewer (PDF / Dokumen)',
        guideTip: 'Pastikan file Google Drive diatur ke "Siapa saja yang memiliki link" (Bukan dibatasi).',
      };
    }

    // Google Drive Folder
    const folderMatch = cleanUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch && folderMatch[1]) {
      const folderId = folderMatch[1];
      const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
      return {
        embedUrl,
        type: 'gdrive',
        isValid: true,
        platformName: 'Google Drive Folder',
        message: 'Berhasil mengonversi Google Drive Folder Grid Viewer',
        guideTip: 'Folder Drive akan ditampilkan dalam tampilan galeri kisi (grid view).',
      };
    }
  }

  const isPdf = cleanUrl.toLowerCase().endsWith('.pdf');
  const isDirectWeb = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');

  return {
    embedUrl: cleanUrl,
    type: isPdf ? 'pdf' : 'other',
    isValid: isDirectWeb,
    platformName: isPdf ? 'File PDF Eksternal' : 'Tautan Web / Eksternal',
    message: isDirectWeb ? 'Menggunakan tautan URL langsung' : 'Format URL tidak valid (harus diawali http:// atau https://)',
    guideTip: isDirectWeb
      ? 'Jika website eksternal membatasi tampilan di dalam frame (X-Frame-Options), siswa tetap dapat membuka via tombol Buka di Tab Baru.'
      : 'Harap periksa kembali penulisan alamat website (URL).',
  };
}

// Parse Logo URL (Direct URL or Google Drive link)
export function parseLogoUrl(inputUrl: string): string {
  if (!inputUrl || typeof inputUrl !== 'string') return '';
  let cleanUrl = inputUrl.trim();
  if (!cleanUrl) return '';

  // Handle Google Drive file links
  if (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com')) {
    const fileIdMatch =
      cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
    }
  }

  return cleanUrl;
}

