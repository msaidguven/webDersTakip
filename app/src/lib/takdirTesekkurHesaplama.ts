// Takdir/Teşekkür belgesi hesaplama kuralları — resmi yönetmelik metinlerinden alınmıştır:
//
// Ortaokul (5-8. sınıf) — Millî Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları
// Yönetmeliği, MADDE 53/1 (RG-14/10/2023-32339 ile güncel hâli): "Ortaokul ... bütün sınıflarında
// puan ortalaması Türkçe dersinden 70,00, diğer derslerin her birinden 50,00 puandan aşağı
// olmamak şartı ile tüm derslerin dönem ağırlıklı puan ortalaması 70,00-84,99 olanlar 'Teşekkür',
// 85,00 puan ve yukarı olanlar 'Takdir' belgesi ile ödüllendirilir."
//
// Lise (9-12. sınıf) — Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği, MADDE 160/1:
// "...tüm derslerden başarılı olan, dönem puanlarının ağırlıklı ortalaması 70,00'ten aşağı
// olmayan ve davranış puanı 100 olan öğrencilerden; 70,00-84,99 arasındakileri teşekkür belgesi,
// 85,00 ve daha yukarı olanları takdir belgesi... ile ödüllendirir." Ders başına alt puan sınırı
// 2023 değişikliğiyle kaldırıldı (artık yalnızca sınıfı geçmiş olmak + davranış puanı 100 şartı var).
//
// Ağırlık/ortalama formülü — Ortaöğretim Kurumları Yönetmeliği MADDE 54-55: bir dersin ağırlığı o
// dersin haftalık ders saatidir; ağırlıklı puan = ders puanı × haftalık saat; yılsonu/dönem başarı
// puanı = ağırlıklı puanlar toplamı ÷ haftalık ders saatleri toplamı (virgülden sonra 4 hane).
//
// Lise yazılı sınav sayısı — Millî Eğitim Bakanlığı Ölçme ve Değerlendirme Yönetmeliği (RG-9/9/
// 2023-32304) ile Ortaöğretim Kurumları Yönetmeliği MADDE 45/1-a: "Bir dönemde her dersten iki
// yazılı sınav yapılır. Ancak haftalık ders saat sayısı altı ve üzeri olan derslerde ... zümrelerce
// karar alınması durumunda üçüncü sınav yapılabilir." Lisede ayrı/sabit sayılı bir "ders
// etkinliklerine katılım" zorunluluğu yok (performans çalışması dersin özelliğine göre, zümre
// takdirine bağlı) — bu yüzden lisede dönem notu burada yalnızca girilen yazılıların ortalamasıdır.
//
// Ortaokul dönem notu — Millî Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları
// Yönetmeliği (mevzuat.gov.tr'den konsolide metin, RG-28/7/2026-33323'e kadar işlenmiş):
// MADDE 22/3: "Öğrencilere her dönemde her bir dersin haftalık ders saati sayısı 2 ve daha az
// olanlara 2, haftalık ders saati sayısı 2'den fazla olanlara ise 3 defa ders etkinliklerine
// katılım puanı verilir." (Bu, halk arasında "sözlü notu" denilen puandır — yönetmelikteki adı
// budur.) MADDE 27/2-a: "Proje puanlarının aritmetik ortalaması ile ders etkinliklerine katılım
// puanlarının aritmetik ortalaması ayrı ayrı alınarak toplanıp ikiye bölünür. Bulunan sonuçla
// birinci ve ikinci sınav puanları toplanıp üçe bölünerek elde edilir." Yani: dönem notu =
// (yazılı1 + yazılı2 + ara) / 3, ara = proje girildiyse (proje + katılım_ortalaması)/2, projesiz
// derste ara = katılım_ortalaması. Ortaokulda sınav HER ZAMAN 2'dir (madde 27/2-a yalnızca
// "birinci ve ikinci sınav puanları" der, 3. yazılı yok — bu, lise 6+ saat kuralından farklıdır).
// Proje, öğrencinin ders yılında seçtiği bir/birkaç derste olur (madde 22/2) — çoğu derste proje
// olmaz; burada opsiyonel tek bir alan olarak modellendi.

export type OkulKademesi = 'ortaokul' | 'lise';

// Ortaokulda bir dersten dönemde kaç "ders etkinliklerine katılım" (sözlü) puanı verileceği —
// MADDE 22/3: haftalık saat 2 veya altıysa 2, üzerindeyse 3.
export function katilimSayisi(haftalikSaat: number): 2 | 3 {
  return haftalikSaat > 2 ? 3 : 2;
}

export interface DersSatiri {
  id: string;
  dersAdi: string;
  haftalikSaat: number;
  // Lisede kullanılır: 1., 2. (ve 6+ saatlik derste opsiyonel 3.) yazılı sınav puanı.
  // Ortaokulda da 1./2. yazılı kullanılır (ortaokulda hep tam 2 yazılı vardır, 3. yok).
  yazili1: number | null;
  yazili2: number | null;
  yazili3: number | null;
  // Yalnızca lisede: performans çalışması puanları (sayısı zümre kararına bağlı).
  performans1: number | null;
  performans2: number | null;
  performans3: number | null;
  // Yalnızca ortaokulda: ders etkinliklerine katılım ("sözlü") puanları — katilim3,
  // yalnızca katilimSayisi(haftalikSaat) === 3 olduğunda anlamlıdır.
  katilim1: number | null;
  katilim2: number | null;
  katilim3: number | null;
  // Opsiyonel: dersin proje puanı (her iki kademede de girilebilir).
  proje: number | null;
}

function ortalamaAl(puanlar: number[]): number | null {
  if (puanlar.length === 0) return null;
  return puanlar.reduce((toplam, p) => toplam + p, 0) / puanlar.length;
}

function girilenler(puanlar: (number | null)[]): number[] {
  return puanlar.filter((p): p is number => p !== null && !Number.isNaN(p));
}

// Girilen notlardan dönem notunu türetir (kademeye göre farklı formül); hiçbir not girilmemişse
// null (henüz hesaba katılmaz).
// Ortalamalar virgülden sonra 4 hane (MADDE 27/2-b, 51/1-e); yuvarlama yok.
function ortalama4(sayi: number): number {
  return Math.trunc(sayi * 10000 + 1e-9) / 10000;
}

// Lise (MADDE 51/1): sınav, performans çalışması ve varsa proje puanlarının aritmetik ortalaması.
// Ortaokul (MADDE 27/2-a): (1. sınav + 2. sınav + ara) / 3; ara = katılım ortalaması, proje
// girildiyse (proje + katılım ortalaması) / 2. Dönem puanı yarım ve üstü yukarı yuvarlanarak tam
// sayıya çevrilir (MADDE 27/2-b).
export function donemNotu(ders: DersSatiri, kademe: OkulKademesi): number | null {
  if (kademe === 'lise') {
    const ort = ortalamaAl(
      girilenler([ders.yazili1, ders.yazili2, ders.yazili3, ders.performans1, ders.performans2, ders.performans3, ders.proje]),
    );
    return ort === null ? null : ortalama4(ort);
  }

  const gerekliKatilim = katilimSayisi(ders.haftalikSaat);
  const katilimOrt = ortalamaAl(girilenler([ders.katilim1, ders.katilim2, gerekliKatilim === 3 ? ders.katilim3 : null]));
  const katilimOrt4 = katilimOrt === null ? null : ortalama4(katilimOrt);

  let ara: number | null;
  if (ders.proje !== null && katilimOrt4 !== null) ara = ortalama4((ders.proje + katilimOrt4) / 2);
  else if (ders.proje !== null) ara = ders.proje;
  else ara = katilimOrt4;

  const ort = ortalamaAl([...girilenler([ders.yazili1, ders.yazili2]), ...(ara !== null ? [ara] : [])]);
  if (ort === null) return null;
  return Math.floor(ortalama4(ort) + 0.5);
}

export type BelgeSonucu = 'takdir' | 'tesekkur' | 'yok';

export interface HesaplamaGirdisi {
  sinifSeviyesi: number; // 5-12
  dersler: DersSatiri[];
  // Lise için: madde 160 şartları. Ortaokulda bu ikisi değerlendirmeye girmez.
  davranisPuaniTam: boolean;
  tumDerslerdenBasarili: boolean;
}

export interface HesaplamaSonucu {
  kademe: OkulKademesi;
  agirlikliOrtalama: number;
  belge: BelgeSonucu;
  // Ortaokulda barajın altında kalan ders adları (varsa belge verilmez).
  barajAltindaKalanlar: string[];
  mesaj: string;
}

export function kademeBelirle(sinifSeviyesi: number): OkulKademesi {
  return sinifSeviyesi <= 8 ? 'ortaokul' : 'lise';
}

// Yalnızca en az bir notu girilmiş dersler ağırlıklı ortalamaya katılır.
export function agirlikliOrtalamaHesapla(dersler: DersSatiri[], kademe: OkulKademesi): number {
  const gecerliDersler = dersler.filter((ders) => donemNotu(ders, kademe) !== null);
  const toplamSaat = gecerliDersler.reduce((toplam, ders) => toplam + ders.haftalikSaat, 0);
  if (toplamSaat <= 0) return 0;
  const toplamAgirlikliPuan = gecerliDersler.reduce((toplam, ders) => toplam + (donemNotu(ders, kademe) as number) * ders.haftalikSaat, 0);
  // Yönetmelikteki gibi virgülden sonra 4 hane, yuvarlamadan kes.
  return Math.trunc((toplamAgirlikliPuan / toplamSaat) * 10000) / 10000;
}

const ORTAOKUL_TURKCE_BARAJI = 70;
const ORTAOKUL_DIGER_BARAJ = 50;

function ortaokulBarajAltindaKalanlar(dersler: DersSatiri[]): string[] {
  return dersler
    .filter((ders) => {
      const notu = donemNotu(ders, 'ortaokul');
      if (notu === null) return false;
      const baraj = /türkçe/i.test(ders.dersAdi.trim()) ? ORTAOKUL_TURKCE_BARAJI : ORTAOKUL_DIGER_BARAJ;
      return notu < baraj;
    })
    .map((ders) => ders.dersAdi);
}

export function belgeHesapla(girdi: HesaplamaGirdisi): HesaplamaSonucu {
  const kademe = kademeBelirle(girdi.sinifSeviyesi);
  const agirlikliOrtalama = agirlikliOrtalamaHesapla(girdi.dersler, kademe);
  const enAzBirNotGirildiMi = girdi.dersler.some((ders) => donemNotu(ders, kademe) !== null);

  if (!enAzBirNotGirildiMi) {
    return {
      kademe,
      agirlikliOrtalama: 0,
      belge: 'yok',
      barajAltindaKalanlar: [],
      mesaj: kademe === 'ortaokul' ? 'Hesaplamak için en az bir dersin yazılı veya katılım notunu gir.' : 'Hesaplamak için en az bir dersin yazılı notunu gir.',
    };
  }

  if (kademe === 'ortaokul') {
    const barajAltindaKalanlar = ortaokulBarajAltindaKalanlar(girdi.dersler);
    if (barajAltindaKalanlar.length > 0) {
      return {
        kademe,
        agirlikliOrtalama,
        belge: 'yok',
        barajAltindaKalanlar,
        mesaj: `Türkçe'den en az 70, diğer derslerin her birinden en az 50 puan almak şartı sağlanmıyor: ${barajAltindaKalanlar.join(', ')}.`,
      };
    }
    return belgeDereceVer(kademe, agirlikliOrtalama, []);
  }

  // Lise: davranış puanı 100 ve tüm derslerden başarılı olma şartı (ders başına alt sınır yok).
  if (!girdi.davranisPuaniTam || !girdi.tumDerslerdenBasarili) {
    const eksikler = [
      !girdi.davranisPuaniTam ? 'davranış puanı 100 değil' : null,
      !girdi.tumDerslerdenBasarili ? 'başarısız olunan ders var' : null,
    ].filter(Boolean);
    return {
      kademe,
      agirlikliOrtalama,
      belge: 'yok',
      barajAltindaKalanlar: [],
      mesaj: `Takdir/teşekkür şartı sağlanmıyor: ${eksikler.join(', ')}.`,
    };
  }
  return belgeDereceVer(kademe, agirlikliOrtalama, []);
}

function belgeDereceVer(kademe: OkulKademesi, agirlikliOrtalama: number, barajAltindaKalanlar: string[]): HesaplamaSonucu {
  if (agirlikliOrtalama >= 85) {
    return { kademe, agirlikliOrtalama, belge: 'takdir', barajAltindaKalanlar, mesaj: 'Takdir belgesi şartını karşılıyor (85,00 ve üzeri).' };
  }
  if (agirlikliOrtalama >= 70) {
    return { kademe, agirlikliOrtalama, belge: 'tesekkur', barajAltindaKalanlar, mesaj: 'Teşekkür belgesi şartını karşılıyor (70,00-84,99 arası).' };
  }
  return { kademe, agirlikliOrtalama, belge: 'yok', barajAltindaKalanlar, mesaj: 'Ağırlıklı ortalama 70,00’ın altında, belge şartı sağlanmıyor.' };
}

export const SINIF_SEVIYELERI = [5, 6, 7, 8, 9, 10, 11, 12] as const;

// Varsayılan ders + haftalık saat çizelgeleri.
//
// Ortaokul (5-8): T.C. Millî Eğitim Bakanlığı Talim ve Terbiye Kurulu Başkanlığı'nın
// 09/05/2025 tarih ve 04 sayılı kararıyla güncellenen "İlköğretim Kurumları (İlkokul ve
// Ortaokul) Haftalık Ders Çizelgesi" — 2025-2026 eğitim öğretim yılından itibaren geçerli,
// resmi PDF'ten satır satır doğrulandı (ttkb.meb.gov.tr). Rehberlik ve Yönlendirme (1 saat)
// kasıtlı olarak LİSTEYE ALINMADI: not/sınavla değerlendirilmediği için ağırlıklı ortalamaya
// girmez. "Seçmeli Ders" satırı, çizelgedeki seçmeli ders saati toplamını (5/5/5/6) temsil
// eden tek bir yer tutucudur — kullanıcı okulundaki gerçek seçmeli ders adıyla değiştirebilir.
// Zorunlu+seçmeli toplamı (Rehberlik hariç) her sınıfta 34'tür (toplam 35 - 1 Rehberlik).
//
// Lise (9-12): 9. sınıf, Anadolu Lisesi tipi haftalık ders çizelgesine göre (zorunlu 32 +
// seçmeli 7 + Rehberlik 1 = 40) — en yaygın lise türü baz alındı. 10-12. sınıfta yalnızca
// GERÇEKTEN ORTAK (okul/alan türüne göre değişmeyen) dersler resmi "Genel Lise Haftalık Ders
// Çizelgesi"nden (TTK, ortak ders saati toplamı 10:15, 11:15, 12:12) alındı; Matematik, Fizik,
// Kimya, Biyoloji, Tarih/Coğrafya gibi dersler 10. sınıftan itibaren ALAN/SEÇMELİ olduğu için
// (okul türüne ve seçilen alana göre 2-4 saat arası değişir) varsayılana eklenmedi — "Seçmeli
// Ders" yer tutucusu bu farkı (toplam 39'a tamamlayacak şekilde) temsil eder. Kullanıcı kendi
// alan derslerini "Başka bir ders ekle" ile gerçek saatiyle eklemelidir. Lise toplamı (Rehberlik
// hariç) standart olarak 39'dur (genel toplam 40 - 1 Rehberlik), okul türüne göre değişebilir.
interface VarsayilanDers {
  dersAdi: string;
  haftalikSaat: number;
}

const ORTAOKUL_VARSAYILAN: Record<number, VarsayilanDers[]> = {
  5: [
    { dersAdi: 'Türkçe', haftalikSaat: 6 },
    { dersAdi: 'Matematik', haftalikSaat: 5 },
    { dersAdi: 'Fen Bilimleri', haftalikSaat: 4 },
    { dersAdi: 'Sosyal Bilgiler', haftalikSaat: 3 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 3 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar', haftalikSaat: 1 },
    { dersAdi: 'Müzik', haftalikSaat: 1 },
    { dersAdi: 'Beden Eğitimi ve Spor', haftalikSaat: 2 },
    { dersAdi: 'Bilişim Teknolojileri ve Yazılım', haftalikSaat: 2 },
    { dersAdi: 'Seçmeli Ders', haftalikSaat: 5 },
  ],
  6: [
    { dersAdi: 'Türkçe', haftalikSaat: 6 },
    { dersAdi: 'Matematik', haftalikSaat: 5 },
    { dersAdi: 'Fen Bilimleri', haftalikSaat: 4 },
    { dersAdi: 'Sosyal Bilgiler', haftalikSaat: 3 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 3 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar', haftalikSaat: 1 },
    { dersAdi: 'Müzik', haftalikSaat: 1 },
    { dersAdi: 'Beden Eğitimi ve Spor', haftalikSaat: 2 },
    { dersAdi: 'Bilişim Teknolojileri ve Yazılım', haftalikSaat: 2 },
    { dersAdi: 'Seçmeli Ders', haftalikSaat: 5 },
  ],
  7: [
    { dersAdi: 'Türkçe', haftalikSaat: 5 },
    { dersAdi: 'Matematik', haftalikSaat: 5 },
    { dersAdi: 'Fen Bilimleri', haftalikSaat: 4 },
    { dersAdi: 'Sosyal Bilgiler', haftalikSaat: 3 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 4 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar', haftalikSaat: 1 },
    { dersAdi: 'Müzik', haftalikSaat: 1 },
    { dersAdi: 'Beden Eğitimi ve Spor', haftalikSaat: 2 },
    { dersAdi: 'Teknoloji ve Tasarım', haftalikSaat: 2 },
    { dersAdi: 'Seçmeli Ders', haftalikSaat: 5 },
  ],
  8: [
    { dersAdi: 'Türkçe', haftalikSaat: 5 },
    { dersAdi: 'Matematik', haftalikSaat: 5 },
    { dersAdi: 'Fen Bilimleri', haftalikSaat: 4 },
    { dersAdi: 'T.C. İnkılap Tarihi ve Atatürkçülük', haftalikSaat: 2 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 4 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar', haftalikSaat: 1 },
    { dersAdi: 'Müzik', haftalikSaat: 1 },
    { dersAdi: 'Beden Eğitimi ve Spor', haftalikSaat: 2 },
    { dersAdi: 'Teknoloji ve Tasarım', haftalikSaat: 2 },
    { dersAdi: 'Seçmeli Ders', haftalikSaat: 6 },
  ],
};

const LISE_VARSAYILAN: Record<number, VarsayilanDers[]> = {
  9: [
    { dersAdi: 'Türk Dili ve Edebiyatı', haftalikSaat: 5 },
    { dersAdi: 'Matematik', haftalikSaat: 6 },
    { dersAdi: 'Fizik', haftalikSaat: 2 },
    { dersAdi: 'Kimya', haftalikSaat: 2 },
    { dersAdi: 'Biyoloji', haftalikSaat: 2 },
    { dersAdi: 'Tarih', haftalikSaat: 2 },
    { dersAdi: 'Coğrafya', haftalikSaat: 2 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 2 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 4 },
    { dersAdi: 'Beden Eğitimi ve Spor', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar/Müzik', haftalikSaat: 2 },
    { dersAdi: 'Sağlık Bilgisi ve Trafik Kültürü', haftalikSaat: 1 },
    { dersAdi: 'Seçmeli Ders', haftalikSaat: 7 },
  ],
  10: [
    { dersAdi: 'Dil ve Anlatım', haftalikSaat: 2 },
    { dersAdi: 'Türk Edebiyatı', haftalikSaat: 3 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 1 },
    { dersAdi: 'Tarih', haftalikSaat: 2 },
    { dersAdi: 'Coğrafya', haftalikSaat: 2 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 2 },
    { dersAdi: 'Beden Eğitimi', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar/Müzik', haftalikSaat: 1 },
    { dersAdi: 'Seçmeli Ders (alan dersleri dahil)', haftalikSaat: 24 },
  ],
  11: [
    { dersAdi: 'Dil ve Anlatım', haftalikSaat: 2 },
    { dersAdi: 'Türk Edebiyatı', haftalikSaat: 3 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 1 },
    { dersAdi: 'T.C. İnkılap Tarihi ve Atatürkçülük', haftalikSaat: 2 },
    { dersAdi: 'Felsefe', haftalikSaat: 2 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 2 },
    { dersAdi: 'Beden Eğitimi', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar/Müzik', haftalikSaat: 1 },
    { dersAdi: 'Seçmeli Ders (alan dersleri dahil)', haftalikSaat: 24 },
  ],
  12: [
    { dersAdi: 'Dil ve Anlatım', haftalikSaat: 2 },
    { dersAdi: 'Türk Edebiyatı', haftalikSaat: 3 },
    { dersAdi: 'Din Kültürü ve Ahlak Bilgisi', haftalikSaat: 1 },
    { dersAdi: 'Yabancı Dil', haftalikSaat: 2 },
    { dersAdi: 'Beden Eğitimi', haftalikSaat: 2 },
    { dersAdi: 'Görsel Sanatlar/Müzik', haftalikSaat: 1 },
    { dersAdi: 'Trafik ve İlk Yardım', haftalikSaat: 1 },
    { dersAdi: 'Seçmeli Ders (alan dersleri dahil)', haftalikSaat: 27 },
  ],
};

// Kademe başına beklenen toplam haftalık ders saati (Rehberlik hariç) — "sağlama" için
// varsayılan hedef. Ortaokulda her sınıf 35 toplam - 1 Rehberlik = 34; lisede her sınıf
// 40 toplam - 1 Rehberlik = 39. Okul türüne göre (örn. mesleki/teknik) değişebileceği için
// kullanıcı bu değeri düzenleyebilir.
export const TOPLAM_SAAT_HEDEFI: Record<OkulKademesi, number> = {
  ortaokul: 34,
  lise: 39,
};

export function varsayilanDersler(sinifSeviyesi: number): DersSatiri[] {
  const liste = kademeBelirle(sinifSeviyesi) === 'ortaokul' ? ORTAOKUL_VARSAYILAN[sinifSeviyesi] : LISE_VARSAYILAN[sinifSeviyesi];
  return (liste ?? []).map((d) => ({
    id: Math.random().toString(36).slice(2),
    dersAdi: d.dersAdi,
    haftalikSaat: d.haftalikSaat,
    yazili1: null,
    yazili2: null,
    yazili3: null,
    performans1: null,
    performans2: null,
    performans3: null,
    katilim1: null,
    katilim2: null,
    katilim3: null,
    proje: null,
  }));
}

// Hızlı ekleme önerileri: ortaokulda ve lise 9'da varsayılan liste zaten tam olduğu için boş.
// Lise 10-12'de alan/seçmeli dersler (Matematik, Fizik, Kimya, Biyoloji vb.) sınıf değiştikçe
// "Seçmeli Ders (alan dersleri dahil)" yer tutucusunun içinde — kullanıcı bunu gerçek alan
// dersiyle değiştirmek isteyebileceği için hızlı ekleme önerilir.
const LISE_ALAN_DERSLERI_ONERILERI = ['Matematik', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji', 'Felsefe Grubu', 'Coğrafya'];

export function dersOnerileri(sinifSeviyesi: number): string[] {
  if (kademeBelirle(sinifSeviyesi) === 'lise' && sinifSeviyesi >= 10) return LISE_ALAN_DERSLERI_ONERILERI;
  return [];
}
