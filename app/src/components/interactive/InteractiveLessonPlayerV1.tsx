'use client';

// Etkileşimli ders oynatıcısı (2026-11-03'ten beri herkese açık; ilerleme kaydı henüz yok). 2026-11-01 oyun tasarımı: dersi anlatıcı robot Atom
// anlatır — konuşma balonu ekranın üstünde sabit, metni Atom sesli okur (önceden üretilmiş sesler, guide.ts),
// arka planda açılıp kapanabilen müzik; ana düğme (Devam / Kontrol et) balonun sonunda (kullanıcı isteği: alt
// çubuk yok, ekran içeriğe kalsın). Ders, konunun bölümleri kadar bloktan oluşur: anlatım → pekiştirme →
// havuzdan test soruları → "Konuyu anladık mı?" ("yazılı" sözcüğü bilerek kullanılmaz) → bölüm sonu.
// Öğrenme anı ilkeleri (kullanıcı kararları): pekiştirmede kırmızı/puan yok; kontrol edilince doğrular ✓ ile
// kilitlenir, yanlışlar ✕ ile öğrenci değiştirene kadar işaretli kalır; deneme sınırsız, iki yanlıştan sonra
// ipucu; bilmeden ilerlenmez. Numaralı/harfli öğeler hiçbir yerde karıştırılmaz.
// Şema: app/src/lib/interactiveLesson/types.ts. Adım durumları üst bileşende tutulur; geri gelince korunur.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Baloo_2 } from 'next/font/google';
import { CheckCircle2, ChevronLeft, Loader2, Maximize2, Minimize2, Minus, Music, Plus, Volume2, VolumeX, X, XCircle } from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { QuestionSvg } from '@/app/src/components/QuizClient';
import LessonFigure, { labelRect, LessonIcon, MapSvg, nearestTerm } from '@/app/src/components/interactive/LessonFigure';
import RobotGuide, { type RobotMood } from '@/app/src/components/interactive/RobotGuide';
import { useFullscreen } from '@/app/src/components/questionPlayer/QuestionPlayerParts';
import type { BlankQuestion, MultipleChoiceQuestion } from '@/app/src/lib/quizQuestionTypes';
import { TERM_LINK, termSlug, type LessonTerm } from '@/app/src/lib/interactiveLesson/types';
import { conceptsIn, linkConcepts } from '@/app/src/lib/interactiveLesson/conceptLinks';
import { GUIDE, narrativeParts, narrativeSpeech, praiseAt, ROBOT_NAME, stepIntro, ttsText, type NarrativePart, voiceAudioPath, voiceKey, voiceManifestPath, VOICE_BUCKET } from '@/app/src/lib/interactiveLesson/guide';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import { trackContentEvent } from '@/app/src/lib/contentUsage';
import { useAuth } from '@/app/src/context/AuthContext';
import type { BlankStep, ExploreStep, FindStep, HydratedLesson, LabelStep, NarrativeStep, HydratedStep, LessonPhoto, LessonVisual, MatchStep, MultiStep, SortStep, TrueFalseStep } from '@/app/src/lib/interactiveLesson/types';

const display = Baloo_2({ subsets: ['latin', 'latin-ext'], weight: ['700', '800'] });

type Props = { topicId: number; onClose: () => void; initialLesson?: HydratedLesson };

const newSeed = () => Math.random().toString(36).slice(2);
const voiceUrl = (text: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VOICE_BUCKET}/${voiceAudioPath(voiceKey(text))}`;

type ChoiceQuestion = MultipleChoiceQuestion | BlankQuestion;
// Bölüm sonu ara ekranı adım listesine sanal adım olarak girer (her bölümden sonra; yanlışların tekrarı orada).
// Anlatım adımı üç ekrana bölünür (part: metin / görsel / yanılgı; bkz. guide.ts narrativeParts).
type FlatStep = { block: number; step: HydratedStep; part?: NarrativePart } | { block: number; step: { kind: 'bolum_sonu' }; part?: undefined };

// Kontrol edilen pekiştirmelerin ortak durumu: marks öğe başına işaret (ok = kilitli doğru, bad = öğrenci
// değiştirene kadar kalan yanlış); fails ipucu için; firstTry yalnız iç istatistik (gösterilmez).
type Mark = 'ok' | 'bad' | null;
type CheckState = { marks: Mark[]; fails: number; solved: boolean; firstTry: boolean | null };
type MatchState = CheckState & { picks: (number | null)[] };
type LabelState = CheckState & { picks: (number | null)[] };
type BlankState = CheckState & { slots: (number | null)[] };
type SortState = CheckState & { slots: (number | null)[] };
type MultiState = CheckState & { picks: boolean[]; missing: boolean };
type TrueFalseState = { picks: (boolean | null)[]; checked: boolean; firstTry: boolean | null };
type ChoiceState = { choiceId: number; correct: boolean };
type PredictState = { pick: number };
type ExploreState = { visited: string[]; pick: number | undefined };
type FindState = { answers: { term: string | null; first?: string | null }[]; firstTry: boolean | null };
type SelfGrade = 'dogru' | 'kismen' | 'yanlis';
type ClassicalState = { text: string; revealed: boolean; self: SelfGrade | null };
type StepState = PredictState | ExploreState | LabelState | FindState | MatchState | TrueFalseState | BlankState | SortState | MultiState | ChoiceState | ClassicalState;

const STEP_LABEL: Record<HydratedStep['kind'], string> = {
  anlatim: 'Anlatım',
  kesif: 'Keşfet',
  etiketle: 'Görseli etiketle',
  bul: 'Görselde bul',
  eslestirme: 'Eşleştir',
  dogru_yanlis: 'Doğru mu, yanlış mı?',
  bosluk: 'Boşlukları doldur',
  siralama: 'Sırala',
  coklu_secim: 'Doğru olanları seç',
  soru: 'Soru',
  klasik: 'Konuyu anladık mı?',
};

function stepLabel(step: HydratedStep): string {
  if (step.kind === 'eslestirme') return step.items.length > step.targets.length ? 'Grupla' : 'Eşleştir';
  return STEP_LABEL[step.kind];
}

function isDone(step: HydratedStep, state: StepState | undefined, part?: NarrativePart): boolean {
  switch (step.kind) {
    case 'anlatim':
      return part !== 'text' || !step.predict || state != null;
    case 'kesif': {
      const st = state as ExploreState | undefined;
      return !!st && st.visited.length === step.items.length && (!step.predict || st.pick !== undefined);
    }
    case 'bul':
      return (state as FindState | undefined)?.firstTry != null;
    case 'dogru_yanlis':
      return !!(state as TrueFalseState | undefined)?.checked;
    case 'etiketle':
    case 'eslestirme':
    case 'bosluk':
    case 'siralama':
    case 'coklu_secim':
      return !!(state as CheckState | undefined)?.solved;
    case 'soru':
      return state != null;
    case 'klasik':
      return !!(state as ClassicalState | undefined)?.revealed;
  }
}

/* ---------------- Anlatıcı (Atom): konuşma + balon ---------------- */

type Tone = 'ok' | 'retry' | 'info' | null;
type Speech = { lines: string[]; mood?: RobotMood; tone?: Tone; sfx?: 'ok' | 'retry' | 'tap' | 'win' };
// say: Atom konuşur (ses + ruh hâli + balon rengi). Balonun İÇERİĞİ ayrıca bildirimseldir: adım, metnini
// <Bubble> ile balona yerleştirir (portal) — kavram bağları gibi canlı öğeler balonda da çalışır.
const SayContext = createContext<(s: Speech) => void>(() => {});
const BubbleContext = createContext<HTMLElement | null>(null);
const useSay = () => useContext(SayContext);

function Bubble({ children }: { children: ReactNode }) {
  const el = useContext(BubbleContext);
  return el ? createPortal(children, el) : null;
}

// Alt çubuk yerine balondaki ana düğme: adım ana eylemini (Kontrol et, Sonraki soru, Karşılaştır) koyar;
// eylem yokken (null) düğme Devam'dır.
type FooterAction = { label: string; disabled?: boolean; run: () => void } | null;
type ActionProps = { setAction: (a: FooterAction) => void };

function useFooterAction(setAction: ActionProps['setAction'], action: FooterAction) {
  // run her çizimde yeni bir kapanış; düğme hep en güncelini çağırsın diye ref'te tutulur.
  const runRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    runRef.current = action?.run ?? null;
  });
  const label = action?.label ?? null;
  const disabled = !!action?.disabled;
  useEffect(() => {
    setAction(label ? { label, disabled, run: () => runRef.current?.() } : null);
  }, [label, disabled, setAction]);
  useEffect(() => () => setAction(null), [setAction]);
}

/* ---------------- Ortak yardımcılar ---------------- */

// Seçenekler her açılışta aynı sırada gelsin (geri/ileri gidince yer değiştirmesin).
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function perm(n: number, seed: string): number[] {
  return seededShuffle(Array.from({ length: n }, (_, i) => i), seed);
}

// Gösterim sırası. Doğal sırası olan öğeler ("1 numara", "2.", "A)", "X gezegeni") HİÇBİR YERDE karıştırılmaz
// (kullanıcı kuralı 2026-11-01: "hep 1, 2, 3, 4"); numara/harf sırasına dizilir. Diğerleri karışık.
const ORDERED_LABEL = /^\s*%?(\d+(?:[.,]\d+)?|[A-ZÇĞİÖŞÜ])(?=$|[\s.):%-])/u;
function displayOrder(texts: string[], seed: string): number[] {
  const keys = texts.map((t) => ORDERED_LABEL.exec(t)?.[1]);
  if (!texts.length || keys.some((k) => k === undefined)) return perm(texts.length, seed);
  const numeric = keys.every((k) => /^\d/.test(k!));
  return texts
    .map((_, i) => i)
    .sort((a, b) => (numeric ? parseFloat(keys[a]!.replace(',', '.')) - parseFloat(keys[b]!.replace(',', '.')) : keys[a]!.localeCompare(keys[b]!, 'tr')));
}

// Kontrol sonucu: doğrular kilitlenir, yanlışlar işaretli kalır.
function afterCheck<T extends CheckState>(s: T, marks: Mark[], solved: boolean): T {
  return { ...s, marks, solved, fails: solved ? s.fails : s.fails + 1, firstTry: s.firstTry ?? solved };
}

// Kontrol anında Atom'un tepkisi (ses + renk). Balondaki yazı CheckFeedback'te.
function checkSpeech(solved: boolean, fails: number, explanation: string, seed: number, missing = false): Speech {
  if (solved) return { lines: [praiseAt(seed), explanation], mood: 'happy', tone: 'ok', sfx: 'ok' };
  const base = missing ? GUIDE.missing : GUIDE.retry;
  return { lines: fails >= 2 ? [base, GUIDE.hint, explanation] : [base], mood: 'oops', tone: 'retry', sfx: 'retry' };
}

// Balondaki geri bildirim: çözülünce övgü + açıklama; yanlış varken ne yapılacağı; iki yanlıştan sonra ipucu.
function CheckFeedback({ s, explanation, seed }: { s: CheckState & { missing?: boolean }; explanation: string; seed: number }) {
  if (s.solved) {
    return (
      <p className="mt-2 text-emerald-800">
        <strong>{praiseAt(seed)}</strong> <ConceptText text={explanation} />
      </p>
    );
  }
  const waiting = s.marks.includes('bad') || s.missing;
  if (!waiting) return null;
  return (
    <div className="mt-2 space-y-1 text-amber-900">
      <p className="font-semibold">{s.missing && !s.marks.includes('bad') ? GUIDE.missing : GUIDE.retry}</p>
      {s.fails >= 2 && (
        <p>
          <strong>{GUIDE.hint}</strong> <ConceptText text={explanation} />
        </p>
      )}
    </div>
  );
}

// Doğru/yanlış rozeti (kutunun köşesinde).
function MarkBadge({ mark }: { mark: Mark }) {
  if (!mark) return null;
  return (
    <span
      className={`absolute -right-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full text-sm font-black text-white shadow ${mark === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`}
      aria-label={mark === 'ok' ? 'Doğru' : 'Yanlış'}
    >
      {mark === 'ok' ? '✓' : '✕'}
    </span>
  );
}

// Oyun düğmesi (kalın alt kenarlı "basılabilir" taş).
const tile = (state: 'idle' | 'picked' | 'ok' | 'bad' = 'idle') =>
  `relative rounded-xl border-2 border-b-4 px-3.5 py-2 text-base font-bold transition active:translate-y-px disabled:cursor-default ${
    state === 'ok'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
      : state === 'bad'
        ? 'border-amber-400 bg-amber-50 text-amber-900'
        : state === 'picked'
          ? 'border-sky-400 bg-sky-50 text-sky-900'
          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
  }`;

const panel = 'rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_3px_0_#d7def0]';
const darkPanel = 'overflow-hidden rounded-2xl bg-[#151c3f] p-3 ring-1 ring-black/5';
const ghostBtn = 'rounded-xl border-2 border-b-4 border-slate-200 bg-white px-4 py-2 text-base font-bold text-slate-700 hover:border-slate-300';

/* ---------------- Metin ve kavramlar ---------------- */

// Anlatım gövdesi: boş satır = paragraf, tek satır sonu = <br>, **kalın**, [[kavram bağı]]. HTML enjekte edilmez.
type TermLinkProps = { active?: string | null; onTerm?: (id: string) => void };

function renderInline(line: string, { active, onTerm }: TermLinkProps): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(`\\*\\*(.+?)\\*\\*|${TERM_LINK.source}`, 'g');
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={m.index} className="font-bold text-slate-900">{m[1]}</strong>);
    } else {
      const label = m[2];
      const id = m[3] ?? termSlug(label);
      out.push(
        onTerm ? (
          <button
            key={m.index}
            type="button"
            aria-pressed={active === id}
            onClick={() => onTerm(id)}
            className={`rounded px-0.5 font-bold underline decoration-dotted decoration-2 underline-offset-4 transition-colors ${
              active === id ? 'bg-amber-200 text-slate-900 decoration-amber-600' : 'text-slate-900 decoration-amber-500 hover:bg-amber-100'
            }`}
          >
            {label}
          </button>
        ) : (
          <strong key={m.index} className="font-bold text-slate-900">{label}</strong>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function RichText({ text, ...termProps }: { text: string } & TermLinkProps) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((para, pi) => (
        <p key={pi}>
          {para.split('\n').map((line, li) => (
            <span key={li}>
              {li > 0 && <br />}
              {renderInline(line, termProps)}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

// Dersin kavram kayıtları (anahtar kavramlar + dersin terms'i) ve otomatik bağlanmayacak genel kavramlar.
const ConceptContext = createContext<{ terms: Record<string, LessonTerm>; exclude: ReadonlySet<string> }>({ terms: {}, exclude: new Set() });

function FactValue({ value }: { value: string }) {
  if (value === '✓') return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Var" />;
  if (value === '✗') return <XCircle className="h-5 w-5 text-slate-400" aria-label="Yok" />;
  return <>{value}</>;
}

// KAVRAM KARTI: resim (kaynağıyla) ya da büyük ikon + tanım + özellik tablosu. Aynı kavram her yerde aynı görünür.
function ConceptCard({ term, inVisual = false, onClose }: { term: LessonTerm; inVisual?: boolean; onClose: () => void }) {
  return (
    <aside className="overflow-hidden rounded-xl bg-amber-50 text-left ring-1 ring-amber-300" aria-live="polite">
      {term.image && (
        <div className="relative bg-[#0d1330]">
          {/* Statik/Storage görseli; next/image alan adı izni gerektirmesin diye düz img. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={term.image.url} alt={term.image.alt} className="mx-auto h-36 w-full object-contain mix-blend-screen" />
          <span className="absolute bottom-1 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white/80">Görsel: {term.image.credit}</span>
        </div>
      )}
      <div className="flex items-start gap-2.5 p-3">
        {!term.image &&
          (term.iconName ? (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
              <LessonIcon name={term.iconName} className="h-6 w-6" />
            </span>
          ) : (
            term.icon && <span className="text-2xl leading-none" aria-hidden="true">{term.icon}</span>
          ))}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">{term.title}</p>
          <p className="mt-0.5 text-base text-slate-700">{term.description}</p>
          {term.facts && term.facts.length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {term.facts.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-2 border-b border-amber-200 py-0.5">
                  <dt className="text-slate-500">{f.label}</dt>
                  <dd className="font-semibold text-slate-900"><FactValue value={f.value} /></dd>
                </div>
              ))}
            </dl>
          )}
          {inVisual && <p className="mt-1.5 text-sm font-semibold text-amber-700">✨ Görselde parlayan kısım</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Kavram kartını kapat" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-amber-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

// Otomatik kavram bağlantılı metin (çözüm, açıklama, örnek cevap): kavram adları dokunulabilir olur.
function ConceptText({ text, className }: { text: string; className?: string }) {
  const { terms, exclude } = useContext(ConceptContext);
  const segments = useMemo(() => linkConcepts(text, terms, exclude), [text, terms, exclude]);
  const [open, setOpen] = useState<string | null>(null);
  if (!segments.some((sg) => sg.term)) return <MathText text={text} className={className} />;
  return (
    <>
      <span className={className}>
        {segments.map((sg, i) =>
          sg.term ? (
            <button
              key={i}
              type="button"
              aria-pressed={open === sg.term}
              onClick={() => setOpen(open === sg.term ? null : sg.term!)}
              className={`rounded px-0.5 font-semibold underline decoration-dotted decoration-2 underline-offset-4 ${
                open === sg.term ? 'bg-sky-100 decoration-sky-600' : 'decoration-sky-500 hover:bg-sky-50'
              }`}
            >
              {sg.text}
            </button>
          ) : (
            <MathText key={i} text={sg.text} />
          ),
        )}
      </span>
      {open && terms[open] && (
        <span className="mt-2 block">
          <ConceptCard term={terms[open]} onClose={() => setOpen(null)} />
        </span>
      )}
    </>
  );
}

// "Görsel açıklama": metinde geçen ve resmi/ikonu/özelliği olan kavramların küçük kartları (örnek cevabın altında).
function ConceptStrip({ text }: { text: string }) {
  const { terms, exclude } = useContext(ConceptContext);
  const ids = useMemo(
    () => conceptsIn(text, terms, exclude).filter((id) => terms[id].image || terms[id].iconName || terms[id].facts?.length),
    [text, terms, exclude],
  );
  const [open, setOpen] = useState<string | null>(null);
  if (!ids.length) return null;
  return (
    <section aria-label="Görsel açıklama" className="space-y-2">
      <p className="text-sm font-bold uppercase tracking-[.12em] text-sky-700">Görsel açıklama</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ids.map((id) => {
          const t = terms[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={open === id}
              onClick={() => setOpen(open === id ? null : id)}
              className={`overflow-hidden rounded-xl bg-white text-left ring-1 ${open === id ? 'ring-2 ring-sky-400' : 'ring-slate-200 hover:ring-slate-300'}`}
            >
              {t.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image.url} alt="" className="h-20 w-full bg-[#0d1330] object-contain mix-blend-normal" />
              ) : (
                <span className="grid h-20 place-items-center bg-sky-50 text-sky-700">
                  {t.iconName ? <LessonIcon name={t.iconName} className="h-9 w-9" /> : <span className="text-3xl">{t.icon}</span>}
                </span>
              )}
              <span className="block px-2 py-1.5">
                <span className="block font-bold text-slate-900">{t.title}</span>
                {t.facts?.slice(0, 2).map((f) => (
                  <span key={f.label} className="flex items-center justify-between gap-1 text-xs text-slate-600">
                    {f.label} <FactValue value={f.value} />
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {open && terms[open] && <ConceptCard term={terms[open]} onClose={() => setOpen(null)} />}
    </section>
  );
}

// Görselli adım: görsel koyu "pencere"de (SVG'ler koyu zemine çizildi). Geniş ekranda görsel solda, içerik sağda.
function WithVisual({ visual, children, split = false }: { visual?: LessonVisual; children?: ReactNode; split?: boolean }) {
  if (!visual) return <div className={split ? 'space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0' : 'space-y-4'}>{children}</div>;
  if (!children) return <LessonFigure visual={visual} />;
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-8">
      <div>
        <LessonFigure visual={visual} compact />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// Yanılgı kartı (çürütme): yanlış inanç açıkça adlandırılır, hemen altında doğrusu.
function MisconceptionCard({ wrong, right }: { wrong: string; right: string }) {
  return (
    <aside className={`${panel} overflow-hidden`} aria-label="Sık yapılan yanılgı">
      <p className="bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-amber-800">Dikkat, sık yapılan yanılgı</p>
      <div className="flex gap-2.5 px-3 pt-3 text-slate-500">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-label="Yanlış" />
        <p className="line-through decoration-amber-500/70">{wrong}</p>
      </div>
      <div className="flex gap-2.5 px-3 pb-3 pt-2 font-semibold text-slate-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Doğrusu" />
        <div>
          <ConceptText text={right} />
        </div>
      </div>
    </aside>
  );
}

/* ---------------- Adımlar ---------------- */

type Predict = NonNullable<NarrativeStep['predict']>;

// "Önce tahmin et": soruyu Atom sorar (balonda); seçenekler sahnede. Cevaplanınca tek satıra iner.
function PredictChoices({ p, pick, seed, onPick }: { p: Predict; pick: number | undefined; seed: string; onPick: (i: number) => void }) {
  const order = useMemo(() => displayOrder(p.options, seed), [p, seed]);
  if (pick === undefined) {
    return (
      <div className="flex flex-wrap gap-2.5">
        {order.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i)}
            className={`${tile()} text-lg`}
          >
            {p.options[i]}
          </button>
        ))}
      </div>
    );
  }
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2 text-base ring-1 ${pick === p.answer ? 'bg-emerald-50 ring-emerald-300' : 'bg-sky-50 ring-sky-300'}`}>
      <span className="text-slate-600">Tahminin: <strong className="text-slate-900">{p.options[pick]}</strong></span>
      <span className="font-bold text-emerald-700">· Doğrusu: {p.options[p.answer]}</span>
    </p>
  );
}

// Anlatım ekranı (üç parçadan biri): text = başlık + metin (kavram bağlarıyla) + varsa tahmin; visual = görsel tam
// genişlik (Atom kartları/adımları okur); mis = sık yapılan yanılgı kartı.
function NarrativeView({ step, part, seed, state, onChange, terms }: { step: NarrativeStep; part: NarrativePart; seed: string; state: PredictState | undefined; onChange: (s: PredictState) => void; terms: Record<string, LessonTerm> }) {
  const say = useSay();
  const p = step.predict;
  const open = !p || !!state;
  // Kavram bağı: dokunulan kavramın tanım kartı açılır; tekrar dokununca kapanır.
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const hasTerms = !!step.body && new RegExp(TERM_LINK.source).test(step.body);
  const activeDef = activeTerm ? terms[activeTerm] : undefined;
  const title = <p className={`${display.className} text-[1.35em] font-extrabold leading-tight text-slate-900`}>{step.title}</p>;

  if (part === 'visual' && step.visual) {
    return (
      <div className="space-y-4">
        <Bubble>
          {title}
          <p className="mt-1">{GUIDE.lookVisual}</p>
        </Bubble>
        <WithVisual visual={step.visual} />
      </div>
    );
  }
  if (part === 'mis' && step.misconception) {
    return (
      <div className="space-y-4">
        <Bubble>
          {title}
          <p className="mt-1 font-bold text-amber-800">{GUIDE.misIntro}</p>
        </Bubble>
        <MisconceptionCard {...step.misconception} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Bubble>
        {title}
        {!open ? (
          <p className="mt-1">{p!.question} <span className="text-slate-500">Bilmesen de olur, tahmin et!</span></p>
        ) : (
          step.body && (
            <div className="mt-1">
              <RichText text={step.body} active={activeTerm} onTerm={(id) => setActiveTerm(activeTerm === id ? null : id)} />
              {hasTerms && !activeTerm && <p className="mt-1 text-sm text-slate-500">💡 Altı noktalı kavramlara dokun.</p>}
            </div>
          )
        )}
      </Bubble>
      {p && (
        <PredictChoices
          p={p}
          pick={state?.pick}
          seed={seed}
          onPick={(pick) => {
            onChange({ pick });
            // Tahmin sonucunun ardından Atom anlatıma geçer (tek konuşma: sonuç + metin).
            const ok = pick === p.answer;
            say({ lines: [ok ? GUIDE.predictOk(p.options[p.answer]) : GUIDE.predictInfo(p.options[p.answer]), step.body ?? step.title], mood: ok ? 'happy' : 'wow', tone: ok ? 'ok' : 'info', sfx: ok ? 'ok' : undefined });
          }}
        />
      )}
      {open && activeTerm && activeDef && <ConceptCard term={activeDef} onClose={() => setActiveTerm(null)} />}
      {open && step.photo && <LessonPhotoView photo={step.photo} />}
    </div>
  );
}

// Gerçek fotoğraf + lisansın istediği atıf (yazar, lisans, kaynak bağlantısı).
function LessonPhotoView({ photo }: { photo: LessonPhoto }) {
  return (
    <figure className="mx-auto max-w-2xl overflow-hidden rounded-2xl border-2 border-b-4 border-slate-200 bg-white">
      {/* Wikimedia adresi; next/image alan adı izni gerektirmesin diye düz img. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.alt} loading="lazy" referrerPolicy="no-referrer" className="max-h-[45vh] w-full bg-slate-100 object-contain" />
      <figcaption className="px-3 py-1.5 text-right text-xs text-slate-500">
        <a href={photo.source} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{photo.credit} · {photo.license} · Wikimedia Commons</a>
      </figcaption>
    </figure>
  );
}

// Keşif haritası: haritaya dokununca Atom o yeri anlatır; yakın plan kartı (resim, özellikler) haritanın yanında.
function ExploreView({ step, seed, state, onChange }: { step: ExploreStep; seed: string; state: ExploreState | undefined; onChange: (s: ExploreState) => void }) {
  const say = useSay();
  const s = state ?? { visited: [], pick: undefined };
  const [selected, setSelected] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { terms: concepts } = useContext(ConceptContext);
  const item = selected ? (concepts[selected] ?? null) : null;
  const allDone = s.visited.length === step.items.length;
  const terms = step.items.map((it) => it.term);
  const open = (term: string) => {
    setSelected(term);
    const visited = s.visited.includes(term) ? s.visited : [...s.visited, term];
    if (visited !== s.visited) onChange({ ...s, visited });
    const t = concepts[term];
    if (t) {
      const done = visited.length === step.items.length && s.visited.length !== visited.length;
      say({ lines: [GUIDE.explore(t.title, t.description), ...(done ? [GUIDE.exploreDone] : [])], mood: done ? 'happy' : 'wow', tone: done ? 'ok' : null, sfx: 'tap' });
    }
    if (window.matchMedia('(max-width: 1023px)').matches) requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const ready = !step.predict || s.pick !== undefined;
  return (
    <div className="space-y-4">
      <Bubble>
        <p className={`${display.className} text-[1.35em] font-extrabold leading-tight text-slate-900`}>{step.title}</p>
        {!ready ? (
          <p className="mt-1">{step.predict!.question} <span className="text-slate-500">Bilmesen de olur, tahmin et!</span></p>
        ) : item ? (
          <p className="mt-1"><strong>{item.title}!</strong> {item.description}</p>
        ) : (
          <p className="mt-1">{step.intro ?? GUIDE.exploreDefault}</p>
        )}
        {ready && allDone && <p className="mt-1 font-bold text-emerald-700">🎉 {GUIDE.exploreDone}</p>}
      </Bubble>
      {step.predict && (
        <PredictChoices
          p={step.predict}
          pick={s.pick}
          seed={seed}
          onPick={(pick) => {
            onChange({ ...s, pick });
            const p = step.predict!;
            const ok = pick === p.answer;
            say({ lines: [ok ? GUIDE.predictOk(p.options[p.answer]) : GUIDE.predictInfo(p.options[p.answer]), step.intro ?? GUIDE.exploreDefault], mood: ok ? 'happy' : 'wow', tone: ok ? 'ok' : 'info', sfx: ok ? 'ok' : undefined });
          }}
        />
      )}
      {ready && (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-6">
          <div className="space-y-3">
            <figure className={darkPanel}>
              <MapSvg
                svg={step.map.svg}
                active={selected}
                dim={0.4}
                maxH="lg:[&>svg]:max-h-[46vh]"
                onPoint={(x, y, box) => {
                  const t = nearestTerm(box, x, y, terms);
                  if (t) open(t);
                }}
              />
              {step.map.caption && <figcaption className="px-1 pt-2 text-center text-sm text-slate-300">{step.map.caption}</figcaption>}
            </figure>
            {/* Haritadaki küçük hedeflere alternatif + erişilebilirlik: aynı öğeler düğme olarak. */}
            <div className="flex flex-wrap gap-2" aria-label="Keşfedilecekler">
              {step.items.map((it) => {
                const seen = s.visited.includes(it.term);
                return (
                  <button key={it.term} type="button" aria-pressed={selected === it.term} onClick={() => open(it.term)} className={`${tile(selected === it.term ? 'picked' : seen ? 'ok' : 'idle')} !px-3 !py-1.5 !text-sm`}>
                    {seen && selected !== it.term ? '✓ ' : ''}
                    {concepts[it.term]?.shortTitle ?? concepts[it.term]?.title ?? it.term}
                  </button>
                );
              })}
            </div>
          </div>
          <div ref={cardRef} className="scroll-mt-40 space-y-3">
            {item ? (
              <article key={selected} className={`${panel} overflow-hidden`}>
                {item.image ? (
                  <div className="relative bg-[#0d1330]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image.url} alt={item.image.alt} className="mx-auto h-48 w-full object-contain mix-blend-screen" />
                    <span className="absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white/80">Görsel: {item.image.credit}</span>
                  </div>
                ) : (
                  (item.iconName || item.icon) && (
                    <div className="grid h-32 place-items-center bg-sky-50 text-sky-700">
                      {item.iconName ? <LessonIcon name={item.iconName} className="h-16 w-16" /> : <span className="text-6xl leading-none" aria-hidden="true">{item.icon}</span>}
                    </div>
                  )
                )}
                <div className="space-y-3 p-4">
                  <h3 className={`${display.className} text-2xl font-extrabold text-slate-900`}>{item.title}</h3>
                  {item.facts && item.facts.length > 0 && (
                    <dl className="flex flex-wrap gap-2">
                      {item.facts.map((fact) => (
                        <div key={fact.label} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm">
                          <dt className="text-slate-500">{fact.label}</dt>
                          <dd className="font-bold text-slate-900"><FactValue value={fact.value} /></dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </article>
            ) : (
              <div className="grid min-h-[10rem] place-items-center rounded-2xl border-[3px] border-dashed border-slate-300 p-6 text-center text-slate-500">
                <p>
                  <span className="text-4xl" aria-hidden="true">🔭</span>
                  <br />
                  Bir yere dokun
                </p>
              </div>
            )}
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-500" aria-label="Keşif ilerlemesi">
              {step.items.map((it) => (
                <span key={it.term} className={`h-3 w-3 rounded-full ${s.visited.includes(it.term) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              ))}
            </p>
            {allDone && step.misconception && <MisconceptionCard {...step.misconception} />}
          </div>
        </div>
      )}
    </div>
  );
}

// Hedef az ise (gruplama, 4'e kadar seçenek) tablo; çok ise satır başına yuva + seçenek bankası.
const MATRIX_MAX_TARGETS = 4;
type MatchPartProps = { step: MatchStep; s: MatchState; pick: (i: number, t: number | null) => void; seed: string; wide: boolean };

function TickButton({ picked, mark, label, disabled, onClick }: { picked: boolean; mark?: Mark; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-grid h-9 w-9 place-items-center rounded-full border-2 font-black text-white ${
        mark === 'ok' ? 'border-emerald-500 bg-emerald-500' : mark === 'bad' ? 'border-amber-500 bg-amber-500' : picked ? 'border-sky-500 bg-sky-500' : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      {mark === 'ok' ? '✓' : mark === 'bad' ? '✕' : picked ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
    </button>
  );
}

function MatchMatrix({ step, s, pick, seed }: MatchPartProps) {
  // Satırlar karışık; sütunlar yalnız bire bir eşleştirmede (gruplamada Karasal/Gazsal gibi doğal sıra kalır).
  const rows = useMemo(() => displayOrder(step.items.map((it) => it.text), `${seed}-r`), [step, seed]);
  const cols = useMemo(() => (step.items.length === step.targets.length ? displayOrder(step.targets, `${seed}-c`) : step.targets.map((_, i) => i)), [step, seed]);
  return (
    <div className={`${panel} overflow-hidden`}>
      <table className="w-full table-fixed border-collapse text-base">
        <thead>
          <tr className="bg-slate-50">
            <th scope="col" className={`${step.targets.length <= 3 ? 'w-[42%]' : 'w-[34%]'} px-3 py-2.5`}><span className="sr-only">Öğe</span></th>
            {cols.map((t) => (
              <th key={t} scope="col" className="px-1 py-2.5 text-center text-sm font-bold leading-tight text-slate-800">{step.targets[t]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const item = step.items[i];
            const mark = s.marks[i];
            return (
              <tr key={i} className={`border-t border-slate-100 ${mark === 'ok' ? 'bg-emerald-50' : mark === 'bad' ? 'bg-amber-50' : ''}`}>
                <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-800">{item.text}</th>
                {cols.map((t) => {
                  const picked = s.picks[i] === t;
                  return (
                    <td key={t} className="py-1.5 text-center">
                      <TickButton picked={picked} mark={picked ? mark : undefined} label={`${item.text}: ${step.targets[t]}`} disabled={mark === 'ok'} onClick={() => pick(i, t)} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Çok hedefli eşleştirme: her satırda boş yuva, altta seçenek bankası; dokun-yerleştir (bilgisayarda sürükle).
function MatchSlots({ step, s, pick, seed, wide }: MatchPartProps) {
  const rows = useMemo(() => displayOrder(step.items.map((it) => it.text), `${seed}-r`), [step, seed]);
  const bankOrder = useMemo(() => displayOrder(step.targets, `${seed}-b`), [step, seed]);
  const oneToOne = step.items.length === step.targets.length;
  const firstEmpty = rows.find((i) => s.picks[i] === null) ?? -1;
  const [active, setActive] = useState<number | null>(null);
  const activeRow = active !== null && s.picks[active] === null ? active : firstEmpty === -1 ? null : firstEmpty;
  const used = new Set(s.picks.filter((p): p is number => p !== null));
  const place = (row: number | null, t: number) => {
    if (row === null || s.marks[row] === 'ok') return;
    pick(row, t);
    setActive(null);
  };
  const tapSlot = (i: number) => {
    if (s.marks[i] === 'ok') return;
    if (s.picks[i] !== null) pick(i, null);
    setActive(i);
  };
  return (
    <div className={`space-y-4 ${wide ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-5 lg:space-y-0' : ''}`}>
      <ul className={`${panel} divide-y divide-slate-100`}>
        {rows.map((i) => {
          const item = step.items[i];
          const mark = s.marks[i];
          const val = s.picks[i];
          const isActive = activeRow === i;
          return (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 font-semibold text-slate-800">{item.text}</span>
              <button
                type="button"
                onClick={() => tapSlot(i)}
                disabled={mark === 'ok'}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const t = Number(e.dataTransfer.getData('text/plain'));
                  if (Number.isInteger(t)) place(i, t);
                }}
                aria-label={val === null ? `${item.text}: boş, seçmek için dokun` : `${item.text}: ${step.targets[val]}`}
                className={`relative inline-flex min-h-10 w-[44%] max-w-[10rem] shrink-0 items-center justify-center rounded-lg px-2.5 text-base font-bold ${
                  mark === 'ok'
                    ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-900'
                    : mark === 'bad'
                      ? 'border-2 border-amber-400 bg-amber-50 text-amber-900'
                      : val !== null
                        ? 'border-2 border-sky-400 bg-sky-50 text-sky-900'
                        : isActive
                          ? 'border-2 border-dashed border-sky-400 bg-sky-50/50 text-sky-700'
                          : 'border-2 border-dashed border-slate-300 text-slate-400'
                }`}
              >
                <MarkBadge mark={mark} />
                {val === null ? (isActive ? 'Seç ↓' : '') : step.targets[val]}
              </button>
            </li>
          );
        })}
      </ul>
      {!s.solved && (
        <div className={`flex flex-wrap gap-2 ${wide ? 'lg:sticky lg:top-0 lg:flex-col lg:items-stretch' : ''}`} aria-label="Seçenekler">
          {bankOrder.map((t) => {
            const gone = oneToOne && used.has(t);
            return (
              <button
                key={t}
                type="button"
                draggable={!gone}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t))}
                disabled={gone || activeRow === null}
                onClick={() => place(activeRow, t)}
                className={`${tile()} cursor-grab disabled:opacity-30`}
              >
                {step.targets[t]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchView({ step, state, onChange, seed, index, setAction }: ActionProps & { step: MatchStep; state: MatchState | undefined; onChange: (s: MatchState) => void; seed: string; index: number }) {
  const say = useSay();
  const s: MatchState = state ?? { picks: step.items.map(() => null), marks: step.items.map(() => null), fails: 0, solved: false, firstTry: null };
  const pick = (i: number, t: number | null) => {
    if (s.solved || s.marks[i] === 'ok') return;
    onChange({ ...s, picks: s.picks.map((p, j) => (j === i ? t : p)), marks: s.marks.map((m, j) => (j === i ? null : m)) });
  };
  const ready = s.picks.every((p) => p !== null) && !s.marks.includes('bad');
  useFooterAction(setAction, !s.solved ? {
    label: 'Kontrol et',
    disabled: !ready,
    run: () => {
      const marks = step.items.map((it, i): Mark => (s.picks[i] === it.target ? 'ok' : 'bad'));
      const next = afterCheck(s, marks, !marks.includes('bad'));
      onChange(next);
      say(checkSpeech(next.solved, next.fails, step.explanation, index));
    },
  } : null);
  return (
    <div className="space-y-4">
      <Bubble>
        <p className="font-bold text-slate-900">{step.prompt}</p>
        <CheckFeedback s={s} explanation={step.explanation} seed={index} />
      </Bubble>
      <WithVisual visual={step.visual}>
        {step.targets.length <= MATRIX_MAX_TARGETS ? <MatchMatrix step={step} s={s} pick={pick} seed={seed} wide={!step.visual} /> : <MatchSlots step={step} s={s} pick={pick} seed={seed} wide={!step.visual} />}
      </WithVisual>
    </div>
  );
}

// Görseli etiketle: gizlenen yazıların yerine yuvalar; bankadan dokun-yerleştir ya da sürükle (bölgenin üstüne
// bırakmak da olur). Yuva konumları SVG'deki yazının gerçek kutusundan ölçülür.
function LabelView({ step, seed, state, onChange, index, setAction }: ActionProps & { step: LabelStep; seed: string; state: LabelState | undefined; onChange: (s: LabelState) => void; index: number }) {
  const say = useSay();
  const s: LabelState = state ?? { picks: step.labels.map(() => null), marks: step.labels.map(() => null), fails: 0, solved: false, firstTry: null };
  const bankOrder = useMemo(() => displayOrder(step.labels.map((l) => l.text), `${seed}-b`), [step, seed]);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [rects, setRects] = useState<({ x: number; y: number } | null)[]>([]);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (!box) return;
    const measure = () => setRects(step.labels.map((l) => labelRect(box, l.term)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [box, step]);
  const firstEmpty = s.picks.findIndex((p) => p === null);
  const activeSlot = active !== null && s.picks[active] === null ? active : firstEmpty === -1 ? null : firstEmpty;
  const used = new Set(s.picks.filter((p): p is number => p !== null));
  const update = (picks: (number | null)[]) => onChange({ ...s, picks, marks: s.marks.map((m, i) => (m === 'ok' ? m : picks[i] === s.picks[i] ? m : null)) });
  const place = (slot: number | null, label: number) => {
    if (slot === null || s.solved || s.marks[slot] === 'ok') return;
    update(s.picks.map((p, i) => (i === slot ? label : p === label && s.marks[i] !== 'ok' ? null : p)));
    setActive(null);
  };
  const slotOf = (term: string | null) => (term ? step.labels.findIndex((l) => l.term === term) : -1);
  const unplace = (label: number) => {
    const i = s.picks.indexOf(label);
    if (i >= 0 && s.marks[i] !== 'ok') update(s.picks.map((p) => (p === label ? null : p)));
  };
  const tapSlot = (i: number) => {
    if (s.solved || s.marks[i] === 'ok') return;
    if (s.picks[i] !== null) update(s.picks.map((p, j) => (j === i ? null : p)));
    setActive(i);
  };
  const ready = s.picks.every((p) => p !== null) && !s.marks.includes('bad');
  useFooterAction(setAction, !s.solved ? {
    label: 'Kontrol et',
    disabled: !ready,
    run: () => {
      const marks = s.picks.map((p, i): Mark => (p === i ? 'ok' : 'bad'));
      const next = afterCheck(s, marks, !marks.includes('bad'));
      onChange(next);
      say(checkSpeech(next.solved, next.fails, step.explanation, index));
    },
  } : null);
  return (
    <div className="space-y-4">
      <Bubble>
        <p className="font-bold text-slate-900">{step.prompt}</p>
        <CheckFeedback s={s} explanation={step.explanation} seed={index} />
      </Bubble>
      <figure className={darkPanel}>
        <MapSvg
          svg={step.map.svg}
          hiddenLabels={step.labels.map((l) => l.term)}
          innerRef={setBox}
          maxH="lg:[&>svg]:max-h-[50vh]"
          onPoint={(x, y, el) => {
            const i = slotOf(nearestTerm(el, x, y, step.labels.map((l) => l.term)));
            if (i >= 0) tapSlot(i);
          }}
          onDropPoint={(x, y, data, el) => {
            const l = Number(data);
            const i = slotOf(nearestTerm(el, x, y, step.labels.map((l2) => l2.term), 70));
            if (Number.isInteger(l) && i >= 0) place(i, l);
          }}
        >
          {step.labels.map((_, i) => {
            const r = rects[i];
            if (!r) return null;
            const val = s.picks[i];
            const mark = s.marks[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => tapSlot(i)}
                draggable={val !== null && mark !== 'ok'}
                onDragStart={(e) => val !== null && e.dataTransfer.setData('text/plain', String(val))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const l = Number(e.dataTransfer.getData('text/plain'));
                  if (Number.isInteger(l)) place(i, l);
                }}
                style={{ left: r.x, top: r.y }}
                aria-label={val === null ? `${i + 1}. yuva, boş` : `${i + 1}. yuva: ${step.labels[val].text}`}
                className={`absolute min-w-[3.6rem] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-bold shadow-lg sm:text-sm ${
                  mark === 'ok'
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-200'
                    : mark === 'bad'
                      ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-100'
                      : val !== null
                        ? 'bg-indigo-500 text-white ring-1 ring-indigo-200'
                        : activeSlot === i
                          ? 'border-2 border-dashed border-amber-300 bg-amber-300/20 text-amber-100'
                          : 'border-2 border-dashed border-white/50 bg-black/30 text-white/70'
                }`}
              >
                {mark === 'ok' ? '✓ ' : mark === 'bad' ? '✕ ' : ''}
                {val === null ? '?' : step.labels[val].text}
              </button>
            );
          })}
        </MapSvg>
      </figure>
      {!s.solved && (
        <div
          className="flex min-h-11 flex-wrap justify-center gap-2"
          aria-label="Etiketler"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const l = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isInteger(l)) unplace(l);
          }}
        >
          {bankOrder.map((l) => (
            <button
              key={l}
              type="button"
              draggable={!used.has(l)}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(l))}
              disabled={used.has(l) || activeSlot === null}
              onClick={() => place(activeSlot, l)}
              className={`${tile()} cursor-grab disabled:opacity-30`}
            >
              {step.labels[l].text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Görselde bul: sorular sırayla; deneme sınırsız, iki yanlıştan sonra doğru yer parlar (ipucu); sayı gösterilmez.
function FindView({ step, state, onChange, index, setAction }: ActionProps & { step: FindStep; state: FindState | undefined; onChange: (s: FindState) => void; index: number }) {
  const say = useSay();
  const s = state ?? { answers: [], firstTry: null };
  const qi = Math.min(s.answers.length, step.questions.length - 1);
  const done = s.answers.length === step.questions.length;
  const [showing, setShowing] = useState<number | null>(null);
  const current = showing ?? (done ? null : qi);
  const q = current !== null ? step.questions[current] : null;
  const answer = current !== null ? s.answers[current] : undefined;
  const name = (term: string | null) => step.zones.find((z) => z.term === term)?.name ?? null;
  const [misses, setMisses] = useState<(string | null)[]>([]);
  const lastMiss = misses.length ? misses[misses.length - 1] : undefined;
  const hint = misses.length >= 2;
  const firstOf = (a: FindState['answers'][number]) => (a.first === undefined ? a.term : a.first);
  const pick = (term: string | null) => {
    if (!q || answer || current !== s.answers.length) return;
    if (term !== q.term) {
      const n = name(term);
      say({ lines: [...(n ? [GUIDE.findWrong(n)] : []), GUIDE.tryAgain, ...(misses.length + 1 >= 2 ? [GUIDE.findHint] : [])], mood: 'oops', tone: 'retry', sfx: 'retry' });
      setMisses((m) => [...m, term]);
      return;
    }
    const answers = [...s.answers, { term, first: misses.length ? misses[0] : term }];
    const finished = answers.length === step.questions.length;
    const allOk = answers.every((a, i) => firstOf(a) === step.questions[i].term);
    onChange({ answers, firstTry: finished ? allOk : null });
    setMisses([]);
    setShowing(current);
    say({ lines: [praiseAt(index + current!), ...(finished && step.explanation ? [step.explanation] : [])], mood: 'happy', tone: 'ok', sfx: 'ok' });
  };
  const awaitingNext = !!q && !!answer && !done && current === s.answers.length - 1;
  useFooterAction(setAction, awaitingNext ? {
    label: 'Sonraki soru',
    run: () => {
      setShowing(null);
      say({ lines: [step.questions[s.answers.length].prompt], mood: 'think' });
    },
  } : null);
  return (
    <div className="space-y-4">
      <Bubble>
        <p className="font-bold text-slate-900">
          {q ? (
            <>
              <span className="mr-1.5 rounded-lg bg-orange-500 px-2 py-0.5 text-white">{current! + 1}/{step.questions.length}</span>
              {q.prompt}
            </>
          ) : (
            step.prompt
          )}
        </p>
        {q && !answer && lastMiss !== undefined && (
          <p className="mt-1 font-semibold text-amber-900">
            {name(lastMiss) ? `${GUIDE.findWrong(name(lastMiss)!)} ` : ''}
            {GUIDE.tryAgain} {hint && GUIDE.findHint}
          </p>
        )}
        {q && answer && <p className="mt-1 font-bold text-emerald-800">{praiseAt(index + current!)}</p>}
        {done && step.explanation && (
          <p className="mt-1 text-slate-700">
            <ConceptText text={step.explanation} />
          </p>
        )}
      </Bubble>
      <figure className={darkPanel}>
        <MapSvg
          svg={step.map.svg}
          active={answer || hint ? q!.term : null}
          dim={0.35}
          hiddenLabels={step.hideLabels}
          maxH="lg:[&>svg]:max-h-[52vh]"
          onPoint={(x, y, box) => pick(nearestTerm(box, x, y, step.zones.map((z) => z.term)))}
        />
      </figure>
    </div>
  );
}

// Sıralama: sabit numaralı yerler; havuzdan dokunulan öğe ilk boş yere girer, dolu yere dokununca havuza döner
// (doğrular kilitli). Yer numarası sabit kaldığı için birini geri almak diğerlerini kaydırmaz.
function SortView({ step, state, onChange, seed, index, setAction }: ActionProps & { step: SortStep; state: SortState | undefined; onChange: (s: SortState) => void; seed: string; index: number }) {
  const say = useSay();
  const shuffled = useMemo(() => {
    const out = seededShuffle(step.items.map((_, i) => i), seed);
    if (out.every((v, i) => v === i) && out.length > 1) [out[0], out[1]] = [out[1], out[0]];
    return out;
  }, [step, seed]);
  const s: SortState = state ?? { slots: step.items.map(() => null), marks: step.items.map(() => null), fails: 0, solved: false, firstTry: null };
  const pool = shuffled.filter((i) => !s.slots.includes(i));
  const ready = s.slots.every((x) => x !== null) && !s.marks.includes('bad');
  useFooterAction(setAction, !s.solved ? {
    label: 'Kontrol et',
    disabled: !ready,
    run: () => {
      const marks = s.slots.map((v, i): Mark => (v === i ? 'ok' : 'bad'));
      const next = afterCheck(s, marks, !marks.includes('bad'));
      onChange(next);
      say(checkSpeech(next.solved, next.fails, step.explanation, index));
    },
  } : null);
  return (
    <div className="space-y-4">
      <Bubble>
        <p className="font-bold text-slate-900">{step.prompt}</p>
        <CheckFeedback s={s} explanation={step.explanation} seed={index} />
      </Bubble>
      <WithVisual visual={step.visual} split={!step.visual}>
        <ol className="space-y-2" aria-label="Senin sıran">
          {step.items.map((_, pos) => {
            const item = s.slots[pos];
            const mark = s.marks[pos];
            return (
              <li key={pos}>
                <button
                  type="button"
                  disabled={item === null || mark === 'ok'}
                  onClick={() => onChange({ ...s, slots: s.slots.map((v, j) => (j === pos ? null : v)), marks: s.marks.map((m, j) => (j === pos ? null : m)) })}
                  aria-label={item === null ? `${pos + 1}. sıra boş` : `${pos + 1}. sıra: ${step.items[item]}`}
                  className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${
                    mark === 'ok' ? 'border-2 border-emerald-500 bg-emerald-50' : mark === 'bad' ? 'border-2 border-amber-400 bg-amber-50' : item === null ? 'border-2 border-dashed border-slate-300' : 'border-2 border-sky-400 bg-sky-50'
                  }`}
                >
                  <MarkBadge mark={mark} />
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-base font-bold text-slate-700">{pos + 1}</span>
                  <span className="font-semibold text-slate-800">{item === null ? '' : step.items[item]}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {pool.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Sıralanacaklar">
            {pool.map((i) => (
              <button key={i} type="button" onClick={() => { const e = s.slots.indexOf(null); if (e >= 0) onChange({ ...s, slots: s.slots.map((v, j) => (j === e ? i : v)) }); }} className={tile()}>
                {step.items[i]}
              </button>
            ))}
          </div>
        )}
      </WithVisual>
    </div>
  );
}

// Çoklu seçim: kartlar aç/kapa. Kontrolde doğru seçilenler kilitlenir, yanlış seçilenler ✕ kalır; eksik doğru
// varsa yeri söylenmez ("bir tane daha bul").
function MultiView({ step, state, onChange, seed, index, setAction }: ActionProps & { step: MultiStep; state: MultiState | undefined; onChange: (s: MultiState) => void; seed: string; index: number }) {
  const say = useSay();
  const order = useMemo(() => displayOrder(step.options.map((o) => o.text), seed), [step, seed]);
  const s: MultiState = state ?? { picks: step.options.map(() => false), marks: step.options.map(() => null), fails: 0, solved: false, firstTry: null, missing: false };
  const ready = s.picks.some(Boolean) && !s.marks.includes('bad');
  useFooterAction(setAction, !s.solved ? {
    label: 'Kontrol et',
    disabled: !ready,
    run: () => {
      const marks = step.options.map((o, i): Mark => (s.picks[i] ? (o.correct ? 'ok' : 'bad') : null));
      const solved = step.options.every((o, i) => s.picks[i] === o.correct);
      const missing = !solved && !marks.includes('bad');
      const next = { ...afterCheck(s, marks, solved), missing };
      onChange(next);
      say(checkSpeech(solved, next.fails, step.explanation, index, missing));
    },
  } : null);
  return (
    <div className="space-y-4">
      <Bubble>
        <p className="font-bold text-slate-900">{step.prompt}</p>
        <CheckFeedback s={s} explanation={step.explanation} seed={index} />
      </Bubble>
      <WithVisual visual={step.visual}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {order.map((i) => {
            const o = step.options[i];
            const picked = s.picks[i];
            const mark = s.marks[i];
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={picked}
                  disabled={s.solved || mark === 'ok'}
                  onClick={() => onChange({ ...s, picks: s.picks.map((p, j) => (j === i ? !p : p)), marks: s.marks.map((m, j) => (j === i ? null : m)), missing: false })}
                  className={`${tile(mark ?? (picked ? 'picked' : 'idle'))} flex h-full w-full flex-col items-center gap-1.5 py-3 text-center`}
                >
                  <MarkBadge mark={mark} />
                  {o.icon && <LessonIcon name={o.icon} className="h-7 w-7 text-sky-600" />}
                  <span className="font-mono text-base font-semibold">{o.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </WithVisual>
    </div>
  );
}

// Doğru/yanlış tablosu: tek kontrol; sonra her ifadenin altında kısa açıklama (yanlışın doğrusu).
function TrueFalseView({ step, state, onChange, seed, index, setAction }: ActionProps & { step: TrueFalseStep; state: TrueFalseState | undefined; onChange: (s: TrueFalseState) => void; seed: string; index: number }) {
  const say = useSay();
  const rows = useMemo(() => displayOrder(step.statements.map((st) => st.text), seed), [step, seed]);
  const s = state ?? { picks: step.statements.map(() => null), checked: false, firstTry: null };
  const allOk = step.statements.every((st, i) => s.picks[i] === st.correct);
  useFooterAction(setAction, !s.checked ? {
    label: 'Kontrol et',
    disabled: !s.picks.every((p) => p !== null),
    run: () => {
      onChange({ ...s, checked: true, firstTry: allOk });
      say(allOk ? { lines: [praiseAt(index)], mood: 'happy', tone: 'ok', sfx: 'ok' } : { lines: [GUIDE.tfMixed], mood: 'think', tone: 'info' });
    },
  } : null);
  return (
    <div className="space-y-4">
      <Bubble>
        <p className="font-bold text-slate-900">{step.prompt}</p>
        {s.checked && <p className={`mt-1 font-semibold ${allOk ? 'text-emerald-800' : 'text-sky-800'}`}>{allOk ? praiseAt(index) : GUIDE.tfMixed}</p>}
      </Bubble>
      <div className={`${panel} overflow-hidden`}>
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="bg-slate-50">
              <th scope="col" className="px-3 py-2.5 text-left text-sm font-semibold text-slate-500">İfade</th>
              <th scope="col" className="w-14 py-2.5 text-center text-sm font-bold text-slate-800">D</th>
              <th scope="col" className="w-14 py-2.5 text-center text-sm font-bold text-slate-800">Y</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const st = step.statements[i];
              const mark: Mark = s.checked ? (s.picks[i] === st.correct ? 'ok' : 'bad') : null;
              return (
                <tr key={i} className={`border-t border-slate-100 ${mark === 'ok' ? 'bg-emerald-50' : mark === 'bad' ? 'bg-amber-50' : ''}`}>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-slate-800">
                    {st.text}
                    {s.checked && (
                      <div className={`mt-1 text-sm ${mark === 'ok' ? 'text-emerald-800' : 'text-amber-900'}`}>
                        <strong>{st.correct ? 'Doğru' : 'Yanlış'}.</strong> <ConceptText text={st.note} />
                      </div>
                    )}
                  </th>
                  {([true, false] as const).map((v) => (
                    <td key={String(v)} className="py-1.5 text-center align-middle">
                      <TickButton picked={s.picks[i] === v} mark={s.picks[i] === v ? mark : undefined} label={`${st.text}: ${v ? 'Doğru' : 'Yanlış'}`} disabled={s.checked} onClick={() => onChange({ ...s, picks: s.picks.map((p, j) => (j === i ? v : p)) })} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BlankView({ step, state, onChange, seed, index, setAction }: ActionProps & { step: BlankStep; state: BlankState | undefined; onChange: (s: BlankState) => void; seed: string; index: number }) {
  const say = useSay();
  const bank = useMemo(() => {
    const words = [...step.answers, ...step.distractors];
    return displayOrder(words, seed).map((i) => words[i]);
  }, [step, seed]);
  const s: BlankState = state ?? { slots: step.answers.map(() => null), marks: step.answers.map(() => null), fails: 0, solved: false, firstTry: null };
  const used = new Set(s.slots.filter((x): x is number => x !== null));
  const place = (b: number) => {
    const empty = s.slots.indexOf(null);
    if (empty === -1 || s.solved) return;
    onChange({ ...s, slots: s.slots.map((x, i) => (i === empty ? b : x)) });
  };
  const clear = (i: number) => {
    if (s.solved || s.slots[i] === null || s.marks[i] === 'ok') return;
    onChange({ ...s, slots: s.slots.map((x, j) => (j === i ? null : x)), marks: s.marks.map((m, j) => (j === i ? null : m)) });
  };
  const ready = s.slots.every((x) => x !== null) && !s.marks.includes('bad');
  useFooterAction(setAction, !s.solved ? {
    label: 'Kontrol et',
    disabled: !ready,
    run: () => {
      const marks = step.answers.map((a, i): Mark => (s.slots[i] !== null && bank[s.slots[i]!] === a ? 'ok' : 'bad'));
      const next = afterCheck(s, marks, !marks.includes('bad'));
      onChange(next);
      say(checkSpeech(next.solved, next.fails, step.explanation, index));
    },
  } : null);
  const parts = step.text.split(/\{(\d+)\}/g);
  return (
    <div className="space-y-4">
      <Bubble>
        <p className="font-bold text-slate-900">{step.prompt}</p>
        <CheckFeedback s={s} explanation={step.explanation} seed={index} />
      </Bubble>
      <WithVisual visual={step.visual}>
        <p className={`${panel} p-4 text-lg leading-[2.6] text-slate-800 lg:text-xl`}>
          {parts.map((part, i) => {
            if (i % 2 === 0) return <span key={i}>{part}</span>;
            const slot = Number(part);
            const val = s.slots[slot];
            const mark = s.marks[slot];
            return (
              <button
                key={i}
                type="button"
                onClick={() => clear(slot)}
                aria-label={val === null ? `${slot + 1}. boşluk, boş` : `${slot + 1}. boşluk: ${bank[val]}`}
                className={`relative mx-1 inline-block min-w-[6.5rem] rounded-lg px-2.5 py-0.5 text-center align-middle font-bold leading-normal ${
                  mark === 'ok' ? 'border-2 border-emerald-500 bg-emerald-50' : mark === 'bad' ? 'border-2 border-amber-400 bg-amber-50' : val === null ? 'border-b-2 border-dashed border-slate-400' : 'border-2 border-sky-400 bg-sky-50'
                }`}
              >
                <MarkBadge mark={mark} />
                {val === null ? ' ' : bank[val]}
              </button>
            );
          })}
        </p>
        {!s.solved && (
          <div className="flex flex-wrap gap-2" aria-label="Kelime bankası">
            {bank.map((word, b) => (
              <button key={b} type="button" disabled={used.has(b)} onClick={() => place(b)} className={`${tile()} disabled:opacity-30`}>
                {word}
              </button>
            ))}
          </div>
        )}
      </WithVisual>
    </div>
  );
}

// Test sorusu (havuzdan): tek deneme (istatistik). Yanlış şık sarı ✕, doğru şık yeşil ✓; çözüm açıklaması.
function ChoiceView({ step, state, onChange, onAnswer, inline = false }: { step: { kind: 'soru'; question: ChoiceQuestion }; state: ChoiceState | undefined; onChange: (s: ChoiceState) => void; onAnswer?: (correct: boolean, answer: string, solution: string) => void; inline?: boolean }) {
  const q = step.question;
  const options = q.type === 'multiple_choice' ? q.choices : q.options;
  const right = options.find((o) => o.is_correct);
  const correctId = right?.id;
  const result = state && (
    <>
      {state.correct ? (
        <strong className="text-emerald-800">{praiseAt(q.id)}</strong>
      ) : (
        <strong className="text-amber-900">
          Doğru cevap: <MathText text={right?.text ?? ''} />
        </strong>
      )}
      {q.solution_text && <ConceptText text={q.solution_text} className="mt-1 block text-slate-700" />}
    </>
  );
  return (
    <div className="space-y-4">
      {!inline && (
        // Soru metni Atom'un balonunda (Atom okur); sahnede metin parçası, görsel ve şıklar.
        <Bubble>
          <MathText as="p" text={q.question_text} className="block whitespace-pre-line font-bold text-slate-900" />
          {result && <div className="mt-1">{result}</div>}
        </Bubble>
      )}
      {q.passage && <MathText as="p" text={q.passage} className={`${panel} block p-4 text-slate-700`} />}
      {q.svg_position === 'above' && <QuestionSvg svgContent={q.svg_content} />}
      {inline && <MathText as="p" text={q.question_text} className="block whitespace-pre-line text-lg font-bold leading-relaxed text-slate-900 lg:text-xl" />}
      {q.svg_position === 'below' && <QuestionSvg svgContent={q.svg_content} />}
      <ul className="space-y-2.5">
        {options.map((o, i) => {
          const mark: Mark = !state ? null : o.id === correctId ? 'ok' : o.id === state.choiceId ? 'bad' : null;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={!!state}
                onClick={() => {
                  const correct = o.id === correctId;
                  onChange({ choiceId: o.id, correct });
                  onAnswer?.(correct, right?.text ?? '', q.solution_text ?? '');
                }}
                className={`${tile(mark ?? 'idle')} flex w-full items-center gap-3 text-left ${state && !mark ? 'opacity-60' : ''}`}
              >
                <MarkBadge mark={mark} />
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-base font-bold text-slate-700">{String.fromCharCode(65 + i)}</span>
                <MathText text={o.text} />
              </button>
            </li>
          );
        })}
      </ul>
      {inline && result && <div className={`${panel} p-3`}>{result}</div>}
    </div>
  );
}

const SELF_GRADES: { value: SelfGrade; label: string }[] = [
  { value: 'dogru', label: 'Doğru yazmışım' },
  { value: 'kismen', label: 'Kısmen' },
  { value: 'yanlis', label: 'Yanlış yazmışım' },
];

function ClassicalView({ step, state, onChange, setAction }: ActionProps & { step: Extract<HydratedStep, { kind: 'klasik' }>; state: ClassicalState | undefined; onChange: (s: ClassicalState) => void }) {
  const say = useSay();
  const q = step.question;
  const s = state ?? { text: '', revealed: false, self: null };
  const reveal = () => {
    onChange({ ...s, revealed: true });
    say({ lines: [GUIDE.klasikReveal], mood: 'think', tone: 'info' });
  };
  useFooterAction(setAction, !s.revealed ? { label: 'Karşılaştır', disabled: !s.text.trim(), run: reveal } : null);
  return (
    <div className="space-y-4">
      <Bubble>
        <MathText as="p" text={q.question_text} className="block whitespace-pre-line font-bold text-slate-900" />
        <p className={`mt-1 text-[0.92em] ${s.revealed ? 'font-semibold text-sky-800' : 'text-slate-500'}`}>{s.revealed ? GUIDE.klasikReveal : GUIDE.klasikAsk}</p>
      </Bubble>
      {q.svg_position === 'above' && <QuestionSvg svgContent={q.svg_content} />}
      {q.svg_position === 'below' && <QuestionSvg svgContent={q.svg_content} />}
      <label className="block">
        <span className="mb-1.5 block text-base text-slate-500">Cevabını kendi cümlelerinle yaz:</span>
        <textarea
          value={s.text}
          readOnly={s.revealed}
          onChange={(e) => onChange({ ...s, text: e.target.value })}
          rows={4}
          className="w-full rounded-xl border-2 border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
          placeholder="Cevabın…"
        />
      </label>
      {!s.revealed ? (
        <button type="button" className={ghostBtn} onClick={reveal}>
          Bilmiyorum, cevabı göster
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
            <p className="text-sm font-bold uppercase tracking-[.12em] text-indigo-700">Örnek cevap</p>
            <div className="mt-1.5 whitespace-pre-line text-slate-800">
              <ConceptText text={q.modelAnswer ?? 'Bu soru için örnek cevap yok.'} />
            </div>
          </div>
          {q.modelAnswer && <ConceptStrip text={q.modelAnswer} />}
          {s.text.trim() && (
            <div>
              <p className="mb-2 text-base text-slate-600">Cevabın örnek cevapla uyuşuyor mu?</p>
              <div role="group" aria-label="Kendi değerlendirmen" className="flex flex-wrap gap-2">
                {SELF_GRADES.map((g) => (
                  <button key={g.value} type="button" aria-pressed={s.self === g.value} onClick={() => onChange({ ...s, self: g.value })} className={tile(s.self === g.value ? 'picked' : 'idle')}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Sayım, yıldız, bölüm sonu ---------------- */

type Tally = { soru: number; soruOk: number; klasik: number; klasikOk: number };

function tally(steps: FlatStep[], states: Record<number, StepState>, block?: number): Tally {
  const t: Tally = { soru: 0, soruOk: 0, klasik: 0, klasikOk: 0 };
  steps.forEach(({ block: b, step }, i) => {
    if (block !== undefined && b !== block) return;
    const st = states[i];
    if (step.kind === 'soru') {
      t.soru++;
      if ((st as ChoiceState | undefined)?.correct) t.soruOk++;
    } else if (step.kind === 'klasik') {
      t.klasik++;
      if ((st as ClassicalState | undefined)?.self === 'dogru') t.klasikOk++;
    }
  });
  return t;
}

// Yıldızlar adım durumlarından türetilir (geri/ileri gidince ikinci kez kazanılmaz). Deneme cezası yok:
// ilk denemede daha çok, sonra daha az — ama her tamamlanan adım yıldız getirir.
function starsOf(steps: FlatStep[], states: Record<number, StepState>): number {
  let n = 0;
  steps.forEach(({ step }, i) => {
    const st = states[i];
    if (!st) return;
    switch (step.kind) {
      case 'anlatim':
        n += (st as PredictState).pick === step.predict?.answer ? 10 : 5;
        break;
      case 'kesif':
        n += 5 * (st as ExploreState).visited.length;
        break;
      case 'bul': {
        const f = st as FindState;
        n += 5 * f.answers.length + (f.firstTry ? 10 : 0);
        break;
      }
      case 'dogru_yanlis':
        if ((st as TrueFalseState).checked) n += (st as TrueFalseState).firstTry ? 20 : 10;
        break;
      case 'soru':
        n += (st as ChoiceState).correct ? 15 : 5;
        break;
      case 'klasik':
        if ((st as ClassicalState).revealed) n += 10;
        break;
      default:
        if ((st as CheckState).solved) n += (st as CheckState).firstTry ? 20 : 10;
    }
  });
  return n;
}

type Retry = { question: ChoiceQuestion; same: boolean };

// Bölümde yanlış yapılan her test sorusu için önce aynı bölümün yedek sorusu, yedek kalmazsa aynı soru.
function retryQuestions(steps: FlatStep[], states: Record<number, StepState>, block: number, spares: ChoiceQuestion[]): Retry[] {
  const wrong = steps.flatMap(({ block: b, step }, i) => (b === block && step.kind === 'soru' && (states[i] as ChoiceState | undefined)?.correct === false ? [step.question] : []));
  return wrong.map((q, i) => (spares[i] ? { question: spares[i], same: false } : { question: q, same: true }));
}

function BlockEnd({ number, nextTitle, result, retries, retryStates, onRetry }: { number: number; nextTitle: string; result: Tally; retries: Retry[]; retryStates: Record<number, ChoiceState>; onRetry: (questionId: number, state: ChoiceState) => void }) {
  return (
    <div className="space-y-6">
      <Bubble>
        <p className="font-bold text-slate-900">{GUIDE.blockEnd(number)}</p>
        {retries.length > 0 && <p className="mt-1">{GUIDE.blockRetry}</p>}
        {nextTitle && <p className="mt-1 text-slate-600">{GUIDE.nextBlock(nextTitle)}</p>}
      </Bubble>
      <div className={`${panel} p-5 text-center`}>
        <p className="text-5xl" aria-hidden="true">🎉</p>
        <p className={`${display.className} mt-2 text-2xl font-extrabold text-slate-900`}>{number}. bölüm tamam!</p>
        {result.soru > 0 && (
          <p className="mt-1 text-slate-600">
            Soruların <strong className="text-slate-900">{result.soruOk}/{result.soru}</strong> tanesini doğru yaptın.
          </p>
        )}
      </div>
      {retries.map((r) => (
        <div key={r.question.id} className={`${panel} p-4`}>
          <p className="mb-3 text-sm font-bold uppercase tracking-[.12em] text-orange-600">{r.same ? 'Aynı soru, tekrar dene' : 'Benzer soru'}</p>
          <ChoiceView inline step={{ kind: 'soru', question: r.question }} state={retryStates[r.question.id]} onChange={(st) => onRetry(r.question.id, st)} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Üst çubuk parçaları ---------------- */

// Yazı ölçeği (akıllı tahta): oynatıcıdaki boyutlar rem tabanlı; kök yazı boyutu her şeyi birlikte büyütür.
const SCALE_KEY = 'interactive-lesson-scale';
const SCALES = [0.875, 1, 1.125, 1.25, 1.5, 1.75, 2];
const MUSIC_KEY = 'interactive-lesson-music';
const VOICE_KEY = 'interactive-lesson-voice';

function readPref<T>(key: string, parse: (v: string | null) => T): T {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function ScaleControl({ scale, onChange }: { scale: number; onChange: (s: number) => void }) {
  const i = SCALES.indexOf(scale);
  const btn = 'flex h-[40px] min-w-[36px] items-center justify-center gap-px rounded-full px-[6px] font-black text-slate-700 hover:bg-slate-100 disabled:opacity-30';
  return (
    <div role="group" aria-label="Yazı boyutu" className="hidden items-center rounded-full border-2 border-slate-200 bg-white sm:flex">
      <button type="button" onClick={() => onChange(SCALES[i - 1])} disabled={i <= 0} aria-label="Yazıyı küçült" title="Yazıyı küçült" className={btn}>
        <span className="text-[12px]">A</span>
        <Minus className="h-[12px] w-[12px]" aria-hidden="true" />
      </button>
      <span className="w-[40px] text-center text-[12px] font-bold tabular-nums text-slate-600">%{Math.round(scale * 100)}</span>
      <button type="button" onClick={() => onChange(SCALES[i + 1])} disabled={i >= SCALES.length - 1} aria-label="Yazıyı büyüt" title="Yazıyı büyüt" className={btn}>
        <span className="text-[16px]">A</span>
        <Plus className="h-[12px] w-[12px]" aria-hidden="true" />
      </button>
    </div>
  );
}

// Rota: bölüm sınırlarında duraklar, roket ilerlemeyi gösterir.
function Route({ steps, index, finished }: { steps: FlatStep[]; index: number; finished: boolean }) {
  const total = steps.length;
  const pct = finished ? 100 : Math.max(0, (index / total) * 100);
  const stops = steps.flatMap((s, i) => (s.step.kind === 'bolum_sonu' ? [((i + 1) / total) * 100] : []));
  return (
    <div className="relative mx-[10px] h-[34px] min-w-0 flex-1" aria-label="Ders ilerlemesi" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-slate-200" />
      <span className="absolute left-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-orange-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      {stops.map((left) => (
        <span key={left} className={`absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] ${pct >= left ? 'border-orange-500 bg-orange-500' : 'border-slate-200 bg-[#eef2fb]'}`} style={{ left: `${left}%` }} />
      ))}
      <span className="absolute top-1/2 -translate-x-1/2 -translate-y-[58%] text-[22px] leading-none transition-[left] duration-500" style={{ left: `${pct}%` }} aria-hidden="true">🚀</span>
    </div>
  );
}

function Confetti() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const x = c.getContext('2d');
    if (!x) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const colors = ['#ff8a1f', '#ffc531', '#1fa971', '#2f7de1', '#e64a8c'];
    const parts = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4, r: 4 + Math.random() * 5, v: 2 + Math.random() * 3, s: Math.random() * 6, c: colors[Math.floor(Math.random() * 5)] }));
    let t = 0;
    let raf = 0;
    const frame = () => {
      x.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.y += p.v;
        p.x += Math.sin((t + p.s) / 10);
        x.fillStyle = p.c;
        x.fillRect(p.x, p.y, p.r, p.r * 1.6);
      }
      if (++t < 220) raf = requestAnimationFrame(frame);
      else x.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[130]" aria-hidden="true" />;
}

/* ---------------- Oynatıcı ---------------- */

// Üyenin kaldığı yer (interactive_lesson_progress, RLS ile yalnız kendi satırı; 2026-11-03). Ders yeniden üretilip
// adım sayısı değiştiyse kayıt yok sayılır (adım numaraları artık başka adımları gösterir).
type SavedProgress = { stepIndex: number; state: { states?: Record<number, StepState>; retryStates?: Record<number, ChoiceState>; seed?: string } };
const PROGRESS_SAVE_DELAY_MS = 1200;

export default function InteractiveLessonPlayerV1({ topicId, onClose, initialLesson }: Props) {
  const [lesson, setLesson] = useState<HydratedLesson | null>(initialLesson ?? null);
  const [error, setError] = useState<string | null>(null);
  // -1 = giriş ekranı, steps.length = bitiş ekranı.
  const [index, setIndex] = useState(-1);
  const [states, setStates] = useState<Record<number, StepState>>({});
  const [retryStates, setRetryStates] = useState<Record<number, ChoiceState>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const [scale, setScale] = useState(() => readPref(SCALE_KEY, (v) => (SCALES.includes(Number(v)) ? Number(v) : 1)));
  const [musicOn, setMusicOn] = useState(() => readPref(MUSIC_KEY, (v) => v !== '0'));
  const [voiceOn, setVoiceOn] = useState(() => readPref(VOICE_KEY, (v) => v !== '0'));
  const [stepAction, setStepAction] = useState<FooterAction>(null);
  const [sessionSeed, setSessionSeed] = useState(newSeed);
  const [bubbleEl, setBubbleEl] = useState<HTMLDivElement | null>(null);
  const [mood, setMood] = useState<RobotMood>('normal');
  const [tone, setTone] = useState<Tone>(null);
  const [talking, setTalking] = useState(false);
  const [voiced, setVoiced] = useState<Set<string> | null>(null);
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState<SavedProgress | null>(null);
  const { user, supabase } = useAuth();
  const userId = user?.id;
  const lastSpeech = useRef<Speech | null>(null);
  // say() kararlı (useCallback) kalsın diye güncel ayarlar ref'te; effect'ler bildirim sırasıyla çalışır, bu
  // eşitleme ekran konuşmasından (aşağıda) önce yapılır.
  const voiceOnRef = useRef(voiceOn);
  const voicedRef = useRef(voiced);
  const startedRef = useRef(started);
  useEffect(() => {
    voiceOnRef.current = voiceOn;
    voicedRef.current = voiced;
    startedRef.current = started;
  });

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.fontSize;
    html.style.fontSize = `${scale * 100}%`;
    writePref(SCALE_KEY, String(scale));
    return () => {
      html.style.fontSize = previous;
    };
  }, [scale]);

  useEffect(() => {
    const controller = new AbortController();
    if (!initialLesson) {
      fetch(`/api/interactive-lesson?topicId=${topicId}`, { signal: controller.signal })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Yüklenemedi');
          setLesson(data as HydratedLesson);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Yüklenemedi');
        });
    }
    // Seslendirilmiş cümlelerin listesi (yoksa Atom yalnız yazıyla konuşur).
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VOICE_BUCKET}/${voiceManifestPath(topicId)}`, { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { keys?: string[] } | null) => setVoiced(new Set(m?.keys ?? [])))
      .catch(() => setVoiced(new Set()));
    return () => controller.abort();
  }, [topicId, initialLesson]);

  // Ses: sekme gizlenince sus; oynatıcı kapanınca müzik dursun.
  useEffect(() => {
    const sound = lessonSound();
    const onVis = () => (document.hidden ? sound.suspend() : sound.resume());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      sound.close();
    };
  }, []);

  // Atom konuşur: ruh hâli + balon rengi + ses. Durum güncellemeleri bir sonraki görev adımında (ekran açılış
  // konuşması effect içinden çağrılır; ses dış sistemdir, durum ona eşlik eder).
  const say = useCallback((s: Speech) => {
    lastSpeech.current = s;
    const sound = lessonSound();
    // Dersi açan tıklama ses bağlamını açtıysa karşılama cümlesi de okunur (müzik yine "Başla" ile).
    const audible = voiceOnRef.current && (startedRef.current || sound.isUnlocked());
    if (audible && s.sfx) sound.sfx(s.sfx);
    const items = audible ? s.lines.map((l) => ({ url: voicedRef.current?.has(voiceKey(l)) ? voiceUrl(l) : null, text: ttsText(l) })) : [];
    queueMicrotask(() => {
      setMood(s.mood ?? 'normal');
      setTone(s.tone ?? null);
      setTalking(true);
    });
    if (!items.length) {
      sound.hush();
      window.setTimeout(() => setTalking(false), 1200);
      return;
    }
    void sound.speak(items, () => setTalking(false));
  }, []);

  const concepts = useMemo(() => ({ terms: lesson?.terms ?? {}, exclude: new Set(lesson?.autoLinkExclude ?? []) }), [lesson]);
  const steps = useMemo<FlatStep[]>(
    () =>
      lesson
        ? lesson.blocks.flatMap((b, block): FlatStep[] => [
            ...b.steps.flatMap((step): FlatStep[] => (step.kind === 'anlatim' ? narrativeParts(step).map((part) => ({ block, step, part })) : [{ block, step }])),
            { block, step: { kind: 'bolum_sonu' as const } },
          ])
        : [],
    [lesson],
  );
  const current = index >= 0 ? steps[index] : undefined;
  const finished = lesson !== null && index >= steps.length;
  const stars = useMemo(() => starsOf(steps, states), [steps, states]);

  const goTo = setIndex;
  // Ekran değişince başa kaydır (goTo'da değil: ref'e dokunan işlev düğme verisine girince React derleyicisi uyarır).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);
  const setState = (i: number) => (s: StepState) => setStates((prev) => ({ ...prev, [i]: s }));

  // Ekrana girince Atom'un açılış konuşması. states bilerek bağımlılık değil: yalnız ekran değişince konuşur.
  const statesRef = useRef(states);
  useEffect(() => {
    statesRef.current = states;
  });
  useEffect(() => {
    if (!lesson || !voiced) return;
    if (index === -1) return say({ lines: [lesson.guide?.intro ?? GUIDE.intro(lesson.topicTitle)], mood: 'wow' });
    if (index >= steps.length) return say({ lines: [lesson.guide?.finish ?? GUIDE.finish], mood: 'happy', tone: 'ok', sfx: 'win' });
    const { step, block, part } = steps[index];
    if (step.kind === 'bolum_sonu') {
      const retries = retryQuestions(steps, statesRef.current, block, lesson.blocks[block].spares);
      const nextTitle = lesson.blocks[block + 1]?.title;
      return say({ lines: [GUIDE.blockEnd(block + 1), ...(retries.length ? [GUIDE.blockRetry] : []), ...(nextTitle ? [GUIDE.nextBlock(nextTitle)] : [])], mood: 'happy', tone: 'ok' });
    }
    const st = statesRef.current[index];
    if ((step.kind === 'anlatim' ? part === 'text' && !st : step.kind === 'kesif' && (st as ExploreState | undefined)?.pick === undefined) && 'predict' in step && step.predict) {
      return say({ lines: [step.predict.question], mood: 'think' });
    }
    if (step.kind === 'anlatim') return say({ lines: narrativeSpeech(step, part ?? 'text'), mood: part === 'mis' ? 'wow' : part === 'visual' ? 'happy' : 'normal' });
    say({ lines: [stepIntro(step)], mood: 'think' });
  }, [index, lesson, voiced, steps, say]);

  // Ekrandaki seslerin önceden indirilmesi (konuşma anında bekleme olmasın).
  useEffect(() => {
    if (!started || !voiced || !current || current.step.kind === 'bolum_sonu') return;
    const step = current.step;
    const intro = step.kind === 'anlatim' ? narrativeSpeech(step, current.part ?? 'text') : [stepIntro(step)];
    const lines = [...intro, ...('explanation' in step && step.explanation ? [step.explanation] : []), ...GUIDE.praise.slice(0, 2)];
    lessonSound().preload(lines.filter((l) => voiced.has(voiceKey(l))).map(voiceUrl));
  }, [started, voiced, current]);

  // Üye: kaldığı yeri oku (yalnız yarım kalmış ve ders değişmemişse "Devam et" sunulur).
  useEffect(() => {
    if (!userId || !steps.length) return;
    let cancelled = false;
    supabase
      .from('interactive_lesson_progress')
      .select('step_index, step_count, state, finished')
      .eq('topic_id', topicId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { step_index: number; step_count: number; state: SavedProgress['state']; finished: boolean } | null;
        if (cancelled || !row || row.finished || row.step_count !== steps.length || row.step_index <= 0 || row.step_index >= steps.length) return;
        setSaved({ stepIndex: row.step_index, state: row.state ?? {} });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, supabase, topicId, steps.length]);

  // Üye: ilerlemeyi kaydet (kısa gecikmeyle, art arda değişikliklerde tek yazma). Tarayıcıdan doğrudan, RLS ile.
  useEffect(() => {
    if (!userId || !started || !steps.length || index < 0) return;
    const t = window.setTimeout(() => {
      // Sorgu ancak sonucu beklenince gönderilir (supabase-js) — then şart.
      supabase.from('interactive_lesson_progress').upsert({
        user_id: userId,
        topic_id: topicId,
        step_index: Math.min(index, steps.length - 1),
        step_count: steps.length,
        state: { states, retryStates, seed: sessionSeed },
        finished: index >= steps.length,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('[etkileşimli ders] ilerleme kaydedilemedi:', error.message);
      });
    }, PROGRESS_SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [userId, supabase, started, topicId, index, steps.length, states, retryStates, sessionSeed]);

  useEffect(() => {
    if (finished && started) trackContentEvent('interactive_finish', topicId);
  }, [finished, started, topicId]);

  const canContinue = current ? current.step.kind === 'bolum_sonu' || isDone(current.step, states[index], current.part) : false;
  const isLast = index === steps.length - 1;
  const seed = `${sessionSeed}-${index}`;

  const begin = (at: number) => {
    // Ses bağlamı yalnız bir dokunuşun içinde açılabilir (tarayıcı kuralı).
    const sound = lessonSound();
    sound.unlock();
    if (musicOn) sound.startMusic();
    setStarted(true);
    trackContentEvent('interactive_open', topicId);
    goTo(at);
  };
  const start = () => {
    setSaved(null);
    begin(0);
  };
  // Kaldığı yerden: adım durumları ve karıştırma tohumu geri yüklenir (seçenekler aynı sırada gelsin).
  const resume = () => {
    if (!saved) return start();
    setStates(saved.state.states ?? {});
    setRetryStates(saved.state.retryStates ?? {});
    if (saved.state.seed) setSessionSeed(saved.state.seed);
    begin(saved.stepIndex);
  };
  const restart = () => {
    setStates({});
    setRetryStates({});
    setSessionSeed(newSeed());
    goTo(0);
  };
  const toggleMusic = () => {
    const on = !musicOn;
    setMusicOn(on);
    writePref(MUSIC_KEY, on ? '1' : '0');
    const sound = lessonSound();
    if (on && started) sound.startMusic();
    else sound.stopMusic();
  };
  const toggleVoice = () => {
    const on = !voiceOn;
    setVoiceOn(on);
    voiceOnRef.current = on;
    writePref(VOICE_KEY, on ? '1' : '0');
    if (!on) {
      lessonSound().hush();
      setTalking(false);
    }
  };

  // Balondaki ana düğme: adımın eylemi, yoksa Devam / Dersi bitir / Başla / Baştan başla.
  const primary: { label: string; disabled?: boolean; run: () => void } | null = !lesson
    ? null
    : index === -1
      ? saved
        ? { label: 'Devam et', run: resume }
        : { label: 'Başla', run: start }
      : finished
        ? { label: 'Baştan başla', run: restart }
        : stepAction ?? { label: isLast ? 'Dersi bitir' : 'Devam', disabled: !canContinue, run: () => goTo(index + 1) };

  // Bilgisayarda → / PageDown ana düğme, ← / PageUp geri (akıllı tahta kumandaları bu tuşları gönderir).
  const primaryRef = useRef<FooterAction>(null);
  useEffect(() => {
    primaryRef.current = primary;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) return;
      const p = primaryRef.current;
      if ((e.key === 'ArrowRight' || e.key === 'PageDown') && p && !p.disabled) p.run();
      if ((e.key === 'ArrowLeft' || e.key === 'PageUp') && index > 0) goTo(index - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, goTo, onClose]);

  const toneBox =
    tone === 'ok' ? 'border-emerald-400 bg-emerald-50 shadow-[0_4px_0_#86e0b6]' : tone === 'retry' ? 'border-amber-400 bg-amber-50 shadow-[0_4px_0_#f4cf6b]' : tone === 'info' ? 'border-sky-400 bg-sky-50 shadow-[0_4px_0_#9ccaf5]' : 'border-[#c9d3f0] bg-white shadow-[0_4px_0_#c9d3f0]';
  const eyebrow = current
    ? current.step.kind === 'bolum_sonu'
      ? `Bölüm ${current.block + 1} sonu`
      : `Bölüm ${current.block + 1}/${lesson!.blocks.length} · ${current.part === 'mis' ? 'Dikkat' : current.part === 'visual' ? 'Anlatım · Görsel' : stepLabel(current.step)}`
    : finished
      ? 'Ders tamamlandı'
      : ROBOT_NAME;
  const iconBtn = 'grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full border-2 bg-white';

  return (
    <ConceptContext.Provider value={concepts}>
      <SayContext.Provider value={say}>
        <BubbleContext.Provider value={bubbleEl}>
          <div ref={rootRef} className="fixed inset-0 z-[120] flex flex-col bg-[#eef2fb] text-slate-900" role="dialog" aria-modal="true" aria-label="Etkileşimli ders">
            {/* Üst çubuk px tabanlı: yazı ölçeği yalnız ders içeriğini büyütür. */}
            <div className="mx-auto flex w-full max-w-5xl items-center gap-[8px] px-[16px] pb-[6px] pt-[max(env(safe-area-inset-top),12px)] sm:gap-[10px] sm:px-[24px]">
              {lesson ? <Route steps={steps} index={Math.max(index, 0)} finished={finished} /> : <span className="flex-1" />}
              <span className="flex items-center gap-[5px] rounded-full border-2 border-slate-200 bg-white px-[10px] py-[3px] text-[16px] font-extrabold tabular-nums" aria-label={`${stars} yıldız`}>
                {/* key: yıldız sayısı değişince küçük zıplama animasyonu yeniden oynar. */}
                <style>{'@keyframes il-star-pop{50%{transform:scale(1.5) rotate(15deg)}}'}</style>
                <span key={stars} className="inline-block text-[18px] text-amber-400 motion-safe:animate-[il-star-pop_.35s_ease]" aria-hidden="true">★</span>
                {stars}
              </span>
              <button type="button" onClick={toggleMusic} aria-pressed={musicOn} aria-label="Müzik" title="Müzik" className={`${iconBtn} ${musicOn ? 'border-orange-400 text-slate-800' : 'border-slate-200 text-slate-400'}`}>
                {musicOn ? <Music className="h-[20px] w-[20px]" aria-hidden="true" /> : <span className="relative"><Music className="h-[20px] w-[20px]" aria-hidden="true" /><span className="absolute left-1/2 top-1/2 h-[2px] w-[26px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" /></span>}
              </button>
              <button type="button" onClick={toggleVoice} aria-pressed={voiceOn} aria-label={`${ROBOT_NAME}'in sesi`} title={`${ROBOT_NAME}'in sesi`} className={`${iconBtn} ${voiceOn ? 'border-orange-400 text-slate-800' : 'border-slate-200 text-slate-400'}`}>
                {voiceOn ? <Volume2 className="h-[20px] w-[20px]" aria-hidden="true" /> : <VolumeX className="h-[20px] w-[20px]" aria-hidden="true" />}
              </button>
              <ScaleControl scale={scale} onChange={setScale} />
              <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran (akıllı tahta)'} title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran (akıllı tahta)'} className={`${iconBtn} hidden border-slate-200 text-slate-700 sm:grid`}>
                {isFullscreen ? <Minimize2 className="h-[18px] w-[18px]" aria-hidden="true" /> : <Maximize2 className="h-[18px] w-[18px]" aria-hidden="true" />}
              </button>
              <button type="button" onClick={onClose} aria-label="Kapat" className={`${iconBtn} border-slate-200 text-slate-700`}>
                <X className="h-[20px] w-[20px]" aria-hidden="true" />
              </button>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),24px)] sm:px-6">
              <div className="mx-auto w-full max-w-5xl">
                {error && <p className="mt-16 text-center text-xl text-slate-700">{error}</p>}
                {!error && !lesson && <Loader2 className="mx-auto mt-16 h-9 w-9 animate-spin text-slate-400" aria-label="Yükleniyor" />}

                {lesson && (
                  // Atom + konuşma balonu: üstte sabit; ana düğme balonun sonunda (alt çubuk yok).
                  <section className="sticky top-0 z-20 -mx-4 flex items-end gap-2.5 bg-[#eef2fb]/95 px-4 pb-3 pt-1 backdrop-blur sm:-mx-6 sm:gap-3 sm:px-6">
                    <button
                      type="button"
                      onClick={() => lastSpeech.current && say({ ...lastSpeech.current, sfx: undefined })}
                      aria-label="Tekrar dinle"
                      title="Tekrar dinle"
                      className="w-[60px] shrink-0 pb-3 sm:w-[84px]"
                    >
                      <RobotGuide mood={mood} talking={talking} upgraded={finished} />
                    </button>
                    <div className={`relative min-w-0 flex-1 rounded-[20px] rounded-bl-md border-2 px-4 pb-2.5 pt-2.5 text-[1.05rem] leading-relaxed text-slate-800 transition-colors lg:text-[1.15rem] ${toneBox}`}>
                      <p className="text-[0.75rem] font-extrabold uppercase tracking-[.1em] text-orange-600">{eyebrow}</p>
                      <div ref={setBubbleEl} className="max-h-[42vh] overflow-y-auto" aria-live="polite" />
                      <div className="mt-2 flex items-center gap-2">
                        {index > 0 && !finished && (
                          <button type="button" onClick={() => goTo(index - 1)} aria-label="Önceki adım" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                          </button>
                        )}
                        {finished && (
                          <button type="button" onClick={() => goTo(steps.length - 1)} className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-100">
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Derse dön
                          </button>
                        )}
                        <span className="flex-1" />
                        {primary && (
                          <button
                            type="button"
                            onClick={primary.run}
                            disabled={primary.disabled}
                            className={`${display.className} rounded-xl px-4 py-1.5 text-[1rem] font-extrabold text-white transition active:translate-y-0.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-[0_3px_0_#c3cbe0] ${
                              tone === 'ok' ? 'bg-emerald-500 shadow-[0_3px_0_#158457]' : tone === 'retry' ? 'bg-amber-500 shadow-[0_3px_0_#b97f00]' : 'bg-orange-500 shadow-[0_3px_0_#d96a00]'
                            }`}
                          >
                            {primary.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {lesson && index === -1 && (
                  <div className="space-y-4 pt-2">
                    <Bubble>
                      <p>{lesson.guide?.intro ?? GUIDE.intro(lesson.topicTitle)}</p>
                    </Bubble>
                    <h1 className={`${display.className} text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold leading-tight`}>{lesson.topicTitle}</h1>
                    <ol className="grid gap-2 sm:grid-cols-2">
                      {lesson.blocks.map((b, i) => (
                        <li key={b.sectionId} className={`${panel} flex items-center gap-3 px-4 py-3`}>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-100 text-base font-extrabold text-orange-700">{i + 1}</span>
                          <span className="font-bold text-slate-800">{b.title}</span>
                        </li>
                      ))}
                    </ol>
                    {saved && (
                      <div className={`${panel} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
                        <p className="font-semibold text-slate-800">
                          Kaldığın yerden devam edebilirsin: <span className="text-orange-700">{saved.stepIndex < steps.length ? `${steps[saved.stepIndex].block + 1}. bölüm` : 'son ekran'}</span>
                        </p>
                        <button type="button" onClick={start} className={ghostBtn}>Baştan başla</button>
                      </div>
                    )}
                    <p className="text-sm text-slate-500">Müzik ve {ROBOT_NAME}&apos;in sesi sağ üstten açılıp kapanır.</p>
                  </div>
                )}

                {current?.step.kind === 'bolum_sonu' && (
                  <BlockEnd
                    key={index}
                    number={current.block + 1}
                    nextTitle={lesson!.blocks[current.block + 1]?.title ?? ''}
                    result={tally(steps, states, current.block)}
                    retries={retryQuestions(steps, states, current.block, lesson!.blocks[current.block].spares)}
                    retryStates={retryStates}
                    onRetry={(id, st) => setRetryStates((prev) => ({ ...prev, [id]: st }))}
                  />
                )}

                {current && current.step.kind !== 'bolum_sonu' && (
                  <div key={index} className="pt-1">
                    {current.step.kind === 'anlatim' && <NarrativeView step={current.step} part={current.part ?? 'text'} seed={seed} terms={lesson!.terms} state={states[index] as PredictState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'eslestirme' && <MatchView setAction={setStepAction} step={current.step} seed={seed} index={index} state={states[index] as MatchState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'dogru_yanlis' && <TrueFalseView setAction={setStepAction} step={current.step} seed={seed} index={index} state={states[index] as TrueFalseState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'bosluk' && <BlankView setAction={setStepAction} step={current.step} seed={seed} index={index} state={states[index] as BlankState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'kesif' && <ExploreView step={current.step} seed={seed} state={states[index] as ExploreState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'etiketle' && <LabelView setAction={setStepAction} step={current.step} seed={seed} index={index} state={states[index] as LabelState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'bul' && <FindView setAction={setStepAction} step={current.step} index={index} state={states[index] as FindState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'siralama' && <SortView setAction={setStepAction} step={current.step} seed={seed} index={index} state={states[index] as SortState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'coklu_secim' && <MultiView setAction={setStepAction} step={current.step} seed={seed} index={index} state={states[index] as MultiState | undefined} onChange={setState(index)} />}
                    {current.step.kind === 'soru' && (
                      <ChoiceView
                        step={current.step}
                        state={states[index] as ChoiceState | undefined}
                        onChange={setState(index)}
                        onAnswer={(ok, answer, solution) =>
                          say(ok
                            ? { lines: [praiseAt((current.step as { question: ChoiceQuestion }).question.id)], mood: 'happy', tone: 'ok', sfx: 'ok' }
                            : { lines: [GUIDE.answerIs(answer), ...(solution ? [solution] : [])], mood: 'oops', tone: 'retry', sfx: 'retry' })
                        }
                      />
                    )}
                    {current.step.kind === 'klasik' && <ClassicalView setAction={setStepAction} step={current.step} state={states[index] as ClassicalState | undefined} onChange={setState(index)} />}
                  </div>
                )}

                {finished && (
                  <div className="space-y-5 pt-2">
                    <Bubble>
                      <p>{lesson!.guide?.finish ?? GUIDE.finish}</p>
                    </Bubble>
                    <Confetti />
                    <div className={`${panel} p-5 text-center`}>
                      <div className="mx-auto w-[110px]">
                        <RobotGuide mood="happy" upgraded />
                      </div>
                      <p className="mt-1 text-sm font-extrabold uppercase tracking-[.12em] text-orange-600">Ders tamamlandı</p>
                      <p className={`${display.className} mt-1 text-[clamp(1.5rem,4vw,2.2rem)] font-extrabold leading-tight`}>{ROBOT_NAME} altın parıltı kazandı!</p>
                      <p className="mt-2 text-slate-600">
                        <span className="text-amber-500">★</span> <strong className="text-slate-900">{stars}</strong> yıldız topladın
                      </p>
                      {(() => {
                        const t = tally(steps, states);
                        return (
                          <dl className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2 text-center">
                            {[
                              { label: 'Soru', value: `${t.soruOk}/${t.soru}` },
                              { label: 'Konuyu anladık mı?', value: `${t.klasikOk}/${t.klasik}` },
                            ].map((m) => (
                              <div key={m.label} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                                <dd className="text-2xl font-extrabold">{m.value}</dd>
                                <dt className="mt-1 text-sm text-slate-500">{m.label}</dt>
                              </div>
                            ))}
                          </dl>
                        );
                      })()}
                      <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <button type="button" onClick={onClose} className={ghostBtn}>Kapat</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </BubbleContext.Provider>
      </SayContext.Provider>
    </ConceptContext.Provider>
  );
}
