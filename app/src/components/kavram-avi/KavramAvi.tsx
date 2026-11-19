'use client';

// Kavram Avı sayfasının etkileşimli kısmı: ders/sınıf seçimi → kavram listesi → oyun ekranı.
// Oyun mantığı useKavramOyunu hook'unda; burada yalnızca ekranlar ve ilerleme kaydı var.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { SETLER, type Kavram, type KavramSeti } from '@/app/src/lib/kavramAvi';
import { tamamlananlariOku, tamamlananlariYaz } from '@/app/src/lib/kavramAviStorage';
import { useKavramOyunu } from '@/app/src/hooks/useKavramOyunu';
import { BilgiKarti } from './BilgiKarti';
import { HarfCemberi } from './HarfCemberi';
import { KavramKutulari } from './KavramKutulari';
import r from '../robotic/robotic.module.css';
import s from './kavramAvi.module.css';

const anahtarOlustur = (set: KavramSeti, k: Kavram) => `${set.anahtar}|${k.id}`;

function Oyun({
  set,
  sira,
  onTamamlandi,
  onSonraki,
  onGeri,
}: {
  set: KavramSeti;
  sira: number;
  onTamamlandi: (kavramId: string) => void;
  onSonraki: () => void;
  onGeri: () => void;
}) {
  const kavram = set.kavramlar[sira];
  const o = useKavramOyunu(kavram, onTamamlandi);

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={`${s.dugme} ${r.btnGhost} !min-h-9 !py-1`} onClick={onGeri} aria-label="Kavram listesine dön">
          <ArrowLeft size={18} aria-hidden="true" /> Liste
        </button>
        <span className={r.label}>
          Kavram {sira + 1} / {set.kavramlar.length}
        </span>
      </div>

      <section className={`${s.tanim} ${r.item}`} aria-label="Kavramın tanımı">
        <span className={s.tanimEtiket}>Tanım</span>
        <p>{kavram.tanim}</p>
      </section>

      <KavramKutulari kelimeler={o.kelimeler} aktif={o.aktif} ipucu={o.ipucu} />

      {o.tamamlandi ? (
        <div aria-live="polite">
          <BilgiKarti kavram={kavram} sonrakiVar={sira + 1 < set.kavramlar.length} onSonraki={onSonraki} />
        </div>
      ) : (
        <>
          {o.kelimeler.length > 1 && (
            <p className={s.sira} aria-live="polite">
              {o.aktif + 1}. kelimeyi bul ({Array.from(o.aranan).length} harf)
            </p>
          )}
          <HarfCemberi
            harfler={o.harfler}
            secim={o.secim}
            secilenKelime={o.secilenKelime}
            yanlis={o.yanlis}
            ipucuBitti={o.ipucuBitti}
            onHarfSec={o.harfSec}
            onGonder={o.gonder}
            onTemizle={o.temizle}
            onKaristir={o.karistir}
            onIpucu={o.ipucuAc}
          />
        </>
      )}
    </div>
  );
}

export function KavramAvi({ baslik }: { baslik?: React.ReactNode }) {
  const dersler = useMemo(() => Array.from(new Set(SETLER.map((x) => x.ders))), []);
  const [ders, setDers] = useState(dersler[0]);
  const siniflar = useMemo(
    () => Array.from(new Set(SETLER.filter((x) => x.ders === ders).map((x) => x.sinif))).sort((a, b) => a - b),
    [ders],
  );
  const [sinif, setSinif] = useState(siniflar[0]);
  const [tamamlananlar, setTamamlananlar] = useState<string[]>([]);
  const [oyun, setOyun] = useState<{ set: KavramSeti; sira: number } | null>(null);

  // localStorage yalnızca tarayıcıda okunur (sunucu çıktısıyla uyuşmazlık olmasın diye efektte).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnızca istemcide okunabilir
    setTamamlananlar(tamamlananlariOku());
  }, []);

  const secenekSetleri = SETLER.filter((x) => x.ders === ders && x.sinif === sinif);

  const kavramBitti = useCallback(
    (kavramId: string) => {
      if (!oyun) return;
      const anahtar = `${oyun.set.anahtar}|${kavramId}`;
      setTamamlananlar((onceki) => {
        if (onceki.includes(anahtar)) return onceki;
        const yeni = [...onceki, anahtar];
        tamamlananlariYaz(yeni);
        return yeni;
      });
    },
    [oyun],
  );

  if (oyun) {
    const kavram = oyun.set.kavramlar[oyun.sira];
    return (
      <Oyun
        key={`${oyun.set.anahtar}|${kavram.id}`}
        set={oyun.set}
        sira={oyun.sira}
        onTamamlandi={kavramBitti}
        onGeri={() => setOyun(null)}
        onSonraki={() =>
          setOyun(oyun.sira + 1 < oyun.set.kavramlar.length ? { set: oyun.set, sira: oyun.sira + 1 } : null)
        }
      />
    );
  }

  return (
    <>
    {baslik}
    <div className="flex flex-col gap-6">
      <section className={`${r.panel} flex flex-col gap-4 p-5 sm:p-6`} aria-label="Ders ve sınıf seçimi">
        <div className="flex flex-col gap-2">
          <span className={r.label}>Ders</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ders seç">
            {dersler.map((d) => (
              <button
                key={d}
                type="button"
                className={`${s.secimDugme} ${d === ders ? s.secimAktif : ''}`}
                aria-pressed={d === ders}
                aria-label={`${d} dersini seç`}
                onClick={() => {
                  setDers(d);
                  setSinif(Array.from(new Set(SETLER.filter((x) => x.ders === d).map((x) => x.sinif))).sort((a, b) => a - b)[0]);
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className={r.label}>Sınıf</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sınıf seç">
            {siniflar.map((n) => (
              <button
                key={n}
                type="button"
                className={`${s.secimDugme} ${n === sinif ? s.secimAktif : ''}`}
                aria-pressed={n === sinif}
                aria-label={`${n}. sınıfı seç`}
                onClick={() => setSinif(n)}
              >
                {n}. Sınıf
              </button>
            ))}
          </div>
        </div>
      </section>

      {secenekSetleri.map((set) => {
        const biten = set.kavramlar.filter((k) => tamamlananlar.includes(anahtarOlustur(set, k))).length;
        return (
          <section key={set.anahtar} className={`${r.panel} flex flex-col gap-4 p-5 sm:p-6`} aria-label={set.unite}>
            <div className="flex flex-col gap-2">
              <span className={r.label}>Ünite</span>
              <h2 className="text-lg font-extrabold">{set.unite}</h2>
              <div className="flex items-center gap-3">
                <div className={`${r.track} flex-1`} role="progressbar" aria-valuemin={0} aria-valuemax={set.kavramlar.length} aria-valuenow={biten} aria-label="Tamamlanan kavramlar">
                  <div className={r.fill} style={{ width: `${(biten / set.kavramlar.length) * 100}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {biten}/{set.kavramlar.length}
                </span>
              </div>
            </div>
            <ul className={s.liste}>
              {set.kavramlar.map((k, i) => {
                const bitti = tamamlananlar.includes(anahtarOlustur(set, k));
                return (
                  <li key={k.id}>
                    <button
                      type="button"
                      className={`${s.kavramDugme} ${r.item} ${r.itemHover}`}
                      onClick={() => setOyun({ set, sira: i })}
                      aria-label={bitti ? `${i + 1}. kavram, tamamlandı: ${k.kavram}` : `${i + 1}. kavramı oyna`}
                    >
                      <span className={`${r.chipBox} ${s.numara}`}>{bitti ? <Check size={18} aria-hidden="true" /> : i + 1}</span>
                      <span className={s.kavramAdi}>
                        {bitti ? k.kavram : 'Gizli kavram'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
    </>
  );
}
