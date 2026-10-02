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

// 2026-09-26 kalibrasyonu: eskiden 45 kayıt × günde 9-33 soru (haftada ~125+) vardı —
// gerçek veride haftanın en aktif öğrencisi ~116 soruda kalırken listenin DİBİNE düşüyordu
// (116 soru ile 33. sıra), yani teşvik yerine caydırıyordu. Artık 12 kayıt, her gün 5-25 soru
// (kullanıcı kararı, 2026-09-26).
// 2026-10-02: gerçek öğrenciler artık tam adla göründüğü için sahte kayıtlar da tam ad; liste
// 12 → 20 (kullanıcı isteği, soyadları kullanıcının verdiği listeden).
const SEED_NAMES: Record<string, string> = {
  ahmet_demir23: 'Ahmet Demir', zeynep_kara56: 'Zeynep Kaya', elif_su19: 'Elif Yıldız', yusuf_aydin: 'Yusuf Aslan',
  ayse_nur34: 'Ayşe Yılmaz', emre_kaya07: 'Emre Doğan', irem_dogan: 'İrem Pamuk', kerem_ozturk15: 'Kerem Toprak',
  defne_avci: 'Defne Ay', kaan_sahin: 'Kaan Güneş', cinar_gunes14: 'Çınar Deniz', yagmur_ceylan: 'Yağmur Bayram',
  mert_ok: 'Mert Ok', ecrin_demir: 'Ecrin Demir', ali_yilmaz: 'Ali Yılmaz', nehir_kaya: 'Nehir Kaya',
  berk_aslan: 'Berk Aslan', asel_gunes: 'Asel Güneş', omer_dogan: 'Ömer Doğan', duru_toprak: 'Duru Toprak',
};

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

// Seed anahtarı (ör. "ahmet_demir23") sayıların eski haftalarla aynı hash'ten türemesi için
// korunuyor; dışarıya sadece görünen isim çıkar.
export function getSeedLeaderboardEntries(weekStart: string): { displayName: string; totalQuestions: number }[] {
  const elapsedDays = daysElapsedInWeek(weekStart);
  return Object.entries(SEED_NAMES).map(([key, displayName]) => {
    const rand = mulberry32(hashString(`${weekStart}:${key}`));
    let totalQuestions = 0;
    for (let day = 0; day <= elapsedDays; day++) {
      totalQuestions += 5 + Math.floor(rand() * 21); // günde 5-25 soru
    }
    return { displayName, totalQuestions };
  });
}
