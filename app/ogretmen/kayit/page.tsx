'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/app/src/context/AuthContext';

type Lesson = { id: number; name: string };

export default function OgretmenKayitPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(new Set());
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/panel');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('lessons').select('id, name').eq('is_active', true).order('name', { ascending: true });
      setLessons(data || []);
      setLoadingLessons(false);
    })();
  }, []);

  function toggleLesson(id: number) {
    setSelectedLessonIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    if (!selectedLessonIds.size) {
      setError('En az bir branş (ders) seçmelisin');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Hesap oluşturulamadı');

      const res = await fetch('/api/ogretmen/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, lessonIds: Array.from(selectedLessonIds) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Kayıt tamamlanamadı');
      }

      router.push('/login?registered=teacher');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt yapılamadı');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-surface border border-default text-default placeholder-muted focus:outline-none focus:border-indigo-500';

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-default flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Yönlendiriliyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-default flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-default">Ders Takip</h1>
          <p className="text-muted-foreground mt-2">Öğretmen kaydı</p>
        </div>

        <div className="rounded-2xl bg-surface-elevated border border-default p-8">
          <h2 className="text-xl font-semibold text-default mb-2">Öğretmen Olarak Kayıt Ol</h2>
          <p className="text-xs text-muted-foreground mb-6">Kayıt sonrası hesabın onay bekler durumda olur; yönetici onayladıktan sonra öğretmen paneline erişebilirsin.</p>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Hangi branş(lar)da ders veriyorsun?</label>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-default divide-y divide-default">
                {loadingLessons ? (
                  <p className="p-3 text-sm text-muted-foreground">Dersler yükleniyor...</p>
                ) : (
                  lessons.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 p-3 text-sm text-default cursor-pointer">
                      <input type="checkbox" checked={selectedLessonIds.has(l.id)} onChange={() => toggleLesson(l.id)} />
                      {l.name}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Ad Soyad</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Ahmet Yılmaz" required />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">E-posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="ornek@email.com" required />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Şifre</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" required minLength={6} />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Şifre Tekrar</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="••••••••" required />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
            >
              {submitting ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              Öğrenciysen{' '}
              <Link href="/register" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                buradan kayıt ol
              </Link>
            </p>
            <p className="text-muted-foreground text-sm">
              Zaten hesabın var mı?{' '}
              <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                Giriş Yap
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-muted-foreground hover:text-default text-sm">
            ← Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
