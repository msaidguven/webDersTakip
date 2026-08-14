'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import SearchCombobox, { type ComboboxOption } from '@/app/src/components/SearchCombobox';

interface ProfileRow {
  grade_id: number | null;
  city_id: number | null;
  district_id: number | null;
  school_id: number | null;
  school_name: string | null;
}

interface ProfilClientProps {
  user: {
    id: string;
    email: string | undefined;
    fullName: string;
    avatarUrl: string | null;
  };
  profile: ProfileRow | null;
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

export default function ProfilClient({ user, profile }: ProfilClientProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  
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
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-default transition-colors">
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
              <p className="text-muted-foreground mb-3">{user.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 rounded-full text-sm border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">8. Sinif</span>
                <span className="px-3 py-1 rounded-full text-sm border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Aktif Uye</span>
              </div>
            </div>

            <button onClick={handleSignOut} className="px-5 py-2.5 rounded-xl bg-surface border border-default text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all">
              Cikis Yap
            </button>
          </div>
        </div>

        {/* Okul Bilgileri */}
        <SchoolInfoCard initialProfile={profile} />
      </main>
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
    <div className="bg-surface-elevated border border-default rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-default">Okul Bilgileri</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-sm text-indigo-500 hover:text-indigo-400">
            Düzenle
          </button>
        )}
      </div>

      {notice && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {notice.text}
        </div>
      )}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-sm border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{currentGradeName || 'Sınıf belirtilmemiş'}</span>
          <span className="px-3 py-1 rounded-full text-sm border bg-surface text-muted-foreground border-default">{currentCityName ? `${currentCityName}${currentDistrictName ? ' / ' + currentDistrictName : ''}` : 'Şehir belirtilmemiş'}</span>
          <span className="px-3 py-1 rounded-full text-sm border bg-surface text-muted-foreground border-default">{schoolQuery || 'Okul belirtilmemiş'}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-muted-foreground text-xs mb-1">Sınıf</label>
              <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-sm">
                <option value="">Seçiniz</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">İl</label>
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
              <label className="block text-muted-foreground text-xs mb-1">İlçe</label>
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
            <label className="block text-muted-foreground text-xs mb-1">Okul</label>
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
            <p className="text-xs text-muted-foreground mt-1">
              {schoolId ? 'Listeden seçildi.' : 'Listede bulamazsanız yazdığınız isim olduğu gibi kaydedilir.'}
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl bg-surface border border-default text-muted-foreground hover:bg-surface-elevated text-sm">
              İptal
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
