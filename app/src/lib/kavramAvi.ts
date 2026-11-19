// Kavram Avı — tür tanımları, kavram setleri ve harf yardımcıları.
// Tüm büyük/küçük harf ve karşılaştırma işlemleri Türkçe kurallarıyla (tr-TR) yapılır:
// i → İ, ı → I karışmaz. Yeni set eklemek için app/src/data altına aynı biçimde bir JSON
// koyup aşağıdaki SETLER listesine eklemek yeterli.
import kavramlarSosyal5 from '@/app/src/data/kavramlar.json';

export type Kavram = {
  id: string;
  kavram: string;
  tanim: string;
  ek?: string;
};

export type KavramSeti = {
  anahtar: string;
  ders: string;
  sinif: number;
  unite: string;
  kavramlar: Kavram[];
};

export type CemberHarfi = { id: number; harf: string };

function setOlustur(veri: { ders: string; sinif: number; unite: string; kavramlar: Kavram[] }): KavramSeti {
  return { ...veri, anahtar: `${veri.ders}|${veri.sinif}|${veri.unite}` };
}

export const SETLER: KavramSeti[] = [setOlustur(kavramlarSosyal5)];

export function buyukHarf(metin: string): string {
  return metin.toLocaleUpperCase('tr-TR');
}

/** "Dağınık Yerleşme" → ["DAĞINIK", "YERLEŞME"] (boşluğa göre, otomatik). */
export function kelimelereAyir(kavram: string): string[] {
  return buyukHarf(kavram).trim().split(/\s+/).filter(Boolean);
}

/** Bir kelimenin harflerini karıştırır; mümkünse asla doğru sırayla başlamaz. */
export function karistirHarfler(kelime: string): CemberHarfi[] {
  const orijinal = Array.from(kelime).map((harf, id) => ({ id, harf }));
  const hepsiAyni = orijinal.every((h) => h.harf === orijinal[0].harf);
  if (orijinal.length < 2 || hepsiAyni) return orijinal;
  let sonuc = orijinal;
  for (let deneme = 0; deneme < 30; deneme++) {
    const kopya = [...orijinal];
    for (let i = kopya.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
    }
    sonuc = kopya;
    if (kopya.map((h) => h.harf).join('') !== kelime) break;
  }
  return sonuc;
}
