'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, createStorageClient } from '@/utils/supabase/client';
import { useAuth } from '@/app/src/context/AuthContext';
import { getProfileStats } from '@/app/src/lib/profileStats';
import { getMyComments, type MyComment } from '@/app/src/lib/myComments';
import { AuthPrompt } from '@/app/src/components/AuthPrompt';
import { safeRedirectPath } from '@/app/src/lib/safeRedirect';
import { Settings, LogOut, Camera, Flag } from 'lucide-react';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';
import { clearMyProfileCache } from '@/app/src/lib/myProfileClient';
import { PublicProfileToggle } from './PublicProfileToggle';
import { TeacherProfile } from './TeacherProfile';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';

export interface ProfileRow {
  full_name: string | null;
  username: string | null;
  nickname: string | null;
  use_nickname: boolean;
  avatar_url: string | null;
  grade_id: number | null;
  city_id: number | null;
  district_id: number | null;
  school_id: number | null;
  school_name: string | null;
  role: 'student' | 'teacher' | 'admin' | null;
  is_verified: boolean | null;
  onboarding_completed: boolean;
  /** Üye profil kartı diğer üyelere açık mı (varsayılan kapalı; public_profile_card.sql). */
  public_profile?: boolean;
  /** Kartın genel kimliği (/uye/<slug>); asıl hesap kimliği URL'de kullanılmaz. */
  public_slug?: string | null;
}

interface UserStats {
  totalTests: number;
  totalQuestions: number;
  correctAnswers: number;
  averageScore: number;
  accuracy: number;
  mastery: number;
  streakDays: number;
}

// Profil (2026-10-20): sade robotik tema — üç oran halkası tek neon vurguyla, sayaçlar gösterge kutusu.
const STAT_RINGS = [
  { key: 'accuracy', title: 'Doğruluk', description: 'Çözdüğün soruların doğru cevap oranı' },
  { key: 'coverage', title: 'Kapsam', description: 'Soru çözdüğün konuların tüm konulara oranı' },
  { key: 'mastery', title: 'Ustalık', description: 'Tam öğrendiğin soruların oranı' },
] as const;

function StatRing({ value, title, description }: { value: number; title: string; description: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`flex flex-col items-center gap-3 p-5 text-center ${r.panel}`}>
      <div
        className="relative grid h-24 w-24 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--neon) 0 ${pct}%, var(--track) 0 100%)` }}
        role="img"
        aria-label={`${title}: %${pct}`}
      >
        <span className="absolute inset-[7px] rounded-full" style={{ background: 'var(--panel-solid)' }} />
        <span className={`relative text-xl ${r.statValue}`}>%{pct}</span>
      </div>
      <div>
        <p className={`text-sm font-bold uppercase text-default ${r.display}`}>{title}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 ${r.stat}`}>
      <span className={r.label}>{label}</span>
      <span className={`text-xl ${r.statValue}`}>{value}</span>
    </div>
  );
}

// Avatar'ı sunucuya göndermeden ÖNCE tarayıcıda WebP'ye çevirip 512px'e küçültüyoruz
// (kullanıcı isteği, 2026-09-12) — hem yükleme boyutu ciddi düşüyor (telefon kamerası
// fotoğrafı birkaç MB'tan genelde birkaç yüz KB'a iniyor) hem de storage'daki dosya adı
// artık HER ZAMAN tek bir sabit uzantı (.webp) kullanıyor, "hangi uzantıyla yüklenmiş"
// belirsizliği ortadan kalkıyor.
async function fileToWebp(file: File, maxSize = 512, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tarayıcın görsel dönüştürmeyi desteklemiyor');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Görsel dönüştürülemedi'))), 'image/webp', quality);
  });
}

export default function ProfilClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, loading: authLoading, supabase } = useAuth();

  // Google/OAuth ile İLK giriş yapan kullanıcı buraya, asıl gideceği yere gitmeden ÖNCE
  // yönlendirilir (bkz. app/auth/callback/route.ts) — öğrenci/öğretmen + sınıf/branş
  // seçimini tamamladıktan sonra bu adrese devam eder (yoksa anasayfaya — "Bugünkü görevin" orada).
  // Açık yönlendirme önlemi (bkz. safeRedirect.ts) — ?next= dışarıdan gelebiliyor.
  const nextAfterOnboarding = safeRedirectPath(searchParams?.get('next'), '/');

  const email = authUser?.email;

  const [fullName, setFullName] = useState('Öğrenci');
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [gradeName, setGradeName] = useState<string | null>(null);
  const [comments, setComments] = useState<MyComment[] | null>(null);
  // Admin profilini öğrenci ya da öğretmen gözüyle görebilir (anasayfadaki önizlemeyle aynı fikir).
  const [adminView, setAdminView] = useState<'student' | 'teacher'>('student');
  // Kapsam konu bazlı (2026-10-20, kullanıcı isteği: ünite bazlı oran çok yavaş artıyordu): en az bir
  // sorusunu çözdüğün konular ÷ sınıfındaki tüm konular (sorusu henüz olmayanlar dahil). Veri İlerlemem'le
  // aynı önbellekten — ek istek yok. Sınıf seçilmemişse (mastery === null) 0.
  const { data: mastery } = useTopicMastery();
  const coverage = (() => {
    if (!mastery) return 0;
    let touched = 0;
    let total = 0;
    for (const l of mastery.lessons) {
      touched += l.topics.filter((t) => t.solved > 0).length;
      total += l.topics.length + l.upcoming;
    }
    return total > 0 ? Math.round((touched / total) * 100) : 0;
  })();

  useEffect(() => {
    setFullName((authUser?.user_metadata?.full_name as string | undefined) || 'Öğrenci');
    setAvatarUrl((authUser?.user_metadata?.avatar_url as string | undefined) || null);
  }, [authUser]);

  // Kabuk (Sidebar/TopBar) auth çözülür çözülmez hemen çizilsin diye stats ve
  // profil bilgisi ayrı ayrı, arka planda dolduruluyor — sayfanın tamamını bloklayan
  // tek bir server-side fetch YOK artık (bkz. /api/profile/update GET'i).
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    getProfileStats(supabase, authUser.id).then((result) => {
      if (!cancelled) setStats(result);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, authUser]);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    fetch('/api/profile/update')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile: ProfileRow | null; gradeName: string | null } | null) => {
        if (cancelled || !data) return;
        setProfile(data.profile);
        setGradeName(data.gradeName);
        // profiles tablosu ad/avatar için gerçek kaynak (bkz. auth/callback ve
        // panel/aktiviteler, panel/siralama, UnitDiscussion — hepsi buradan okur);
        // auth.user_metadata sadece kayıt anındaki ilk değerin bir kopyası, güncel
        // olmayabilir. Yüklenince gerçek değer varsa onunla üzerine yazıyoruz.
        if (data.profile?.full_name) setFullName(data.profile.full_name);
        if (data.profile?.avatar_url) setAvatarUrl(data.profile.avatar_url);
        setUsername(data.profile?.username ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    getMyComments(supabase, authUser.id).then((result) => {
      if (!cancelled) setComments(result);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, authUser]);

  // Eski /profil#ayarlar bağlantıları (ör. kaydedilmiş yer imleri) yeni Ayarlar sayfasına.
  useEffect(() => {
    if (window.location.hash === '#ayarlar') router.replace('/profil/ayarlar?bolum=bildirimler');
  }, [router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    // WebP dönüşümü öncesi kaba bir üst sınır — asıl 2MB kontrolü artık dönüştürülmüş
    // (küçültülmüş) dosya üzerinde yapılıyor, ama tarayıcının dev bir orijinali (ör.
    // 50MB'lık bir RAW/HEIC) belleğe almaya çalışmasını burada engelliyoruz.
    if (file.size > 20 * 1024 * 1024) {
      alert('Dosya boyutu 20MB\'dan küçük olmalıdır.');
      return;
    }

    setUploading(true);

    try {
      const webpBlob = await fileToWebp(file);
      if (webpBlob.size > 2 * 1024 * 1024) {
        alert('Dönüştürülmüş görsel hâlâ 2MB\'dan büyük, lütfen başka bir fotoğraf dene.');
        return;
      }

      // Dosya adı kullanıcının id'sine (nickname'e değil — boş olabilir, değişebilir,
      // dosya adı için ekstra temizleme ister) SABİT olarak bağlı: "avatars/{id}.webp".
      // auth.uid() zaten benzersiz ve hiç değişmiyor, üstelik re-upload'ta upsert ile
      // AYNI yolun üzerine yazıldığı için storage'da eski dosya birikmiyor. Uzantı de
      // her zaman .webp olduğu için (fileToWebp) farklı uzantılı eski dosya kalma
      // ihtimali sadece BU değişiklikten ÖNCE yüklenmiş hesaplar için geçerli — onlar
      // için de olası eski uzantıları burada bir kereliğine temizliyoruz.
      const filePath = `avatars/${authUser.id}.webp`;
      const legacyExts = ['jpg', 'jpeg', 'png', 'gif'];
      // createClient() değil createStorageClient() kullanılıyor çünkü createClient()'ın
      // zorladığı global "Content-Type: application/json" header'ı, storage.upload()'ın
      // ürettiği multipart/form-data boundary header'ının üzerine yazıp yüklenen dosyanın
      // sunucuda "application/json" olarak algılanıp reddedilmesine yol açıyordu (bkz.
      // utils/supabase/client.ts'teki NOT, kullanıcının 2026-09-12 ekran görüntüsüyle
      // bildirdiği "mime type application/json is not supported" hatası).
      const storageClient = createStorageClient();
      await storageClient.storage.from('profiles').remove(legacyExts.map((ext) => `avatars/${authUser.id}.${ext}`));

      const { error: uploadError } = await storageClient.storage
        .from('profiles')
        .upload(filePath, webpBlob, { upsert: true, contentType: 'image/webp' });

      if (uploadError) throw uploadError;

      // Dosya yolu sabit kaldığı için tarayıcı/CDN eski görseli cache'leyebilir —
      // her yüklemede farklı bir "?v=" ekleyerek public URL'i tazeliyoruz, gerçek
      // dosya yolu değişmiyor.
      const { data: { publicUrl: baseUrl } } = storageClient.storage
        .from('profiles')
        .getPublicUrl(filePath);
      const publicUrl = `${baseUrl}?v=${Date.now()}`;

      clearMyProfileCache(); // profil değişiyor — 30 dk'lık istemci kopyası bayatlamasın (myProfileClient.ts)
      await Promise.all([
        supabase.auth.updateUser({ data: { avatar_url: publicUrl } }),
        fetch('/api/profile/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: { avatar_url: publicUrl } }),
        }),
      ]);

      setAvatarUrl(publicUrl);
    } catch (err) {
      alert('Fotoğraf yüklenirken hata: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const shell = (body: React.ReactNode) => (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-20 pt-8 sm:gap-8 sm:px-6 sm:pt-12">{body}</main>
    </div>
  );

  if (authLoading) {
    return shell(<div aria-busy="true" aria-label="Profil yükleniyor" className={`h-48 animate-pulse rounded-[18px] ${r.panel}`} />);
  }
  if (!authUser) return shell(<AuthPrompt message="Profilini görmek için giriş yap." />);

  const initial = (fullName?.trim()?.[0] || email?.[0] || 'U').toLocaleUpperCase('tr-TR');
  // Öğretmen aynı /profil adresinde kendi ekranını görür (TeacherProfile.tsx); rol profil yüklenince belli olur.
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher' || (isAdmin && adminView === 'teacher');
  const teacherVerified = isAdmin || profile?.is_verified === true;

  return shell(
    <>
      {/* KİMLİK KARTI */}
      <section aria-labelledby="profil-ad" className={`flex flex-col items-center gap-5 p-6 sm:flex-row sm:p-7 ${r.panel}`}>
        <div className="relative shrink-0">
          <div className={`grid h-24 w-24 place-items-center overflow-hidden rounded-full p-[3px] ${r.brandChip} !rounded-full`}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Profil fotoğrafı" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className={`text-3xl ${r.statValue} ${r.accent}`}>{initial}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Fotoğraf değiştir"
            className={`absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full disabled:opacity-50 ${r.iconBtn} !rounded-full`}
          >
            {uploading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Camera className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 id="profil-ad" className={`truncate text-2xl font-bold text-default sm:text-3xl ${r.display}`}>{fullName}</h1>
          {username && <p className={`truncate text-sm font-semibold ${r.accent}`}>@{username}</p>}
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          {profile && (
            <ul className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start" aria-label="Özet">
              {isTeacher ? (
                <li className={r.badge}>{teacherVerified ? 'Öğretmen · Onaylı' : 'Öğretmen · Onay bekliyor'}</li>
              ) : (
                <>
                  <li className={r.badge}>{gradeName ?? 'Sınıf belirtilmemiş'}</li>
                  {stats && <li className={r.badge}>🔥 {stats.streakDays} gün seri</li>}
                </>
              )}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 gap-2 sm:flex-col">
          <Link href="/profil/ayarlar" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${r.btnGhost}`}>
            <Settings className="h-4 w-4" aria-hidden="true" /> Ayarlar
          </Link>
          <Link href="/profil/bildirdigim-sorular" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${r.btnGhost}`}>
            <Flag className="h-4 w-4" aria-hidden="true" /> Bildirdiğim sorular
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-red-500 ${r.item}`}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Çıkış
          </button>
        </div>
      </section>

      {isAdmin && (
        <div role="group" aria-label="Profil önizlemesi" className={`flex flex-wrap items-center gap-2 p-3 ${r.panel}`}>
          <span className="px-1 text-sm text-muted-foreground">Profili şöyle gör:</span>
          {(['student', 'teacher'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={adminView === v}
              onClick={() => setAdminView(v)}
              className={`min-h-9 rounded-xl px-3.5 text-sm font-semibold ${r.item} ${adminView === v ? r.navActive : 'text-muted-foreground'}`}
            >
              {v === 'student' ? 'Öğrenci' : 'Öğretmen'}
            </button>
          ))}
        </div>
      )}

      {profile && !isTeacher && (
        <PublicProfileToggle
          slug={profile.public_slug ?? null}
          initialOn={profile.public_profile === true}
          onChange={(on) => setProfile((p) => (p ? { ...p, public_profile: on } : p))}
        />
      )}

      {profile && profile.onboarding_completed === false && (
        <OnboardingCard onCompleted={() => router.push(nextAfterOnboarding)} />
      )}

      {isTeacher ? (
        <TeacherProfile isVerified={teacherVerified} />
      ) : (
      /* PERFORMANS */
      <section aria-labelledby="performans" className="flex flex-col gap-3">
        <h2 id="performans" className={r.label}>Genel performans</h2>
        {stats ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STAT_RINGS.map((ring) => (
                <StatRing key={ring.key} value={ring.key === 'coverage' ? coverage : stats[ring.key]} title={ring.title} description={ring.description} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat value={stats.totalTests} label="Toplam test" />
              <MiniStat value={stats.totalQuestions} label="Çözülen soru" />
              <MiniStat value={stats.correctAnswers} label="Doğru cevap" />
              <MiniStat value={`%${stats.averageScore}`} label="Ortalama puan" />
            </div>
          </>
        ) : (
          <div aria-busy="true" aria-label="Performans yükleniyor" className={`h-56 animate-pulse rounded-[18px] ${r.panel}`} />
        )}
      </section>
      )}

      <MyCommentsCard comments={comments} />
    </>
  );
}

// ==================== HESABI TAMAMLA (OAuth ile ilk giriş) ====================

type OnboardingLesson = { id: number; name: string };

// Google/OAuth ile ilk kez giriş yapan kullanıcı profili role/sınıf/branş bilinmeden
// oluşturulur (bkz. app/auth/callback/route.ts) — kullanıcı buraya yönlendirilip normal
// kayıt formundaki (/register) AYNI öğrenci/öğretmen seçimini burada tamamlar. Tamamlanana
// kadar bu kart en üstte, kaçırılamayacak şekilde duruyor.
function OnboardingCard({ onCompleted }: { onCompleted: () => void }) {
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [grades, setGrades] = useState<{ id: number; name: string }[]>([]);
  const [gradeId, setGradeId] = useState('');
  const [lessons, setLessons] = useState<OnboardingLesson[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: gradesData }, { data: lessonsData }] = await Promise.all([
        supabase.from('grades').select('id, name').order('order_no'),
        supabase.from('lessons').select('id, name').eq('is_active', true).order('name', { ascending: true }),
      ]);
      setGrades((gradesData as { id: number; name: string }[] | null) || []);
      setLessons((lessonsData as OnboardingLesson[] | null) || []);
      setLoadingOptions(false);
    })();
  }, []);

  function toggleLesson(id: number) {
    setSelectedLessonIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (role === 'student' && !gradeId) {
      setError('Sınıfını seçmelisin');
      return;
    }
    if (role === 'teacher' && selectedLessonIds.size === 0) {
      setError('En az bir branş (ders) seçmelisin');
      return;
    }
    setSaving(true);
    try {
      clearMyProfileCache(); // profil değişiyor — 30 dk'lık istemci kopyası bayatlamasın (myProfileClient.ts)
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          gradeId: role === 'student' ? Number(gradeId) : undefined,
          lessonIds: role === 'teacher' ? Array.from(selectedLessonIds) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-500/40 bg-indigo-500/5 p-6 animate-fade-in-up">
      <h3 className="text-lg font-bold text-default flex items-center gap-2 mb-1">
        <span className="text-xl">👋</span> Hesabını tamamla
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Google ile giriş yaptın — devam etmeden önce öğrenci mi öğretmen misin seç, sonra sınıfını ya da branşını belirt.
      </p>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-xl text-sm bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <button
          type="button"
          onClick={() => setRole('student')}
          className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${role === 'student' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-default text-muted-foreground hover:border-indigo-500/40'}`}
        >
          🎒 Öğrenciyim
        </button>
        <button
          type="button"
          onClick={() => setRole('teacher')}
          className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${role === 'teacher' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-default text-muted-foreground hover:border-indigo-500/40'}`}
        >
          🎓 Öğretmenim
        </button>
      </div>

      {role === 'student' ? (
        <div className="mb-4">
          <label className="block text-muted-foreground text-xs font-medium mb-1.5">Kaçıncı sınıftasın?</label>
          <select
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            disabled={loadingOptions}
            className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
          >
            <option value="" disabled>{loadingOptions ? 'Sınıflar yükleniyor...' : 'Sınıfını seç'}</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-4">
          <label className="block text-muted-foreground text-xs font-medium mb-1.5">Hangi branş(lar)da ders veriyorsun?</label>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-default divide-y divide-default bg-surface">
            {loadingOptions ? (
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
          <p className="mt-2 text-xs text-muted-foreground">Kayıt sonrası hesabın onay bekler durumda olur; yönetici onayladıktan sonra öğretmen paneline erişebilirsin.</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || loadingOptions}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
      </button>
    </div>
  );
}

// ==================== YORUMLARIM ====================

const COMMENT_STATUS_LABELS: Record<string, { text: string; className: string }> = {
  published: { text: 'Yayında', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending: { text: 'İncelemede', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  rejected: { text: 'Reddedildi', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function formatCommentDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const AI_MODE_LABELS: Record<string, { text: string; className: string }> = {
  hocam: { text: '🎓 Hocam', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  kanka: { text: '😄 Kanka', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

function MyCommentsCard({ comments }: { comments: MyComment[] | null }) {
  return (
    <section aria-labelledby="yorumlarim" className={`p-6 ${r.panel}`}>
      <h2 id="yorumlarim" className={`mb-4 ${r.label}`}>Yorumlarım ve sorularım</h2>

      {comments === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-default animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz bir soru veya üniteye yorum ya da AI&apos;ye soru yazmadın.</p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((c) => {
            const badge =
              c.kind === 'comment'
                ? COMMENT_STATUS_LABELS[c.status] || COMMENT_STATUS_LABELS.pending
                : AI_MODE_LABELS[c.mode];
            const body = (
              <div className="rounded-xl bg-surface border border-default p-3.5 hover:border-indigo-500/30 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  {c.contextLabel && (
                    <span className="text-xs text-indigo-400 font-medium truncate">{c.contextLabel}</span>
                  )}
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}>
                    {badge.text}
                  </span>
                </div>
                {c.kind === 'comment' ? (
                  <p className="text-sm text-default break-words">{c.body}</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-sm text-default break-words font-medium">{c.question}</p>
                    <p className="text-sm text-muted-foreground break-words">{c.answer}</p>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5">{formatCommentDate(c.createdAt)}</p>
              </div>
            );
            return c.href ? (
              <Link key={c.id} href={c.href} className="block">
                {body}
              </Link>
            ) : (
              <div key={c.id}>{body}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}
