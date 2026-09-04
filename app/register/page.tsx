'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../src/context/AuthContext';
import { useRegisterViewModel } from '../src/viewmodels/useRegisterViewModel';
import GoogleSignInButton from '../src/components/GoogleSignInButton';

function makeMathChallenge() {
  return { a: 1 + Math.floor(Math.random() * 9), b: 1 + Math.floor(Math.random() * 9) };
}

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { state, grades, isLoadingGrades, register, clearError } = useRegisterViewModel();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    gradeId: '',
  });

  // Bot koruması: honeypot (insan görmez/doldurmaz), form açılış zamanı (çok hızlı submit
  // = bot) ve basit bir toplama sorusu. Üçü de app/api/auth/register'da sunucu tarafında
  // yeniden doğrulanıyor — burası sadece basit botları erkenden eleyip UX sağlıyor.
  const [honeypot, setHoneypot] = useState('');
  const [formRenderedAt] = useState(() => Date.now());
  const [mathChallenge, setMathChallenge] = useState(makeMathChallenge);
  const [mathAnswer, setMathAnswer] = useState('');
  const [botError, setBotError] = useState<string | null>(null);

  // Zaten giriş yapmış kullanıcı kayıt formunu görmemeli — login/page.tsx'teki aynı korumanın
  // eşleniği (bkz. bunun eksik olduğu bulunan bug).
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/panel');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotError(null);

    // İnsan kullanıcı honeypot'u hiç görmediği için dolduramaz — doluysa isteği
    // sunucuya hiç göndermeden burada kes.
    if (honeypot.trim() !== '') {
      setBotError('Doğrulama başarısız. Lütfen sayfayı yenileyip tekrar deneyin.');
      return;
    }
    if (Date.now() - formRenderedAt < 3000) {
      setBotError('Lütfen formu doldurmak için birkaç saniye ayırın ve tekrar deneyin.');
      return;
    }
    if (parseInt(mathAnswer, 10) !== mathChallenge.a + mathChallenge.b) {
      setBotError('Toplama işleminin sonucu yanlış.');
      setMathChallenge(makeMathChallenge());
      setMathAnswer('');
      return;
    }

    await register({
      fullName: formData.fullName,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      gradeId: formData.gradeId ? parseInt(formData.gradeId, 10) : undefined,
      honeypot,
      formRenderedAt,
      mathA: mathChallenge.a,
      mathB: mathChallenge.b,
      mathAnswer,
    });
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-surface border border-default text-default placeholder-muted focus:outline-none focus:border-indigo-500";

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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📚</span>
          </div>
          <h1 className="text-2xl font-bold text-default">Ders Takip</h1>
          <p className="text-muted-foreground mt-2">Hemen ucretsiz kaydol</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-surface-elevated border border-default p-8">
          <h2 className="text-xl font-semibold text-default mb-6">Kayit Ol</h2>

          {(state.error || botError) && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {state.error || botError}
              <button
                onClick={() => { clearError(); setBotError(null); }}
                className="ml-2 text-red-500 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot: insan kullanıcı bunu görmez, botlar genelde tüm inputları doldurur */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Kaçıncı sınıftasın?</label>
              <select
                value={formData.gradeId}
                onChange={(e) => handleChange('gradeId', e.target.value)}
                className={inputClass}
                required
                disabled={isLoadingGrades}
              >
                <option value="" disabled>
                  {isLoadingGrades ? 'Sınıflar yükleniyor...' : 'Sınıfını seç'}
                </option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Ad Soyad</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className={inputClass}
                placeholder="Ahmet Yilmaz"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">E-posta</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={inputClass}
                placeholder="ornek@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Sifre</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Sifre Tekrar</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Bot olmadığını doğrula: {mathChallenge.a} + {mathChallenge.b} = ?
              </label>
              <input
                type="number"
                value={mathAnswer}
                onChange={(e) => setMathAnswer(e.target.value)}
                className={inputClass}
                placeholder="Toplamı yaz"
                required
              />
            </div>

            <button
              type="submit"
              disabled={state.isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
            >
              {state.isLoading ? 'Kayit yapiliyor...' : 'Kayit Ol'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-default" />
            <span className="text-xs text-muted-foreground">veya</span>
            <div className="flex-1 h-px bg-default" />
          </div>

          <GoogleSignInButton redirectTo="/panel" />

          <div className="mt-6 text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              Öğretmen misin?{' '}
              <Link href="/ogretmen/kayit" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                Öğretmen kaydı
              </Link>
            </p>
            <p className="text-muted-foreground text-sm">
              Zaten hesabin var mi?{' '}
              <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                Giris Yap
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-muted-foreground hover:text-default text-sm">
            ← Ana Sayfaya Don
          </Link>
        </div>
      </div>
    </div>
  );
}
