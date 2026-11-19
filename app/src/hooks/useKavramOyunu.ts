'use client';

// Kavram Avı oyun mantığı: kavramı kelimelere böler, sıradaki kelimenin harflerini çembere
// karıştırarak koyar, seçilen harflerle kelimeyi doğrular, ipucu ve karıştırmayı yönetir.
// Arayüz (HarfCemberi / KavramKutulari) yalnızca bu hook'un döndürdüğü durumu çizer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { karistirHarfler, kelimelereAyir, type CemberHarfi, type Kavram } from '@/app/src/lib/kavramAvi';

const YANLIS_SURESI_MS = 500;

export function useKavramOyunu(kavram: Kavram, onTamamlandi?: (kavramId: string) => void) {
  const kelimeler = useMemo(() => kelimelereAyir(kavram.kavram), [kavram.kavram]);
  const [aktif, setAktif] = useState(0); // aranan kelimenin sırası; kelimeler.length → hepsi bulundu
  const [harfler, setHarfler] = useState<CemberHarfi[]>(() => karistirHarfler(kelimeler[0] ?? ''));
  const [secim, setSecim] = useState<number[]>([]); // harfler dizisindeki sıra numaraları
  const [ipucu, setIpucu] = useState(0); // aktif kelimede açılan harf sayısı
  const [yanlis, setYanlis] = useState(false);
  const secimRef = useRef<number[]>([]);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
  }, []);

  const tamamlandi = aktif >= kelimeler.length;
  const aranan = tamamlandi ? '' : kelimeler[aktif];

  const secimiGuncelle = useCallback((yeni: number[]) => {
    secimRef.current = yeni;
    setSecim(yeni);
  }, []);

  /** Harfe dokunuldu/üzerinden geçildi: yeni harfi ekler; bir önceki harfe dönülürse geri alır. */
  const harfSec = useCallback(
    (sira: number) => {
      const onceki = secimRef.current;
      if (onceki.includes(sira)) {
        if (onceki.length >= 2 && onceki[onceki.length - 2] === sira) secimiGuncelle(onceki.slice(0, -1));
        return;
      }
      secimiGuncelle([...onceki, sira]);
    },
    [secimiGuncelle],
  );

  const temizle = useCallback(() => secimiGuncelle([]), [secimiGuncelle]);

  /** Parmak kalktı: seçilen harflerden oluşan kelimeyi aranan kelimeyle karşılaştırır. */
  const gonder = useCallback(() => {
    const secilen = secimRef.current;
    secimiGuncelle([]);
    if (tamamlandi || secilen.length === 0) return;
    // Yanlışlıkla tek harfe dokunmak sallanma yapmasın (tek harfli kelime hariç).
    if (secilen.length < 2 && aranan.length > 1) return;
    const kelime = secilen.map((i) => harfler[i].harf).join('');
    if (kelime === aranan) {
      const sonraki = aktif + 1;
      setAktif(sonraki);
      setIpucu(0);
      if (sonraki < kelimeler.length) setHarfler(karistirHarfler(kelimeler[sonraki]));
      else onTamamlandi?.(kavram.id);
      return;
    }
    setYanlis(true);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => setYanlis(false), YANLIS_SURESI_MS);
  }, [tamamlandi, aranan, harfler, aktif, kelimeler, kavram.id, onTamamlandi, secimiGuncelle]);

  const karistir = useCallback(() => {
    if (tamamlandi) return;
    secimiGuncelle([]);
    setHarfler(karistirHarfler(aranan));
  }, [tamamlandi, aranan, secimiGuncelle]);

  /** İlk basışta aranan kelimenin ilk harfi, sonrakilerde sıradaki harf açılır. */
  const ipucuAc = useCallback(() => {
    if (tamamlandi) return;
    setIpucu((n) => Math.min(n + 1, aranan.length));
  }, [tamamlandi, aranan]);

  return {
    kelimeler,
    aktif,
    aranan,
    harfler,
    secim,
    secilenKelime: secim.map((i) => harfler[i].harf).join(''),
    ipucu,
    ipucuBitti: tamamlandi || ipucu >= aranan.length,
    yanlis,
    tamamlandi,
    harfSec,
    temizle,
    gonder,
    karistir,
    ipucuAc,
  };
}
