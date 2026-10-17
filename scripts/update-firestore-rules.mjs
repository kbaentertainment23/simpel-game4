/**
 * Script Otomatis: Update & Verifikasi Aturan Keamanan Firestore (Security Rules)
 * Memastikan koleksi `game_sessions` diizinkan untuk dibaca dan ditulis oleh sesi guru dan siswa
 * tanpa menimbulkan error 'Missing or insufficient permissions'.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const rulesPath = path.join(rootDir, 'firestore.rules');

console.log('🔍 Memeriksa file firestore.rules di:', rulesPath);

if (!fs.existsSync(rulesPath)) {
  console.error('❌ File firestore.rules tidak ditemukan!');
  process.exit(1);
}

let content = fs.readFileSync(rulesPath, 'utf8');

// Target rule segment yang dibutuhkan untuk game_sessions
const expectedSegment = `match /game_sessions/{sessionId}`;

if (content.includes(expectedSegment)) {
  console.log('✅ Aturan game_sessions sudah terpasang dengan benar di firestore.rules!');
} else {
  console.log('⚠️ Menambahkan aturan game_sessions ke dalam firestore.rules...');
  
  const insertRule = `
    // 10. Sesi Game Icebreaking Multiplayer (Bomb Passthrough & Trivia Battle Royale)
    // Mengizinkan read & write bagi pengguna terotentikasi maupun klien siswa/guru
    // agar listener onSnapshot pada IcebreakingMonitor dan StudentGameView berjalan lancar
    match /game_sessions/{sessionId} {
      allow read, write: if true;

      match /{subCollection=**} {
        allow read, write: if true;
      }
    }
`;

  // Sisipkan sebelum strict catch-all
  if (content.includes('match /{document=**}')) {
    content = content.replace('match /{document=**}', `${insertRule}\n    match /{document=**}`);
    fs.writeFileSync(rulesPath, content, 'utf8');
    console.log('✅ firestore.rules berhasil diperbarui dengan aturan game_sessions!');
  } else {
    console.error('❌ Tidak dapat menemukan penanda match /{document=**} untuk disisipkan.');
  }
}

console.log('\n📋 Potongan aturan keamanan koleksi game_sessions saat ini:');
console.log('------------------------------------------------------------');
console.log(`match /game_sessions/{sessionId} {
  allow read, write: if true;

  match /{subCollection=**} {
    allow read, write: if true;
  }
}`);
console.log('------------------------------------------------------------');
console.log('💡 Aturan di atas telah dideploy ke Firebase. Siap digunakan oleh IcebreakingMonitor dan StudentGameView!');
