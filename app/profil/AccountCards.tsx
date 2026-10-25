'use client';

// Profil → Ayarlar sayfasının "Hesap" ve "Okul" kartları (2026-10-20: profil sayfasından taşındı;
// davranış aynı). Veri /api/profile/update üzerinden okunur/yazılır.
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import SearchCombobox, { type ComboboxOption } from '@/app/src/components/SearchCombobox';
import { USERNAME_PATTERN, USERNAME_RULES_MESSAGE, normalizeUsernameInput } from '@/app/src/lib/username';
import { clearMyProfileCache } from '@/app/src/lib/myProfileClient';
import type { ProfileRow } from './ProfilClient';
import r from '@/app/src/components/robotic/robotic.module.css';

// ==================== KİŞİSEL BİLGİLER ====================

export function PersonalInfoCard({
  initialFullName,
  initialUsername,
  initialNickname,
  initialUseNickname,
  onSaved,
}: {
  initialFullName: string;
  initialUsername: string | null;
  initialNickname: string | null;
  initialUseNickname: boolean;
  onSaved: (name: string, username: string | null, nickname: string | null, useNickname: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialFullName);
  const [uname, setUname] = useState(initialUsername ?? '');
  // Haftalık sıralamada tam ad yerine görünecek takma ad (bkz. leaderboard_full_names_and_nickname.sql).
  const [nick, setNick] = useState(initialNickname ?? '');
  const [useNick, setUseNick] = useState(initialUseNickname);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const showNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 4000);
  }, []);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showNotice('error', 'Ad soyad boş olamaz');
      return;
    }
    const trimmedUsername = uname.trim().toLowerCase();
    if (trimmedUsername && !USERNAME_PATTERN.test(trimmedUsername)) {
      showNotice('error', USERNAME_RULES_MESSAGE);
      return;
    }
    const trimmedNick = nick.replace(/\s+/g, ' ').trim();
    if (useNick && trimmedNick.length < 2) {
      showNotice('error', 'Sıralamada takma adın görünsün istiyorsan en az 2 karakterlik bir takma ad yaz');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    clearMyProfileCache(); // profil değişiyor — 30 dk'lık istemci kopyası bayatlamasın (myProfileClient.ts)
    const [res] = await Promise.all([
      fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patch: { full_name: trimmedName, username: trimmedUsername || null, nickname: trimmedNick || null, use_nickname: useNick && !!trimmedNick },
        }),
      }),
      supabase.auth.updateUser({ data: { full_name: trimmedName } }),
    ]);
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Kaydedilemedi');
      return;
    }
    onSaved(trimmedName, trimmedUsername || null, trimmedNick || null, useNick && !!trimmedNick);
    showNotice('success', 'Bilgiler kaydedildi');
    setEditing(false);
  }

  return (
    <div className={`p-6 ${r.panel}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-bold uppercase text-default ${r.display}`}>Kişisel Bilgiler</h2>
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
            🙋 {initialFullName || 'Ad belirtilmemiş'}
          </span>
          <span className="px-3 py-1.5 rounded-full text-sm border bg-surface text-muted-foreground border-default flex items-center gap-1.5">
            @ {initialUsername || 'Kullanıcı adı belirtilmemiş'}
          </span>
          <span className="px-3 py-1.5 rounded-full text-sm border bg-surface text-muted-foreground border-default flex items-center gap-1.5">
            🏆 Sıralamada: {initialUseNickname && initialNickname ? initialNickname : initialFullName || 'Öğrenci'}
          </span>
        </div>
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
          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-1.5">Kullanıcı Adı</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <input
                type="text"
                value={uname}
                onChange={(e) => setUname(normalizeUsernameInput(e.target.value))}
                maxLength={30}
                placeholder="kullanici_adi"
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-surface border border-default text-default text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Yorumlarında gerçek adın yerine bu görünür. Boş bırakırsan &quot;Öğrenci&quot; yazar.
            </p>
          </div>
          <div>
            <label htmlFor="takma-ad" className="block text-muted-foreground text-xs font-medium mb-1.5">Takma Ad</label>
            <input
              id="takma-ad"
              type="text"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={24}
              placeholder="ör. Kuantum Ayşe"
              className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
            />
            <label className="mt-2.5 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-default">
              <input
                type="checkbox"
                checked={useNick}
                onChange={(e) => setUseNick(e.target.checked)}
                className="h-4 w-4 rounded border-default accent-indigo-600"
              />
              Haftalık sıralamada adım yerine takma adım görünsün
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Seçmezsen sıralamada ad soyadın görünür (anasayfadaki &quot;Bu haftanın en çalışkanları&quot; listesi dahil).
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setEditing(false); setName(initialFullName); setUname(initialUsername ?? ''); setNick(initialNickname ?? ''); setUseNick(initialUseNickname); }}
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

export function SchoolInfoCard({ initialProfile }: { initialProfile: ProfileRow | null }) {
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
    clearMyProfileCache(); // profil değişiyor — 30 dk'lık istemci kopyası bayatlamasın (myProfileClient.ts)
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
    <div className={`p-6 ${r.panel}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-bold uppercase text-default ${r.display}`}>Okul Bilgileri</h2>
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

