'use client';

import { useCallback, useEffect, useState } from 'react';

type EntityType = 'unit' | 'topic';
type Candidate = { id: number; entityType: EntityType; currentTitle: string; code: string; cleanTitle: string };

const ENTITY_LABELS: Record<EntityType, string> = { unit: 'Ünite', topic: 'Konu' };

function rowKey(c: Candidate) {
  return `${c.entityType}-${c.id}`;
}

export default function CodeCleanupPanel() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [unitsAvailable, setUnitsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const showNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }, []);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/manage/code-cleanup');
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Tarama başarısız');
        return;
      }
      setCandidates(data.candidates || []);
      setUnitsAvailable(data.unitsAvailable !== false);
      setSelected(new Set());
    } catch {
      showNotice('error', 'Tarama başarısız');
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    scan();
  }, [scan]);

  function toggleSelect(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function toggleSelectAll() {
    if (selected.size === candidates.length) setSelected(new Set());
    else setSelected(new Set(candidates.map(rowKey)));
  }

  async function applyItems(items: Candidate[]) {
    setApplying(true);
    try {
      const res = await fetch('/api/admin/manage/code-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((c) => ({ id: c.id, entityType: c.entityType, code: c.code, title: c.cleanTitle })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Uygulanamadı');
        return;
      }
      const failedCount = data.failed?.length || 0;
      if (failedCount) {
        showNotice('error', `${data.applied.length} uygulandı, ${failedCount} başarısız`);
      } else {
        showNotice('success', `${data.applied.length} kayıt güncellendi`);
      }
      await scan();
    } catch {
      showNotice('error', 'Uygulanamadı (ağ hatası)');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Kod Temizliği</h2>
        <p className="text-sm sm:text-base text-gray-400">
          Başlığının başında müfredat kodu (ör. &quot;BT.6.3.1.&quot;) bulunan ünite/konuları tespit eder; kodu curriculum_code
          alanına taşıyıp başlığı temizler.
        </p>
      </header>

      {notice && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm max-w-3xl ${
            notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
          }`}
        >
          {notice.text}
        </div>
      )}

      {!unitsAvailable && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm max-w-3xl bg-amber-500/10 text-amber-300 border border-amber-500/30">
          Üniteler için curriculum_code sütunu henüz eklenmemiş. <code className="bg-black/30 px-1 rounded">supabase/units_curriculum_code.sql</code>{' '}
          dosyasını Supabase SQL Editor&apos;de çalıştırırsanız ünite taraması da aktif olur.
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <button onClick={scan} disabled={loading} className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-sm disabled:opacity-50">
          {loading ? 'Taranıyor...' : 'Yeniden Tara'}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => applyItems(candidates.filter((c) => selected.has(rowKey(c))))}
            disabled={applying}
            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-sm disabled:opacity-50"
          >
            {applying ? 'Uygulanıyor...' : `Seçilenleri Uygula (${selected.size})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-[#111114] rounded-xl border border-white/5 p-8 sm:p-12 text-center">
          <p className="text-gray-400 text-sm">Taranıyor...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-[#111114] rounded-xl border border-white/5 p-8 sm:p-12 text-center">
          <p className="text-gray-400 text-sm">Temizlenecek başlık bulunamadı — hepsi temiz.</p>
        </div>
      ) : (
        <div className="bg-[#111114] rounded-xl border border-white/5 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 text-xs uppercase">
                <th className="p-3 text-left w-10">
                  <input type="checkbox" checked={selected.size > 0 && selected.size === candidates.length} onChange={toggleSelectAll} className="accent-indigo-500" />
                </th>
                <th className="p-3 text-left font-medium">Tür</th>
                <th className="p-3 text-left font-medium">Mevcut Başlık</th>
                <th className="p-3 text-left font-medium">Kod</th>
                <th className="p-3 text-left font-medium">Yeni Başlık</th>
                <th className="p-3 text-right w-28">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {candidates.map((c) => (
                <tr key={rowKey(c)} className="hover:bg-white/5">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(rowKey(c))} onChange={() => toggleSelect(rowKey(c))} className="accent-indigo-500" />
                  </td>
                  <td className="p-3 text-gray-400">{ENTITY_LABELS[c.entityType]}</td>
                  <td className="p-3 text-gray-300 max-w-xs truncate">{c.currentTitle}</td>
                  <td className="p-3">
                    <code className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs">{c.code}</code>
                  </td>
                  <td className="p-3 text-white max-w-xs truncate">{c.cleanTitle}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => applyItems([c])} disabled={applying} className="text-indigo-400 hover:text-indigo-300 text-xs disabled:opacity-50">
                      Uygula
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
