import type { Badge } from '@/app/src/lib/badges';

export interface ShareCardData {
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  gradeName: string | null;
  currentStreak: number;
  weeklyQuestions: number;
  totalQuestions: number;
  weekActiveDays: boolean[];
  favoriteLesson: string | null;
  earnedBadges: Badge[];
  theme?: 'light' | 'dark';
}

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.closePath();
}

function loadAvatarImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    const timer = window.setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

export async function renderProfileCardBlob(data: ShareCardData): Promise<Blob> {
  const isDark =
    data.theme != null
      ? data.theme === 'dark'
      : typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // robotic.module.css ile birebir uyumlu açık (varsayılan) ve yumuşatılmış koyu lacivert-gri tema renkleri
  const p = isDark
    ? {
        bg0: '#1B2230',
        bg1: '#212A3B',
        bg2: '#18202E',
        glowA: 'rgba(56, 189, 248, 0.18)',
        glowB: 'rgba(129, 140, 248, 0.18)',
        grid: 'rgba(186, 214, 255, 0.055)',
        panel0: '#273144',
        panel1: '#20293A',
        panelBorder: '#3B4A64',
        neon: '#38BDF8',
        topPillBg: 'rgba(56, 189, 248, 0.13)',
        topPillBorder: 'rgba(56, 189, 248, 0.42)',
        ink: '#F1F5FB',
        subInk: '#A3B1C6',
        boxBg: '#252F42',
        boxBorder: '#384760',
        streakAccent: '#FB923C',
        weekAccent: '#38BDF8',
        totalAccent: '#818CF8',
        dayOffBg: '#2C374C',
        dayOffBorder: '#3E4D67',
        dayOffText: '#94A3B8',
        badgePillBg: 'rgba(56, 189, 248, 0.14)',
        badgePillBorder: 'rgba(56, 189, 248, 0.42)',
      }
    : {
        bg0: '#EEF2F7',
        bg1: '#F5F8FC',
        bg2: '#E5ECF5',
        glowA: 'rgba(8, 145, 178, 0.14)',
        glowB: 'rgba(59, 91, 253, 0.14)',
        grid: 'rgba(15, 23, 42, 0.05)',
        panel0: '#FFFFFF',
        panel1: '#F3F6FA',
        panelBorder: '#C9D3E0',
        neon: '#0891B2',
        topPillBg: 'rgba(8, 145, 178, 0.10)',
        topPillBorder: 'rgba(8, 145, 178, 0.38)',
        ink: '#0B1324',
        subInk: '#64748B',
        boxBg: '#F8FAFC',
        boxBorder: '#D5DFEC',
        streakAccent: '#EA580C',
        weekAccent: '#0891B2',
        totalAccent: '#3B5BFD',
        dayOffBg: '#EEF2F7',
        dayOffBorder: '#CBD5E1',
        dayOffText: '#64748B',
        badgePillBg: 'rgba(8, 145, 178, 0.09)',
        badgePillBorder: 'rgba(8, 145, 178, 0.38)',
      };

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Görsel oluşturulamadı');

  // 1. Arka plan + yumuşak ışıma
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, p.bg0);
  bg.addColorStop(0.55, p.bg1);
  bg.addColorStop(1, p.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glowTop = ctx.createRadialGradient(W * 0.8, 120, 20, W * 0.8, 120, 560);
  glowTop.addColorStop(0, p.glowA);
  glowTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);

  const glowBottom = ctx.createRadialGradient(W * 0.2, H - 140, 20, W * 0.2, H - 140, 560);
  glowBottom.addColorStop(0, p.glowB);
  glowBottom.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, W, H);

  // İnce HUD ızgarası
  ctx.strokeStyle = p.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Ana kart çerçevesi
  const pad = 56;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  const panelGrad = ctx.createLinearGradient(pad, pad, pad, pad + cardH);
  panelGrad.addColorStop(0, p.panel0);
  panelGrad.addColorStop(1, p.panel1);
  roundRect(ctx, pad, pad, cardW, cardH, 42);
  ctx.fillStyle = panelGrad;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = p.panelBorder;
  ctx.stroke();

  // Köşe HUD braketleri
  ctx.strokeStyle = p.neon;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 56);
  ctx.lineTo(pad, pad + 18);
  ctx.arcTo(pad, pad, pad + 18, pad, 18);
  ctx.lineTo(pad + 56, pad);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(W - pad - 56, H - pad);
  ctx.lineTo(W - pad - 18, H - pad);
  ctx.arcTo(W - pad, H - pad, W - pad, H - pad - 18, 18);
  ctx.lineTo(W - pad, H - pad - 56);
  ctx.stroke();

  // Üst rozet: DERSTAKİP.NET · BAŞARI KARTI
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  roundRect(ctx, W / 2 - 220, 108, 440, 48, 24);
  ctx.fillStyle = p.topPillBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = p.topPillBorder;
  ctx.stroke();

  ctx.fillStyle = p.neon;
  ctx.font = '700 21px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('●  DERSTAKİP.NET · BAŞARI KARTI', W / 2, 133);

  // Avatar dairesi
  const avatarCx = W / 2;
  const avatarCy = 292;
  const avatarR = 96;

  const ringGrad = ctx.createLinearGradient(avatarCx - avatarR, avatarCy - avatarR, avatarCx + avatarR, avatarCy + avatarR);
  ringGrad.addColorStop(0, '#3B5BFD');
  ringGrad.addColorStop(1, '#06B6D4');

  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 7, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  const img = data.avatarUrl ? await loadAvatarImage(data.avatarUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (img) {
    const scale = Math.max((avatarR * 2) / img.width, (avatarR * 2) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, avatarCx - dw / 2, avatarCy - dh / 2, dw, dh);
  } else {
    const initBg = ctx.createLinearGradient(avatarCx - avatarR, avatarCy - avatarR, avatarCx + avatarR, avatarCy + avatarR);
    initBg.addColorStop(0, '#0891B2');
    initBg.addColorStop(1, '#3B5BFD');
    ctx.fillStyle = initBg;
    ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 74px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(data.initials, avatarCx, avatarCy + 4);
  }
  ctx.restore();

  // İsim
  ctx.fillStyle = p.ink;
  ctx.font = '800 54px system-ui, -apple-system, Segoe UI, sans-serif';
  const safeName = truncateText(ctx, data.displayName, cardW - 110);
  ctx.fillText(safeName, W / 2, 448);

  // Sınıf + Favori ders etiketleri
  const pills: string[] = [];
  if (data.gradeName) pills.push(data.gradeName.toLocaleUpperCase('tr-TR'));
  if (data.favoriteLesson) pills.push(`⚡ ${data.favoriteLesson.toLocaleUpperCase('tr-TR')}`);
  const subLine = pills.join('   ·   ');
  if (subLine) {
    ctx.fillStyle = p.subInk;
    ctx.font = '700 24px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(truncateText(ctx, subLine, cardW - 120), W / 2, 504);
  }

  // 3 Ana İstatistik Kutusu
  const statsY = 556;
  const statGap = 22;
  const statX0 = pad + 48;
  const totalStatsW = cardW - 96;
  const statW = (totalStatsW - statGap * 2) / 3;
  const statH = 186;
  const statItems = [
    { label: 'GÜNLÜK SERİ', value: `${data.currentStreak}`, sub: 'gün üst üste', accent: p.streakAccent },
    { label: 'BU HAFTA', value: `${data.weeklyQuestions}`, sub: 'çözülen soru', accent: p.weekAccent },
    { label: 'TOPLAM', value: `${data.totalQuestions}`, sub: 'çözülen soru', accent: p.totalAccent },
  ];

  statItems.forEach((st, idx) => {
    const sx = statX0 + idx * (statW + statGap);
    roundRect(ctx, sx, statsY, statW, statH, 26);
    ctx.fillStyle = p.boxBg;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = p.boxBorder;
    ctx.stroke();

    ctx.fillStyle = st.accent;
    ctx.font = '700 19px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(st.label, sx + statW / 2, statsY + 42);

    ctx.fillStyle = p.ink;
    ctx.font = '800 56px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(st.value, sx + statW / 2, statsY + 106);

    ctx.fillStyle = p.subInk;
    ctx.font = '600 21px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(st.sub, sx + statW / 2, statsY + 152);
  });

  // Bu Hafta Aktivite Işıkları (Pzt..Paz)
  const weekBoxY = 776;
  const weekBoxH = 158;
  roundRect(ctx, statX0, weekBoxY, totalStatsW, weekBoxH, 26);
  ctx.fillStyle = p.boxBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = p.boxBorder;
  ctx.stroke();

  const activeCount = data.weekActiveDays.filter(Boolean).length;
  ctx.textAlign = 'left';
  ctx.fillStyle = p.neon;
  ctx.font = '700 20px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('BU HAFTAKİ ÇALIŞMA DÜZENİ', statX0 + 32, weekBoxY + 38);

  ctx.textAlign = 'right';
  ctx.fillStyle = p.ink;
  ctx.font = '700 20px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText(`${activeCount} / 7 gün aktif`, statX0 + totalStatsW - 32, weekBoxY + 38);

  ctx.textAlign = 'center';
  const dotSpacing = (totalStatsW - 96) / 7;
  DAY_LABELS.forEach((lbl, i) => {
    const cx = statX0 + 48 + dotSpacing * i + dotSpacing / 2;
    const cy = weekBoxY + 94;
    const on = Boolean(data.weekActiveDays[i]);

    roundRect(ctx, cx - 42, cy - 26, 84, 52, 16);
    if (on) {
      const pillG = ctx.createLinearGradient(cx - 42, cy - 26, cx + 42, cy + 26);
      pillG.addColorStop(0, '#06B6D4');
      pillG.addColorStop(1, '#3B5BFD');
      ctx.fillStyle = pillG;
      ctx.fill();
    } else {
      ctx.fillStyle = p.dayOffBg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = p.dayOffBorder;
      ctx.stroke();
    }

    ctx.fillStyle = on ? '#FFFFFF' : p.dayOffText;
    ctx.font = '700 21px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(lbl, cx, cy + 1);
  });

  // Kazanılan Rozetler Vitrini
  const badgeBoxY = 966;
  const badgeBoxH = 166;
  roundRect(ctx, statX0, badgeBoxY, totalStatsW, badgeBoxH, 26);
  ctx.fillStyle = p.boxBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = p.boxBorder;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = p.neon;
  ctx.font = '700 20px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('KAZANILAN ROZETLER', statX0 + 32, badgeBoxY + 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = p.ink;
  ctx.font = '700 20px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText(`${data.earnedBadges.length} rozet`, statX0 + totalStatsW - 32, badgeBoxY + 40);

  ctx.textAlign = 'center';
  const topBadges = data.earnedBadges.slice(-4).reverse();
  if (topBadges.length === 0) {
    ctx.fillStyle = p.subInk;
    ctx.font = '600 24px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('İlk rozet için yolculuk başladı! 🚀', W / 2, badgeBoxY + 106);
  } else {
    const bGap = 16;
    const bW = (totalStatsW - 64 - bGap * (topBadges.length - 1)) / topBadges.length;
    topBadges.forEach((b, idx) => {
      const bx = statX0 + 32 + idx * (bW + bGap);
      const by = badgeBoxY + 68;
      roundRect(ctx, bx, by, bW, 70, 18);
      ctx.fillStyle = p.badgePillBg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = p.badgePillBorder;
      ctx.stroke();

      ctx.fillStyle = p.ink;
      ctx.font = '700 22px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(truncateText(ctx, `🏅 ${b.title}`, bW - 24), bx + bW / 2, by + 36);
    });
  }

  // Alt Çağrı Şeridi
  const ctaY = 1170;
  const ctaGrad = ctx.createLinearGradient(statX0, ctaY, statX0 + totalStatsW, ctaY + 86);
  ctaGrad.addColorStop(0, '#3B5BFD');
  ctaGrad.addColorStop(1, '#06B6D4');
  roundRect(ctx, statX0, ctaY, totalStatsW, 84, 24);
  ctx.fillStyle = ctaGrad;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 26px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('Sen de yarışa katıl, beni geçebilir misin?  ·  derstakip.net', W / 2, ctaY + 43);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG üretilemedi'))), 'image/png');
  });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
