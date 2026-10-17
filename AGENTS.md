# Standar Arsitektur Backend, Vercel Serverless & Zero-Crash Policy

Instruksi ini wajib dipatuhi untuk semua pengembangan, modifikasi, dan penambahan fitur backend maupun API pada proyek ini:

## 1. Struktur Serverless Mandiri
- Semua endpoint API serverless diletakkan di dalam folder `/api/` (misalnya: `/api/generate-quiz.ts`, `/api/generate-quiz-bank.ts`, `/api/health.ts`).
- Semua modul pembantu atau core logic backend diletakkan di dalam direktori berawalan garis bawah `/api/_lib/` (misalnya: `/api/_lib/quizGeneratorCore.ts`, `/api/_lib/fallbackQuizBank.ts`).
- File dan folder dengan awalan `_` otomatis dibundel oleh `@vercel/node` dan tidak dijadikan rute publik.
- **Larangan Keras**: Dilarang membuat import relatif dari dalam folder `/api/` yang melompat keluar ke folder frontend `/src/` (misalnya `../../src/...`). Semua dependensi `/api/` harus mandiri di dalam `/api/` atau berupa paket npm agar tidak memicu `ERR_MODULE_NOT_FOUND` pada runtime Node.js ESM di AWS Lambda Vercel.

## 2. Konfigurasi `vercel.json` Bersih
- Dilarang menambahkan `"includeFiles": "src/**"` pada definisi fungsi di `vercel.json`.
- Pengaturan fungsi di `vercel.json` dibatasi pada spesifikasi durasi dan memori, contoh:
  ```json
  "functions": {
    "api/*.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
  ```

## 3. Kebijakan Zero-Crash & Graceful Fallback Fitur AI
- Fitur AI tidak boleh melempar *unhandled exception* (`throw Error`) atau mengembalikan status HTTP 500 jika variabel `GEMINI_API_KEY` belum terpasang di Vercel, kuota habis (429), server AI sibuk (503), atau terjadi *timeout*.
- Semua endpoint AI harus membungkus proses dengan blok `try-catch` dan selalu mengembalikan status **HTTP 200** dengan data cadangan terkurasi (*curated fallback*), disertai atribut `{ isFallback: true, warning: "..." }`.
- Tampilan antarmuka klien harus menampilkan panduan informatif yang ramah kepada pengguna tanpa memunculkan kode error teknis seperti `FUNCTION_INVOCATION_FAILED`.

## 4. Batas Waktu Serverless (< 10 Detik)
- Selalu prioritaskan model AI yang cepat dan responsif: `gemini-3.1-flash-lite`, `gemini-flash-latest`, atau `gemini-3.8-flash`.
- Gunakan instruksi terpadu (*single unified prompt*) untuk menghasilkan soal dalam satu panggilan (< 6 detik), sehingga tidak melebihi batas waktu eksekusi Vercel (*Hobby plan*).
