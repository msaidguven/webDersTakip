'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  RagPipelineStatus,
  RagTopicSourceModal,
  RagTopicSourceSynthesisModal,
  RagUnitSourceDedupModal,
  RagTopicAccuracyCheckModal,
  NotebookPlanModal,
  TopicQuestionsModal,
  ToolButton,
} from './AdminTopicSectionsPanel';

// Ders Notu Soru-Cevap (RAG) sayfasına, /admin/konu-icerik/[topicId]'e her konu için tek tek
// girmeden RAG kaynağı oluşturup sentezleyebilmek için eklendi (kullanıcının 2026-09-17
// isteği: "bu sayfadaki rag sistemini buradan alıp ama aynı sayfa stili ile"). Konu seçici
// dışında hiçbir şeyi yeniden yazmıyor — tüm modaller/durum göstergesi AdminTopicSectionsPanel
// ile AYNI, birebir import edilip yeniden kullanılıyor; buradaki tek iş konu/ünite id'sini
// (o sayfada zaten URL'den gelen) bir seçiciyle üretmek.

type GradeRow = { id: number; name: string; order_no: number };
type LessonRow = { id: number; name: string; order_no: number };
type LessonGradeRow = { lesson_id: number; grade_id: number; is_active: boolean };
type UnitRow = { id: number; lesson_id: number; grade_id: number; title: string; order_no: number };
type TopicRow = { id: number; unit_id: number; title: string; order_no: number };

export default function RagTopicBuilderPanel() {
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonGrades, setLessonGrades] = useState<LessonGradeRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [topicId, setTopicId] = useState<number | null>(null);

  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const [loadingBundle, setLoadingBundle] = useState(false);

  // Hangi konuların RAG kaynak metni zaten sentezlenmiş olduğu — "Ders Notu PDF'leri"
  // sekmesindeki ✅ ünite işaretlemesiyle AYNI desen (kullanıcının 2026-09-18 isteği).
  // Ünite "tamamlanmış" sayılır: o ünitedeki TÜM konular sentezlenmiş ise.
  const [synthesizedTopicIds, setSynthesizedTopicIds] = useState<Set<number>>(new Set());

  const [ragSourceModalOpen, setRagSourceModalOpen] = useState(false);
  const [ragSourceSynthesisModalOpen, setRagSourceSynthesisModalOpen] = useState(false);
  const [ragAccuracyCheckModalOpen, setRagAccuracyCheckModalOpen] = useState(false);
  const [ragUnitDedupModalOpen, setRagUnitDedupModalOpen] = useState(false);
  const [notebookPlanVariant, setNotebookPlanVariant] = useState<'full_from_synthesis' | 'content_refresh_from_synthesis' | null>(null);
  const [topicQuestionsVariant, setTopicQuestionsVariant] = useState<'rag_synthesis' | 'classical_rag_synthesis' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [g, l, lg, u, t] = await Promise.all([
        supabase.from('grades').select('id, name, order_no').order('order_no'),
        supabase.from('lessons').select('id, name, order_no').order('order_no'),
        supabase.from('lesson_grades').select('lesson_id, grade_id, is_active').eq('is_active', true),
        supabase.from('units').select('id, lesson_id, grade_id, title, order_no').order('order_no'),
        supabase.from('topics').select('id, unit_id, title, order_no').order('order_no'),
      ]);
      setGrades((g.data as GradeRow[]) || []);
      setLessons((l.data as LessonRow[]) || []);
      setLessonGrades((lg.data as LessonGradeRow[]) || []);
      setUnits((u.data as UnitRow[]) || []);
      setTopics((t.data as TopicRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const lessonOptions = useMemo(() => {
    if (gradeId == null) return [];
    const lessonIds = new Set(lessonGrades.filter((lg) => lg.grade_id === gradeId).map((lg) => lg.lesson_id));
    return lessons.filter((l) => lessonIds.has(l.id));
  }, [gradeId, lessonGrades, lessons]);

  const unitOptions = useMemo(() => {
    if (gradeId == null || lessonId == null) return [];
    return units.filter((u) => u.grade_id === gradeId && u.lesson_id === lessonId);
  }, [gradeId, lessonId, units]);

  const topicOptions = useMemo(() => {
    if (unitId == null) return [];
    return topics.filter((t) => t.unit_id === unitId);
  }, [unitId, topics]);

  // lessonId belirlenince (yani bir ünite listesi oluşunca) o üniteler altındaki TÜM
  // konuların sentez durumunu tek seferde çekiyoruz — hem ünite seçimindeki ✅ hem de
  // konu seçimindeki ✅ için aynı veri yeterli.
  useEffect(() => {
    if (!unitOptions.length) {
      setSynthesizedTopicIds(new Set());
      return;
    }
    const unitIdSet = new Set(unitOptions.map((u) => u.id));
    const relevantTopicIds = topics.filter((t) => unitIdSet.has(t.unit_id)).map((t) => t.id);
    if (!relevantTopicIds.length) {
      setSynthesizedTopicIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/rag/topics-with-synthesis?topicIds=${relevantTopicIds.join(',')}`);
      const data = await res.json().catch(() => null);
      if (!cancelled) setSynthesizedTopicIds(new Set((data?.topicIds as number[] | undefined) || []));
    })();
    return () => { cancelled = true; };
  }, [unitOptions, topics, reloadKey]);

  const unitCompletion = useMemo(() => {
    const map = new Map<number, { done: number; total: number }>();
    for (const unit of unitOptions) {
      const unitTopics = topics.filter((t) => t.unit_id === unit.id);
      const done = unitTopics.filter((t) => synthesizedTopicIds.has(t.id)).length;
      map.set(unit.id, { done, total: unitTopics.length });
    }
    return map;
  }, [unitOptions, topics, synthesizedTopicIds]);

  useEffect(() => {
    if (topicId == null) {
      setSectionCount(null);
      return;
    }
    let cancelled = false;
    setLoadingBundle(true);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        setSectionCount(Array.isArray(data?.sections) ? data.sections.length : 0);
        setLoadingBundle(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId, reloadKey]);

  const selectedTopic = topics.find((t) => t.id === topicId) || null;

  if (loading) return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground block">Konu Seç</span>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select
            value={gradeId ?? ''}
            onChange={(e) => { setGradeId(e.target.value ? Number(e.target.value) : null); setLessonId(null); setUnitId(null); setTopicId(null); }}
            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-bold text-foreground outline-none focus:border-[#6c63ff]"
          >
            <option value="">Sınıf seç...</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select
            value={lessonId ?? ''}
            onChange={(e) => { setLessonId(e.target.value ? Number(e.target.value) : null); setUnitId(null); setTopicId(null); }}
            disabled={gradeId == null}
            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-bold text-foreground outline-none focus:border-[#6c63ff] disabled:opacity-50"
          >
            <option value="">Ders seç...</option>
            {lessonOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select
            value={unitId ?? ''}
            onChange={(e) => { setUnitId(e.target.value ? Number(e.target.value) : null); setTopicId(null); }}
            disabled={lessonId == null}
            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-bold text-foreground outline-none focus:border-[#6c63ff] disabled:opacity-50"
          >
            <option value="">Ünite seç...</option>
            {unitOptions.map((u) => {
              const c = unitCompletion.get(u.id);
              const done = !!c && c.total > 0 && c.done === c.total;
              return <option key={u.id} value={u.id}>{done ? `✅ ${u.title}` : u.title}</option>;
            })}
          </select>
          <select
            value={topicId ?? ''}
            onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}
            disabled={unitId == null}
            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-bold text-foreground outline-none focus:border-[#6c63ff] disabled:opacity-50"
          >
            <option value="">Konu seç...</option>
            {topicOptions.map((t) => (
              <option key={t.id} value={t.id}>{synthesizedTopicIds.has(t.id) ? `✅ ${t.title}` : t.title}</option>
            ))}
          </select>
        </div>

        {unitOptions.length > 0 && (
          <div className="pt-1">
            <p className="text-[11px] text-muted-foreground mb-1.5">Ünite ilerlemesi — kaç konunun RAG kaynağı sentezlendiğini gösterir:</p>
            <div className="flex flex-wrap gap-1.5">
              {unitOptions.map((u) => {
                const c = unitCompletion.get(u.id);
                const done = !!c && c.total > 0 && c.done === c.total;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setUnitId(u.id); setTopicId(null); }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      done
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                        : 'bg-surface border-border text-muted-foreground hover:border-muted-foreground/30'
                    } ${unitId === u.id ? 'ring-1 ring-[#6c63ff]' : ''}`}
                  >
                    {done ? '✅' : '⬜'} {u.title} {c && c.total > 0 ? `(${c.done}/${c.total})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {topicOptions.length > 0 && (
          <div className="pt-1">
            <p className="text-[11px] text-muted-foreground mb-1.5">Konu ilerlemesi — RAG kaynağı sentezlenmiş konular:</p>
            <div className="flex flex-wrap gap-1.5">
              {topicOptions.map((t) => {
                const done = synthesizedTopicIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopicId(t.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      done
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                        : 'bg-surface border-border text-muted-foreground hover:border-muted-foreground/30'
                    } ${topicId === t.id ? 'ring-1 ring-[#6c63ff]' : ''}`}
                  >
                    {done ? '✅' : '⬜'} {t.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {topicId && unitId && selectedTopic && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-black text-foreground">{selectedTopic.title}</h3>

          {loadingBundle ? (
            <p className="text-xs text-muted-foreground">Yükleniyor...</p>
          ) : (
            <>
              <RagPipelineStatus key={reloadKey} topicId={topicId} unitId={unitId} />

              <div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block mb-1.5">🗂️ RAG Kaynak (Kitapsız Ders — Öğrenci Soru-Cevap Kaynağı)</span>
                <div className="flex flex-wrap gap-2">
                  <ToolButton tone="rag" onClick={() => setRagSourceModalOpen(true)}>Kaynak Metni Ekle</ToolButton>
                  <ToolButton tone="rag" onClick={() => setRagSourceSynthesisModalOpen(true)}>Kaynak Metni Sentezle</ToolButton>
                  <ToolButton tone="rag" onClick={() => setRagAccuracyCheckModalOpen(true)}>Doğruluk Kontrolü</ToolButton>
                  <ToolButton tone="rag" onClick={() => setRagUnitDedupModalOpen(true)}>Ünite: Kaynak Tekilleştir</ToolButton>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1.5">🔍 Sentezden İçerik (RAG Kaynağını Ders İçeriğine Dönüştür)</span>
                <div className="flex flex-wrap gap-2">
                  <ToolButton tone="synthesis" onClick={() => setNotebookPlanVariant('full_from_synthesis')}>Sentezden Alt Başlık</ToolButton>
                  {(sectionCount ?? 0) > 0 && (
                    <ToolButton tone="synthesis" onClick={() => setNotebookPlanVariant('content_refresh_from_synthesis')}>Sentezden İçeriği Güncelle</ToolButton>
                  )}
                  <ToolButton tone="synthesis" onClick={() => setTopicQuestionsVariant('rag_synthesis')}>Genel Sorular</ToolButton>
                  <ToolButton tone="synthesis" onClick={() => setTopicQuestionsVariant('classical_rag_synthesis')}>Açık Uçlu Sorular</ToolButton>
                </div>
              </div>

              <a
                href={`/admin/konu-icerik/${topicId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[11px] font-bold text-[#6c63ff] hover:underline"
              >
                Bu konunun tam içerik yönetimini aç →
              </a>
            </>
          )}
        </div>
      )}

      {ragSourceModalOpen && topicId && (
        <RagTopicSourceModal topicId={topicId} onClose={() => setRagSourceModalOpen(false)} onSaved={() => { setRagSourceModalOpen(false); setReloadKey((k) => k + 1); }} />
      )}
      {ragSourceSynthesisModalOpen && topicId && (
        <RagTopicSourceSynthesisModal topicId={topicId} onClose={() => setRagSourceSynthesisModalOpen(false)} onSaved={() => { setRagSourceSynthesisModalOpen(false); setReloadKey((k) => k + 1); }} />
      )}
      {ragAccuracyCheckModalOpen && topicId && (
        <RagTopicAccuracyCheckModal
          topicId={topicId}
          onClose={() => setRagAccuracyCheckModalOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
          onEditSection={() => {
            setRagAccuracyCheckModalOpen(false);
            window.open(`/admin/konu-icerik/${topicId}`, '_blank');
          }}
        />
      )}
      {ragUnitDedupModalOpen && unitId && (
        <RagUnitSourceDedupModal unitId={unitId} onClose={() => setRagUnitDedupModalOpen(false)} onSaved={() => { setRagUnitDedupModalOpen(false); setReloadKey((k) => k + 1); }} />
      )}
      {notebookPlanVariant === 'full_from_synthesis' && topicId && (
        <NotebookPlanModal
          topicId={topicId}
          promptType="full_from_synthesis"
          title="RAG Sentezinden — Tek Prompt (Alt Başlık + İçerik)"
          description="Kitapsız ders — bu prompt, RAG için zaten hazırladığınız çoklu-AI sentez metnini kaynak alır. Dışarıda bir AI'a (ör. Claude) sorup dönen JSON'u aşağıya yapıştırıp tek seferde kaydedin."
          defaultAiModel="Claude Sonnet 5"
          onClose={() => setNotebookPlanVariant(null)}
          onSaved={() => { setNotebookPlanVariant(null); setReloadKey((k) => k + 1); }}
        />
      )}
      {notebookPlanVariant === 'content_refresh_from_synthesis' && topicId && (
        <NotebookPlanModal
          topicId={topicId}
          promptType="content_refresh_from_synthesis"
          title="Sentezden İçeriği Güncelle — Başlıklar Sabit"
          description="Kitapsız ders — alt başlıklar değişmez, mevcut listeleri prompt'a gömülü gelir; sadece her başlığın içeriği RAG için zaten hazırlanmış sentez metniyle yeniden yazılır. Dışarıda bir AI'a (ör. Claude) sorup dönen JSON'u aşağıya yapıştırıp tek seferde kaydedin — görsel/diyagram/soru bağlantıları korunur."
          defaultAiModel="Claude Sonnet 5"
          onClose={() => setNotebookPlanVariant(null)}
          onSaved={() => { setNotebookPlanVariant(null); setReloadKey((k) => k + 1); }}
        />
      )}
      {topicQuestionsVariant && topicId && selectedTopic && (
        <TopicQuestionsModal
          topicId={topicId}
          topicTitle={selectedTopic.title}
          variant={topicQuestionsVariant}
          onClose={() => { setTopicQuestionsVariant(null); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
