'use client';

// Konu Yönetimi — TYMM otomasyonuna alternatif, tamamen ELLE ünite/konu yönetimi paneli.
// Sınıf+ders seçilir → o ikilideki üniteler listelenir (sürükle-bırak sıralanabilir,
// yeniden adlandırılabilir, silinebilir, eklenebilir) → bir ünite seçilince sağda o
// ünitenin konuları aynı şekilde yönetilir. Slug hiçbir zaman rename'de değişmez (public
// URL'lerde kullanılıyor) — bkz. units/topics route.ts POST/PATCH'teki aynı kural.

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fuzzyNorm, normUnitTitleForMatch } from '@/app/src/lib/tymm/compareUnits';

type Row = { id: number; name: string };

type Unit = {
  id: number;
  title: string;
  slug: string;
  order_no: number;
  is_active: boolean;
  question_count: number;
  topic_count: number;
};

type Topic = {
  id: number;
  unit_id: number;
  title: string;
  slug: string;
  order_no: number;
  is_active: boolean;
  question_count: number;
};

type Notice = { kind: 'success' | 'error'; text: string } | null;

export default function KonuYonetimiPanel() {
  const [grades, setGrades] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<Row[]>([]);
  const [lessonGrades, setLessonGrades] = useState<{ lesson_id: number; grade_id: number }[]>([]);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  // Sadece seçili sınıfta gerçekten okutulan dersler gösterilir — bkz. YillikPlanPanel'deki
  // aynı gerekçe (lesson_grades'e satırı yoksa yanlış ders/sınıf kombinasyonu seçilebilir).
  const availableLessons = gradeId == null ? [] : lessons.filter((l) => lessonGrades.some((lg) => lg.lesson_id === l.id && lg.grade_id === gradeId));

  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [notice, setNotice] = useState<Notice>(null);

  // TYMM referansı: lesson_grades.tymm_page_url zaten kayıtlı (Toplu sekmesinde bir kere
  // çekilince kaydediliyor) — burada admin hiçbir şey yapmadan, sınıf+ders seçilir seçilmez
  // otomatik çekilir. Salt okunur, DB'ye hiçbir şey yazmaz — sadece "TYMM'de güncel olarak
  // ne var" diye elle karşılaştırabilsin diye (kullanıcının 2026-09-24 isteği: "otomatik
  // çeksin göreyim, sayfayı fazla karmaşıklaştırmadan").
  const [tymmUnits, setTymmUnits] = useState<{ unitTitle: string; topics: string[] }[] | null>(null);
  const [tymmLoading, setTymmLoading] = useState(false);
  const [tymmErr, setTymmErr] = useState<string | null>(null);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  // Sınıflar/dersler — YillikPlanPanel'deki fetch deseniyle aynı (client-side, doğrudan
  // Supabase sorgusu, is_active filtrelenmiyor çünkü orada da bazı geçerli dersler
  // is_active:false görünebiliyor).
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
    // Sınıf/ders değişince önceki seçili ünite artık geçersiz — sıfırla (loadUnits'in
    // kendi içinde, ki tek bir useEffect gövdesinde art arda senkron setState olmasın).
    setSelectedUnitId(null);
    if (gradeId == null || lessonId == null) {
      setUnits([]);
      return;
    }
    setLoadingUnits(true);
    try {
      const [unitsRes, topicsRes] = await Promise.all([
        fetch(`/api/admin/manage/units?gradeId=${gradeId}&lessonId=${lessonId}`),
        fetch(`/api/admin/manage/topics?gradeId=${gradeId}&lessonId=${lessonId}`),
      ]);
      const unitsData = await unitsRes.json();
      const topicsData = await topicsRes.json();
      if (!unitsRes.ok) return;
      // Konu sayısı ünite satırında gösterilecek — topics GET'i unitId filtresiz, ders+sınıf
      // filtresiyle TÜM konuları döndürüyor, burada unit_id'ye göre sayıyoruz.
      const topicCountByUnit = new Map<number, number>();
      for (const t of (topicsData.items as { unit_id: number }[] | undefined) || []) {
        topicCountByUnit.set(t.unit_id, (topicCountByUnit.get(t.unit_id) ?? 0) + 1);
      }
      const withCounts = ((unitsData.items as Omit<Unit, 'topic_count'>[] | undefined) || [])
        .map((u) => ({ ...u, topic_count: topicCountByUnit.get(u.id) ?? 0 }))
        .sort((a, b) => a.order_no - b.order_no);
      setUnits(withCounts);
    } finally {
      setLoadingUnits(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    setTymmUnits(null);
    setTymmErr(null);
    if (gradeId == null || lessonId == null) return;
    let cancelled = false;
    setTymmLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/admin/tymm/lesson-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, gradeId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setTymmErr(data.error || 'TYMM verisi çekilemedi');
          return;
        }
        setTymmUnits(data.units);
      } catch {
        if (!cancelled) setTymmErr('TYMM verisi çekilemedi (ağ hatası)');
      } finally {
        if (!cancelled) setTymmLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gradeId, lessonId]);

  const loadTopics = useCallback(async (unitId: number | null) => {
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

  // ---- Ünite işlemleri ----

  async function reorderUnits(nextUnits: Unit[]) {
    const previous = units;
    setUnits(nextUnits);
    try {
      const res = await fetch('/api/admin/manage/units/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: nextUnits.map((u, idx) => ({ id: u.id, order_no: idx })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Sıralama kaydedilemedi');
    } catch (err) {
      setUnits(previous);
      showNotice('error', err instanceof Error ? err.message : 'Sıralama kaydedilemedi');
    }
  }

  async function renameUnit(id: number, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const previous = units;
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, title: trimmed } : u)));
    try {
      const res = await fetch('/api/admin/manage/units', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], patch: { title: trimmed } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ünite güncellenemedi');
    } catch (err) {
      setUnits(previous);
      showNotice('error', err instanceof Error ? err.message : 'Ünite güncellenemedi');
    }
  }

  async function deleteUnit(id: number) {
    const previous = units;
    setUnits((prev) => prev.filter((u) => u.id !== id));
    if (selectedUnitId === id) setSelectedUnitId(null);
    try {
      const res = await fetch('/api/admin/manage/units', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ünite silinemedi');
      showNotice('success', 'Ünite silindi');
    } catch (err) {
      setUnits(previous);
      showNotice('error', err instanceof Error ? err.message : 'Ünite silinemedi');
    }
  }

  async function createUnit(title: string) {
    if (gradeId == null || lessonId == null) return;
    try {
      const res = await fetch('/api/admin/manage/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, gradeId, title }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Ünite oluşturulamadı');
      setUnits((prev) => [...prev, { ...data.unit, question_count: 0, topic_count: 0 }]);
      showNotice('success', 'Ünite eklendi');
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Ünite oluşturulamadı');
    }
  }

  // ---- Konu işlemleri ----

  async function reorderTopics(nextTopics: Topic[]) {
    const previous = topics;
    setTopics(nextTopics);
    try {
      const res = await fetch('/api/admin/manage/topics/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: nextTopics.map((t, idx) => ({ id: t.id, order_no: idx })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Sıralama kaydedilemedi');
    } catch (err) {
      setTopics(previous);
      showNotice('error', err instanceof Error ? err.message : 'Sıralama kaydedilemedi');
    }
  }

  async function renameTopic(id: number, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const previous = topics;
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    try {
      const res = await fetch('/api/admin/manage/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], patch: { title: trimmed } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Konu güncellenemedi');
    } catch (err) {
      setTopics(previous);
      showNotice('error', err instanceof Error ? err.message : 'Konu güncellenemedi');
    }
  }

  async function deleteTopic(id: number) {
    const previous = topics;
    setTopics((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch('/api/admin/manage/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Konu silinemedi');
      showNotice('success', 'Konu silindi');
    } catch (err) {
      setTopics(previous);
      showNotice('error', err instanceof Error ? err.message : 'Konu silinemedi');
    }
  }

  async function createTopic(title: string) {
    if (selectedUnitId == null) return;
    try {
      const res = await fetch('/api/admin/manage/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: selectedUnitId, title }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Konu oluşturulamadı');
      setTopics((prev) => [...prev, { ...data.topic, question_count: 0 }]);
      showNotice('success', 'Konu eklendi');
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Konu oluşturulamadı');
    }
  }

  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;
  // Seçili DB ünitesine karşılık gelen TYMM ünitesini başlık bazında bul. normUnitTitleForMatch
  // kullanılıyor (fuzzyNorm DEĞİL) — TYMM zaman zaman başlığın başına "1. Öğrenme Alanı: " gibi
  // bir sıra numarası ekliyor (bkz. importUnit.ts/compareUnits.ts'teki aynı bug), fuzzyNorm bu
  // öneki yok saymadığı için eşleşme hep başarısız oluyordu (kullanıcının 5. sınıf Sosyal
  // Bilgiler'de yakaladığı bug, 2026-09-24).
  const matchedTymmUnit =
    selectedUnit && tymmUnits
      ? tymmUnits.find((u) => normUnitTitleForMatch(u.unitTitle) === normUnitTitleForMatch(selectedUnit.title)) || null
      : null;
  const dbTopicTitlesFuzzy = new Set(topics.map((t) => fuzzyNorm(t.title)));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Konu Yönetimi</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ünite ve konuları elle oluşturun, yeniden adlandırın, sürükleyerek sıralayın. TYMM otomasyonuna alternatif, tam manuel kontrol.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <ListColumn
            title="Üniteler"
            loading={loadingUnits}
            emptyText="Bu sınıf/derste ünite yok"
            items={units}
            selectedId={selectedUnitId}
            onSelect={setSelectedUnitId}
            onReorder={reorderUnits}
            onRename={renameUnit}
            onDelete={deleteUnit}
            onCreate={createUnit}
            createLabel="+ Yeni Ünite"
            createPlaceholder="Ünite başlığı"
            countLabel={(u) => `${u.topic_count}`}
            countSuffix="konu"
          />

          <div>
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              Konular
              {selectedUnit && <span className="text-xs font-normal text-muted-foreground truncate">— {selectedUnit.title}</span>}
            </h3>
            {selectedUnitId == null ? (
              <EmptyHint text="Önce soldan bir ünite seçin" />
            ) : (
              <ListColumn
                title=""
                loading={loadingTopics}
                emptyText="Bu ünitede konu yok"
                items={topics}
                selectedId={null}
                onSelect={() => {}}
                onReorder={reorderTopics}
                onRename={renameTopic}
                onDelete={deleteTopic}
                onCreate={createTopic}
                createLabel="+ Yeni Konu"
                createPlaceholder="Konu başlığı"
                hideTitle
                countLabel={(t) => `${t.question_count}`}
                countSuffix="soru"
              />
            )}

            {selectedUnitId != null && (
              <TymmReferenceBox
                loading={tymmLoading}
                error={tymmErr}
                matchedUnit={matchedTymmUnit}
                dbTopicTitlesFuzzy={dbTopicTitlesFuzzy}
                onQuickAdd={createTopic}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Paylaşılan liste kolonu (ünite VE konu için aynı bileşen) ====================

type ListItem = { id: number; title: string; slug: string; order_no: number; question_count: number };

function ListColumn<T extends ListItem>({
  title,
  loading,
  emptyText,
  items,
  selectedId,
  onSelect,
  onReorder,
  onRename,
  onDelete,
  onCreate,
  createLabel,
  createPlaceholder,
  hideTitle,
  countLabel,
  countSuffix,
}: {
  title: string;
  loading: boolean;
  emptyText: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onReorder: (items: T[]) => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onCreate: (title: string) => void;
  createLabel: string;
  createPlaceholder: string;
  hideTitle?: boolean;
  countLabel: (item: T) => string;
  countSuffix: string;
}) {
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  function submitCreate() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewTitle('');
    setCreating(false);
  }

  return (
    <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
      {!hideTitle && <h3 className="text-sm font-bold text-foreground mb-2">{title}</h3>}

      {loading ? (
        <p className="text-muted-foreground text-sm py-4 text-center">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">{emptyText}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => onSelect(item.id)}
                  onRename={(t) => onRename(item.id, t)}
                  onDelete={() => setConfirmDeleteId(item.id)}
                  countLabel={countLabel(item)}
                  countSuffix={countSuffix}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {creating ? (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') { setCreating(false); setNewTitle(''); }
            }}
            placeholder={createPlaceholder}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm outline-none focus:border-indigo-400"
          />
          <button onClick={submitCreate} className="px-3 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400">
            Ekle
          </button>
          <button onClick={() => { setCreating(false); setNewTitle(''); }} className="px-3 py-2 rounded-lg bg-surface text-muted-foreground text-xs hover:bg-accent">
            Vazgeç
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-3 w-full px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground text-xs font-semibold hover:border-indigo-400 hover:text-indigo-400 transition-colors"
        >
          {createLabel}
        </button>
      )}

      {confirmDeleteId != null && (
        <DeleteConfirmModal
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            onDelete(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        />
      )}
    </div>
  );
}

function SortableRow<T extends ListItem>({
  item,
  selected,
  onSelect,
  onRename,
  onDelete,
  countLabel,
  countSuffix,
}: {
  item: T;
  selected: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  countLabel: string;
  countSuffix: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== item.title) onRename(draft);
    else setDraft(item.title);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm transition-colors ${
        selected ? 'border-indigo-400 bg-indigo-500/10' : 'border-border bg-surface hover:border-muted-foreground/30'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground px-1 shrink-0 touch-none"
        aria-label="Sürükleyerek sırala"
        title="Sürükleyerek sırala"
      >
        ⠿
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setDraft(item.title); setEditing(false); }
          }}
          className="flex-1 min-w-0 px-2 py-1 rounded border border-indigo-400 bg-background text-foreground text-sm outline-none"
        />
      ) : (
        <button onClick={onSelect} className="flex-1 min-w-0 text-left truncate text-foreground font-medium">
          {item.title}
        </button>
      )}

      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
        {countLabel} {countSuffix}
      </span>

      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 p-1 text-muted-foreground hover:text-indigo-400 transition-colors"
          title="Yeniden adlandır"
          aria-label="Yeniden adlandır"
        >
          ✎
        </button>
      )}
      <button
        onClick={onDelete}
        className="shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors"
        title="Sil"
        aria-label="Sil"
      >
        🗑
      </button>
    </li>
  );
}

function DeleteConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border w-full max-w-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">Silinsin mi?</h3>
        <p className="text-muted-foreground text-sm">Bu kayıt pasif hale getirilecek (soft delete). Emin misiniz?</p>
        <div className="flex gap-2 sm:gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-surface text-foreground hover:bg-accent transition-all text-sm">
            İptal
          </button>
          <button onClick={onConfirm} className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-sm">
            Evet, Sil
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Sınıf/Ders seçim listesi (YillikPlanPanel'deki PickList ile aynı desen) ====================

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

// Salt okunur TYMM referansı — DB'ye hiçbir şey yazmaz, sadece "TYMM'de şu an ne var"
// gösterir. Seçili ünitenin DB'deki konularında ZATEN olan bir TYMM başlığı sessizce (✓)
// işaretlenir; olmayanlar için tek tıkla "+ Ekle" ile aynı createTopic akışı üzerinden
// gerçek bir konu satırı açılır (istersen sonra yeniden adlandırırsın).
function TymmReferenceBox({
  loading,
  error,
  matchedUnit,
  dbTopicTitlesFuzzy,
  onQuickAdd,
}: {
  loading: boolean;
  error: string | null;
  matchedUnit: { unitTitle: string; topics: string[] } | null;
  dbTopicTitlesFuzzy: Set<string>;
  onQuickAdd: (title: string) => void;
}) {
  if (loading) {
    return <p className="mt-4 text-[11px] text-muted-foreground">TYMM&apos;den güncel konular çekiliyor…</p>;
  }
  if (error) {
    // Sessiz — sayfa karmaşıklaşmasın diye alarm gibi göstermiyoruz, sadece bilgi notu.
    return <p className="mt-4 text-[11px] text-muted-foreground">ℹ️ TYMM referansı: {error}</p>;
  }
  if (!matchedUnit) {
    return <p className="mt-4 text-[11px] text-muted-foreground">TYMM&apos;de bu üniteyle eşleşen bir sayfa bulunamadı.</p>;
  }
  return (
    <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600 dark:text-indigo-300 mb-2">
        TYMM&apos;deki Güncel Konular — {matchedUnit.unitTitle}
      </p>
      <ul className="space-y-1">
        {matchedUnit.topics.map((t) => {
          const exists = dbTopicTitlesFuzzy.has(fuzzyNorm(t));
          return (
            <li key={t} className="flex items-center justify-between gap-2 text-[11px]">
              <span className={exists ? 'text-muted-foreground' : 'text-foreground'}>
                {exists ? '✓ ' : ''}
                {t}
              </span>
              {!exists && (
                <button
                  onClick={() => onQuickAdd(t)}
                  className="flex-shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold hover:bg-emerald-500/20"
                >
                  + Ekle
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
