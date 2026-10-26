'use client';

// Öğrenci "Hatalı soru" bildirimleri (2026-10-12). Veri: app/api/admin/question-reports/route.ts.
// 2026-10-26 sadeleşti: kartta sorunun tamamı (şıklar, doğru şık, öğrencinin seçtiği), tek karar akışı
// (karar seç → karara göre hazır mesaj → "Kapat ve gönder", route POST message), yapay zekâ için kopyalanan
// inceleme metni (öğrenci adları gönderilmez). Kapatmadan yazışma ./reply ile; soru üretimi /admin/soru-uretimi'nde.
import { useCallback, useEffect, useState } from 'react';
import { QuestionEditModal } from '@/app/src/components/admin/ManagementTab';
import { YaziliSvg } from '@/app/src/components/yazili/YaziliSvg';

type Message = { sender: 'admin' | 'student'; body: string; createdAt: string };
type Report = { id: number; reason: string; note: string | null; createdAt: string; isOpen: boolean; awaitingAdmin: boolean; studentName: string; chosenAnswer: string | null; messages: Message[] };
type Choice = { text: string; isCorrect: boolean };
type Item = {
  questionId: number;
  questionText: string;
  passage: string | null;
  svgContent: string | null;
  svgPosition: 'above' | 'below';
  solutionText: string | null;
  choices: Choice[];
  isActive: boolean;
  autoHidden: boolean;
  aiModel: string | null;
  context: string;
  hasOpen: boolean;
  reports: Report[];
};
type Action = 'dismiss' | 'fixed' | 'hide';

const REASON_LABEL: Record<string, string> = { wrong_answer: 'Cevap yanlış', unclear: 'Anlaşılmıyor', typo: 'Yazım hatası', other: 'Diğer' };
const LETTERS = 'ABCDEFGH';
const correctOf = (it: Item) => it.choices.find((c) => c.isCorrect)?.text ?? null;

// Mesaj taslağı karara göre; "{ad}" sunucuda her öğrencinin adıyla değişir.
const DECISIONS: { action: Action; label: string; hint: string; tone: string; draft: (it: Item) => string }[] = [
  {
    action: 'dismiss',
    label: 'Soru doğru',
    hint: 'Hata yok, soru yayında kalır.',
    tone: 'border-emerald-500 bg-emerald-500/10',
    draft: (it) =>
      [
        'Merhaba {ad}, bildirimin için çok teşekkür ederim!',
        `Soruyu kontrol ettim, soruda bir hata yok. Doğru cevap: ${correctOf(it)?.replace(/[.\s]+$/, '') ?? '…'}.`,
        it.solutionText ?? '',
        'Başka bir hata görürsen yine bildir, çok işimize yarıyor.',
      ]
        .filter(Boolean)
        .join('\n\n'),
  },
  {
    action: 'fixed',
    label: 'Düzelttim',
    hint: 'Önce "Soruyu düzenle" ile düzelt, sonra kapat.',
    tone: 'border-indigo-500 bg-indigo-500/10',
    draft: () => 'Merhaba {ad}, haklıydın! Soruda bir hata vardı, düzelttim.\n\nDikkatin için çok teşekkür ederim. Başka bir hata görürsen yine bildir.',
  },
  {
    action: 'hide',
    label: 'Yayından kaldır',
    hint: 'Soru düzeltilene kadar kimseye gösterilmez.',
    tone: 'border-rose-500 bg-rose-500/10',
    draft: () => 'Merhaba {ad}, haklıydın, soruda bir sorun vardı. Düzeltene kadar soruyu yayından kaldırdım.\n\nKatkın için çok teşekkür ederim!',
  },
];

const AI_INSTRUCTIONS = `Sen deneyimli bir ölçme-değerlendirme uzmanı ve ders öğretmenisin. Aşağıda Ders Takip sitesinde öğrencilerin "hatalı soru" diye bildirdiği sorular var. Her soruyu kendin baştan çözerek incele; öğrencinin seçtiği şık ve notu yalnız ipucudur, doğru kabul etme.

Her soru için tam olarak şu biçimde cevap ver:

### Soru #<numara>
- **Karar:** SORU DOĞRU / SORU HATALI / EMİN DEĞİLİM
- **Gerekçe:** Kısa, adım adım çözüm; hata varsa tam olarak nerede olduğu.
- **Düzeltme:** (yalnız SORU HATALI ise) soru kökü, şıklar (doğru şıkkı belirt) ve çözüm metninin düzeltilmiş hâli. Yalnız hatalı kısmı değiştir, gerisini olduğu gibi bırak.
- **Öğrenciye mesaj:** 2-4 cümle; ortaokul öğrencisine uygun, sıcak ve teşekkür eden bir dil. Soru doğruysa öğrenciyi kırmadan nedenini açıkla. "Talebiniz", "destek kaydı" gibi kurumsal ifadeler kullanma. Mesaja "Merhaba {ad}," diye başla ({ad} olduğu gibi kalsın).

Kurallar:
- Emin değilsen EMİN DEĞİLİM de ve neyi kontrol etmem gerektiğini yaz.
- Görsel SVG kodu olarak verildiyse kodu okuyarak şekli yorumla.
- Matematik ifadeleri $...$ içinde LaTeX olarak yazılmış olabilir.`;

const SVG_LIMIT = 8000;

function questionForAi(it: Item): string {
  const lines = [`## Soru #${it.questionId} — ${it.context}`];
  if (it.autoHidden) lines.push('(Bildirimler yüzünden otomatik gizlendi)');
  else if (!it.isActive) lines.push('(Şu an yayında değil)');
  if (it.passage) lines.push('', 'Okuma parçası:', it.passage);
  if (it.svgContent) {
    const svg = it.svgContent.length > SVG_LIMIT ? `${it.svgContent.slice(0, SVG_LIMIT)}\n<!-- kısaltıldı -->` : it.svgContent;
    lines.push('', `Görsel (sorunun ${it.svgPosition === 'below' ? 'altında' : 'üstünde'}, SVG):`, '```svg', svg, '```');
  }
  lines.push('', `Soru: ${it.questionText}`);
  if (it.choices.length) {
    lines.push('Şıklar:');
    it.choices.forEach((c, i) => lines.push(`${LETTERS[i]}) ${c.text}${c.isCorrect ? '   ← sistemde doğru işaretli' : ''}`));
  }
  if (it.solutionText) lines.push(`Sistemdeki çözüm: ${it.solutionText}`);
  const reports = it.reports.filter((r) => r.isOpen);
  lines.push('', `Bildirimler (${reports.length}):`);
  reports.forEach((r, i) => {
    const parts = [`Neden: ${REASON_LABEL[r.reason] ?? r.reason}`];
    if (r.chosenAnswer) parts.push(`Öğrencinin seçtiği şık: ${r.chosenAnswer}`);
    if (r.note) parts.push(`Not: "${r.note}"`);
    lines.push(`${i + 1}. ${parts.join(' · ')}`);
    for (const m of r.messages) lines.push(`   ${m.sender === 'admin' ? 'Biz' : 'Öğrenci'}: ${m.body.replace(/\s*\n\s*/g, ' ')}`);
  });
  return lines.join('\n');
}

const buildAiPrompt = (items: Item[]) => [AI_INSTRUCTIONS, ...items.map(questionForAi)].join('\n\n---\n\n');

function CopyAiButton({ items, label, primary }: { items: Item[]; label: string; primary?: boolean }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildAiPrompt(items));
      setState('done');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2500);
  };
  return (
    <button
      onClick={copy}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${primary ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'border border-border hover:bg-accent'}`}
    >
      {state === 'done' ? 'Kopyalandı ✓' : state === 'error' ? 'Kopyalanamadı' : label}
    </button>
  );
}

function QuestionView({ it }: { it: Item }) {
  const svg = it.svgContent ? <YaziliSvg svgContent={it.svgContent} label="Soru görseli" /> : null;
  return (
    <div className="flex flex-col gap-3">
      {it.passage && (
        <details className="rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Okuma parçası</summary>
          <p className="mt-2 whitespace-pre-line">{it.passage}</p>
        </details>
      )}
      {it.svgPosition === 'above' && svg}
      <p className="whitespace-pre-line font-semibold">{it.questionText}</p>
      {it.svgPosition === 'below' && svg}
      {it.choices.length > 0 && (
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {it.choices.map((c, i) => {
            const picked = it.reports.some((r) => r.chosenAnswer === c.text);
            return (
              <li key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${c.isCorrect ? 'border-emerald-500/70 bg-emerald-500/10' : 'border-border'}`}>
                <b>{LETTERS[i]})</b>
                <span className="flex-1">{c.text}</span>
                {c.isCorrect && <span className="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400">✓ doğru</span>}
                {picked && <span className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-300">öğrenci seçti</span>}
              </li>
            );
          })}
        </ol>
      )}
      {it.solutionText && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          <b className="text-foreground">Çözüm:</b> {it.solutionText}
        </p>
      )}
    </div>
  );
}

function ReplyBox({ report, awaiting, onSent, onSkipped, onCancel }: { report: Report; awaiting: boolean; onSent: (m: Message) => void; onSkipped: () => void; onCancel?: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const post = async (payload: object) => {
    setSending(true);
    setError('');
    const res = await fetch('/api/admin/question-reports/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: report.id, ...payload }) });
    setSending(false);
    if (!res.ok) setError('İşlem başarısız');
    return res.ok;
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        rows={3}
        maxLength={2000}
        placeholder="Öğrenciye cevabın…"
        aria-label={`${report.studentName} için cevap`}
        className="rounded-lg border border-border bg-background p-2 text-sm"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={sending || !text.trim()}
          onClick={async () => {
            if (!(await post({ body: text }))) return;
            onSent({ sender: 'admin', body: text.trim(), createdAt: new Date().toISOString() });
            setText('');
          }}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {sending ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        {awaiting && (
          <button disabled={sending} onClick={async () => (await post({ skip: true })) && onSkipped()} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
            Cevap gerekmiyor
          </button>
        )}
        {onCancel && (
          <button onClick={onCancel} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            Vazgeç
          </button>
        )}
      </div>
    </div>
  );
}

function ReportView({ report, onSent }: { report: Report; onSent: (m: Message) => void }) {
  const [awaiting, setAwaiting] = useState(report.awaitingAdmin);
  const [replyOpen, setReplyOpen] = useState(report.awaitingAdmin);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <b>{report.studentName}</b>
        <span className="text-muted-foreground">· {REASON_LABEL[report.reason] ?? report.reason}</span>
        {report.chosenAnswer && <span className="text-muted-foreground">· seçtiği: {report.chosenAnswer}</span>}
        <span className="text-muted-foreground">· {new Date(report.createdAt).toLocaleString('tr-TR')}</span>
        {!report.isOpen && <span className="rounded bg-muted px-2 py-0.5 font-bold">Kapalı</span>}
        {awaiting && <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">Öğrenci yazdı, cevap bekliyor</span>}
      </div>
      {report.note && <p className="text-sm">“{report.note}”</p>}
      {report.messages.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {report.messages.map((m, i) => (
            <li
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${m.sender === 'admin' ? 'self-end bg-indigo-50 text-indigo-950 dark:bg-indigo-500/15 dark:text-indigo-100' : 'self-start bg-muted'}`}
            >
              {m.body}
              <span className="mt-1 block text-[10px] opacity-60">{m.sender === 'admin' ? 'Sen' : report.studentName} · {new Date(m.createdAt).toLocaleString('tr-TR')}</span>
            </li>
          ))}
        </ol>
      )}
      {replyOpen ? (
        <ReplyBox
          report={report}
          awaiting={awaiting}
          onSent={(m) => {
            setAwaiting(false);
            setReplyOpen(false);
            onSent(m);
          }}
          onSkipped={() => {
            setAwaiting(false);
            setReplyOpen(false);
          }}
          onCancel={awaiting ? undefined : () => setReplyOpen(false)}
        />
      ) : (
        <button onClick={() => setReplyOpen(true)} className="self-start text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          {report.isOpen ? 'Kapatmadan mesaj yaz' : 'Mesaj yaz'}
        </button>
      )}
    </li>
  );
}

function DecisionBox({ it, onClosed }: { it: Item; onClosed: () => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const openCount = it.reports.filter((r) => r.isOpen).length;

  const close = async () => {
    if (!action) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/question-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: it.questionId, action, message: text }) });
    setBusy(false);
    if (res.ok) onClosed();
    else setError('İşlem başarısız');
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kararın</p>
      <div role="radiogroup" aria-label="Karar" className="grid gap-2 sm:grid-cols-3">
        {DECISIONS.map((d) => (
          <button
            key={d.action}
            role="radio"
            aria-checked={action === d.action}
            onClick={() => {
              setAction(d.action);
              setText(d.draft(it));
            }}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${action === d.action ? d.tone : 'border-border bg-card hover:bg-accent'}`}
          >
            <b className="block">{d.label}</b>
            <span className="text-xs text-muted-foreground">{d.hint}</span>
          </button>
        ))}
      </div>
      {action && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>
              Öğrenciye mesaj{openCount > 1 ? ` (${openCount} öğrenciye ayrı ayrı gider)` : ''}. “{'{ad}'}” öğrencinin adıyla değişir; boş bırakırsan yalnız sonuç bildirimi gider.
            </span>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={6} maxLength={2000} className="rounded-lg border border-border bg-background p-2 text-sm text-foreground" />
          </label>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button disabled={busy} onClick={close} className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Kapatılıyor…' : text.trim() ? 'Kapat ve öğrenciye gönder' : 'Mesajsız kapat'}
          </button>
        </>
      )}
    </div>
  );
}

export default function QuestionReportsPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/question-reports');
    if (!res.ok) {
      setError('Bildirimler yüklenemedi');
      return;
    }
    setItems(((await res.json()) as { items: Item[] }).items);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk yükleme
    void load();
  }, [load]);

  const appendMessage = (questionId: number, reportId: number, m: Message) =>
    setItems((cur) =>
      cur?.map((i) => (i.questionId !== questionId ? i : { ...i, reports: i.reports.map((r) => (r.id === reportId ? { ...r, messages: [...r.messages, m] } : r)) })) ?? cur
    );

  const pending = items?.filter((i) => i.hasOpen) ?? [];
  // Kapanmış bildirimde cevap bekleyen öğrenci mesajı (kapanmadan önce yazılmış, eski kayıtlar).
  const closedReplies = items?.filter((i) => !i.hasOpen) ?? [];
  const awaitingCount = items?.flatMap((i) => i.reports).filter((r) => r.awaitingAdmin).length ?? 0;

  const card = (it: Item, decide: boolean) => (
    <article key={it.questionId} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{it.context}</span>
          <span>· #{it.questionId}</span>
          {it.aiModel && <span>· {it.aiModel}</span>}
          {it.autoHidden && <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">Otomatik gizlendi</span>}
          {!it.isActive && !it.autoHidden && <span className="rounded bg-muted px-2 py-0.5 font-bold text-foreground">Yayında değil</span>}
        </div>
        <div className="flex shrink-0 gap-2">
          {decide && <CopyAiButton items={[it]} label="AI için kopyala" />}
          <button onClick={() => setEditId(it.questionId)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
            Soruyu düzenle
          </button>
        </div>
      </div>
      <QuestionView it={it} />
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bildirimler ({it.reports.length})</h3>
        <ul className="flex flex-col gap-2">
          {it.reports.map((r) => (
            <ReportView key={r.id} report={r} onSent={(m) => appendMessage(it.questionId, r.id, m)} />
          ))}
        </ul>
      </section>
      {decide && <DecisionBox it={it} onClosed={() => setItems((cur) => cur?.filter((i) => i.questionId !== it.questionId) ?? cur)} />}
    </article>
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-bold">Hatalı soru bildirimleri</h2>
          <p className="text-sm text-muted-foreground">
            {items ? `${pending.length} soru karar bekliyor${awaitingCount ? ` · ${awaitingCount} öğrenci sana yazdı` : ''}` : 'Yükleniyor…'}
          </p>
        </div>
        {pending.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <CopyAiButton items={pending} label={`Tümünü yapay zekâ için kopyala (${pending.length})`} primary />
            <span className="text-[11px] text-muted-foreground">Öğrenci adları kopyalanmaz.</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!items ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Açık bildirim yok.</p>
      ) : (
        <>
          {pending.map((it) => card(it, true))}
          {closedReplies.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-bold">Kapanmış bildirimlerde cevap bekleyen mesajlar</h2>
              {closedReplies.map((it) => card(it, false))}
            </section>
          )}
        </>
      )}

      {editId !== null && (
        <QuestionEditModal
          questionId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null);
            void load();
          }}
          showNotice={(kind, text) => (kind === 'error' ? setError(text) : setError(''))}
        />
      )}
    </div>
  );
}
