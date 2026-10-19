'use client';

// Etkileşimli ders oynatıcısı (YALNIZCA ADMİN ÖNİZLEMESİ, 2026-10-19). Sesli anlatımın ses dosyaları ve
// cümleleri omurga; anahtar kavram görselleri ekrana girer, konu içinde iki çoktan seçmeli soru ve bir
// slayt etkinliği araya girer. Mevcut NarrationPlayer'a dokunmaz; ayrı bileşendir.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { narrationPublicUrl } from '@/app/src/lib/narration/config';
import type { NarrationManifest, NarrationScreen } from '@/app/src/lib/narration/types';

type Visual = { term: string; image_url: string };
type Question = { id: number; text: string; choices: { id: number; text: string }[] };
type Activity = { label: string | null; heading: string; reveal: string | null };
type Payload = { manifest: NarrationManifest; visuals: Visual[]; questions: Question[]; activity: Activity | null };

type Scene =
  | { kind: 'narration'; key: string; screen: NarrationScreen; sectionTitle: string; visual: Visual | null; audioUrl: string }
  | { kind: 'question'; key: string; question: Question }
  | { kind: 'activity'; key: string; activity: Activity };

type Answer = { choiceId: number; correct: boolean; correctChoiceId: number | null };

type Props = { topicId: number; onClose: () => void };

// Ekran metninde geçen en uzun anahtar kavramın görseli (Meteor / Meteorit gibi iç içe terimler için).
function visualFor(screen: NarrationScreen, visuals: Visual[]): Visual | null {
  const body = screen.chunks.flatMap((c) => c.parts).map((p) => p.t).join(' ');
  const text = `${screen.eyebrow ?? ''} ${body}`.toLocaleLowerCase('tr-TR');
  const byLength = [...visuals].sort((a, b) => b.term.length - a.term.length);
  return byLength.find((v) => text.includes(v.term.toLocaleLowerCase('tr-TR'))) ?? null;
}

// Sıra: anlatımın ilk bölümü → 1. soru → ikinci bölüm → 3. bölümden sonra slayt etkinliği → kalan bölümler → 2. soru.
function buildScenes(payload: Payload): Scene[] {
  const { manifest, visuals, questions, activity } = payload;
  const scenes: Scene[] = [];
  let questionsPlaced = 0;
  let activityPlaced = false;

  const placeQuestion = () => {
    const q = questions[questionsPlaced];
    if (q) scenes.push({ kind: 'question', key: `q-${q.id}`, question: q });
    questionsPlaced += 1;
  };

  manifest.sections.forEach((section, si) => {
    for (const screen of section.screens) {
      scenes.push({
        kind: 'narration',
        key: screen.id,
        screen,
        sectionTitle: section.title,
        visual: visualFor(screen, visuals),
        audioUrl: narrationPublicUrl(screen.audio.path),
      });
    }
    if (si === 1) placeQuestion();
    if (si === 2 && activity) {
      scenes.push({ kind: 'activity', key: 'activity', activity });
      activityPlaced = true;
    }
  });

  if (!activityPlaced && activity) scenes.push({ kind: 'activity', key: 'activity', activity });
  while (questionsPlaced < questions.length) placeQuestion();
  return scenes;
}

function screenText(screen: NarrationScreen): string {
  return screen.chunks.flatMap((c) => c.parts).map((p) => p.t).join(' ');
}

export default function InteractiveLessonPlayer({ topicId, onClose }: Props) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/interactive-lesson?topicId=${topicId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Yüklenemedi');
        setPayload(data as Payload);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Yüklenemedi');
      });
    return () => controller.abort();
  }, [topicId]);

  const scenes = useMemo(() => (payload ? buildScenes(payload) : []), [payload]);
  const finished = payload !== null && index >= scenes.length;
  const scene = scenes[index] ?? null;

  // Ses: tek bir öğe; sahne anlatımsa çalar, değilse durur. Anlatım bitince bir sonraki sahneye geçer.
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onEnded = () => setIndex((i) => i + 1);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!scene || scene.kind !== 'narration' || !playing) {
      audio.pause();
      return;
    }
    if (audio.src !== scene.audioUrl) audio.src = scene.audioUrl;
    void audio.play().catch(() => setPlaying(false));
  }, [scene, playing]);

  const goTo = useCallback((next: number) => setIndex(Math.max(0, Math.min(next, scenes.length))), [scenes.length]);

  const choose = async (q: Question, choiceId: number) => {
    if (answers[`q-${q.id}`]) return;
    const res = await fetch('/api/admin/interactive-lesson/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, choiceId }),
    });
    const data = await res.json();
    if (res.ok) setAnswers((prev) => ({ ...prev, [`q-${q.id}`]: { choiceId, correct: data.correct, correctChoiceId: data.correctChoiceId } }));
  };

  const start = () => {
    setIndex(0);
    setPlaying(true);
  };

  const restart = () => {
    setIndex(0);
    setAnswers({});
    setRevealed({});
    setPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="Etkileşimli ders önizlemesi">
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)] sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-amber-300">Yönetici önizlemesi · Etkileşimli ders</p>
          <p className="truncate text-sm font-medium text-white/80">{payload?.manifest.topicTitle ?? ''}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="h-1 w-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-[width] duration-300" style={{ width: `${scenes.length ? Math.min(100, (index / scenes.length) * 100) : 0}%` }} />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-6 sm:px-12">
        {error && <p className="max-w-md text-center text-lg text-white/90">{error}</p>}
        {!error && !payload && <Loader2 className="h-9 w-9 animate-spin text-white/60" aria-label="Yükleniyor" />}

        {payload && !error && index === 0 && !playing && !finished && (
          <div className="max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[.14em] text-indigo-300">{payload.manifest.topicTitle}</p>
            <p className="mt-4 text-[clamp(1.5rem,4vw,2.5rem)] font-extrabold leading-tight">Sesli anlatım, görseller, sorular ve bir etkinlik.</p>
            <button type="button" onClick={start} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-slate-900">
              <Play className="h-5 w-5" fill="currentColor" aria-hidden="true" /> Başlat
            </button>
          </div>
        )}

        {payload && !error && finished && (
          <div className="max-w-xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[.14em] text-indigo-300">Ders bitti</p>
            <p className="mt-3 text-3xl font-extrabold">{Object.values(answers).filter((a) => a.correct).length} / {payload.questions.length} soru doğru</p>
            <div className="mt-8 flex justify-center gap-3">
              <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-slate-900">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Baştan izle
              </button>
              <button type="button" onClick={onClose} className="rounded-full px-5 py-3 text-sm font-semibold text-white/80 ring-1 ring-white/25 hover:bg-white/10">Kapat</button>
            </div>
          </div>
        )}

        {payload && !error && !finished && scene?.kind === 'narration' && (
          <div className="flex w-full max-w-6xl flex-col items-center gap-6 lg:flex-row lg:gap-12">
            {scene.visual && (
              <figure key={`${scene.key}-visual`} className="shrink-0 text-center">
                {/* Görsel URL'leri dışarıdan geliyor; next/image alan adı izni gerektirmesin diye düz img. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scene.visual.image_url} alt={scene.visual.term} className="max-h-[34vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl shadow-indigo-900/40 lg:max-h-[60vh] lg:max-w-[40vw]" />
                <figcaption className="mt-2 text-sm font-semibold text-indigo-200">{scene.visual.term}</figcaption>
              </figure>
            )}
            <div className="w-full min-w-0 text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-300">{scene.sectionTitle}</p>
              {scene.screen.eyebrow && <p className="mt-3 text-sm font-semibold text-indigo-200">{scene.screen.eyebrow}</p>}
              <p className={`mt-4 font-extrabold leading-snug ${scene.screen.kind === 'title' ? 'text-[clamp(1.8rem,4.5vw,3.2rem)]' : 'text-[clamp(1.25rem,3vw,2rem)] font-bold'}`}>
                {screenText(scene.screen)}
              </p>
            </div>
          </div>
        )}

        {payload && !error && !finished && scene?.kind === 'question' && (
          <QuestionCard
            question={scene.question}
            answer={answers[scene.key]}
            onChoose={(choiceId) => void choose(scene.question, choiceId)}
          />
        )}

        {payload && !error && !finished && scene?.kind === 'activity' && (
          <div className="max-w-2xl rounded-2xl bg-white/5 p-6 text-center ring-1 ring-white/10">
            {scene.activity.label && <p className="text-xs font-semibold uppercase tracking-[.14em] text-fuchsia-300">{scene.activity.label}</p>}
            <p className="mt-3 text-[clamp(1.25rem,3vw,1.8rem)] font-extrabold">{scene.activity.heading}</p>
            {scene.activity.reveal && !revealed[scene.key] && (
              <button type="button" onClick={() => setRevealed((r) => ({ ...r, [scene.key]: true }))} className="mt-6 rounded-full bg-fuchsia-500 px-5 py-2.5 font-bold text-white">
                Düşündüm, göster
              </button>
            )}
            {scene.activity.reveal && revealed[scene.key] && <p className="mt-6 text-white/90">{scene.activity.reveal}</p>}
          </div>
        )}
      </div>

      {payload && !error && !finished && (
        <div className="flex items-center justify-center gap-4 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
          <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Önceki" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {scene?.kind === 'narration' ? (
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Duraklat' : 'Oynat'} className="grid h-14 w-14 place-items-center rounded-full bg-white text-slate-900">
              {playing ? <Pause className="h-6 w-6" fill="currentColor" aria-hidden="true" /> : <Play className="h-6 w-6" fill="currentColor" aria-hidden="true" />}
            </button>
          ) : (
            <button type="button" onClick={() => goTo(index + 1)} className="rounded-full bg-white px-6 py-3 font-bold text-slate-900">
              Devam
            </button>
          )}
          <button type="button" onClick={() => goTo(index + 1)} aria-label="Sonraki" className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question, answer, onChoose }: { question: Question; answer: Answer | undefined; onChoose: (choiceId: number) => void }) {
  return (
    <div className="w-full max-w-2xl rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
      <p className="text-xs font-semibold uppercase tracking-[.14em] text-emerald-300">Soru</p>
      <p className="mt-3 text-[clamp(1.2rem,3vw,1.6rem)] font-bold leading-snug">{question.text}</p>
      <ul className="mt-6 flex flex-col gap-2.5">
        {question.choices.map((c, i) => {
          const isPicked = answer?.choiceId === c.id;
          const isCorrect = answer?.correctChoiceId === c.id;
          const tone = !answer
            ? 'bg-white/5 hover:bg-white/10 ring-white/15'
            : isCorrect
              ? 'bg-emerald-500/25 ring-emerald-400'
              : isPicked
                ? 'bg-rose-500/25 ring-rose-400'
                : 'bg-white/5 ring-white/10 opacity-60';
          return (
            <li key={c.id}>
              <button type="button" disabled={!!answer} onClick={() => onChoose(c.id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 transition-colors ${tone}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold">{String.fromCharCode(65 + i)}</span>
                <span>{c.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {answer && (
        <p className={`mt-5 font-bold ${answer.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
          {answer.correct ? 'Doğru!' : 'Yanlış, doğru şık yeşil.'}
        </p>
      )}
    </div>
  );
}
