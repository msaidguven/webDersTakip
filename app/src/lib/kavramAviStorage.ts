// Kavram Avı ilerlemesi (tamamlanan kavramlar) — tarayıcıda localStorage'da tutulur.
// Özel gezinti / dolu depo gibi durumlarda erişim hata verebilir; her şey try/catch içinde.
const ANAHTAR = 'kavram-avi:tamamlanan:v1';

export function tamamlananlariOku(): string[] {
  try {
    const ham = window.localStorage.getItem(ANAHTAR);
    const veri: unknown = ham ? JSON.parse(ham) : [];
    return Array.isArray(veri) ? veri.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function tamamlananlariYaz(liste: string[]): void {
  try {
    window.localStorage.setItem(ANAHTAR, JSON.stringify(liste));
  } catch {
    /* kaydedilemezse oyun yine çalışır */
  }
}
