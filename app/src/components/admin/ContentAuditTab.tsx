'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

// ==================== TYPES ====================

type GradeRow = { id: number; name: string; order_no: number; is_active: boolean };
type LessonRow = { id: number; name: string; order_no: number; is_active: boolean };
type LessonGradeRow = { lesson_id: number; grade_id: number; is_active: boolean };
type UnitRow = { id: number; lesson_id: number; grade_id: number; title: string; order_no: number; is_active: boolean };
type TopicRow = { id: number; unit_id: number; title: string; order_no: number; is_active: boolean };
type OutcomeRow = { id: number; topic_id: number };
type ContentRow = { id: number; topic_id: number; title: string; is_published: boolean };
type SectionRow = { id: number; topic_content_id: number; heading: string; status: string; order_no: number };

type SectionNode = SectionRow;
type ContentNode = ContentRow & { sections: SectionNode[] };
type TopicNode = TopicRow & { outcomesCount: number; content: ContentNode | null; hasIssue: boolean };
type UnitNode = UnitRow & { topics: TopicNode[]; hasIssue: boolean; issueCount: number };
type LessonNode = { lessonId: number; name: string; order_no: number; isActive: boolean; units: UnitNode[]; hasIssue: boolean; issueCount: number };
type GradeNode = GradeRow & { lessons: LessonNode[]; hasIssue: boolean; issueCount: number };

type RawData = {
  grades: GradeRow[];
  lessons: LessonRow[];
  lessonGrades: LessonGradeRow[];
  units: UnitRow[];
  topics: TopicRow[];
  outcomes: OutcomeRow[];
  contents: ContentRow[];
  sections: SectionRow[];
};

const SECTION_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlandı',
  content_ready: 'İçerik Hazır',
  image_ready: 'Görsel Hazır',
  published: 'Yayında',
};

function trFold(s: string) {
  return s.toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i');
}

// ==================== DATA -> TREE ====================

function buildTree(raw: RawData): GradeNode[] {
  const lessonById = new Map(raw.lessons.map((l) => [l.id, l]));

  const outcomeCountByTopic = new Map<number, number>();
  raw.outcomes.forEach((o) => outcomeCountByTopic.set(o.topic_id, (outcomeCountByTopic.get(o.topic_id) || 0) + 1));

  const sectionsByContent = new Map<number, SectionNode[]>();
  raw.sections.forEach((s) => {
    const arr = sectionsByContent.get(s.topic_content_id) || [];
    arr.push(s);
    sectionsByContent.set(s.topic_content_id, arr);
  });
  sectionsByContent.forEach((arr) => arr.sort((a, b) => a.order_no - b.order_no));

  const contentByTopic = new Map<number, ContentNode>();
  raw.contents.forEach((c) => {
    contentByTopic.set(c.topic_id, { ...c, sections: sectionsByContent.get(c.id) || [] });
  });

  const topicsByUnit = new Map<number, TopicNode[]>();
  raw.topics.forEach((t) => {
    const content = contentByTopic.get(t.id) || null;
    const outcomesCount = outcomeCountByTopic.get(t.id) || 0;
    const hasIssue = outcomesCount === 0 || !content || content.sections.length === 0;
    const node: TopicNode = { ...t, outcomesCount, content, hasIssue };
    const arr = topicsByUnit.get(t.unit_id) || [];
    arr.push(node);
    topicsByUnit.set(t.unit_id, arr);
  });
  topicsByUnit.forEach((arr) => arr.sort((a, b) => a.order_no - b.order_no));

  const unitsByGradeLesson = new Map<string, UnitNode[]>();
  raw.units.forEach((u) => {
    const topics = topicsByUnit.get(u.id) || [];
    const issueCount = topics.length === 0 ? 1 : topics.reduce((s, t) => s + (t.hasIssue ? 1 : 0), 0);
    const node: UnitNode = { ...u, topics, hasIssue: issueCount > 0, issueCount };
    const key = `${u.grade_id}-${u.lesson_id}`;
    const arr = unitsByGradeLesson.get(key) || [];
    arr.push(node);
    unitsByGradeLesson.set(key, arr);
  });
  unitsByGradeLesson.forEach((arr) => arr.sort((a, b) => a.order_no - b.order_no));

  const lessonGradesByGrade = new Map<number, LessonGradeRow[]>();
  raw.lessonGrades.forEach((lg) => {
    const arr = lessonGradesByGrade.get(lg.grade_id) || [];
    arr.push(lg);
    lessonGradesByGrade.set(lg.grade_id, arr);
  });

  // Yayında olmayan sınıf/ders/ünite/konular da gösterilir (aksi halde eksiklerin
  // nerede olduğu görünmez); is_active durumu InactiveTag ile ayrıca işaretlenir.
  return raw.grades.map((g) => {
    const lgs = (lessonGradesByGrade.get(g.id) || [])
      .slice()
      .sort((a, b) => {
        const la = lessonById.get(a.lesson_id);
        const lb = lessonById.get(b.lesson_id);
        return (la?.order_no ?? 0) - (lb?.order_no ?? 0);
      });
    const lessons: LessonNode[] = lgs.map((lg) => {
      const lesson = lessonById.get(lg.lesson_id);
      const units = unitsByGradeLesson.get(`${g.id}-${lg.lesson_id}`) || [];
      const issueCount = units.length === 0 ? 1 : units.reduce((s, u) => s + u.issueCount, 0);
      return {
        lessonId: lg.lesson_id,
        name: lesson?.name || `#${lg.lesson_id}`,
        order_no: lesson?.order_no ?? 0,
        isActive: lg.is_active && (lesson?.is_active ?? true),
        units,
        hasIssue: issueCount > 0,
        issueCount,
      };
    });
    const issueCount = lessons.length === 0 ? 1 : lessons.reduce((s, l) => s + l.issueCount, 0);
    return { ...g, lessons, hasIssue: issueCount > 0, issueCount };
  });
}

function filterUnits(units: UnitNode[], searchRaw: string, onlyIssues: boolean): UnitNode[] {
  const q = trFold(searchRaw.trim());
  const matches = (title: string) => !q || trFold(title).includes(q);

  const out: UnitNode[] = [];
  for (const u of units) {
    const uSelfMatch = matches(u.title);
    let topicsOut = uSelfMatch ? u.topics : u.topics.filter((t) => matches(t.title));
    if (onlyIssues) topicsOut = topicsOut.filter((t) => t.hasIssue);

    const searchPass = uSelfMatch || topicsOut.length > 0;
    if (!searchPass) continue;
    if (onlyIssues && !u.hasIssue) continue;
    out.push({ ...u, topics: topicsOut });
  }
  return out;
}

// ==================== SMALL UI PIECES ====================

function ExistPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap ${ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
      {ok ? okLabel : badLabel}
    </span>
  );
}

function InactiveTag({ active }: { active: boolean }) {
  if (active) return null;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-500/20 text-gray-400">Pasif</span>;
}

function IssueBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-emerald-400 text-xs shrink-0">✓</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 shrink-0 font-medium">{count}</span>;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4.5 9a7.5 7.5 0 0113-4.5L20 7M19.5 15a7.5 7.5 0 01-13 4.5L4 17" />
    </svg>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: 'ok' | 'warn' }) {
  return (
    <div className="bg-[#111114] border border-white/5 rounded-xl p-3 sm:p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${tone === 'warn' ? 'bg-red-500/15' : 'bg-indigo-500/15'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`font-bold text-lg leading-tight ${tone === 'warn' && value > 0 ? 'text-red-300' : 'text-white'}`}>{value}</div>
        <div className="text-gray-500 text-xs truncate">{label}</div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function ContentAuditTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<RawData | null>(null);

  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createClient();
    const [g, l, lg, u, t, o, c, s] = await Promise.all([
      supabase.from('grades').select('id, name, order_no, is_active').order('order_no'),
      supabase.from('lessons').select('id, name, order_no, is_active').order('order_no'),
      supabase.from('lesson_grades').select('lesson_id, grade_id, is_active'),
      supabase.from('units').select('id, lesson_id, grade_id, title, order_no, is_active').order('order_no'),
      supabase.from('topics').select('id, unit_id, title, order_no, is_active').order('order_no'),
      supabase.from('outcomes').select('id, topic_id'),
      supabase.from('topic_contents').select('id, topic_id, title, is_published'),
      supabase.from('topic_content_sections').select('id, topic_content_id, heading, status, order_no'),
    ]);

    const firstError = [g, l, lg, u, t, o, c, s].find((r) => r.error)?.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    setRaw({
      grades: (g.data as GradeRow[]) || [],
      lessons: (l.data as LessonRow[]) || [],
      lessonGrades: (lg.data as LessonGradeRow[]) || [],
      units: (u.data as UnitRow[]) || [],
      topics: (t.data as TopicRow[]) || [],
      outcomes: (o.data as OutcomeRow[]) || [],
      contents: (c.data as ContentRow[]) || [],
      sections: (s.data as SectionRow[]) || [],
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const tree = useMemo(() => (raw ? buildTree(raw) : []), [raw]);

  // Kullanıcı henüz sınıf seçmediyse: eksiği olan ilk sınıfı, hepsi tamamsa ilk sınıfı varsayılan göster.
  const defaultGradeId = useMemo(() => (tree.find((g) => g.hasIssue) ?? tree[0])?.id ?? null, [tree]);
  const effectiveGradeId = selectedGradeId ?? defaultGradeId;
  const selectedGrade = tree.find((g) => g.id === effectiveGradeId) || null;

  // Seçili sınıf içinde: eksiği olan ilk dersi, hepsi tamamsa ilk dersi varsayılan göster.
  const defaultLessonId = useMemo(
    () => (selectedGrade ? (selectedGrade.lessons.find((l) => l.hasIssue) ?? selectedGrade.lessons[0])?.lessonId ?? null : null),
    [selectedGrade]
  );
  const effectiveLessonId = selectedLessonId ?? defaultLessonId;
  const selectedLesson = selectedGrade?.lessons.find((l) => l.lessonId === effectiveLessonId) || null;

  // Genel özet — sayfa ilk açıldığında (henüz bir ders tıklanmadıysa) gösterilir.
  const summary = useMemo(() => {
    const allLessons = tree.flatMap((g) => g.lessons);
    const allTopics = tree.flatMap((g) => g.lessons.flatMap((l) => l.units.flatMap((u) => u.topics)));
    const allUnits = tree.flatMap((g) => g.lessons.flatMap((l) => l.units));
    return {
      grades: tree.length,
      lessons: allLessons.length,
      units: allUnits.length,
      topics: allTopics.length,
      unitsWithoutTopics: allUnits.filter((u) => u.topics.length === 0).length,
      topicsWithoutOutcomes: allTopics.filter((t) => t.outcomesCount === 0).length,
      topicsWithoutContent: allTopics.filter((t) => !t.content).length,
      contentsWithoutSections: allTopics.filter((t) => t.content && t.content.sections.length === 0).length,
    };
  }, [tree]);

  // Özel özet — kullanıcı bir sınıf VE ders seçtiğinde (genelden özele) sadece o
  // dersin kapsamındaki sayılar gösterilir. selectedLessonId (effectiveLessonId değil)
  // kullanılıyor ki otomatik varsayılan seçim "tıklanmış" sayılmasın.
  const scopeActive = selectedLessonId != null && !!selectedLesson;
  const scopedSummary = useMemo(() => {
    if (!selectedLesson) return null;
    const allTopics = selectedLesson.units.flatMap((u) => u.topics);
    return {
      units: selectedLesson.units.length,
      topics: allTopics.length,
      unitsWithoutTopics: selectedLesson.units.filter((u) => u.topics.length === 0).length,
      topicsWithoutOutcomes: allTopics.filter((t) => t.outcomesCount === 0).length,
      topicsWithoutContent: allTopics.filter((t) => !t.content).length,
      contentsWithoutSections: allTopics.filter((t) => t.content && t.content.sections.length === 0).length,
    };
  }, [selectedLesson]);

  function resetScope() {
    setSelectedGradeId(null);
    setSelectedLessonId(null);
  }

  const filteredUnits = useMemo(() => {
    if (!selectedLesson) return [];
    return filterUnits(selectedLesson.units, search, onlyIssues);
  }, [selectedLesson, search, onlyIssues]);

  function toggleTopic(id: number) {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectGrade(gradeId: number) {
    setSelectedGradeId(gradeId);
    setSelectedLessonId(null);
  }

  function selectLesson(lessonId: number) {
    setSelectedLessonId(lessonId);
  }

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-3">
        <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-400 mb-2">Veri yüklenirken hata oluştu</p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">İçerik Kontrol</h2>
          <p className="text-sm sm:text-base text-gray-400">Soldan bir ders seçin, eksikleri tek bakışta görün</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0 inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-[#111114] border border-white/10 text-xs sm:text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-all"
        >
          <RefreshIcon spinning={refreshing} />
          <span className="hidden sm:inline">{refreshing ? 'Güncelleniyor...' : 'Yenile'}</span>
        </button>
      </header>

      {scopeActive && scopedSummary ? (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs text-gray-400">
              <span className="text-white font-semibold">{selectedGrade?.name}. Sınıf → {selectedLesson?.name}</span> için özet
            </p>
            <button onClick={resetScope} className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300">
              ← Genel özete dön
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat icon="📁" label="Ünite" value={scopedSummary.units} tone="ok" />
            <MiniStat icon="📄" label="Konu" value={scopedSummary.topics} tone="ok" />
            <MiniStat icon="📁" label="Konusuz Ünite" value={scopedSummary.unitsWithoutTopics} tone="warn" />
            <MiniStat icon="🎯" label="Kazanımsız Konu" value={scopedSummary.topicsWithoutOutcomes} tone="warn" />
            <MiniStat icon="📝" label="İçeriksiz Konu" value={scopedSummary.topicsWithoutContent} tone="warn" />
            <MiniStat icon="🧩" label="Alt Konusuz İçerik" value={scopedSummary.contentsWithoutSections} tone="warn" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MiniStat icon="🎓" label="Sınıf" value={summary.grades} tone="ok" />
          <MiniStat icon="📚" label="Ders" value={summary.lessons} tone="ok" />
          <MiniStat icon="📁" label="Ünite" value={summary.units} tone="ok" />
          <MiniStat icon="📄" label="Konu" value={summary.topics} tone="ok" />
          <MiniStat icon="📁" label="Konusuz Ünite" value={summary.unitsWithoutTopics} tone="warn" />
          <MiniStat icon="🎯" label="Kazanımsız Konu" value={summary.topicsWithoutOutcomes} tone="warn" />
          <MiniStat icon="📝" label="İçeriksiz Konu" value={summary.topicsWithoutContent} tone="warn" />
          <MiniStat icon="🧩" label="Alt Konusuz İçerik" value={summary.contentsWithoutSections} tone="warn" />
        </div>
      )}

      {/* Üst: Sınıf sekmeleri */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {tree.map((g) => {
          const active = g.id === effectiveGradeId;
          return (
            <button
              key={g.id}
              onClick={() => selectGrade(g.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                active ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>🎓</span>
              <span>{g.name}. Sınıf</span>
              <InactiveTag active={g.is_active} />
              <IssueBadge count={g.issueCount} />
            </button>
          );
        })}
        {tree.length === 0 && <p className="text-gray-500 text-xs py-2">Sınıf bulunamadı</p>}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sol: Ders navigasyonu (seçili sınıfa ait) */}
        <nav className="lg:w-72 shrink-0 bg-[#111114] border border-white/5 rounded-2xl p-2 max-h-72 lg:max-h-[calc(100vh-300px)] overflow-y-auto">
          {selectedGrade?.lessons.map((l) => {
            const active = l.lessonId === effectiveLessonId;
            return (
              <button
                key={l.lessonId}
                onClick={() => selectLesson(l.lessonId)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all ${
                  active ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>📚</span>
                <span className="truncate flex-1">{l.name}</span>
                <InactiveTag active={l.isActive} />
                <IssueBadge count={l.issueCount} />
              </button>
            );
          })}
          {selectedGrade && selectedGrade.lessons.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-6">Ders bulunamadı</p>
          )}
          {!selectedGrade && <p className="text-gray-500 text-xs text-center py-6">Üstten bir sınıf seçin</p>}
        </nav>

        {/* Sağ: Seçili dersin ünite/konu tablosu */}
        <div className="flex-1 min-w-0">
          {!selectedLesson ? (
            <div className="bg-[#111114] border border-white/5 rounded-2xl p-10 text-center text-gray-500 text-sm">
              Soldan bir ders seçin
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <h3 className="text-white font-semibold">
                  {selectedGrade?.name}. Sınıf <span className="text-gray-500">→</span> {selectedLesson.name}
                </h3>
                <ExistPill ok={selectedLesson.units.length > 0} okLabel={`${selectedLesson.units.length} ünite`} badLabel="Ünite yok" />
                <ExistPill ok={selectedLesson.issueCount === 0} okLabel="Tamamlandı" badLabel={`${selectedLesson.issueCount} eksik`} />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ünite veya konu ara..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#111114] border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111114] border border-white/10 text-sm text-gray-300 cursor-pointer select-none">
                  <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="accent-indigo-500" />
                  Sadece eksikleri göster
                </label>
              </div>

              <div className="bg-[#111114] border border-white/5 rounded-2xl overflow-hidden">
                {filteredUnits.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-10">Sonuç bulunamadı</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-white/5">
                          <th className="py-2.5 px-3 font-medium">Konu</th>
                          <th className="py-2.5 px-3 font-medium whitespace-nowrap">Kazanım</th>
                          <th className="py-2.5 px-3 font-medium whitespace-nowrap">İçerik</th>
                          <th className="py-2.5 px-3 font-medium whitespace-nowrap">Alt Konu</th>
                          <th className="py-2.5 px-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredUnits.map((u) => (
                          <UnitRows key={u.id} unit={u} expandedTopics={expandedTopics} onToggleTopic={toggleTopic} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== TABLE ROWS ====================

function UnitRows({ unit, expandedTopics, onToggleTopic }: { unit: UnitNode; expandedTopics: Set<number>; onToggleTopic: (id: number) => void }) {
  return (
    <>
      <tr className="bg-white/[0.03]">
        <td colSpan={5} className="py-2 px-3">
          <div className="flex items-center gap-2">
            <span>📁</span>
            <span className="font-semibold text-white">{unit.title}</span>
            <InactiveTag active={unit.is_active} />
            <div className="ml-auto">
              <ExistPill ok={unit.topics.length > 0} okLabel={`${unit.topics.length} konu`} badLabel="Konu yok" />
            </div>
          </div>
        </td>
      </tr>
      {unit.topics.length === 0 && (
        <tr>
          <td colSpan={5} className="text-gray-500 text-xs py-1.5 px-3 pl-9">Bu üniteye bağlı konu bulunmuyor</td>
        </tr>
      )}
      {unit.topics.map((t) => (
        <TopicRows key={t.id} topic={t} open={expandedTopics.has(t.id)} onToggle={() => onToggleTopic(t.id)} />
      ))}
    </>
  );
}

function TopicRows({ topic, open, onToggle }: { topic: TopicNode; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-white/5">
        <td className="py-2 px-3 pl-9">
          <span className="text-white">{topic.title}</span>
          <InactiveTag active={topic.is_active} />
        </td>
        <td className="py-2 px-3">
          <ExistPill ok={topic.outcomesCount > 0} okLabel={`${topic.outcomesCount}`} badLabel="Yok" />
        </td>
        <td className="py-2 px-3">
          <ExistPill ok={!!topic.content} okLabel={topic.content?.is_published ? 'Yayında' : 'Taslak'} badLabel="Yok" />
        </td>
        <td className="py-2 px-3">
          <ExistPill ok={!!topic.content && topic.content.sections.length > 0} okLabel={`${topic.content?.sections.length ?? 0}`} badLabel="Yok" />
        </td>
        <td className="py-2 px-3">
          <Chevron open={open} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="pb-2 px-3 pl-9">
            {!topic.content ? (
              <p className="text-gray-500 text-xs py-1">İçerik oluşturulmamış.</p>
            ) : topic.content.sections.length === 0 ? (
              <p className="text-red-300/80 text-xs py-1">İçerik var ama alt konu (başlık) eklenmemiş.</p>
            ) : (
              <div className="space-y-1 py-1">
                {topic.content.sections.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs text-gray-300 py-1">
                    <span className="text-gray-600">🧩</span>
                    <span className="truncate">{s.heading}</span>
                    <span className="ml-auto px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 whitespace-nowrap">
                      {SECTION_STATUS_LABELS[s.status] || s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
