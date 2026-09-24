'use client';

// Kazanım Yönetimi — Konu Yönetimi'nden AYRI bir panel (kullanıcının 2026-09-24 isteği:
// "konu yönetimi ayrı bi başlık, öğrenme çıktısı ve kazanım yönetimi ayrı bi başlık
// olacak"). Sınıf+ders+ünite+konu seçilir, seçili konu için üç şey gösterilir:
//  1) DB'deki öğrenme çıktısı grupları (topic_learning_outcomes) + altındaki kazanımlar.
//  2) TYMM'de bu konuya ait olup DB'de HENÜZ karşılığı olmayan öğrenme çıktıları — tek
//     tıkla, altındaki TÜM kazanım bileşenleriyle birlikte eklenir (kullanıcının isteği:
//     "öğrenme çıktısı eklediğimde tymm'deki kazanımlar da otomatik eklensin").
//  3) Bağsız (learning_outcome_id null) eski/serbest kazanımlar — bir gruba elle bağlanabilir
//     (kullanıcının isteği: "kazanımlar var ama öğrenme çıktısı bağlanmamışsa kolay bi
//     şekilde bağlayayım").

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Row = { id: number; name: string };
type Unit = { id: number; title: string; order_no: number };
type Topic = { id: number; title: string; unit_id: number; order_no: number };

type GroupOutcome = { id: number; code: string | null; description: string; order_index: number };
type Group = { id: number; code: string | null; title: string; order_no: number; outcomes: GroupOutcome[] };
type UngroupedOutcome = { id: number; code: string | null; description: string; order_index: number };
type TymmCandidate = { code: string; title: string; topicTitle: string; likelyMatch: boolean; components: { letter: string; text: string }[] };

type TopicData = {
  topic: { id: number; title: string };
  groups: Group[];
  ungroupedOutcomes: UngroupedOutcome[];
  tymmCandidates: TymmCandidate[];
  tymmError?: string;
  unitTitle?: string;
};

type Notice = { kind: 'success' | 'error'; text: string } | null;

export default function KazanimYonetimiPanel() {
  const [grades, setGrades] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<Row[]>([]);
  const [lessonGrades, setLessonGrades] = useState<{ lesson_id: number; grade_id: number }[]>([]);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const availableLessons = gradeId == null ? [] : lessons.filter((l) => lessonGrades.some((lg) => lg.lesson_id === l.id && lg.grade_id === gradeId));

  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const [topicData, setTopicData] = useState<TopicData | null>(null);
  const [loadingTopicData, setLoadingTopicData] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [notice, setNotice] = useState<Notice>(null);
  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: gradesData }, { data: lessonsData }, { data: lessonGradesData }] = await Promise.all([
        supabase.from('grades').select('id, name').order('order_no'),
        supabase.from('lessons').select('id, name').order('order_no'),
        supabase.from('lesson_grades').select('lesson_id, grade_id'),
      ]);
      setGrades((gradesData as Row[] | null) || []);
      setLessons((lessonsData as Row[] | null) || []);
      setLessonGrades((lessonGradesData as { lesson_id: number; grade_id: number }[] | null) || []);
    })();
  }, []);

  const loadUnits = useCallback(async () => {
    setSelectedUnitId(null);
    setSelectedTopicId(null);
    setTopicData(null);
    if (gradeId == null || lessonId == null) {
      setUnits([]);
      return;
    }
    setLoadingUnits(true);
    try {
      const res = await fetch(`/api/admin/manage/units?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json();
      if (!res.ok) return;
      setUnits(((data.items as Unit[] | undefined) || []).sort((a, b) => a.order_no - b.order_no));
    } finally {
      setLoadingUnits(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const loadTopics = useCallback(async (unitId: number | null) => {
    setSelectedTopicId(null);
    setTopicData(null);
    if (unitId == null) {
      setTopics([]);
      return;
    }
    setLoadingTopics(true);
    try {
      const res = await fetch(`/api/admin/manage/topics?unitId=${unitId}`);
      const data = await res.json();
      if (res.ok) setTopics(((data.items as Topic[] | undefined) || []).sort((a, b) => a.order_no - b.order_no));
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  useEffect(() => {
    loadTopics(selectedUnitId);
  }, [selectedUnitId, loadTopics]);

  const loadTopicData = useCallback(async (topicId: number | null) => {
    if (topicId == null) {
      setTopicData(null);
      return;
    }
    setLoadingTopicData(true);
    try {
      const res = await fetch(`/api/admin/tymm/topic-learning-outcomes?topicId=${topicId}`);
      const data = await res.json();
      if (res.ok) setTopicData(data as TopicData);
      else showNotice('error', data.error || 'Konu verisi alınamadı');
    } finally {
      setLoadingTopicData(false);
    }
  }, []);

  useEffect(() => {
    loadTopicData(selectedTopicId);
  }, [selectedTopicId, loadTopicData]);

  async function importCandidate(candidate: TymmCandidate) {
    if (selectedTopicId == null) return;
    const key = `import:${candidate.code}:${candidate.title}`;
    setBusyKey(key);
    try {
      const res = await fetch('/api/admin/tymm/import-learning-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: selectedTopicId, code: candidate.code, title: candidate.title }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Eklenemedi');
      showNotice('success', `Eklendi — ${data.outcomesCreated} yeni kazanım${data.outcomesMatched ? `, ${data.outcomesMatched} mevcut kazanım bağlandı` : ''}`);
      await loadTopicData(selectedTopicId);
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Eklenemedi');
    } finally {
      setBusyKey(null);
    }
  }

  async function linkOutcome(outcomeId: number, groupId: number) {
    const key = `link:${outcomeId}`;
    setBusyKey(key);
    try {
      const res = await fetch('/api/admin/manage/outcomes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [outcomeId], patch: { learning_outcome_id: groupId } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Bağlanamadı');
      showNotice('success', 'Kazanım öğrenme çıktısına bağlandı');
      await loadTopicData(selectedTopicId);
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Bağlanamadı');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Öğrenme Çıktısı ve Kazanım Yönetimi</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Bir konu seçin: TYMM&apos;deki öğrenme çıktılarını (altındaki kazanımlarla birlikte) tek tıkla ekleyin, bağsız kazanımları bir öğrenme çıktısına bağlayın.
        </p>
      </div>

      {notice && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PickList label="Sınıf" items={grades} selectedId={gradeId} onSelect={(id) => { setGradeId(id); setLessonId(null); }} />
        <PickList
          label="Ders"
          items={availableLessons}
          selectedId={lessonId}
          onSelect={setLessonId}
          disabled={gradeId == null}
          emptyMessage={gradeId == null ? 'Önce sınıf seçin' : 'Bu sınıfta ders bulunamadı'}
        />
      </div>

      {gradeId == null || lessonId == null ? (
        <EmptyHint text="Başlamak için önce sınıf ve ders seçin" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <SimpleListColumn
            title="Üniteler"
            loading={loadingUnits}
            emptyText="Bu sınıf/derste ünite yok"
            items={units}
            selectedId={selectedUnitId}
            onSelect={setSelectedUnitId}
          />
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">Konular</h3>
            {selectedUnitId == null ? (
              <EmptyHint text="Önce soldan bir ünite seçin" />
            ) : (
              <SimpleListColumn title="" hideTitle loading={loadingTopics} emptyText="Bu ünitede konu yok" items={topics} selectedId={selectedTopicId} onSelect={setSelectedTopicId} />
            )}
          </div>
        </div>
      )}

      {selectedTopicId != null && (
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
          {loadingTopicData || !topicData ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Yükleniyor…</p>
          ) : (
            <div className="space-y-6">
              <h3 className="text-base font-bold text-foreground">{topicData.topic.title}</h3>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Öğrenme Çıktısı Grupları ({topicData.groups.length})</p>
                {topicData.groups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Bu konuda henüz gruplanmış bir öğrenme çıktısı yok.</p>
                ) : (
                  <div className="space-y-2">
                    {topicData.groups.map((g) => (
                      <div key={g.id} className="rounded-lg border border-border bg-surface p-3">
                        <p className="text-sm font-semibold text-foreground">
                          {g.code ? <span className="text-indigo-500 font-mono mr-1">{g.code}</span> : null}
                          {g.title}
                        </p>
                        <ul className="mt-2 space-y-1 pl-3 border-l-2 border-border">
                          {g.outcomes.map((o) => (
                            <li key={o.id} className="text-xs text-muted-foreground">
                              {o.code ? <span className="font-mono mr-1">{o.code})</span> : null}
                              {o.description}
                            </li>
                          ))}
                          {g.outcomes.length === 0 && <li className="text-xs text-amber-500">⚠️ kazanım yok</li>}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">
                  TYMM&apos;de Ünitede Var, Bu Konuya Eklenebilir ({topicData.tymmCandidates.length})
                </p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  TYMM&apos;in konu tahmini bazen kayıyor — hangi öğrenme çıktısının bu konuya ait olduğuna siz karar verin, &quot;Bu konuyla eşleşebilir&quot; işaretliler en üstte.
                </p>
                {topicData.tymmError ? (
                  <p className="text-xs text-muted-foreground">ℹ️ {topicData.tymmError}</p>
                ) : topicData.tymmCandidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ünitede eklenebilecek yeni bir öğrenme çıktısı bulunamadı.</p>
                ) : (
                  <div className="space-y-2">
                    {topicData.tymmCandidates.map((c) => {
                      const key = `import:${c.code}:${c.title}`;
                      return (
                        <div
                          key={key}
                          className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                            c.likelyMatch ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-border bg-surface'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {c.code ? <span className="text-indigo-500 font-mono mr-1">{c.code}</span> : null}
                              {c.title}
                              {c.likelyMatch && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-500 text-[9px] font-bold align-middle">Bu konuyla eşleşebilir</span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {c.components.length} kazanım birlikte eklenecek
                              {c.topicTitle ? ` · TYMM konu tahmini: ${c.topicTitle}` : ' · TYMM konu tahmini belirsiz (İçerik Çerçevesi ile öğrenme çıktısı sayısı uyuşmuyor)'}
                            </p>
                          </div>
                          <button
                            onClick={() => importCandidate(c)}
                            disabled={busyKey === key}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 disabled:opacity-50"
                          >
                            {busyKey === key ? '…' : '+ Ekle'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">
                  Bağlı Değil — Serbest Kazanımlar ({topicData.ungroupedOutcomes.length})
                </p>
                {topicData.ungroupedOutcomes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Bağsız kazanım yok.</p>
                ) : (
                  <div className="space-y-2">
                    {topicData.ungroupedOutcomes.map((o) => (
                      <UngroupedRow key={o.id} outcome={o} groups={topicData.groups} busy={busyKey === `link:${o.id}`} onLink={(groupId) => linkOutcome(o.id, groupId)} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UngroupedRow({
  outcome,
  groups,
  busy,
  onLink,
}: {
  outcome: UngroupedOutcome;
  groups: Group[];
  busy: boolean;
  onLink: (groupId: number) => void;
}) {
  const [selected, setSelected] = useState<number | ''>('');
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <p className="text-xs text-foreground flex-1 min-w-0">
        {outcome.code ? <span className="font-mono mr-1">{outcome.code})</span> : null}
        {outcome.description}
      </p>
      <div className="flex gap-2 shrink-0">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : '')}
          className="px-2 py-1.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:border-indigo-400"
        >
          <option value="">Öğrenme çıktısı seç…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code ? `${g.code} — ` : ''}
              {g.title}
            </option>
          ))}
        </select>
        <button
          onClick={() => selected && onLink(selected)}
          disabled={!selected || busy}
          className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? '…' : 'Bağla'}
        </button>
      </div>
    </div>
  );
}

function SimpleListColumn<T extends { id: number; title: string }>({
  title,
  hideTitle,
  loading,
  emptyText,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  hideTitle?: boolean;
  loading: boolean;
  emptyText: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
      {!hideTitle && <h3 className="text-sm font-bold text-foreground mb-2">{title}</h3>}
      {loading ? (
        <p className="text-muted-foreground text-sm py-4 text-center">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onSelect(item.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border text-sm truncate transition-colors ${
                  selectedId === item.id ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold' : 'border-border bg-surface text-foreground hover:border-muted-foreground/30'
                }`}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PickList({
  label,
  items,
  selectedId,
  onSelect,
  disabled = false,
  emptyMessage = 'Yükleniyor…',
}: {
  label: string;
  items: Row[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  disabled?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`px-3 py-1.5 rounded-lg border text-left text-sm font-semibold transition-colors ${
              selectedId === item.id
                ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
