export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
  cognitiveLevel?: string;
}

export interface Material {
  id: string;
  title: string;
  description?: string;
  learningObjectives?: string;
  type?: string;
  originalUrl?: string;
  embedUrl?: string;
  order?: number;
  isPublished?: boolean;
  categoryId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

/**
 * Generates 30 substantive, concept-focused questions for SMP students
 * without quoting TP text or using meta-academic phrases.
 * Supports domain detection for Informatics/CS (Binary, Decimal, ASCII, Data Codification)
 * as well as general subjects with natural, practical wording.
 */
export function getFallbackQuizBankQuestions(
  material: Material,
  categoryName?: string,
  subjectName?: string
): QuizQuestion[] {
  const title = material.title || 'Materi Pembelajaran';
  const subj = subjectName || 'Informatika';
  const cat = categoryName || 'Topik';
  const combinedText = `${title} ${material.description || ''} ${material.learningObjectives || ''} ${cat} ${subj}`.toLowerCase();

  const isBinaryOrCodification = /(biner|desimal|ascii|kodifikasi|sistem bilangan|bit|byte|konversi bilangan|bilangan biner)/i.test(combinedText);

  if (isBinaryOrCodification) {
    const informaticsBinaryQuestions: Array<{
      q: string;
      options: [string, string, string, string];
      correct: number;
      explanation: string;
      level: string;
    }> = [
      // 1-10: C2 (Pemahaman Konsep Sistem Bilangan & Kodifikasi Data Komputer)
      {
        q: 'Mengapa perangkat komputer modern menggunakan sistem bilangan biner (basis 2) yang hanya terdiri atas simbol angka 0 dan 1?',
        options: [
          'Karena sirkuit transistor komputer hanya mengenal dua kondisi logika tegangan: menyala (ada arus/1) dan padam (tidak ada arus/0)',
          'Agar kapasitas media penyimpanan tidak cepat penuh saat menyimpan file video',
          'Karena angka biner lebih mudah dihitung secara manual oleh manusia dibandingkan sistem desimal',
          'Karena komputer tidak dapat menampilkan karakter huruf selain angka 0 dan 1'
        ],
        correct: 0,
        explanation: 'Sirkuit elektronik mikroprosesor bekerja berdasarkan sakelar transistor yang beroperasi dalam dua status biner: hidup (1) atau mati (0).',
        level: 'C2'
      },
      {
        q: 'Satuan unit data paling mendasar dan terkecil dalam arsitektur sistem komputer yang hanya bernilai 0 atau 1 disebut...',
        options: [
          'Bit (Binary Digit)',
          'Byte',
          'Megabyte',
          'Karakter'
        ],
        correct: 0,
        explanation: 'Bit merupakan singkatan dari Binary Digit, yaitu satuan terkecil data digital yang hanya memiliki nilai 0 atau 1.',
        level: 'C2'
      },
      {
        q: 'Hubungan kuantitatif antara satuan "bit" dan "Byte" dalam sistem penyimpanan memori komputer adalah...',
        options: [
          '1 Byte tersusun tepat dari 8 bit data biner',
          '1 bit tersusun dari 10 Byte data desimal',
          '1 Byte setara dengan 100 bit data digital',
          '1 bit dan 1 Byte memiliki ukuran kapasitas yang persis sama'
        ],
        correct: 0,
        explanation: 'Standar arsitektur komputer menetapkan 1 Byte terdiri dari 8 bit, yang cukup untuk merepresentasikan 1 karakter teks.',
        level: 'C2'
      },
      {
        q: 'Perbedaan mendasar antara sistem bilangan desimal yang kita gunakan sehari-hari dengan sistem bilangan biner adalah...',
        options: [
          'Sistem desimal berbasis 10 dengan simbol 0–9, sedangkan sistem biner berbasis 2 dengan simbol 0 dan 1',
          'Sistem desimal hanya dapat digunakan untuk menjumlahkan uang, sedangkan biner untuk semua hal',
          'Sistem biner tidak memiliki nilai kelipatan dan nilai tempat',
          'Sistem biner diciptakan khusus untuk bahasa pemrograman, bukan untuk mesin'
        ],
        correct: 0,
        explanation: 'Sistem bilangan desimal memiliki basis 10 (radiks 10), sedangkan sistem bilangan biner memiliki basis 2 (radiks 2).',
        level: 'C2'
      },
      {
        q: 'Mengapa teks, huruf, gambar, dan suara dari dunia nyata harus melalui proses kodifikasi (encoding) saat dimasukkan ke komputer?',
        options: [
          'Agar seluruh informasi manusia dapat diubah menjadi pola sinyal biner yang mampu diproses oleh prosesor',
          'Untuk memperkecil ukuran layar monitor komputer saat menampilkan data',
          'Supaya data tersebut tidak dapat dibaca oleh pengguna lain secara permanen',
          'Agar perangkat komputer tidak memerlukan daya listrik saat menyala'
        ],
        correct: 0,
        explanation: 'Prosesor komputer hanya memahami sinyal biner; kodifikasi menjembatani persepsi manusia (teks/gambar) ke representasi digital mesin.',
        level: 'C2'
      },
      {
        q: 'Apa fungsi utama dari tabel standar ASCII (American Standard Code for Information Interchange) dalam dunia informatika?',
        options: [
          'Menyediakan tabel pemetaan standar internasional antara karakter teks (huruf, angka, simbol) dengan nilai kode bilangan tertentu',
          'Mengatur kecepatan putaran kipas pendingin pada prosesor komputer',
          'Membatasi jumlah software yang boleh diinstal pada sistem operasi',
          'Menghapus file sampah yang tidak digunakan secara otomatis'
        ],
        correct: 0,
        explanation: 'Tabel ASCII menetapkan standar global agar pengetikan huruf seperti "A", "B", atau spasi menghasilkan kode biner seragam di semua komputer.',
        level: 'C2'
      },
      {
        q: 'Pada sistem bilangan biner, nilai tempat (bobot posisi) setiap digit yang bergerak dari arah kanan ke kiri merupakan kelipatan dari...',
        options: [
          'Perpangkatan bilangan basis 2 berturut-turut (2^0, 2^1, 2^2, 2^3, dst.)',
          'Perpangkatan bilangan basis 10 berturut-turut (10, 100, 1000, dst.)',
          'Penjumlahan angka ganjil secara acak',
          'Pembagian bilangan prima yang berselisih dua'
        ],
        correct: 0,
        explanation: 'Nilai posisi biner dari bit paling kanan (LSB) bernilai 2^0=1, 2^1=2, 2^2=4, 2^3=8, 2^4=16, 2^5=32, 2^6=64, 2^7=128.',
        level: 'C2'
      },
      {
        q: 'Jumlah maksimal karakter unik berbeda yang dapat dikodekan menggunakan tabel standar ASCII 7-bit adalah...',
        options: [
          '128 karakter (dari kode desimal 0 hingga 127)',
          '256 karakter',
          '1000 karakter',
          '10 karakter'
        ],
        correct: 0,
        explanation: 'Dengan 7 bit biner, variasi kombinasi yang dapat dibentuk adalah 2^7 = 128 karakter unik (0 sampai 127).',
        level: 'C2'
      },
      {
        q: 'Dalam representasi memori komputer, mengapa huruf kapital "A" dan huruf kecil "a" memiliki kode biner ASCII yang berbeda?',
        options: [
          'Karena komputer bersifat case-sensitive sehingga setiap bentuk simbol visual memerlukan identitas biner yang unik',
          'Karena huruf kecil tidak memerlukan arus listrik saat disimpan di memori',
          'Karena huruf kapital hanya boleh digunakan pada judul dokumen',
          'Karena tombol Shift pada keyboard otomatis merusak kode biner huruf'
        ],
        correct: 0,
        explanation: 'Setiap karakter teks memiliki kode unik; pada ASCII, "A" kapital berkode desimal 65 sedangkan "a" kecil berkode desimal 97.',
        level: 'C2'
      },
      {
        q: 'Format bilangan heksadesimal (basis 16) sering dipelajari bersamaan dengan biner karena memiliki keunggulan praktis yaitu...',
        options: [
          'Mampu meringkas deretan bit biner yang panjang, di mana 1 digit heksadesimal mewakili tepat 4 bit biner',
          'Dapat mempercepat koneksi internet hingga dua kali lipat',
          'Tidak membutuhkan memori RAM saat dijalankan oleh komputer',
          'Meniadakan kebutuhan kode ASCII dalam pemrograman'
        ],
        correct: 0,
        explanation: 'Satu digit heksadesimal (0-F) mewakili tepat 4 bit biner (nibble), membuat penulisan alamat memori dan kode warna lebih ringkas.',
        level: 'C2'
      },

      // 11-20: C3 (Penerapan Praktis & Konversi Nyata Biner ke Desimal & ASCII)
      {
        q: 'Berapakah nilai bilangan desimal dari bilangan biner 4-bit "1010"?',
        options: [
          '10',
          '12',
          '8',
          '14'
        ],
        correct: 0,
        explanation: 'Perhitungan: (1 × 2^3) + (0 × 2^2) + (1 × 2^1) + (0 × 2^0) = 8 + 0 + 2 + 0 = 10.',
        level: 'C3'
      },
      {
        q: 'Sebuah sensor suhu digital mengirimkan kode biner 4-bit "1101". Jika dikonversikan ke dalam bilangan desimal, nilai suhu tersebut adalah...',
        options: [
          '13 derajat',
          '11 derajat',
          '15 derajat',
          '9 derajat'
        ],
        correct: 0,
        explanation: 'Perhitungan: (1 × 8) + (1 × 4) + (0 × 2) + (1 × 1) = 8 + 4 + 0 + 1 = 13.',
        level: 'C3'
      },
      {
        q: 'Jika bilangan desimal 9 diubah ke dalam bentuk bilangan biner 4-bit, hasil konversi yang benar adalah...',
        options: [
          '1001',
          '1010',
          '1100',
          '0111'
        ],
        correct: 0,
        explanation: 'Angka 9 desimal diuraikan menjadi 8 + 1, sehingga bit bernilai 1 berada pada posisi 2^3 dan 2^0: biner 1001.',
        level: 'C3'
      },
      {
        q: 'Berapakah nilai desimal yang setara dengan bilangan biner 8-bit "00010101"?',
        options: [
          '21',
          '17',
          '25',
          '19'
        ],
        correct: 0,
        explanation: 'Perhitungan: posisi bit aktif berada pada bobot 16, 4, dan 1. Maka 16 + 4 + 1 = 21.',
        level: 'C3'
      },
      {
        q: 'Pada tabel standar ASCII, karakter huruf kapital "A" memiliki kode desimal 65. Bentuk representasi biner 8-bit dari huruf "A" tersebut adalah...',
        options: [
          '01000001',
          '01000010',
          '10000001',
          '00100001'
        ],
        correct: 0,
        explanation: 'Nilai desimal 65 = 64 + 1, yang dalam representasi biner 8-bit adalah 01000001 (bit ke-6 dan bit ke-0 aktif).',
        level: 'C3'
      },
      {
        q: 'Jika huruf kapital "A" memiliki kode desimal 65, maka huruf kapital "C" memiliki nilai desimal 67. Bagaimanakah bentuk biner 8-bit dari huruf "C"?',
        options: [
          '01000011',
          '01000010',
          '01000100',
          '00100011'
        ],
        correct: 0,
        explanation: 'Desimal 67 = 64 + 2 + 1, sehingga dalam bentuk biner 8-bit adalah 01000011.',
        level: 'C3'
      },
      {
        q: 'Karakter spasi pada keyboard komputer memiliki kode desimal ASCII 32. Kode biner 8-bit yang tersimpan saat kamu menekan tombol spasi adalah...',
        options: [
          '00100000',
          '00010000',
          '01000000',
          '00000010'
        ],
        correct: 0,
        explanation: 'Nilai 32 dalam desimal merupakan tepat 2^5, sehingga representasi 8-bit biner adalah 00100000.',
        level: 'C3'
      },
      {
        q: 'Berapakah nilai desimal maksimum yang dapat ditampung oleh 1 Byte (8 bit) data biner tanpa tanda (unsigned, 11111111)?',
        options: [
          '255',
          '256',
          '128',
          '512'
        ],
        correct: 0,
        explanation: '11111111 biner = 128 + 64 + 32 + 16 + 8 + 4 + 2 + 1 = 255 desimal (total 256 kombinasi dari 0 s.d. 255).',
        level: 'C3'
      },
      {
        q: 'Sebuah pesan singkat bertuliskan kata "INFO" disimpan dalam memori komputer. Jika setiap karakter ASCII berukuran 1 Byte, berapa total bit data yang dibutuhkan?',
        options: [
          '32 bit (4 Byte)',
          '16 bit (2 Byte)',
          '64 bit (8 Byte)',
          '8 bit (1 Byte)'
        ],
        correct: 0,
        explanation: 'Kata "INFO" terdiri atas 4 karakter. 4 karakter × 1 Byte/karakter = 4 Byte. 4 Byte × 8 bit = 32 bit.',
        level: 'C3'
      },
      {
        q: 'Jika sebuah bilangan biner "1110" dikonversikan ke dalam bilangan desimal, berapakah hasilnya?',
        options: [
          '14',
          '15',
          '12',
          '10'
        ],
        correct: 0,
        explanation: 'Perhitungan: (1 × 8) + (1 × 4) + (1 × 2) + (0 × 1) = 8 + 4 + 2 + 0 = 14.',
        level: 'C3'
      },

      // 21-30: C4 (Analisis Masalah, Troubleshooting, & HOTS Informatika)
      {
        q: 'Sebuah kabel data mentransmisikan kode biner huruf "A" yaitu 01000001. Di tengah perjalanan, terjadi lonjakan magnetik sehingga bit paling kanan berubah menjadi 0 (01000000 = desimal 64 / karakter @). Fenomena masalah ini menunjukkan bahwa...',
        options: [
          'Perubahan 1 bit saja dapat merusak keabsahan data (data corruption) dan menghasilkan karakter yang sama sekali berbeda',
          'Komputer penerima akan otomatis mengabaikan kesalahan bit tersebut tanpa mengubah karakter',
          'Kecepatan koneksi internet akan langsung meningkat secara otomatis',
          'Kabel data tersebut akan terbakar karena kelebihan bit desimal'
        ],
        correct: 0,
        explanation: 'Integritas data digital sangat sensitif; kesalahan 1 bit (bit flip) mengubah nilai desimal dan arti karakter pada tabel ASCII.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Ketika kamu mengetikkan angka "7" di aplikasi Notepad, sistem operasi menyimpan kode biner ASCII desimal 55 (00110111), bukan biner murni desimal 7 (00000111). Analisis yang paling tepat untuk alasan ini adalah...',
        options: [
          'Input keyboard teks diperlakukan sebagai simbol karakter grafis teks, bukan nilai matematis murni untuk berhitung',
          'Notepad tidak mampu membaca angka ganjil secara langsung',
          'Memori komputer kehabisan ruang sehingga harus menambahkan angka 50 di depannya',
          'Agar angka 7 tidak dapat dilihat oleh program antivirus'
        ],
        correct: 0,
        explanation: 'Karakter angka pada pengolah teks disimpan sebagai karakter ASCII (0–9 berkode 48–57), bukan nilai numerik aritmetika.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Mengapa sistem internet modern saat ini beralih dari standar ASCII 8-bit ke standar Unicode (UTF-8)?',
        options: [
          'Karena tabel ASCII 8-bit terbatas hanya 256 karakter (alfabet latin), sedangkan Unicode mampu mengodekan seluruh aksara dunia (Arab, Jawa, Mandarin, hingga emoji)',
          'Karena standar ASCII menggunakan listrik terlalu boros pada baterai smartphone',
          'Karena kabel serat optik internet tidak mendukung sistem bilangan biner',
          'Karena tabel ASCII hanya boleh digunakan di negara Amerika Serikat'
        ],
        correct: 0,
        explanation: 'Unicode UTF-8 dirancang untuk mendukung miliaran pengguna global dengan ratusan bahasa dan aksara berbeda yang tidak muat di 256 kode ASCII.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Saat mengonversi biner 6-bit "110110" ke desimal, seorang siswa memperoleh jawaban 52. Jawaban yang benar adalah 54. Di manakah letak kekeliruan logika hitung siswa tersebut?',
        options: [
          'Siswa lupa menjumlahkan bobot nilai pada posisi bit 2^1 yang bernilai 2 (32 + 16 + 0 + 4 + 2 + 0 = 54)',
          'Siswa salah mengalikan bit paling depan dengan angka 10',
          'Siswa menganggap bilangan biner harus selalu berjumlah ganjil',
          'Siswa menjumlahkan semua angka 1 menjadi nilai 4'
        ],
        correct: 0,
        explanation: 'Bobot posisi bit aktif adalah 32 + 16 + 4 + 2 = 54. Jika siswa menjawab 52, berarti bit kedua bernilai 2 terlewatkan.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Dua siswa berdiskusi cara mengirimkan angka "100" ke server. Siswa A mengirim dalam bentuk teks ASCII (3 Byte: karakter "1", "0", "0"), sedangkan Siswa B mengirim dalam bentuk biner murni 1 Byte (01100100 = 100). Analisis efisiensi yang tepat adalah...',
        options: [
          'Metode Siswa B tiga kali lebih hemat bandwidth dan memori karena hanya membutuhkan 1 Byte (8 bit)',
          'Metode Siswa A lebih hemat karena karakter teks tidak memerlukan aliran listrik',
          'Kedua metode memerlukan ukuran memori yang persis sama di jaringan',
          'Metode Siswa B tidak dapat diproses oleh kartu jaringan komputer'
        ],
        correct: 0,
        explanation: 'Mengirimkan bilangan sebagai nilai numerik biner murni 8-bit (1 Byte) jauh lebih ringkas dibanding teks 3 karakter (3 Byte).',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Dalam pengiriman data biner jarak jauh, sering diterapkan teknik "Parity Bit" (bit paritas) pada paket data biner 7-bit ASCII. Tujuan utama teknik ini adalah...',
        options: [
          'Mendeteksi secara cepat jika terjadi perubahan bit tunggal akibat gangguan derau (noise) sinyal saat transmisi',
          'Mengompresi ukuran data agar menjadi separuh dari ukuran aslinya',
          'Mengubah pesan rahasia menjadi bahasa sandi yang tidak terbaca',
          'Menambah daya tegangan listrik pada router penerima'
        ],
        correct: 0,
        explanation: 'Bit paritas (ganjil/genap) adalah metode paling sederhana untuk memverifikasi apakah ada bit yang rusak selama transmisi data.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Pada layar smartphone, setiap titik piksel warna tersusun dari komponen RGB (Red, Green, Blue) yang masing-masing berukuran 8-bit biner (1 Byte). Berapakah jumlah variasi warna total yang dapat dihasilkan?',
        options: [
          'Sekitar 16,7 juta variasi warna (256 × 256 × 256)',
          'Hanya 256 warna',
          'Tepat 1000 variasi warna',
          'Tidak terbatas hingga miliaran triliun warna'
        ],
        correct: 0,
        explanation: 'Masing-masing 8-bit menghasilkan 256 level. Kombinasi 256 Merah × 256 Hijau × 256 Biru menghasilkan 16.777.216 warna (24-bit True Color).',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Mengapa perancang prosesor komputer tidak menggunakan sistem desimal berbasis 10 langsung pada sirkuit elektroniknya?',
        options: [
          'Sangat sulit dan tidak stabil membuat komponen sirkuit mikro yang harus membedakan 10 tingkatan voltase listrik tanpa terjadi salah baca akibat suhu panas',
          'Karena sistem desimal dilarang oleh asosiasi standar teknologi dunia',
          'Karena sistem biner ditemukan lebih dulu sebelum manusia mengenal angka desimal',
          'Agar manusia tidak bisa merakit komputer sendiri di rumah'
        ],
        correct: 0,
        explanation: 'Mendeteksi 2 kondisi (on/off) memiliki toleransi noise yang sangat tinggi, sedangkan membedakan 10 level voltase mikro sangat rentan error.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Sebuah dokumen teks polos tanpa gambar berisi tepat 2.000 karakter huruf dan spasi. Berdasarkan pengkodean ASCII 1 Byte per karakter, perkiraan ukuran file tersebut di penyimpanan adalah...',
        options: [
          'Sekitar 2.000 Byte (± 2 Kilobyte)',
          'Sekitar 2 Megabyte',
          'Tepat 16.000 Kilobyte',
          'Hanya 200 Byte'
        ],
        correct: 0,
        explanation: '2.000 karakter × 1 Byte = 2.000 Byte, atau sekitar 1,95 KB (sering dibulatkan menjadi 2 KB).',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Kesimpulan konsep: Mengapa pemahaman konversi biner dan kodifikasi data sangat esensial dalam pembelajaran Informatika SMP?',
        options: [
          'Memberikan fondasi pemikiran logis tentang bagaimana teknologi komputasi mengubah realitas fisik menjadi data digital yang dapat diolah secara cerdas',
          'Agar siswa dapat menghafal seluruh 256 kode tabel ASCII di luar kepala',
          'Supaya siswa tidak perlu lagi menggunakan kalkulator atau komputer',
          'Hanya sebagai materi formalitas ujian tanpa adanya keterkaitan dengan software masa depan'
        ],
        correct: 0,
        explanation: 'Kodifikasi dan sistem bilangan biner adalah fondasi logika digital yang mendasari seluruh operasi hardware, jaringan, dan software modern.',
        level: 'C4 (HOTS)'
      }
    ];

    return informaticsBinaryQuestions.map((t, idx) => ({
      id: `qb-${idx + 1}`,
      question: t.q,
      options: t.options,
      correctAnswerIndex: t.correct,
      explanation: t.explanation,
      cognitiveLevel: t.level
    }));
  }

  // Domain branch: File Sharing across devices in a network (LAN/WLAN/SMB/FTP)
  const isFileSharingOrNetwork = /(berbagi file|share file|sharing file|jaringan lokal|lan|wlan|perangkat dalam satu jaringan|transmisi data|shared folder|file transfer)/i.test(combinedText);

  if (isFileSharingOrNetwork) {
    const fileSharingQuestions: Array<{
      q: string;
      options: [string, string, string, string];
      correct: number;
      explanation: string;
      level: string;
    }> = [
      // 1-10: C2 (Pemahaman Konsep Berbagi File & Jaringan)
      {
        q: 'Apa tujuan utama dari aktivitas berbagi file (file sharing) antar perangkat dalam satu jaringan lokal?',
        options: [
          'Memungkinkan pertukaran dan akses data bersama antar komputer tanpa perlu memindahkan media penyimpanan fisik seperti flashdisk',
          'Meningkatkan kecepatan koneksi internet seluruh komputer secara otomatis',
          'Mengubah kapasitas harddisk komputer menjadi tidak terbatas',
          'Menghapus virus komputer secara serentak di semua perangkat'
        ],
        correct: 0,
        explanation: 'Berbagi file (file sharing) memungkinkan pengguna mengirim, menerima, dan mengelola dokumen bersama secara efisien melalui jaringan tanpa perantara fisik.',
        level: 'C2'
      },
      {
        q: 'Syarat paling mendasar agar dua perangkat komputer dapat saling berbagi file secara langsung melalui jaringan lokal (LAN) adalah...',
        options: [
          'Kedua perangkat harus terhubung ke jaringan/subnet yang sama dan memiliki alamat IP yang saling mengenali',
          'Kedua perangkat harus memiliki merek, tipe, dan spesifikasi prosesor yang persis sama',
          'Kedua komputer wajib terhubung ke jaringan internet global berkecepatan tinggi',
          'Salah satu komputer harus dalam keadaan mati saat file dikirimkan'
        ],
        correct: 0,
        explanation: 'Dua perangkat wajib berada pada satu segmen jaringan lokal yang sama dan memiliki konfigurasi alamat IP yang valid agar dapat berkomunikasi.',
        level: 'C2'
      },
      {
        q: 'Alamat identitas numerik unik yang diberikan kepada setiap perangkat dalam jaringan komputer untuk keperluan komunikasi dan pengiriman data disebut...',
        options: [
          'IP Address (Internet Protocol Address)',
          'MAC Barcode',
          'Serial Number Processor',
          'URL Domain'
        ],
        correct: 0,
        explanation: 'IP Address berfungsi sebagai alamat pengenal logis setiap host/perangkat dalam jaringan komputer.',
        level: 'C2'
      },
      {
        q: 'Protokol standar yang umum digunakan sistem operasi Windows untuk melakukan berbagi file dan printer dalam jaringan lokal adalah...',
        options: [
          'SMB (Server Message Block)',
          'SMTP (Simple Mail Transfer Protocol)',
          'DNS (Domain Name System)',
          'POP3 (Post Office Protocol)'
        ],
        correct: 0,
        explanation: 'SMB adalah protokol client-server yang digunakan Windows dan Linux (Samba) untuk berbagi folder, file, dan printer di jaringan lokal.',
        level: 'C2'
      },
      {
        q: 'Dalam sistem operasi, fitur yang memungkinkan folder di komputer lokal dapat diakses dan dibaca oleh komputer lain di jaringan disebut...',
        options: [
          'Shared Folder (Folder Berbagi)',
          'Compressed Zip Folder',
          'Hidden System Directory',
          'Recycle Bin Folder'
        ],
        correct: 0,
        explanation: 'Shared Folder adalah direktori yang telah diberi izin akses jaringan oleh pemiliknya agar bisa diakses perangkat lain.',
        level: 'C2'
      },
      {
        q: 'Perbedaan utama antara hak akses "Read" (Baca Saja) dan "Read/Write" (Baca/Tulis) pada folder sharing jaringan adalah...',
        options: [
          'Izin "Read" hanya membolehkan melihat dan mengunduh file, sedangkan "Read/Write" membolehkan mengubah, menambah, atau menghapus isi file',
          'Izin "Read" memerlukan biaya langganan, sedangkan "Read/Write" gratis',
          'Izin "Read" membuat transfer file lebih cepat 2 kali lipat dibanding "Read/Write"',
          'Izin "Read" hanya berlaku untuk file audio, sedangkan "Read/Write" untuk file video'
        ],
        correct: 0,
        explanation: 'Hak akses Read menjaga data agar tidak sengaja diubah/dihapus pengguna lain, sedangkan Read/Write memberikan kendali modifikasi penuh.',
        level: 'C2'
      },
      {
        q: 'Media transmisi fisik yang umum digunakan untuk menghubungkan komputer ke switch/router pada jaringan kabel lokal adalah...',
        options: [
          'Kabel UTP dengan konektor RJ-45',
          'Kabel audio jack 3.5 mm',
          'Kabel HDMI resolusi tinggi',
          'Kabel daya AC dua pin'
        ],
        correct: 0,
        explanation: 'Kabel UTP (Unshielded Twisted Pair) dengan konektor RJ-45 adalah media standar koneksi kabel Ethernet pada jaringan komputer.',
        level: 'C2'
      },
      {
        q: 'Teknologi nirkabel jarak dekat yang sering digunakan smartphone Android untuk berbagi file berukuran besar secara cepat tanpa kuota internet adalah...',
        options: [
          'Quick Share / Wi-Fi Direct',
          'SMS Banking',
          'Inframerah Remote TV',
          'Dial-Up Modem'
        ],
        correct: 0,
        explanation: 'Quick Share dan Wi-Fi Direct menggunakan gelombang radio Wi-Fi peer-to-peer sehingga transfer file berukuran gigabyte berlangsung sangat cepat tanpa internet.',
        level: 'C2'
      },
      {
        q: 'Model arsitektur jaringan di mana setiap komputer memiliki kedudukan yang setara, bisa bertindak sebagai penyedia file maupun penerima file disebut...',
        options: [
          'Peer-to-Peer (P2P)',
          'Client-Server Terpusat',
          'Mainframe Terminal',
          'Star Topology Hybrid'
        ],
        correct: 0,
        explanation: 'Pada model Peer-to-Peer, tidak ada server terpusat; semua komputer di jaringan dapat saling berbagi file secara mandiri.',
        level: 'C2'
      },
      {
        q: 'Apa fungsi dari fitur "Network Discovery" pada pengaturan jaringan komputer?',
        options: [
          'Mengizinkan komputer mendeteksi komputer lain dan sekaligus terlihat oleh perangkat lain yang terhubung di jaringan yang sama',
          'Mencari sinyal satelit GPS terdekat dari lokasi komputer',
          'Menghapus riwayat pencarian browser internet secara otomatis',
          'Menonaktifkan kartu Wi-Fi komputer untuk menghemat baterai'
        ],
        correct: 0,
        explanation: 'Network Discovery membuat perangkat saling mengenali keberadaan satu sama lain di dalam jaringan lokal.',
        level: 'C2'
      },
      // 11-20: C3 (Penerapan Praktis & Konfigurasi Jaringan)
      {
        q: 'Siswa ingin mengakses folder yang dibagikan oleh laptop guru dengan IP 192.168.1.25 melalui File Explorer di Windows. Perintah path yang benar diketik di kolom address bar adalah...',
        options: [
          '\\\\192.168.1.25',
          'http://192.168.1.25:8080',
          'ftp:\\192.168.1.25',
          'C:\\Windows\\192.168.1.25'
        ],
        correct: 0,
        explanation: 'Di sistem Windows, path jaringan diakses menggunakan dua garis miring terbalik (backslash) diikuti alamat IP atau nama komputer: \\\\IP_Address.',
        level: 'C3'
      },
      {
        q: 'Sebuah file presentasi video berukuran 600 MegaByte (MB) ditransfer melalui jaringan kabel LAN Gigabit dengan kecepatan efektif transfer 30 MB/detik. Perkiraan waktu yang dibutuhkan hingga transfer selesai adalah...',
        options: [
          '20 detik',
          '60 detik',
          '5 menit',
          '20 menit'
        ],
        correct: 0,
        explanation: 'Waktu = Ukuran File / Kecepatan = 600 MB / 30 MB/s = 20 detik.',
        level: 'C3'
      },
      {
        q: 'Guru ingin membagikan modul latihan soal PDF kepada seluruh siswa di lab, namun guru tidak ingin siswa sengaja atau tidak sengaja menghapus modul tersebut di folder sharing. Pengaturan izin akses yang tepat adalah...',
        options: [
          'Memberikan izin "Read Only" kepada grup Everyone / Siswa',
          'Memberikan izin "Full Control" kepada semua pengguna',
          'Menyembunyikan folder tanpa memberikan izin sharing apapun',
          'Mengunci folder dengan password yang tidak diberitahukan kepada siswa'
        ],
        correct: 0,
        explanation: 'Izin Read Only memastikan siswa hanya bisa membaca dan menyalin file modul tanpa bisa mengedit atau menghapusnya dari server guru.',
        level: 'C3'
      },
      {
        q: 'Dua siswa membawa laptop ke ruang kelas yang tidak memiliki router Wi-Fi maupun koneksi internet. Cara termudah menghubungkan kedua laptop tersebut untuk transfer data via kabel adalah...',
        options: [
          'Menghubungkan kedua port LAN laptop secara langsung dengan kabel UTP (Auto-MDIX) dan mengatur IP statis satu subnet',
          'Mencabut harddisk kedua laptop lalu saling menukarnya',
          'Menghubungkan kedua laptop menggunakan kabel charger listrik',
          'Tidak bisa dilakukan sama sekali karena transfer file wajib ada koneksi internet'
        ],
        correct: 0,
        explanation: 'Port Ethernet modern mendukung Auto-MDIX sehingga kabel LAN dapat langsung menghubungkan 2 PC tanpa perantara switch.',
        level: 'C3'
      },
      {
        q: 'Sebelum mengirim folder berisi 150 file foto kegiatan sekolah ke komputer lain di jaringan, tindakan paling efektif agar proses transfer lebih cepat dan teratur adalah...',
        options: [
          'Mengompres seluruh folder menjadi 1 file arsip (.ZIP atau .RAR)',
          'Mengubah ekstensi semua file foto menjadi .TXT satu per satu',
          'Mengirimkan foto satu per satu secara manual sebanyak 150 kali',
          'Menghapus setengah dari foto tersebut agar ukurannya mengecil'
        ],
        correct: 0,
        explanation: 'Mengompresi ratusan file menjadi satu arsip ZIP mengurangi overhead pembuatan koneksi file per file sehingga transfer jaringan jauh lebih cepat.',
        level: 'C3'
      },
      {
        q: 'Sebuah printer kantor terhubung dengan kabel USB ke PC-1. Agar PC-2 dan PC-3 di ruangan yang sama dapat mencetak dokumen ke printer tersebut, fitur yang harus diaktifkan pada PC-1 adalah...',
        options: [
          'Printer Sharing pada Control Panel / Settings PC-1',
          'Bluetooth File Transfer di PC-3',
          'Disk Defragmenter di PC-1',
          'Remote Desktop Connection di seluruh PC'
        ],
        correct: 0,
        explanation: 'Fitur Printer Sharing membuat printer lokal pada satu komputer dapat digunakan bersama (shared printer) oleh komputer lain di jaringan.',
        level: 'C3'
      },
      {
        q: 'Dalam pengaturan IP statis di lab komputer, Komputer A memiliki IP 192.168.1.10 dengan subnet mask 255.255.255.0. Agar Komputer B dapat langsung berkomunikasi dalam satu jaringan yang sama, alamat IP yang valid untuk Komputer B adalah...',
        options: [
          '192.168.1.15',
          '192.168.2.10',
          '10.0.0.1',
          '192.168.1.10 (sama persis)'
        ],
        correct: 0,
        explanation: 'Komputer B harus berada di subnet yang sama (tiga oktet pertama 192.168.1.x) dengan nilai host unik yang berbeda (misal .15) dan tidak boleh sama agar tidak terjadi IP conflict.',
        level: 'C3'
      },
      {
        q: 'Pada aplikasi file manager di smartphone, siswa mengaktifkan fitur "FTP Server" yang memunculkan alamat ftp://192.168.1.8:2121. Cara siswa melihat isi memori HP tersebut dari laptop di jaringan yang sama adalah...',
        options: [
          'Membuka File Explorer atau browser di laptop lalu mengetik alamat ftp://192.168.1.8:2121 pada address bar',
          'Mencari Bluetooth perangkat di menu Device Manager',
          'Memasukkan kartu SIM smartphone ke lubang USB laptop',
          'Menghubungkan kedua perangkat ke proyektor HDMI'
        ],
        correct: 0,
        explanation: 'Protokol FTP memungkinkan browser atau File Explorer mengakses berkas media smartphone melalui jaringan nirkabel lokal secara praktis.',
        level: 'C3'
      },
      {
        q: 'Siswa mencoba melakukan tes konektivitas dasar ke komputer server file di lab sebelum membuka shared folder. Perintah Command Prompt (CMD) yang tepat digunakan adalah...',
        options: [
          'ping 192.168.1.100',
          'format C: /q',
          'tasklist /v',
          'shutdown /s'
        ],
        correct: 0,
        explanation: 'Perintah "ping" mengirim paket ICMP untuk mengecek apakah komputer tujuan aktif dan dapat merespons komunikasi jaringan.',
        level: 'C3'
      },
      {
        q: 'Ketika menghubungkan laptop ke jaringan Wi-Fi sekolah, Windows menanyakan jenis lokasi jaringan. Profil jaringan yang harus dipilih agar fitur berbagi file di lab berfungsi dengan lancar adalah...',
        options: [
          'Private Network (Jaringan Privat)',
          'Public Network (Jaringan Publik)',
          'Guest Restricted Network',
          'Airplane Network'
        ],
        correct: 0,
        explanation: 'Private Network membuka izin penemuan perangkat (Network Discovery) dan berbagi file, sedangkan Public Network menutupnya demi keamanan.',
        level: 'C3'
      },
      // 21-30: C4 (Analisis, Troubleshooting Jaringan & HOTS)
      {
        q: 'Laptop A dan Laptop B sama-sama terhubung ke Wi-Fi sekolah yang sama, namun Laptop A sama sekali tidak bisa melihat Laptop B di daftar "Network". Tindakan troubleshooting pertama yang paling logis adalah...',
        options: [
          'Memeriksa apakah Network Profile di Laptop B diatur ke "Public" dan mengaktifkan fitur "Turn on network discovery"',
          'Langsung menginstal ulang sistem operasi pada kedua laptop',
          'Mengganti kabel charger baterai kedua laptop',
          'Membeli router baru untuk ruang kelas'
        ],
        correct: 0,
        explanation: 'Jika profil jaringan disetel ke Public Network atau Network Discovery mati, firewall Windows akan memblokir respon pengenalan perangkat.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Saat Budi mencoba menyimpan hasil edit dokumen ke folder sharing di komputer guru, muncul pesan kesalahan "Access Denied: You need permission to perform this action". Analisis penyebab utama masalah ini adalah...',
        options: [
          'Izin akses folder sharing (Sharing/NTFS Permission) yang diberikan guru hanya sebatas "Read" (Baca), bukan "Write" atau "Modify"',
          'Harddisk laptop Budi rusak total sehingga tidak bisa mengirim sinyal data',
          'Komputer guru tidak tersambung ke jaringan listrik',
          'Kabel HDMI proyektor terlepas dari komputer guru'
        ],
        correct: 0,
        explanation: 'Pesan "Access Denied" menandakan pengguna memiliki hak baca (Read) tetapi tidak memiliki wewenang simpan/tulis (Write/Modify) pada direktori tersebut.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Di lab komputer, transfer file sebesar 5 GB antar komputer melalui kabel LAN berlangsung cepat (±1 menit). Namun ketika menggunakan koneksi Wi-Fi di ruangan sebelah, transfer file yang sama memakan waktu 25 menit dan sering terputus. Mengapa hal ini terjadi?',
        options: [
          'Sinyal Wi-Fi mengalami redaman fisik (dinding/beton) dan interferensi frekuensi, sedangkan kabel LAN memiliki bandwidth stabil tanpa interferensi gelombang',
          'Kabel LAN secara otomatis menghapus separuh ukuran file yang dikirim',
          'Sinyal Wi-Fi hanya dirancang untuk mengirim pesan teks, bukan file biner',
          'Komputer penerima menolak file jika dikirimkan tanpa kabel'
        ],
        correct: 0,
        explanation: 'Media nirkabel sangat rentan terhadap pelemahan sinyal akibat jarak, penghalang fisik, dan interferensi gelombang radio, berbeda dengan kabel tembaga LAN yang terisolasi stabil.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Mengapa sangat berbahaya mengaktifkan "File Sharing" dan "Network Discovery" dengan akses "Everyone - Full Control" saat laptop terhubung ke jaringan Wi-Fi umum di kafe atau bandara?',
        options: [
          'Siapa saja pengguna asing di jaringan publik tersebut dapat melihat, mencuri, memodifikasi, atau bahkan menanam malware ke dalam file laptop Anda',
          'Laptop akan kehabisan memori RAM dalam hitungan detik',
          'Tagihan listrik kafe akan dibebankan ke pemilik laptop',
          'Kecepatan browsing internet laptop lain di kafe akan langsung mati total'
        ],
        correct: 0,
        explanation: 'Di jaringan Wi-Fi publik, semua orang tergabung dalam subnet yang sama; membuka sharing tanpa proteksi sandi membuka celah eksploitasi data pribadi.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Dua siswa tidak sengaja memasukkan alamat IP yang persis sama (192.168.1.50) pada pengaturan IP manual di laptop masing-masing. Apa dampak teknis yang akan terjadi pada komunikasi jaringan keduanya?',
        options: [
          'Terjadi "IP Address Conflict" sehingga salah satu atau kedua laptop tidak dapat berkomunikasi secara normal di jaringan',
          'Kecepatan prosesor kedua laptop akan meningkat dua kali lipat',
          'Data file di kedua laptop akan otomatis tertukar secara acak',
          'Router Wi-Fi akan meledak karena kelebihan tegangan data'
        ],
        correct: 0,
        explanation: 'IP Conflict menyebabkan tabel routing ARP router bingung membedakan tujuan paket data, mengakibatkan koneksi kedua perangkat terputus atau tidak stabil.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Setelah selesai mendownload file master sistem operasi ISO sebesar 4 GB dari server lokal sekolah, teknisi mengecek nilai hash SHA-256 file tersebut dan ternyata berbeda dengan nilai asli di server. Kesimpulan yang benar adalah...',
        options: [
          'File hasil transfer mengalami korupsi atau kerusakan data (bit flip) saat transmisi dan tidak aman digunakan',
          'File tersebut telah berubah format menjadi file gambar JPEG',
          'Komputer teknisi memiliki resolusi layar yang berbeda dari server',
          'Perbedaan nilai hash adalah hal biasa yang menandakan transfer berhasil sempurna'
        ],
        correct: 0,
        explanation: 'Checksum/Hash yang tidak cocok membuktikan ada bit data yang hilang atau rusak saat transmisi jaringan, sehingga file korup.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Untuk kebutuhan 40 komputer di lab sekolah yang sering bertukar file tugas harian, lab manager memilih memasang perangkat NAS (Network Attached Storage) mandiri dibanding menjadikan salah satu komputer siswa sebagai server sharing. Alasan arsitektural yang tepat adalah...',
        options: [
          'NAS dirancang khusus untuk penyimpanan data terpusat dengan redundansi disk (RAID), manajemen hak akses terpadu, dan hemat daya tanpa bergantung pada komputer siswa',
          'NAS tidak memerlukan aliran listrik sama sekali',
          'NAS hanya bisa digunakan oleh 1 komputer dalam satu waktu',
          'Komputer siswa tidak memiliki sistem operasi untuk menyimpan file'
        ],
        correct: 0,
        explanation: 'NAS memberikan keandalan server storage khusus, performa I/O tinggi, proteksi backup, serta ketersediaan 24/7 tanpa membebani performa PC individu.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Siswa mendapati error "The action can\'t be completed because the file is open in another program" saat mencoba memindahkan file di folder jaringan. Cara pemecahan masalah yang paling tepat adalah...',
        options: [
          'Meminta pengguna lain di jaringan yang sedang membuka file tersebut untuk menutup aplikasinya terlebih dahulu agar kunci file (file lock) terlepas',
          'Mematikan paksa sakelar listrik seluruh laboratorium komputer',
          'Mengganti nama folder Windows menjadi huruf kapital semua',
          'Menghapus kartu jaringan (NIC) dari komputer'
        ],
        correct: 0,
        explanation: 'Sistem operasi menerapkan mekanisme penguncian file (file locking) demi mencegah konflik inkonsistensi saat dua orang mengedit berkas yang sama bersamaan.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Guru ingin menyebarkan video materi sebesar 1 GB ke 32 komputer siswa secara serentak. Jika guru menyuruh 32 siswa mengklik dan mendownload file dari satu PC guru biasa pada detik yang sama, apa yang akan terjadi?',
        options: [
          'Kecepatan transmisi di PC guru akan terbagi ke 32 koneksi (congesti bottleneck) sehingga transfer melambat drastis bagi seluruh siswa',
          'Transfer akan selesai serentak dalam 1 detik untuk semua siswa',
          'Komputer guru akan otomatis mematikan 31 komputer siswa lainnya',
          'File video akan terpecah menjadi 32 potongan yang tidak bisa diputar'
        ],
        correct: 0,
        explanation: 'Bandwidth kartu jaringan dan throughput disk pada PC penyedia akan terbagi rata (bottleneck), mengakibatkan antrean paket data dan pelambatan signifikan.',
        level: 'C4 (HOTS)'
      },
      {
        q: 'Berdasarkan analisis keamanan dan efisiensi, strategi terbaik untuk mengelola file tugas siswa dalam jaringan lokal sekolah jangka panjang adalah...',
        options: [
          'Menyediakan folder sharing khusus kelas dengan autentikasi akun masing-masing, izin write hanya pada subfolder siswa sendiri, dan backup rutin terjadwal',
          'Membuka seluruh drive C: komputer guru dengan hak Full Control untuk semua pengunjung tanpa kata sandi',
          'Melarang seluruh penggunaan jaringan komputer dan kembali menggunakan kertas fotokopi',
          'Menyimpan seluruh tugas siswa pada flashdisk yang digilirkan bergantian ke 32 komputer'
        ],
        correct: 0,
        explanation: 'Pengelolaan file sharing yang baik menerapkan prinsip least privilege (hak akses terbatas sesuai kebutuhan), isolasi user, serta backup berkala.',
        level: 'C4 (HOTS)'
      }
    ];

    return fileSharingQuestions.map((t, idx) => ({
      id: `qb-fs-${idx + 1}`,
      question: t.q,
      options: t.options,
      correctAnswerIndex: t.correct,
      explanation: t.explanation,
      cognitiveLevel: t.level
    }));
  }

  // General fallback questions formatted naturally without quoting TP or using meta wording
  const generalTemplates: Array<{
    q: string;
    options: [string, string, string, string];
    correct: number;
    explanation: string;
    level: string;
  }> = [
    // 1-10: C2 (Pemahaman Konsep Inti & Karakteristik)
    {
      q: `Dalam materi "${title}", fokus pemahaman utama yang mendasari cara kerja atau konsepnya adalah...`,
      options: [
        `Mekanisme kerja, karakteristik pembeda, dan manfaat praktis konsep ${title}`,
        'Daftar aturan hafalan tertulis tanpa penerapan di kehidupan sehari-hari',
        'Kumpulan rumus rumit yang tidak berhubungan dengan dunia nyata',
        'Sistem konvensional yang sudah tidak relevan digunakan saat ini'
      ],
      correct: 0,
      explanation: `Memahami konsep pokok ${title} membantu siswa mengenali prinsip dasar dan fungsinya dalam pembelajaran ${subj}.`,
      level: 'C2'
    },
    {
      q: `Karakteristik penting yang membedakan konsep "${title}" dari metode atau sistem konvensional adalah...`,
      options: [
        'Memiliki mekanisme yang terstruktur dan dirancang untuk mempermudah pemecahan masalah manusia',
        'Hanya dapat digunakan sekali lalu tidak dapat dimanfaatkan kembali',
        'Sama sekali tidak memerlukan sarana pendukung dalam pengoperasiannya',
        'Selalu membutuhkan biaya yang sangat tinggi sehingga sulit diakses'
      ],
      correct: 0,
      explanation: `Ciri esensial dari ${title} terletak pada keteraturan proses yang terencana untuk efektivitas kerja manusia.`,
      level: 'C2'
    },
    {
      q: `Bagaimanakah alur proses atau siklus kerja yang terjadi saat sistem "${title}" beroperasi?`,
      options: [
        'Menerima data/masukan (input), memproses secara terstruktur, dan menghasilkan keluaran (output) yang bermanfaat',
        'Bekerja secara acak tanpa adanya keteraturan proses',
        'Menghapus seluruh file data secara tiba-tiba tanpa konfirmasi',
        'Menghentikan fungsi perangkat lain yang terhubung'
      ],
      correct: 0,
      explanation: `Sistem ${title} beroperasi melalui tahapan input, proses, dan output yang teratur.`,
      level: 'C2'
    },
    {
      q: `Manakah pernyataan yang paling tepat mengenai peran utama "${title}" bagi aktivitas sehari-hari?`,
      options: [
        'Meningkatkan efisiensi kerja, mempercepat akses informasi, dan mempermudah kolaborasi',
        'Membatasi kesempatan siswa untuk berinteraksi sosial di sekolah',
        'Menghilangkan kebutuhan manusia untuk berpikir kritis dan kreatif',
        'Mewajibkan pengguna membayar biaya langganan setiap kali digunakan'
      ],
      correct: 0,
      explanation: `Pemanfaatan ${title} ditujukan untuk mempermudah kegiatan, mempercepat akses, dan meningkatkan efisiensi.`,
      level: 'C2'
    },
    {
      q: `Konsep atau teknologi "${title}" pada umumnya diklasifikasikan berdasarkan...`,
      options: [
        'Fungsi spesifiknya, media yang digunakan, dan jangkauan penerapannya',
        'Warna fisik kemasan produk pendukungnya',
        'Ketebalan buku petunjuk penggunaannya',
        'Jumlah tombol fisik yang ada pada alat'
      ],
      correct: 0,
      explanation: `Pengelompokan ${title} didasarkan pada fungsi teknis, media operasional, dan cakupan kegunaannya.`,
      level: 'C2'
    },
    {
      q: `Bagi siswa jenjang SMP, manfaat nyata mempelajari materi "${title}" adalah...`,
      options: [
        'Memahami logika dasar sistem di sekitarnya dan memanfaatkannya secara cerdas dan beretika',
        'Hanya sekadar menghafal definisi demi kelulusan ujian semester',
        'Menghindari tugas sekolah yang berkaitan dengan teknologi dan analisis data',
        'Memamerkan kemampuan tanpa mau berbagi wawasan kepada rekan sejawat'
      ],
      correct: 0,
      explanation: `Mempelajari ${title} melatih literasi dan kecakapan bernalar kritis yang aplikatif di era digital.`,
      level: 'C2'
    },
    {
      q: `Komponen kunci yang menjamin keberhasilan pengoperasian "${title}" secara optimal adalah...`,
      options: [
        'Keterpaduan antara komponen perangkat, prosedur operasional yang benar, dan ketelitian pengguna',
        'Desain casing luar yang mencolok dan bercahaya warna-warni',
        'Harga beli yang paling mahal di pasaran',
        'Pemberian tegangan listrik melebihi batas standar kapasitas mesin'
      ],
      correct: 0,
      explanation: `Sinergi antara sarana kerja, SOP yang tepat, dan kecakapan operator merupakan penentu keberhasilan sistem ${title}.`,
      level: 'C2'
    },
    {
      q: `Ketika mempelajari materi "${title}", hubungan sebab-akibat yang sering ditemukan adalah...`,
      options: [
        'Ketepatan input dan proses yang benar akan menghasilkan keluaran yang akurat dan dapat dipercaya',
        'Semakin banyak kesalahan input maka hasil kerja otomatis semakin sempurna',
        'Proses kerja sistem tidak dipengaruhi oleh data masukan apa pun',
        'Keluaran sistem selalu sama meskipun input data diubah'
      ],
      correct: 0,
      explanation: `Prinsip fundamental sistem adalah "garbage in, garbage out"; ketepatan input menentukan mutu output.`,
      level: 'C2'
    },
    {
      q: `Apa fungsi dari tahapan evaluasi atau verifikasi pada penerapan konsep "${title}"?`,
      options: [
        'Memastikan hasil kerja sesuai dengan standar kualitas dan bebas dari kesalahan fatal',
        'Menunda penyelesaian tugas agar tampak lebih sulit dikerjakan',
        'Menghapus dokumentasi riwayat pekerjaan yang telah selesai',
        'Mengulang proses dari awal tanpa alasan yang jelas'
      ],
      correct: 0,
      explanation: `Verifikasi berfungsi sebagai kontrol kualitas untuk mendeteksi anomali atau kesalahan sedini mungkin.`,
      level: 'C2'
    },
    {
      q: `Mengapa standarisasi aturan sangat diperlukan dalam pengembangan dan penggunaan "${title}"?`,
      options: [
        'Agar terjadi keselarasan (kompatibilitas) dan kemudahan interaksi antarsistem yang berbeda',
        'Supaya produsen teknologi lain tidak dapat menciptakan inovasi baru',
        'Agar pengguna kesulitan saat berganti merek perangkat',
        'Untuk membatasi jumlah informasi yang boleh dipelajari masyarakat'
      ],
      correct: 0,
      explanation: `Standarisasi menjamin interoperabilitas sehingga sistem dari berbagai pengembang dapat saling terhubung.`,
      level: 'C2'
    },

    // 11-20: C3 (Penerapan Kasus Nyata Sehari-hari)
    {
      q: `Contoh situasi nyata di sekolah yang menunjukkan penerapan tepat prinsip "${title}" adalah...`,
      options: [
        'Siswa memanfaatkan data dan alur terstruktur untuk menyelesaikan proyek kolaborasi kelompok secara efektif',
        'Siswa menyimpan buku pelajaran di lemari terkunci dan tidak pernah membukanya',
        'Menghindari penggunaan perangkat teknologi saat mengerjakan tugas sekolah',
        'Menyalin catatan rekan tanpa membaca dan memahami isinya'
      ],
      correct: 0,
      explanation: `Pemanfaatan alur kerja terstruktur untuk menyelesaikan proyek nyata mencerminkan penerapan praktis ${title}.`,
      level: 'C3'
    },
    {
      q: `Di lingkungan rumah, tindakan yang mencerminkan pemanfaatan bijak konsep "${title}" adalah...`,
      options: [
        'Mengatur jadwal penggunaan gawai dan memanfaatkan fitur keamanan digital keluarga dengan benar',
        'Membiarkan perangkat elektronik menyala tanpa digunakan sepanjang malam',
        'Membagikan data pribadi keluarga di forum internet terbuka',
        'Mematikan saklar listrik pusat setiap kali hendak belajar'
      ],
      correct: 0,
      explanation: `Penerapan literasi ${title} di rumah tampak pada efisiensi penggunaan dan perlindungan privasi data.`,
      level: 'C3'
    },
    {
      q: `Langkah awal yang paling tepat ketika hendak menerapkan konsep "${title}" untuk menyelesaikan sebuah permasalahan adalah...`,
      options: [
        'Menganalisis kebutuhan, mengidentifikasi data awal, dan menyusun langkah penyelesaian secara runtut',
        'Langsung mengambil kesimpulan akhir tanpa mempelajari data yang tersedia',
        'Menunggu rekan lain menyelesaikan seluruh tahapan tugas',
        'Mengubah target tujuan agar tugas terasa lebih mudah'
      ],
      correct: 0,
      explanation: `Metodologi pemecahan masalah yang baik diawali dengan identifikasi data dan perencanaan sistematis.`,
      level: 'C3'
    },
    {
      q: `Ketika kamu menemukan kendala saat mempraktikkan konsep "${title}", tindakan pertama yang sesuai prosedur adalah...`,
      options: [
        'Memeriksa kembali tahapan input data dan membandingkannya dengan panduan atau konsep dasar',
        'Merusak perangkat pendukung yang sedang digunakan',
        'Meninggalkan pekerjaan tanpa memberitahukan kepada guru pembimbing',
        'Mengganti seluruh materi pelajaran dengan topik lain'
      ],
      correct: 0,
      explanation: `Troubleshooting terarah dilakukan dengan melacak kembali input dan alur proses terhadap panduan resmi.`,
      level: 'C3'
    },
    {
      q: `Skenario manakah yang menunjukkan penerapan prinsip keamanan dan etika dalam materi "${title}"?`,
      options: [
        'Menjaga kerahasiaan kredensial akun dan menghormati hak cipta karya intelektual orang lain',
        'Menggunakan identitas orang lain untuk mengakses data tanpa izin',
        'Mengunggah hasil karya kelompok orang lain dan mengeklaim sebagai buatan sendiri',
        'Menonaktifkan seluruh perlindungan antivirus pada sistem'
      ],
      correct: 0,
      explanation: `Etika digital dan integritas perlindungan data merupakan bagian integral dari implementasi ${title}.`,
      level: 'C3'
    },
    {
      q: `Dalam kolaborasi tim sekolah, penerapan konsep "${title}" dapat membantu anggota kelompok untuk...`,
      options: [
        'Membagi tugas secara adil, menyelaraskan format data, dan memantau kemajuan bersama secara transparan',
        'Menyerahkan seluruh beban tugas hanya kepada ketua kelompok',
        'Menyembunyikan informasi penting agar anggota lain tidak mengetahuinya',
        'Menunda pengumpulan tugas hingga melewati tenggat waktu'
      ],
      correct: 0,
      explanation: `Sistem ${title} memfasilitasi kerja sama tim yang efektif melalui standardisasi format data dan transparansi.`,
      level: 'C3'
    },
    {
      q: `Jika suatu sistem pendukung materi "${title}" mengalami penurunan kinerja yang lambat, langkah pengecekan yang tepat adalah...`,
      options: [
        'Mengevaluasi beban proses yang sedang berjalan dan membersihkan antrean tugas yang tidak relevan',
        'Menambah beban kerja ganda pada sistem secara bersamaan',
        'Memukul fisik perangkat keras secara berulang-ulang',
        'Menghapus sistem operasi komputer secara permanen'
      ],
      correct: 0,
      explanation: `Optimasi performa diawali dengan meninjau kapasitas beban proses dan mematikan tugas yang memberatkan.`,
      level: 'C3'
    },
    {
      q: `Penerapan metode penyederhanaan (abstraksi) pada konsep "${title}" bertujuan untuk...`,
      options: [
        'Menyaring informasi esensial dan mengabaikan detail yang tidak diperlukan agar masalah lebih mudah dipecahkan',
        'Menghilangkan seluruh data penting sehingga dokumen menjadi kosong',
        'Menambah kerumitan langkah kerja agar terlihat lebih profesional',
        'Membuat hasil akhir tidak dapat dipahami oleh orang lain'
      ],
      correct: 0,
      explanation: `Abstraksi memfokuskan perhatian pada aspek-aspek inti masalah dan menyisihkan detail yang tidak relevan.`,
      level: 'C3'
    },
    {
      q: `Saat menyajikan data hasil penerapan materi "${title}" kepada publik atau guru, format yang paling komunikatif adalah...`,
      options: [
        'Bagan visual atau ringkasan terstruktur yang dilengkapi penjelasan pokok yang mudah dipahami',
        'Deretan teks mentah tanpa tanda baca yang panjang berhalaman-halaman',
        'Catatan tulisan tangan acak yang sulit dibaca',
        'Tabel angka tanpa keterangan judul dan satuan'
      ],
      correct: 0,
      explanation: `Visualisasi data dan ringkasan terstruktur mempermudah audiens memahami inti kesimpulan dengan cepat.`,
      level: 'C3'
    },
    {
      q: `Tindakan efisiensi energi yang relevan saat mempraktikkan materi "${title}" menggunakan perangkat digital adalah...`,
      options: [
        'Mengaktifkan mode hemat daya dan mematikan perangkat setelah kegiatan pembelajaran usai',
        'Membiarkan perangkat tersambung charger terus-menerus saat baterai telah penuh',
        'Menyetel volume speaker dan kecerahan monitor pada level 100% tanpa henti',
        'Menjalankan puluhan aplikasi berat di latar belakang secara terus-menerus'
      ],
      correct: 0,
      explanation: `Prinsip keberlanjutan (sustainability) diterapkan dengan menghemat energi perangkat pendukung belajar.`,
      level: 'C3'
    },

    // 21-30: C4 (Analisis Masalah, Perbandingan Solusi, & Troubleshooting HOTS)
    {
      q: `Ketika hasil keluaran dari sistem "${title}" tidak sesuai dengan harapan awal, analisis logis yang harus dilakukan adalah...`,
      options: [
        'Menelusuri kembali setiap tahapan proses untuk menemukan di mana letak penyimpangan data atau kesalahan logika',
        'Menyimpulkan secara sepihak bahwa teori yang dipelajari di sekolah keliru',
        'Mengubah data hasil akhir secara palsu agar terlihat sesuai harapan',
        'Mengabaikan perbedaan hasil tersebut dan menganggapnya tidak penting'
      ],
      correct: 0,
      explanation: `Analisis kritis (debugging) menuntut penelusuran sistematis dari input hingga alur kalkulasi proses.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Perbandingan objektif antara pendekatan manual konvensional dengan pemanfaatan sistem terotomatisasi "${title}" adalah...`,
      options: [
        'Sistem terotomatisasi unggul dalam kecepatan dan konsistensi, namun tetap membutuhkan pengawasan logika manusia',
        'Sistem manual selalu lebih cepat dan tidak pernah memiliki risiko kesalahan',
        'Sistem terotomatisasi dapat menggantikan seluruh proses berpikir kritis manusia',
        'Pendekatan manual sudah tidak memiliki nilai edukasi sama sekali'
      ],
      correct: 0,
      explanation: `Otomasi mempercepat pengolahan data berulang, namun kendali logika dan etika tetap berada di tangan manusia.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Di sebuah laboratorium sekolah, terjadi ketidakcocokan data saat dua kelompok menggabungkan proyek "${title}". Penyebab yang paling mungkin terjadi secara analitis adalah...`,
      options: [
        'Kedua kelompok menggunakan format standar atau satuan data yang berbeda dalam pencatatan mereka',
        'Udara di laboratorium terlalu dingin sehingga data mencair',
        'Guru pembimbing memberikan nilai yang berbeda pada kedua kelompok',
        'Kertas catatan kelompok mengalami perubahan warna tinta'
      ],
      correct: 0,
      explanation: `Inkompatibilitas data umumnya dipicu oleh perbedaan format standar penulisan atau struktur data antarkelompok.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Manakah analisis yang tepat mengenai dampak jangka panjang integrasi konsep "${title}" terhadap efektivitas belajar siswa?`,
      options: [
        'Melatih pola pikir sistematis, computational thinking, dan kemampuan memecahkan masalah kompleks',
        'Membuat siswa menjadi malas membaca referensi dan ketergantungan pasif',
        'Menghilangkan kebutuhan kolaborasi antarmanusia di masa depan',
        'Mengurangi waktu istirahat siswa tanpa memberikan manfaat keilmuan'
      ],
      correct: 0,
      explanation: `Pembelajaran mendalam ${title} mengasah kemampuan dekomposisi masalah dan pemikiran komputasional.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Jika terjadi kegagalan sistem pada pengolahan data "${title}", strategi mitigasi risiko (pencadangan) yang paling efektif adalah...`,
      options: [
        'Menerapkan pencadangan berkala (backup) otomatis pada media penyimpanan yang terpisah dan aman',
        'Menyimpan seluruh data hanya pada satu flashdisk tanpa salinan lain',
        'Menuliskan kembali seluruh baris data di papan tulis kelas',
        'Mengandalkan ingatan manusia tanpa ada catatan digital sama sekali'
      ],
      correct: 0,
      explanation: `Strategi redundansi dan backup berkala memastikan data penting dapat dipulihkan saat terjadi kerusakan perangkat.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Seorang siswa ingin membuktikan kebenaran hipotesis dalam penerapan materi "${title}". Metodologi pengujian yang paling valid adalah...`,
      options: [
        'Melakukan uji coba berulang kali dengan variasi data masukan berbeda dan mencatat hasilnya secara objektif',
        'Hanya melakukan uji coba satu kali dan langsung menarik kesimpulan mutlak',
        'Menyalin data hasil pengujian dari internet tanpa melakukan pengujian langsung',
        'Memilih data yang hanya mendukung keinginannya dan membuang data lainnya'
      ],
      correct: 0,
      explanation: `Validitas pengujian membutuhkan pengulangan eksperimen dengan data uji beragam (stress testing/sampling).`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Analisis penyebab: Mengapa kejelasan struktur alur kerja sangat krusial pada materi "${title}"?`,
      options: [
        'Karena sistem komputasi dan logika ilmiah tidak memiliki toleransi terhadap instruksi yang ambigu dan bermakna ganda',
        'Supaya dokumen petunjuk terlihat sangat panjang dan tebal',
        'Agar orang awam merasa takut untuk mencoba mempelajarinya',
        'Karena instruksi yang singkat tidak diakui oleh kurikulum resmi'
      ],
      correct: 0,
      explanation: `Sistem komputer dan logika sains beroperasi secara deterministik; instruksi ambigu akan memicu error eksekusi.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Dalam mengevaluasi dua solusi alternatif pada studi kasus "${title}", faktor penentu yang paling tepat untuk memilih solusi terbaik adalah...`,
      options: [
        'Keseimbangan antara efisiensi waktu, kemudahan penerapan, akurasi hasil, dan keamanan data',
        'Solusi mana yang paling rumit kata-katanya dalam laporan tertulis',
        'Solusi mana yang diusulkan oleh siswa dengan peringkat kelas tertinggi',
        'Solusi mana yang paling sedikit memerlukan referensi bacaan'
      ],
      correct: 0,
      explanation: `Evaluasi solusi rekayasa (engineering trade-off) menimbang efisiensi, kelayakan praktis, dan keandalan akurasi.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Tantangan terbesar dalam menjaga keberlanjutan pemanfaatan sistem "${title}" di era perkembangan teknologi yang pesat adalah...`,
      options: [
        'Kebutuhan untuk terus memperbarui wawasan, menjaga etika pemanfaatan, dan beradaptasi terhadap inovasi baru',
        'Biaya pengadaan kertas laporan yang semakin mahal dari tahun ke tahun',
        'Semakin sedikitnya jumlah siswa yang tertarik dengan teknologi informasi',
        'Larangan global terhadap penggunaan teknologi digital di lingkungan sekolah'
      ],
      correct: 0,
      explanation: `Tantangan era digital adalah laju keusangan teknologi (obsolescence) yang menuntut adaptabilitas dan literasi etis.`,
      level: 'C4 (HOTS)'
    },
    {
      q: `Refleksi kritis: Bagaimana siswa dapat mengaitkan pembelajaran "${title}" dengan pembentukan karakter Pelajar Pancasila?`,
      options: [
        'Membangun nalar kritis, sikap mandiri dalam memecahkan masalah, serta bergotong-royong memecahkan tantangan nyata',
        'Menyendiri dan tidak memedulikan kebutuhan rekan sebaya di sekitarnya',
        'Menolak mempelajari teknologi luar negeri dan hanya menggunakan peralatan kuno',
        'Mengutamakan kepuasan pribadi di atas kepentingan bersama dalam kerja kelompok'
      ],
      correct: 0,
      explanation: `Pendidikan sains dan teknologi membentuk pelajar bernalar kritis, kreatif, mandiri, dan berkarakter gotong royong.`,
      level: 'C4 (HOTS)'
    }
  ];

  return generalTemplates.map((t, idx) => ({
    id: `qb-${idx + 1}`,
    question: t.q,
    options: t.options,
    correctAnswerIndex: t.correct,
    explanation: t.explanation,
    cognitiveLevel: t.level
  }));
}
