'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface ProfilClientProps {
  user: {
    id: string;
    email: string | undefined;
    fullName: string;
    avatarUrl: string | null;
  };
}

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

export default function ProfilClient({ user }: ProfilClientProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats: UserStats = {
    totalTests: 15,
    totalQuestions: 230,
    correctAnswers: 195,
    averageScore: 85,
    accuracy: 83,
    coverage: 65,
    mastery: 42,
    streakDays: 7,
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Dosya boyutu 2MB dan kucuk olmalidir.');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      alert('Fotograf yuklenirken hata: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-default pb-20">
      <div className="pt-[72px] pb-6 px-4 sm:px-8 border-b border-default bg-gradient-to-b from-surface to-default">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted hover:text-default transition-colors">
              <span className="text-lg">←</span>
              <span className="hidden sm:inline">Ana Sayfa</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-default">Profilim</h1>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { title: 'Accuracy', value: stats.accuracy, color: 'from-emerald-500 to-teal-500', icon: '🎯' },
            { title: 'Coverage', value: stats.coverage, color: 'from-blue-500 to-indigo-500', icon: '📊' },
            { title: 'Mastery', value: stats.mastery, color: 'from-purple-500 to-pink-500', icon: '👑' },
          ].map((stat) => (
            <div key={stat.title} className="relative overflow-hidden bg-surface-elevated border border-default rounded-2xl p-4 text-center">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5`} />
              <div className="relative">
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className={`text-3xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}%
                </div>
                <div className="text-default font-bold text-sm mt-1">{stat.title}</div>
              </div>
            </div>
          ))}
        </div>

        {/* User Card */}
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.email?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <span className="text-white text-2xl">📷</span>
              </button>
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-default mb-1">{user.fullName}</h2>
              <p className="text-muted mb-3">{user.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 rounded-full text-sm border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">8. Sinif</span>
                <span className="px-3 py-1 rounded-full text-sm border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Aktif Uye</span>
              </div>
            </div>

            <button onClick={handleSignOut} className="px-5 py-2.5 rounded-xl bg-surface border border-default text-muted hover:bg-red-500/10 hover:text-red-400 transition-all">
              Cikis Yap
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
