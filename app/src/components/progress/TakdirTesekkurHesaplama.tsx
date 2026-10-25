'use client';

// Takdir/Teşekkür belgesi hesaplama aracı (herkese açık sayfanın etkileşimli kısmı).
// Hesaplama herkes için anında çalışır; giriş yapan kullanıcının girdiği dersler/puanlar
// isterse kaydedilir (bkz. takdirTesekkurStorage.ts, save_takdir_tesekkur_calculation RPC'si).
// Dersler burada SERBEST METİN — lessons tablosuna dokunulmaz, Resim/Beden/Müzik/seçmeli
// dersler de aynı şekilde eklenebilir.
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import {
  belgeHesapla,
  dersOnerileri,
  donemNotu,
  kademeBelirle,
  katilimSayisi,
  SINIF_SEVIYELERI,
  TOPLAM_SAAT_HEDEFI,
  varsayilanDersler,
  type DersSatiri,
  type OkulKademesi,
} from '@/app/src/lib/takdirTesekkurHesaplama';
import {
  gonderGeriBildirim,
  loadTakdirTesekkurCalculation,
  saveTakdirTesekkurCalculation,
} from '@/app/src/lib/takdirTesekkurStorage';
import r from '../robotic/robotic.module.css';

const card = `rounded-[22px] ${r.panel}`;
const inputCls = `rounded-xl px-3 py-2 text-sm font-semibold ${r.item}`;
const labelCls = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground';

function yeniDers(dersAdi = ''): DersSatiri {
  return {
    id: Math.random().toString(36).slice(2),
    dersAdi,
    haftalikSaat: 2,
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
  };
}

// Sayı girişi boşaltılınca "" gelir — Number('') 0 olduğu için boşu null'a çeviriyoruz
// (not alanları varsayılan olarak boş, kullanıcı silince de boş kalmalı).
function sayiYaDaBos(ham: string): number | null {
  if (ham === '') return null;
  return Math.min(100, Math.max(0, Number(ham)));
}

function haftalikSaatSinirla(ham: string): number | null {
  if (ham === '') return null;
  return Math.min(40, Math.max(1, Number(ham)));
}

// Kısa etiketli, eşit genişlikte not kutusu: bir dersin tüm notları mobilde de tek satıra sığsın
// (kullanıcı isteği 2026-10-20: "öğrenci bir bakışta hepsini görsün"). Tam ad aria-label/title'da.
function NotAlani({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  ariaLabel: string;
}) {
  return (
    <label className="flex min-w-0 flex-col items-center gap-0.5" title={ariaLabel}>
      <span className={`text-[10px] font-semibold leading-none ${r.mono} ${r.muted}`}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        value={value ?? ''}
        onChange={(e) => onChange(sayiYaDaBos(e.target.value))}
        aria-label={ariaLabel}
        className={`h-9 w-full min-w-0 rounded-lg px-0 text-center text-sm font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${r.item}`}
      />
    </label>
  );
}

const belgeStil: Record<string, string> = {
  takdir: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
  tesekkur: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
  yok: 'border-default bg-surface-elevated text-muted-foreground',
};

const belgeBaslik: Record<string, string> = {
  takdir: 'Takdir belgesi',
  tesekkur: 'Teşekkür belgesi',
  yok: 'Belge yok',
};

export function TakdirTesekkurHesaplama() {
  const { user, supabase } = useAuth();
  const formId = useId();
  const [sinifSeviyesi, setSinifSeviyesi] = useState(5);
  const [donem, setDonem] = useState<1 | 2>(1);
  const [dersler, setDersler] = useState<DersSatiri[]>(() => varsayilanDersler(5));
  const [toplamSaatHedefi, setToplamSaatHedefi] = useState(TOPLAM_SAAT_HEDEFI.ortaokul);
  const [davranisPuaniTam, setDavranisPuaniTam] = useState(true);
  const [tumDerslerdenBasarili, setTumDerslerdenBasarili] = useState(true);
  const [ozelDersAdi, setOzelDersAdi] = useState('');
  const [kayitDurumu, setKayitDurumu] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const kademe = kademeBelirle(sinifSeviyesi);

  // Mobilde sonuç kartı ders listesinin altında kalıyor; kart ekranda değilken altta küçük bir
  // sonuç şeridi gösterilir (dokununca karta iner). lg ve üstünde kart zaten sağda yapışkan.
  const sonucRef = useRef<HTMLElement>(null);
  const [sonucGorunur, setSonucGorunur] = useState(false);
  useEffect(() => {
    const el = sonucRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSonucGorunur(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Sınıf veya dönem değişince, render sırasında (effect içinde değil — React'in önerdiği "prop
  // değişince state ayarlama" deseni) resmi çizelgenin varsayılanlarına sıfırla.
  const [sifirlananAnahtar, setSifirlananAnahtar] = useState(`${sinifSeviyesi}-${donem}`);
  const guncelAnahtar = `${sinifSeviyesi}-${donem}`;
  if (sifirlananAnahtar !== guncelAnahtar) {
    setSifirlananAnahtar(guncelAnahtar);
    setDersler(varsayilanDersler(sinifSeviyesi));
    setToplamSaatHedefi(TOPLAM_SAAT_HEDEFI[kademeBelirle(sinifSeviyesi)]);
    setDavranisPuaniTam(true);
    setTumDerslerdenBasarili(true);
    setKayitDurumu('idle');
  }

  // Girişli kullanıcıda o sınıf/dönem için kaydedilmiş veri varsa getir, varsayılanların üzerine yazar.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadTakdirTesekkurCalculation(supabase, sinifSeviyesi, donem).then((kayit) => {
      if (cancelled || !kayit) return;
      setDersler(kayit.dersler);
      setDavranisPuaniTam(kayit.davranisPuaniTam);
      setTumDerslerdenBasarili(kayit.tumDerslerdenBasarili);
    });
    return () => {
      cancelled = true;
    };
  }, [user, supabase, sinifSeviyesi, donem]);

  const sonuc = belgeHesapla({ sinifSeviyesi, dersler, davranisPuaniTam, tumDerslerdenBasarili });
  const girilenToplamSaat = dersler.reduce((toplam, d) => toplam + d.haftalikSaat, 0);
  const saglamaUyusmuyor = dersler.length > 0 && girilenToplamSaat !== toplamSaatHedefi;
  const notGirilenDersSayisi = dersler.filter((d) => donemNotu(d, kademe) === null).length;

  function dersGuncelle(id: string, patch: Partial<DersSatiri>) {
    setDersler((liste) => liste.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setKayitDurumu('idle');
  }

  function dersSil(id: string) {
    setDersler((liste) => liste.filter((d) => d.id !== id));
    setKayitDurumu('idle');
  }

  function dersEkle(ad: string) {
    if (!ad.trim() || dersler.some((d) => d.dersAdi.toLowerCase() === ad.trim().toLowerCase())) return;
    setDersler((liste) => [...liste, yeniDers(ad.trim())]);
    setKayitDurumu('idle');
  }

  async function kaydet() {
    setKayitDurumu('saving');
    const { error } = await saveTakdirTesekkurCalculation(supabase, sinifSeviyesi, donem, davranisPuaniTam, tumDerslerdenBasarili, dersler);
    setKayitDurumu(error ? 'error' : 'saved');
  }

  const oneriler = dersOnerileri(sinifSeviyesi).filter((ad) => !dersler.some((d) => d.dersAdi.toLowerCase() === ad.toLowerCase()));

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-labelledby="hesaplama-baslik" className="flex min-w-0 flex-col gap-6">
        <div className={`${card} flex flex-col gap-4 p-5 sm:p-7`}>
          <h2 id="hesaplama-baslik" className="text-lg font-extrabold text-default">
            Sınıf ve dönem
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className={labelCls}>
              Sınıf
              <select value={sinifSeviyesi} onChange={(e) => setSinifSeviyesi(Number(e.target.value))} className={inputCls}>
                {SINIF_SEVIYELERI.map((s) => (
                  <option key={s} value={s}>
                    {s}. Sınıf
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Dönem
              <select value={donem} onChange={(e) => setDonem(Number(e.target.value) as 1 | 2)} className={inputCls}>
                <option value={1}>1. Dönem</option>
                <option value={2}>2. Dönem</option>
              </select>
            </label>
            <label className={`${labelCls} col-span-2 sm:col-span-1`}>
              Haftalık toplam saat
              <input
                type="number"
                min={1}
                max={60}
                value={toplamSaatHedefi}
                onChange={(e) => {
                  const saat = haftalikSaatSinirla(e.target.value);
                  if (saat !== null) setToplamSaatHedefi(saat);
                }}
                className={inputCls}
              />
            </label>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Haftalık toplam saat bir <strong className="text-default">sağlamadır</strong>: derslerin saatleri toplamı bununla
            eşleşmeli. Resmi çizelgede {kademe === 'ortaokul' ? '5-8. sınıflarda 34' : '9-12. sınıflarda 39'} saattir (notla
            değerlendirilmeyen Rehberlik hariç). Okulunda farklıysa değiştir.
          </p>
          {saglamaUyusmuyor && (
            <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              Derslerin toplam haftalık saati {girilenToplamSaat}, hedef {toplamSaatHedefi}. Fark: {Math.abs(girilenToplamSaat - toplamSaatHedefi)}{' '}
              saat — bir dersin saatini kontrol et ki ortalama doğru çıksın.
            </p>
          )}
        </div>

        <div className={`${card} flex flex-col gap-4 p-5 sm:p-7`}>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-extrabold text-default">Dersler ve notlar</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Dersler ve saatleri resmi çizelgeden otomatik dolar; karnene göre düzenleyebilir, Resim, Beden Eğitimi, Müzik ve
              seçmeli dersleri ekleyebilirsin.{' '}
              {kademe === 'ortaokul'
                ? 'Dönemde 2 yazılı yapılır; haftalık saati 2 ve altı olan derste 2, fazlasında 3 "ders etkinliklerine katılım" (sözlü) puanı verilir. Varsa proje puanını da gir.'
                : 'Dönemde 2 yazılı yapılır; haftalık saati 6 ve üzeri olan derste zümre kararıyla 3. yazılı da yapılabilir.'}
            </p>
          </div>

          {dersler.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className={`text-[11px] ${r.mono} ${r.muted}`}>
                {kademe === 'ortaokul' ? 'Y: Yazılı · S: Sözlü (katılım) · Pr: Proje · sa: haftalık saat' : 'Y: Yazılı · P: Performans · Pr: Proje · sa: haftalık saat'} · en sağda dönem notu
              </p>
              {dersler.map((ders) => (
                <DersKarti
                  key={ders.id}
                  ders={ders}
                  kademe={kademe}
                  barajAltinda={sonuc.barajAltindaKalanlar.includes(ders.dersAdi)}
                  onGuncelle={(patch) => dersGuncelle(ders.id, patch)}
                  onSil={() => dersSil(ders.id)}
                />
              ))}
            </div>
          )}

          {oneriler.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Hızlı ders ekle">
              {oneriler.map((ad) => (
                <button
                  key={ad}
                  type="button"
                  onClick={() => dersEkle(ad)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${r.btnGhost}`}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" /> {ad}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              dersEkle(ozelDersAdi);
              setOzelDersAdi('');
            }}
            className="flex gap-2"
          >
            <label htmlFor={`${formId}-ozel`} className="sr-only">
              Başka ders ekle
            </label>
            <input
              id={`${formId}-ozel`}
              value={ozelDersAdi}
              onChange={(e) => setOzelDersAdi(e.target.value)}
              placeholder="Başka bir ders adı yaz (ör. Satranç)"
              className={`min-w-0 flex-1 ${inputCls}`}
            />
            <button
              type="submit"
              disabled={!ozelDersAdi.trim()}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${r.btnGhost}`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Ekle
            </button>
          </form>
        </div>

        {kademe === 'lise' && (
          <div className={`${card} flex flex-col gap-3 p-5 sm:p-7`}>
            <h3 className="text-lg font-extrabold text-default">Diğer şartlar</h3>
            <Toggle label="Davranış puanım 100" checked={davranisPuaniTam} onChange={setDavranisPuaniTam} />
            <Toggle label="Tüm derslerden başarılıyım (sınıfımı geçtim)" checked={tumDerslerdenBasarili} onChange={setTumDerslerdenBasarili} />
          </div>
        )}
      </section>

      {/* .panel position: relative verdiği için fixed konum dış kapsayıcıda; aynı sebeple aşağıdaki
          sonuç kartında lg:!sticky (önem işareti olmadan .panel sticky'yi eziyordu). */}
      {!sonucGorunur && notGirilenDersSayisi < dersler.length && (
        <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
          <button
            type="button"
            onClick={() => sonucRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left ${r.panel}`}
          >
            <span className="flex flex-col">
              <span className="text-[11px] font-semibold text-muted-foreground">Ağırlıklı ortalama</span>
              <span className={`text-xl ${r.statValue}`}>{sonuc.agirlikliOrtalama.toFixed(2)}</span>
            </span>
            <span className={`rounded-xl border px-3 py-1.5 text-sm font-extrabold ${belgeStil[sonuc.belge]}`}>{belgeBaslik[sonuc.belge]}</span>
          </button>
        </div>
      )}

      <aside ref={sonucRef} aria-label="Sonuç" className={`${card} ${r.hero} flex flex-col gap-4 p-5 sm:p-6 scroll-mt-24 lg:!sticky lg:top-24`}>
        <span className={r.scan} aria-hidden="true" />
        <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}>
          <i className={r.led} aria-hidden="true" />
          Sonuç
        </span>
        <div role="status" className="flex flex-col gap-3">
          <div className={`flex flex-col gap-1 p-4 ${r.stat}`}>
            <span className="text-xs font-semibold text-muted-foreground">Ağırlıklı ortalama</span>
            <span className={`text-4xl ${r.statValue}`}>{sonuc.agirlikliOrtalama.toFixed(2)}</span>
          </div>
          <p className={`rounded-xl border px-3 py-2 text-lg font-extrabold ${belgeStil[sonuc.belge]}`}>{belgeBaslik[sonuc.belge]}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{sonuc.mesaj}</p>
          {notGirilenDersSayisi > 0 && notGirilenDersSayisi < dersler.length && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {dersler.length - notGirilenDersSayisi}/{dersler.length} ders için not girildi — kalanları da girince ortalama değişir.
            </p>
          )}
        </div>

        <div className={`flex flex-col gap-3 border-t pt-4 ${r.divider}`}>
          {user ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={kaydet}
                disabled={kayitDurumu === 'saving' || dersler.length === 0}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-60 ${r.btnNeon} ${r.btnText}`}
              >
                {kayitDurumu === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              {kayitDurumu === 'saved' && <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Kaydedildi.</p>}
              {kayitDurumu === 'error' && <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">Kaydedilemedi, tekrar dener misin?</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Notlarını kaydetmek için{' '}
              <Link href="/login?redirectTo=/takdir-tesekkur-hesaplama" className={`font-semibold underline ${r.accent}`}>
                giriş yap
              </Link>
              .
            </p>
          )}
          <GeriBildirimFormu
            sinifSeviyesi={sinifSeviyesi}
            donem={donem}
            kademe={kademe}
            dersler={dersler}
            belge={sonuc.belge}
            agirlikliOrtalama={sonuc.agirlikliOrtalama}
          />
        </div>
      </aside>
    </div>
  );
}

const KATILIM_ANAHTARLARI = ['katilim1', 'katilim2', 'katilim3'] as const;

const GERI_BILDIRIM_MIN = 10;
const GERI_BILDIRIM_MAX = 1000;

function GeriBildirimFormu({
  sinifSeviyesi,
  donem,
  kademe,
  dersler,
  belge,
  agirlikliOrtalama,
}: {
  sinifSeviyesi: number;
  donem: 1 | 2;
  kademe: OkulKademesi;
  dersler: DersSatiri[];
  belge: string;
  agirlikliOrtalama: number;
}) {
  const { user, supabase } = useAuth();
  const formId = useId();
  const [acik, setAcik] = useState(false);
  const [mesaj, setMesaj] = useState('');
  const [durum, setDurum] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle');

  const kirpilmis = mesaj.trim();
  const gecerli = kirpilmis.length >= GERI_BILDIRIM_MIN && kirpilmis.length <= GERI_BILDIRIM_MAX;

  async function gonder() {
    setDurum('saving');
    const { error } = await gonderGeriBildirim(supabase, {
      sinifSeviyesi,
      mesaj: kirpilmis,
      userId: user?.id ?? null,
      ozet: {
        donem,
        belge,
        agirlikliOrtalama,
        dersler: dersler.map((d) => ({
          ad: d.dersAdi,
          haftalikSaat: d.haftalikSaat,
          yazili: [d.yazili1, d.yazili2, d.yazili3],
          performans: [d.performans1, d.performans2, d.performans3],
          katilim: [d.katilim1, d.katilim2, d.katilim3],
          proje: d.proje,
          donemNotu: donemNotu(d, kademe),
        })),
      },
    });
    if (error) {
      setDurum('error');
      return;
    }
    setMesaj('');
    setAcik(false);
    setDurum('sent');
  }

  if (durum === 'sent') {
    return (
      <p role="status" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        Bildirimin alındı, teşekkürler. Kontrol edip gerekirse düzelteceğiz.
      </p>
    );
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground hover:text-default"
      >
        <Flag className="h-4 w-4" aria-hidden="true" /> Sonuç yanlış görünüyor mu? Bildir
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (gecerli) void gonder();
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor={`${formId}-mesaj`} className="text-sm font-bold text-default">
        Neyin yanlış olduğunu yaz
      </label>
      <textarea
        id={`${formId}-mesaj`}
        value={mesaj}
        onChange={(e) => setMesaj(e.target.value)}
        maxLength={GERI_BILDIRIM_MAX}
        rows={4}
        placeholder="Örn: Türkçe 2. yazılı notum 90, ama hesaplama farklı bir ortalama gösteriyor."
        className={`rounded-xl px-3 py-2 text-sm ${r.item}`}
      />
      <p className="text-xs text-muted-foreground">
        {kirpilmis.length}/{GERI_BILDIRIM_MAX} — en az {GERI_BILDIRIM_MIN} karakter. Ad-soyad yazmana gerek yok; girdiğin notlar
        bildirimle birlikte gönderilir.
      </p>
      {durum === 'error' && (
        <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          Gönderilemedi, tekrar dener misin?
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!gecerli || durum === 'saving'}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60 ${r.btnNeon}`}
        >
          {durum === 'saving' ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        <button
          type="button"
          onClick={() => setAcik(false)}
          className={`rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground ${r.item}`}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function DersKarti({
  ders,
  kademe,
  barajAltinda,
  onGuncelle,
  onSil,
}: {
  ders: DersSatiri;
  kademe: OkulKademesi;
  barajAltinda: boolean;
  onGuncelle: (patch: Partial<DersSatiri>) => void;
  onSil: () => void;
}) {
  const ad = ders.dersAdi || 'Ders';
  const notu = donemNotu(ders, kademe);
  const katilimAdedi = katilimSayisi(ders.haftalikSaat);

  type NotAnahtari = 'yazili1' | 'yazili2' | 'yazili3' | 'performans1' | 'performans2' | 'performans3' | 'proje' | (typeof KATILIM_ANAHTARLARI)[number];
  const alanlar: { anahtar: NotAnahtari; kisa: string; uzun: string }[] = [
    { anahtar: 'yazili1', kisa: 'Y1', uzun: '1. yazılı' },
    { anahtar: 'yazili2', kisa: 'Y2', uzun: '2. yazılı' },
    ...(kademe === 'lise'
      ? [
          { anahtar: 'yazili3' as const, kisa: 'Y3', uzun: '3. yazılı (isteğe bağlı)' },
          { anahtar: 'performans1' as const, kisa: 'P1', uzun: 'Performans 1' },
          { anahtar: 'performans2' as const, kisa: 'P2', uzun: 'Performans 2' },
          { anahtar: 'performans3' as const, kisa: 'P3', uzun: 'Performans 3' },
        ]
      : KATILIM_ANAHTARLARI.slice(0, katilimAdedi).map((anahtar, i) => ({ anahtar, kisa: `S${i + 1}`, uzun: `Sözlü ${i + 1}` }))),
    { anahtar: 'proje', kisa: 'Pr', uzun: 'Proje (isteğe bağlı)' },
  ];

  return (
    <div className={`flex flex-col gap-2 rounded-xl p-2.5 xl:flex-row xl:items-end xl:gap-3 ${r.item}`}>
      <div className="flex min-w-0 items-center gap-1.5 xl:flex-1 xl:self-end">
        <input
          value={ders.dersAdi}
          onChange={(e) => onGuncelle({ dersAdi: e.target.value })}
          placeholder="Ders adı"
          aria-label="Ders adı"
          className={`h-9 min-w-0 flex-1 rounded-lg px-2.5 text-sm font-semibold ${r.item}`}
        />
        <span
          aria-label={`${ad} dönem notu`}
          className={`w-14 shrink-0 text-right text-base font-bold tabular-nums xl:hidden ${r.display} ${
            notu === null ? 'text-muted-foreground' : barajAltinda ? 'text-rose-600 dark:text-rose-400' : 'text-default'
          }`}
        >
          {notu === null ? '—' : notu.toFixed(kademe === 'ortaokul' ? 0 : 2)}
        </span>
        <button
          type="button"
          onClick={onSil}
          aria-label={`${ad} satırını sil`}
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600 xl:hidden dark:hover:bg-rose-500/10"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Mobilde kutular satırı eşit paylaşır; geniş ekranda sabit kutu + en kalabalık satıra göre sabit
          blok genişliği (ortaokul 7, lise 8 kutu), böylece satırlar alt alta hizalı. */}
      <div className={`grid flex-1 auto-cols-fr grid-flow-col gap-1 xl:flex-none xl:auto-cols-[2.75rem] ${kademe === 'lise' ? 'xl:w-[23.5rem]' : 'xl:w-[20.75rem]'}`}>
        <label className="flex min-w-0 flex-col items-center gap-0.5" title="Haftalık ders saati">
          <span className={`text-[10px] font-semibold leading-none ${r.mono} ${r.muted}`}>sa</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            value={ders.haftalikSaat}
            onChange={(e) => {
              const saat = haftalikSaatSinirla(e.target.value);
              if (saat !== null) onGuncelle({ haftalikSaat: saat });
            }}
            aria-label={`${ad} haftalık saat`}
            className={`h-9 w-full min-w-0 rounded-lg border-dashed px-0 text-center text-sm font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${r.item} ${r.muted}`}
          />
        </label>
        {alanlar.map(({ anahtar, kisa, uzun }) => (
          <NotAlani
            key={anahtar}
            label={kisa}
            value={ders[anahtar]}
            onChange={(v) => onGuncelle({ [anahtar]: v })}
            ariaLabel={`${ad} ${uzun}`}
          />
        ))}
      </div>

      {/* Geniş ekranda not + sil satırın sonunda (mobilde üst satırda). */}
      <div className="hidden shrink-0 items-center gap-1 xl:flex">
        <span
          aria-label={`${ad} dönem notu`}
          className={`w-16 text-right text-lg font-bold tabular-nums ${r.display} ${
            notu === null ? 'text-muted-foreground' : barajAltinda ? 'text-rose-600 dark:text-rose-400' : 'text-default'
          }`}
        >
          {notu === null ? '—' : notu.toFixed(kademe === 'ortaokul' ? 0 : 2)}
        </span>
        <button
          type="button"
          onClick={onSil}
          aria-label={`${ad} satırını sil`}
          className="flex h-9 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-default">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
