'use client';

// Soru sayfasına gömülü, admin-only düzenleme modalı. ManagementTab.tsx'teki
// QuestionEditModal ile aynı /api/admin/manage/questions uç noktalarını kullanır ama
// oradan import EDİLMEZ — ManagementTab.tsx kullanıcı tarafından ayrıca aktif olarak
// düzenlendiği için (bkz. proje notları) çakışmayı önlemek adına bilerek bağımsız,
// kendi kendine yeten bir kopya olarak tutuluyor.

import { useEffect, useState } from 'react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { buildSvgGenerationPrompt } from '@/app/src/lib/svgPromptRules';

type Choice = { id?: number; choice_text?: string; option_text?: string; is_correct: boolean };
type MatchingPair = { id?: number; left_text: string; right_text: string; order_no?: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function ChoiceListEditor({
  title,
  items,
  textKey,
  onChange,
}: {
  title: string;
  items: Choice[];
  textKey: 'choice_text' | 'option_text';
  onChange: (items: Choice[]) => void;
}) {
  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-muted-foreground">{title}</span>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="radio"
              name={title}
              checked={item.is_correct}
              onChange={() => onChange(items.map((it, i) => ({ ...it, is_correct: i === idx })))}
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
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-indigo-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuizQuestionEditModal({
  questionId,
  onClose,
  onSaved,
}: {
  questionId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [blankOptions, setBlankOptions] = useState<Choice[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([]);
  const [classicalAnswer, setClassicalAnswer] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/manage/questions?id=${questionId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error || 'Soru yüklenemedi');
        setLoading(false);
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
  }, [questionId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
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
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.error || 'Kaydedilemedi');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Soru Düzenle{typeCode ? ` (${typeCode})` : ''}</h3>
          <button onClick={onClose} className="text-xl leading-none text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
        ) : (
          <div className="space-y-4">
            {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground sm:text-sm">Soru Metni</label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground sm:text-sm">Zorluk (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground sm:text-sm">Puan (1-10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground sm:text-sm">Çözüm Açıklaması</label>
              <textarea
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground sm:text-sm">SVG Görsel (opsiyonel)</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <textarea
                  value={svgContent}
                  onChange={(e) => setSvgContent(e.target.value)}
                  rows={6}
                  placeholder="<svg ...>...</svg>"
                  spellCheck={false}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2 font-mono text-xs text-foreground outline-none focus:border-indigo-500"
                />
                <div className="flex min-h-[8rem] items-center justify-center rounded-xl border border-border bg-white p-3">
                  {(() => {
                    const clean = svgContent.trim() ? sanitizeMathSvg(svgContent) : null;
                    if (!clean) return <span className="text-xs text-gray-400">{svgContent.trim() ? 'Geçersiz SVG' : 'Önizleme'}</span>;
                    return <div className="max-h-56 max-w-full [&_svg]:max-h-56 [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: clean }} />;
                  })()}
                </div>
              </div>
              {svgContent.trim() && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">SVG konumu:</span>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input type="radio" name="svgPosition" checked={svgPosition === 'above'} onChange={() => setSvgPosition('above')} className="accent-indigo-500" />
                    Soru kökünün üstünde
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input type="radio" name="svgPosition" checked={svgPosition === 'below'} onChange={() => setSvgPosition('below')} className="accent-indigo-500" />
                    Soru kökünün altında
                  </label>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs text-muted-foreground sm:text-sm">SVG Prompt (bu soru için çizim talimatı — başka bir AI&apos;ye vermek üzere)</label>
                {svgPrompt.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(buildSvgGenerationPrompt(svgPrompt));
                      setSvgPromptCopied(true);
                      window.setTimeout(() => setSvgPromptCopied(false), 2000);
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
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
                className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
              />
            </div>

            {choices.length > 0 && <ChoiceListEditor title="Şıklar" items={choices} textKey="choice_text" onChange={setChoices} />}
            {blankOptions.length > 0 && <ChoiceListEditor title="Boşluk Seçenekleri" items={blankOptions} textKey="option_text" onChange={setBlankOptions} />}
            {matchingPairs.length > 0 && (
              <div>
                <span className="mb-2 block text-xs font-semibold text-muted-foreground">Eşleştirme Çiftleri</span>
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
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-indigo-500"
                      />
                      <input
                        value={p.right_text}
                        onChange={(e) => {
                          const next = [...matchingPairs];
                          next[idx] = { ...next[idx], right_text: e.target.value };
                          setMatchingPairs(next);
                        }}
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(classicalAnswer !== '' || typeCode === 'classical') && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground sm:text-sm">Örnek Cevap (Klasik Soru)</label>
                <textarea
                  value={classicalAnswer}
                  onChange={(e) => setClassicalAnswer(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        )}

        {!loading && (
          <div className="mt-4 flex gap-2 sm:mt-6 sm:gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-surface px-4 py-2 text-sm text-foreground hover:bg-accent">
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
