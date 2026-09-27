'use client';

import { useEffect, useState } from 'react';
import { TOPIC_PAGE_DESIGN_KEY, type TopicPageDesign } from '@/app/src/lib/topicPageDesign';

const DESIGN_OPTIONS: { value: TopicPageDesign; title: string; description: string }[] = [
  { value: 'v1', title: 'v1 — Klasik', description: 'Üstte sınıf/ders/ünite/konu seçicileri, çalışma modu kartları ve sağ sütun (kazanımlar, takvim).' },
  { value: 'v2', title: 'v2 — Modern', description: 'Öğrenme yolu, kavram ızgarası, okuma ilerlemeli bölüm listesi ve sade tek sütun okuma.' },
];

// Admin → Ayarlar. Her ayar ayrı bir bölüm; değişiklik "kaydet" ile değil, onaylanınca anında
// yayına girer (site geneli etkisi olduğu için ayrı bir onay adımı var).
export default function SiteSettingsPanel() {
  const [design, setDesign] = useState<TopicPageDesign | null>(null);
  const [samplePath, setSamplePath] = useState<string | null>(null);
  const [pending, setPending] = useState<TopicPageDesign | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/site-settings')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Ayarlar yüklenemedi');
        setDesign(data.settings?.[TOPIC_PAGE_DESIGN_KEY] ?? 'v1');
        setSamplePath(data.samplePath ?? null);
      })
      .catch((e) => { if (!cancelled) setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Ayarlar yüklenemedi' }); });
    return () => { cancelled = true; };
  }, []);

  async function publish(next: TopicPageDesign) {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: TOPIC_PAGE_DESIGN_KEY, value: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
      setDesign(next);
      setPending(null);
      setNotice({ kind: 'success', text: `Konu sayfaları artık herkese ${next} ile gösteriliyor.` });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Kaydedilemedi' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-sm ${notice.kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300'}`}
        >
          {notice.text}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card" aria-labelledby="setting-topic-design">
        <header className="border-b border-border px-5 py-4">
          <h2 id="setting-topic-design" className="font-semibold text-foreground">Konu sayfası tasarımı</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm konu anlatımı sayfalarında herkesin gördüğü tasarım. Değişiklik onaylandığı anda yayına girer.
          </p>
        </header>

        <div className="space-y-3 p-5">
          {design === null && !notice ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            DESIGN_OPTIONS.map((opt) => {
              const live = design === opt.value;
              return (
                <div
                  key={opt.value}
                  className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${live ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-border'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      {opt.title}
                      {live && <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[11px] font-semibold text-white">Yayında</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{opt.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {samplePath && (
                      <a
                        href={`${samplePath}?tasarim=${opt.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
                      >
                        Önizle ↗
                      </a>
                    )}
                    {!live && design !== null && (
                      <button
                        type="button"
                        onClick={() => setPending(opt.value)}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Bunu yayınla
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {pending && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-foreground">
                Tüm konu sayfaları herkese <b>{pending}</b> ile gösterilecek. Onaylıyor musun?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => publish(pending)}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? 'Yayınlanıyor…' : 'Evet, yayınla'}
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  disabled={saving}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
