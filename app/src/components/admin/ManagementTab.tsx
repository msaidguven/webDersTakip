'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { buildSvgGenerationPrompt } from '@/app/src/lib/svgPromptRules';

// ==================== TYPES ====================

export type EntityKey = 'units' | 'topics' | 'sections' | 'contents' | 'outcomes' | 'questions';

type LookupRow = { id: number; label: string };

// Sunucudan gelen satırlar tabloya/entity'ye göre farklı şekillerde (join'li alanlar dahil)
// geldiği için burada bilinçli olarak gevşek tipliyoruz.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select';

type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  rows?: number;
};

type ColumnConfig = {
  key: string;
  label: string;
  render?: (row: Row) => React.ReactNode;
};

type ExtraFilterConfig = {
  key: string; // API'ye gönderilecek query param adı
  label: string;
  options: { value: string; label: string }[];
};

export type EntityConfig = {
  key: EntityKey;
  label: string;
  needsTopic?: boolean; // liste için konu seçimi zorunlu
  hasActiveToggle?: boolean; // is_active alanı var, "sil" = pasifleştir
  columns: ColumnConfig[];
  editFields: FieldConfig[];
  extraFilters?: ExtraFilterConfig[];
};

const ACTIVE_STATUS_FILTER: ExtraFilterConfig = {
  key: 'isActive',
  label: 'Durum',
  options: [
    { value: 'true', label: 'Aktif' },
    { value: 'false', label: 'Pasif' },
  ],
};

export const ENTITIES: EntityConfig[] = [
  {
    key: 'units',
    label: 'Üniteler',
    hasActiveToggle: true,
    extraFilters: [ACTIVE_STATUS_FILTER],
    columns: [
      { key: 'title', label: 'Başlık' },
      { key: 'lesson', label: 'Ders', render: (r) => r.lessons?.name || '—' },
      { key: 'order_no', label: 'Sıra' },
      { key: 'duration_hours', label: 'Süre (saat)' },
      { key: 'weeks', label: 'Hafta', render: (r) => (r.start_week && r.end_week ? `${r.start_week}-${r.end_week}` : '—') },
      { key: 'question_count', label: 'Soru' },
      { key: 'is_active', label: 'Durum', render: (r) => <StatusBadge active={r.is_active} /> },
    ],
    editFields: [
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'description', label: 'Açıklama', type: 'textarea', rows: 3 },
      { key: 'order_no', label: 'Sıra No', type: 'number' },
      { key: 'curriculum_code', label: 'Müfredat Kodu', type: 'text' },
      { key: 'duration_hours', label: 'Süre (ders saati)', type: 'number' },
      { key: 'start_week', label: 'Başlangıç Haftası', type: 'number' },
      { key: 'end_week', label: 'Bitiş Haftası', type: 'number' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
  },
  {
    key: 'topics',
    label: 'Konular',
    hasActiveToggle: true,
    extraFilters: [ACTIVE_STATUS_FILTER],
    columns: [
      { key: 'title', label: 'Başlık' },
      { key: 'unit', label: 'Ünite', render: (r) => r.units?.title || '—' },
      { key: 'order_no', label: 'Sıra' },
      { key: 'curriculum_code', label: 'Kod' },
      { key: 'question_count', label: 'Soru' },
      { key: 'is_active', label: 'Durum', render: (r) => <StatusBadge active={r.is_active} /> },
    ],
    editFields: [
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'subtitle', label: 'Alt Başlık', type: 'text' },
      { key: 'order_no', label: 'Sıra No', type: 'number' },
      { key: 'curriculum_code', label: 'Müfredat Kodu', type: 'text' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
  },
  {
    key: 'sections',
    label: 'Alt Başlıklar',
    needsTopic: true,
    extraFilters: [
      {
        key: 'status',
        label: 'Durum',
        options: [
          { value: 'planned', label: 'Planlandı' },
          { value: 'content_ready', label: 'İçerik Hazır' },
          { value: 'image_ready', label: 'Görsel Hazır' },
          { value: 'published', label: 'Yayında' },
        ],
      },
    ],
    columns: [
      { key: 'order_no', label: 'Sıra' },
      { key: 'heading', label: 'Başlık' },
      { key: 'status', label: 'Durum', render: (r) => <SectionStatusBadge status={r.status} /> },
      { key: 'body_markdown', label: 'İçerik', render: (r) => (r.body_markdown ? `${r.body_markdown.length} karakter` : 'Boş') },
    ],
    editFields: [
      { key: 'heading', label: 'Başlık', type: 'text' },
      { key: 'order_no', label: 'Sıra No', type: 'number' },
      {
        key: 'status',
        label: 'Durum',
        type: 'select',
        options: [
          { value: 'planned', label: 'Planlandı' },
          { value: 'content_ready', label: 'İçerik Hazır' },
          { value: 'image_ready', label: 'Görsel Hazır' },
          { value: 'published', label: 'Yayında' },
        ],
      },
      { key: 'body_markdown', label: 'İçerik (Markdown)', type: 'textarea', rows: 10 },
    ],
  },
  {
    key: 'contents',
    label: 'İçerikler',
    extraFilters: [
      {
        key: 'source',
        label: 'Kaynak',
        options: [
          { value: 'manual', label: 'Manuel' },
          { value: 'ai_generated', label: 'AI Üretildi' },
        ],
      },
      {
        key: 'isPublished',
        label: 'Yayın',
        options: [
          { value: 'true', label: 'Yayında' },
          { value: 'false', label: 'Taslak' },
        ],
      },
    ],
    columns: [
      { key: 'title', label: 'Başlık' },
      { key: 'topic', label: 'Konu', render: (r) => r.topics?.title || '—' },
      { key: 'is_published', label: 'Yayın', render: (r) => <StatusBadge active={r.is_published} activeLabel="Yayında" inactiveLabel="Taslak" /> },
      { key: 'source', label: 'Kaynak' },
      { key: 'version_no', label: 'Versiyon' },
    ],
    editFields: [
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'subtitle', label: 'Alt Başlık', type: 'text' },
      { key: 'is_published', label: 'Yayında', type: 'boolean' },
      { key: 'body_markdown', label: 'İçerik (Markdown)', type: 'textarea', rows: 12 },
    ],
  },
  {
    key: 'outcomes',
    label: 'Kazanımlar',
    needsTopic: true,
    columns: [
      { key: 'code', label: 'Kod' },
      { key: 'description', label: 'Açıklama' },
      { key: 'order_index', label: 'Sıra' },
      { key: 'topic', label: 'Konu', render: (r) => r.topics?.title || '—' },
    ],
    editFields: [
      { key: 'description', label: 'Açıklama', type: 'textarea', rows: 3 },
      { key: 'code', label: 'Kod', type: 'text' },
      { key: 'order_index', label: 'Sıra No', type: 'number' },
    ],
  },
  {
    key: 'questions',
    label: 'Sorular',
    extraFilters: [
      {
        key: 'difficulty',
        label: 'Zorluk',
        options: [1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `Zorluk ${d}` })),
      },
    ],
    columns: [
      { key: 'question_text', label: 'Soru', render: (r) => <span className="line-clamp-2">{r.question_text}</span> },
      { key: 'type', label: 'Tip', render: (r) => r.question_types?.code || '—' },
      { key: 'difficulty', label: 'Zorluk' },
      { key: 'score', label: 'Puan' },
    ],
    editFields: [], // Sorular özel modal ile düzenlenir (QuestionEditModal)
  },
];

function StatusBadge({ active, activeLabel = 'Aktif', inactiveLabel = 'Pasif' }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

const SECTION_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlandı',
  content_ready: 'İçerik Hazır',
  image_ready: 'Görsel Hazır',
  published: 'Yayında',
};

function SectionStatusBadge({ status }: { status: string }) {
  return <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300">{SECTION_STATUS_LABELS[status] || status}</span>;
}

// ==================== MAIN COMPONENT ====================

export default function ManagementTab({ initialEntity }: { initialEntity?: EntityKey } = {}) {
  const [entityKey, setEntityKey] = useState<EntityKey>(initialEntity || 'units');
  const entity = ENTITIES.find((e) => e.key === entityKey)!;

  const [grades, setGrades] = useState<LookupRow[]>([]);
  const [lessons, setLessons] = useState<LookupRow[]>([]);
  const [units, setUnits] = useState<LookupRow[]>([]);
  const [topics, setTopics] = useState<LookupRow[]>([]);
  const [questionTypes, setQuestionTypes] = useState<LookupRow[]>([]);

  const [gradeId, setGradeId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [typeId, setTypeId] = useState('');

  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [editRow, setEditRow] = useState<Row | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ ids: number[]; hard?: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }, []);

  // ---- lookup verilerini yükle (herkese açık okuma RLS'i ile) ----
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: gradesData } = await supabase.from('grades').select('id, name').order('order_no');
      setGrades(((gradesData as { id: number; name: string }[] | null) || []).map((g) => ({ id: g.id, label: g.name })));

      const { data: lessonsData } = await supabase.from('lessons').select('id, name').order('order_no');
      setLessons(((lessonsData as { id: number; name: string }[] | null) || []).map((l) => ({ id: l.id, label: l.name })));

      const { data: typesData } = await supabase.from('question_types').select('id, code').order('id');
      setQuestionTypes(((typesData as { id: number; code: string }[] | null) || []).map((t) => ({ id: t.id, label: t.code })));
    })();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!gradeId && !lessonId) {
      setUnits([]);
      return;
    }
    (async () => {
      let query = supabase.from('units').select('id, title').order('order_no');
      if (gradeId) query = query.eq('grade_id', gradeId);
      if (lessonId) query = query.eq('lesson_id', lessonId);
      const { data } = await query;
      setUnits(((data as { id: number; title: string }[] | null) || []).map((u) => ({ id: u.id, label: u.title })));
    })();
  }, [gradeId, lessonId]);

  useEffect(() => {
    const supabase = createClient();
    if (!unitId) {
      setTopics([]);
      return;
    }
    (async () => {
      const { data } = await supabase.from('topics').select('id, title').eq('unit_id', unitId).order('order_no');
      setTopics(((data as { id: number; title: string }[] | null) || []).map((t) => ({ id: t.id, label: t.title })));
    })();
  }, [unitId]);

  // Entity değişince alt filtreleri sıfırla
  useEffect(() => {
    setSelected(new Set());
    setItems([]);
    setFilterValues({});
    setTypeId('');
  }, [entityKey]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams();
      if (entityKey === 'units') {
        if (gradeId) params.set('gradeId', gradeId);
        if (lessonId) params.set('lessonId', lessonId);
        if (search) params.set('search', search);
      } else if (entityKey === 'topics') {
        if (unitId) params.set('unitId', unitId);
        else {
          if (lessonId) params.set('lessonId', lessonId);
          if (gradeId) params.set('gradeId', gradeId);
        }
        if (search) params.set('search', search);
      } else if (entityKey === 'sections') {
        if (topicId) params.set('topicId', topicId);
      } else if (entityKey === 'contents') {
        if (topicId) params.set('topicId', topicId);
        else if (unitId) params.set('unitId', unitId);
        else {
          if (lessonId) params.set('lessonId', lessonId);
          if (gradeId) params.set('gradeId', gradeId);
        }
        if (search) params.set('search', search);
      } else if (entityKey === 'outcomes') {
        if (topicId) params.set('topicId', topicId);
        if (search) params.set('search', search);
      } else if (entityKey === 'questions') {
        if (topicId) params.set('topicId', topicId);
        else if (unitId) params.set('unitId', unitId);
        else {
          if (lessonId) params.set('lessonId', lessonId);
          if (gradeId) params.set('gradeId', gradeId);
        }
        if (search) params.set('search', search);
        if (typeId) params.set('typeId', typeId);
      }

      for (const f of entity.extraFilters || []) {
        const v = filterValues[f.key];
        if (v) params.set(f.key, v);
      }

      const res = await fetch(`/api/admin/manage/${entityKey}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Liste yüklenemedi');
        setItems([]);
        return;
      }
      setItems(data.items || []);
    } catch {
      showNotice('error', 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [entityKey, gradeId, lessonId, unitId, topicId, search, typeId, filterValues, entity.extraFilters, showNotice]);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, gradeId, lessonId, unitId, topicId, search, typeId, filterValues]);

  function toggleSelectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  function toggleSelect(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleDelete(ids: number[], hard?: boolean) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/manage/${entityKey}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, hard }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Silinemedi');
        return;
      }
      const deletedCount = data.deletedIds?.length ?? ids.length;
      const failedCount = data.failed?.length ?? 0;
      if (failedCount) {
        const reasons = (data.failed as { id: number; reason: string }[]).map((f) => `#${f.id}: ${f.reason}`).join(' • ');
        showNotice('error', `${deletedCount} kayıt silindi, ${failedCount} kayıt silinemedi — ${reasons}`);
      } else {
        showNotice('success', `${deletedCount} kayıt silindi`);
      }
      setConfirmTarget(null);
      await loadList();
    } catch {
      showNotice('error', 'Silinirken hata oluştu');
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkActive(active: boolean) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const res = await fetch(`/api/admin/manage/${entityKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, patch: { is_active: active } }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Güncellenemedi');
      return;
    }
    showNotice('success', `${ids.length} kayıt ${active ? 'aktifleştirildi' : 'pasifleştirildi'}`);
    loadList();
  }

  const listRequiresTopic = entity.needsTopic && !topicId;

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Yönetim</h2>
        <p className="text-sm sm:text-base text-muted-foreground">İçerik, soru, konu, alt konu, ünite ve kazanımları tek tek veya toplu düzenle/sil</p>
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

      {/* Entity Switcher */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            onClick={() => setEntityKey(e.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              entityKey === e.key ? 'bg-indigo-500 text-white' : 'bg-surface text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-4 mb-4 flex flex-wrap gap-2 sm:gap-3 items-end">
        <FilterSelect label="Sınıf" value={gradeId} onChange={(v) => { setGradeId(v); setUnitId(''); setTopicId(''); }} options={grades} />
        <FilterSelect label="Ders" value={lessonId} onChange={(v) => { setLessonId(v); setUnitId(''); setTopicId(''); }} options={lessons} />
        {entityKey !== 'units' && (
          <FilterSelect label="Ünite" value={unitId} onChange={(v) => { setUnitId(v); setTopicId(''); }} options={units} />
        )}
        {(entityKey === 'sections' || entityKey === 'contents' || entityKey === 'outcomes' || entityKey === 'questions') && (
          <FilterSelect label="Konu" value={topicId} onChange={setTopicId} options={topics} />
        )}
        {entityKey === 'questions' && (
          <FilterSelect label="Tip" value={typeId} onChange={setTypeId} options={questionTypes} />
        )}
        {(entity.extraFilters || []).map((f) => (
          <StaticFilterSelect
            key={f.key}
            label={f.label}
            value={filterValues[f.key] || ''}
            onChange={(v) => setFilterValues({ ...filterValues, [f.key]: v })}
            options={f.options}
          />
        ))}
        {entityKey !== 'sections' && (
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Ara</label>
            <div className="flex gap-1">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                placeholder="Metin ara..."
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm w-40 sm:w-56"
              />
              <button onClick={() => setSearch(searchInput)} className="px-3 py-2 bg-secondary hover:bg-accent rounded-lg text-foreground text-sm">
                Ara
              </button>
            </div>
          </div>
        )}
        <button onClick={loadList} className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm ml-auto">
          Yenile
        </button>
      </div>

      {entityKey === 'units' && gradeId && lessonId && (
        <UnitToolsBar
          lessonId={Number(lessonId)}
          gradeId={Number(gradeId)}
          showNotice={showNotice}
          onImported={loadList}
        />
      )}

      {/* Bulk Toolbar */}
      {selected.size > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-indigo-300 text-sm font-medium">{selected.size} kayıt seçili</span>
          <div className="flex-1" />
          {entity.hasActiveToggle && (
            <>
              <button onClick={() => handleBulkActive(true)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs sm:text-sm hover:bg-emerald-500/30">
                Aktifleştir
              </button>
              <button onClick={() => handleBulkActive(false)} className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs sm:text-sm hover:bg-accent">
                Pasifleştir
              </button>
            </>
          )}
          <button
            onClick={() => setConfirmTarget({ ids: Array.from(selected), hard: false })}
            className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-xs sm:text-sm hover:bg-red-500/30"
          >
            Seçilenleri Sil
          </button>
        </div>
      )}

      {/* List */}
      {listRequiresTopic ? (
        <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
          <p className="text-muted-foreground text-sm">Listeyi görmek için önce bir Konu seçin</p>
        </div>
      ) : loading ? (
        <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
          <p className="text-muted-foreground text-sm">Yükleniyor...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
          <p className="text-muted-foreground text-sm">Kayıt bulunamadı</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="p-3 text-left w-10">
                  <input type="checkbox" checked={selected.size > 0 && selected.size === items.length} onChange={toggleSelectAll} className="accent-indigo-500" />
                </th>
                {entity.columns.map((c) => (
                  <th key={c.key} className="p-3 text-left font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="p-3 text-right w-32">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-accent">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} className="accent-indigo-500" />
                  </td>
                  {entity.columns.map((c) => (
                    <td key={c.key} className="p-3 text-foreground max-w-xs truncate">
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditRow(row)} className="text-indigo-400 hover:text-indigo-300 text-xs mr-3">
                      Düzenle
                    </button>
                    <button onClick={() => setConfirmTarget({ ids: [row.id] })} className="text-red-400 hover:text-red-300 text-xs">
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && entityKey === 'questions' && (
        <QuestionEditModal questionId={editRow.id} onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); loadList(); }} showNotice={showNotice} />
      )}
      {editRow && entityKey !== 'questions' && (
        <GenericEditModal
          entity={entity}
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); loadList(); }}
          showNotice={showNotice}
        />
      )}

      {confirmTarget && (
        <ConfirmDeleteModal
          count={confirmTarget.ids.length}
          entityLabel={entity.label}
          allowHard={!entity.hasActiveToggle}
          deleting={deleting}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={(hard) => handleDelete(confirmTarget.ids, hard)}
        />
      )}
    </div>
  );
}

// ==================== FILTER SELECT ====================

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: LookupRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-xs">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm w-36 sm:w-44"
      >
        <option value="">Tümü</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StaticFilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-xs">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm w-36 sm:w-44"
      >
        <option value="">Tümü</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ==================== UNIT TOOLS (HAFTA HESAPLAMA) ====================

function UnitToolsBar({
  lessonId,
  gradeId,
  showNotice,
  onImported,
}: {
  lessonId: number;
  gradeId: number;
  showNotice: (kind: 'success' | 'error', text: string) => void;
  onImported: () => void;
}) {
  const [weeklyHoursInput, setWeeklyHoursInput] = useState('');
  const [savingHours, setSavingHours] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/manage/lesson-grades?lessonId=${lessonId}&gradeId=${gradeId}`);
      const data = await res.json();
      if (res.ok) setWeeklyHoursInput(data.item?.weekly_hours != null ? String(data.item.weekly_hours) : '');
    })();
  }, [lessonId, gradeId]);

  async function handleSaveWeeklyHours() {
    setSavingHours(true);
    const weeklyHours = weeklyHoursInput === '' ? null : Number(weeklyHoursInput);
    const res = await fetch('/api/admin/manage/lesson-grades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, gradeId, weeklyHours }),
    });
    const data = await res.json();
    setSavingHours(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Kaydedilemedi');
      return;
    }
    showNotice('success', 'Haftalık ders saati kaydedildi');
  }

  async function handleRecalculate() {
    setRecalculating(true);
    const res = await fetch('/api/admin/manage/units/recalculate-weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, gradeId }),
    });
    const data = await res.json();
    setRecalculating(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Hesaplanamadı');
      return;
    }
    if (data.warnings?.length) {
      showNotice('error', data.warnings.join(' • '));
    } else {
      showNotice('success', `${data.updated?.length ?? 0} ünitenin haftaları güncellendi`);
      onImported();
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-3 sm:p-4 mb-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Haftalık Ders Saati</label>
        <div className="flex gap-1">
          <input
            type="number"
            min={1}
            value={weeklyHoursInput}
            onChange={(e) => setWeeklyHoursInput(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm w-20"
          />
          <button
            onClick={handleSaveWeeklyHours}
            disabled={savingHours}
            className="px-3 py-2 bg-secondary hover:bg-accent rounded-lg text-foreground text-sm disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>
      </div>
      <button
        onClick={handleRecalculate}
        disabled={recalculating}
        className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm disabled:opacity-50"
      >
        {recalculating ? 'Hesaplanıyor...' : 'Haftaları Yeniden Hesapla'}
      </button>
    </div>
  );
}

// ==================== GENERIC EDIT MODAL ====================

export function GenericEditModal({
  entity,
  row,
  onClose,
  onSaved,
  showNotice,
}: {
  entity: EntityConfig;
  row: Row;
  onClose: () => void;
  onSaved: () => void;
  showNotice: (kind: 'success' | 'error', text: string) => void;
}) {
  const [form, setForm] = useState<Row>(row);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const patch: Row = {};
    for (const f of entity.editFields) patch[f.key] = form[f.key];

    const res = await fetch(`/api/admin/manage/${entity.key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [row.id], patch }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Kaydedilemedi');
      return;
    }
    showNotice('success', 'Kaydedildi');
    onSaved();
  }

  return (
    <ModalShell title={`${entity.label.replace(/lar$|ler$/, '')} Düzenle`} onClose={onClose}>
      <div className="space-y-3 sm:space-y-4">
        {entity.editFields.map((f) => (
          <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
        ))}
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} saving={saving} />
    </ModalShell>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldConfig; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
        <span className="text-muted-foreground text-sm">{field.label}</span>
      </label>
    );
  }
  const stringValue = value == null ? '' : String(value);
  if (field.type === 'select') {
    return (
      <div>
        <label className="block text-muted-foreground text-xs sm:text-sm mb-1">{field.label}</label>
        <select
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-foreground text-sm focus:border-indigo-500 outline-none"
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-muted-foreground text-xs sm:text-sm mb-1">{field.label}</label>
        <textarea
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows || 4}
          className="w-full bg-surface border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-foreground text-sm focus:border-indigo-500 outline-none resize-y font-mono"
        />
      </div>
    );
  }
  return (
    <div>
      <label className="block text-muted-foreground text-xs sm:text-sm mb-1">{field.label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={stringValue}
        onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        className="w-full bg-surface border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-foreground text-sm focus:border-indigo-500 outline-none"
      />
    </div>
  );
}

// ==================== QUESTION EDIT MODAL ====================

type Choice = { id?: number; choice_text: string; is_correct: boolean };
type BlankOption = { id?: number; option_text: string; is_correct: boolean; order_no: number };
type MatchingPair = { id?: number; left_text: string; right_text: string; order_no: number };

export function QuestionEditModal({
  questionId,
  onClose,
  onSaved,
  showNotice,
}: {
  questionId: number;
  onClose: () => void;
  onSaved: () => void;
  showNotice: (kind: 'success' | 'error', text: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [difficulty, setDifficulty] = useState(1);
  const [score, setScore] = useState(1);
  const [solutionText, setSolutionText] = useState('');
  const [svgContent, setSvgContent] = useState('');
  const [svgPrompt, setSvgPrompt] = useState('');
  const [svgPosition, setSvgPosition] = useState<'above' | 'below'>('above');
  const [svgPromptCopied, setSvgPromptCopied] = useState(false);
  const [typeCode, setTypeCode] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [blankOptions, setBlankOptions] = useState<BlankOption[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([]);
  const [classicalAnswer, setClassicalAnswer] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/manage/questions?id=${questionId}`);
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Soru yüklenemedi');
        onClose();
        return;
      }
      setQuestionText(data.question.question_text || '');
      setDifficulty(data.question.difficulty || 1);
      setScore(data.question.score || 1);
      setSolutionText(data.question.solution_text || '');
      setSvgContent(data.question.svg_content || '');
      setSvgPrompt(data.question.svg_prompt || '');
      setSvgPosition(data.question.svg_position === 'below' ? 'below' : 'above');
      setTypeCode(data.question.question_types?.code || '');
      setChoices(data.choices || []);
      setBlankOptions(data.blankOptions || []);
      setMatchingPairs(data.matchingPairs || []);
      setClassicalAnswer(data.classical?.model_answer || '');
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  async function handleSave() {
    setSaving(true);
    const body: Row = {
      id: questionId,
      patch: {
        question_text: questionText,
        difficulty,
        score,
        solution_text: solutionText || null,
        svg_content: svgContent || null,
        svg_prompt: svgPrompt || null,
        svg_position: svgPosition,
      },
    };
    if (choices.length) body.choices = choices.map((c) => ({ choice_text: c.choice_text, is_correct: c.is_correct }));
    if (blankOptions.length) body.blankOptions = blankOptions.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct }));
    if (matchingPairs.length) body.matchingPairs = matchingPairs.map((p) => ({ left_text: p.left_text, right_text: p.right_text }));
    if (classicalAnswer) body.classical = { model_answer: classicalAnswer, answer_words: [] };

    const res = await fetch('/api/admin/manage/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Kaydedilemedi');
      return;
    }
    showNotice('success', 'Soru kaydedildi');
    onSaved();
  }

  return (
    <ModalShell title={`Soru Düzenle${typeCode ? ` (${typeCode})` : ''}`} onClose={onClose} wide>
      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Yükleniyor...</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Soru Metni</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Zorluk (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Puan (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Çözüm Açıklaması</label>
            <textarea
              value={solutionText}
              onChange={(e) => setSolutionText(e.target.value)}
              rows={2}
              className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">SVG Görsel (opsiyonel)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <textarea
                value={svgContent}
                onChange={(e) => setSvgContent(e.target.value)}
                rows={8}
                placeholder="<svg ...>...</svg>"
                spellCheck={false}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-xs font-mono outline-none focus:border-indigo-500"
              />
              <div className="flex items-center justify-center rounded-xl border border-border bg-white p-3 min-h-[9rem]">
                {(() => {
                  const clean = svgContent.trim() ? sanitizeMathSvg(svgContent) : null;
                  if (!clean) return <span className="text-gray-500 text-xs">{svgContent.trim() ? 'Geçersiz SVG' : 'Önizleme'}</span>;
                  return <div className="max-h-64 max-w-full [&_svg]:max-h-64 [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: clean }} />;
                })()}
              </div>
            </div>
            {svgContent.trim() && (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-muted-foreground text-xs">SVG konumu:</span>
                <label className="flex items-center gap-1 text-muted-foreground text-xs">
                  <input type="radio" name="svgPosition" checked={svgPosition === 'above'} onChange={() => setSvgPosition('above')} className="accent-indigo-500" />
                  Soru kökünün üstünde
                </label>
                <label className="flex items-center gap-1 text-muted-foreground text-xs">
                  <input type="radio" name="svgPosition" checked={svgPosition === 'below'} onChange={() => setSvgPosition('below')} className="accent-indigo-500" />
                  Soru kökünün altında
                </label>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-muted-foreground text-xs sm:text-sm">SVG Prompt (bu soru için çizim talimatı — başka bir AI&apos;ye vermek üzere)</label>
              {svgPrompt.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildSvgGenerationPrompt(svgPrompt));
                    setSvgPromptCopied(true);
                    window.setTimeout(() => setSvgPromptCopied(false), 2000);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 text-xs font-bold"
                >
                  {svgPromptCopied ? 'Kopyalandı ✓' : 'Kopyala'}
                </button>
              )}
            </div>
            <textarea
              value={svgPrompt}
              onChange={(e) => setSvgPrompt(e.target.value)}
              rows={4}
              placeholder="Bu soru için AI'nin ürettiği SVG çizim promptu (varsa)"
              className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-xs outline-none focus:border-indigo-500"
            />
          </div>

          {choices.length > 0 && (
            <ChoiceListEditor title="Şıklar" items={choices} textKey="choice_text" onChange={setChoices} />
          )}
          {blankOptions.length > 0 && (
            <ChoiceListEditor title="Boşluk Seçenekleri" items={blankOptions} textKey="option_text" onChange={setBlankOptions} />
          )}
          {matchingPairs.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-2">Eşleştirme Çiftleri</span>
              <div className="space-y-2">
                {matchingPairs.map((p, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      value={p.left_text}
                      onChange={(e) => {
                        const next = [...matchingPairs];
                        next[idx] = { ...next[idx], left_text: e.target.value };
                        setMatchingPairs(next);
                      }}
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground text-sm outline-none focus:border-indigo-500"
                    />
                    <input
                      value={p.right_text}
                      onChange={(e) => {
                        const next = [...matchingPairs];
                        next[idx] = { ...next[idx], right_text: e.target.value };
                        setMatchingPairs(next);
                      }}
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {classicalAnswer !== '' || typeCode === 'classical' ? (
            <div>
              <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Örnek Cevap (Klasik Soru)</label>
              <textarea
                value={classicalAnswer}
                onChange={(e) => setClassicalAnswer(e.target.value)}
                rows={4}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500"
              />
            </div>
          ) : null}
        </div>
      )}
      {!loading && <ModalActions onCancel={onClose} onSave={handleSave} saving={saving} />}
    </ModalShell>
  );
}

function ChoiceListEditor<T extends { choice_text?: string; option_text?: string; is_correct: boolean }>({
  title,
  items,
  textKey,
  onChange,
}: {
  title: string;
  items: T[];
  textKey: 'choice_text' | 'option_text';
  onChange: (items: T[]) => void;
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground block mb-2">{title}</span>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="radio"
              name={title}
              checked={item.is_correct}
              onChange={() => {
                const next = items.map((it, i) => ({ ...it, is_correct: i === idx })) as T[];
                onChange(next);
              }}
              className="accent-emerald-500"
              title="Doğru cevap"
            />
            <input
              value={item[textKey] || ''}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...next[idx], [textKey]: e.target.value };
                onChange(next);
              }}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground text-sm outline-none focus:border-indigo-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== SHARED MODAL PIECES ====================

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-card rounded-xl sm:rounded-2xl border border-border w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} p-4 sm:p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
      <button onClick={onCancel} className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-surface text-foreground hover:bg-accent transition-all text-sm">
        İptal
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50 text-sm"
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </div>
  );
}

function ConfirmDeleteModal({
  count,
  entityLabel,
  allowHard,
  deleting,
  onCancel,
  onConfirm,
}: {
  count: number;
  entityLabel: string;
  allowHard: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: (hard: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border w-full max-w-md p-4 sm:p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">Silinsin mi?</h3>
        <p className="text-muted-foreground text-sm mb-4">
          {count} {entityLabel.toLowerCase()} kaydı{allowHard ? ' kalıcı olarak' : ''} silinecek. Bu işlem geri alınamaz.
          {!allowHard && ' (Bağlı kayıtlar varsa "Pasifleştir" ile gizlemeyi tercih edebilirsiniz.)'}
        </p>
        {deleting && (
          <div className="flex items-center gap-2 text-indigo-300 text-sm mb-4">
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            {count} kayıt siliniyor, lütfen bekleyin...
          </div>
        )}
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2 rounded-xl bg-surface text-foreground hover:bg-accent disabled:opacity-50 text-sm"
          >
            Vazgeç
          </button>
          {allowHard ? (
            <button
              onClick={() => onConfirm(false)}
              disabled={deleting}
              className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {deleting ? 'Siliniyor...' : 'Sil'}
            </button>
          ) : (
            <>
              <button
                onClick={() => onConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {deleting ? 'İşleniyor...' : 'Pasifleştir'}
              </button>
              <button
                onClick={() => onConfirm(true)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? 'Siliniyor...' : 'Kalıcı Sil'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
