'use client';

// Üye profil kartı (2026-10-20). Veri yalnız get_public_profile RPC'sinden (public_profile_card.sql):
// görünen ad, fotoğraf, sınıf, seri, soru sayıları, üyelik ayı. Profil kapalıysa ya da yoksa RPC boş
// döner — ikisi aynı "gizli" mesajını gösterir (kapalı profilin varlığı sızmaz).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, EyeOff, Flame } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { AuthPrompt } from '@/app/src/components/AuthPrompt';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';

type PublicProfile = {
  display_name: string;
  avatar_url: string | null;
  grade_name: string | null;
  member_since: string | null;
  current_streak: number;
  weekly_questions: number;
  total_questions: number;
  is_public: boolean;
  is_me: boolean;
};

// Genel kimlik biçimi (public_profile_slug.sql): 12 karakter harf/rakam.
const SLUG = /^[A-Za-z0-9]{12}$/;

function memberSinceLabel(iso: string | null) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export default function UyeClient({ slug }: { slug: string }) {
  const { user, loading, supabase } = useAuth();
  // undefined = yükleniyor, null = gizli/yok
  const [card, setCard] = useState<PublicProfile | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    if (!SLUG.test(slug)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- geçersiz adres: istek atmadan "gizli"
      setCard(null);
      return;
    }
    let cancelled = false;
    supabase.rpc('get_public_profile', { p_slug: slug }).then(({ data, error }) => {
      if (cancelled) return;
      const row = !error && Array.isArray(data) ? (data[0] as PublicProfile | undefined) : undefined;
      setCard(row ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [user, supabase, slug]);

  const shell = (body: React.ReactNode) => (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Link href="/ilerlemem/siralama" className={`inline-flex w-fit items-center gap-1.5 text-sm font-bold hover:underline ${r.accent}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Haftalık sıralama
        </Link>
        {body}
      </main>
    </div>
  );

  if (loading || (user && card === undefined)) {
    return shell(<div aria-busy="true" aria-label="Profil yükleniyor" className={`h-72 animate-pulse rounded-[18px] ${r.panel}`} />);
  }
  if (!user) return shell(<AuthPrompt message="Üye profillerini görmek için giriş yap." />);
  if (!card) {
    return shell(
      <section className={`flex flex-col items-center gap-3 p-8 text-center ${r.panel}`}>
        <span className={`h-12 w-12 ${r.chipBox}`} aria-hidden="true"><EyeOff className="h-5 w-5" /></span>
        <h1 className={`text-xl font-bold uppercase text-default ${r.display}`}>Bu profil gizli</h1>
        <p className="text-sm text-muted-foreground">Bu üye profil kartını diğer üyelere açmamış.</p>
      </section>
    );
  }

  const initial = (card.display_name.trim()[0] || 'Ö').toLocaleUpperCase('tr-TR');
  const since = memberSinceLabel(card.member_since);
  const stats = [
    { label: 'Seri', value: `${card.current_streak} gün` },
    { label: 'Bu hafta', value: `${card.weekly_questions} soru` },
    { label: 'Toplam', value: `${card.total_questions} soru` },
  ];

  return shell(
    <>
      {card.is_me && (
        <p className={`rounded-xl border px-4 py-2.5 text-sm ${card.is_public ? `${r.neonBorder} ${r.tint}` : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
          {card.is_public
            ? 'Bu senin kartın.'
            : 'Profilin gizli, kartını yalnız sen görüyorsun.'}{' '}
          <Link href="/profil/ayarlar" className="font-semibold underline">Ayarlar</Link>
        </p>
      )}

      <section aria-labelledby="uye-ad" className={`flex flex-col items-center gap-5 p-7 text-center ${r.panel} ${r.hero}`}>
        <span className={r.scan} aria-hidden="true" />
        <div className={`grid h-28 w-28 place-items-center overflow-hidden p-[3px] ${r.brandChip} !rounded-full`}>
          {card.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className={`text-4xl ${r.statValue} ${r.accent}`}>{initial}</span>
          )}
        </div>
        <div>
          <h1 id="uye-ad" className={`text-3xl leading-tight ${r.chrome}`}>{card.display_name}</h1>
          <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Özet">
            {card.grade_name && <li className={r.badge}>{card.grade_name}</li>}
            {since && <li className={r.badge}>{since} üyesi</li>}
          </ul>
        </div>
      </section>

      <dl className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`flex flex-col gap-1 px-4 py-3 text-center ${r.stat}`}>
            <dt className={r.label}>{s.label}</dt>
            <dd className={`flex items-center justify-center gap-1 text-lg ${r.statValue}`}>
              {s.label === 'Seri' && <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />}
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
