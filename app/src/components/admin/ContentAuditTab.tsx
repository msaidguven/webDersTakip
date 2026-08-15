'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
type UnitNode = UnitRow & { topics: TopicNode[]; hasIssue: boolean };
type LessonNode = { lessonId: number; name: string; order_no: number; units: UnitNode[]; hasIssue: boolean };
type GradeNode = GradeRow & { lessons: LessonNode[]; hasIssue: boolean };

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
    const hasIssue = topics.length === 0 || topics.some((t) => t.hasIssue);
    const node: UnitNode = { ...u, topics, hasIssue };
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

  return raw.grades.map((g) => {
    const lgs = (lessonGradesByGrade.get(g.id) || []).slice().sort((a, b) => {
      const la = lessonById.get(a.lesson_id);
      const lb = lessonById.get(b.lesson_id);
      return (la?.order_no ?? 0) - (lb?.order_no ?? 0);
    });
    const lessons: LessonNode[] = lgs.map((lg) => {
      const lesson = lessonById.get(lg.lesson_id);
      const units = unitsByGradeLesson.get(`${g.id}-${lg.lesson_id}`) || [];
      const hasIssue = units.length === 0 || units.some((u) => u.hasIssue);
      return {
        lessonId: lg.lesson_id,
        name: lesson?.name || `#${lg.lesson_id}`,
        order_no: lesson?.order_no ?? 0,
        units,
        hasIssue,
      };
    });
    const hasIssue = lessons.length === 0 || lessons.some((l) => l.hasIssue);
    return { ...g, lessons, hasIssue };
  });
}

// Arama ile eşleşme üst seviyeden alt seviyeye miras alınır (bir ders eşleşirse
// altındaki tüm üniteler/konular filtrelenmeden gösterilir); eksik-göster filtresi
// ise önceden hesaplanmış hasIssue bayraklarıyla tüm dalı budar.
function filterTree(grades: GradeNode[], searchRaw: string, onlyIssues: boolean): GradeNode[] {
  const q = trFold(searchRaw.trim());
  const matches = (title: string) => !q || trFold(title).includes(q);

  const out: GradeNode[] = [];
  for (const g of grades) {
    const gSelfMatch = matches(g.name);
    const lessonsOut: LessonNode[] = [];
    for (const l of g.lessons) {
      const lSelfMatch = gSelfMatch || matches(l.name);
      const unitsOut: UnitNode[] = [];
      for (const u of l.units) {
        const uSelfMatch = lSelfMatch || matches(u.title);
        let topicsOut = uSelfMatch ? u.topics : u.topics.filter((t) => matches(t.title));
        if (onlyIssues) topicsOut = topicsOut.filter((t) => t.hasIssue);

        const searchPass = uSelfMatch || topicsOut.length > 0;
        if (!searchPass) continue;
        if (onlyIssues && !u.hasIssue) continue;
        unitsOut.push({ ...u, topics: topicsOut });
      }
      const searchPassLesson = lSelfMatch || unitsOut.length > 0;
      if (!searchPassLesson) continue;
      if (onlyIssues && !l.hasIssue) continue;
      lessonsOut.push({ ...l, units: unitsOut });
    }
    const searchPassGrade = gSelfMatch || lessonsOut.length > 0;
    if (!searchPassGrade) continue;
    if (onlyIssues && !g.hasIssue) continue;
    out.push({ ...g, lessons: lessonsOut });
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function TreeRow({ depth, onClick, children }: { depth: number; onClick?: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{ paddingLeft: 12 + depth * 22 }}
      className={`flex items-center gap-2 py-2 pr-3 rounded-lg ${onClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
    >
      {children}
    </div>
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
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
        setLoading(false);
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
      setLoading(false);
    })();
  }, []);

  const tree = useMemo(() => (raw ? buildTree(raw) : []), [raw]);

  const filterActive = onlyIssues || search.trim().length > 0;
  const visibleTree = useMemo(() => filterTree(tree, search, onlyIssues), [tree, search, onlyIssues]);

  const summary = useMemo(() => {
    const allTopics = tree.flatMap((g) => g.lessons.flatMap((l) => l.units.flatMap((u) => u.topics)));
    const allUnits = tree.flatMap((g) => g.lessons.flatMap((l) => l.units));
    return {
      grades: tree.length,
      lessons: raw?.lessons.length || 0,
      units: allUnits.length,
      topics: allTopics.length,
      unitsWithoutTopics: allUnits.filter((u) => u.topics.length === 0).length,
      topicsWithoutOutcomes: allTopics.filter((t) => t.outcomesCount === 0).length,
      topicsWithoutContent: allTopics.filter((t) => !t.content).length,
      contentsWithoutSections: allTopics.filter((t) => t.content && t.content.sections.length === 0).length,
    };
  }, [tree, raw]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isOpen(key: string) {
    return filterActive || expanded.has(key);
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
      <header className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">İçerik Kontrol</h2>
        <p className="text-sm sm:text-base text-gray-400">Sınıf → Ders → Ünite → Konu → İçerik → Alt Konu → Kazanım hiyerarşisi, eksikleri tek bakışta gösterir</p>
      </header>

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

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sınıf, ders, ünite veya konu ara..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#111114] border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111114] border border-white/10 text-sm text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="accent-indigo-500" />
          Sadece eksikleri göster
        </label>
      </div>

      <div className="bg-[#111114] border border-white/5 rounded-2xl overflow-hidden">
        {visibleTree.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-10">Sonuç bulunamadı</p>
        ) : (
          <div className="divide-y divide-white/5">
            {visibleTree.map((g) => (
              <GradeRowView key={g.id} node={g} isOpen={isOpen} toggle={toggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== TREE LEVELS ====================

function GradeRowView({ node, isOpen, toggle }: { node: GradeNode; isOpen: (k: string) => boolean; toggle: (k: string) => void }) {
  const key = `g${node.id}`;
  const open = isOpen(key);
  return (
    <div>
      <TreeRow depth={0} onClick={() => toggle(key)}>
        <Chevron open={open} />
        <span className="text-lg">🎓</span>
        <span className="font-semibold text-white">{node.name}. Sınıf</span>
        <InactiveTag active={node.is_active} />
        <div className="ml-auto flex items-center gap-2">
          <ExistPill ok={node.lessons.length > 0} okLabel={`${node.lessons.length} ders`} badLabel="Ders yok" />
        </div>
      </TreeRow>
      {open && (
        <div className="pb-1">
          {node.lessons.length === 0 && <EmptyHint depth={1} text="Bu sınıfa bağlı ders bulunmuyor" />}
          {node.lessons.map((l) => (
            <LessonRowView key={`${node.id}-${l.lessonId}`} gradeId={node.id} node={l} isOpen={isOpen} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonRowView({ gradeId, node, isOpen, toggle }: { gradeId: number; node: LessonNode; isOpen: (k: string) => boolean; toggle: (k: string) => void }) {
  const key = `l${gradeId}-${node.lessonId}`;
  const open = isOpen(key);
  return (
    <div>
      <TreeRow depth={1} onClick={() => toggle(key)}>
        <Chevron open={open} />
        <span className="text-lg">📚</span>
        <span className="font-medium text-white">{node.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <ExistPill ok={node.units.length > 0} okLabel={`${node.units.length} ünite`} badLabel="Ünite yok" />
        </div>
      </TreeRow>
      {open && (
        <div className="pb-1">
          {node.units.length === 0 && <EmptyHint depth={2} text="Bu derse bağlı ünite bulunmuyor" />}
          {node.units.map((u) => (
            <UnitRowView key={u.id} node={u} isOpen={isOpen} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function UnitRowView({ node, isOpen, toggle }: { node: UnitNode; isOpen: (k: string) => boolean; toggle: (k: string) => void }) {
  const key = `u${node.id}`;
  const open = isOpen(key);
  return (
    <div>
      <TreeRow depth={2} onClick={() => toggle(key)}>
        <Chevron open={open} />
        <span className="text-lg">📁</span>
        <span className="text-white">{node.title}</span>
        <InactiveTag active={node.is_active} />
        <div className="ml-auto flex items-center gap-2">
          <ExistPill ok={node.topics.length > 0} okLabel={`${node.topics.length} konu`} badLabel="Konu yok" />
        </div>
      </TreeRow>
      {open && (
        <div className="pb-1">
          {node.topics.length === 0 && <EmptyHint depth={3} text="Bu üniteye bağlı konu bulunmuyor" />}
          {node.topics.map((t) => (
            <TopicRowView key={t.id} node={t} isOpen={isOpen} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicRowView({ node, isOpen, toggle }: { node: TopicNode; isOpen: (k: string) => boolean; toggle: (k: string) => void }) {
  const key = `t${node.id}`;
  const open = isOpen(key);
  return (
    <div>
      <TreeRow depth={3} onClick={() => toggle(key)}>
        <Chevron open={open} />
        <span className="text-lg">📄</span>
        <span className="text-white">{node.title}</span>
        <InactiveTag active={node.is_active} />
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <ExistPill ok={node.outcomesCount > 0} okLabel={`${node.outcomesCount} kazanım`} badLabel="Kazanım yok" />
          <ExistPill ok={!!node.content} okLabel={node.content?.is_published ? 'İçerik: Yayında' : 'İçerik: Taslak'} badLabel="İçerik yok" />
        </div>
      </TreeRow>
      {open && (
        <div className="pb-2" style={{ paddingLeft: 12 + 4 * 22 }}>
          {!node.content ? (
            <p className="text-gray-500 text-xs py-1.5">İçerik oluşturulmamış.</p>
          ) : node.content.sections.length === 0 ? (
            <p className="text-red-300/80 text-xs py-1.5">İçerik var ama alt konu (başlık) eklenmemiş.</p>
          ) : (
            <div className="space-y-1 py-1">
              {node.content.sections.map((s) => (
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
        </div>
      )}
    </div>
  );
}

function EmptyHint({ depth, text }: { depth: number; text: string }) {
  return (
    <p className="text-gray-500 text-xs py-1.5" style={{ paddingLeft: 12 + depth * 22 + 20 }}>
      {text}
    </p>
  );
}
