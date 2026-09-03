'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Eye, Loader2, Pencil, RotateCcw, Share2, Trash2, Trophy, XCircle } from 'lucide-react';
import type { QuizQuestion, MultipleChoiceQuestion, BlankQuestion, MatchingQuestion, ClassicalQuestion, Pair } from '@/app/src/lib/quizQuestions';
import { useAuth } from '@/app/src/context/AuthContext';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { QuizQuestionEditModal } from '@/app/src/components/admin/QuizQuestionEditModal';

const CORRECT_MESSAGES = [
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

const INCORRECT_MESSAGES = ['Olsun, öğrenmenin bir parçası! 🌱', 'Az kalsın, bir dahakine yakalarsın 💪', 'Sorun değil, doğrusuna bakalım 👇', 'Bu sefer olmadı ama devam! ✨'];

export const TYPE_LABELS: Record<QuizQuestion['type'], string> = {
  multiple_choice: 'Çoktan Seçmeli',
  blank: 'Boşluk Doldurma',
  matching: 'Eşleştirme',
  classical: 'Açık Uçlu',
};

function randomOf(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Soru başına geri sayım — çağıran taraf bunu her soru için `key={question.id}` ile
// mount ediyor, böylece her yeni soruda süre kendiliğinden sıfırdan başlıyor (React'in
// "prop değişince state'i resetle" için önerdiği key deseni), ayrı bir reset efekti
// gerekmiyor. Soru cevaplanınca (isAnswered) bu bileşen unmount edilir, interval da
// otomatik temizlenir.
function QuestionTimer({ seconds, onTimeout }: { seconds: number; onTimeout: () => void }) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono ${timeLeft <= 10 ? 'border-rose-400/50 text-rose-500' : 'border-default text-default'}`}>
      <Clock className="h-3 w-3" /> {formatTime(timeLeft)}
    </span>
  );
}

export function QuestionSvg({ svgContent }: { svgContent: string | null }) {
  // sanitizeMathSvg (DOMPurify) window/DOM gerektirir; bu bileşen /soru-bankasi gibi
  // SSR sayfalarında da render edildiği için temizlemeyi sunucu tarafında DEĞİL, mount
  // sonrası client'ta yapıyoruz (bkz. SectionContent.tsx'teki aynı desen) — aksi halde
  // sunucuda "window is not defined" ile sayfa 500 verir.
  const [clean, setClean] = useState<string | null>(null);

  useEffect(() => {
    setClean(svgContent ? sanitizeMathSvg(svgContent) : null);
  }, [svgContent]);

  if (!clean) return null;
  return (
    <div
      role="img"
      className="mb-4 rounded-xl border border-default bg-white p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-xs"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export function OptionsView({
  question,
  selectedId,
  locked,
  onSelect,
}: {
  question: MultipleChoiceQuestion | BlankQuestion;
  selectedId: number | undefined;
  locked: boolean;
  onSelect: (optionId: number) => void;
}) {
  const options = question.type === 'multiple_choice' ? question.choices : question.options;
  const svg = <QuestionSvg svgContent={question.svg_content} />;

  return (
    <>
      {question.svg_position !== 'below' && svg}
      {question.type === 'blank' ? (
        <p className="mb-5 text-base font-black leading-snug text-default sm:text-lg">
          {question.question_text.split('_____').map((part, i, arr) => (
            <Fragment key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className="mx-1 inline-block min-w-[90px] rounded-lg border-2 border-dashed border-indigo-400/50 bg-indigo-500/10 px-2.5 py-0.5 text-center text-indigo-500">
                  {selectedId ? options.find((o) => o.id === selectedId)?.text : '…'}
                </span>
              )}
            </Fragment>
          ))}
        </p>
      ) : (
        <p className="mb-5 text-base font-black leading-snug text-default sm:text-lg">{question.question_text}</p>
      )}
      {question.svg_position === 'below' && svg}

      <div className="space-y-2.5">
        {options.map((opt) => {
          const isChosen = selectedId === opt.id;
          let stateClasses = 'border-default bg-surface hover:border-indigo-400/50 hover:bg-indigo-500/5';
          if (locked) {
            if (opt.is_correct) stateClasses = 'border-emerald-400/60 bg-emerald-500/10';
            else if (isChosen) stateClasses = 'border-rose-400/60 bg-rose-500/10';
            else stateClasses = 'border-default bg-surface opacity-60';
          }
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              disabled={locked}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-bold text-default transition-colors disabled:cursor-default ${stateClasses}`}
            >
              <span>{opt.text}</span>
              {locked && opt.is_correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
              {locked && isChosen && !opt.is_correct && <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function MatchingView({
  question,
  assignment,
  locked,
  onAssign,
  onCheck,
}: {
  question: MatchingQuestion;
  assignment: Record<number, number>;
  locked: boolean;
  onAssign: (leftId: number, rightId: number) => void;
  onCheck: () => void;
}) {
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const rightItems = useMemo(() => shuffle<Pair>(question.pairs), [question]);
  const rightTextById = useMemo(() => new Map(question.pairs.map((p) => [p.id, p.right_text])), [question]);
  const allAssigned = Object.keys(assignment).length === question.pairs.length;
  const assignedRightIds = new Set(Object.values(assignment));

  return (
    <div>
      <p className="mb-4 text-xs font-bold text-muted-foreground">
        Önce soldan bir kavram seç, sonra sağdan eşini işaretle. Kontrol etmeden önce istediğin eşleşmeyi değiştirebilirsin.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {question.pairs.map((pair) => {
            const assignedTo = assignment[pair.id];
            // Doğru/yanlış rengi sadece kilitlendikten (Cevabımı Kontrol Et'e basıldıktan)
            // SONRA gösterilir — kullanıcı bir eşleşme yaptığı anda "doğru/yanlış" denmez,
            // sadece nötr bir "eşleşti" göstergesi görür.
            const isCorrect = locked && assignedTo != null && assignedTo === pair.id;
            const isWrong = locked && assignedTo != null && assignedTo !== pair.id;
            const isMatched = !locked && assignedTo != null;
            // isCorrect/isWrong kilitlenmeden önce hep false olduğu için bu sıralama
            // güvenli: kilitlenmeden önce hâlâ activeLeft/isMatched'e düşer, kilitlendikten
            // sonra ise doğru/yanlış rengi "son seçilen" mavi rengin önüne geçer (aksi halde
            // son tıklanan sol öğe kilitli halde bile mavi kalıp doğru/yanlış belli olmuyordu).
            let cls = 'border-default bg-surface';
            if (isCorrect) cls = 'border-emerald-400/60 bg-emerald-500/10';
            else if (isWrong) cls = 'border-rose-400/60 bg-rose-500/10';
            else if (activeLeft === pair.id) cls = 'border-indigo-400 bg-indigo-500/10';
            else if (isMatched) cls = 'border-indigo-300/50 bg-indigo-500/5';
            return (
              <button
                key={pair.id}
                type="button"
                disabled={locked}
                onClick={() => setActiveLeft(pair.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-bold text-default transition-colors disabled:cursor-default ${cls}`}
              >
                <span className="block">{pair.left_text}</span>
                {isMatched && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-500">
                    <CheckCircle2 className="h-3 w-3 shrink-0" /> {rightTextById.get(assignedTo)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rightItems.map((pair) => {
            const used = assignedRightIds.has(pair.id);
            return (
              <button
                key={pair.id}
                type="button"
                disabled={locked || activeLeft == null}
                onClick={() => activeLeft != null && onAssign(activeLeft, pair.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors disabled:cursor-default ${
                  used ? 'border-indigo-300/50 bg-indigo-500/5 text-muted-foreground' : 'border-default bg-surface text-default hover:border-indigo-400/50 hover:bg-indigo-500/5'
                } ${activeLeft == null && !locked ? 'opacity-60' : ''}`}
              >
                {pair.right_text}
              </button>
            );
          })}
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

export function ClassicalView({
  question,
  value,
  locked,
  explanationRevealed,
  onChange,
  onCheck,
  onRevealExplanation,
}: {
  question: ClassicalQuestion;
  value: string;
  locked: boolean;
  explanationRevealed: boolean;
  onChange: (value: string) => void;
  onCheck: () => void;
  onRevealExplanation: () => void;
}) {
  return (
    <div>
      {question.svg_position !== 'below' && <QuestionSvg svgContent={question.svg_content} />}
      <p className="mb-3 text-base font-black leading-snug text-default sm:mb-5 sm:text-lg">{question.question_text}</p>
      {question.svg_position === 'below' && <QuestionSvg svgContent={question.svg_content} />}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
        className="h-28 w-full resize-none rounded-xl border border-default bg-surface p-3 text-sm text-default placeholder:text-muted-foreground focus:border-indigo-400 focus:outline-none disabled:opacity-70 sm:h-40 sm:p-4 sm:text-base"
        placeholder="Cevabını buraya yaz..."
      />
      <p className="mt-1.5 text-xs font-bold text-muted-foreground">{value.length} karakter</p>
      {!locked && (
        <button
          type="button"
          onClick={onCheck}
          disabled={value.trim().length < 5}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cevabımı Kontrol Et
        </button>
      )}
      {locked && !explanationRevealed && (
        <button
          type="button"
          onClick={onRevealExplanation}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-500/10 py-3 text-sm font-black text-indigo-500 transition-colors hover:bg-indigo-500/20"
        >
          <Eye className="h-4 w-4" /> Model Cevabı Göster
        </button>
      )}
      {locked && explanationRevealed && (
        <div className="mt-3 rounded-xl border border-indigo-400/40 bg-indigo-500/10 p-3.5 sm:mt-4 sm:p-4">
          <p className="text-sm font-black text-indigo-500">Model Cevap</p>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-default">{question.modelAnswer || 'Bu soru için model cevap eklenmemiş.'}</p>
        </div>
      )}
    </div>
  );
}

// Tek bir sorunun cevap anahtarı görünümü (soru metni + doğru cevap işaretli/model cevap).
// Hem aşağıdaki AnswerKeySection (test sonuç ekranındaki katlanır liste) HEM DE
// /soru-bankasi sayfası (bkz. app/soru-bankasi/.../page.tsx) bunu kullanıyor — ikisi de
// "tüm soruları cevaplarıyla göster" ihtiyacını aynı, tek yerde test edilmiş mantıkla
// karşılıyor.
export function QuestionAnswerKeyItem({
  question: q,
  index,
  interactive = false,
  onAnswered,
}: {
  question: QuizQuestion;
  index?: number;
  // true olunca: sorunun cevap/açıklama kısmı bir şıkka (ya da "Cevabı Göster" butonuna)
  // tıklanana kadar CSS ile (display:none DEĞİL, grid-rows collapse ile) görsel olarak
  // gizli kalır — ama içerik DOM'da baştan tam olarak mevcuttur, JS çalışmayan bir istemci
  // veya arama motoru her şeyi ilk yanıtta görür (bkz. .cevap-aciklama / .cevap-marker için
  // <noscript> override, app/soru-bankasi/.../page.tsx).
  interactive?: boolean;
  onAnswered?: (questionId: number, status: 'correct' | 'incorrect' | 'revealed') => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [assignment, setAssignment] = useState<Record<number, number>>({});
  const svgPosition = q.type !== 'matching' ? q.svg_position : 'above';
  const svg = <QuestionSvg svgContent={q.type !== 'matching' ? q.svg_content : null} />;

  if (!interactive) {
    return (
      <>
        {svgPosition !== 'below' && svg}
        <p className="text-sm font-bold text-default">
          {index != null ? `${index + 1}. ` : ''}
          {q.type === 'matching' ? 'Eşleştirme Sorusu' : q.question_text}
        </p>
        {svgPosition === 'below' && svg}
        {q.type === 'multiple_choice' && (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {q.choices.map((c) => (
              <li key={c.id} className={c.is_correct ? 'font-bold text-emerald-500' : undefined}>
                {c.is_correct ? '✓ ' : ''}
                {c.text}
              </li>
            ))}
          </ul>
        )}
        {q.type === 'blank' && (
          <p className="mt-2 text-sm text-muted-foreground">
            Doğru cevap: <span className="font-bold text-emerald-500">{q.options.find((o) => o.is_correct)?.text}</span>
          </p>
        )}
        {q.type === 'matching' && (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {q.pairs.map((p) => (
              <li key={p.id}>
                <span className="font-bold text-default">{p.left_text}</span> → {p.right_text}
              </li>
            ))}
          </ul>
        )}
        {q.type === 'classical' && q.modelAnswer && <p className="mt-2 text-sm text-muted-foreground">Model cevap: {q.modelAnswer}</p>}
        {(q.type === 'multiple_choice' || q.type === 'blank') && q.solution_text && (
          <p className="mt-1 text-xs text-muted-foreground">{q.solution_text}</p>
        )}
      </>
    );
  }

  // İnteraktif mod: her şık bir <button>, tıklanınca kilitlenir (tek deneme) ve
  // cevap/açıklama bloğu açılır. answered = ya bir şık seçildi (mc/blank) ya da
  // "Cevabı Göster" butonuna basıldı (matching/classical).
  const answered = selectedId != null || revealed;
  const explanationId = `cevap-aciklama-${q.id}`;
  const optionList = q.type === 'multiple_choice' ? q.choices : q.type === 'blank' ? q.options : null;

  const selectOption = (optId: number, isCorrect: boolean) => {
    if (selectedId != null) return;
    setSelectedId(optId);
    onAnswered?.(q.id, isCorrect ? 'correct' : 'incorrect');
  };

  // Eşleştirmede tek bir çift atandığında anında doğru/yanlış göstermiyoruz — kullanıcı
  // tüm çiftleri istediği gibi değiştirebilir, sonuç ancak "Cevabımı Kontrol Et" ile açığa
  // çıkar (canlı test akışındaki assignMatch/checkMatching ile birebir aynı mantık, bkz.
  // QuizClient.tsx içindeki assignMatch/checkMatching).
  const assignMatchPair = (leftId: number, rightId: number) => {
    if (revealed) return;
    setAssignment((prev) => {
      const next = { ...prev };
      for (const [l, r] of Object.entries(next)) {
        if (r === rightId) delete next[Number(l)];
      }
      next[leftId] = rightId;
      return next;
    });
  };

  const checkMatchAssignment = () => {
    if (revealed || q.type !== 'matching') return;
    if (Object.keys(assignment).length !== q.pairs.length) return;
    const allCorrect = q.pairs.every((p) => assignment[p.id] === p.id);
    setRevealed(true);
    onAnswered?.(q.id, allCorrect ? 'correct' : 'incorrect');
  };

  return (
    <>
      {svgPosition !== 'below' && svg}
      <p className="text-sm font-bold text-default">
        {index != null ? `${index + 1}. ` : ''}
        {q.type === 'matching' ? 'Eşleştirme Sorusu' : q.question_text}
      </p>
      {svgPosition === 'below' && svg}

      {optionList && (
        <ul className="mt-2.5 space-y-1.5 text-sm">
          {optionList.map((opt) => {
            const isChosen = selectedId === opt.id;
            let cls = 'border-default bg-surface text-default hover:border-indigo-400/50 hover:bg-indigo-500/5';
            if (answered) {
              if (opt.is_correct) cls = 'border-emerald-400/60 bg-emerald-500/10 text-emerald-500 font-bold';
              else if (isChosen) cls = 'border-rose-400/60 bg-rose-500/10 text-rose-500 font-bold';
              else cls = 'border-default bg-surface text-muted-foreground opacity-60';
            }
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => selectOption(opt.id, opt.is_correct)}
                  disabled={selectedId != null}
                  aria-expanded={answered}
                  aria-controls={explanationId}
                  className={`flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-left font-medium transition-colors disabled:cursor-default ${cls}`}
                >
                  <span
                    data-open={answered}
                    aria-hidden={!answered}
                    className="cevap-marker inline-block max-w-0 shrink-0 overflow-hidden opacity-0 transition-all duration-200 data-[open=true]:max-w-[1.2em] data-[open=true]:opacity-100"
                  >
                    {opt.is_correct ? '✓' : isChosen ? '✗' : ''}
                  </span>
                  <span>{opt.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === 'matching' && (
        <div className="mt-2.5">
          <MatchingView question={q} assignment={assignment} locked={revealed} onAssign={assignMatchPair} onCheck={checkMatchAssignment} />
        </div>
      )}

      {q.type === 'classical' && q.modelAnswer && !revealed && (
        <button
          type="button"
          onClick={() => {
            setRevealed(true);
            onAnswered?.(q.id, 'revealed');
          }}
          aria-expanded={revealed}
          aria-controls={explanationId}
          className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-black text-indigo-500 transition-colors hover:bg-indigo-500/20"
        >
          <Eye className="h-3.5 w-3.5" /> Model Cevabı Göster
        </button>
      )}

      <div
        id={explanationId}
        data-open={answered}
        aria-hidden={!answered}
        className="cevap-aciklama grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-out data-[open=true]:grid-rows-[1fr] data-[open=true]:opacity-100 data-[open=true]:mt-2.5"
      >
        <div className="overflow-hidden">
          {q.type === 'matching' && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {q.pairs.map((p) => (
                <li key={p.id}>
                  <span className="font-bold text-default">{p.left_text}</span> → {p.right_text}
                </li>
              ))}
            </ul>
          )}
          {q.type === 'classical' && q.modelAnswer && (
            <p className="text-sm text-muted-foreground">
              <span className="font-black text-indigo-500">Model Cevap: </span>
              {q.modelAnswer}
            </p>
          )}
          {(q.type === 'multiple_choice' || q.type === 'blank') && q.solution_text && (
            <p className="text-xs text-muted-foreground">{q.solution_text}</p>
          )}
        </div>
      </div>
    </>
  );
}

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
  // Soru başına verilen süre (saniye) — her yeni soruya geçildiğinde sıfırdan başlar,
  // testin tamamı için tek bir toplam süre DEĞİLDİR (bkz. quizQuestions.ts SECONDS_PER_QUESTION).
  secondsPerQuestion?: number;
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
  secondsPerQuestion,
  intro,
  onCurrentQuestionChange,
  gradeId,
  lessonId,
  unitId,
  topicId,
  resume,
  allCaughtUp: initialAllCaughtUp = false,
  questionBankPathBase,
}: QuizClientProps) {
  const resumedAnsweredIds = useMemo(() => new Set(resume?.answers.map((a) => a.questionId) ?? []), [resume]);
  const resumeAllAnswered = !!resume && initialQuestions.length > 0 && resumedAnsweredIds.size >= initialQuestions.length;
  const initialResumeIndex = resume ? findFirstUnansweredIndex(initialQuestions, resumedAnsweredIds) : 0;

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

  // Giriş yapmış kullanıcının çözdüğü soruların istatistiğini tutmak için: bu soru
  // setiyle açılmış test_sessions kaydının id'si. Misafir kullanıcıda hep null kalır,
  // hiçbir kayıt yapılmaz — bkz. aşağıdaki session efekti. resume verildiyse baştan
  // dolu gelir, aşağıdaki efekt bu durumda yeni bir oturum AÇMAZ (sessionQuestionsKeyRef
  // zaten bu soru setiyle eşleşecek şekilde seed'lendiği için).
  const { isAuthenticated, user, supabase } = useAuth();
  const [sessionId, setSessionId] = useState<number | null>(resume?.sessionId ?? null);
  const clientIdRef = useRef<string>('');
  const sessionQuestionsKeyRef = useRef<string | null>(resume ? initialQuestions.map((q) => q.id).join(',') : null);
  const finishedSessionRef = useRef<number | null>(null);
  const questionStartRef = useRef<number>(0);
  // Oturum açma RPC'si henüz dönmemişken kullanıcı çok hızlı cevap verirse buraya
  // birikir; sessionId gelince aşağıdaki efekt hepsini tek seferde gönderir — hiçbir
  // cevap sessizce kaybolmaz.
  const pendingAnswersRef = useRef<{ questionId: number; isCorrect: boolean; durationSeconds: number }[]>([]);

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
          // Yeni soru seti = yeni deneme: önceki oturumla ilişkiyi kes, aşağıdaki
          // session efekti yeni questions için yeni bir test_sessions açacak.
          setSessionId(null);
          sessionQuestionsKeyRef.current = null;
          finishedSessionRef.current = null;
          pendingAnswersRef.current = [];
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
  // efekt yeniden tetiklenir). Kullanıcı ilk soruyu bu sırada cevaplarsa pendingAnswersRef
  // zaten kaybetmeden kuyruklar, session açılınca flush edilir.
  useEffect(() => {
    if (!isAuthenticated || !user || questions.length === 0 || !questionsFullyLoaded) return;
    const questionsKey = questions.map((q) => q.id).join(',');
    if (sessionQuestionsKeyRef.current === questionsKey) return;
    sessionQuestionsKeyRef.current = questionsKey;

    const gradedIds = questions.filter((q) => q.type !== 'classical').map((q) => q.id);
    if (gradedIds.length === 0) return;

    if (!clientIdRef.current) {
      clientIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }

    supabase
      .rpc('start_web_quiz_session', {
        p_client_id: clientIdRef.current,
        p_grade_id: gradeId ?? null,
        p_lesson_id: lessonId ?? null,
        p_unit_id: unitId ?? null,
        p_topic_id: topicId ?? null,
        p_question_ids: gradedIds,
      })
      .then(({ data, error }: { data: number | null; error: { message: string } | null }) => {
        if (error) {
          console.error('start_web_quiz_session error:', error.message);
          return;
        }
        if (typeof data === 'number') setSessionId(data);
      });
    // user (nesne) yerine user?.id: Supabase TOKEN_REFRESHED gibi olaylarda user nesnesi aynı
    // kullanıcı için bile yeni bir referansla gelir, id ise gerçekten değişmediği sürece sabittir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, questions, questionsFullyLoaded, supabase, gradeId, lessonId, unitId, topicId]);

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
        const { error } = await supabase.from('test_session_answers').insert(
          toFlush.map((a) => ({
            test_session_id: currentSessionId,
            question_id: a.questionId,
            user_id: user!.id,
            client_id: clientIdRef.current,
            is_correct: a.isCorrect,
            duration_seconds: a.durationSeconds,
          }))
        );
        if (error) console.error('test_session_answers flush error:', error.message);
      }

      if (showResult && finishedSessionRef.current !== currentSessionId) {
        finishedSessionRef.current = currentSessionId;
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

  // Her soru değişiminde süre ölçümünü sıfırlar (duration_seconds için).
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [index, questions]);

  function recordAnswer(questionId: number, isCorrect: boolean) {
    if (!user) return;
    const durationSeconds = Math.max(0, Math.round((Date.now() - questionStartRef.current) / 1000));
    // Oturum RPC'si henüz dönmediyse (nadir, çok hızlı cevaplama) kaybetmeden kuyruğa
    // al — sessionId gelince yukarıdaki efekt bunu gönderecek.
    if (sessionId == null) {
      pendingAnswersRef.current.push({ questionId, isCorrect, durationSeconds });
      return;
    }
    supabase
      .from('test_session_answers')
      .insert({
        test_session_id: sessionId,
        question_id: questionId,
        user_id: user.id,
        client_id: clientIdRef.current,
        is_correct: isCorrect,
        duration_seconds: durationSeconds,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('test_session_answers insert error:', error.message);
      });
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
    recordAnswer(current.id, !!chosen?.is_correct);
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
    recordAnswer(current.id, allCorrect);
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
    }
  };

  // Soru başına süre dolunca yanlış sayılır ve kısa bir "süre doldu" geri bildiriminin
  // ardından otomatik olarak sıradaki soruya geçilir (kullanıcı kararı, 2026-09-02) —
  // diğer soru tipleriyle tutarlı olsun diye "cevapsız" ayrı bir durum eklenmedi.
  const handleTimeout = () => {
    if (!current || locked[current.id]) return;
    const questionId = current.id;
    setLocked((prev) => ({ ...prev, [questionId]: true }));
    setCorrect((prev) => ({ ...prev, [questionId]: false }));
    setFeedback((prev) => ({ ...prev, [questionId]: 'Süre doldu! ⏰' }));
    recordAnswer(questionId, false);
    setTimeout(() => goNext(), 1500);
  };

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const jumpToIndex = (i: number) => {
    if (i < 0 || i >= questions.length || i > maxIndex) return;
    setShowResult(false);
    setIndex(i);
  };

  const retry = () => setReloadKey((k) => k + 1);
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
    if (q.type === 'matching') return 'Bu eşleştirme sorusuna bir bak!';
    return q.question_text;
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-bold">Sorular hazırlanıyor...</span>
      </div>
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
        <Link
          href={exitHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {exitLabel}
        </Link>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-sm">
          <Trophy className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-lg font-black text-default">Bu konu için henüz soru yok</h1>
        <p className="mb-6 text-sm font-medium text-muted-foreground">Yakında bu konu için sorular eklenecek.</p>
        <Link
          href={exitHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {exitLabel}
        </Link>
      </div>
    );
  }

  if (showResult) {
    const percent = gradedQuestions.length ? Math.round((score / gradedQuestions.length) * 100) : 0;
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
          {classicalCount > 0 && (
            <p className="mt-1 text-xs font-medium text-muted-foreground">({classicalCount} açık uçlu soru puanlamaya dahil değil)</p>
          )}

          <div className="mt-6 max-h-72 space-y-1.5 overflow-y-auto text-left">
            {questions.map((q, i) => {
              const isClassical = q.type === 'classical';
              const isCorrectQ = !!correct[q.id];
              const label = q.type === 'matching' ? `${i + 1}. Eşleştirme Sorusu` : `${i + 1}. ${q.question_text}`;
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
            <Link
              href={exitHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {exitLabel}
            </Link>
          </div>
        </div>
      </div>
      {answerKey}
      </>
    );
  }

  const isAnswered = !!locked[current.id];
  const isCorrect = !!correct[current.id];

  return (
    <div className="mx-auto max-w-lg px-3 py-4 sm:px-4 sm:py-12">
      <Link href={exitHref} className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> {exitLabel}
      </Link>

      {intro && (
        <div className="mb-3 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-5 sm:p-6">
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
        </div>
      )}

      <div className="mb-3 sm:mb-5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-black text-muted-foreground">
          {intro ? <span className="truncate uppercase tracking-widest text-indigo-500">Soru {index + 1}</span> : <span className="truncate uppercase tracking-widest text-indigo-500">{scopeLabel}</span>}
          <span className="flex shrink-0 items-center gap-2">
            {secondsPerQuestion != null && !currentIsAnswered && (
              <QuestionTimer key={current.id} seconds={secondsPerQuestion} onTimeout={handleTimeout} />
            )}
            <span>
              {answeredCount}/{questions.length}
            </span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {questions.map((q, i) => {
            const isCurrent = i === index;
            const isLocked = !!locked[q.id];
            const isReachable = i <= maxIndex;
            let cls = 'bg-surface text-muted-foreground';
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
      </div>

      <div className="rounded-2xl border border-default bg-surface-elevated p-3.5 shadow-sm sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
          <span className="inline-block rounded-full bg-surface px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            {TYPE_LABELS[current.type]}
          </span>
          <div className="flex shrink-0 items-center gap-1">
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
        </div>
        {shareState === 'copied' && <p className="mb-2 text-xs font-bold text-emerald-500">Bağlantı kopyalandı!</p>}
        {editSaved && <p className="mb-2 text-xs font-bold text-emerald-500">Kaydedildi — güncel hâli sayfa yenilenince görünür.</p>}

        {current.type === 'matching' && (
          <MatchingView question={current} assignment={matchAssign[current.id] || {}} locked={isAnswered} onAssign={assignMatch} onCheck={checkMatching} />
        )}
        {current.type === 'classical' && (
          <ClassicalView
            question={current}
            value={classicalAnswer[current.id] || ''}
            locked={isAnswered}
            explanationRevealed={!!revealedExplanation[current.id]}
            onChange={setClassicalText}
            onCheck={checkClassical}
            onRevealExplanation={() => revealExplanation(current.id)}
          />
        )}
        {(current.type === 'multiple_choice' || current.type === 'blank') && (
          <OptionsView question={current} selectedId={selection[current.id]} locked={isAnswered} onSelect={selectAnswer} />
        )}

        {isAnswered && current.type !== 'classical' && (
          <div className={`mt-3 rounded-xl border p-3.5 sm:mt-4 sm:p-4 ${isCorrect ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'}`}>
            <p className={`text-sm font-black ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>{feedback[current.id]}</p>
            {(current.type === 'matching' || current.solution_text) && !revealedExplanation[current.id] && (
              <button
                type="button"
                onClick={() => revealExplanation(current.id)}
                className="mt-2 flex items-center gap-1.5 text-xs font-black text-indigo-500 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" /> Açıklamayı Göster
              </button>
            )}
            {revealedExplanation[current.id] && current.type !== 'matching' && current.solution_text && (
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">{current.solution_text}</p>
            )}
            {revealedExplanation[current.id] && current.type === 'matching' && !isCorrect && (
              <ul className="mt-1.5 space-y-1 text-sm font-medium leading-relaxed text-muted-foreground">
                {current.pairs
                  .filter((p) => matchAssign[current.id]?.[p.id] !== p.id)
                  .map((p) => (
                    <li key={p.id}>
                      <span className="font-black text-default">{p.left_text}</span> → {p.right_text}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2.5 sm:mt-6">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-default bg-surface-elevated px-4 text-sm font-black text-default transition-all hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 sm:h-12"
          >
            <ArrowLeft className="h-4 w-4" /> Geri
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!isAnswered}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-12"
          >
            {index === questions.length - 1 ? 'Testi Bitir' : 'Sonraki Soru'}
          </button>
        </div>
      </div>

      {editOpen && (
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
    </div>
  );
}
