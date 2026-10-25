'use client';

// Profil → Ayarlar (2026-10-20): profil sayfasından ayrılan tercihler. Solda menü (dar ekranda üstte
// sekmeler): Hesap, Okul, Bildirimler ve hedef. Seçili bölüm ?bolum= ile URL'de — doğrudan bağlantı
// verilebilir (ör. anasayfadaki hatırlatma kartı → ?bolum=bildirimler) ve geri tuşu çalışır.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, ChevronLeft, School, UserRound, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { AuthPrompt } from '@/app/src/components/AuthPrompt';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';
import { PersonalInfoCard, SchoolInfoCard } from '../AccountCards';
import { SettingsCard } from '../SettingsCard';
import { PublicProfileToggle } from '../PublicProfileToggle';
import type { ProfileRow } from '../ProfilClient';

type SectionId = 'hesap' | 'okul' | 'bildirimler';
const SECTIONS: { id: SectionId; label: string; hint: string; Icon: LucideIcon }[] = [
  { id: 'hesap', label: 'Hesap', hint: 'Profil kartı, ad, kullanıcı adı', Icon: UserRound },
  { id: 'okul', label: 'Okul', hint: 'Sınıf, il, ilçe, okul', Icon: School },
  { id: 'bildirimler', label: 'Bildirimler ve hedef', hint: 'Hatırlatma, günlük soru hedefi', Icon: Bell },
];
const isSection = (v: string | null): v is SectionId => SECTIONS.some((x) => x.id === v);

export default function AyarlarClient() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params?.get('bolum') ?? null;
  const active: SectionId = isSection(raw) ? raw : 'hesap';
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch('/api/profile/update')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile: ProfileRow | null } | null) => {
        if (!cancelled) setProfile(data?.profile ?? null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const select = (id: SectionId) => router.replace(`/profil/ayarlar?bolum=${id}`, { scroll: false });

  const shell = (body: React.ReactNode) => (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Link href="/profil" className={`inline-flex w-fit items-center gap-1 text-sm font-bold hover:underline ${r.accent}`}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Profilim
        </Link>
        <h1 className={`text-3xl font-bold uppercase text-default sm:text-4xl ${r.display}`}>Ayarlar</h1>
        {body}
      </main>
    </div>
  );

  if (loading) return shell(<div aria-busy="true" aria-label="Ayarlar yükleniyor" className={`h-64 animate-pulse rounded-[18px] ${r.panel}`} />);
  if (!user) return shell(<AuthPrompt message="Ayarlarını görmek için giriş yap." />);

  return shell(
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Ayar bölümleri" className={`p-2 lg:!sticky lg:top-24 ${r.panel}`}>
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col">
          {SECTIONS.map(({ id, label, hint, Icon }) => {
            const on = id === active;
            return (
              <li key={id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => select(id)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? `${r.neonBorder} ${r.tint}` : 'border-transparent hover:bg-[color-mix(in_srgb,var(--neon)_8%,transparent)]'}`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${on ? r.accent : 'text-muted-foreground'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className={`block whitespace-nowrap text-sm font-semibold ${on ? r.accent : 'text-default'}`}>{label}</span>
                    <span className="hidden text-xs text-muted-foreground lg:block">{hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-label={SECTIONS.find((x) => x.id === active)?.label} className="min-w-0">
        {active === 'bildirimler' ? (
          <SettingsCard isStudent={profile?.role !== 'teacher'} />
        ) : profile === undefined ? (
          <div aria-busy="true" aria-label="Bilgiler yükleniyor" className={`h-64 animate-pulse rounded-[18px] ${r.panel}`} />
        ) : active === 'hesap' ? (
          <div className="flex flex-col gap-6">
          {profile && (
            <PublicProfileToggle
              slug={profile.public_slug ?? null}
              initialOn={profile.public_profile === true}
              onChange={(on) => setProfile((p) => (p ? { ...p, public_profile: on } : p))}
            />
          )}
          <PersonalInfoCard
            initialFullName={profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? ''}
            initialUsername={profile?.username ?? null}
            initialNickname={profile?.nickname ?? null}
            initialUseNickname={profile?.use_nickname ?? false}
            onSaved={(name, uname, nickname, useNickname) =>
              setProfile((p) => (p ? { ...p, full_name: name, username: uname, nickname, use_nickname: useNickname } : p))
            }
          />
          </div>
        ) : (
          <SchoolInfoCard initialProfile={profile} />
        )}
      </section>
    </div>
  );
}
