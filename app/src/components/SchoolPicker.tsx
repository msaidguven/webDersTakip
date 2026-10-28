'use client';

// İl → ilçe → okul seçici (2026-10-28, profil "Okul Bilgileri" kartından ayrıldı; öğretmen kaydında da zorunlu
// alan olarak kullanılıyor). İl/ilçe listeleri herkese açık tablolar (cities, districts), okul araması
// /api/schools/search. Listede olmayan okul adı yazıldığı gibi kalır (schoolId null).
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import SearchCombobox from '@/app/src/components/SearchCombobox';

export type SchoolValue = { cityId: number | null; districtId: number | null; schoolId: number | null; schoolName: string };
type LookupRow = { id: number; label: string };
type SchoolResult = { id: number; name: string; school_type: string };

const SCHOOL_TYPE_LABELS: Record<string, string> = {
  anaokulu: 'Anaokulu',
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
};

function trFold(s: string) {
  return s.toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i');
}

export function SchoolPicker({ value, onChange, labelClassName = 'block text-muted-foreground text-xs font-medium mb-1.5' }: {
  value: SchoolValue;
  onChange: (value: SchoolValue) => void;
  labelClassName?: string;
}) {
  const [cities, setCities] = useState<LookupRow[]>([]);
  const [districts, setDistricts] = useState<LookupRow[]>([]);
  const [cityQuery, setCityQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<SchoolResult[]>([]);
  const { cityId, districtId, schoolId, schoolName } = value;

  useEffect(() => {
    createClient().from('cities').select('id, name').order('name').then(({ data }) => {
      const rows = ((data as { id: number; name: string }[] | null) || []).map((c) => ({ id: c.id, label: c.name }));
      setCities(rows);
      // Kayıtlı il varsa arama kutusu adıyla dolsun.
      if (cityId) setCityQuery((q) => q || rows.find((c) => c.id === cityId)?.label || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cityId) return;
    createClient().from('districts').select('id, name').eq('city_id', cityId).order('name').then(({ data }) => {
      const rows = ((data as { id: number; name: string }[] | null) || []).map((d) => ({ id: d.id, label: d.name }));
      setDistricts(rows);
      if (districtId) setDistrictQuery((q) => q || rows.find((d) => d.id === districtId)?.label || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  useEffect(() => {
    if (schoolName.trim().length < 1 || schoolId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: schoolName.trim() });
        if (cityId) params.set('cityId', String(cityId));
        if (districtId) params.set('districtId', String(districtId));
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
  }, [schoolName, schoolId, cityId, districtId]);

  const filteredCities = cityQuery.trim() ? cities.filter((c) => trFold(c.label).includes(trFold(cityQuery.trim()))) : cities;
  const filteredDistricts = districtQuery.trim() ? districts.filter((d) => trFold(d.label).includes(trFold(districtQuery.trim()))) : districts;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>İl</label>
          <SearchCombobox
            query={cityQuery}
            onQueryChange={(q) => {
              setCityQuery(q);
              setDistrictQuery('');
              setDistricts([]);
              onChange({ ...value, cityId: null, districtId: null });
            }}
            options={filteredCities}
            onSelect={(o) => {
              setCityQuery(o.label);
              setDistrictQuery('');
              onChange({ ...value, cityId: o.id, districtId: null });
            }}
            placeholder="İl yazmaya başlayın..."
            emptyText="Sonuç yok"
          />
        </div>
        <div>
          <label className={labelClassName}>İlçe</label>
          <SearchCombobox
            query={districtQuery}
            onQueryChange={(q) => {
              setDistrictQuery(q);
              onChange({ ...value, districtId: null });
            }}
            options={filteredDistricts}
            onSelect={(o) => {
              setDistrictQuery(o.label);
              onChange({ ...value, districtId: o.id });
            }}
            placeholder={cityId ? 'İlçe yazmaya başlayın...' : 'Önce il seçin'}
            disabled={!cityId}
            emptyText="Sonuç yok"
          />
        </div>
      </div>
      <div>
        <label className={labelClassName}>Okul</label>
        <SearchCombobox
          query={schoolName}
          onQueryChange={(q) => onChange({ ...value, schoolId: null, schoolName: q })}
          options={schoolResults.map((s) => ({ id: s.id, label: s.name, sublabel: SCHOOL_TYPE_LABELS[s.school_type] || s.school_type }))}
          onSelect={(o) => onChange({ ...value, schoolId: o.id, schoolName: o.label })}
          placeholder="Okul adını yazmaya başlayın..."
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {schoolId ? '✓ Listeden seçildi.' : 'Listede bulamazsanız yazdığınız isim olduğu gibi kaydedilir.'}
        </p>
      </div>
    </div>
  );
}
