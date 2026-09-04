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
  'demir_yumruk', 'kartal34', 'zeka_kupu', 'matematik_krali', 'kod_ninja',
  'sessiz_fatih', 'isik_hizi', 'bilge_baykus', 'celik_kalem', 'yildiz_avcisi',
  'kaplan07', 'ruzgar_gulu', 'mavi_simsek', 'karinca09', 'atmaca35',
  'gece_kartali', 'pusula06', 'sifir_hata', 'dort_dortluk', 'beyin_firtinasi',
  'hizli_tilki', 'odaklan23', 'caliskan_ari', 'yildiz_tozu', 'kelebek_etkisi',
  'gri_kurt', 'gizli_deha', 'akilli_ordek', 'keskin_zeka', 'ates_bocegi',
  'sabirli_kaplumbaga', 'maratoncu', 'son_viraj', 'hedef12', 'cozum_ustasi',
  'delta_ogrenci', 'omega_zeka', 'bilgi_kupu', 'dolunay42', 'kar_tanesi',
  'gunes_isigi', 'karanfil06', 'zeytin_dali', 'lale_devri', 'polen35',
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
      totalQuestions += 3 + Math.floor(rand() * 22); // günlük ~3-24 soru
    }
    return { displayName: name, totalQuestions };
  });
}
