'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { submitAnswers, startSessionWithRetry, flushAnswerOutbox, type AnswerDetail } from '@/app/src/lib/answerSync';
import { createPortal } from 'react-dom';
import { useDismissOnBack } from '@/app/src/hooks/useDismissOnBack';
import { ReportQuestionButton } from '@/app/src/components/ReportQuestionButton';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Eye, Loader2, MessageCircle, Minus, Pencil, Play, Plus, RotateCcw, Share2, Sparkles, Trash2, Trophy, UserPlus, X, XCircle } from 'lucide-react';
import type { QuizQuestion, MatchingQuestion, Pair } from '@/app/src/lib/quizQuestionTypes';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchMySavedRefs, saveStudyItem } from '@/app/src/lib/savedStudyItems';
import { useSessionActiveTime, useVisibleStopwatch } from '@/app/src/hooks/useVisibleStopwatch';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { hasInAppHistory } from '@/app/src/components/InAppNavigationTracker';
import { QuizQuestionEditModal } from '@/app/src/components/admin/QuizQuestionEditModal';
import MathText from '@/app/src/components/MathText';
import { stripEmphasis } from '@/app/src/lib/latexToPlain';
import {
  SLIDE_ACCENTS,
  NAV_BTN_CLASS,
  PLAYER_BADGE_CLASS,
  PLAYER_NAV_ROW_CLASS,
  PLAYER_TOP_BAR_CLASS,
  PlayerEyebrow,
  FontScaleControl,
  OverlayWindowButtons,
  PlayerFrame,
  QuestionPills,
  pillWindowFor,
  useFullscreen,
  type AnswerStatus,
} from '@/app/src/components/questionPlayer/QuestionPlayerParts';

export const CORRECT_MESSAGES = [
  'Harika! 🎉',
  'Süpersin! ⭐',
  'Tam isabet! 🎯',
  'Çok iyi gidiyorsun! 🚀',
  'Mükemmel! ✨',
  'Bravo! 👏',
  'Doğru bildin! ✅',
  'Harikasın! 🌟',
  'İşte bu! 💪',
  'Tebrikler! 🏆',
  'Muhteşemsin! 🔥',
  'Tam üstüne bastın! 🎯',
  'Çok başarılısın! 🥳',
  'Bir dahi gibisin! 🧠',
  'Yıldız gibi parlıyorsun! ⭐',
  'Bu doğru cevap! ✔️',
  'Kesinlikle doğru! 💯',
  'Çok zekisin! 💡',
  'Aferin sana! 👍',
  'Böyle devam! 🚀',
  'Sen bir şampiyonsun! 🏅',
  'Harika bir cevap! 🎊',
  'Tam olarak doğru! 🎈',
  'Süper performans! 🌈',
];

export const INCORRECT_MESSAGES = ['Olsun, öğrenmenin bir parçası! 🌱', 'Az kalsın, bir dahakine yakalarsın 💪', 'Sorun değil, doğrusuna bakalım 👇', 'Bu sefer olmadı ama devam! ✨'];

export const TYPE_LABELS: Record<QuizQuestion['type'], string> = {
  multiple_choice: 'Çoktan Seçmeli',
  blank: 'Boşluk Doldurma',
  matching: 'Eşleştirme',
  classical: 'Açık Uçlu',
};

// Şık harfi rozeti (A/B/C/D...) — öğrencinin "hangi şıkkı işaretledim" diye metne değil
// harfe bakabilmesi için; hem canlı test akışında (OptionsView) hem soru bankası/cevap
// anahtarında (QuestionAnswerKeyItem) AYNI görsel dil kullanılıyor (kullanıcının 2026-09-12
// "modern, şıklara ABCD yaz" isteği).
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function OptionLetterBadge({
  index,
  state,
  fluid = false,
}: {
  index: number;
  state: 'idle' | 'correct' | 'wrong' | 'muted';
  fluid?: boolean;
}) {
  const cls =
    state === 'correct'
      ? 'bg-emerald-500 text-white shadow-sm'
      : state === 'wrong'
        ? 'bg-rose-500 text-white shadow-sm'
        : state === 'muted'
          ? 'bg-default/10 text-muted-foreground'
          : 'bg-indigo-500/12 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white';
  return (
    <span
      style={
        fluid
          ? {
              width: 'var(--qp-letter, 2rem)',
              height: 'var(--qp-letter, 2rem)',
              fontSize: 'calc(var(--qp-meta, 0.8125rem) * min(var(--qp-scale, 1), 1.6))',
            }
          : undefined
      }
      className={`flex shrink-0 items-center justify-center rounded-xl font-black transition-colors ${fluid ? '' : 'h-7 w-7 text-xs'} ${cls}`}
    >
      {OPTION_LETTERS[index] ?? index + 1}
    </span>
  );
}

function randomOf(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// mulberry32: küçük, deterministik bir PRNG. MatchingView'daki sağ sütun sırası
// bir component render'ında (useMemo ile) belirleniyor — yani hem sunucudaki ilk
// SSR geçişinde hem de tarayıcıdaki hydration geçişinde AYRI AYRI çalışıyor. Sıradan
// shuffle() (Math.random tabanlı) bu iki geçişte iki farklı sonuç üretip React'in
// "server HTML ile client render eşleşmiyor" hydration hatasına yol açıyordu (bkz.
// /soru-bankasi sayfasındaki eşleştirme soruları). Aynı soru.id iki geçişte de aynı
// prop olarak geldiği için, ondan türeyen bir seed kullanmak iki geçişte de AYNI
// sıralamayı garantiler — MC/boşluk doldurma şıklarının shuffle()'ı buna ihtiyaç
// duymuyor çünkü onlar sadece sunucu tarafında, veri hazırlanırken bir KEZ karışıyor
// (bkz. quizQuestions.ts:resolveQuestions), component render'ında değil.
function mulberry32(seed: number) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const random = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MIN_IMAGE_ZOOM = 1;
const MAX_IMAGE_ZOOM = 3;
const IMAGE_ZOOM_STEP = 0.25;

// Okuma metni (question_passages): soru kökünden önce, normal kalınlıkta ayrı bir okuma bloğu. Kökle birlikte
// kalın basılınca uzun paragraf okunmuyordu (2026-10-23, Türkçe paragraf soruları 1. aşama). Sola yaslı: iki yana
// yaslama dar ekranda kelime aralarını açıp uzun metni zor okutuyor.
function PassageBlock({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <blockquote
      className="mb-3 rounded-r-xl border-l-4 border-indigo-400/70 bg-indigo-500/5 px-3 py-2 text-left text-sm font-normal leading-relaxed text-default"
      style={style}
      aria-label="Okuma metni"
    >
      <MathText text={text} />
    </blockquote>
  );
}

export function QuestionSvg({ svgContent }: { svgContent: string | null }) {
  // sanitizeMathSvg (DOMPurify) window/DOM gerektirir; bu bileşen /soru-bankasi gibi
  // SSR sayfalarında da render edildiği için temizlemeyi sunucu tarafında DEĞİL, mount
  // sonrası client'ta yapıyoruz (bkz. SectionContent.tsx'teki aynı desen) — aksi halde
  // sunucuda "window is not defined" ile sayfa 500 verir.
  const [clean, setClean] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [zoom, setZoom] = useState(1);
  useDismissOnBack(zoomed, () => setZoomed(false));

  useEffect(() => {
    setClean(svgContent ? sanitizeMathSvg(svgContent) : null);
  }, [svgContent]);

  // Tam ekran açıkken Escape ile kapansın — SectionContent.tsx'teki konu anlatımı
  // görsel/diyagram zoom'uyla aynı davranış.
  useEffect(() => {
    if (!zoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [zoomed]);

  if (!clean) return null;

  return (
    <>
      <button
        type="button"
        role="img"
        onClick={() => {
          setZoom(1);
          setZoomed(true);
        }}
        title="Büyütmek için tıkla"
        className="light mb-4 flex w-full cursor-zoom-in justify-center rounded-xl border border-default bg-white p-3 transition hover:border-indigo-300 hover:shadow-sm [&_svg]:h-auto [&_svg]:w-auto [&_svg]:max-h-56 [&_svg]:max-w-full sm:[&_svg]:max-h-64"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {zoomed && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setZoomed(false)}
        >
          <div
            className="light relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end gap-1.5 border-b border-default p-2">
              <div className="flex items-center gap-0.5 rounded-lg border border-default pr-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(MIN_IMAGE_ZOOM, +(z - IMAGE_ZOOM_STEP).toFixed(2)))}
                  disabled={zoom <= MIN_IMAGE_ZOOM}
                  aria-label="Küçült"
                  title="Küçült"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-[11px] font-black text-muted-foreground">%{Math.round(zoom * 100)}</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(MAX_IMAGE_ZOOM, +(z + IMAGE_ZOOM_STEP).toFixed(2)))}
                  disabled={zoom >= MAX_IMAGE_ZOOM}
                  aria-label="Büyüt"
                  title="Büyüt"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                aria-label="Kapat"
                title="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto p-6">
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                role="img"
                // SVG'nin kendi width/height'ı yok (sadece viewBox) — width:auto/height:auto
                // İKİSİ de tanımsız kalınca, dış kapsayıcı width:fit-content (w-fit) olduğunda
                // boyut hesabı dairesel bir bağımlılığa düşüp Chromium'da 0x0'a çöküyordu (SVG
                // tamamen boş görünüyordu — 2026-09-10 kullanıcı bildirimi, masaüstünde tam
                // ekran/zoom görünümünde SVG'li sorular boş çıkıyordu; sadece max-height eklemek
                // TEK BAŞINA yetmedi, çünkü w-fit'in "shrink-to-fit" hesabı hâlâ children'ın
                // tanımsız preferred-width'ine bakıyordu). Çözüm: küçük önizlemedeki (148. satır)
                // ÇALIŞAN deseni birebir kullan — w-fit yerine w-full + flex justify-center: artık
                // SVG kesin bir containing-block genişliğine karşı ölçülüyor, dairesel bağımlılık yok.
                className="mx-auto flex w-full justify-center [&_svg]:h-auto [&_svg]:w-auto [&_svg]:max-h-[65vh] [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: clean }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function MatchingView({
  question,
  assignment,
  locked,
  onAssign,
  onCheck,
  fontScale = 1,
  fluid = false,
}: {
  question: MatchingQuestion;
  assignment: Record<number, number>;
  locked: boolean;
  onAssign: (leftId: number, rightId: number) => void;
  onCheck: () => void;
  fontScale?: number;
  fluid?: boolean;
}) {
  // Kâğıt test düzeni: kavramlar numaralı, her karşılığın başındaki kutuya eşlendiği
  // kavramın numarası yazılır. Eski düzen iki serbest sütundu — satırlar hizasızdı ve
  // eşleşmiş tanım sol kutunun içine bir kez daha yazılıp telefonda kartları uzatıyordu.
  // Sıradaki boş kavram kendiliğinden seçilir: öğrenci çoğunlukla yalnız karşılıklara dokunur.
  const firstUnassigned = (assign: Record<number, number>) => question.pairs.find((p) => assign[p.id] == null)?.id ?? null;
  const [activeLeft, setActiveLeft] = useState<number | null>(() => (locked ? null : firstUnassigned(assignment)));
  const rightItems = useMemo(() => seededShuffle<Pair>(question.pairs, question.id), [question]);
  const numberByLeft = useMemo(() => new Map(question.pairs.map((p, i) => [p.id, i + 1])), [question]);
  const leftByRight = new Map(Object.entries(assignment).map(([left, right]) => [right, Number(left)]));
  const allAssigned = Object.keys(assignment).length === question.pairs.length;
  const pairStyle: CSSProperties | undefined = fluid
    ? { fontSize: 'calc(var(--qp-choice, 0.9375rem) * var(--qp-scale, 1))', lineHeight: 1.45 }
    : fontScale !== 1
      ? { fontSize: `${0.8125 * fontScale}rem`, lineHeight: 1.45 }
      : undefined;
  const badgeBase = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black';

  const assign = (rightId: number) => {
    if (activeLeft == null) return;
    onAssign(activeLeft, rightId);
    // onAssign'ın yaptığıyla aynı: bu sağ öğe başka kavramdaysa oradan çözülür.
    const next: Record<number, number> = {};
    for (const [left, right] of Object.entries(assignment)) if (right !== rightId) next[Number(left)] = right;
    next[activeLeft] = rightId;
    setActiveLeft(firstUnassigned(next));
  };

  return (
    <div>
      {/* Soru kökü burada YOK — tek çağıran QuestionAnswerKeyItem kökü zaten kendisi
          basıyor; burada da basılınca eşleştirme sorularında kök iki kez görünüyordu. */}
      {!locked && (
        <p className="mb-3 text-xs font-bold text-muted-foreground">
          Mavi kavramın karşılığına dokun, sıradaki kavram kendiliğinden seçilir. Bir eşleşmeyi değiştirmek için önce kavrama dokun.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground">Kavramlar</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            {question.pairs.map((pair) => {
              const assignedTo = assignment[pair.id];
              // Doğru/yanlış rengi yalnız kilitlendikten (Cevabımı Kontrol Et) SONRA.
              const isCorrect = locked && assignedTo != null && assignedTo === pair.id;
              const isWrong = locked && assignedTo != null && assignedTo !== pair.id;
              const isActive = !locked && activeLeft === pair.id;
              const isMatched = !locked && assignedTo != null;
              let cls = 'border-default bg-surface';
              let badge = 'border border-default text-muted-foreground';
              if (isCorrect) [cls, badge] = ['border-emerald-400/60 bg-emerald-500/10', 'bg-emerald-500 text-white'];
              else if (isWrong) [cls, badge] = ['border-rose-400/60 bg-rose-500/10', 'bg-rose-500 text-white'];
              else if (isActive) [cls, badge] = ['border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/30', 'bg-indigo-500 text-white'];
              else if (isMatched) [cls, badge] = ['border-indigo-300/50 bg-surface', 'bg-indigo-500/15 text-indigo-500'];
              return (
                <button
                  key={pair.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={isActive}
                  onClick={() => setActiveLeft(pair.id)}
                  style={pairStyle}
                  className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[13px] font-bold leading-snug text-default transition-colors disabled:cursor-default ${cls}`}
                >
                  <span className={`${badgeBase} ${badge}`}>{numberByLeft.get(pair.id)}</span>
                  <MathText as="span" className="min-w-0 flex-1 break-words" text={pair.left_text} />
                  {isMatched && <CheckCircle2 aria-label="eşleşti" className="h-4 w-4 shrink-0 text-indigo-500" />}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground">Karşılıkları</p>
          <div className="space-y-2">
            {rightItems.map((pair) => {
              const owner = leftByRight.get(pair.id);
              let cls = 'border-default bg-surface hover:border-indigo-400/60 hover:bg-indigo-500/5';
              let slot = 'border-2 border-dashed border-default text-transparent';
              if (locked && owner != null) {
                const ok = owner === pair.id;
                cls = ok ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-rose-400/60 bg-rose-500/10';
                slot = ok ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white';
              } else if (locked) {
                cls = 'border-default bg-surface';
              } else if (owner != null) {
                cls = 'border-indigo-300/50 bg-indigo-500/5 hover:border-indigo-400/60';
                slot = 'bg-indigo-500 text-white';
              }
              return (
                <button
                  key={pair.id}
                  type="button"
                  disabled={locked || activeLeft == null}
                  onClick={() => assign(pair.id)}
                  style={pairStyle}
                  className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium leading-snug text-default transition-colors disabled:cursor-default ${cls}`}
                >
                  <span className={`${badgeBase} ${slot}`} aria-label={owner != null ? `${numberByLeft.get(owner)}. kavram` : 'boş'}>
                    {owner != null ? numberByLeft.get(owner) : '·'}
                  </span>
                  <span className="min-w-0 flex-1 break-words pt-0.5">
                    <MathText text={pair.right_text} />
                    {locked && owner != null && owner !== pair.id && (
                      <span className="mt-1 block text-xs font-bold text-emerald-600">
                        Doğrusu: {numberByLeft.get(pair.id)}. <MathText text={pair.left_text} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {!locked && (
        <button
          type="button"
          onClick={onCheck}
          disabled={!allAssigned}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cevabımı Kontrol Et
        </button>
      )}
    </div>
  );
}

// Tek bir sorunun cevap anahtarı görünümü (soru metni + doğru cevap işaretli/model cevap).
// Hem aşağıdaki AnswerKeySection (test sonuç ekranındaki katlanır liste) HEM DE
// /soru-bankasi sayfası (bkz. app/soru-bankasi/.../page.tsx) bunu kullanıyor — ikisi de
// "tüm soruları cevaplarıyla göster" ihtiyacını aynı, tek yerde test edilmiş mantıkla
// karşılıyor.
// memo ile sarılı — SlidePlayer'ın soru fazında görülmüş TÜM sorular mount'lu kalır (bkz.
// SlidePlayer.tsx'teki mountedQIndexes notu) ve o slayt player'ın herhangi bir state
// değişikliğinde (yazı boyutu, sayfa geçişi, istatistik kaydı vb.) hepsi normalde yeniden
// render edilirdi — memo, props'u değişmeyen (görünmeyen) soruları render'dan muaf tutarak
// bunu önlüyor (kullanıcının 2026-09-22 "sorular/şıklar donuyor gibi yavaşladı" şikayeti).
// Etkili olması için SlidePlayer'ın onAnswered'ı useCallback ile SABİT bir referans olarak
// geçmesi şart — aksi halde her render'da yeni bir fonksiyon = memo hep "props değişti" görür.
function QuestionAnswerKeyItemImpl({
  question: q,
  index,
  interactive = false,
  onAnswered,
  fontScale = 1,
  numberBadge = 'dot',
  accentColor = '#6366F1',
  controlledSelectedId,
  controlledRevealed,
  controlledAssignment,
  onAssignPair: onAssignPairProp,
  onCheckMatch,
  forcedAnswered,
  feedbackMessage,
  answeredCorrectly,
  classicalMode = 'reveal',
  classicalValue,
  onClassicalChange,
  onClassicalCheck,
  twoStepExplanation = false,
  explanationRevealed: explanationRevealedProp,
  onRevealExplanation,
  fluid = false,
  headerActions,
}: {
  question: QuizQuestion;
  index?: number;
  // true olunca: sorunun cevap/açıklama kısmı bir şıkka (ya da "Cevabı Göster" butonuna)
  // tıklanana kadar CSS ile (display:none DEĞİL, grid-rows collapse ile) görsel olarak
  // gizli kalır — ama içerik DOM'da baştan tam olarak mevcuttur, JS çalışmayan bir istemci
  // veya arama motoru her şeyi ilk yanıtta görür (bkz. .cevap-aciklama / .cevap-marker için
  // <noscript> override, app/soru-bankasi/.../page.tsx).
  interactive?: boolean;
  // optionId: seçilen seçenek (çoktan seçmeli/boşluk); match: eşleştirme ataması (sol → sağ çift id).
  // Kayıt yapan çağıranlar bunları sunucuya gönderir — doğruluk sunucuda hesaplanır (answerSync.ts).
  onAnswered?: (questionId: number, status: 'correct' | 'incorrect' | 'revealed', optionId?: number, match?: Record<number, number>) => void;
  // Akıllı tahta metin büyütme (bkz. SlidePlayer +/- kontrolü) — SADECE yazı boyutunu
  // büyütür, buton dolgusu/genişliği rem cinsinden sabit kaldığı için layout taşmaz.
  // rem yerine inline stil kullanılıyor çünkü Tailwind'in text-sm/text-xs'i rem tabanlı
  // ve rem, ata öğenin font-size'ından ETKİLENMEZ (her zaman kök <html>'e göre) — bu
  // yüzden ata'ya zoom/font-size vermek metni büyütmezdi, tek tek override etmek gerekiyor
  // (kullanıcının 2026-09-21 "sadece harf/kelime büyüsün, ekranı taşırmasın" isteği).
  fontScale?: number;
  // 'dot' (varsayılan, mevcut davranış): küçük, sade numara dairesi — yoğun listelerde
  // (AnswerKeySection akordeonu gibi) yer kaplamasın diye. 'label': "3. Soru" yazan renkli
  // bir kapsül — akıllı tahtada soru kökündeki matematik rakamlarıyla karışmayan, "Soru"
  // kelimesiyle net ayrışan bir başlık (kullanıcının 2026-09-21 isteği, SlidePlayer'da
  // kullanılıyor).
  numberBadge?: 'dot' | 'label';
  // 'label' varyantında kapsülün rengi — SlidePlayer'daki slayt temasıyla eşleşsin diye
  // dışarıdan veriliyor.
  accentColor?: string;
  // --- Kontrollü mod (bkz. QuizClient'ın canlı test akışı, kullanıcının 2026-09-24
  // isteği: "tek component olsun ki bir değişiklik hepsine yansısın") ---
  // Aşağıdaki prop'ların hepsi OPSİYONEL ve varsayılanları eski (kontrolsüz) davranışı
  // birebir korur — SlidePlayer/AnswerKeySection hiçbirini geçmediği için hiç etkilenmez.
  // Geçilirse bileşen o alanda kendi state'i yerine dışarıdan gelen değeri/callback'i
  // kullanır (klasik "value !== undefined ? value : internalState" kontrollü-bileşen deseni).
  controlledSelectedId?: number | null;
  controlledRevealed?: boolean;
  controlledAssignment?: Record<number, number>;
  onAssignPair?: (leftId: number, rightId: number) => void;
  onCheckMatch?: () => void;
  // Resume gibi "hiçbir şık seçilmeden kilitlendi" durumları için — verilirse
  // answered hesaplamasında selectedId/revealed'in ÖNÜNE geçer.
  forcedAnswered?: boolean;
  // QuizClient'ın rastgele "Harika! 🎉" / "Olsun, öğrenmenin bir parçası! 🌱" tebrik/teselli
  // mesajı — cevap açıklaması panelinin en üstünde kalın yazıyla gösterilir.
  feedbackMessage?: string;
  // Panel rengi normalde selectedId/assignment'tan türetilir — ama resume edilmiş (yarım
  // kalan testten devam edilen) bir soruda hangi şık seçildiği bilinmez (sadece doğru/yanlış
  // olduğu bilinir, bkz. QuizClient'taki resume.answers), bu durumda türetim yanlış renk
  // verirdi. Verildiğinde türetimin ÖNÜNE geçer.
  answeredCorrectly?: boolean;
  // 'reveal' (varsayılan): sadece "Model Cevabı Göster" butonu (SlidePlayer'ın eski
  // davranışı). 'input': öğrenci önce bir metin kutusuna kendi cevabını yazıp "Cevabımı
  // Kontrol Et"e basar, SONRA model cevap gösterilir — eskiden ayrı bir ClassicalView'da
  // olan ve slayt tarafında hiç olmayan bir özellik, kaybolmasın diye buraya taşındı
  // (kullanıcının isteği: "eskisinde olup slaytta olmayan özellikleri koru").
  classicalMode?: 'reveal' | 'input';
  classicalValue?: string;
  onClassicalChange?: (value: string) => void;
  onClassicalCheck?: () => void;
  // true olunca: cevap/eşleşme açığa çıktıktan SONRA bile açıklama metni gizli kalır, ayrı
  // bir "Açıklamayı Göster" butonuna basılana kadar — eskiden QuizClient'ın canlı test
  // akışındaki davranış (kopya çekmeyi zorlaştırmak için bilinçli iki adımlı reveal),
  // SlidePlayer'da hiç yoktu, varsayılan false ile o davranış aynen korunuyor.
  twoStepExplanation?: boolean;
  explanationRevealed?: boolean;
  onRevealExplanation?: () => void;
  // true olunca (tam ekran soru oynatıcısı): Mobil → PC → Dev Akıllı Tahta otomatik fluid tipografi
  // (.player-stage --qp-* değişkenleri * --qp-scale) kullanılır; liste/soru bankası kompakt kalır.
  fluid?: boolean;
  // numberBadge='label' ile aynı satırın sağına yerleşen kart eylemleri (Anlamadım sor, Paylaş vb.).
  headerActions?: ReactNode;
}) {
  // line-height'ı da vermek şart — Tailwind'in text-sm/text-xs'i font-size+line-height'ı
  // BİRLİKTE (sabit rem) tanımlıyor; sadece fontSize'ı büyütüp line-height'ı eski sabit
  // rem'de bırakırsak satırlar birbirinin/alt bloğun üstüne biner (kullanıcının 2026-09-21
  // "yazı boyutunu çok büyüttüğümde sorular iç içe giriyor" şikayeti). Unitless line-height
  // kendi font-size'ına göre orantılı kalıyor, ekstra scale hesabı gerekmiyor.
  const questionStyle: CSSProperties | undefined = fluid
    ? { fontSize: 'calc(var(--qp-question, 1rem) * var(--qp-scale, 1))', lineHeight: 1.48 }
    : fontScale !== 1
      ? { fontSize: `${0.875 * fontScale}rem`, lineHeight: 1.43 }
      : undefined;
  const choiceStyle: CSSProperties | undefined = fluid
    ? { fontSize: 'calc(var(--qp-choice, 0.9375rem) * var(--qp-scale, 1))', lineHeight: 1.42 }
    : fontScale !== 1
      ? { fontSize: `${0.875 * fontScale}rem`, lineHeight: 1.43 }
      : undefined;
  const passageStyle: CSSProperties | undefined = fluid
    ? { fontSize: 'calc(var(--qp-passage, 0.9375rem) * var(--qp-scale, 1))', lineHeight: 1.6 }
    : fontScale !== 1
      ? { fontSize: `${0.875 * fontScale}rem`, lineHeight: 1.5 }
      : undefined;
  const textSmStyle = choiceStyle;
  const textXsStyle: CSSProperties | undefined = fluid
    ? { fontSize: 'calc(var(--qp-meta, 0.8125rem) * var(--qp-scale, 1))', lineHeight: 1.45 }
    : fontScale !== 1
      ? { fontSize: `${0.75 * fontScale}rem`, lineHeight: 1.35 }
      : undefined;
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(null);
  const [internalRevealed, setInternalRevealed] = useState(false);
  const [internalAssignment, setInternalAssignment] = useState<Record<number, number>>({});
  const [internalExplanationRevealed, setInternalExplanationRevealed] = useState(false);
  // Kontrollü/kontrolsüz mod anahtarı: prop verilmediyse (undefined) bileşen kendi state'ini
  // kullanır (eski davranış, SlidePlayer/AnswerKeySection), verildiyse dışarıdaki state
  // kaynak alınır (QuizClient'ın canlı test akışı).
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const revealed = controlledRevealed !== undefined ? controlledRevealed : internalRevealed;
  const assignment = controlledAssignment !== undefined ? controlledAssignment : internalAssignment;
  const explanationRevealed = explanationRevealedProp !== undefined ? explanationRevealedProp : internalExplanationRevealed;
  const svgPosition = q.type !== 'matching' ? q.svg_position : 'above';
  const svg = <QuestionSvg svgContent={q.type !== 'matching' ? q.svg_content : null} />;
  const passage = q.type === 'multiple_choice' || q.type === 'blank' ? q.passage : null;

  if (!interactive) {
    return (
      <>
        {svgPosition !== 'below' && svg}
        {passage && <PassageBlock text={passage} />}
        <div className="flex items-start gap-2">
          {index != null && (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-black text-white">
              {index + 1}
            </span>
          )}
          <p className="min-w-0 flex-1 text-sm font-bold text-justify text-default">
            <MathText text={q.question_text} />
          </p>
        </div>
        {svgPosition === 'below' && svg}
        {q.type === 'multiple_choice' && (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {q.choices.map((c) => (
              <li key={c.id} className={c.is_correct ? 'font-bold text-emerald-500' : undefined}>
                {c.is_correct ? '✓ ' : ''}
                <MathText text={c.text} />
              </li>
            ))}
          </ul>
        )}
        {q.type === 'blank' && (
          <p className="mt-2 text-sm text-muted-foreground">
            Doğru cevap: <MathText as="span" className="font-bold text-emerald-500" text={q.options.find((o) => o.is_correct)?.text || ''} />
          </p>
        )}
        {q.type === 'matching' && (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {q.pairs.map((p) => (
              <li key={p.id}>
                <MathText as="span" className="font-bold text-default" text={p.left_text} /> → <MathText text={p.right_text} />
              </li>
            ))}
          </ul>
        )}
        {q.type === 'classical' && q.modelAnswer && (
          <p className="mt-2 text-sm text-muted-foreground">
            Model cevap: <MathText text={q.modelAnswer} />
          </p>
        )}
        {(q.type === 'multiple_choice' || q.type === 'blank') && q.solution_text && (
          <p className="mt-1 text-xs text-muted-foreground"><MathText text={q.solution_text} /></p>
        )}
      </>
    );
  }

  // İnteraktif mod: her şık bir <button>, tıklanınca kilitlenir (tek deneme) ve
  // cevap/açıklama bloğu açılır. answered = ya bir şık seçildi (mc/blank) ya da
  // "Cevabı Göster"/"Cevabımı Kontrol Et"ye basıldı (matching/classical) — forcedAnswered
  // verildiyse (QuizClient'ın süre-doldu/resume durumları) her şeyin önüne geçer.
  const answered = forcedAnswered !== undefined ? forcedAnswered : selectedId != null || revealed;
  const explanationId = `cevap-aciklama-${q.id}`;
  const optionList = q.type === 'multiple_choice' ? q.choices : q.type === 'blank' ? q.options : null;

  const selectOption = (optId: number, isCorrect: boolean) => {
    if (answered) return;
    if (controlledSelectedId === undefined) setInternalSelectedId(optId);
    onAnswered?.(q.id, isCorrect ? 'correct' : 'incorrect', optId);
  };

  // Eşleştirmede tek bir çift atandığında anında doğru/yanlış göstermiyoruz — kullanıcı
  // tüm çiftleri istediği gibi değiştirebilir, sonuç ancak "Cevabımı Kontrol Et" ile açığa
  // çıkar.
  const assignMatchPair = (leftId: number, rightId: number) => {
    if (answered) return;
    if (onAssignPairProp) {
      onAssignPairProp(leftId, rightId);
      return;
    }
    setInternalAssignment((prev) => {
      const next = { ...prev };
      for (const [l, r] of Object.entries(next)) {
        if (r === rightId) delete next[Number(l)];
      }
      next[leftId] = rightId;
      return next;
    });
  };

  const checkMatchAssignment = () => {
    if (answered || q.type !== 'matching') return;
    if (Object.keys(assignment).length !== q.pairs.length) return;
    const allCorrect = q.pairs.every((p) => assignment[p.id] === p.id);
    if (controlledRevealed === undefined) setInternalRevealed(true);
    onCheckMatch?.();
    onAnswered?.(q.id, allCorrect ? 'correct' : 'incorrect', undefined, assignment);
  };

  const revealClassical = () => {
    if (answered) return;
    if (controlledRevealed === undefined) setInternalRevealed(true);
    onAnswered?.(q.id, 'revealed');
  };

  const checkClassicalInput = () => {
    if (answered) return;
    onClassicalCheck?.();
    onAnswered?.(q.id, 'revealed');
  };

  const toggleExplanation = () => {
    if (onRevealExplanation) {
      onRevealExplanation();
      return;
    }
    setInternalExplanationRevealed(true);
  };

  return (
    <>
      {svgPosition !== 'below' && svg}
      {(index != null && numberBadge === 'label') || headerActions ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {index != null && numberBadge === 'label' ? (
            <div
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-sm"
              style={{
                background: accentColor,
                ...(fluid
                  ? { fontSize: 'calc(var(--qp-badge, 0.75rem) * min(var(--qp-scale, 1), 1.6))', lineHeight: 1.25 }
                  : fontScale !== 1
                    ? { fontSize: `${0.75 * fontScale}rem`, lineHeight: 1.35 }
                    : undefined),
              }}
            >
              {index + 1}. Soru
            </div>
          ) : (
            <span />
          )}
          {headerActions && <div className="flex items-center gap-1">{headerActions}</div>}
        </div>
      ) : null}
      {passage && <PassageBlock text={passage} style={passageStyle} />}
      <div className="flex items-start gap-2">
        {index != null && numberBadge === 'dot' && (
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-black text-white">
            {index + 1}
          </span>
        )}
        <p className={`min-w-0 flex-1 text-sm font-bold text-default ${fluid ? 'text-left' : 'text-justify'}`} style={questionStyle}>
          <MathText text={q.question_text} />
        </p>
      </div>
      {svgPosition === 'below' && svg}

      {optionList && (
        <ul className={`text-sm ${fluid ? 'mt-3 space-y-2 sm:mt-4 sm:space-y-2.5' : 'mt-3 space-y-2'}`} style={choiceStyle}>
          {optionList.map((opt, i) => {
            const isChosen = selectedId === opt.id;
            let cls = 'border-default bg-surface text-default hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5';
            let badgeState: 'idle' | 'correct' | 'wrong' | 'muted' = 'idle';
            if (answered) {
              if (opt.is_correct) {
                cls = 'border-emerald-400 bg-emerald-500/10 text-emerald-600 shadow-sm';
                badgeState = 'correct';
              } else if (isChosen) {
                cls = 'border-rose-400 bg-rose-500/10 text-rose-600 shadow-sm';
                badgeState = 'wrong';
              } else {
                cls = 'border-default bg-surface text-muted-foreground opacity-50';
                badgeState = 'muted';
              }
            }
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => selectOption(opt.id, opt.is_correct)}
                  disabled={answered}
                  aria-expanded={answered}
                  aria-controls={explanationId}
                  className={`group flex w-full items-center gap-2.5 sm:gap-3 rounded-2xl border-2 text-left font-bold shadow-sm transition-all disabled:cursor-default active:scale-[0.985] ${
                    fluid ? 'px-3 py-2.5 sm:px-4 sm:py-3' : 'px-3.5 py-3'
                  } ${cls}`}
                >
                  <OptionLetterBadge index={i} state={badgeState} fluid={fluid} />
                  <MathText as="span" className="min-w-0 flex-1" text={opt.text} />
                  <span
                    data-open={answered}
                    aria-hidden={!answered}
                    className="cevap-marker inline-flex max-w-0 shrink-0 scale-75 items-center overflow-hidden opacity-0 transition-all duration-200 data-[open=true]:max-w-[1.5em] data-[open=true]:scale-100 data-[open=true]:opacity-100"
                  >
                    {opt.is_correct ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : isChosen ? (
                      <XCircle className="h-5 w-5 text-rose-500" />
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === 'matching' && (
        <div className="mt-3">
          <MatchingView question={q} assignment={assignment} locked={answered} onAssign={assignMatchPair} onCheck={checkMatchAssignment} fontScale={fontScale} fluid={fluid} />
        </div>
      )}

      {/* 'input' modu — eskiden ayrı bir ClassicalView'da olan, öğrencinin önce kendi
          cevabını yazıp SONRA model cevabı görebildiği akış (kullanıcının isteği:
          "eskisinde olup slaytta olmayan özellikleri koru"). SlidePlayer bu prop'u hiç
          geçmediği için classicalMode hep 'reveal' kalır, davranışı değişmez. */}
      {q.type === 'classical' && classicalMode === 'input' && (
        <div className="mt-2.5">
          <textarea
            value={classicalValue ?? ''}
            onChange={(e) => onClassicalChange?.(e.target.value)}
            disabled={answered}
            style={textSmStyle}
            className="h-28 w-full resize-none rounded-xl border border-default bg-surface p-3 text-sm text-default placeholder:text-muted-foreground focus:border-indigo-400 focus:outline-none disabled:opacity-70 sm:h-36"
            placeholder="Cevabını buraya yaz..."
          />
          <p className="mt-1.5 text-xs font-bold text-muted-foreground" style={textXsStyle}>{(classicalValue ?? '').length} karakter</p>
          {!answered && (
            <button
              type="button"
              onClick={checkClassicalInput}
              disabled={(classicalValue ?? '').trim().length < 5}
              className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cevabımı Kontrol Et
            </button>
          )}
        </div>
      )}

      {q.type === 'classical' && classicalMode === 'reveal' && q.modelAnswer && !answered && (
        <button
          type="button"
          onClick={revealClassical}
          aria-expanded={answered}
          aria-controls={explanationId}
          className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-black text-indigo-500 transition-colors hover:bg-indigo-500/20"
          style={textXsStyle}
        >
          <Eye className="h-3.5 w-3.5" /> Model Cevabı Göster
        </button>
      )}

      {(() => {
        if (!answered) return null;
        const selectedOption = optionList?.find((o) => o.id === selectedId);
        const matchAllCorrect = q.type === 'matching' && q.pairs.every((p) => assignment[p.id] === p.id);
        // classical 'input' modunda modelAnswer olmasa bile (eski ClassicalView'daki gibi)
        // "Bu soru için model cevap eklenmemiş." yedek metniyle bir açıklama alanı sunuluyor.
        const hasExplanation =
          q.type === 'matching'
          || (q.type === 'classical' && (classicalMode === 'input' || !!q.modelAnswer))
          || ((q.type === 'multiple_choice' || q.type === 'blank') && !!q.solution_text);
        if (!feedbackMessage && !hasExplanation) return null;
        const isPositive =
          answeredCorrectly !== undefined ? answeredCorrectly
          : q.type === 'classical' ? true
          : q.type === 'matching' ? matchAllCorrect
          : !!selectedOption?.is_correct;
        const accentCls = q.type === 'classical' ? 'border-indigo-500 bg-indigo-500/5' : isPositive ? 'border-emerald-500 bg-emerald-500/5' : 'border-rose-500 bg-rose-500/5';
        // twoStepExplanation: cevap/eşleşme belli olduktan SONRA bile açıklama metni ayrı bir
        // "Açıklamayı Göster" butonuna kadar gizli kalır — eskiden QuizClient'ın canlı test
        // akışındaki davranış, kaybolmasın diye korunuyor (varsayılan false'ta SlidePlayer'ın
        // eski davranışı aynen sürüyor: her şey hemen görünür).
        const showExplanationBody = !twoStepExplanation || explanationRevealed;

        return (
          <div
            id={explanationId}
            data-open={answered}
            aria-hidden={!answered}
            className="cevap-aciklama grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-out data-[open=true]:grid-rows-[1fr] data-[open=true]:opacity-100 data-[open=true]:mt-2.5"
          >
            <div className="overflow-hidden">
              <div className={`rounded-r-lg border-l-4 p-3 ${accentCls}`}>
                {feedbackMessage && (
                  <p
                    className={`text-sm font-black ${isPositive ? 'text-emerald-600' : q.type === 'classical' ? 'text-indigo-500' : 'text-rose-600'}`}
                    style={textSmStyle}
                  >
                    {feedbackMessage}
                  </p>
                )}
                {hasExplanation && twoStepExplanation && !explanationRevealed && (
                  <button
                    type="button"
                    onClick={toggleExplanation}
                    className={`flex items-center gap-1.5 text-xs font-black text-indigo-500 hover:underline ${feedbackMessage ? 'mt-2' : ''}`}
                  >
                    <Eye className="h-3.5 w-3.5" /> Açıklamayı Göster
                  </button>
                )}
                {hasExplanation && showExplanationBody && (
                  <div className={feedbackMessage ? 'mt-2' : ''}>
                    {q.type === 'matching' && (
                      <ul className="space-y-1 text-sm text-muted-foreground" style={textSmStyle}>
                        {q.pairs.map((p) => (
                          <li key={p.id}>
                            <MathText as="span" className="font-bold text-default" text={p.left_text} /> → <MathText text={p.right_text} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.type === 'classical' && (
                      <p className="text-sm text-muted-foreground" style={textSmStyle}>
                        <span className="font-black text-indigo-500">Model Cevap: </span>
                        <MathText text={q.modelAnswer || 'Bu soru için model cevap eklenmemiş.'} />
                      </p>
                    )}
                    {(q.type === 'multiple_choice' || q.type === 'blank') && q.solution_text && (
                      <p className="text-xs text-muted-foreground" style={textXsStyle}><MathText text={q.solution_text} /></p>
                    )}
                  </div>
                )}
              </div>
              {answered && <ReportQuestionButton questionId={q.id} />}
            </div>
          </div>
        );
      })()}
    </>
  );
}

export const QuestionAnswerKeyItem = memo(QuestionAnswerKeyItemImpl);

// Tüm soru+cevap anahtarı — bilerek sadece SONUÇ ekranında (showResult) render ediliyor,
// aktif çözüm ekranında DEĞİL. Önceden SEO amacıyla aktif ekranda da gösteriliyordu ama bu,
// öğrencinin testi bitirmeden tek tıkla tüm doğru cevapları görebilmesi demekti. Kopya
// çekme riski SEO faydasından daha önemli görüldüğü için kaldırıldı (bkz. proje notları).
function AnswerKeySection({ questions }: { questions: QuizQuestion[] }) {
  return (
    <details className="mx-auto mt-6 max-w-lg rounded-2xl border border-default bg-surface-elevated p-4 sm:p-6">
      <summary className="cursor-pointer text-sm font-black text-default">Tüm Sorular ve Cevaplar ({questions.length} soru)</summary>
      <div className="mt-4 space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="border-t border-default pt-4 first:border-t-0 first:pt-0">
            <QuestionAnswerKeyItem question={q} index={i} />
          </div>
        ))}
      </div>
    </details>
  );
}

interface QuizIntro {
  subLabel: string;
  description: string | null;
  topicCount?: number | null;
  questionCount?: number | null;
}

export interface QuizClientProps {
  scopeLabel: string;
  exitHref: string;
  exitLabel: string;
  initialQuestions: QuizQuestion[];
  // SSR sadece ilk soruyu çözüp gönderir (sayfa hızlı açılsın diye — artık SEO amaçlı tüm
  // soruların baştan hazır olmasına gerek yok, bkz. /soru-bankasi); bu, kalan soruların id
  // listesidir, mount olur olmaz reloadEndpoint'ten `&ids=...` ile arka planda sessizce çekilip
  // questions dizisinin sonuna eklenir. Resume'da her zaman boş gelir (bkz. quizPageData.ts).
  remainingQuestionIds?: number[];
  reloadEndpoint: string;
  intro?: QuizIntro;
  onCurrentQuestionChange?: (question: QuizQuestion | null, isAnswered: boolean) => void;
  // Giriş yapmış kullanıcı için çözülen soruların istatistiğini (SRS, günlük
  // özet vb.) tutan backend'e bağlanmak için gerekli — bkz. aşağıdaki
  // test oturumu efekti. Misafir kullanıcıda bunlar kullanılmaz, test normal
  // şekilde çözülür, hiçbir kayıt yapılmaz.
  gradeId?: number | null;
  lessonId?: number | null;
  unitId?: number | null;
  topicId?: number | null;
  // Sayfa, kullanıcının bu bağlam (ünite/konu) için zaten bitmemiş bir test_sessions kaydı
  // olduğunu sunucu tarafında tespit ettiyse doldurulur — QuizClient sıfırdan yeni bir oturum
  // açıp eskisini terk etmek yerine aynı soru havuzuyla, zaten cevaplananları atlayarak devam
  // eder (bkz. app/src/lib/quizResume.ts).
  resume?: {
    sessionId: number;
    answers: { questionId: number; isCorrect: boolean }[];
  } | null;
  // Sunucu, giriş yapmış kullanıcı için havuzdaki HİÇBİR sorunun şu an çözülmeye uygun
  // olmadığını (hepsi ya ustalaşılmış ya da SRS tekrar vakti gelmemiş) tespit ettiyse true —
  // initialQuestions boş olur ama sebep "içerik yok" değil "şimdilik bitirdin"; bu durumda
  // "Bu konu için henüz soru yok" yerine tebrik ekranı gösterilir.
  allCaughtUp?: boolean;
  // Konu tek/sabit bilindiğinde (kavrama-testi) paylaş butonunun /soru-bankasi/.../konu
  // sayfasına doğrudan link üretmesi için taban yol (bkz. buildQuestionBankPath). Ünite
  // testi/tekrar gibi karışık-konulu bağlamlarda geçilmez — paylaş linki o durumda eski
  // /soru/[id]'de kalır, ki bu artık /soru-bankasi'na 301 ile yönleniyor.
  questionBankPathBase?: string;
  // Verilirse "exitHref"e Link ile NAVİGASYON yapmak yerine bu callback çağrılır (ör. soru
  // bankasının kendi client-side modalı — kullanıcının 2026-09-05 isteği: URL hiç
  // değişmesin, sayfadan hiç ayrılınmasın). Verilmezse davranış eskisiyle birebir aynı
  // (exitHref'e normal Link navigasyonu).
  onExit?: () => void;
  // 'player' (2026-09-26): slayt oynatıcısıyla AYNI tam ekran görünüm (bkz. QuestionPlayerParts)
  // — soru bankası ve konu sayfasındaki client-side testler kullanıyor, kendi overlay'ini
  // çizdiği için QuizModal İÇİNE KONMAZ. Oturum/resume/SRS/süre/admin mantığı iki görünümde
  // de BİREBİR aynı; sadece render farklı. Varsayılan 'page' eski görünüm (kavrama/ünite testi
  // sayfaları, panel modalı, tekrar).
  presentation?: 'page' | 'player';
  // Oynatıcıda "Sor" panelinin içeriği (yorumlar + AI'ya sor, bkz. QuizWithAsk) — aktif soruya göre.
  renderAside?: (question: QuizQuestion) => ReactNode;
  // Misafir testi (GuestTopicTest, 2026-10-23): "Yeni Test Çöz" reloadEndpoint yerine çağıranın
  // sıradaki partisini açar; onFinish sonuç ekranına geçilince çağrılır; resultNote sonuç ekranına not.
  onRetry?: () => void;
  onFinish?: () => void;
  resultNote?: ReactNode;
}

// exitHref'e Link ile git (varsayılan, mevcut tüm çağıranlar) ya da onExit callback'ini
// çağır (soru bankasının pure client-side modalı) — aynı görünüm, sadece "çıkış" farklı.
function ExitLink({ href, label, onExit, className }: { href: string; label: string; onExit?: () => void; className: string }) {
  if (onExit) {
    return (
      <button type="button" onClick={onExit} className={className}>
        <ArrowLeft className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

function findFirstUnansweredIndex(questions: QuizQuestion[], answeredIds: Set<number>): number {
  const idx = questions.findIndex((q) => !answeredIds.has(q.id));
  return idx === -1 ? Math.max(0, questions.length - 1) : idx;
}

export default function QuizClient({
  scopeLabel,
  exitHref,
  exitLabel,
  initialQuestions,
  remainingQuestionIds = [],
  reloadEndpoint,
  intro,
  onCurrentQuestionChange,
  gradeId,
  lessonId,
  unitId,
  topicId,
  resume,
  allCaughtUp: initialAllCaughtUp = false,
  questionBankPathBase,
  onExit,
  presentation = 'page',
  renderAside,
  onRetry,
  onFinish,
  resultNote,
}: QuizClientProps) {
  const resumedAnsweredIds = useMemo(() => new Set(resume?.answers.map((a) => a.questionId) ?? []), [resume]);
  const resumeAllAnswered = !!resume && initialQuestions.length > 0 && resumedAnsweredIds.size >= initialQuestions.length;
  const initialResumeIndex = resume ? findFirstUnansweredIndex(initialQuestions, resumedAnsweredIds) : 0;
  // intro verilen bir bağlamda (bkz. QuizIntro), bildirimden/panelden tıklayınca doğrudan
  // sayaçlı ilk soruya düşmek yerine önce bir bilgilendirme ekranı gösterip "Başla"
  // bekleniyor — ama devam eden (en az bir cevabı olan) bir oturum resume ediliyorsa bu
  // ekranı ATLA, kullanıcıyı zaten kaldığı yere döndürüyoruz.
  const [started, setStarted] = useState(() => !intro || resumedAnsweredIds.size > 0);
  // Akıllı tahtadan uzaktaki öğrenciler için metin büyütme — sadece bu oturumda geçerli,
  // kaydedilmiyor (SlidePlayer'daki aynı kontrolün QuizClient karşılığı, kullanıcının
  // 2026-09-22 isteği).
  const [fontScale, setFontScale] = useState(1);

  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  // remainingQuestionIds boş değilse arka plan yüklemesi tamamlanana kadar false kalır — session
  // açma efekti bunu bekler (bkz. o efektin yorumu, çift test_sessions açılmasını önlüyor).
  const [questionsFullyLoaded, setQuestionsFullyLoaded] = useState(remainingQuestionIds.length === 0);
  const [allCaughtUp, setAllCaughtUp] = useState(initialAllCaughtUp);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(initialResumeIndex);
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [matchAssign, setMatchAssign] = useState<Record<number, Record<number, number>>>({});
  const [classicalAnswer, setClassicalAnswer] = useState<Record<number, string>>({});
  const [locked, setLocked] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    resume?.answers.forEach((a) => { initial[a.questionId] = true; });
    return initial;
  });
  const [correct, setCorrect] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    resume?.answers.forEach((a) => { initial[a.questionId] = a.isCorrect; });
    return initial;
  });
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(resumeAllAnswered);
  const [resultFilter, setResultFilter] = useState<'auto' | 'wrong' | 'correct' | 'all'>('auto');
  const [reloadKey, setReloadKey] = useState(0);
  const [maxIndex, setMaxIndex] = useState(initialResumeIndex);
  // Açıklama artık cevap verilir vermez otomatik gösterilmiyor — öğrenci isterse
  // "Açıklamayı Göster" ile açar (kullanıcı kararı, 2026-09-02). Soru id'sine göre
  // tutulur, bir kez açılan bir daha kapanmaz (tek yönlü reveal, sadeliği için).
  const [revealedExplanation, setRevealedExplanation] = useState<Record<number, boolean>>({});
  const revealExplanation = (questionId: number) => setRevealedExplanation((prev) => ({ ...prev, [questionId]: true }));

  const isAdmin = useIsAdmin();
  const [editOpen, setEditOpen] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<number>>(() => new Set());
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);

  // Giriş yapmış kullanıcının çözdüğü soruların istatistiğini tutmak için: bu soru
  // setiyle açılmış test_sessions kaydının id'si. Misafir kullanıcıda hep null kalır,
  // hiçbir kayıt yapılmaz — bkz. aşağıdaki session efekti. resume verildiyse baştan
  // dolu gelir, aşağıdaki efekt bu durumda yeni bir oturum AÇMAZ (sessionQuestionsKeyRef
  // zaten bu soru setiyle eşleşecek şekilde seed'lendiği için).
  const { isAuthenticated, user, supabase } = useAuth();

  useEffect(() => {
    if (!user || questions.length === 0) return;
    let cancelled = false;
    fetchMySavedRefs(supabase, { questionIds: questions.map((q) => q.id) }).then(({ savedQuestionIds: ids }) => {
      if (!cancelled) setSavedQuestionIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [user, supabase, questions]);
  const [sessionId, setSessionId] = useState<number | null>(resume?.sessionId ?? null);
  // Oturum artık soru seti yüklenir yüklenmez DEĞİL, kullanıcı en az 1 soruyu cevaplayınca
  // açılıyor (kullanıcının 2026-09-06 isteği: "sadece tıkladı, hiç soru çözmedi ama yarım
  // kalan test diye kayıtlı kalıyordu" — istemeden tıklayıp hemen çıkanlar için anlamsız bir
  // test_sessions kaydı oluşmasın). resume ile devam ediliyorsa zaten en az bir cevap
  // verilmiş demektir, baştan true.
  const [hasAnsweredOnce, setHasAnsweredOnce] = useState(!!resume);
  const clientIdRef = useRef<string>('');
  const sessionQuestionsKeyRef = useRef<string | null>(resume ? initialQuestions.map((q) => q.id).join(',') : null);
  const finishedSessionRef = useRef<number | null>(null);
  // Soru başına çözme süresi (duration_seconds) — yalnız sekme görünürken sayar.
  const questionStopwatch = useVisibleStopwatch();
  // Oturum açma RPC'si henüz dönmemişken kullanıcı çok hızlı cevap verirse buraya
  // birikir; sessionId gelince aşağıdaki efekt hepsini tek seferde gönderir — hiçbir
  // cevap sessizce kaybolmaz.
  const pendingAnswersRef = useRef<{ questionId: number; isCorrect: boolean; durationSeconds: number; answer: AnswerDetail }[]>([]);

  // clientIdRef'i HER durumda (resume dahil) mount'ta oluşturur. Önceden sadece yeni oturum
  // açan efektin içinde set ediliyordu — resume ile devam edilen bir oturumda o efekt hiç
  // çalışmadığı (yeni oturum açmadığı) için clientIdRef boş string kalıyor, bu da
  // test_session_answers insert'lerinin "invalid input syntax for type uuid" ile sessizce
  // başarısız olmasına yol açıyordu (gerçek bug, kullanıcı tarafından bulundu).
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }
  }, []);

  // İlk soru sunucudan hazır geliyor, sayfa hemen açılsın diye — kalan sorular burada, mount
  // olur olmaz, kullanıcı ilk soruyu okurken arka planda sessizce çekilir ve diziye eklenir.
  // Sadece bir kez (mount'ta) çalışır; "Tekrar Çöz" zaten tüm seti tek seferde getiriyor.
  useEffect(() => {
    if (remainingQuestionIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${reloadEndpoint}&ids=${remainingQuestionIds.join(',')}`);
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(data?.questions) && data.questions.length > 0) {
          setQuestions((prev) => [...prev, ...data.questions]);
        }
      } finally {
        if (!cancelled) setQuestionsFullyLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Sadece mount'ta çalışsın: remainingQuestionIds sayfa ilk yüklendiğinde sabitlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // İlk yükleme sunucudan gelen initialQuestions ile geliyor (artık sadece ilk soru — sayfa
  // hızlı açılsın diye, bkz. yukarıdaki arka plan yükleme efekti) — bu effect sadece "Tekrar
  // Çöz" (reloadKey artışı) ile yeni bir karışık sırada soru seti almak için çalışır, ilk
  // render'da fetch atmaz.
  useEffect(() => {
    if (reloadKey === 0) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(reloadEndpoint);
        const data = await res.json().catch(() => null);
        if (!cancelled) {
          setQuestions(res.ok ? data?.questions || [] : []);
          setAllCaughtUp(res.ok ? !!data?.allCaughtUp : false);
          setQuestionsFullyLoaded(true);
          setIndex(0);
          setMaxIndex(0);
          setSelection({});
          setMatchAssign({});
          setClassicalAnswer({});
          setLocked({});
          setCorrect({});
          setFeedback({});
          setShowResult(false);
          setResultFilter('auto');
          // Yeni soru seti = yeni deneme: önceki oturumla ilişkiyi kes, aşağıdaki
          // session efekti yeni questions için yeni bir test_sessions açacak — ama yine
          // ancak ilk cevap verilince (hasAnsweredOnce sıfırlanıyor).
          setSessionId(null);
          sessionQuestionsKeyRef.current = null;
          finishedSessionRef.current = null;
          pendingAnswersRef.current = [];
          setHasAnsweredOnce(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadEndpoint, reloadKey]);

  // Giriş yapmış kullanıcı için bu soru setiyle bir test oturumu açar. Misafirde
  // (isAuthenticated=false) hiç çalışmaz — quiz normal şekilde, kayıtsız çözülür.
  // questionsFullyLoaded beklenir: aksi halde önce [ilkSoru] için, sonra arka plan yüklemesi
  // bitince tam set için olmak üzere İKİ AYRI test_sessions açılırdı (questions değişince bu
  // efekt yeniden tetiklenir). hasAnsweredOnce beklenir: sadece tıklayıp hiç soru çözmeden
  // çıkanlar için anlamsız bir "yarım kalan test" kaydı oluşmasın diye (kullanıcının
  // 2026-09-06 isteği) — session artık soru seti yüklenir yüklenmez değil, İLK CEVAP
  // verilince açılıyor. Kullanıcı ilk soruyu bu sırada (session henüz açılmadan) cevaplarsa
  // pendingAnswersRef zaten kaybetmeden kuyruklar, session açılınca flush edilir.
  useEffect(() => {
    if (!isAuthenticated || !user || questions.length === 0 || !questionsFullyLoaded || !hasAnsweredOnce) return;
    const questionsKey = questions.map((q) => q.id).join(',');
    if (sessionQuestionsKeyRef.current === questionsKey) return;
    sessionQuestionsKeyRef.current = questionsKey;

    const gradedIds = questions.filter((q) => q.type !== 'classical').map((q) => q.id);
    if (gradedIds.length === 0) return;

    if (!clientIdRef.current) {
      clientIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }

    void startSessionWithRetry<number>(() =>
      supabase.rpc('start_web_quiz_session', {
        p_client_id: clientIdRef.current,
        p_grade_id: gradeId ?? null,
        p_lesson_id: lessonId ?? null,
        p_unit_id: unitId ?? null,
        p_topic_id: topicId ?? null,
        p_question_ids: gradedIds,
      })
    ).then((data) => {
      if (typeof data === 'number') setSessionId(data);
    });
    // user (nesne) yerine user?.id: Supabase TOKEN_REFRESHED gibi olaylarda user nesnesi aynı
    // kullanıcı için bile yeni bir referansla gelir, id ise gerçekten değişmediği sürece sabittir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, questions, questionsFullyLoaded, hasAnsweredOnce, supabase, gradeId, lessonId, unitId, topicId]);

  // sessionId hazır olduğunda: önce (varsa) oturum açılmadan önce kuyruklanmış
  // cevapları gönderir, ancak ONDAN SONRA — test zaten bitmişse (showResult) —
  // oturumu kapatır. Sıra önemli: finish_test_session'ın tetiklediği istatistik
  // hesaplaması, o ana kadar yazılmış tüm test_session_answers satırlarını okur.
  useEffect(() => {
    if (sessionId == null || !user) return;

    async function syncSession(currentSessionId: number) {
      if (pendingAnswersRef.current.length > 0) {
        const toFlush = pendingAnswersRef.current;
        pendingAnswersRef.current = [];
        // finish_test_session bu cevapları okuyacağı için gönderim bitene kadar beklenir.
        await submitAnswers(
          supabase,
          toFlush.map((a) => ({
            test_session_id: currentSessionId,
            question_id: a.questionId,
            user_id: user!.id,
            client_id: clientIdRef.current,
            is_correct: a.isCorrect,
            duration_seconds: a.durationSeconds,
            selected_option_id: a.answer.optionId ?? null,
            match: a.answer.match ?? null,
          }))
        );
      }

      if (showResult && finishedSessionRef.current !== currentSessionId) {
        finishedSessionRef.current = currentSessionId;
        // Son cevaplar hâlâ gönderiliyor olabilir — oturum kapanmadan önce kutu boşalsın.
        await flushAnswerOutbox(supabase, user!.id);
        const { error } = await supabase.rpc('finish_test_session', { p_session_id: currentSessionId });
        if (error) console.error('finish_test_session error:', error.message);
      }
    }

    syncSession(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, showResult, user?.id, supabase]);

  // Bilerek burada "kullanıcı sayfadan ayrılırsa oturumu otomatik kapat" gibi bir mekanizma
  // YOK: yarım kalan bir test_sessions kaydı bilinçli olarak completed_at=null bırakılır ki
  // öğrenci aynı ünite/konu için testi tekrar açtığında findResumableSession (bkz.
  // quizResume.ts) onu bulup kaldığı sorudan devam ettirebilsin. Daha önceki bir sürümde
  // sayfadan ayrılınca oturumu otomatik bitiren bir efekt vardı — bu, "kaldığın yerden devam
  // et" özelliğiyle doğrudan çelişiyordu (her ayrılışta oturum bitmiş sayıldığı için devam
  // edilecek hiçbir şey kalmıyordu) ve kaldırıldı (kullanıcı kararı, 2026-09-02).

  // Ekrandaki soru değişince süre ölçümünü sıfırlar (duration_seconds için). questions'a değil
  // soru kimliğine bağlı: kalan sorular arka planda listeye eklenince ölçüm sıfırlanmasın.
  const currentQuestionId = questions[index]?.id;
  useEffect(() => {
    questionStopwatch.reset();
  }, [index, currentQuestionId, reloadKey, questionStopwatch]);

  // Testte kalınan toplam süre (test_sessions.active_seconds) — kaydediliyor, gösterilmiyor.
  useSessionActiveTime(supabase, sessionId);

  // Aynı denemede (reloadKey) bir soru yalnız bir kez kaydedilir — zaman aşımı + tıklama gibi
  // üst üste gelen çağrılar çift test_session_answers satırı (ve istatistikte çift sayım) üretmesin.
  const recordedAnswersRef = useRef<Set<string>>(new Set());

  // answer: cevabın kendisi — sunucu doğruluğu bundan hesaplar (is_correct yalnız ekran içindir).
  function recordAnswer(questionId: number, isCorrect: boolean, answer: AnswerDetail = {}) {
    if (!user) return;
    const recordKey = `${reloadKey}:${questionId}`;
    if (recordedAnswersRef.current.has(recordKey)) return;
    recordedAnswersRef.current.add(recordKey);
    // İLK cevap: yukarıdaki efeği (henüz hiç tetiklenmediyse) tetikleyip test oturumunu
    // açtırır — session artık soru seti yüklenir yüklenmez değil, burada açılıyor.
    if (!hasAnsweredOnce) setHasAnsweredOnce(true);
    const durationSeconds = Math.round(questionStopwatch.elapsedMs() / 1000);
    // Oturum RPC'si henüz dönmediyse (nadir, çok hızlı cevaplama) kaybetmeden kuyruğa
    // al — sessionId gelince yukarıdaki efekt bunu gönderecek.
    if (sessionId == null) {
      pendingAnswersRef.current.push({ questionId, isCorrect, durationSeconds, answer });
      return;
    }
    void submitAnswers(supabase, [{
      test_session_id: sessionId,
      question_id: questionId,
      user_id: user.id,
      client_id: clientIdRef.current,
      is_correct: isCorrect,
      duration_seconds: durationSeconds,
      selected_option_id: answer.optionId ?? null,
      match: answer.match ?? null,
    }]);
  }

  const current = questions[index];
  const currentIsAnswered = !!(current && locked[current.id]);

  useEffect(() => {
    onCurrentQuestionChange?.(showResult ? null : current ?? null, currentIsAnswered);
    // current her render'da yeni referans olabileceğinden sadece bu değerler
    // değiştiğinde tetiklemek yeterli — onCurrentQuestionChange ebeveynde useCallback
    // ile sabitlenmezse gereksiz tekrar tetiklenmeyi de böyle önlüyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, showResult, currentIsAnswered]);

  const answeredCount = Object.keys(locked).length;
  const gradedQuestions = useMemo(() => questions.filter((q) => q.type !== 'classical'), [questions]);
  const classicalCount = questions.length - gradedQuestions.length;
  const score = useMemo(() => gradedQuestions.filter((q) => correct[q.id]).length, [gradedQuestions, correct]);

  const selectAnswer = (optionId: number) => {
    if (!current || current.type === 'matching' || current.type === 'classical' || locked[current.id]) return;
    const options = current.type === 'multiple_choice' ? current.choices : current.options;
    const chosen = options.find((o) => o.id === optionId);
    setSelection((prev) => ({ ...prev, [current.id]: optionId }));
    setLocked((prev) => ({ ...prev, [current.id]: true }));
    setCorrect((prev) => ({ ...prev, [current.id]: !!chosen?.is_correct }));
    setFeedback((prev) => ({ ...prev, [current.id]: randomOf(chosen?.is_correct ? CORRECT_MESSAGES : INCORRECT_MESSAGES) }));
    recordAnswer(current.id, !!chosen?.is_correct, { optionId });
  };

  // Eşleştirmede tek bir çift atandığında ANINDA doğru/yanlış göstermiyoruz — kullanıcı
  // tüm çiftleri istediği gibi değiştirebilir, sonuç ancak "Cevabımı Kontrol Et" ile
  // (checkMatching) açığa çıkar. Bir sağ öğeyi başka bir sol öğeye atamak, o sağ öğenin
  // önceki eşleşmesini serbest bırakır (aşağıdaki döngü) — böylece zaten tamamlanmış bir
  // eşleştirme de tamamen esnek kalır.
  const assignMatch = (leftId: number, rightId: number) => {
    if (!current || current.type !== 'matching' || locked[current.id]) return;
    const prevAssign = matchAssign[current.id] || {};
    const nextAssign = { ...prevAssign };
    for (const [l, r] of Object.entries(nextAssign)) {
      if (r === rightId) delete nextAssign[Number(l)];
    }
    nextAssign[leftId] = rightId;
    setMatchAssign((prev) => ({ ...prev, [current.id]: nextAssign }));
  };

  const checkMatching = () => {
    if (!current || current.type !== 'matching' || locked[current.id]) return;
    const assignment = matchAssign[current.id] || {};
    if (Object.keys(assignment).length !== current.pairs.length) return;
    const allCorrect = current.pairs.every((p) => assignment[p.id] === p.id);
    setLocked((prev) => ({ ...prev, [current.id]: true }));
    setCorrect((prev) => ({ ...prev, [current.id]: allCorrect }));
    setFeedback((prev) => ({ ...prev, [current.id]: randomOf(allCorrect ? CORRECT_MESSAGES : INCORRECT_MESSAGES) }));
    recordAnswer(current.id, allCorrect, { match: assignment });
  };

  const setClassicalText = (text: string) => {
    if (!current || current.type !== 'classical') return;
    setClassicalAnswer((prev) => ({ ...prev, [current.id]: text }));
  };

  const checkClassical = () => {
    if (!current || current.type !== 'classical' || locked[current.id]) return;
    setLocked((prev) => ({ ...prev, [current.id]: true }));
  };

  const goNext = () => {
    if (index < questions.length - 1) {
      const nextIndex = index + 1;
      setMaxIndex((m) => Math.max(m, nextIndex));
      setIndex(nextIndex);
    } else {
      setShowResult(true);
      onFinish?.();
    }
  };

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const jumpToIndex = (i: number) => {
    if (i < 0 || i >= questions.length || i > maxIndex) return;
    setShowResult(false);
    setIndex(i);
  };

  const retry = () => (onRetry ? onRetry() : setReloadKey((k) => k + 1));
  const answerKey = questions.length > 0 ? <AnswerKeySection questions={questions} /> : null;

  // Admin bu soruyu sayfadan çözmeden silerse, listeden çıkarıp mevcut index'i
  // sınırlar içinde tutar — kalan soru yoksa mevcut "Bu konu için henüz soru yok"
  // ekranı zaten devreye girer (questions.length === 0 dalı, aşağıda).
  useEffect(() => {
    if (index > questions.length - 1 && questions.length > 0) {
      setIndex(questions.length - 1);
      setMaxIndex((m) => Math.min(m, questions.length - 1));
    }
  }, [questions.length, index]);

  async function handleAdminDelete() {
    const target = questions[index];
    if (!target) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/admin/manage/questions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [target.id] }),
      });
      if (!res.ok) {
        setDeleteError('Silinemedi, lütfen tekrar dene.');
        return;
      }
      setQuestions((prev) => prev.filter((q) => q.id !== target.id));
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  function shareTextFor(q: QuizQuestion): string {
    return stripEmphasis(q.question_text);
  }

  async function handleToggleSaveQuestion(q: QuizQuestion) {
    if (!user || savingQuestionId === q.id) return;
    const wasSaved = savedQuestionIds.has(q.id);
    setSavedQuestionIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
    setSavingQuestionId(q.id);
    try {
      const res = await saveStudyItem(supabase, {
        kind: 'question',
        questionId: q.id,
        excerpt: q.type === 'matching' ? 'Eşleştirme sorusu' : stripEmphasis(q.question_text),
        toggle: true,
      });
      setSavedQuestionIds((prev) => {
        const next = new Set(prev);
        if (res.isSaved) next.add(q.id);
        else next.delete(q.id);
        return next;
      });
    } catch {
      setSavedQuestionIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(q.id);
        else next.delete(q.id);
        return next;
      });
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function handleShare(q: QuizQuestion) {
    const url = questionBankPathBase
      ? `${window.location.origin}${questionBankPathBase}?soru=${q.id}`
      : `${window.location.origin}/soru/${q.id}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Ders Takip - Soru', text: shareTextFor(q), url });
      } catch {
        // kullanıcı paylaşım penceresini iptal etti — sessizce geç
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      // Clipboard API yoksa (çok eski tarayıcı) sessizce yok say
    }
  }

  // ---- Oynatıcı (presentation='player') ----
  const isPlayer = presentation === 'player';
  const router = useRouter();
  const pathname = usePathname();
  const playerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(playerRef);
  const [asideOpen, setAsideOpen] = useState(false);
  useDismissOnBack(Boolean(asideOpen && renderAside), () => setAsideOpen(false));
  useDismissOnBack(editOpen, () => setEditOpen(false));
  useDismissOnBack(confirmDeleteOpen, () => setConfirmDeleteOpen(false), { canDismiss: () => !deleting });
  // Numara şeridi penceresi: aktif soru pencerenin dışına çıkınca otomatik kayar, ama ‹/› ile
  // elle kaydırılabilsin diye hangi index için hesaplandığı da tutuluyor (effect'te setState yok).
  const [pillWindow, setPillWindow] = useState({ start: 0, forIndex: index });
  const pillStart = pillWindow.forIndex === index ? pillWindow.start : pillWindowFor(index, pillWindow.start, questions.length);
  const setPillStart = useCallback(
    (updater: (s: number) => number) =>
      setPillWindow((w) => ({ start: updater(w.forIndex === index ? w.start : pillWindowFor(index, w.start, questions.length)), forIndex: index })),
    [index, questions.length]
  );
  const pillStatuses = useMemo(() => {
    const m: Record<number, AnswerStatus> = {};
    for (const q of questions) {
      if (!locked[q.id]) continue;
      m[q.id] = q.type === 'classical' ? 'revealed' : correct[q.id] ? 'correct' : 'incorrect';
    }
    return m;
  }, [questions, locked, correct]);
  const exitQuiz = useCallback(() => (onExit ? onExit() : router.push(exitHref)), [onExit, router, exitHref]);
  // X / Escape: ayrı test sayfasına site içinden gelindiyse (ör. anasayfadaki "Kaldığın yerden devam
  // et") öğrenci geldiği yere döner; doğrudan açıldıysa exitHref. Adı yazan düğmeler ("Konuya Dön")
  // exitQuiz ile yazdıkları yere gider.
  const closeQuiz = useCallback(() => {
    if (!onExit && hasInAppHistory()) router.back();
    else exitQuiz();
  }, [onExit, router, exitQuiz]);

  // Klavye: ← → soru, Escape kapat (tam ekrandaysa tarayıcı zaten ondan çıkar, testi kapatmayız).
  const playerNavRef = useRef({ next: () => {}, prev: () => {}, canNext: false });
  useEffect(() => {
    playerNavRef.current = { next: goNext, prev: goPrev, canNext: !!(questions[index] && locked[questions[index].id]) };
  });
  useEffect(() => {
    if (!isPlayer) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'Escape') {
        if (asideOpen) setAsideOpen(false);
        else if (!document.fullscreenElement && !editOpen && !confirmDeleteOpen) closeQuiz();
      } else if (e.key === 'ArrowLeft') playerNavRef.current.prev();
      else if (e.key === 'ArrowRight' && playerNavRef.current.canNext) playerNavRef.current.next();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isPlayer, asideOpen, editOpen, confirmDeleteOpen, closeQuiz]);

  const adminLayers = (
    <>
      {editOpen && current && (
        <QuizQuestionEditModal
          questionId={current.id}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            setEditSaved(true);
            setTimeout(() => setEditSaved(false), 4000);
          }}
        />
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface-elevated p-5">
            <h3 className="text-base font-black text-default">Bu soru silinsin mi?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">Bu işlem geri alınamaz.</p>
            {deleteError && <p className="mt-2 text-xs font-bold text-rose-500">{deleteError}</p>}
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-default bg-surface px-4 py-2.5 text-sm font-black text-default disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleAdminDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const playerAccent = SLIDE_ACCENTS[index % SLIDE_ACCENTS.length];
  const playerProgress = questions.length > 0 ? (showResult ? 100 : ((index + 1) / questions.length) * 100) : undefined;
  const playerShell = (body: ReactNode, opts: { stats?: ReactNode; controls?: ReactNode; footer?: ReactNode } = {}) => (
    <PlayerFrame
      variant="overlay"
      accent={playerAccent}
      containerRef={playerRef}
      cardKey={`quiz-${reloadKey}`}
      outside={adminLayers}
      headerResetKey={`${index}-${showResult}`}
      isFullscreen={isFullscreen}
      fontScale={fontScale}
      progress={playerProgress}
      header={
        <div className={PLAYER_TOP_BAR_CLASS}>
          {/* Mobilde 1. satır: Başlık + Kapat/Tam Ekran; sm+: tek satırda hepsi yan yana */}
          <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:flex-1">
            <div className="min-w-0 flex-1">
              <PlayerEyebrow text={scopeLabel} accent={playerAccent} fontScale={fontScale} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
              <OverlayWindowButtons isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={closeQuiz} />
            </div>
          </div>
          {(opts.stats || opts.controls) && (
            <div className="flex w-full shrink-0 items-center justify-between gap-1.5 sm:w-auto sm:justify-end">
              {opts.stats && <div className="flex items-center gap-1.5">{opts.stats}</div>}
              <div className="flex items-center gap-1.5">
                {opts.controls}
                <div className="hidden sm:flex items-center gap-1.5">
                  <OverlayWindowButtons isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={closeQuiz} />
                </div>
              </div>
            </div>
          )}
          {!opts.stats && !opts.controls && (
            <div className="hidden shrink-0 sm:flex items-center gap-1.5">
              <OverlayWindowButtons isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={closeQuiz} />
            </div>
          )}
        </div>
      }
    >
      {body}
      {opts.footer}
    </PlayerFrame>
  );
  const playerMessage = (icon: ReactNode, title: string, text: string) =>
    playerShell(
      <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
        {icon}
        <h2 className="text-lg font-black text-slate-800">{title}</h2>
        <p className="max-w-sm text-sm font-medium text-slate-500">{text}</p>
        <button
          type="button"
          onClick={exitQuiz}
          className="mt-2 rounded-full px-5 py-2.5 text-xs font-black text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${playerAccent.from}, ${playerAccent.to})` }}
        >
          {exitLabel}
        </button>
      </div>
    );

  if (loading && isPlayer) {
    return playerShell(
      <div className="relative flex flex-1 items-center justify-center gap-2 text-slate-400" role="status">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-bold">Sorular hazırlanıyor...</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-bold">Sorular hazırlanıyor...</span>
      </div>
    );
  }

  if (questions.length === 0 && allCaughtUp && isPlayer) {
    return playerMessage(
      <Trophy className="h-10 w-10 text-emerald-500" />,
      'Tebrikler! 🎉',
      'Şu anlık çözülecek yeni veya tekrar zamanı gelmiş soru yok. Az sonra tekrar uğra!'
    );
  }

  if (questions.length === 0 && allCaughtUp) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
          <Trophy className="h-8 w-8 text-white" />
        </div>
        <h1 className="mb-2 text-lg font-black text-default">Tebrikler! 🎉</h1>
        <p className="mb-6 text-sm font-medium text-muted-foreground">
          Şu anlık çözülecek yeni veya tekrar zamanı gelmiş soru yok. Az sonra tekrar uğra!
        </p>
        <ExitLink
          href={exitHref}
          label={exitLabel}
          onExit={onExit}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
        />
      </div>
    );
  }

  if (questions.length === 0 && isPlayer) {
    return playerMessage(<Trophy className="h-10 w-10 text-slate-300" />, 'Bu konu için henüz soru yok', 'Yakında bu konu için sorular eklenecek.');
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-sm">
          <Trophy className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-lg font-black text-default">Bu konu için henüz soru yok</h1>
        <p className="mb-6 text-sm font-medium text-muted-foreground">Yakında bu konu için sorular eklenecek.</p>
        <ExitLink
          href={exitHref}
          label={exitLabel}
          onExit={onExit}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
        />
      </div>
    );
  }

  // Oynatıcıda intro yok: kullanıcı testi zaten bir "Teste Başla/Devam Et" butonuyla açıyor.
  if (intro && !started && !isPlayer) {
    return (
      <div className="mx-auto max-w-lg px-3 py-4 sm:px-4 sm:py-12">
        <ExitLink
          href={exitHref}
          label={exitLabel}
          onExit={onExit}
          className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4"
        />

        <div className="rounded-2xl border border-default bg-surface-elevated p-3.5 sm:p-6">
          <p className="mb-1 text-xs font-black uppercase tracking-widest text-indigo-500">{intro.subLabel}</p>
          <h1 className="text-lg font-black leading-tight text-default sm:text-2xl">{scopeLabel}</h1>
          {intro.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{intro.description}</p>}
          {(intro.topicCount || intro.questionCount) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {intro.topicCount ? (
                <span className="rounded-full border border-default bg-surface px-3 py-1 text-xs font-bold text-muted-foreground">{intro.topicCount} Konu</span>
              ) : null}
              {intro.questionCount ? (
                <span className="rounded-full border border-default bg-surface px-3 py-1 text-xs font-bold text-muted-foreground">{intro.questionCount} Soru</span>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
          >
            <Play className="h-4 w-4" /> Başla
          </button>
        </div>
      </div>
    );
  }

  if (showResult && isPlayer) {
    const totalGraded = gradedQuestions.length;
    const percent = totalGraded ? Math.round((score / totalGraded) * 100) : 0;
    const wrongCount = totalGraded - score;
    const encouragement =
      percent >= 80
        ? 'Harika! Bu konuyu gerçekten kavramışsın.'
        : percent >= 50
          ? 'İyi gidiyorsun, yanlışlarına bakıp tekrar denersen tam oturur.'
          : 'Yanlış yaptığın soruları inceleyip tekrar denemeye ne dersin?';

    const ringR = 44;
    const ringC = 2 * Math.PI * ringR;
    const correctLen = totalGraded > 0 ? (score / totalGraded) * ringC : 0;
    const wrongLen = totalGraded > 0 ? (wrongCount / totalGraded) * ringC : 0;

    // Varsayılan olarak yanlış varsa doğrudan yanlışları göster (sade, odaklı inceleme); hepsi doğruysa tümünü.
    const activeFilter: 'wrong' | 'correct' | 'all' =
      resultFilter === 'auto' ? (wrongCount > 0 ? 'wrong' : 'all') : resultFilter;

    const indexedQuestions = questions.map((q, i) => ({ q, i, isClassical: q.type === 'classical', isCorrectQ: !!correct[q.id] }));
    const filteredQuestions =
      activeFilter === 'wrong'
        ? indexedQuestions.filter((x) => !x.isClassical && !x.isCorrectQ)
        : activeFilter === 'correct'
          ? indexedQuestions.filter((x) => !x.isClassical && x.isCorrectQ)
          : indexedQuestions;

    const tabCls = (active: boolean) =>
      `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
        active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-300'
      }`;

    return playerShell(
      <div
        className="relative flex min-h-0 w-full flex-1 flex-col items-center gap-5 overflow-x-hidden overflow-y-auto px-4 py-6 text-center sm:px-8"
        style={{ background: `linear-gradient(135deg, ${playerAccent.from}18, var(--background) 55%)` }}
      >
        {/* Özet Kartı: SVG Dağılım Halkası + Sade Metrikler */}
        <div className="flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-default bg-background/90 p-5 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-6 sm:text-left">
          <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${totalGraded} soruda ${score} doğru (%${percent})`}>
            <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="54" cy="54" r={ringR} fill="none" stroke="var(--border)" strokeWidth="9" />
              {correctLen > 0 && (
                <circle
                  cx="54"
                  cy="54"
                  r={ringR}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="9"
                  strokeDasharray={`${correctLen} ${ringC}`}
                  strokeDashoffset="0"
                />
              )}
              {wrongLen > 0 && (
                <circle
                  cx="54"
                  cy="54"
                  r={ringR}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="9"
                  strokeDasharray={`${wrongLen} ${ringC}`}
                  strokeDashoffset={-correctLen}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black leading-none text-default">%{percent}</span>
              <span className="mt-1 text-[11px] font-bold text-muted-foreground">
                {score}/{totalGraded}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-bold sm:justify-start">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {score} doğru
              </span>
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <XCircle className="h-4 w-4" aria-hidden="true" /> {wrongCount} yanlış
              </span>
              {classicalCount > 0 && <span className="text-muted-foreground">{classicalCount} açık uçlu</span>}
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-default">{encouragement}</p>
            {isAuthenticated && (
              <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Sonuçların kaydedildi</p>
            )}
            {resultNote}
          </div>
        </div>

        {/* Ana Aksiyonlar */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-default bg-background px-5 text-xs font-black text-default shadow-sm transition-colors hover:bg-surface-elevated"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Yeni Test Çöz
          </button>
          <button
            type="button"
            onClick={exitQuiz}
            className="min-h-11 rounded-full px-6 text-xs font-black text-white shadow-sm transition-opacity hover:opacity-95"
            style={{ background: `linear-gradient(135deg, ${playerAccent.from}, ${playerAccent.to})` }}
          >
            {exitLabel}
          </button>
        </div>

        {/* Soruları gözden geçir — filtreli, taşmasız kompakt liste (tıklayınca o soruya döner). */}
        <div className="flex w-full max-w-xl flex-col gap-2.5 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Soruları incele</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Soruları filtrele">
              {wrongCount > 0 && (
                <button type="button" aria-pressed={activeFilter === 'wrong'} onClick={() => setResultFilter('wrong')} className={tabCls(activeFilter === 'wrong')}>
                  Yanlışlar <span>{wrongCount}</span>
                </button>
              )}
              {score > 0 && (
                <button type="button" aria-pressed={activeFilter === 'correct'} onClick={() => setResultFilter('correct')} className={tabCls(activeFilter === 'correct')}>
                  Doğrular <span>{score}</span>
                </button>
              )}
              <button type="button" aria-pressed={activeFilter === 'all'} onClick={() => setResultFilter('all')} className={tabCls(activeFilter === 'all')}>
                Tümü <span>{questions.length}</span>
              </button>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-1.5 pb-2">
            {filteredQuestions.map(({ q, i, isClassical, isCorrectQ }) => (
              <button
                key={q.id}
                type="button"
                onClick={() => jumpToIndex(i)}
                className="flex min-w-0 w-full items-center gap-2.5 overflow-hidden rounded-xl border border-default bg-background/90 px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                    isClassical ? 'bg-indigo-500/15 text-indigo-500' : isCorrectQ ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-default">{stripEmphasis(q.question_text)}</span>
                {!isClassical && (isCorrectQ ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />)}
              </button>
            ))}
          </div>
        </div>

        {!isAuthenticated && (
          <div className="w-full max-w-xl rounded-2xl border border-indigo-200 bg-background/90 p-4 text-center dark:border-indigo-500/30">
            <p className="text-sm font-bold text-default">Bu sonuç kaydedilmedi.</p>
            <p className="mt-1 text-xs text-muted-foreground">Üye olursan doğru/yanlışların, günlük serin ve tekrar zamanı gelen sorular senin için takip edilir.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                href="/register"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 text-xs font-black text-white"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Ücretsiz Üye Ol
              </Link>
              <Link
                href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`}
                className="inline-flex min-h-10 items-center rounded-full border border-default bg-background px-4 text-xs font-black text-default transition-colors hover:bg-surface-elevated"
              >
                Giriş Yap
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showResult) {
    const percent = gradedQuestions.length ? Math.round((score / gradedQuestions.length) * 100) : 0;
    const wrongCount = gradedQuestions.length - score;
    // Puana göre değişen kısa bir teşvik mesajı — sonuç ekranı artık sadece "bitti" demiyor,
    // ne yapması gerektiğine dair bir yön de veriyor (kullanıcı isteği, 2026-09-13: "öğrenciyi
    // soru çözmeye teşvik etsin").
    const encouragement =
      percent >= 80
        ? { emoji: '🎉', text: 'Harika! Bu konuyu gerçekten kavramışsın.' }
        : percent >= 50
        ? { emoji: '💪', text: 'İyi gidiyorsun, biraz daha pratikle daha da iyi olacaksın.' }
        : { emoji: '📖', text: 'Bu konuyu bir daha gözden geçirip tekrar denemeye ne dersin?' };
    return (
      <>
      <div className="mx-auto max-w-lg px-4 py-12 sm:py-16">
        <div className="rounded-2xl border border-default bg-surface-elevated p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-indigo-500">{scopeLabel}</p>
          <h1 className="mt-1 text-2xl font-black text-default">
            {score} / {gradedQuestions.length} doğru
          </h1>
          <p className="mt-1 text-sm font-bold text-muted-foreground">%{percent} başarı</p>
          <p className="mt-2 text-sm font-bold text-default">
            {encouragement.emoji} {encouragement.text}
          </p>
          {classicalCount > 0 && (
            <p className="mt-1 text-xs font-medium text-muted-foreground">({classicalCount} açık uçlu soru puanlamaya dahil değil)</p>
          )}

          <div className={`mt-5 grid gap-2 ${classicalCount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3">
              <p className="text-xl font-black text-emerald-500">{score}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Doğru</p>
            </div>
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 py-3">
              <p className="text-xl font-black text-rose-500">{wrongCount}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-rose-600">Yanlış</p>
            </div>
            {classicalCount > 0 && (
              <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 py-3">
                <p className="text-xl font-black text-indigo-500">{classicalCount}</p>
                <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">Açık Uçlu</p>
              </div>
            )}
          </div>

          <div className="mt-6 max-h-72 space-y-1.5 overflow-y-auto text-left">
            {questions.map((q, i) => {
              const isClassical = q.type === 'classical';
              const isCorrectQ = !!correct[q.id];
              const label = `${i + 1}. ${stripEmphasis(q.question_text)}`;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => jumpToIndex(i)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-default bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                      isClassical ? 'bg-indigo-500/15 text-indigo-500' : isCorrectQ ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-default">{label}</span>
                  {!isClassical && (isCorrectQ ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />)}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-default bg-surface-elevated px-5 py-2.5 text-xs font-black text-default transition-colors hover:bg-surface"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tekrar Çöz
            </button>
            <ExitLink
              href={exitHref}
              label={exitLabel}
              onExit={onExit}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
            />
          </div>

          {!isAuthenticated && (
            <div className="mt-5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3.5 text-left">
              <p className="flex items-center gap-1.5 text-xs font-black text-indigo-500">
                <Sparkles className="h-3.5 w-3.5" /> İlerlemeni kaybetme
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Misafir olarak çözdüğün için bu sonuç kaydedilmiyor. Üye olursan doğru/yanlışların, günlük serin ve
                tekrar zamanı gelen sorular senin için takip edilir.
              </p>
              <Link
                href="/register"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-black text-white transition-opacity hover:opacity-90"
              >
                <UserPlus className="h-3.5 w-3.5" /> Ücretsiz Üye Ol
              </Link>
            </div>
          )}
        </div>
      </div>
      {answerKey}
      </>
    );
  }

  if (isPlayer) {
    const isAnsweredP = !!locked[current.id];
    const isCorrectP = !!correct[current.id];
    const isLastP = index === questions.length - 1;
    const wrongCountP = Object.values(pillStatuses).filter((v) => v === 'incorrect').length;
    const cardHeaderActions = (
      <>
        {renderAside && (
          <button
            type="button"
            onClick={() => setAsideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 sm:px-3 sm:py-1.5"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Anlamadım, sor</span>
          </button>
        )}
        {user && (
          <button
            type="button"
            onClick={() => void handleToggleSaveQuestion(current)}
            disabled={savingQuestionId === current.id}
            aria-label={savedQuestionIds.has(current.id) ? 'Soruyu notlarımdan çıkar' : 'Soruyu notlarıma kaydet'}
            title={savedQuestionIds.has(current.id) ? 'Notlarımda kayıtlı (çıkarmak için tıkla)' : 'Soruyu notlarıma ve kartıma kaydet'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
              savedQuestionIds.has(current.id) ? 'bg-cyan-50 text-cyan-600' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-500'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${savedQuestionIds.has(current.id) ? 'fill-current' : ''}`} />
          </button>
        )}
        <button
          type="button"
          onClick={() => handleShare(current)}
          aria-label="Soruyu paylaş"
          title="Soruyu paylaş"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-500"
        >
          <Share2 className="h-4 w-4" />
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Soruyu düzenle"
              title="Soruyu düzenle"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-500"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="Soruyu sil"
              title="Soruyu sil"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </>
    );

    return playerShell(
      <>
        {/* key: her soruda kaydırma kutusu yenilenir → yeni soru en baştan görünür. */}
        <div key={current.id} className="relative flex flex-1 min-h-0 flex-col overflow-y-auto bg-slate-50 px-2 py-2 sm:px-[clamp(16px,2.5vw,64px)] sm:py-3">
          <div className="relative z-[1] mt-0.5 mb-auto sm:my-auto w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
            {shareState === 'copied' && <p className="mb-2 text-xs font-bold text-emerald-600">Bağlantı kopyalandı!</p>}
            {editSaved && <p className="mb-2 text-xs font-bold text-emerald-600">Kaydedildi — güncel hâli sayfa yenilenince görünür.</p>}

            <QuestionAnswerKeyItem
              key={`${reloadKey}-${current.id}`}
              question={current}
              index={index}
              interactive
              fluid
              numberBadge="label"
              accentColor={playerAccent.bar}
              fontScale={fontScale}
              headerActions={cardHeaderActions}
              controlledSelectedId={current.type === 'multiple_choice' || current.type === 'blank' ? selection[current.id] ?? null : undefined}
              controlledAssignment={current.type === 'matching' ? matchAssign[current.id] || {} : undefined}
              onAssignPair={assignMatch}
              onCheckMatch={checkMatching}
              forcedAnswered={isAnsweredP}
              answeredCorrectly={isAnsweredP ? isCorrectP : undefined}
              feedbackMessage={feedback[current.id]}
              classicalMode="input"
              classicalValue={classicalAnswer[current.id] || ''}
              onClassicalChange={setClassicalText}
              onClassicalCheck={checkClassical}
              twoStepExplanation
              explanationRevealed={!!revealedExplanation[current.id]}
              onRevealExplanation={() => revealExplanation(current.id)}
              onAnswered={(_questionId, _status, optionId) => {
                // matching/classical kendi sonucunu onCheckMatch/onClassicalCheck ile işliyor;
                // optionId sadece çoktan seçmeli/boşluk doldurmada gelir (çift kayıt olmasın).
                if (optionId != null) selectAnswer(optionId);
              }}
            />
          </div>
        </div>

        {/* "Anlamadım, sor" paneli: yorumlar + AI'ya sor (bkz. QuizWithAsk). Kartın içinde,
            sağdan açılan bir çekmece — testten çıkmadan aynı soru hakkında soru sorulabiliyor. */}
        {asideOpen && renderAside && (
          <div className="absolute inset-0 z-20 flex justify-end bg-slate-900/30" onClick={() => setAsideOpen(false)}>
            <div
              role="dialog"
              aria-label={`${index + 1}. soru hakkında`}
              className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-black text-slate-800">{index + 1}. soru hakkında</h3>
                <button
                  type="button"
                  onClick={() => setAsideOpen(false)}
                  aria-label="Paneli kapat"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderAside(current)}</div>
            </div>
          </div>
        )}
      </>,
      {
        stats: (
          <>
            <div className={`text-slate-600 ${PLAYER_BADGE_CLASS}`}>
              {index + 1}/{questions.length}
            </div>
            <div className={PLAYER_BADGE_CLASS}>
              <span className="text-emerald-600">D:{score}</span>{' '}
              <span className="text-rose-500">Y:{wrongCountP}</span>
            </div>
          </>
        ),
        controls: <FontScaleControl fontScale={fontScale} onChange={setFontScale} />,
        footer: (
          <div className={PLAYER_NAV_ROW_CLASS}>
            <button type="button" onClick={goPrev} disabled={index === 0} aria-label="Önceki soru" className={NAV_BTN_CLASS}>
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <QuestionPills
              questions={questions}
              qIndex={index}
              answeredMap={pillStatuses}
              pillStart={pillStart}
              setPillStart={setPillStart}
              onJump={jumpToIndex}
              accentBar={playerAccent.bar}
              isJumpable={(i) => i <= maxIndex}
            />
            {/* Cevaplamadan ilerlemek yok (kayıtlı testte atlama/kopya önlemi, eski davranış). */}
            {isLastP ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!isAnsweredP}
                className="shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-black text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
                style={{ background: `linear-gradient(135deg, ${playerAccent.from}, ${playerAccent.to})` }}
              >
                Bitir ({answeredCount}/{questions.length})
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!isAnsweredP}
                aria-label="Sonraki soru"
                className={NAV_BTN_CLASS}
                style={isAnsweredP ? { background: `linear-gradient(135deg, ${playerAccent.from}, ${playerAccent.to})` } : undefined}
              >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}
          </div>
        ),
      }
    );
  }

  const isAnswered = !!locked[current.id];
  const isCorrect = !!correct[current.id];

  return (
    // Kartın ETRAFI artık SlidePlayer'ın sunum ekranıyla AYNI: koyu, degrade bir "sahne"
    // üstünde ortalanmış, sınırlı genişlikte tek bir beyaz kart — eskiden bu alan QuizModal'ın
    // kendi beyaz panelini uçtan uca dolduruyordu, "slaytta küçük/şık bir kart, testte devasa
    // bir sayfa" farkı buradan geliyordu (kullanıcının 2026-09-24 sert şikayeti: "slaytdaki
    // sorular gibi aynı görünüm olsun"). Üst/alt kontrol şeritleri de SlidePlayer'daki gibi
    // KARTIN İÇİNDE, akışta (absolute değil) tek satır.
    <div
      className="flex h-full min-h-[560px] flex-col items-center justify-center gap-3 p-2 sm:p-6"
      style={{ background: 'radial-gradient(circle at 50% 20%, rgba(129,140,248,0.35), transparent 55%), rgba(15, 23, 42, 0.94)' }}
    >
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: 'min(92vh, 920px)' }}>
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />

        {/* Üst kontrol çubuğu — SlidePlayer'daki eyebrow rozeti + zoom/sayaç/kapat düzenini
            birebir izliyor. */}
        <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <div className="inline-block max-w-full truncate rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-wide text-white shadow-sm">
              {intro ? `Soru ${index + 1}` : scopeLabel}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/90 px-1 py-1 shadow-sm">
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.max(1, Math.round((s - 0.15) * 100) / 100))}
                disabled={fontScale <= 1}
                aria-label="Yazıyı küçült"
                title="Yazıyı küçült"
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-7 px-0.5 text-center text-[9px] sm:text-[10px] font-black text-slate-500 whitespace-nowrap">%{Math.round(fontScale * 100)}</span>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.min(1.9, Math.round((s + 0.15) * 100) / 100))}
                disabled={fontScale >= 1.9}
                aria-label="Yazıyı büyüt"
                title="Yazıyı büyüt (akıllı tahta için)"
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black text-slate-500 shadow-sm">
              {answeredCount}/{questions.length}
            </div>
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                aria-label={exitLabel}
                title={exitLabel}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/60 text-white shadow-sm transition-colors hover:bg-slate-900/80"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            ) : (
              <Link
                href={exitHref}
                aria-label={exitLabel}
                title={exitLabel}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/60 text-white shadow-sm transition-colors hover:bg-slate-900/80"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-4">
        {/* Soru kartı artık SlidePlayer'daki (Slayt Anlatımı) sorularla AYNI, tek paylaşılan
          component'ten (QuestionAnswerKeyItem) geliyor — kullanıcının 2026-09-24 isteği:
          "konu kavrama testinde sorular slayt sayfasındaki gibi görünsün ... hepsi tek
          componentte olsun ki bir değişiklik hepsine yansısın". Süre/oturum/istatistik
          kaydı gibi TÜM canlı test mantığı burada (QuizClient) aynen kalıyor, sadece görsel
          kart paylaşılan component'ten geliyor. Eski ayrı OptionsView/MatchingView/
          ClassicalView kartındaki, slayt tarafında hiç olmayan üç özellik — süre doldu/resume
          kilidi, açık uçlu soruda önce kendi cevabını yazıp SONRA model cevabı görme, iki
          adımlı "Açıklamayı Göster" — kaybolmasın diye QuestionAnswerKeyItem'a yeni opsiyonel
          prop'lar olarak eklendi (bkz. o bileşendeki "Kontrollü mod" yorumu); SlidePlayer
          bunların hiçbirini geçmediği için kendi davranışı bire bir aynı kalıyor. */}
        <div className="mb-2 flex justify-end gap-1 sm:mb-3">
          {user && (
            <button
              type="button"
              onClick={() => void handleToggleSaveQuestion(current)}
              disabled={savingQuestionId === current.id}
              aria-label={savedQuestionIds.has(current.id) ? 'Soruyu notlarımdan çıkar' : 'Soruyu notlarıma kaydet'}
              title={savedQuestionIds.has(current.id) ? 'Notlarımda kayıtlı (çıkarmak için tıkla)' : 'Soruyu notlarıma ve kartıma kaydet'}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                savedQuestionIds.has(current.id) ? 'text-cyan-500' : 'text-muted-foreground hover:bg-white/10 hover:text-indigo-500'
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${savedQuestionIds.has(current.id) ? 'fill-current' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleShare(current)}
            aria-label="Soruyu paylaş"
            title="Soruyu paylaş"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-indigo-500"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label="Soruyu düzenle"
                title="Soruyu düzenle"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-indigo-500"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="Soruyu sil"
                title="Soruyu sil"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {shareState === 'copied' && <p className="mb-2 text-xs font-bold text-emerald-500">Bağlantı kopyalandı!</p>}
        {editSaved && <p className="mb-2 text-xs font-bold text-emerald-500">Kaydedildi — güncel hâli sayfa yenilenince görünür.</p>}

        <QuestionAnswerKeyItem
          key={`${reloadKey}-${current.id}`}
          question={current}
          index={index}
          interactive
          numberBadge="label"
          fontScale={fontScale}
          controlledSelectedId={current.type === 'multiple_choice' || current.type === 'blank' ? selection[current.id] ?? null : undefined}
          controlledAssignment={current.type === 'matching' ? matchAssign[current.id] || {} : undefined}
          onAssignPair={assignMatch}
          onCheckMatch={checkMatching}
          forcedAnswered={isAnswered}
          answeredCorrectly={isAnswered ? isCorrect : undefined}
          feedbackMessage={feedback[current.id]}
          classicalMode="input"
          classicalValue={classicalAnswer[current.id] || ''}
          onClassicalChange={setClassicalText}
          onClassicalCheck={checkClassical}
          twoStepExplanation
          explanationRevealed={!!revealedExplanation[current.id]}
          onRevealExplanation={() => revealExplanation(current.id)}
          onAnswered={(_questionId, _status, optionId) => {
            // matching/classical kendi sonuçlarını onCheckMatch/onClassicalCheck üzerinden
            // zaten işledi (bkz. QuestionAnswerKeyItem) — optionId SADECE çoktan
            // seçmeli/boşluk doldurmada gelir, bu yüzden burada sadece o durumda işlem
            // yapmak çift kayıt/çift puanlamayı önlüyor.
            if (optionId != null) selectAnswer(optionId);
          }}
        />
        </div>

        {/* Alt gezinme çubuğu — SlidePlayer'daki ok + numara şeridiyle AYNI desen: sol/sağ
            yuvarlak ok butonları, ortada cevaplanmış/yanlış/doğru rengine göre boyanan soru
            numaraları. Sağ ok, cevaplanmadan ilerlemeyi engelleyen eski davranışı (disabled={!isAnswered})
            korur — bu, slaytta hiç olmayan ama testte kopya/atlamayı önleyen bilinçli bir kısıt. */}
        <div className="relative z-10 flex shrink-0 items-center justify-center gap-2 px-3 pb-3 pt-1.5 sm:gap-3 sm:px-6 sm:pb-5 sm:pt-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="Önceki soru"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900/60 text-white shadow-sm transition-colors hover:bg-slate-900/80 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {questions.map((q, i) => {
              const isCurrent = i === index;
              const isLocked = !!locked[q.id];
              const isReachable = i <= maxIndex;
              let cls = 'bg-slate-900/10 text-slate-500';
              if (isLocked) cls = q.type === 'classical' ? 'bg-indigo-500 text-white' : correct[q.id] ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white';
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => jumpToIndex(i)}
                  disabled={!isReachable}
                  title={`${i + 1}. Soru`}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cls} ${
                    isCurrent ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={!isAnswered}
            aria-label={index === questions.length - 1 ? 'Sonuçları gör' : 'Sonraki soru'}
            title={index === questions.length - 1 ? 'Sonuçları gör' : 'Sonraki soru'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
          >
            {index === questions.length - 1 ? <Trophy className="h-4 w-4" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {adminLayers}
    </div>
  );
}

