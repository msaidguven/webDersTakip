'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { UnitImportPayload } from '@/app/src/lib/mebScraper';

type LookupRow = { id: number; label: string };
type MebLessonRow = { slug: string; name: string };

type ScanRow = {
  title: string;
  sourceUrl: string;
  durationHours: number | null;
  topicCount: number;
  outcomeCount: number;
  status: 'ready' | 'needs_review' | 'duplicate';
  payload?: UnitImportPayload;
};

const STATUS_LABEL: Record<ScanRow['status'], string> = {
  ready: 'Hazır',
  needs_review: 'İncelenmeli',
  duplicate: 'Zaten Var',
};
const STATUS_CLASS: Record<ScanRow['status'], string> = {
  ready: 'bg-emerald-500/20 text-emerald-300',
  needs_review: 'bg-amber-500/20 text-amber-300',
  duplicate: 'bg-gray-500/20 text-gray-400',
};

export default function UnitBotTab() {
  const [grades, setGrades] = useState<LookupRow[]>([]);
  const [lessons, setLessons] = useState<LookupRow[]>([]);
  const [mebLessons, setMebLessons] = useState<MebLessonRow[]>([]);

  const [gradeId, setGradeId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [mebDersSlug, setMebDersSlug] = useState('');

  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: gradesData } = await supabase.from('grades').select('id, name').order('order_no');
      setGrades(((gradesData as { id: number; name: string }[] | null) || []).map((g) => ({ id: g.id, label: g.name })));
      const { data: lessonsData } = await supabase.from('lessons').select('id, name').order('order_no');
      setLessons(((lessonsData as { id: number; name: string }[] | null) || []).map((l) => ({ id: l.id, label: l.name })));
    })();

    (async () => {
      const res = await fetch('/api/admin/manage/units/meb-scan');
      const data = await res.json();
      if (res.ok) setMebLessons(data.lessons || []);
    })();
  }, []);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  async function handleScan() {
    const gradeLabel = grades.find((g) => String(g.id) === gradeId)?.label || '';
    const gradeNumber = Number(gradeLabel.match(/^(\d+)/)?.[1]);
    if (!mebDersSlug || !lessonId || !gradeId || !Number.isFinite(gradeNumber)) {
      showNotice('error', 'MEB dersi, hedef ders ve sınıf seçin');
      return;
    }

    setScanning(true);
    setRows([]);
    setChecked(new Set());
    try {
      const res = await fetch('/api/admin/manage/units/meb-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mebDersSlug, lessonId: Number(lessonId), gradeId: Number(gradeId), gradeNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Tarama başarısız');
        return;
      }
      const scanned: ScanRow[] = data.units || [];
      setRows(scanned);
      setChecked(new Set(scanned.map((r, i) => (r.status === 'ready' ? i : -1)).filter((i) => i >= 0)));
      showNotice('success', `${scanned.length} ünite bulundu`);
    } catch {
      showNotice('error', 'Tarama sırasında hata oluştu');
    } finally {
      setScanning(false);
    }
  }

  function toggleChecked(i: number) {
    const next = new Set(checked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setChecked(next);
  }

  async function handleSaveAll() {
    const payloads = Array.from(checked)
      .map((i) => rows[i]?.payload)
      .filter((p): p is UnitImportPayload => !!p);

    if (!payloads.length) {
      showNotice('error', 'Kaydedilecek işaretli ünite yok');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/manage/units/meb-bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: Number(lessonId), gradeId: Number(gradeId), units: payloads }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Kaydedilemedi');
        return;
      }
      const parts = [`${data.created?.length ?? 0} ünite oluşturuldu`];
      if (data.skipped?.length) parts.push(`${data.skipped.length} atlandı`);
      if (data.weekRecalc?.warnings?.length) parts.push(...data.weekRecalc.warnings);
      showNotice(data.skipped?.length || data.weekRecalc?.warnings?.length ? 'error' : 'success', parts.join(' • '));
      handleScan();
    } catch {
      showNotice('error', 'Kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Üniteler (MEB Botu)</h2>
        <p className="text-sm sm:text-base text-gray-400">MEB müfredat sitesinden ders+sınıfa ait tüm üniteleri otomatik bulur ve verilerini çeker</p>
      </header>

      {notice && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-[#111114] rounded-xl border border-white/5 p-3 sm:p-4 mb-4 flex flex-wrap gap-3 items-end">
        <LookupSelect label="MEB Dersi" value={mebDersSlug} onChange={setMebDersSlug} options={mebLessons.map((l) => ({ id: l.slug, label: l.name }))} idType="string" />
        <LookupSelect label="Sınıf" value={gradeId} onChange={setGradeId} options={grades} idType="number" />
        <LookupSelect label="Hedef Ders (bizim sistemde)" value={lessonId} onChange={setLessonId} options={lessons} idType="number" />
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {scanning ? 'Taranıyor...' : 'Tara'}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="bg-[#111114] rounded-xl border border-white/5 overflow-x-auto mb-4">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 text-xs uppercase">
                <th className="p-3 text-left w-10"></th>
                <th className="p-3 text-left font-medium">Başlık</th>
                <th className="p-3 text-left font-medium">Süre</th>
                <th className="p-3 text-left font-medium">Konu</th>
                <th className="p-3 text-left font-medium">Kazanım</th>
                <th className="p-3 text-left font-medium">Durum</th>
                <th className="p-3 text-left font-medium">Kaynak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      disabled={r.status !== 'ready'}
                      onChange={() => toggleChecked(i)}
                      className="accent-indigo-500 disabled:opacity-30"
                    />
                  </td>
                  <td className="p-3 text-gray-200">{r.title}</td>
                  <td className="p-3 text-gray-200">{r.durationHours ?? '—'}</td>
                  <td className="p-3 text-gray-200">{r.topicCount}</td>
                  <td className="p-3 text-gray-200">{r.outcomeCount}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === 'needs_review' && (
                      <p className="text-gray-500 text-xs mt-1">Konu/kazanım sayısı uyuşmuyor — MEB sayfasını açıp mevcut &quot;JSON&apos;dan İçe Aktar&quot; aracıyla elle ekleyin.</p>
                    )}
                  </td>
                  <td className="p-3">
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs">
                      MEB&apos;de aç
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <button
          onClick={handleSaveAll}
          disabled={saving || checked.size === 0}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : `İşaretlenenleri Kaydet (${checked.size})`}
        </button>
      )}
    </div>
  );
}

function LookupSelect({
  label,
  value,
  onChange,
  options,
  idType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: number | string; label: string }[];
  idType: 'number' | 'string';
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-gray-400 text-xs">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm w-48 sm:w-56"
      >
        <option value="">Seçin</option>
        {options.map((o) => (
          <option key={`${idType}-${o.id}`} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
