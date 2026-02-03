'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../src/lib/supabaseClient';

interface UserStats {
  totalTests: number;
  totalQuestions: number;
  correctAnswers: number;
  averageScore: number;
  accuracy: number;
  coverage: number;
  mastery: number;
  streakDays: number;
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalTests: 15,
    totalQuestions: 230,
    correctAnswers: 195,
    averageScore: 85,
    accuracy: 83,
    coverage: 65,
    mastery: 42,
    streakDays: 7,
  });

  // Şifre değiştirme state'leri
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Avatar upload state'leri
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createSupabaseBrowserClient();

  // Auth kontrolü - giriş yapmamışsa login'e yönlendir
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.replace('/login?redirectTo=/profil');
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
        setAvatarUrl(fetchedUser.user_metadata?.avatar_url || null);
      } catch (e: any) {
        setError(e?.message || 'Bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    if (authUser) {
      getUserData();
    }
  }, [supabase, authUser]);

  // Şifre değiştirme
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordError(err.message || 'Şifre değiştirme başarısız.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Avatar yükleme
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Dosya kontrolü
    if (file.size > 2 * 1024 * 1024) {
      alert('Dosya boyutu 2MB\'dan küçük olmalıdır.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Sadece resim dosyaları yüklenebilir.');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Storage'a yükle
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Public URL al
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // Kullanıcı metadata'sını güncelle
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      alert('Fotoğraf yüklenirken hata: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-default flex items-center justify-center pt-[72px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-default pb-20">
      {/* Page Header */}
      <div className="pt-[72px] pb-6 px-4 sm:px-8 border-b border-default bg-gradient-to-b from-surface to-default">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-muted hover:text-default transition-colors"
            >
              <span className="text-lg">←</span>
              <span className="hidden sm:inline">Ana Sayfa</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-default">Profilim</h1>
          </div>
        </div>
      </div>

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

        {/* Kullanıcı Kartı + Profil Fotoğrafı */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-indigo-500/20">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.email?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              
              {/* Fotoğraf değiştirme overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <span className="text-white text-2xl">📷</span>
              </button>
              
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              
              {stats.streakDays > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                  🔥 {stats.streakDays}
                </div>
              )}
            </div>

            {/* Kullanıcı Bilgileri */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-default mb-1">
                {user?.user_metadata?.full_name || 'Öğrenci'}
              </h2>
              <p className="text-muted mb-3">{user?.email}</p>
              
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <Badge text="8. Sınıf" color="indigo" />
                <Badge text="Aktif Üye" color="emerald" />
                {stats.streakDays >= 7 && <Badge text="Streak King 🔥" color="amber" />}
              </div>
            </div>

            {/* Çıkış Butonu */}
            <button 
              onClick={handleSignOut}
              className="px-5 py-2.5 rounded-xl bg-surface border border-default text-muted hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        {/* Genel İstatistikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon="📝" value={stats.totalTests} label="Test" />
          <StatCard icon="❓" value={stats.totalQuestions} label="Soru" />
          <StatCard icon="✅" value={stats.correctAnswers} label="Doğru" color="text-emerald-400" />
          <StatCard icon="🏆" value={`%${stats.averageScore}`} label="Başarı" color="text-amber-400" />
        </div>

        {/* Şifre Değiştirme */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <h3 className="text-lg font-bold text-default mb-6 flex items-center gap-2">
            <span>🔐</span> Şifre Değiştir
          </h3>

          {passwordError && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              ✅ Şifreniz başarıyla değiştirildi!
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-muted mb-2">Yeni Şifre</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-default text-default placeholder-muted focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Yeni Şifre (Tekrar)</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-default text-default placeholder-muted focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordLoading ? 'Güncelleniyor...' : 'Şifreyi Değiştir'}
            </button>
          </form>
        </div>

        {/* Ders İlerlemesi */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <h3 className="text-lg font-bold text-default mb-6 flex items-center gap-2">
            <span>📚</span> Ders İlerlemesi
          </h3>
          <div className="space-y-5">
            {[
              { name: 'Matematik', progress: 75, total: 120, solved: 90, color: 'from-blue-500 to-indigo-500' },
              { name: 'Fen Bilimleri', progress: 60, total: 80, solved: 48, color: 'from-emerald-500 to-teal-500' },
              { name: 'Türkçe', progress: 85, total: 100, solved: 85, color: 'from-rose-500 to-pink-500' },
            ].map((lesson) => (
              <div key={lesson.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-default font-medium flex items-center gap-2">
                    {lesson.name}
                    <span className="text-muted text-xs">
                      ({lesson.solved}/{lesson.total} soru)
                    </span>
                  </span>
                  <span className="text-muted text-sm font-medium">%{lesson.progress}</span>
                </div>
                <div className="h-3 bg-surface rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${lesson.color} rounded-full transition-all duration-500`} 
                    style={{ width: `${lesson.progress}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rozetler */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <h3 className="text-lg font-bold text-default mb-4 flex items-center gap-2">
            <span>🏅</span> Rozetlerim
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Rozet emoji="🔥" name="7 Gün Streak" description="Ard arda 7 gün çalıştın" />
            <Rozet emoji="🎯" name="İsabetli" description="%80+ doğruluk oranı" />
            <Rozet emoji="📚" name="Çalışkan" description="100+ soru çözdün" />
            <Rozet emoji="🏆" name="Başarılı" description="İlk testini tamamladın" locked />
            <Rozet emoji="👑" name="Usta" description="10 konuda ustalık kazandın" locked />
          </div>
        </div>

        {/* Son Aktiviteler */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <h3 className="text-lg font-bold text-default mb-4 flex items-center gap-2">
            <span>🕒</span> Son Aktiviteler
          </h3>
          <div className="space-y-3">
            {[
              { test: 'Haftalık Test 19', subject: 'Matematik', score: 85, date: '2 gün önce' },
              { test: 'Haftalık Test 18', subject: 'Fen Bilimleri', score: 92, date: '4 gün önce' },
              { test: 'Haftalık Test 17', subject: 'Matematik', score: 78, date: '1 hafta önce' },
            ].map((activity, i) => (
              <div 
                key={i} 
                className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-default hover:border-indigo-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-default flex items-center justify-center text-2xl">
                  📝
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-default font-medium truncate">{activity.test}</h4>
                  <p className="text-xs text-muted">{activity.subject} • {activity.date}</p>
                </div>
                <div className={`font-bold ${
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
function GoldenMetricCard({ title, value, label, color, icon }: { 
  title: string; 
  value: number; 
  label: string; 
  color: string; 
  icon: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-surface-elevated border border-default rounded-2xl p-4 text-center group hover:border-indigo-500/30 transition-all`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-5 group-hover:opacity-10 transition-opacity`} />
      <div className="relative">
        <div className="text-2xl mb-2">{icon}</div>
        <div className={`text-3xl font-black bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
          %{value}
        </div>
        <div className="text-default font-bold text-sm mt-1">{title}</div>
        <div className="text-muted text-xs">{label}</div>
      </div>
    </div>
  );
}

// Badge Component
function Badge({ text, color }: { text: string; color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' }) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm border font-medium ${colors[color]}`}>
      {text}
    </span>
  );
}

// Stat Card
function StatCard({ icon, value, label, color = 'text-default' }: { 
  icon: string; 
  value: string | number; 
  label: string; 
  color?: string;
}) {
  return (
    <div className="bg-surface-elevated border border-default rounded-2xl p-4 text-center hover:border-indigo-500/30 transition-colors">
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-2xl font-black ${color} mb-1`}>{value}</div>
      <div className="text-xs text-muted font-medium">{label}</div>
    </div>
  );
}

// Rozet Component
function Rozet({ emoji, name, description, locked }: { 
  emoji: string; 
  name: string; 
  description: string; 
  locked?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
      locked 
        ? 'bg-surface/50 border-default opacity-50' 
        : 'bg-surface border-default hover:border-indigo-500/30'
    }`}
    >
      <div className="text-2xl">{locked ? '🔒' : emoji}</div>
      <div className="min-w-0">
        <div className="text-default font-bold text-sm truncate">{name}</div>
        <div className="text-muted text-xs">{locked ? 'Kilitli' : description}</div>
      </div>
    </div>
  );
}
