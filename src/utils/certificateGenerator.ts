/**
 * Utility to generate an official PNG image certificate card for student quiz results.
 * High-definition 1200x1500 layout with luxury gradients, security badges, and crisp typography.
 */

interface CertificateData {
  studentName: string;
  studentClass: string;
  studentAbsen: string;
  materialTitle: string;
  subjectName?: string;
  categoryName?: string;
  score: number;
  totalQuestions: number;
  scorePercent: number;
  completionDate?: string;
}

export function generateResultImageCard(data: CertificateData): Promise<string> {
  return new Promise((resolve) => {
    const width = 1200;
    const height = 1500;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    const isPassed = data.scorePercent >= 75;
    const timestampStr = data.completionDate || new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
    const verifyCode = `SMPL-VAL-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // --- 1. LUXURY DARK GRADIENT BACKGROUND ---
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#090d16');
    bgGradient.addColorStop(0.35, '#1e1b4b');
    bgGradient.addColorStop(0.7, '#111827');
    bgGradient.addColorStop(1, '#030712');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Ambient Glowing Light Orbs
    ctx.save();
    const glow1 = ctx.createRadialGradient(200, 200, 0, 200, 200, 500);
    glow1.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    glow1.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(1000, 1300, 0, 1000, 1300, 600);
    glow2.addColorStop(0, isPassed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)');
    glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);

    const glow3 = ctx.createRadialGradient(1000, 300, 0, 1000, 300, 450);
    glow3.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
    glow3.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow3;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Decorative Geometric Corner Accents
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 100, height);
      ctx.stroke();
    }
    ctx.restore();

    // --- 2. DOUBLE METALLIC BORDER FRAME ---
    ctx.save();
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    ctx.strokeStyle = isPassed ? 'rgba(52, 211, 153, 0.4)' : 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.restore();

    // --- 3. TOP BRANDING HEADER ---
    // Badge Icon Container
    const headerY = 70;
    ctx.save();
    const iconBg = ctx.createLinearGradient(80, headerY, 160, headerY + 80);
    iconBg.addColorStop(0, '#6366f1');
    iconBg.addColorStop(1, '#4338ca');
    ctx.fillStyle = iconBg;
    ctx.beginPath();
    ctx.roundRect(80, headerY, 80, 80, 20);
    ctx.fill();

    // Icon Inner Glow Ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Trophy / Star Emoji inside icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', 120, headerY + 40);
    ctx.restore();

    // Brand Name Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '800 16px sans-serif';
    ctx.fillText('S I M P E L  •  PLATFORM EDUTECH DIGITAL', 185, headerY + 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px sans-serif';
    ctx.fillText('KARTU HASIL EVALUASI BELAJAR', 185, headerY + 68);

    // Top Right Security Badge
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width - 340, headerY + 5, 260, 68, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✔ OTENTIK & TERVERIFIKASI', width - 210, headerY + 32);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(verifyCode, width - 210, headerY + 54);
    ctx.restore();

    // Header Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, headerY + 110);
    ctx.lineTo(width - 80, headerY + 110);
    ctx.stroke();

    // --- 4. MAIN LUXURY WHITE CONTAINER CARD ---
    const cardX = 80;
    const cardY = 210;
    const cardW = width - 160;
    const cardH = 1180;

    // Card White Background with Soft Rounded Corners
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 28);
    ctx.fill();

    // Card Top Accent Stripe
    const accentGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
    if (isPassed) {
      accentGradient.addColorStop(0, '#10b981');
      accentGradient.addColorStop(0.5, '#059669');
      accentGradient.addColorStop(1, '#047857');
    } else {
      accentGradient.addColorStop(0, '#f59e0b');
      accentGradient.addColorStop(0.5, '#d97706');
      accentGradient.addColorStop(1, '#b45309');
    }
    ctx.fillStyle = accentGradient;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 14, [28, 28, 0, 0]);
    ctx.fill();
    ctx.restore();

    // --- 5. SCORE DISPLAY BANNER (HIGH IMPACT) ---
    const scoreBannerY = cardY + 40;
    const scoreBannerH = 220;

    ctx.save();
    const bannerBg = ctx.createLinearGradient(cardX + 30, scoreBannerY, cardX + cardW - 30, scoreBannerY + scoreBannerH);
    if (isPassed) {
      bannerBg.addColorStop(0, '#ecfdf5');
      bannerBg.addColorStop(1, '#d1fae5');
    } else {
      bannerBg.addColorStop(0, '#fffbeb');
      bannerBg.addColorStop(1, '#fef3c7');
    }
    ctx.fillStyle = bannerBg;
    ctx.beginPath();
    ctx.roundRect(cardX + 30, scoreBannerY, cardW - 60, scoreBannerH, 24);
    ctx.fill();

    ctx.strokeStyle = isPassed ? '#a7f3d0' : '#fde68a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Status Pill Tag
    ctx.textAlign = 'left';
    ctx.fillStyle = isPassed ? '#047857' : '#b45309';
    ctx.font = '900 15px sans-serif';
    ctx.fillText(
      isPassed ? '🎉 STATUS: TUNTAS (MEMUASKAN)' : '💪 STATUS: PERLU LATIHAN LEBIH LANJUT',
      cardX + 65,
      scoreBannerY + 50
    );

    // Score Number Big Accent
    ctx.textAlign = 'left';
    ctx.fillStyle = isPassed ? '#065f46' : '#92400e';
    ctx.font = '900 82px sans-serif';
    ctx.fillText(`${data.scorePercent}`, cardX + 65, scoreBannerY + 145);

    ctx.fillStyle = isPassed ? '#047857' : '#b45309';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('/ 100 POIN', cardX + 240, scoreBannerY + 140);

    ctx.fillStyle = '#475569';
    ctx.font = '600 18px sans-serif';
    ctx.fillText(`Berhasil menjawab ${data.score} dari ${data.totalQuestions} pertanyaan dengan benar`, cardX + 65, scoreBannerY + 185);

    // Big Trophy / Medal Emblem inside Score Banner Right side
    ctx.fillStyle = isPassed ? '#10b981' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(cardX + cardW - 130, scoreBannerY + 110, 65, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 55px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPassed ? '🌟' : '🎯', cardX + cardW - 130, scoreBannerY + 110);
    ctx.restore();

    // --- 6. STUDENT IDENTITY SECTION ---
    const studentSecY = scoreBannerY + scoreBannerH + 35;

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(cardX + 30, studentSecY, cardW - 60, 250, 20);
    ctx.fill();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Section Title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('IDENTITAS SISWA & PESERTA EVALUASI', cardX + 65, studentSecY + 45);

    // Student Name
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 32px sans-serif';
    ctx.fillText(data.studentName || 'Nama Siswa', cardX + 65, studentSecY + 95);

    // Class & Absen Cards Grid
    const detailBoxY = studentSecY + 125;

    // Box 1: Kelas
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cardX + 65, detailBoxY, 280, 85, 14);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('KELAS', cardX + 85, detailBoxY + 30);
    ctx.fillStyle = '#1e1b4b';
    ctx.font = '800 22px sans-serif';
    ctx.fillText(data.studentClass || '-', cardX + 85, detailBoxY + 65);

    // Box 2: Nomor Absen
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cardX + 365, detailBoxY, 240, 85, 14);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('NOMOR ABSEN', cardX + 385, detailBoxY + 30);
    ctx.fillStyle = '#1e1b4b';
    ctx.font = '800 22px sans-serif';
    ctx.fillText(`No. ${data.studentAbsen || '-'}`, cardX + 385, detailBoxY + 65);

    // Box 3: Timestamp
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cardX + 625, detailBoxY, cardW - 685, 85, 14);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('WAKTU PENYELESAIAN', cardX + 645, detailBoxY + 30);
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 15px sans-serif';
    ctx.fillText(timestampStr, cardX + 645, detailBoxY + 62);
    ctx.restore();

    // --- 7. SUBJECT & MATERIAL TOPIK SECTION ---
    const matSecY = studentSecY + 285;
    const matSecH = 185;

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(cardX + 30, matSecY, cardW - 60, matSecH, 20);
    ctx.fill();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top Pill Badges: Mata Pelajaran & Topik
    const badgeY = matSecY + 22;
    ctx.font = 'bold 13px sans-serif';

    // Subject Badge (Indigo Pill)
    const subjLabel = (data.subjectName && data.subjectName.trim()) ? data.subjectName.trim() : 'Umum';
    const subjText = `📖 MATA PELAJARAN: ${subjLabel.toUpperCase()}`;
    const subjWidth = ctx.measureText(subjText).width + 24;

    ctx.fillStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.roundRect(cardX + 65, badgeY, subjWidth, 30, 8);
    ctx.fill();
    ctx.strokeStyle = '#c7d2fe';
    ctx.stroke();

    ctx.fillStyle = '#3730a3';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(subjText, cardX + 77, badgeY + 15);

    // Topic Badge (Purple Pill if available)
    if (data.categoryName && data.categoryName.trim()) {
      const topX = cardX + 65 + subjWidth + 12;
      const topText = `📂 TOPIK: ${data.categoryName.trim().toUpperCase()}`;
      const topWidth = ctx.measureText(topText).width + 24;
      if (topX + topWidth < cardX + cardW - 65) {
        ctx.fillStyle = '#f3e8ff';
        ctx.beginPath();
        ctx.roundRect(topX, badgeY, topWidth, 30, 8);
        ctx.fill();
        ctx.strokeStyle = '#e9d5ff';
        ctx.stroke();

        ctx.fillStyle = '#6b21a8';
        ctx.fillText(topText, topX + 12, badgeY + 15);
      }
    }

    // Material Title
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 27px sans-serif';
    let title = data.materialTitle || 'Judul Materi';
    if (title.length > 44) {
      title = title.substring(0, 42) + '...';
    }
    ctx.fillText(title, cardX + 65, matSecY + 95);

    // Subtitle caption
    ctx.fillStyle = '#64748b';
    ctx.font = '600 15px sans-serif';
    ctx.fillText('Modul Ajar Digital Interaktif • Evaluasi Mini Kuis & Uji Pemahaman Mandiri', cardX + 65, matSecY + 138);
    ctx.restore();

    // --- 8. STATS ANALYTICS BAR ---
    const statsY = matSecY + 215;
    const statBoxW = (cardW - 80) / 3;

    const statsData = [
      { label: 'TOTAL SOAL', val: `${data.totalQuestions} Soal`, color: '#3b82f6', bg: '#eff6ff' },
      { label: 'BENAR', val: `${data.score} Soal`, color: '#10b981', bg: '#ecfdf5' },
      { label: 'AKURASI', val: `${data.scorePercent}%`, color: '#8b5cf6', bg: '#f5f3ff' },
    ];

    statsData.forEach((st, idx) => {
      const stX = cardX + 30 + idx * (statBoxW + 10);
      ctx.save();
      ctx.fillStyle = st.bg;
      ctx.beginPath();
      ctx.roundRect(stX, statsY, statBoxW, 110, 16);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = st.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(st.label, stX + statBoxW / 2, statsY + 38);

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 32px sans-serif';
      ctx.fillText(st.val, stX + statBoxW / 2, statsY + 82);
      ctx.restore();
    });

    // --- 9. SECURITY ANTI-TAMPER SEAL & GUARANTEE BOX ---
    const securityY = statsY + 140;

    ctx.save();
    ctx.fillStyle = '#fff1f2';
    ctx.beginPath();
    ctx.roundRect(cardX + 30, securityY, cardW - 60, 120, 18);
    ctx.fill();

    ctx.strokeStyle = '#fecdd3';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#9f1239';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('🔒 JAMINAN KEASLIAN DOKUMEN HASIL BELAJAR', cardX + 65, securityY + 40);

    ctx.fillStyle = '#be123c';
    ctx.font = '500 13px sans-serif';
    ctx.fillText('Kartu hasil ini digenerate secara resmi dan otomatis oleh sistem Platform SIMPEL.', cardX + 65, securityY + 70);
    ctx.fillText('Gambar ini berfungsi sebagai bukti otentik laporan capaian belajar siswa kepada Guru.', cardX + 65, securityY + 92);

    // Decorative Official Stamp Motif on the right
    ctx.fillStyle = 'rgba(225, 29, 72, 0.08)';
    ctx.beginPath();
    ctx.arc(cardX + cardW - 110, securityY + 60, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#e11d48';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL', cardX + cardW - 110, securityY + 55);
    ctx.fillText('CERTIFIED', cardX + cardW - 110, securityY + 72);
    ctx.restore();

    // --- 10. BOTTOM CANVAS FOOTER ---
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px sans-serif';
    ctx.fillText('© Sistem Informasi Materi Pembelajaran (SIMPEL) • Hak Cipta Dilindungi', width / 2, height - 50);
    ctx.restore();

    // Convert canvas to Data URL PNG
    const dataUrl = canvas.toDataURL('image/png');
    resolve(dataUrl);
  });
}

