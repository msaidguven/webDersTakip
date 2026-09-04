// GEÇİCİ DOLGU VERİSİ — kullanıcı talebi (2026-09-04): henüz yeterli gerçek
// öğrenci olmadığı için "Haftalık Sıralama" boş görünüyordu. Yeterli sayıda
// gerçek öğrenciye ulaşınca bu dosya silinsin ve leaderboard.ts'teki
// "GEÇİCİ SEED" bloğu kaldırılsın (bkz. leaderboard.ts).
//
// Buradaki isimler belirli/gerçek bir kişiye karşılık gelmiyor, rastgele
// üretilmiş rumuzlar. Sayılar haftanın başından (Pazartesi) o günkü tarihe
// kadar, isim+hafta+gün'e göre SABİT (deterministik) üretiliyor — yani
// sayfa her yenilendiğinde zıplamıyor, ama hafta ilerledikçe doğal biçimde
// artıyor ve her yeni haftada sıfırdan yeniden hesaplanıyor.

const SEED_NAMES = [
  // Rumuz tarzı
  'demir_yumruk', 'kartal34', 'zeka_kupu', 'kod_ninja', 'sessiz_fatih',
  'gece_kartali', 'hizli_tilki', 'keskin_zeka', 'maratoncu', 'cozum_ustasi',
  'gizli_deha', 'ates_bocegi', 'yildiz_avcisi', 'akilli_ordek', 'son_viraj',
  // Gerçek isme benzer tarz
  'ahmet_demir23', 'mehmet_yildiz', 'zeynep_kara56', 'elif_su19', 'yusuf_aydin',
  'ayse_nur34', 'emre_kaya07', 'buse_celik', 'kerem_ozturk15', 'irem_dogan',
  'berkay_arslan22', 'sude_kaplan', 'mert_ozdemir08', 'defne_avci', 'alp_koc03',
  'ecrin_bal17', 'kaan_sahin', 'nisa_bulut29', 'umut_polat11', 'melis_er',
  'cinar_gunes14', 'yagmur_ceylan', 'taha_kurt08', 'elis_ay25', 'batuhan_deniz',
  'rana_gun33', 'ege_yavuz17', 'sena_kilic', 'arda_tas06', 'beren_ipek',
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

// mulberry32 — küçük, hızlı, deterministik PRNG (aynı seed → aynı dizi).
function mulberry32(seed: number) {
  let s = seed;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysElapsedInWeek(weekStart: string): number {
  const start = new Date(`${weekStart}T00:00:00`);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(6, Math.max(0, diff)); // 0 = Pazartesi ... 6 = Pazar
}

export function getSeedLeaderboardEntries(weekStart: string): { displayName: string; totalQuestions: number }[] {
  const elapsedDays = daysElapsedInWeek(weekStart);
  return SEED_NAMES.map((name) => {
    const rand = mulberry32(hashString(`${weekStart}:${name}`));
    let totalQuestions = 0;
    for (let day = 0; day <= elapsedDays; day++) {
      totalQuestions += 9 + Math.floor(rand() * 25); // günlük ~9-33 soru
    }
    return { displayName: name, totalQuestions };
  });
}
