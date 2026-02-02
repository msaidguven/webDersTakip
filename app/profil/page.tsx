'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo } from 'react';

const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
};

interface UserStats {
  totalTests: number;
  totalQuestions: number;
  correctAnswers: number;
  averageScore: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalTests: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    averageScore: 0,
  });

  const supabase = useMemo(() => createSupabaseClient(), []);

  useEffect(() => {
    const getUserData = async () => {
      if (!supabase) {
        setError('Veritabanı yapılandırması eksik. Lütfen .env.local dosyasını kontrol edin.');
        setLoading(false);
        return;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
        return;
      }

      setUser(user);
      
      // Burada normalde 'test_results' veya 'question_usages' tablosundan
      // kullanıcının istatistiklerini çekmemiz gerekir.
      // Şimdilik örnek veri (mock data) ile gösteriyorum:
      setStats({
        totalTests: 12,
        totalQuestions: 150,
        correctAnswers: 120,
        averageScore: 80,
      });

      setLoading(false);
    };

    getUserData();
  }, [router, supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-default mb-4">Yapılandırma Hatası</h1>
          <p className="text-muted mb-6">{error}</p>
          <Link href="/" className="px-6 py-3 rounded-xl bg-indigo-500 text-default">
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] pb-20">
      {/* Header */}
      <header className="h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-default flex items-center px-4 sm:px-8 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-muted hover:text-default transition-colors">
          <span>←</span>
          <span>Ana Sayfa</span>
        </Link>
        <h1 className="ml-4 text-xl font-bold text-default">Profilim</h1>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        
        {/* Kullanıcı Kartı */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-default shadow-lg shadow-indigo-500/20">
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-2xl font-bold text-default mb-1">
              {user?.user_metadata?.full_name || 'Öğrenci'}
            </h2>
            <p className="text-muted mb-4">{user?.email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm border border-indigo-500/20">
                8. Sınıf
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20">
                Aktif Üye
              </span>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-muted hover:bg-red-500/10 hover:text-red-400 transition-all border border-default hover:border-red-500/20"
          >
            Çıkış Yap
          </button>
        </div>

        {/* İstatistikler Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface-elevated border border-default rounded-2xl p-4 text-center hover:bg-zinc-800/50 transition-colors">
            <div className="text-3xl mb-2">📝</div>
            <div className="text-2xl font-bold text-default mb-1">{stats.totalTests}</div>
            <div className="text-xs text-muted">Tamamlanan Test</div>
          </div>
          <div className="bg-surface-elevated border border-default rounded-2xl p-4 text-center hover:bg-zinc-800/50 transition-colors">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-2xl font-bold text-default mb-1">{stats.totalQuestions}</div>
            <div className="text-xs text-muted">Çözülen Soru</div>
          </div>
          <div className="bg-surface-elevated border border-default rounded-2xl p-4 text-center hover:bg-zinc-800/50 transition-colors">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">{stats.correctAnswers}</div>
            <div className="text-xs text-muted">Doğru Cevap</div>
          </div>
          <div className="bg-surface-elevated border border-default rounded-2xl p-4 text-center hover:bg-zinc-800/50 transition-colors">
            <div className="text-3xl mb-2">🏆</div>
            <div className="text-2xl font-bold text-amber-400 mb-1">%{stats.averageScore}</div>
            <div className="text-xs text-muted">Başarı Oranı</div>
          </div>
        </div>

        {/* Ders İlerlemeleri (Örnek) */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <h3 className="text-lg font-bold text-default mb-6 flex items-center gap-2">
            <span>📊</span> Ders İlerlemeleri
          </h3>
          <div className="space-y-6">
            {[
              { name: 'Matematik', progress: 75, color: 'from-blue-500 to-indigo-500', icon: '🔢' },
              { name: 'Fen Bilimleri', progress: 60, color: 'from-emerald-500 to-teal-500', icon: '🔬' },
              { name: 'Türkçe', progress: 85, color: 'from-rose-500 to-pink-500', icon: '📝' },
            ].map((lesson) => (
              <div key={lesson.name}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-default flex items-center gap-2">
                    <span>{lesson.icon}</span> {lesson.name}
                  </span>
                  <span className="text-muted">%{lesson.progress}</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${lesson.color}`} 
                    style={{ width: `${lesson.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Son Aktiviteler */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <h3 className="text-lg font-bold text-default mb-4 flex items-center gap-2">
            <span>🕒</span> Son Aktiviteler
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/30 border border-default">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xl">
                  📝
                </div>
                <div>
                  <h4 className="text-default font-medium">Haftalık Test {19 - i}</h4>
                  <p className="text-xs text-muted">Matematik • 2 gün önce</p>
                </div>
                <div className="ml-auto text-emerald-400 font-bold text-sm">
                  85 Puan
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}