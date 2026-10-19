'use client';

// Haftalık sıralama (İlerlemem'in alt sayfası). Yeni İlerlemem ile aynı kabuk; eski PanelShell kaldırıldı.
import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { LeaderboardCard } from '../../src/components/LeaderboardCard';
import { useMyProfileBasics } from '../../src/hooks/useMyGradeSlug';

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const profile = useMyProfileBasics();
  const meta = [profile?.gradeName, profile?.fullName].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        <Link href="/ilerlemem" className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-default">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> İlerlemem
        </Link>

        <header className="flex flex-col gap-1">
          {user && meta && <p className="text-sm font-bold text-muted-foreground">{meta}</p>}
          <h1 className="text-3xl font-black tracking-tight text-default sm:text-5xl">Haftalık sıralama</h1>
          <p className="text-sm text-muted-foreground">Bu hafta en çok soru çözen ilk 20 öğrenci (tüm sınıflar). Her pazartesi sıfırlanır.</p>
        </header>

        {authLoading ? (
          <div className="h-56 animate-pulse rounded-2xl bg-surface-elevated" />
        ) : !user ? (
          <AuthPrompt message="Sıralamanı görmek için giriş yap." />
        ) : (
          <LeaderboardCard limit={20} showSeeAll={false} />
        )}
      </main>
    </div>
  );
}
