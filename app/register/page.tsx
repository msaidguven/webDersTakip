'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../src/context/AuthContext';
import { useRegisterViewModel } from '../src/viewmodels/useRegisterViewModel';
import GoogleSignInButton from '../src/components/GoogleSignInButton';
import { AuthBanner, AuthLoading, AuthShell, authStyles as s } from '../src/components/auth/AuthShell';
import { PasswordField } from '../src/components/auth/PasswordField';
import { USERNAME_PATTERN, USERNAME_RULES_MESSAGE, normalizeUsernameInput } from '../src/lib/username';
import { safeRedirectPath } from '@/app/src/lib/safeRedirect';
import { offerToSaveCredential } from '@/app/src/lib/browserCredentials';

function makeMathChallenge() {
  return { a: 1 + Math.floor(Math.random() * 9), b: 1 + Math.floor(Math.random() * 9) };
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams?.get('redirectTo');
  const redirectTo = rawRedirectTo ? safeRedirectPath(rawRedirectTo, '/') : '/';

  const { isAuthenticated, loading: authLoading } = useAuth();
  const { state, grades, isLoadingGrades, lessons, isLoadingLessons, register, clearError } = useRegisterViewModel();
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '', gradeId: '' });
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  // Bot koruması: gizli alan (insan görmez/doldurmaz), form açılış zamanı (çok hızlı gönderim =
  // bot) ve basit bir toplama sorusu (kullanıcı kararıyla kaldı — 2026-10-03, daha önce bir bot
  // hesabı açılmıştı). Üçü de app/api/auth/register'da sunucuda yeniden doğrulanıyor.
  const [honeypot, setHoneypot] = useState('');
  const [formRenderedAt] = useState(() => Date.now());
  const [mathChallenge, setMathChallenge] = useState(makeMathChallenge);
  const [mathAnswer, setMathAnswer] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Zaten giriş yapmış kullanıcı kayıt formunu görmez. Kayıt anında giriş yapılmış olur;
  // o durumda yönlendirmeyi handleSubmit yapar (justRegistered), burası değil.
  useEffect(() => {
    if (!authLoading && isAuthenticated && !justRegistered) router.replace('/');
  }, [isAuthenticated, authLoading, router, justRegistered]);

  const set = (field: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const toggleLesson = (id: number) =>
    setSelectedLessonIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (honeypot.trim() !== '') return setFormError('Doğrulama başarısız. Sayfayı yenileyip tekrar dener misin?');
    if (Date.now() - formRenderedAt < 3000) return setFormError('Formu doldurmak için birkaç saniye ayırıp tekrar dener misin?');
    if (parseInt(mathAnswer, 10) !== mathChallenge.a + mathChallenge.b) {
      setMathChallenge(makeMathChallenge());
      setMathAnswer('');
      return setFormError('Toplama işleminin sonucu yanlış, yeni soruyu cevaplar mısın?');
    }
    if (!USERNAME_PATTERN.test(form.username)) return setFormError(USERNAME_RULES_MESSAGE);
    if (role === 'student' && !form.gradeId) return setFormError('Sınıfını seçmelisin.');
    if (role === 'teacher' && selectedLessonIds.size === 0) return setFormError('En az bir branş seçmelisin.');
    if (!acceptedPrivacy) return setFormError('Devam etmek için Gizlilik Politikası’nı kabul etmelisin.');

    setJustRegistered(true);
    const result = await register({
      fullName: form.fullName.trim(),
      username: form.username,
      email: form.email.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
      role,
      gradeId: role === 'student' ? parseInt(form.gradeId, 10) : undefined,
      lessonIds: role === 'teacher' ? Array.from(selectedLessonIds) : undefined,
      honeypot,
      formRenderedAt,
      mathA: mathChallenge.a,
      mathB: mathChallenge.b,
      mathAnswer,
      acceptedPrivacy,
    });
    if (!result) {
      setJustRegistered(false);
      return;
    }
    await offerToSaveCredential(form.email.trim(), form.password, form.fullName.trim());
    // Öğretmen hesabı yönetici onayı bekler — öğretmen paneli bunu kendisi anlatır.
    router.replace(result.role === 'teacher' ? '/ogretmen' : redirectTo);
  };

  if (authLoading || (isAuthenticated && !justRegistered)) return <AuthLoading text="Yönlendiriliyor…" />;

  const error = formError || state.error;
  const loginHref = rawRedirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login';

  return (
    <AuthShell>
      <form className={s.form} onSubmit={handleSubmit}>
        <div>
          <h1 className={s.title}>Ücretsiz hesap oluştur</h1>
          <p className={s.lead}>İlerlemeni kaydet, sana özel testler çöz.</p>
        </div>

        {/* Gizli alan: insan görmez, botlar genelde tüm alanları doldurur */}
        <div className={s.honeypot} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        <div className={s.seg} role="group" aria-label="Hesap türü">
          <button type="button" aria-pressed={role === 'student'} onClick={() => setRole('student')}>Öğrenciyim</button>
          <button type="button" aria-pressed={role === 'teacher'} onClick={() => setRole('teacher')}>Öğretmenim</button>
        </div>

        {role === 'student' ? (
          <div className={s.field}>
            <label htmlFor="grade" className={s.label}>Sınıfın</label>
            <div className={`${s.inputWrap} ${s.selectWrap}`}>
              <select id="grade" className={s.input} value={form.gradeId} onChange={(e) => set('gradeId', e.target.value)} disabled={isLoadingGrades} required>
                <option value="" disabled>{isLoadingGrades ? 'Sınıflar yükleniyor…' : 'Sınıfını seç'}</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className={s.field}>
            <span id="lessons-label" className={s.label}>Branşların</span>
            {isLoadingLessons ? (
              <span className={s.hint}>Dersler yükleniyor…</span>
            ) : (
              <div className={s.chips} role="group" aria-labelledby="lessons-label">
                {lessons.map((l) => (
                  <button key={l.id} type="button" className={s.chip} aria-pressed={selectedLessonIds.has(l.id)} onClick={() => toggleLesson(l.id)}>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            <span className={s.hint}>Öğretmen hesapları yönetici onayından sonra açılır.</span>
          </div>
        )}

        <div className={s.field}>
          <label htmlFor="fullName" className={s.label}>Ad soyad</label>
          <input id="fullName" name="name" className={s.input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" placeholder="Ayşe Yılmaz" required />
        </div>

        <div className={s.field}>
          <label htmlFor="username" className={s.label}>Kullanıcı adı</label>
          <div className={s.inputWrap}>
            <span className={s.at} aria-hidden="true">@</span>
            <input
              id="username"
              name="nickname"
              className={`${s.input} ${s.withAt}`}
              value={form.username}
              onChange={(e) => set('username', normalizeUsernameInput(e.target.value))}
              // nickname: tarayıcı bunu hesabın giriş kimliği sanmasın — giriş e-postayla yapılıyor.
              autoComplete="nickname"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ayse.yilmaz"
              minLength={3}
              maxLength={30}
              aria-describedby="username-hint"
              required
            />
          </div>
          <span id="username-hint" className={s.hint}>Sıralamada ve yorumlarda görünür, sonra değiştirebilirsin.</span>
        </div>

        <div className={s.field}>
          <label htmlFor="email" className={s.label}>E-posta</label>
          <input
            id="email"
            name="email"
            type="email"
            className={s.input}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ornek@eposta.com"
            required
          />
        </div>

        <PasswordField
          id="new-password"
          label="Şifre"
          value={form.password}
          onChange={(v) => set('password', v)}
          autoComplete="new-password"
          placeholder="En az 8 karakter"
          showStrength
          onGenerate={(pwd) => setForm((prev) => ({ ...prev, password: pwd, confirmPassword: pwd }))}
        />
        <PasswordField
          id="confirm-password"
          label="Şifre (tekrar)"
          value={form.confirmPassword}
          onChange={(v) => set('confirmPassword', v)}
          autoComplete="new-password"
          placeholder="Aynısını yaz"
          invalid={!!form.confirmPassword && form.confirmPassword !== form.password}
        />

        <div className={s.field}>
          <label htmlFor="bot-check" className={s.label}>Bot olmadığını doğrula: {mathChallenge.a} + {mathChallenge.b} kaç eder?</label>
          <input id="bot-check" className={s.input} inputMode="numeric" autoComplete="off" value={mathAnswer} onChange={(e) => setMathAnswer(e.target.value.replace(/\D/g, ''))} placeholder="Cevap" required />
        </div>

        <label className={s.check}>
          <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} required />
          <span>
            <Link href="/gizlilik-politikasi" target="_blank" className={s.link}>Gizlilik Politikası</Link>’nı okudum ve kabul ediyorum.
          </span>
        </label>

        {error && <AuthBanner kind="err" onClose={() => { setFormError(null); clearError(); }}>{error}</AuthBanner>}

        <button type="submit" className={`${s.btn} ${s.primary}`} disabled={state.isLoading}>
          {state.isLoading ? 'Hesabın oluşturuluyor…' : 'Hesabımı oluştur'}
        </button>

        <div className={s.or}>veya</div>
        <GoogleSignInButton redirectTo={redirectTo} label="Google ile kayıt ol" />
        <p className={s.hint} style={{ textAlign: 'center', marginTop: -8 }}>
          Google ile devam ederek <Link href="/gizlilik-politikasi" target="_blank" className={s.link}>Gizlilik Politikası</Link>’nı kabul etmiş olursun.
        </p>

        <p className={s.foot}>
          Zaten hesabın var mı? <Link href={loginHref} className={s.link}>Giriş yap</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <RegisterForm />
    </Suspense>
  );
}
