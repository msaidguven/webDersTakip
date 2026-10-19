'use client';

// Takdir/Teşekkür belgesi hesaplama aracı (herkese açık sayfanın etkileşimli kısmı).
// Hesaplama herkes için anında çalışır; giriş yapan kullanıcının girdiği dersler/puanlar
// isterse kaydedilir (bkz. takdirTesekkurStorage.ts, save_takdir_tesekkur_calculation RPC'si).
// Dersler burada SERBEST METİN — lessons tablosuna dokunulmaz, Resim/Beden/Müzik/seçmeli
// dersler de aynı şekilde eklenebilir.
import { useEffect, useId, useState } from 'react';
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

function NotAlani({
  label,
  value,
  onChange,
  ariaLabel,
  vurgulu,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  ariaLabel: string;
  vurgulu?: boolean;
}) {
  return (
    <label className="flex w-[4.5rem] flex-col gap-0.5 text-[11px] font-bold text-muted-foreground">
      {label}
      <input
        type="number"
        min={0}
        max={100}
        value={value ?? ''}
        onChange={(e) => onChange(sayiYaDaBos(e.target.value))}
        aria-label={ariaLabel}
        className={`rounded-xl border bg-background px-2 py-2 text-sm font-bold text-default ${vurgulu ? 'border-indigo-400' : 'border-default'}`}
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
    <section aria-labelledby="hesaplama-baslik" className="flex flex-col gap-6">
      <h2 id="hesaplama-baslik" className="text-2xl font-black tracking-tight text-default sm:text-3xl">
        Notlarını gir
      </h2>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-bold text-default">
          Sınıf
          <select
            value={sinifSeviyesi}
            onChange={(e) => setSinifSeviyesi(Number(e.target.value))}
            className="rounded-xl border border-default bg-background px-3 py-2 font-medium"
          >
            {SINIF_SEVIYELERI.map((s) => (
              <option key={s} value={s}>
                {s}. Sınıf
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-default">
          Dönem
          <select
            value={donem}
            onChange={(e) => setDonem(Number(e.target.value) as 1 | 2)}
            className="rounded-xl border border-default bg-background px-3 py-2 font-medium"
          >
            <option value={1}>1. Dönem</option>
            <option value={2}>2. Dönem</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-default bg-background p-5 sm:p-6">
        <label className="flex flex-col gap-1 text-sm font-bold text-default sm:max-w-sm">
          Haftada toplam kaç saat dersin var? (Rehberlik hariç)
          <input
            type="number"
            min={1}
            max={60}
            value={toplamSaatHedefi}
            onChange={(e) => {
              const saat = haftalikSaatSinirla(e.target.value);
              if (saat !== null) setToplamSaatHedefi(saat);
            }}
            className="rounded-xl border border-default bg-background px-3 py-2 font-medium"
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Bu, bir <strong className="text-default">sağlama</strong>: aşağıya girdiğin derslerin haftalık saatleri toplamı bu
          sayıyla eşleşmeli. Resmi çizelgede {kademe === 'ortaokul' ? '5-8. sınıflarda bu sayı her sınıfta 34 saattir' : '9-12. sınıflarda bu sayı her sınıfta 39 saattir'}{' '}
          (Rehberlik ve Yönlendirme dersi 1 saat ayrıca var ama notla değerlendirilmediği için bu hesaba ve ağırlıklı ortalamaya
          dahil edilmez). Okulunda farklıysa bu sayıyı değiştirebilirsin.
        </p>
        {saglamaUyusmuyor && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Girdiğin derslerin toplam haftalık saati {girilenToplamSaat}, hedefin {toplamSaatHedefi}. Fark: {Math.abs(girilenToplamSaat - toplamSaatHedefi)}{' '}
            saat — bir dersin haftalık saatini kontrol et ki ortalama doğru çıksın.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-default bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-extrabold text-default">Dersler ve dönem notları</h3>
          <p className="text-sm text-muted-foreground">
            Sınıfını seçtiğinde resmi haftalık ders çizelgesindeki dersler ve saatleri otomatik dolar — kendi karnene göre
            düzenleyebilir, sistemde olmayan Resim, Beden Eğitimi, Müzik ve seçmeli dersleri de ekleyebilirsin.{' '}
            {kademe === 'ortaokul'
              ? 'Her dersten dönemde 2 yazılı sınav yapılır; ayrıca haftalık ders saati 2 ve altı olan derslerde 2, 2’den fazla olanlarda 3 tane "ders etkinliklerine katılım" puanı (halk arasında bilinen adıyla sözlü notu) verilir — bu, yazılılarla birlikte dönem notunu belirler. Dersten varsa bir de proje puanın olabilir.'
              : 'Her dersten dönemde 2 yazılı sınav yapılır; haftalık ders saati 6 ve üzeri olan derste zümre kararıyla 3. yazılı da yapılabilir.'}
          </p>
        </div>

        {dersler.length > 0 && (
          <div className="flex flex-col gap-3">
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
                className="inline-flex items-center gap-1 rounded-full border border-default bg-surface-elevated px-3 py-1.5 text-xs font-bold text-muted-foreground hover:border-indigo-400 hover:text-default"
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
            placeholder="Başka bir ders adı yaz (ör. Satranç, Seçmeli Yabancı Dil…)"
            className="flex-1 rounded-xl border border-default bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!ozelDersAdi.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-default bg-surface-elevated px-4 py-2 text-sm font-bold text-default hover:border-indigo-400 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Ekle
          </button>
        </form>
      </div>

      {kademe === 'lise' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-default bg-background p-5 sm:p-6">
          <h3 className="text-lg font-extrabold text-default">Diğer şartlar</h3>
          <Toggle
            label="Davranış puanım 100"
            checked={davranisPuaniTam}
            onChange={setDavranisPuaniTam}
          />
          <Toggle
            label="Tüm derslerden başarılıyım (sınıfımı geçtim)"
            checked={tumDerslerdenBasarili}
            onChange={setTumDerslerdenBasarili}
          />
        </div>
      )}

      <div role="status" className={`flex flex-col gap-1 rounded-2xl border p-5 sm:p-6 ${belgeStil[sonuc.belge]}`}>
        <p className="text-sm font-bold uppercase tracking-wide opacity-80">Ağırlıklı ortalama: {sonuc.agirlikliOrtalama.toFixed(2)}</p>
        <p className="text-2xl font-black">{belgeBaslik[sonuc.belge]}</p>
        <p className="text-sm leading-relaxed">{sonuc.mesaj}</p>
        {notGirilenDersSayisi > 0 && notGirilenDersSayisi < dersler.length && (
          <p className="text-sm leading-relaxed opacity-80">
            {dersler.length - notGirilenDersSayisi}/{dersler.length} ders için not girildi — kalanları da girince ortalama değişir.
          </p>
        )}
      </div>

      <GeriBildirimFormu
        sinifSeviyesi={sinifSeviyesi}
        donem={donem}
        kademe={kademe}
        dersler={dersler}
        belge={sonuc.belge}
        agirlikliOrtalama={sonuc.agirlikliOrtalama}
      />

      {user ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={kaydet}
            disabled={kayitDurumu === 'saving' || dersler.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-60"
          >
            {kayitDurumu === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          {kayitDurumu === 'saved' && <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Kaydedildi.</p>}
          {kayitDurumu === 'error' && <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">Kaydedilemedi, tekrar dener misin?</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Notlarını kaydetmek için{' '}
          <Link href="/login?redirectTo=/takdir-tesekkur-hesaplama" className="font-semibold text-indigo-700 underline dark:text-indigo-300">
            giriş yap
          </Link>
          .
        </p>
      )}
    </section>
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
      className="flex flex-col gap-3 rounded-2xl border border-default bg-background p-5 sm:p-6"
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
        className="rounded-xl border border-default bg-background px-3 py-2 text-sm"
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
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {durum === 'saving' ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        <button
          type="button"
          onClick={() => setAcik(false)}
          className="rounded-xl border border-default px-4 py-2.5 text-sm font-bold text-muted-foreground hover:text-default"
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

  const notAlani = (anahtar: 'yazili1' | 'yazili2' | 'yazili3' | 'performans1' | 'performans2' | 'performans3' | 'proje', etiket: string) => (
    <NotAlani
      label={etiket}
      value={ders[anahtar]}
      onChange={(v) => onGuncelle({ [anahtar]: v })}
      ariaLabel={`${ad} ${etiket}`}
    />
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default bg-background p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={ders.dersAdi}
            onChange={(e) => onGuncelle({ dersAdi: e.target.value })}
            placeholder="Ders adı"
            className="flex-1 rounded-xl border border-default bg-background px-3 py-2 text-sm font-semibold"
          />
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            Haftalık saat
            <input
              type="number"
              min={1}
              max={40}
              value={ders.haftalikSaat}
              onChange={(e) => {
                const saat = haftalikSaatSinirla(e.target.value);
                if (saat !== null) onGuncelle({ haftalikSaat: saat });
              }}
              aria-label={`${ad} haftalık saat`}
              className="w-20 rounded-xl border border-default bg-background px-2 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onSil}
          aria-label={`${ad} satırını sil`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {notAlani('yazili1', '1. yazılı')}
        {notAlani('yazili2', '2. yazılı')}
        {kademe === 'lise' && notAlani('yazili3', '3. yazılı (ops.)')}
        {kademe === 'lise' && notAlani('performans1', 'Performans 1')}
        {kademe === 'lise' && notAlani('performans2', 'Performans 2')}
        {kademe === 'lise' && notAlani('performans3', 'Performans 3')}
        {kademe === 'ortaokul' &&
          KATILIM_ANAHTARLARI.slice(0, katilimAdedi).map((anahtar, i) => (
            <NotAlani
              key={anahtar}
              label={`${i + 1}. katılım (sözlü)`}
              value={ders[anahtar]}
              onChange={(v) => onGuncelle({ [anahtar]: v })}
              ariaLabel={`${ad} ${i + 1}. katılım (sözlü)`}
            />
          ))}
        {notAlani('proje', 'Proje (ops.)')}
        <div className="ml-auto flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-bold text-muted-foreground">Dönem notu</span>
          <span
            className={`min-w-[4.5rem] rounded-xl px-3 py-2 text-center text-sm font-extrabold ${
              notu === null ? 'text-muted-foreground' : barajAltinda ? 'text-rose-600 dark:text-rose-400' : 'text-default'
            }`}
          >
            {notu === null ? '—' : notu.toFixed(kademe === 'ortaokul' ? 0 : 2)}
          </span>
        </div>
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
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
