'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../src/lib/supabaseClient';

interface UserStats {
  totalTests: number;
  totalQuestions: number;
  correctAnswers: number;
  averageScore: number;
  // Golden Triangle Metrikleri
  accuracy: number; // Doğruluk oranı
  coverage: number; // Müfredat kapsama oranı
  mastery: number; // Ustalık oranı
  streakDays: number; // Ard arda çalışma günü
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalTests: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    averageScore: 0,
    accuracy: 0,
    coverage: 0,
    mastery: 0,
    streakDays: 0,
  });

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.replace('/login');
    }
  }, [authUser, authLoading, router]);

  useEffect(() => {
    const getUserData = async () => {
      if (!supabase) {
        setError('Veritabanı yapılandırması eksik.');
        setLoading(false);
        return;
      }

      try {
        const { data: { user: fetchedUser }, error } = await supabase.auth.getUser();

        if (error || !fetchedUser) {
          setError('Kullanıcı bilgileri alınamadı.');
          setLoading(false);
          return;
        }

        setUser(fetchedUser);

        // Gerçek veriler burada çekilecek (şimdilik mock)
        setStats({
          totalTests: 15,
          totalQuestions: 230,
          correctAnswers: 195,
          averageScore: 85,
          accuracy: 83, // %83 doğruluk
          coverage: 65, // %65 müfredat tamamlama
          mastery: 42,  // %42 ustalık
          streakDays: 7, // 7 gün streak
        });
      } catch (e: any) {
        setError(e?.message || 'Bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    getUserData();
  }, [supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] pb-20">
      {/* Header */}
      <header className="h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5 flex items-center px-4 sm:px-8 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <span>←</span>
          <span>Ana Sayfa</span>
        </Link>
        <h1 className="ml-4 text-xl font-bold text-white">Profilim</h1>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Golden Triangle Metrikleri */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <GoldenMetricCard 
            title="Accuracy" 
            value={stats.accuracy} 
            label="Doğruluk"
            color="from-emerald-500 to-teal-500"
            icon="🎯"
          />
          <GoldenMetricCard 
            title="Coverage" 
            value={stats.coverage} 
            label="Kapsama"
            color="from-blue-500 to-indigo-500"
            icon="📊"
          />
          <GoldenMetricCard 
            title="Mastery" 
            value={stats.mastery} 
            label="Ustalık"
            color="from-purple-500 to-pink-500"
            icon="👑"
          />
        </div>

        {/* Kullanıcı Kartı */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-indigo-500/20">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              {/* Streak Badge */}
              {stats.streakDays > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  🔥 {stats.streakDays}
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-white mb-1">
                {user?.user_metadata?.full_name || 'Öğrenci'}
              </h2>
              <p className="text-zinc-400 mb-3">{user?.email}</p>
              
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <Badge text="8. Sınıf" color="indigo" />
                <Badge text="Aktif Üye" color="emerald" />
                {stats.streakDays >= 7 && <Badge text="Streak King 🔥" color="amber" />}
              </div>
            </div>

            <button 
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/5"
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        {/* Genel İstatistikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon="📝" value={stats.totalTests} label="Test" />
          <StatCard icon="🎯" value={stats.totalQuestions} label="Soru" />
          <StatCard icon="✅" value={stats.correctAnswers} label="Doğru" color="text-emerald-400" />
          <StatCard icon="🏆" value={`%${stats.averageScore}`} label="Başarı" color="text-amber-400" />
        </div>

        {/* Ders İlerlemesi */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span>📚</span> Ders İlerlemesi
          </h3>
          <div className="space-y-5">
            {[
              { name: 'Matematik', progress: 75, total: 120, solved: 90, color: 'bg-blue-500' },
              { name: 'Fen Bilimleri', progress: 60, total: 80, solved: 48, color: 'bg-emerald-500' },
              { name: 'Türkçe', progress: 85, total: 100, solved: 85, color: 'bg-rose-500' },
            ].map((lesson) => (
              <div key={lesson.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium flex items-center gap-2">
                    {lesson.name}
                    <span className="text-zinc-500 text-xs">
                      ({lesson.solved}/{lesson.total} soru)
                    </span>
                  </span>
                  <span className="text-zinc-400 text-sm">%{lesson.progress}</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${lesson.color} rounded-full transition-all`} 
                    style={{ width: `${lesson.progress}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rozetler / Başarımlar */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🏅</span> Rozetlerim
          </h3>
          <div className="flex flex-wrap gap-3">
            <Rozet emoji="🔥" name="7 Gün Streak" description="Ard arda 7 gün çalıştın" />
            <Rozet emoji="🎯" name="İsabetli" description="%80+ doğruluk oranı" />
            <Rozet emoji="📚" name="Çalışkan" description="100+ soru çözdün" />
            <Rozet emoji="🏆" name="Başarılı" description="İlk testini tamamladın" locked />
            <Rozet emoji="👑" name="Usta" description="10 konuda ustalık kazandın" locked />
          </div>
        </div>

        {/* Son Aktiviteler */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🕒</span> Son Aktiviteler
          </h3>
          <div className="space-y-3">
            {[
              { test: 'Haftalık Test 19', subject: 'Matematik', score: 85, date: '2 gün önce' },
              { test: 'Haftalık Test 18', subject: 'Fen Bilimleri', score: 92, date: '4 gün önce' },
              { test: 'Haftalık Test 17', subject: 'Matematik', score: 78, date: '1 hafta önce' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/30 border border-white/5 hover:bg-zinc-800/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xl">📝</div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">{activity.test}</h4>
                  <p className="text-xs text-zinc-500">{activity.subject} • {activity.date}</p>
                </div>
                <div className={`font-bold text-sm ${
                  activity.score >= 90 ? 'text-emerald-400' : 
                  activity.score >= 70 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {activity.score} Puan
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// Golden Triangle Metric Card
function GoldenMetricCard({ title, value, label, color, icon }: any) {
  return (
    <div className={`relative overflow-hidden bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-center group hover:border-white/10 transition-all`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-5 group-hover:opacity-10 transition-opacity`} />
      <div className="relative">
        <div className="text-2xl mb-1">{icon}</div>
        <div className={`text-3xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
          %{value}
        </div>
        <div className="text-white font-medium text-sm mt-1">{title}</div>
        <div className="text-zinc-500 text-xs">{label}</div>
      </div>
    </div>
  );
}

// Badge Component
function Badge({ text, color }: { text: string; color: 'indigo' | 'emerald' | 'amber' | 'rose' }) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm border ${colors[color]}`}>
      {text}
    </span>
  );
}

// Stat Card
function StatCard({ icon, value, label, color = 'text-white' }: any) {
  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-center hover:bg-zinc-800/50 transition-colors">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

// Rozet Component
function Rozet({ emoji, name, description, locked }: any) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      locked 
        ? 'bg-zinc-900/30 border-white/5 opacity-50' 
        : 'bg-zinc-900/50 border-white/10 hover:bg-zinc-800/50'
    } transition-colors`}>
      <div className="text-2xl">{locked ? '🔒' : emoji}</div>
      <div>
        <div className="text-white font-medium text-sm">{name}</div>
        <div className="text-zinc-500 text-xs">{locked ? 'Kilitli' : description}</div>
      </div>
    </div>
  );
}
