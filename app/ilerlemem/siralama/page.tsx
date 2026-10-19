'use client';

// Haftalık sıralama (İlerlemem'in alt sayfası). Görünüm: robotik tema (2026-10-19, İlerlemem ile aynı).
import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { LeaderboardCard } from '../../src/components/LeaderboardCard';
import { useMyProfileBasics } from '../../src/hooks/useMyGradeSlug';
import { roboticFontVars } from '../../src/components/robotic/fonts';
import r from '../../src/components/robotic/robotic.module.css';

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const profile = useMyProfileBasics();
  const meta = [profile?.gradeName, profile?.fullName].filter(Boolean).join(' · ');

  return (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        <Link href="/ilerlemem" className={`inline-flex w-fit items-center gap-1.5 text-sm font-bold hover:underline ${r.accent}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> İlerlemem
        </Link>

        <header className={`flex flex-col gap-2 p-5 sm:p-7 ${r.panel} ${r.hero}`}>
          <span className={r.scan} aria-hidden="true" />
          <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}>
            <i className={r.led} aria-hidden="true" />
            {user && meta ? meta : 'Canlı sıralama'}
          </span>
          <h1 className={`text-3xl leading-tight sm:text-5xl ${r.chrome}`}>Haftalık sıralama</h1>
          <p className="text-sm text-muted-foreground">Bu hafta en çok soru çözen ilk 20 öğrenci (tüm sınıflar). Her pazartesi sıfırlanır.</p>
        </header>

        {authLoading ? (
          <div className={`h-56 animate-pulse rounded-[18px] ${r.panel}`} />
        ) : !user ? (
          <AuthPrompt message="Sıralamanı görmek için giriş yap." />
        ) : (
          <LeaderboardCard limit={20} showSeeAll={false} />
        )}
      </main>
    </div>
  );
}
