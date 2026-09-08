'use client';

// "RAG kuyruğu boşken 3 saatte bir otomatik üretilen soru taslakları" admin onay ekranı
// (kullanıcının 2026-09-08 tasarladığı akış). Her taslak bir alt başlık için 3-7 soru
// (çoktan seçmeli/boşluk doldurma karışık) içerir — admin istediğini düzenler/siler,
// sonra:
// - "Kaydet": tuttuklarını gerçek soru bankasına yazar, bu alt başlık bir daha otomatik
//   üretilmez.
// - "Kaydet ve Tekrar Üret": tuttuklarını AYNI ŞEKİLDE kaydeder AMA alt başlığı otomatik
//   kuyruğa geri koyar (kullanıcının "iyi sorular var ama daha da istiyorum" senaryosu).
// - "Tümünü Reddet": hiçbirini kaydetmeden taslağı kapatır — art arda 2 tam-red'den
//   sonra bu alt başlık otomatik tekrar denenmez (bkz. find_next_ai_question_draft_section).
// Soruları GERÇEKTEN kaydetme işi, mevcut AI soru üretim akışıyla (ClassicalGenerateModal)
// AYNI endpoint'e (/api/admin/topic-sections/section/[sectionId]/questions) devrediliyor —
// burada paralel bir kaydetme mantığı icat edilmiyor.
import { useEffect, useState } from 'react';

type Choice = { text: string; is_correct: boolean };
type DraftQuestion = {
  type: 'multiple_choice' | 'blank';
  question_text: string;
  solution_text?: string | null;
  svg_prompt?: string | null;
  svg_position?: 'above' | 'below';
  choices?: Choice[];
  options?: Choice[];
};

type Draft = {
  id: number;
  sectionId: number;
  aiModel: string | null;
  questions: DraftQuestion[];
  createdAt: string;
  heading: string;
  topicTitle: string;
  unitTitle: string;
  lessonName: string;
  gradeName: string;
};

function choiceListKey(q: DraftQuestion): 'choices' | 'options' {
  return q.type === 'blank' ? 'options' : 'choices';
}

export default function AiQuestionDraftsPanel() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  // Her taslağın kendi düzenlenebilir soru listesi — server'dan gelenden bağımsız,
  // admin silme/düzenleme yaptıkça burada değişir.
  const [editableQuestions, setEditableQuestions] = useState<Record<number, DraftQuestion[]>>({});

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-question-drafts');
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const list = (data?.drafts as Draft[] | null) || [];
        setDrafts(list);
        const map: Record<number, DraftQuestion[]> = {};
        list.forEach((d) => { map[d.id] = d.questions; });
        setEditableQuestions(map);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateQuestionText(draftId: number, idx: number, text: string) {
    setEditableQuestions((cur) => ({
      ...cur,
      [draftId]: cur[draftId].map((q, i) => (i === idx ? { ...q, question_text: text } : q)),
    }));
  }

  function updateChoiceText(draftId: number, qIdx: number, cIdx: number, text: string) {
    setEditableQuestions((cur) => ({
      ...cur,
      [draftId]: cur[draftId].map((q, i) => {
        if (i !== qIdx) return q;
        const key = choiceListKey(q);
        const list = (q[key] || []).map((c, ci) => (ci === cIdx ? { ...c, text } : c));
        return { ...q, [key]: list };
      }),
    }));
  }

  function markCorrect(draftId: number, qIdx: number, cIdx: number) {
    setEditableQuestions((cur) => ({
      ...cur,
      [draftId]: cur[draftId].map((q, i) => {
        if (i !== qIdx) return q;
        const key = choiceListKey(q);
        const list = (q[key] || []).map((c, ci) => ({ ...c, is_correct: ci === cIdx }));
        return { ...q, [key]: list };
      }),
    }));
  }

  function removeQuestion(draftId: number, idx: number) {
    setEditableQuestions((cur) => ({ ...cur, [draftId]: cur[draftId].filter((_, i) => i !== idx) }));
  }

  async function persistStatus(draftId: number, action: 'reject' | 'mark_saved' | 'mark_saved_want_more') {
    const res = await fetch(`/api/admin/ai-question-drafts/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    return res.ok;
  }

  async function handleSave(draft: Draft, wantMore: boolean) {
    setBusyId(draft.id);
    try {
      const kept = editableQuestions[draft.id] || [];
      if (kept.length === 0) {
        // Hiçbir soru tutulmadıysa "tam red" ile aynı — ayrıca boş bir kaydetme isteği
        // atmaya gerek yok.
        const ok = await persistStatus(draft.id, 'reject');
        if (!ok) { showNotice('error', 'İşlem başarısız oldu'); return; }
        setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
        showNotice('success', 'Taslak reddedildi (hiçbir soru tutulmadı)');
        return;
      }

      const saveRes = await fetch(`/api/admin/topic-sections/section/${draft.sectionId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: kept, ai_model: draft.aiModel }),
      });
      const saveData = await saveRes.json().catch(() => null);
      if (!saveRes.ok) {
        showNotice('error', saveData?.error || 'Sorular kaydedilemedi');
        return;
      }

      const ok = await persistStatus(draft.id, wantMore ? 'mark_saved_want_more' : 'mark_saved');
      if (!ok) { showNotice('error', 'Sorular kaydedildi ama taslak durumu güncellenemedi'); return; }

      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      showNotice('success', `${saveData?.savedCount ?? kept.length} soru kaydedildi${wantMore ? ' — bu alt başlık için tekrar üretim kuyruğa alındı' : ''}`);
    } catch {
      showNotice('error', 'Ağ hatası oluştu');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectAll(draft: Draft) {
    setBusyId(draft.id);
    try {
      const ok = await persistStatus(draft.id, 'reject');
      if (!ok) { showNotice('error', 'İşlem başarısız oldu'); return; }
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      showNotice('success', 'Taslak reddedildi');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : drafts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">Onay bekleyen AI soru taslağı yok 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const questions = editableQuestions[draft.id] || [];
            const busy = busyId === draft.id;
            return (
              <div key={draft.id} className="bg-card rounded-2xl border border-border p-4 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                    {draft.gradeName} · {draft.lessonName} · {draft.unitTitle} · {draft.topicTitle}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(draft.createdAt).toLocaleString('tr-TR')}</span>
                </div>
                <p className="mb-3 text-sm font-bold text-foreground">{draft.heading}</p>

                <div className="space-y-3">
                  {questions.map((q, qIdx) => {
                    const key = choiceListKey(q);
                    const list = q[key] || [];
                    return (
                      <div key={qIdx} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-black text-muted-foreground uppercase">
                            {qIdx + 1}. {q.type === 'blank' ? 'Boşluk Doldurma' : 'Çoktan Seçmeli'}
                          </span>
                          <button onClick={() => removeQuestion(draft.id, qIdx)} className="text-[10px] font-bold text-red-400 hover:underline">
                            Sil
                          </button>
                        </div>
                        <textarea
                          value={q.question_text}
                          onChange={(e) => updateQuestionText(draft.id, qIdx, e.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-border bg-surface p-2 text-xs text-foreground resize-none focus:border-indigo-500 outline-none"
                        />
                        <div className="space-y-1.5">
                          {list.map((c, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`draft-${draft.id}-q-${qIdx}`}
                                checked={c.is_correct}
                                onChange={() => markCorrect(draft.id, qIdx, cIdx)}
                                title="Doğru şık"
                              />
                              <input
                                value={c.text}
                                onChange={(e) => updateChoiceText(draft.id, qIdx, cIdx, e.target.value)}
                                className={`flex-1 rounded-lg border p-1.5 text-xs outline-none ${c.is_correct ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' : 'border-border bg-surface text-foreground focus:border-indigo-500'}`}
                              />
                            </div>
                          ))}
                        </div>
                        {q.svg_prompt && (
                          <p className="text-[10px] text-muted-foreground italic">SVG önerisi: {q.svg_prompt} ({q.svg_position === 'below' ? 'altta' : 'üstte'})</p>
                        )}
                      </div>
                    );
                  })}
                  {questions.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Tüm sorular silindi — kaydedilecek bir şey kalmadı.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => handleRejectAll(draft)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-40"
                  >
                    Tümünü Reddet
                  </button>
                  <button
                    onClick={() => handleSave(draft, true)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
                  >
                    Kaydet ve Tekrar Üret
                  </button>
                  <button
                    onClick={() => handleSave(draft, false)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40"
                  >
                    Kaydet ({questions.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
