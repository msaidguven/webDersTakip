'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/app/src/context/AuthContext';
import SearchCombobox, { type ComboboxOption } from '@/app/src/components/SearchCombobox';
import { getProfileStats } from '@/app/src/lib/profileStats';
import { getMyComments, type MyComment } from '@/app/src/lib/myComments';
import { PanelShell } from '@/app/src/components/PanelShell';
import { AuthPrompt } from '@/app/src/components/AuthPrompt';

interface ProfileRow {
  full_name: string | null;
  avatar_url: string | null;
  grade_id: number | null;
  city_id: number | null;
  district_id: number | null;
  school_id: number | null;
  school_name: string | null;
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

const STAT_RINGS = [
  { key: 'accuracy', title: 'Doğruluk', description: 'Çözdüğün soruların doğru cevap oranı', icon: '🎯', from: '#10b981', to: '#14b8a6' },
  { key: 'coverage', title: 'Kapsam', description: 'Bitirdiğin ünitelerin toplam üniteye oranı', icon: '📊', from: '#3b82f6', to: '#6366f1' },
  { key: 'mastery', title: 'Ustalık', description: 'Tam öğrendiğin soruların oranı', icon: '👑', from: '#a855f7', to: '#ec4899' },
] as const;

function StatRing({ value, title, description, icon, from, to, gradientId, delay }: {
  value: number;
  title: string;
  description: string;
  icon: string;
  from: string;
  to: string;
  gradientId: string;
  delay: number;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div
      className="relative overflow-hidden bg-surface-elevated border border-default rounded-2xl p-5 flex flex-col items-center text-center card-hover animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative w-24 h-24 mb-2">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="text-muted-foreground/15" stroke="currentColor" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            stroke={`url(#${gradientId})`}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg leading-none mb-1">{icon}</span>
          <span className="text-xl font-black text-default">{value}%</span>
        </div>
      </div>
      <div className="text-default font-bold text-sm">{title}</div>
      <div className="text-muted-foreground text-[11px] leading-snug mt-1">{description}</div>
    </div>
  );
}

function MiniStat({ icon, value, label, delay }: { icon: string; value: string | number; label: string; delay: number }) {
  return (
    <div
      className="bg-surface-elevated border border-default rounded-xl p-3 sm:p-4 flex items-center gap-3 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-default font-bold text-base leading-tight truncate">{value}</div>
        <div className="text-muted-foreground text-xs truncate">{label}</div>
      </div>
    </div>
  );
}

export default function ProfilClient() {
  const router = useRouter();
  const { user: authUser, loading: authLoading, supabase } = useAuth();

  const email = authUser?.email;

  const [fullName, setFullName] = useState('Öğrenci');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [gradeName, setGradeName] = useState<string | null>(null);
  const [comments, setComments] = useState<MyComment[] | null>(null);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Dosya boyutu 2MB\'dan küçük olmalıdır.');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      await Promise.all([
        supabase.auth.updateUser({ data: { avatar_url: publicUrl } }),
        fetch('/api/profile/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: { avatar_url: publicUrl } }),
        }),
      ]);

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      alert('Fotoğraf yüklenirken hata: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PanelShell
      isAuthenticated={!!authUser}
      userName={fullName}
      title="Profilim"
      subtitle="Hesap bilgilerini ve performansını yönet."
    >
      {!authUser ? (
        <div className="max-w-2xl mx-auto">
          <AuthPrompt message="Profilini görmek için giriş yap." />
        </div>
      ) : (
        <>
      <div className="relative pb-10 px-4 sm:px-8 overflow-hidden rounded-2xl border border-default mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative pt-8">
          {/* User Card */}
          <div className="bg-surface-elevated/80 backdrop-blur-sm border border-default rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative shrink-0">
                <div className="p-[3px] rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-surface flex items-center justify-center text-3xl font-bold text-default ring-2 ring-surface-elevated">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        {email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Fotoğraf değiştir"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 border-2 border-surface-elevated flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-white text-sm">📷</span>
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <h2 className="text-2xl font-bold text-default mb-1 truncate">{fullName}</h2>
                <p className="text-muted-foreground mb-3 truncate">{email}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 rounded-full text-sm border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                    {gradeName ? `${gradeName}` : 'Sınıf belirtilmemiş'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Aktif Üye
                  </span>
                  {stats && (
                    <span className="px-3 py-1 rounded-full text-sm border bg-orange-500/10 text-orange-400 border-orange-500/20">
                      🔥 {stats.streakDays} gün seri
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-surface border border-default text-muted-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all text-sm font-medium"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Primary Stats */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Genel Performans</h3>
          {stats ? (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {STAT_RINGS.map((ring, i) => (
                <StatRing
                  key={ring.key}
                  value={stats[ring.key]}
                  title={ring.title}
                  description={ring.description}
                  icon={ring.icon}
                  from={ring.from}
                  to={ring.to}
                  gradientId={`ring-${ring.key}`}
                  delay={i * 80}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {STAT_RINGS.map((ring) => (
                <div key={ring.key} className="h-40 rounded-2xl bg-surface-elevated border border-default animate-pulse" />
              ))}
            </div>
          )}
        </div>

        {/* Secondary Stats */}
        {stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat icon="📝" value={stats.totalTests} label="Toplam Test" delay={240} />
            <MiniStat icon="❓" value={stats.totalQuestions} label="Çözülen Soru" delay={280} />
            <MiniStat icon="✅" value={stats.correctAnswers} label="Doğru Cevap" delay={320} />
            <MiniStat icon="⭐" value={`${stats.averageScore}%`} label="Ortalama Puan" delay={360} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-elevated border border-default animate-pulse" />
            ))}
          </div>
        )}

        {/* Kişisel Bilgiler */}
        <PersonalInfoCard
          key={profile ? `name-ready-${profile.full_name}` : 'name-loading'}
          initialFullName={profile?.full_name ?? fullName}
          onSaved={setFullName}
        />

        {/* Okul Bilgileri */}
        <SchoolInfoCard key={profile ? 'ready' : 'loading'} initialProfile={profile} />

        {/* Yorumlarım */}
        <MyCommentsCard comments={comments} />
      </div>
        </>
      )}
    </PanelShell>
  );
}

// ==================== KİŞİSEL BİLGİLER ====================

function PersonalInfoCard({ initialFullName, onSaved }: { initialFullName: string; onSaved: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialFullName);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const showNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 4000);
  }, []);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      showNotice('error', 'Ad soyad boş olamaz');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const [res] = await Promise.all([
      fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { full_name: trimmed } }),
      }),
      supabase.auth.updateUser({ data: { full_name: trimmed } }),
    ]);
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Kaydedilemedi');
      return;
    }
    onSaved(trimmed);
    showNotice('success', 'Bilgiler kaydedildi');
    setEditing(false);
  }

  return (
    <div className="bg-surface-elevated border border-default rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '360ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-default flex items-center gap-2">
          <span className="text-xl">👤</span> Kişisel Bilgiler
        </h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-indigo-500 hover:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
          >
            Düzenle
          </button>
        )}
      </div>

      {notice && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          <span>{notice.kind === 'success' ? '✅' : '⚠️'}</span>
          {notice.text}
        </div>
      )}

      {!editing ? (
        <span className="px-3 py-1.5 rounded-full text-sm border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 flex items-center gap-1.5 w-fit">
          🙋 {initialFullName || 'Ad belirtilmemiş'}
        </span>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-1.5">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setEditing(false); setName(initialFullName); }}
              className="px-4 py-2 rounded-xl bg-surface border border-default text-muted-foreground hover:bg-surface-elevated text-sm font-medium transition-colors"
            >
              İptal
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== OKUL BİLGİLERİ ====================

type LookupRow = { id: number; label: string };
type SchoolResult = { id: number; name: string; school_type: string };

const SCHOOL_TYPE_LABELS: Record<string, string> = {
  anaokulu: 'Anaokulu',
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
};

function trFold(s: string) {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/i̇/g, 'i');
}

function SchoolInfoCard({ initialProfile }: { initialProfile: ProfileRow | null }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [grades, setGrades] = useState<LookupRow[]>([]);
  const [cities, setCities] = useState<LookupRow[]>([]);
  const [districts, setDistricts] = useState<LookupRow[]>([]);

  const [gradeId, setGradeId] = useState(initialProfile?.grade_id ? String(initialProfile.grade_id) : '');
  const [cityId, setCityId] = useState(initialProfile?.city_id ? String(initialProfile.city_id) : '');
  const [districtId, setDistrictId] = useState(initialProfile?.district_id ? String(initialProfile.district_id) : '');
  const [cityQuery, setCityQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');
  const [schoolId, setSchoolId] = useState<number | null>(initialProfile?.school_id ?? null);
  const [schoolQuery, setSchoolQuery] = useState(initialProfile?.school_name || '');
  const [schoolResults, setSchoolResults] = useState<SchoolResult[]>([]);

  const currentGradeName = grades.find((g) => String(g.id) === gradeId)?.label;
  const currentCityName = cities.find((c) => String(c.id) === cityId)?.label;
  const currentDistrictName = districts.find((d) => String(d.id) === districtId)?.label;

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: gradesData } = await supabase.from('grades').select('id, name').order('order_no');
      setGrades(((gradesData as { id: number; name: string }[] | null) || []).map((g) => ({ id: g.id, label: g.name })));
      const { data: citiesData } = await supabase.from('cities').select('id, name').order('name');
      setCities(((citiesData as { id: number; name: string }[] | null) || []).map((c) => ({ id: c.id, label: c.name })));
    })();
  }, []);

  // Şehir listesi yüklendiğinde, kayıtlı bir şehir varsa arama kutusunu adıyla doldur.
  useEffect(() => {
    if (cityId && !cityQuery && cities.length) {
      setCityQuery(cities.find((c) => String(c.id) === cityId)?.label || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  useEffect(() => {
    if (!cityId) {
      setDistricts([]);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('districts').select('id, name').eq('city_id', cityId).order('name');
      setDistricts(((data as { id: number; name: string }[] | null) || []).map((d) => ({ id: d.id, label: d.name })));
    })();
  }, [cityId]);

  useEffect(() => {
    if (districtId && !districtQuery && districts.length) {
      setDistrictQuery(districts.find((d) => String(d.id) === districtId)?.label || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts]);

  useEffect(() => {
    if (schoolQuery.trim().length < 1) {
      setSchoolResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: schoolQuery.trim() });
        if (cityId) params.set('cityId', cityId);
        if (districtId) params.set('districtId', districtId);
        const res = await fetch(`/api/schools/search?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        setSchoolResults(data.items || []);
      } catch {
        // arama isteği iptal edilmiş olabilir, sorun değil
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [schoolQuery, cityId, districtId]);

  const filteredCities = cityQuery.trim()
    ? cities.filter((c) => trFold(c.label).includes(trFold(cityQuery.trim())))
    : cities;
  const filteredDistricts = districtQuery.trim()
    ? districts.filter((d) => trFold(d.label).includes(trFold(districtQuery.trim())))
    : districts;

  function pickCity(option: ComboboxOption) {
    setCityId(String(option.id));
    setCityQuery(option.label);
    setDistrictId('');
    setDistrictQuery('');
  }

  function pickDistrict(option: ComboboxOption) {
    setDistrictId(String(option.id));
    setDistrictQuery(option.label);
  }

  function pickSchool(school: SchoolResult) {
    setSchoolId(school.id);
    setSchoolQuery(school.name);
  }

  const showNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 4000);
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/profile/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patch: {
          grade_id: gradeId ? Number(gradeId) : null,
          city_id: cityId ? Number(cityId) : null,
          district_id: districtId ? Number(districtId) : null,
          school_id: schoolId,
          school_name: schoolQuery.trim() || null,
        },
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Kaydedilemedi');
      return;
    }
    showNotice('success', 'Bilgiler kaydedildi');
    setEditing(false);
  }

  return (
    <div className="bg-surface-elevated border border-default rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-default flex items-center gap-2">
          <span className="text-xl">🏫</span> Okul Bilgileri
        </h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-indigo-500 hover:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
          >
            Düzenle
          </button>
        )}
      </div>

      {notice && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          <span>{notice.kind === 'success' ? '✅' : '⚠️'}</span>
          {notice.text}
        </div>
      )}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-full text-sm border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 flex items-center gap-1.5">
            🎓 {currentGradeName || 'Sınıf belirtilmemiş'}
          </span>
          <span className="px-3 py-1.5 rounded-full text-sm border bg-surface text-muted-foreground border-default flex items-center gap-1.5">
            📍 {currentCityName ? `${currentCityName}${currentDistrictName ? ' / ' + currentDistrictName : ''}` : 'Şehir belirtilmemiş'}
          </span>
          <span className="px-3 py-1.5 rounded-full text-sm border bg-surface text-muted-foreground border-default flex items-center gap-1.5">
            🏫 {schoolQuery || 'Okul belirtilmemiş'}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-muted-foreground text-xs font-medium mb-1.5">Sınıf</label>
              <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow">
                <option value="">Seçiniz</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-muted-foreground text-xs font-medium mb-1.5">İl</label>
              <SearchCombobox
                query={cityQuery}
                onQueryChange={(q) => { setCityQuery(q); setCityId(''); setDistrictId(''); setDistrictQuery(''); }}
                options={filteredCities.map((c) => ({ id: c.id, label: c.label }))}
                onSelect={(o) => pickCity(o)}
                placeholder="İl yazmaya başlayın..."
                emptyText="Sonuç yok"
              />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs font-medium mb-1.5">İlçe</label>
              <SearchCombobox
                query={districtQuery}
                onQueryChange={(q) => { setDistrictQuery(q); setDistrictId(''); }}
                options={filteredDistricts.map((d) => ({ id: d.id, label: d.label }))}
                onSelect={(o) => pickDistrict(o)}
                placeholder={cityId ? 'İlçe yazmaya başlayın...' : 'Önce il seçin'}
                disabled={!cityId}
                emptyText="Sonuç yok"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-1.5">Okul</label>
            <SearchCombobox
              query={schoolQuery}
              onQueryChange={(q) => { setSchoolQuery(q); setSchoolId(null); }}
              options={schoolResults.map((s) => ({ id: s.id, label: s.name, sublabel: SCHOOL_TYPE_LABELS[s.school_type] || s.school_type }))}
              onSelect={(o) => {
                const school = schoolResults.find((s) => s.id === o.id);
                if (school) pickSchool(school);
              }}
              placeholder="Okul adını yazmaya başlayın..."
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {schoolId ? '✓ Listeden seçildi.' : 'Listede bulamazsanız yazdığınız isim olduğu gibi kaydedilir.'}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl bg-surface border border-default text-muted-foreground hover:bg-surface-elevated text-sm font-medium transition-colors">
              İptal
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
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

function MyCommentsCard({ comments }: { comments: MyComment[] | null }) {
  return (
    <div className="bg-surface-elevated border border-default rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '440ms' }}>
      <h3 className="text-lg font-semibold text-default flex items-center gap-2 mb-4">
        <span className="text-xl">💬</span> Yorumlarım
      </h3>

      {comments === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-default animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz bir soru veya üniteye yorum yazmadın.</p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((c) => {
            const statusInfo = COMMENT_STATUS_LABELS[c.status] || COMMENT_STATUS_LABELS.pending;
            const body = (
              <div className="rounded-xl bg-surface border border-default p-3.5 hover:border-indigo-500/30 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  {c.contextLabel && (
                    <span className="text-xs text-indigo-400 font-medium truncate">{c.contextLabel}</span>
                  )}
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusInfo.className}`}>
                    {statusInfo.text}
                  </span>
                </div>
                <p className="text-sm text-default break-words">{c.body}</p>
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
    </div>
  );
}
