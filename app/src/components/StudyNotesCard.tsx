'use client';

// Öğrencinin kaydettiği/paylaştığı ders notları, sorular ve konular için TEK ortak bileşen
// (bkz. GEMINI.md Kural 5: hem /uye/[slug] hem /profil sayfasında aynı görsel ve mobil düzende kullanılır).
// Tasarım dili: Twitter/X Repost mantığında modern Çalışma Akışı (Study Feed).
//   - Üstte ince sosyal paylaşım şeridi: avatar + isim + eylem + göreceli zaman (asıl kaynakla karışmaz)
//   - Ortada DersTakip kaynaklı gömülü (embed) içerik kartı:
//       * Ders Notu: RecapCardView renk dili + uzun notlarda "Devamını oku"
//       * Şıklı / Boşluk Doldurma Soru: Doğrudan kart içinde çözülür, SRS uyumlu (next_review_at > now ise son cevap + tekrar zamanı gösterilir; zamanı geldiğinde/ilk çözümde sunucu kontrollü istatistik + SRS kaydı yapılır)
//       * Klasik Soru: "Örnek cevabı gör" (açılır/kapanır, sıfır AI maliyeti) + "Soruyu çöz →"
//       * Konu: Modern önizleme (embed) kartı
import Link from 'next/link';
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Lock,
  Repeat2,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { useAuth } from '@/app/src/context/AuthContext';
import {
  submitProfileQuestionAnswer,
  type SavedItemKind,
  type SavedQuestionPayload,
  type SavedStudyItem,
} from '@/app/src/lib/savedStudyItems';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import r from './robotic/robotic.module.css';

type FilterTab = 'all' | SavedItemKind;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const noopSubscribe = () => () => {};

export interface StudyNotesAuthor {
  displayName: string;
  avatarUrl?: string | null;
  initials: string;
}

const KIND_META: Record<
  SavedItemKind,
  {
    label: string;
    actionLabel: string;
    repostVerb: string;
    privateVerb: string;
    Icon: typeof FileText;
    badgeCls: string;
  }
> = {
  note: {
    label: 'Ders Notu',
    actionLabel: 'Konuya git',
    repostVerb: 'bir ders notu paylaştı',
    privateVerb: 'bir ders notu kaydetti',
    Icon: FileText,
    badgeCls: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  question: {
    label: 'Soru',
    actionLabel: 'Soruyu çöz',
    repostVerb: 'bir soru öne çıkardı',
    privateVerb: 'bir soru kaydetti',
    Icon: HelpCircle,
    badgeCls: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  topic: {
    label: 'Konu',
    actionLabel: 'Konuyu çalış',
    repostVerb: 'bir konu paylaştı',
    privateVerb: 'bir konu kaydetti',
    Icon: BookOpen,
    badgeCls: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
};

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    'tr-TR',
    sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }
  );
}

function formatNextReviewLabel(iso: string | null): string | null {
  if (!iso) return null;
  const targetMs = Date.parse(iso);
  if (Number.isNaN(targetMs)) return null;
  const diffMs = targetMs - Date.now();
  if (diffMs <= 0) return null;
  const hours = Math.ceil(diffMs / 3_600_000);
  if (hours < 24) return `${hours} saat sonra`;
  const days = Math.ceil(diffMs / 86_400_000);
  if (days === 1) return 'yarın';
  return `${days} gün sonra`;
}

function readGuestChoice(questionId: number): number | null {
  try {
    const raw = window.localStorage.getItem(`dt-feed-q-${questionId}`);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeGuestChoice(questionId: number, choiceId: number) {
  try {
    window.localStorage.setItem(`dt-feed-q-${questionId}`, String(choiceId));
  } catch {
    // Gizli sekme veya storage kısıtı — sessizce geç
  }
}

// Satır içindeki **kalın kavramları** (ve düz kayıtlardaki kısa "Kavram, ...dır" / "Kavram: ..." girişlerini)
// konu sayfasındaki RecapCardView ile birebir aynı mor-pembe (#A21CAF / dark:#F0ABFC) renkle vurgular.
function renderRichInline(text: string, autoTermHighlight = false): React.ReactNode {
  if (text.includes('**')) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={idx} className="font-bold text-[#A21CAF] dark:text-[#F0ABFC]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  }

  if (autoTermHighlight) {
    const colonMatch = text.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü0-9 ()/-]{2,36}):\s+([\s\S]+)$/);
    if (colonMatch) {
      return (
        <>
          <strong className="font-bold text-[#A21CAF] dark:text-[#F0ABFC]">{colonMatch[1]}:</strong>{' '}
          {colonMatch[2]}
        </>
      );
    }
    const commaDefMatch = text.match(/^([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü]{1,22}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,22}){0,2}),\s+([\s\S]+)$/);
    if (commaDefMatch) {
      return (
        <>
          <strong className="font-bold text-[#A21CAF] dark:text-[#F0ABFC]">{commaDefMatch[1]}</strong>,{' '}
          {commaDefMatch[2]}
        </>
      );
    }
  }

  return text;
}

function parseNoteLines(text: string): { lines: string[]; hasExplicitMarkup: boolean } {
  const rawLines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const lines =
    rawLines.length === 1 && !rawLines[0].includes('**') && !rawLines[0].startsWith('###')
      ? (() => {
          const sentences = rawLines[0]
            .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/)
            .map((s) => s.trim())
            .filter(Boolean);
          return sentences.length >= 2 ? sentences.map((s) => `• ${s}`) : rawLines;
        })()
      : rawLines;

  const hasExplicitMarkup =
    text.includes('**') || text.includes('### ') || text.includes('!NOT:') || text.includes('!DİKKAT:');

  return { lines, hasExplicitMarkup };
}

function FormattedNoteBody({
  text,
  expanded,
  onToggleExpand,
}: {
  text: string;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { lines, hasExplicitMarkup } = useMemo(() => parseNoteLines(text), [text]);
  const isLong = lines.length > 5 || text.length > 340;
  const collapsed = isLong && !expanded;

  return (
    <div className="flex flex-col gap-2">
      <div className={`relative flex flex-col gap-2.5 ${collapsed ? 'max-h-48 overflow-hidden' : ''}`}>
        {lines.map((line, i) => {
          if (line.startsWith('### ')) {
            return (
              <p
                key={i}
                className="border-l-[3px] border-[#3B5BFD] pl-2.5 text-[13.5px] font-extrabold leading-snug text-[#1E3A8A] dark:border-[#7C93FF] dark:text-[#C7D2FE] sm:text-sm"
              >
                {line.slice(4)}
              </p>
            );
          }

          if (line.startsWith('!NOT:')) {
            const content = line.slice(5).trim();
            return (
              <div
                key={i}
                className="rounded-xl border border-[#FDBA74] bg-[#FFF4E5] px-3 py-2 text-xs leading-relaxed text-slate-800 dark:border-orange-400/40 dark:bg-orange-400/12 dark:text-slate-100 sm:text-[13.5px]"
              >
                <b className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-[#C2410C] dark:text-orange-300">
                  Not
                </b>
                {renderRichInline(content)}
              </div>
            );
          }

          if (line.startsWith('!DİKKAT:')) {
            const content = line.slice(8).trim();
            return (
              <div
                key={i}
                className="rounded-xl border border-[#FCA5A5] bg-[#FEEFEF] px-3 py-2 text-xs leading-relaxed text-slate-800 dark:border-rose-400/40 dark:bg-rose-400/12 dark:text-slate-100 sm:text-[13.5px]"
              >
                <b className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-[#B91C1C] dark:text-rose-300">
                  Dikkat
                </b>
                {renderRichInline(content)}
              </div>
            );
          }

          if (line.startsWith('!ÖRNEK:')) {
            const content = line.slice(7).trim();
            return (
              <div
                key={i}
                className="rounded-xl border border-[#86EFAC] bg-[#ECF8F0] px-3 py-2 text-xs leading-relaxed text-slate-800 dark:border-emerald-400/35 dark:bg-emerald-400/10 dark:text-slate-100 sm:text-[13.5px]"
              >
                <b className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-[#15803D] dark:text-emerald-300">
                  Örnek
                </b>
                {renderRichInline(content)}
              </div>
            );
          }

          if (line.startsWith('• ')) {
            const bulletBody = line.slice(2).trim();
            return (
              <div key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-default sm:text-[14.5px]">
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B5BFD] dark:bg-[#7C93FF]"
                />
                <span>{renderRichInline(bulletBody, !hasExplicitMarkup)}</span>
              </div>
            );
          }

          return (
            <p key={i} className="text-[13.5px] leading-relaxed text-default sm:text-[14.5px]">
              {renderRichInline(line, !hasExplicitMarkup)}
            </p>
          );
        })}

        {collapsed && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-[#1B2434] dark:via-[#1B2434]/85"
          />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className={`inline-flex w-fit items-center gap-1 text-xs font-bold hover:underline ${r.accent}`}
        >
          {expanded ? (
            <>
              Daha az göster
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              Devamını oku
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// Profil akışı içinde doğrudan soru çözme bileşeni (SRS uyumlu + klasik örnek cevap destekli).
function InlineQuestionBody({
  question,
  fallbackExcerpt,
  displayHeading,
}: {
  question: SavedQuestionPayload | null;
  fallbackExcerpt: string | null;
  displayHeading: string | null;
}) {
  const { user, supabase } = useAuth();
  const [localPick, setLocalPick] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recordedNotice, setRecordedNotice] = useState<string | null>(null);
  const [overrideNextReview, setOverrideNextReview] = useState<string | null>(null);
  const [showClassicalAnswer, setShowClassicalAnswer] = useState(false);

  const guestStoredPick = useSyncExternalStore(
    noopSubscribe,
    () => (question && !user ? readGuestChoice(question.questionId) : null),
    () => null
  );

  // Eski RPC veya şıksız/SVG'li karmaşık soru: temiz önizleme kartı
  if (!question || question.questionType === 'other') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border-l-[3px] border-indigo-500 bg-indigo-500/[0.04] px-3.5 py-2.5 dark:border-indigo-400 dark:bg-indigo-400/[0.07]">
        {displayHeading && <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{displayHeading}</p>}
        {(question?.questionText || fallbackExcerpt) && (
          <MathText
            as="p"
            text={question?.questionText || fallbackExcerpt || ''}
            className="text-[14px] font-medium leading-relaxed text-default sm:text-[15px]"
          />
        )}
      </div>
    );
  }

  // Klasik (açık uçlu) soru: metin + "Örnek cevabı gör" (sıfır AI maliyeti, flashcard deneyimi)
  if (question.questionType === 'classical') {
    const answerText = question.modelAnswer || question.solutionText;
    return (
      <div className="flex flex-col gap-3">
        {question.passage && (
          <div className="rounded-xl border border-[var(--edge)] bg-[var(--bg)]/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            <MathText as="p" text={question.passage} />
          </div>
        )}

        <div className="rounded-xl border-l-[3px] border-indigo-500 bg-indigo-500/[0.04] px-3.5 py-2.5 dark:border-indigo-400 dark:bg-indigo-400/[0.07]">
          <MathText
            as="p"
            text={question.questionText}
            className="text-[14.5px] font-semibold leading-relaxed text-default sm:text-[15.5px]"
          />
        </div>

        {answerText && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowClassicalAnswer((v) => !v)}
              aria-expanded={showClassicalAnswer}
              className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[var(--edge)] bg-[var(--bg)]/70 px-3 py-1.5 text-xs font-bold text-default transition-colors hover:border-[var(--neon)]"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              {showClassicalAnswer ? 'Örnek cevabı gizle' : 'Örnek cevabı gör'}
              {showClassicalAnswer ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            {showClassicalAnswer && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-default sm:text-[13.5px]">
                <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Örnek Cevap
                </span>
                <MathText as="p" text={answerText} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Çoktan seçmeli / Boşluk doldurma soru — SRS uyumlu doğrudan çözüm
  const activeNextReview = overrideNextReview ?? question.srs?.nextReviewAt ?? null;
  const nextReviewLabel = formatNextReviewLabel(activeNextReview);
  const srsLocked = Boolean(user && question.srs && nextReviewLabel && localPick === null);
  const isDueForReview = Boolean(user && question.srs && !nextReviewLabel && localPick === null);

  const pickedId =
    localPick ?? (srsLocked ? question.srs?.selectedOptionId ?? null : !user ? guestStoredPick : null);
  const hasAnswered = srsLocked || (pickedId != null && question.choices.some((c) => c.id === pickedId));

  const pickedChoice = pickedId != null ? question.choices.find((c) => c.id === pickedId) : null;
  const isCorrect = pickedChoice
    ? pickedChoice.isCorrect
    : srsLocked
      ? Boolean(question.srs?.lastAnswerCorrect)
      : false;

  const handlePick = async (choiceId: number) => {
    if (hasAnswered || submitting) return;
    setLocalPick(choiceId);

    if (!user) {
      writeGuestChoice(question.questionId, choiceId);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitProfileQuestionAnswer(supabase, {
        questionId: question.questionId,
        selectedOptionId: choiceId,
      });
      if (res) {
        if (res.nextReviewAt) setOverrideNextReview(res.nextReviewAt);
        if (res.recorded) {
          const nextLbl = formatNextReviewLabel(res.nextReviewAt);
          setRecordedNotice(
            nextLbl
              ? `İstatistiğine ve SRS'e işlendi · Tekrar: ${nextLbl}`
              : "İstatistiğine ve SRS'e işlendi"
          );
        } else if (res.reason === 'not_due') {
          const nextLbl = formatNextReviewLabel(res.nextReviewAt);
          setRecordedNotice(
            nextLbl ? `Tekrar zamanı henüz gelmedi · Tekrar: ${nextLbl}` : 'Tekrar zamanı henüz gelmedi'
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Tekrar zamanı geldiyse motive edici mikro etiket */}
      {isDueForReview && (
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Tekrar zamanı geldi — yeniden çöz!
        </div>
      )}

      {/* SRS kilidi varsa (tekrar zamanı henüz gelmemişse) üst durum bandı */}
      {srsLocked && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
            isCorrect
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {isCorrect ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {isCorrect ? 'Son çözümünde doğru bildin' : 'Son çözümünde yanlış yaptın'}
          </span>
          {nextReviewLabel && (
            <span className="inline-flex items-center gap-1 text-[11px] opacity-90">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Tekrar: {nextReviewLabel}
            </span>
          )}
        </div>
      )}

      {/* Varsa kısa okuma parçası / pasaj */}
      {question.passage && (
        <div className="rounded-xl border border-[var(--edge)] bg-[var(--bg)]/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
          <MathText as="p" text={question.passage} />
        </div>
      )}

      {/* Soru metni */}
      <MathText
        as="p"
        text={question.questionText}
        className="text-[14.5px] font-semibold leading-relaxed text-default sm:text-[15.5px]"
      />

      {/* Şıklar */}
      <div className="flex flex-col gap-2" role="group" aria-label="Şıklar">
        {question.choices.map((choice, idx) => {
          const isPicked = choice.id === pickedId;
          const state = !hasAnswered ? 'idle' : choice.isCorrect ? 'correct' : isPicked ? 'wrong' : 'muted';
          const cls =
            state === 'correct'
              ? 'border-emerald-500 bg-emerald-500/10 text-default'
              : state === 'wrong'
                ? 'border-rose-500 bg-rose-500/10 text-default'
                : state === 'muted'
                  ? 'border-[var(--edge)] bg-[var(--bg)]/40 text-muted-foreground opacity-75'
                  : 'border-[var(--edge)] bg-[var(--bg)]/45 text-default hover:border-indigo-400 hover:bg-indigo-500/[0.06] cursor-pointer';

          return (
            <button
              key={choice.id}
              type="button"
              disabled={hasAnswered || submitting}
              onClick={() => void handlePick(choice.id)}
              aria-pressed={isPicked}
              className={`flex min-h-10 w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] leading-snug transition-colors sm:text-sm ${cls}`}
            >
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${
                  state === 'correct'
                    ? 'bg-emerald-500 text-white'
                    : state === 'wrong'
                      ? 'bg-rose-500 text-white'
                      : 'border border-[var(--edge)] bg-[var(--panel-solid)] text-muted-foreground'
                }`}
              >
                {LETTERS[idx] ?? idx + 1}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <MathText as="span" text={choice.text} />
              </span>
              {state === 'correct' && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              )}
              {state === 'wrong' && (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Yeni cevap dönütü + SRS kaydı bilgisi */}
      {localPick !== null && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
            isCorrect
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{isCorrect ? 'Harika, doğru cevap!' : 'Yanlış cevap — doğru şıkkı incele.'}</span>
          {recordedNotice && <span className="text-[11px] opacity-90">{recordedNotice}</span>}
        </div>
      )}

      {/* Çözüm açıklaması (yalnız cevaplandıktan sonra açılır — spoiler vermez) */}
      {hasAnswered && question.solutionText && (
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-default sm:text-[13.5px]">
          <span className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            Çözüm
          </span>
          <MathText as="p" text={question.solutionText} />
        </div>
      )}

      {/* Misafir kullanıcıya giriş daveti */}
      {hasAnswered && !user && (
        <p className="text-[11.5px] text-muted-foreground">
          İstatistiklerin ve SRS tekrarların kaydedilsin diye{' '}
          <Link href="/login" className={`font-bold hover:underline ${r.accent}`}>
            giriş yap
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export interface StudyNotesCardProps {
  items: SavedStudyItem[] | null;
  isOwner: boolean;
  author?: StudyNotesAuthor;
  title?: string;
  headingId?: string;
  emptyBrowseHref?: string;
  onDelete?: (id: number) => void;
  onTogglePublic?: (id: number, nextPublic: boolean) => void;
}

export function StudyNotesCard({
  items,
  isOwner,
  author,
  title = 'Ders Notları ve Paylaşımlar',
  headingId = 'ders-notlarim',
  emptyBrowseHref = '/ders',
  onDelete,
  onTogglePublic,
}: StudyNotesCardProps) {
  const [tab, setTab] = useState<FilterTab>('all');
  const [lessonFilter, setLessonFilter] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [failedAvatar, setFailedAvatar] = useState(false);

  const counts = useMemo(() => {
    const base = { all: 0, note: 0, question: 0, topic: 0 };
    if (!items) return base;
    base.all = items.length;
    for (const it of items) base[it.kind] += 1;
    return base;
  }, [items]);

  const lessons = useMemo(() => {
    if (!items) return [];
    const set = new Set<string>();
    for (const it of items) {
      if (it.lessonName) set.add(it.lessonName);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((it) => {
      if (tab !== 'all' && it.kind !== tab) return false;
      if (lessonFilter !== 'all' && it.lessonName !== lessonFilter) return false;
      return true;
    });
  }, [items, tab, lessonFilter]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tümü', count: counts.all },
    { key: 'note', label: 'Notlar', count: counts.note },
    { key: 'question', label: 'Sorular', count: counts.question },
    { key: 'topic', label: 'Konular', count: counts.topic },
  ];

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShareItem = async (it: SavedStudyItem) => {
    const url =
      typeof window !== 'undefined'
        ? new URL(it.href, window.location.origin).toString()
        : `https://www.derstakip.net${it.href}`;
    const heading = it.sectionHeading || it.topicTitle || it.lessonName || 'DersTakip';
    const shareTitle = `${heading} · DersTakip`;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: shareTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiedId(it.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === it.id ? null : cur)), 2200);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(it.id);
        window.setTimeout(() => setCopiedId((cur) => (cur === it.id ? null : cur)), 2200);
      } catch {
        // Kopyalama desteklenmiyorsa sessizce geç
      }
    }
  };

  const showAuthorAvatar = Boolean(author?.avatarUrl && !failedAvatar);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3.5">
      {/* Bölüm Başlığı */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className={`text-lg font-bold tracking-tight text-default uppercase sm:text-xl ${r.display}`}>
          {title}
        </h2>
        {items && <span className={r.badge}>{items.length} paylaşım</span>}
      </div>

      {items === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Paylaşımlar yükleniyor">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-[var(--edge)] bg-[var(--panel-solid)]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={`flex flex-col items-start gap-2.5 p-5 ${r.panel}`}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isOwner
              ? 'Henüz kayıtlı ders notun, sorun veya konun yok. Konu anlatımında önemli bir cümleyi seçip "Notlarıma Kaydet" diyebilir ya da beğendiğin konu ve soruları kaydedebilirsin.'
              : 'Bu üye henüz herkese açık bir ders notu, konu veya soru paylaşmamış.'}
          </p>
          {isOwner && (
            <Link
              href={emptyBrowseHref}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold ${r.btnGhost}`}
            >
              Ders içeriklerine git
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Sade Filtre Çubuğu (dış panel ağırlığı olmadan) */}
          <div className="flex flex-col gap-2">
            <div className={r.tabs} role="tablist" aria-label="Paylaşım türü">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`${r.tab} ${tab === t.key ? r.tabActive : ''}`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            {lessons.length > 1 && (
              <div
                className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]"
                role="group"
                aria-label="Ders filtresi"
              >
                <button
                  type="button"
                  aria-pressed={lessonFilter === 'all'}
                  onClick={() => setLessonFilter('all')}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    lessonFilter === 'all'
                      ? `${r.neonBorder} ${r.tint}`
                      : 'border-[var(--edge)] bg-[var(--panel-solid)] text-muted-foreground hover:text-default'
                  }`}
                >
                  Tüm dersler
                </button>
                {lessons.map((lesson) => {
                  const st = subjectStyle(lesson);
                  const active = lessonFilter === lesson;
                  return (
                    <button
                      key={lesson}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLessonFilter(lesson)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? `${r.neonBorder} ${r.tint}`
                          : 'border-[var(--edge)] bg-[var(--panel-solid)] text-muted-foreground hover:text-default'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${st.bar}`} aria-hidden="true" />
                      {lesson}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bağımsız Akış Kartları (Twitter / X Repost Mantığı) */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-[var(--edge)] bg-[var(--panel-solid)] p-6 text-center text-sm text-muted-foreground">
              Bu filtrede paylaşım bulunmuyor.
            </div>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {filtered.map((it) => {
                const meta = KIND_META[it.kind];
                const KindIcon = meta.Icon;
                const subj = subjectStyle(it.lessonName ?? '');
                const SubjIcon = subj.Icon;
                const subPath = [it.unitTitle, it.topicTitle].filter(Boolean).join(' › ');
                const displayHeading =
                  it.sectionHeading && it.sectionHeading !== it.topicTitle ? it.sectionHeading : it.topicTitle;
                const relTime = formatRelativeTime(it.createdAt);
                const fullDate = formatFullDate(it.createdAt);
                const isExpanded = expandedIds.has(it.id);
                const isCopied = copiedId === it.id;
                const questionActionLabel =
                  it.kind === 'question' &&
                  it.question &&
                  (it.question.questionType === 'multiple_choice' || it.question.questionType === 'blank')
                    ? 'Soru bankasında aç'
                    : meta.actionLabel;

                return (
                  <li key={it.id}>
                    <article className="flex flex-col gap-3 rounded-2xl border border-[var(--edge)] bg-[var(--panel-solid)] p-4 shadow-[0_6px_22px_-16px_rgba(15,23,42,0.35)] transition-colors hover:border-[color-mix(in_srgb,var(--neon)_45%,var(--edge))] sm:p-5">
                      {/* 1. SOSYAL PAYLAŞIM ŞERİDİ (X / Repost başlığı — kim paylaştı + ne zaman) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          {author ? (
                            <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--edge)] bg-[var(--bg)] text-[10px] font-extrabold text-default">
                              {showAuthorAvatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={author.avatarUrl!}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  onError={() => setFailedAvatar(true)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                author.initials
                              )}
                            </span>
                          ) : (
                            <Repeat2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}

                          <p className="min-w-0 truncate leading-snug">
                            {author && <strong className="font-bold text-default">{author.displayName}</strong>}{' '}
                            <span>{it.isPublic ? meta.repostVerb : meta.privateVerb}</span>
                            <span aria-hidden="true"> · </span>
                            <time dateTime={it.createdAt} title={fullDate} className="whitespace-nowrap">
                              {relTime}
                            </time>
                          </p>

                          {!it.isPublic && isOwner && (
                            <span
                              title="Yalnızca sen görebilirsin"
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--edge)] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                            >
                              <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Gizli</span>
                            </span>
                          )}
                        </div>

                        {isOwner && (
                          <div className="flex shrink-0 items-center gap-1">
                            {onTogglePublic && (
                              <button
                                type="button"
                                onClick={() => onTogglePublic(it.id, !it.isPublic)}
                                title={
                                  it.isPublic
                                    ? 'Profilinde herkese açık (gizlemek için tıkla)'
                                    : 'Yalnızca sen görüyorsun (profilinde paylaşmak için tıkla)'
                                }
                                aria-label={it.isPublic ? 'Profilden gizle' : 'Profilde paylaş'}
                                className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
                                  it.isPublic
                                    ? `${r.neonBorder} ${r.tint}`
                                    : 'border-[var(--edge)] text-muted-foreground hover:text-default'
                                }`}
                              >
                                {it.isPublic ? (
                                  <Eye className="h-3 w-3" aria-hidden="true" />
                                ) : (
                                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                                )}
                                <span className="hidden sm:inline">{it.isPublic ? 'Paylaşımda' : 'Gizli'}</span>
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() => onDelete(it.id)}
                                title="Kaydı sil"
                                aria-label="Kaydı sil"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. GÖMÜLÜ KAYNAK KARTI (DersTakip içeriği — asıl kaynak net görünür) */}
                      <div className="relative overflow-hidden rounded-2xl border border-[var(--edge)] bg-white/95 dark:bg-[#1B2434]">
                        {/* Dersin kimlik renginde ince üst vurgu */}
                        <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${subj.bar}`} aria-hidden="true" />

                        <div className="flex flex-col gap-3 p-3.5 pt-4 sm:p-4 sm:pt-4.5">
                          {/* Kaynak Meta Satırı: Ders İkonu + Ders · Sınıf + Tür */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${subj.chip}`}
                                aria-hidden="true"
                              >
                                <SubjIcon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-bold text-default">
                                  {it.lessonName && <span className="truncate">{it.lessonName}</span>}
                                  {it.lessonName && it.gradeName && (
                                    <span className="text-muted-foreground" aria-hidden="true">
                                      ·
                                    </span>
                                  )}
                                  {it.gradeName && <span className="font-semibold text-muted-foreground">{it.gradeName}</span>}
                                </div>
                                {subPath && (
                                  <p className="truncate text-[11px] font-medium text-muted-foreground" title={subPath}>
                                    {subPath}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${meta.badgeCls}`}
                            >
                              <KindIcon className="h-3 w-3" aria-hidden="true" />
                              {it.kind === 'question' && it.question?.questionType === 'classical'
                                ? 'Klasik Soru'
                                : meta.label}
                            </span>
                          </div>

                          {/* Türe Göre İçerik Gövdesi */}
                          {it.kind === 'note' ? (
                            <div className="flex flex-col gap-2.5">
                              {displayHeading && (
                                <h3
                                  className={`text-[15px] font-extrabold leading-snug text-[#1E3A8A] dark:text-[#C7D2FE] sm:text-base ${r.display}`}
                                >
                                  {displayHeading}
                                </h3>
                              )}
                              {it.excerpt && (
                                <FormattedNoteBody
                                  text={it.excerpt}
                                  expanded={isExpanded}
                                  onToggleExpand={() => toggleExpand(it.id)}
                                />
                              )}
                            </div>
                          ) : it.kind === 'question' ? (
                            <InlineQuestionBody
                              question={it.question}
                              fallbackExcerpt={it.excerpt}
                              displayHeading={displayHeading}
                            />
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {displayHeading && (
                                <h3
                                  className={`text-[15.5px] font-extrabold leading-snug text-[#1E3A8A] dark:text-[#C7D2FE] sm:text-[16.5px] ${r.display}`}
                                >
                                  {displayHeading}
                                </h3>
                              )}
                              {it.excerpt && (
                                <p className="line-clamp-3 text-[13.5px] leading-relaxed text-muted-foreground sm:text-sm">
                                  {renderRichInline(it.excerpt)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3. SADE SOSYAL AKSİYON ÇUBUĞU (Footer) */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => void handleShareItem(it)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] hover:text-default"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                              <span className="text-emerald-600 dark:text-emerald-400">Bağlantı kopyalandı</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Paylaş</span>
                            </>
                          )}
                        </button>

                        <Link
                          href={it.href}
                          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-xs font-bold transition-colors hover:border-[var(--neon)] hover:bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] ${r.accent}`}
                        >
                          {questionActionLabel}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
