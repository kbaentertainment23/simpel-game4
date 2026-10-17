# Pelebaran Tata Letak Dashboard Guru pada Mode Desktop

Perluasan lebar batas maksimal (*container max-width*) pada seluruh bagian dashboard guru dan admin agar memanfaatkan ruang layar desktop secara proporsional dan nyaman dibaca tanpa menyisakan ruang kosong berlebih di sisi kiri dan kanan.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan konfirmasi pengguna pada sesi tanya-jawab:
> - **Target Lebar Maksimal**: Lebar 1440px hingga 1500px (`max-w-[1480px]`) yang proporsional, mempertahankan margin tepi yang rapi pada monitor desktop tanpa membentang 100% penuh.
> - **Cakupan Pelebaran**: Seluruh elemen dashboard diselaraskan dalam satu grid vertikal yang seragam, meliputi Header Navigasi Atas (`AdminHeader`), Bilah Pilihan Mode Navigasi, Bilah Tab Dock (`AdminSidebar`), Area Konten Utama (`main`) termasuk Hero Banner & kartu-kartu materi/kuis, serta Footer.

## 1. Overview & Core Concept
- **Tujuan**: Mengoptimalkan bidang kerja guru pada resolusi layar PC/Laptop standar (1080p / 1440p) agar tabel rekap, kisi bank soal, dan kartu materi dapat menampilkan informasi secara lebih luas dan tidak terasa sempit.
- **Nilai Tambah**: Memanfaatkan ruang kosong tepi desktop secara ergonomis dengan tetap menjaga konsistensi visual dan kenyamanan membaca (*reading line length*) bagi guru pengampu.

## 2. User Experience & Visual Design
- **Hierarki & Penjajaran Grid**:
  - Semua kontainer utama beralih dari batas lama `max-w-7xl` (1280px) menjadi `max-w-[1480px] mx-auto` dengan padding horizontal responsif `px-3 sm:px-6 lg:px-8`.
  - Pada layar di bawah 1440px (seperti tablet atau laptop 13"), tampilan tetap responsif dan fleksibel mengikuti lebar viewport tanpa terjadi *horizontal scrollbar*.
  - Pada layar besar ($\ge 1440\text{px}$), kontainer melebar hingga 1480px sehingga kisi kartu materi/bab dan tabel rekapan nilai mendapatkan ruang ekstra untuk kolom data.
- **Penyelarasan Komponen**:
  - `AdminHeader`: Baris identitas sekolah, profil guru, tombol aksi, dan status sinkronisasi melebar seragam.
  - Mode Switcher Bar: Penyeleksi mode manajemen kurikulum vs pemantauan game berada dalam grid yang sama.
  - `AdminSidebar`: Bilah gulir tab menu mendapatkan ruang horizontal lebih lega untuk menampilkan lebih banyak tab sekaligus.
  - `AdminDashboard` `<main>`: Hero banner dan seluruh tampilan tab aktif (`categories`, `materials`, `bank_soal`, `progress`, `gform_results`, dll.) mendapatkan perluasan lebar yang seimbang.
  - `footer`: Penutup halaman tetap sejajar dengan batas tepi konten utama.

## 3. Key Product Decisions & Trade-Offs
- **Pendekatan Nilai Lebar (`max-w-[1480px]`)**:
  - *Alasan*: Berada tepat di tengah rentang 1440px–1500px sesuai jawaban pengguna. Sangat ideal untuk monitor Full HD 1920×1080 (menyisakan ~220px margin estetik di kiri dan kanan) serta tajam pada resolusi 2K/QHD.
  - *Alternatif Ditolak*: Lebar `w-full` (100% tanpa batas) dihindari karena membuat tombol aksi dan kolom tabel terlalu berjauhan dan melelahkan mata guru.
- **Konsistensi Seluruh Dashboard**:
  - *Alasan*: Menjaga garis tepi vertikal (*vertical alignment*) antara header, menu tabs, konten, dan footer tetap simetris dan rapi.

## 4. Technical Architecture & Component Mapping

```
┌──────────────────────────────────────────────────────────────┐
│  Sticky Top Bar (w-full bg-white border-b)                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ AdminHeader: max-w-[1480px] mx-auto                   │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Navigation Mode Switcher: max-w-[1480px] mx-auto       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ AdminSidebar (Tabs Dock): max-w-[1480px] mx-auto       │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Main Content Layout (<main>)                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ max-w-[1480px] mx-auto px-3 sm:px-6 lg:px-8 space-y-6 │  │
│  │  - Dynamic Hero Banner                                 │  │
│  │  - Active Tab View (Categories / Materials / Bank Soal)│  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Footer: max-w-[1480px] mx-auto                              │
└──────────────────────────────────────────────────────────────┘
```

- **File yang Diperbarui**:
  1. `src/components/admin/AdminHeader.tsx`: Mengubah kontainer header dari `max-w-7xl` menjadi `max-w-[1480px]`.
  2. `src/components/admin/AdminSidebar.tsx`: Mengubah pembungkus tab menu dock dari `max-w-7xl` menjadi `max-w-[1480px]`.
  3. `src/components/AdminDashboard.tsx`:
     - Memperbarui baris mode navigasi (`max-w-7xl` $\rightarrow$ `max-w-[1480px]`).
     - Memperbarui tag `<main>` (`max-w-7xl` $\rightarrow$ `max-w-[1480px]`).
     - Memperbarui tag `<footer>` (`max-w-7xl` $\rightarrow$ `max-w-[1480px]`).
- **Verifikasi**: Menjalankan pemeriksaan linter TypeScript (`tsc --noEmit`) dan kompilasi build aplikasi Vite untuk memastikan seluruh tata letak tetap kokoh tanpa regresi.
