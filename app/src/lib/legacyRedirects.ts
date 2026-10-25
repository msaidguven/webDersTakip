// app/src/lib/legacyRedirects.ts
// Site otururken (Eylül 2026) değişen ünite/konu adreslerinin kalıcı (308) yönlendirmeleri —
// Search Console 404 raporundan (2026-10-24) çıkarıldı, karşılıkları DB'den doğrulandı.
// next.config.ts redirects() içinde kullanılır; statik kural olduğu için CPU harcamaz.
//
// Adresler normalde değişmez (slug yalnız oluşturulurken verilir). Bir ünite/konu bilerek
// silinip yeniden aktarılır ya da yeniden adlandırılırsa eski adresi buraya ekle.

type Redirect = { source: string; destination: string; permanent: true };

// Her kural hem konu anlatımı hem soru bankası adresine uygulanır.
const PREFIXES = ['', '/soru-bankasi'];

// [sınıf/ders, eski ünite slug'ı, yeni ünite slug'ı] — eski aktarıcının eklediği
// "-{ders}-{sınıf}" soneki 2026-09-21'de silindi (bkz. supabase/migrations/units_slug_cleanup_existing.sql).
const RENAMED_UNITS: [string, string, string][] = [
  ['6-sinif/bilisim-teknolojileri-ve-yazilim', 'bilisim-teknolojilerinin-hayatimizdaki-yeri-7-6', 'bilisim-teknolojilerinin-hayatimizdaki-yeri'],
  ['6-sinif/bilisim-teknolojileri-ve-yazilim', 'dijital-urun-tasarimi-ve-gelistirme-7-6', 'dijital-urun-tasarimi-ve-gelistirme'],
  ['6-sinif/matematik', 'sayilar-ve-nicelikler-1-2-6', 'sayilar-ve-nicelikler-1'],
  ['6-sinif/sosyal-bilgiler', 'birlikte-yasamak-4-6', 'birlikte-yasamak'],
  ['6-sinif/sosyal-bilgiler', 'evimiz-dunya-4-6', 'evimiz-dunya'],
  ['6-sinif/sosyal-bilgiler', 'hayatimizdaki-ekonomi-4-6', 'hayatimizdaki-ekonomi'],
  ['6-sinif/sosyal-bilgiler', 'ortak-mirasimiz-4-6', 'ortak-mirasimiz'],
  ['6-sinif/sosyal-bilgiler', 'teknoloji-ve-sosyal-bilimler-4-6', 'teknoloji-ve-sosyal-bilimler'],
  ['6-sinif/sosyal-bilgiler', 'yasayan-demokrasimiz-4-6', 'yasayan-demokrasimiz'],
];

const MAT5_ISLEMLER = 'esitligin-korunumu-degisme-birlesme-ve-dagilma-ozellikleri-islem-onceligi-oruntuler-temel-aritmetik-islemler-ve-algoritma';
const MAT5_GEOMETRI = 'temel-geometrik-cizimler-ve-insalar-aci-olcme-cokgenler-ve-cember';
const SOS6_TURKISTAN = 'turkistan-da-kurulan-ilk-turk-devletlerinin-medeniyetimize-katkilari-vii-xiii-yuzyillar-arasinda-islam-medeniyetinin-insanligin-ortak-mirasina-katkilari';
const SOS6_ISLAMIYET = 'islamiyet-in-kabuluyle-turklerin-sosyal-ve-kulturel-hayatlarinda-meydana-gelen-degisimler-xi-xiii-yuzyillar-arasinda-meydana-gelen-askeri-mucadelelerin-anadolu-nun-turklesmesi-ve-islamlasmasina-katkilari';

// [sınıf/ders/ünite, eski konu slug'ı, yeni konu slug'ı] — 2026-09-24 yeniden aktarımında
// birleşen ya da yeniden adlandırılan konular (TYMM içerik çerçevesi satırı = konu).
const RENAMED_TOPICS: [string, string, string][] = [
  ['5-sinif/matematik/islemlerle-cebirsel-dusunme', 'esitligin-korunumu', MAT5_ISLEMLER],
  ['5-sinif/matematik/islemlerle-cebirsel-dusunme', 'degisme-birlesme-ve-dagilma-ozellikleri', MAT5_ISLEMLER],
  ['5-sinif/matematik/islemlerle-cebirsel-dusunme', 'islem-onceligi', MAT5_ISLEMLER],
  ['5-sinif/matematik/islemlerle-cebirsel-dusunme', 'temel-aritmetik-islemler-ve-algoritma', MAT5_ISLEMLER],
  ['5-sinif/matematik/geometrik-sekiller', 'temel-geometrik-cizimler-ve-insalar', MAT5_GEOMETRI],
  ['5-sinif/matematik/geometrik-sekiller', 'aci-olcme', MAT5_GEOMETRI],
  ['5-sinif/matematik/geometrik-sekiller', 'cokgenler-ve-cember', MAT5_GEOMETRI],
  ['5-sinif/matematik/sayilar-ve-nicelikler-1', 'cozumleme', 'basamak-degerlerini-cozumleme'],
  ['5-sinif/fen-bilimleri/isigin-dunyasi', 'madde-ve-isik', 'maddenin-isik-gecirgenligi'],
  ['5-sinif/fen-bilimleri/yasamimizdaki-elektrik', 'devre-elemanlarinin-sembollerle-gosterimi-ve-devre-semalari', 'devre-elemanlarinin-sembolleri-ve-devre-semasi'],
  ['6-sinif/matematik/sayilar-ve-nicelikler-1', 'dogal-sayilarin-carpanlari-ve-katlari', 'bir-dogal-sayinin-carpanlari-ve-katlari'],
  ['6-sinif/matematik/sayilar-ve-nicelikler-2', 'kesirlerle-islemler', 'kesirlerle-dort-islem-iceren-problem-cozme'],
  ['6-sinif/matematik/islemlerle-cebirsel-dusunme-ve-degisimler', 'cebirsel-ifadeler', 'cebirsel-ifadeler-ve-algoritma'],
  ['6-sinif/sosyal-bilgiler/ortak-mirasimiz', 'turkistan-da-kurulan-ilk-turk-devletlerinin-medeniyetimize-katkilari', SOS6_TURKISTAN],
  ['6-sinif/sosyal-bilgiler/ortak-mirasimiz', 'vii-xiii-yuzyillar-arasinda-islam-medeniyetinin-insanligin-ortak-mirasina-katkilari', SOS6_TURKISTAN],
  ['6-sinif/sosyal-bilgiler/ortak-mirasimiz', 'islamiyet-in-kabuluyle-turklerin-sosyal-ve-kulturel-hayatlarinda-meydana-gelen-degisimler', SOS6_ISLAMIYET],
  ['6-sinif/sosyal-bilgiler/ortak-mirasimiz', 'xi-xiii-yuzyillar-arasinda-meydana-gelen-askeri-mucadelelerin-anadolu-nun-turklesmesi-ve-islamlasmasina-katkilari', SOS6_ISLAMIYET],
];

export const legacySlugRedirects: Redirect[] = [
  // Ünite: altındaki tüm konu adresleri de (":path*") yeni ünite adresine taşınır.
  ...RENAMED_UNITS.flatMap(([base, from, to]) =>
    PREFIXES.map((p) => ({ source: `${p}/${base}/${from}/:path*`, destination: `${p}/${base}/${to}/:path*`, permanent: true as const }))
  ),
  ...RENAMED_TOPICS.flatMap(([base, from, to]) =>
    PREFIXES.map((p) => ({ source: `${p}/${base}/${from}`, destination: `${p}/${base}/${to}`, permanent: true as const }))
  ),
];
