import React, { useState } from 'react';
import {
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  FileText,
  Video,
  Presentation,
  ClipboardList,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { parseEmbedUrl, ParsedUrlResult } from '../../utils/urlParser';

interface SampleLinkItem {
  title: string;
  category: string;
  url: string;
  type: string;
  icon: React.ReactNode;
}

export const LinkTesterTab: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [testedResult, setTestedResult] = useState<(ParsedUrlResult & { originalUrl: string }) | null>(null);

  const handleTestLink = (urlToTest?: string) => {
    const url = (urlToTest || inputUrl).trim();
    if (!url) return;

    const parsed: ParsedUrlResult = parseEmbedUrl(url);
    const isValid = parsed.isValid && (parsed.embedUrl.startsWith('http://') || parsed.embedUrl.startsWith('https://'));

    setTestedResult({
      ...parsed,
      originalUrl: url,
      isValid,
    });
    setIframeKey((prev) => prev + 1);
  };

  const handleCopyEmbedUrl = () => {
    if (!testedResult?.embedUrl) return;
    navigator.clipboard.writeText(testedResult.embedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleLinks: SampleLinkItem[] = [
    {
      title: 'Google Sheets (Spreadsheet)',
      category: 'Spreadsheet',
      url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/edit?usp=sharing',
      type: 'gdrive',
      icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />,
    },
    {
      title: 'Google Form (Evaluasi / Kuis)',
      category: 'Evaluasi Form',
      url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_sample_form_id/viewform',
      type: 'gform',
      icon: <ClipboardList className="w-3.5 h-3.5 text-purple-600" />,
    },
    {
      title: 'Canva Presentasi',
      category: 'Presentasi Desain',
      url: 'https://www.canva.com/design/DAF_sample_id/view?utm_content=DAF_sample_id',
      type: 'canva',
      icon: <Presentation className="w-3.5 h-3.5 text-sky-600" />,
    },
    {
      title: 'YouTube Video',
      category: 'Video Edukasi',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'youtube',
      icon: <Video className="w-3.5 h-3.5 text-rose-600" />,
    },
    {
      title: 'Google Drive PDF',
      category: 'Modul PDF',
      url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing',
      type: 'gdrive',
      icon: <FileText className="w-3.5 h-3.5 text-blue-600" />,
    },
    {
      title: 'Google Docs Dokumen',
      category: 'Dokumen Teks',
      url: 'https://docs.google.com/document/d/195j9eDD3ccgjQRttHh9EBg3SC8Ko5qWA/edit',
      type: 'gdrive',
      icon: <FileText className="w-3.5 h-3.5 text-indigo-600" />,
    },
    {
      title: 'Google Slides Presentasi',
      category: 'Slide PPT',
      url: 'https://docs.google.com/presentation/d/1_sample_slide_id/edit',
      type: 'gdrive',
      icon: <Presentation className="w-3.5 h-3.5 text-amber-600" />,
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
            <LinkIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              Uji Coba & Generator Tautan Bahan Ajar
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Uji dan konversi otomatis tautan Google Sheets, Google Forms, Canva, YouTube, dan Google Drive sebelum ditautkan ke bahan ajar siswa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Universal Preview Aktif
          </span>
        </div>
      </div>

      {/* Input & Tester Section */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide">
          Masukkan Tautan (URL) yang ingin diuji:
        </label>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              placeholder="Tempel tautan (misal: https://docs.google.com/spreadsheets/d/... atau https://forms.gle/...)"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTestLink();
              }}
              className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => handleTestLink()}
            disabled={!inputUrl.trim()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 shrink-0 cursor-pointer hover:scale-[1.01] active:scale-95"
          >
            <Eye className="w-4 h-4" />
            <span>Uji Sekarang</span>
          </button>
        </div>

        {/* Quick Sample Links across All Platforms */}
        <div className="pt-2">
          <p className="text-[11px] font-bold text-slate-500 mb-2">Pilih Contoh Tautan untuk Diuji Instan (1-Click):</p>
          <div className="flex flex-wrap gap-2">
            {sampleLinks.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputUrl(sample.url);
                  handleTestLink(sample.url);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 text-xs font-semibold rounded-lg transition-all border border-slate-200/80 flex items-center gap-1.5 cursor-pointer"
              >
                {sample.icon}
                <span>{sample.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Test Result & Live Preview */}
      {testedResult && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 animate-fadeIn">
          {/* Result Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {testedResult.isValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Hasil Analisis Konversi Tautan
                </h4>
                <p className="text-xs text-slate-500">
                  {testedResult.message || 'Tautan berhasil diproses'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Platform: {testedResult.platformName || testedResult.type.toUpperCase()}
              </span>
              <a
                href={testedResult.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors"
                title="Buka link asli di tab browser baru"
              >
                <span>Buka Link Asli</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Guide / Diagnostic Tip Box */}
          {testedResult.guideTip && (
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Tips Integrasi: </span>
                <span>{testedResult.guideTip}</span>
              </div>
            </div>
          )}

          {/* URL Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                URL Asli (Input Guru):
              </span>
              <p className="text-xs font-mono font-medium text-slate-700 break-all select-all">
                {testedResult.originalUrl}
              </p>
            </div>

            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider block">
                  URL Embed Otomatis (Tampilan Siswa):
                </span>
                <button
                  type="button"
                  onClick={handleCopyEmbedUrl}
                  className="px-2 py-0.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white rounded border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Tersalin!' : 'Salin URL'}</span>
                </button>
              </div>
              <p className="text-xs font-mono font-bold text-indigo-900 break-all select-all">
                {testedResult.embedUrl}
              </p>
            </div>
          </div>

          {/* Interactive Iframe Preview Frame with Toolbar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <span>Pratinjau Layar Siswa (Live Simulator):</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIframeKey((prev) => prev + 1)}
                  className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  title="Muat ulang iframe"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reload Frame</span>
                </button>

                <a
                  href={testedResult.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors border border-indigo-200"
                  title="Uji coba tampilan embed langsung di tab baru"
                >
                  <span>Buka di Tab Baru</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="w-full h-80 sm:h-[460px] rounded-2xl overflow-hidden border border-slate-300 bg-slate-950 relative shadow-inner flex flex-col">
              <iframe
                key={iframeKey}
                src={testedResult.embedUrl}
                title="Link Preview Simulator"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-presentation"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>

            {/* Fallback Help Banner */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Jika layar pratinjau di atas menampilkan kotak login, pesan <i>"File not published"</i>, atau ditolak oleh browser:
                  pastikan izin berbagi dokumen Google diatur ke <b>"Siapa saja yang memiliki link"</b> (Anyone with the link).
                </span>
              </div>
              <a
                href={testedResult.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shrink-0 transition-colors self-end sm:self-auto cursor-pointer"
              >
                <span>Buka Link Asli</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Guide Checklist Section */}
      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Info className="w-4 h-4 text-indigo-600" />
          <span>Panduan Pengaturan Akses Tautan Bahan Ajar</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <span className="font-extrabold text-emerald-700 block flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Google Sheets
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Cukup bagikan tautan biasa. Sistem otomatis menggunakan mode <b>/preview</b>. Tidak perlu klik <i>Publish to web</i>.
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <span className="font-extrabold text-purple-700 block flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" />
              Google Forms
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Buka Google Form &gt; Setelan &gt; Matikan <i>"Batasi untuk pengguna di organisasi"</i> agar siswa dapat mengerjakan tanpa kendala akun.
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <span className="font-extrabold text-sky-700 block flex items-center gap-1">
              <Presentation className="w-3.5 h-3.5" />
              Canva
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Di Canva, klik <b>Bagikan</b> &gt; <b>Lainnya</b> &gt; <b>Sematkan (Embed)</b> atau pastikan tautan diatur ke <i>"Siapa saja bisa melihat"</i>.
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <span className="font-extrabold text-rose-700 block flex items-center gap-1">
              <Video className="w-3.5 h-3.5" />
              YouTube & Drive
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Untuk YouTube, salin URL video atau Shorts. Untuk Google Drive, pastikan hak akses diatur sebagai <b>Pelihat (Viewer)</b> publik.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
