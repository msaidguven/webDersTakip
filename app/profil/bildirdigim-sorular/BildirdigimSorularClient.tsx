"use client";

// Profil → Bildirdiğim sorular (2026-10-25): öğrencinin "Hatalı soru" bildirimleri ve admin ile yazışması.
// RPC'ler supabase/migrations/question_report_messages.sql'de. Mesajlaşma düzeni: solda bildirilen sorular
// (Açık / Tamamlanan sekmeleri), sağda seçilenin sorusu + yazışması. Seçim ?bildirim=ID, sekme ?sekme= ile URL'de
// (zil bildirimi buraya getirir, geri tuşu çalışır); dar ekranda seçim yokken liste, varken yazışma.
// 2026-10-26: admin kapatınca sonuç (düzeltildi / yayından kaldırıldı / hata yok) gösterilir, bildirim
// "Tamamlanan"a geçer, yazışma kapanır; öğrenci silebilir (yoksa 30 gün sonra listeden kalkar).
// Görünüm: metalik yüzeyler BildirdigimSorular.module.css'te. Dar ekranda açılan yazışma ekranı doldurur
// (başlık gizlenir, mesaj alanı sabit, yalnız mesajlar kayar).
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  EyeOff,
  Info,
  Send,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/app/src/context/AuthContext";
import { AuthPrompt } from "@/app/src/components/AuthPrompt";
import { roboticFontVars } from "@/app/src/components/robotic/fonts";
import r from "@/app/src/components/robotic/robotic.module.css";
import m from "./BildirdigimSorular.module.css";
import MathText from "@/app/src/components/MathText";
import { QuestionSvg } from "@/app/src/components/QuizClient";
import { latexToPlain } from "@/app/src/lib/latexToPlain";

type Message = {
  sender: "admin" | "student";
  body: string;
  created_at: string;
};
type Choice = { id: number; text: string; is_correct: boolean };
type Resolution = "fixed" | "hidden" | "no_error";
type Ticket = {
  id: number;
  question_text: string;
  svg_content: string | null;
  svg_position: string | null;
  passage: string | null;
  lesson_name: string | null;
  topic_title: string | null;
  href: string | null;
  choices: Choice[];
  chosen_id: number | null;
  reason: string;
  note: string | null;
  status: "open" | "resolved" | "dismissed";
  resolution: Resolution | null;
  resolved_at: string | null;
  question_hidden: boolean;
  unread: boolean;
  created_at: string;
  messages: Message[];
};
type Tab = "acik" | "tamamlanan";

const REASON_LABEL: Record<string, string> = {
  wrong_answer: "Cevap yanlış",
  unclear: "Soru anlaşılmıyor",
  typo: "Yazım hatası var",
  other: "Başka bir sorun",
};
const OUTCOME: Record<
  Resolution | "done",
  { label: string; title: string; text: string; Icon: LucideIcon; tone: string }
> = {
  fixed: {
    label: "Düzeltildi",
    title: "Hata giderildi",
    text: "Soruyu düzelttik. Katkın için teşekkürler!",
    Icon: CheckCircle2,
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  hidden: {
    label: "Yayından kaldırıldı",
    title: "Soru yayından kaldırıldı",
    text: "Soru hatalı bulundu; düzeltilene kadar kimseye gösterilmeyecek. Katkın için teşekkürler!",
    Icon: EyeOff,
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  no_error: {
    label: "Hata yok",
    title: "Soruda hata bulunmadı",
    text: "Soruyu inceledik, işaretli cevap doğru. Yine de dikkatin için teşekkürler!",
    Icon: Info,
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  },
  done: {
    label: "Tamamlandı",
    title: "Bildirim tamamlandı",
    text: "Bildirimini inceledik. Katkın için teşekkürler!",
    Icon: CheckCircle2,
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
};
const MAX = 500;
const PAGE = "/profil/bildirdigim-sorular";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
const fmtShort = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
};
const isOpen = (t: Ticket) => t.status === "open";
const outcomeOf = (t: Ticket) => OUTCOME[t.resolution ?? "done"];
const context = (t: Ticket) =>
  [t.lesson_name, t.topic_title].filter(Boolean).join(" · ");
const lastAt = (t: Ticket) =>
  [t.created_at, t.resolved_at, t.messages.at(-1)?.created_at]
    .filter((x): x is string => !!x)
    .sort()
    .at(-1)!;

function StatusPill({ ticket }: { ticket: Ticket }) {
  if (!isOpen(ticket)) {
    const o = outcomeOf(ticket);
    return (
      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${o.tone}`}
      >
        {o.label}
      </span>
    );
  }
  const answered = ticket.messages.at(-1)?.sender === "admin";
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${answered ? `border-[color-mix(in_srgb,var(--neon)_40%,transparent)] ${r.tint}` : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}
    >
      {answered ? "Cevaplandı" : "İnceleniyor"}
    </span>
  );
}

function TicketList({
  tickets,
  activeId,
  onSelect,
}: {
  tickets: Ticket[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <ul>
      {tickets.map((t) => {
        const last = t.messages.at(-1);
        const preview = !isOpen(t)
          ? outcomeOf(t).title
          : last
            ? `${last.sender === "student" ? "Sen: " : "Ders Takip: "}${last.body}`
            : `Sen: ${REASON_LABEL[t.reason] ?? t.reason}`;
        const on = t.id === activeId;
        return (
          <li key={t.id} className={`${m.row} ${on ? m.rowOn : ""}`}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              aria-current={on ? "true" : undefined}
              className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left"
            >
              <span className="flex items-center gap-2">
                {t.unread && (
                  <span className={`shrink-0 ${m.dot}`} aria-label="Yeni" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {context(t) || REASON_LABEL[t.reason]}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtShort(lastAt(t))}
                </span>
              </span>
              <span
                className={`line-clamp-2 text-[15px] leading-snug text-default ${t.unread ? "font-bold" : "font-semibold"}`}
              >
                {latexToPlain(t.question_text)}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] ${t.unread ? "font-semibold text-default" : "text-muted-foreground"}`}
                >
                  {preview}
                </span>
                <StatusPill ticket={t} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function QuestionCard({ ticket }: { ticket: Ticket }) {
  return (
    <section
      aria-label="Bildirdiğin soru"
      className={`flex flex-col gap-3 rounded-2xl p-4 ${m.plate}`}
    >
      <p className={`${r.label}`}>Bildirdiğin soru</p>
      {ticket.svg_position !== "below" && (
        <QuestionSvg svgContent={ticket.svg_content} />
      )}
      {ticket.passage && (
        <blockquote
          className="rounded-r-xl border-l-4 border-indigo-400/70 bg-indigo-500/5 px-3 py-2 text-[15px] leading-relaxed text-default"
          aria-label="Okuma metni"
        >
          <MathText text={ticket.passage} />
        </blockquote>
      )}
      <p className="text-[15px] font-semibold leading-relaxed text-default">
        <MathText text={ticket.question_text} />
      </p>
      {ticket.svg_position === "below" && (
        <QuestionSvg svgContent={ticket.svg_content} />
      )}
      {ticket.choices.length > 0 && (
        <ul className="flex flex-col gap-2">
          {/* Harf (A/B/C) yok: soru bankası şıkları karıştırıyor, harfler orada başka şıka denk gelirdi. */}
          {ticket.choices.map((c) => {
            const chosen = c.id === ticket.chosen_id;
            const tone = c.is_correct
              ? "border-emerald-500/60 bg-emerald-500/10"
              : chosen
                ? "border-rose-500/60 bg-rose-500/10"
                : `border-default ${m.input}`;
            return (
              <li
                key={c.id}
                className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3.5 py-2.5 text-[15px] text-default ${tone}`}
              >
                <span className="min-w-0 flex-1">
                  <MathText text={c.text} />
                </span>
                {c.is_correct && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{" "}
                    Doğru cevap{chosen ? " (senin cevabın)" : ""}
                  </span>
                )}
                {chosen && !c.is_correct && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <XCircle className="h-4 w-4" aria-hidden="true" /> Senin
                    cevabın
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {ticket.href && (
        <Link
          href={ticket.href}
          className={`inline-flex w-fit items-center gap-1.5 text-sm font-bold hover:underline ${r.accent}`}
        >
          Soruyu soru bankasında aç{" "}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function Outcome({ ticket }: { ticket: Ticket }) {
  const o = outcomeOf(ticket);
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border p-4 text-[15px] leading-relaxed ${o.tone}`}
    >
      <o.Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">{o.title}</p>
        <p className="mt-0.5">{o.text}</p>
        {ticket.resolved_at && (
          <p className="mt-1 text-xs opacity-75">{fmt(ticket.resolved_at)}</p>
        )}
      </div>
    </div>
  );
}

function Composer({
  ticket,
  onSent,
}: {
  ticket: Ticket;
  onSent: (m: Message) => void;
}) {
  const { supabase } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("reply_question_report", {
      p_report_id: ticket.id,
      p_body: body,
    });
    setSending(false);
    if (rpcError) {
      setError(
        rpcError.code === "P0002"
          ? "Bu bildirim kapandı, sayfayı yenile."
          : "Mesajın gönderilemedi, biraz sonra tekrar dene.",
      );
      return;
    }
    onSent({ sender: "student", body, created_at: new Date().toISOString() });
    setText("");
  };

  return (
    <div className={`px-3 pb-2.5 pt-3 sm:px-4 ${m.bar} ${m.barBottom}`}>
      <label htmlFor={`cevap-${ticket.id}`} className="sr-only">
        Mesaj yaz
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={`cevap-${ticket.id}`}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
          }}
          placeholder="Mesaj yaz…"
          rows={2}
          maxLength={MAX}
          disabled={sending}
          className={`min-w-0 flex-1 resize-none rounded-2xl px-4 py-3 text-[15px] leading-snug ${m.input}`}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !text.trim()}
          aria-label="Gönder"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl disabled:opacity-50 ${r.btnNeon}`}
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-1 flex justify-between gap-3 px-1 text-xs text-muted-foreground">
        {error ? (
          <span role="alert" className="font-semibold text-rose-600">
            {error}
          </span>
        ) : (
          <span className="hidden sm:inline">Ctrl + Enter ile gönder</span>
        )}
        <span aria-live="polite" className="ml-auto">
          {text.length}/{MAX}
        </span>
      </div>
    </div>
  );
}

function ClosedFooter({
  ticket,
  onDeleted,
}: {
  ticket: Ticket;
  onDeleted: () => void;
}) {
  const { supabase } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("hide_my_question_report", {
      p_report_id: ticket.id,
    });
    setBusy(false);
    if (rpcError) {
      setError("Silinemedi, biraz sonra tekrar dene.");
      return;
    }
    onDeleted();
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-[13px] text-muted-foreground ${m.bar} ${m.barBottom}`}
    >
      <p className="min-w-0 flex-1">
        Bu bildirim tamamlandı, yazışma kapandı. 30 gün sonra listeden
        kendiliğinden kalkar.
      </p>
      {confirming ? (
        <span className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Siliniyor…" : "Evet, sil"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-10 rounded-xl px-3 text-sm font-semibold hover:text-default"
          >
            Vazgeç
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold hover:text-rose-600 ${m.jump}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Listeden sil
        </button>
      )}
      {error && (
        <p role="alert" className="w-full font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Conversation({
  ticket,
  onSent,
  onDeleted,
}: {
  ticket: Ticket;
  onSent: (m: Message) => void;
  onDeleted: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = ticket.messages.length;
  const prevCount = useRef(count);
  const [farFromEnd, setFarFromEnd] = useState(false);

  const toEnd = () =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  const onScroll = () => {
    const el = scrollRef.current;
    if (el)
      setFarFromEnd(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
  };

  // Açılışta soru en üstte görünsün; yalnız yeni mesaj eklenince en alta kay.
  useEffect(() => {
    if (count > prevCount.current) toEnd();
    prevCount.current = count;
  }, [count]);
  // Uzun yazışmada açılışta da "son mesaja in" düğmesi görünsün.
  useEffect(onScroll, []);

  return (
    <>
      <header
        className={`flex items-center gap-2 px-3 py-3 sm:px-4 ${m.bar} ${m.barTop}`}
      >
        <Link
          href={`${PAGE}?sekme=${isOpen(ticket) ? "acik" : "tamamlanan"}`}
          aria-label="Listeye dön"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl lg:hidden ${m.jump}`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-default">
            {context(ticket) || "Bildirdiğin soru"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {REASON_LABEL[ticket.reason] ?? ticket.reason} ·{" "}
            {fmt(ticket.created_at)}
          </p>
        </div>
        <StatusPill ticket={ticket} />
      </header>

      <div className={`relative min-h-0 flex-1 ${m.well}`}>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={`flex h-full flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-5 ${m.scroll}`}
        >
          {isOpen(ticket) && ticket.question_hidden && (
            <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" /> Bu soru
              inceleme bitene kadar yayından kaldırıldı.
            </p>
          )}
          <QuestionCard ticket={ticket} />
          <ol className="flex flex-col gap-3" aria-label="Mesajlar">
            <li
              className={`max-w-[88%] self-end px-4 py-3 text-[15px] leading-relaxed sm:max-w-[75%] ${m.bubbleMe}`}
            >
              <b>{REASON_LABEL[ticket.reason] ?? ticket.reason}</b>
              {ticket.note && (
                <span className="block whitespace-pre-wrap break-words">
                  {ticket.note}
                </span>
              )}
              <span className="mt-1.5 block text-right text-xs opacity-80">
                {fmt(ticket.created_at)}
              </span>
            </li>
            {ticket.messages.map((msg, i) =>
              msg.sender === "student" ? (
                <li
                  key={i}
                  className={`max-w-[88%] self-end whitespace-pre-wrap break-words px-4 py-3 text-[15px] leading-relaxed sm:max-w-[75%] ${m.bubbleMe}`}
                >
                  {msg.body}
                  <span className="mt-1.5 block text-right text-xs opacity-80">
                    {fmt(msg.created_at)}
                  </span>
                </li>
              ) : (
                <li
                  key={i}
                  className={`max-w-[88%] self-start px-4 py-3 text-[15px] leading-relaxed text-default sm:max-w-[75%] ${m.bubbleThem}`}
                >
                  <span className={`mb-1 block text-xs font-bold ${r.accent}`}>
                    Ders Takip ekibi
                  </span>
                  <span className="block whitespace-pre-wrap break-words">
                    {msg.body}
                  </span>
                  <span className="mt-1.5 block text-right text-xs text-muted-foreground">
                    {fmt(msg.created_at)}
                  </span>
                </li>
              ),
            )}
          </ol>
          {!isOpen(ticket) && <Outcome ticket={ticket} />}
        </div>
        {farFromEnd && (
          <button
            type="button"
            onClick={toEnd}
            className={`absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${m.jump}`}
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" /> Son mesaj
          </button>
        )}
      </div>

      {isOpen(ticket) ? (
        <Composer ticket={ticket} onSent={onSent} />
      ) : (
        <ClosedFooter ticket={ticket} onDeleted={onDeleted} />
      )}
    </>
  );
}

export default function BildirdigimSorularClient() {
  const { user, loading, supabase } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [fixedTotal, setFixedTotal] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const raw = Number(params?.get("bildirim"));
  const selectedId = Number.isInteger(raw) && raw > 0 ? raw : null;

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_question_reports");
    if (error) {
      setLoadError(true);
      return;
    }
    const d = data as { items: Ticket[]; fixed_total: number } | null;
    setTickets(d?.items ?? []);
    setFixedTotal(d?.fixed_total ?? 0);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk yükleme
    if (user) void load();
  }, [user, load]);

  const open = tickets?.filter(isOpen) ?? [];
  const done = tickets?.filter((t) => !isOpen(t)) ?? [];
  const selected = tickets?.find((t) => t.id === selectedId) ?? null;
  // Sekme: seçili bildirim hangisindeyse o; yoksa URL, o da yoksa açık bildirim varsa "Açık".
  const tab: Tab = selected
    ? isOpen(selected)
      ? "acik"
      : "tamamlanan"
    : params?.get("sekme") === "tamamlanan" || (!open.length && done.length)
      ? "tamamlanan"
      : "acik";
  const list = tab === "acik" ? open : done;
  // Geniş ekranda seçim yoksa sekmenin en son hareketli bildirimi açık gelir.
  const active = selected ?? list[0] ?? null;

  // Açılan bildirimdeki yeni cevap/sonuç okundu sayılır.
  const activeId = active?.id;
  const activeUnread = active?.unread;
  useEffect(() => {
    if (!activeId || !activeUnread) return;
    // Dar ekranda seçim yokken yazışma görünmüyor — okundu sayma.
    if (!selectedId && !window.matchMedia("(min-width: 1024px)").matches)
      return;
    // supabase-js sorgusu then'lenmeden gönderilmez; sonuç beklenmiyor, yalnız tetikleniyor.
    void supabase
      .rpc("mark_question_report_seen", { p_report_id: activeId })
      .then(() => undefined);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- okundu işareti yerelde de düşsün
    setTickets(
      (cur) =>
        cur?.map((t) => (t.id === activeId ? { ...t, unread: false } : t)) ??
        cur,
    );
  }, [activeId, activeUnread, selectedId, supabase]);

  const append = (id: number, msg: Message) =>
    setTickets(
      (cur) =>
        cur?.map((t) =>
          t.id === id ? { ...t, messages: [...t.messages, msg] } : t,
        ) ?? cur,
    );
  const removeTicket = (id: number) => {
    setTickets((cur) => cur?.filter((t) => t.id !== id) ?? cur);
    router.replace(`${PAGE}?sekme=tamamlanan`, { scroll: false });
  };
  const go = (q: string) => router.push(`${PAGE}?${q}`, { scroll: false });

  const tabBtn = (id: Tab, label: string, n: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => go(`sekme=${id}`)}
      className={`${m.segmentBtn} ${tab === id ? m.segmentOn : ""}`}
    >
      {label} <span className="text-xs opacity-75">{n}</span>
    </button>
  );

  // Dar ekranda açık yazışma: başlık gizlenir, kasa üst bar ile alt sekme çubuğu arasına sabitlenir (MainLayout:
  // 60/72px üst bar, 4rem + güvenli alan sekme çubuğu) — sayfa kaymaz, yalnız mesajlar kayar.
  const chatMode = !!selectedId && !!tickets?.length;

  let body: React.ReactNode;
  if (loading || (user && !tickets && !loadError))
    body = (
      <div
        aria-busy="true"
        aria-label="Bildirimler yükleniyor"
        className={`h-96 animate-pulse ${m.shell}`}
      />
    );
  else if (!user)
    body = <AuthPrompt message="Bildirdiğin soruları görmek için giriş yap." />;
  else if (loadError)
    body = (
      <p className="text-sm font-semibold text-rose-600">
        Bildirimler yüklenemedi, sayfayı yenile.
      </p>
    );
  else if (!tickets?.length)
    body = (
      <div
        className={`p-6 text-[15px] leading-relaxed text-muted-foreground ${m.shell}`}
      >
        Henüz bildirdiğin bir soru yok. Bir soruda hata görürsen cevabın
        altındaki <b className="text-default">“Hatalı soru mu? Bildir”</b>{" "}
        bağlantısını kullan; cevabımızı burada görürsün.
      </div>
    );
  else
    body = (
      <div
        className={
          chatMode
            ? "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-[60px] z-30 bg-[var(--bg)] p-2 sm:top-[72px] sm:p-4 lg:static lg:z-auto lg:bg-transparent lg:p-0"
            : "contents"
        }
      >
        <div
          className={`grid grid-cols-1 lg:h-[calc(100dvh-15rem)] lg:min-h-[34rem] lg:grid-cols-[23rem_minmax(0,1fr)] ${m.shell} ${chatMode ? "h-full" : ""}`}
        >
          <div
            className={`min-h-0 flex-col lg:flex lg:border-r lg:border-default ${selectedId ? "hidden" : "flex"}`}
          >
            <div className={`p-2.5 ${m.bar} ${m.barTop}`}>
              <div
                role="tablist"
                aria-label="Bildirim durumu"
                className={m.segment}
              >
                {tabBtn("acik", "Açık", open.length)}
                {tabBtn("tamamlanan", "Tamamlanan", done.length)}
              </div>
            </div>
            <nav
              aria-label="Bildirdiğin sorular"
              className={`min-h-0 flex-1 overflow-y-auto ${m.scroll}`}
            >
              {list.length ? (
                <TicketList
                  tickets={list}
                  activeId={active?.id ?? null}
                  onSelect={(id) => go(`bildirim=${id}`)}
                />
              ) : (
                <p className="p-5 text-[15px] leading-relaxed text-muted-foreground">
                  {tab === "acik"
                    ? "Açık bildirimin yok. İncelediğimiz bildirimler “Tamamlanan” sekmesinde."
                    : "Tamamlanan bildirimin yok."}
                </p>
              )}
            </nav>
          </div>
          <section
            aria-label="Yazışma"
            className={`min-h-0 flex-col lg:flex ${selectedId ? "flex" : "hidden"}`}
          >
            {active ? (
              <Conversation
                key={active.id}
                ticket={active}
                onSent={(msg) => append(active.id, msg)}
                onDeleted={() => removeTicket(active.id)}
              />
            ) : (
              <p className={`m-auto p-6 text-[15px] text-muted-foreground`}>
                Soldan bir bildirim seç.
              </p>
            )}
          </section>
        </div>
      </div>
    );

  return (
    <div className={`${roboticFontVars} ${r.root} ${m.vars}`}>
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 sm:px-6 lg:pb-16 lg:pt-10 pb-16 pt-6 sm:pt-8`}
      >
        <div
          className={`flex-col gap-4 ${chatMode ? "hidden lg:flex" : "flex"}`}
        >
          <Link
            href="/profil"
            className={`inline-flex w-fit items-center gap-1 text-sm font-bold hover:underline ${r.accent}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Profilim
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1
                className={`text-3xl font-bold uppercase text-default sm:text-4xl ${r.display}`}
              >
                Bildirdiğim sorular
              </h1>
              <p className="mt-1 text-[15px] text-muted-foreground">
                Hatalı gördüğün sorular ve onlar için ne yaptığımız.
              </p>
            </div>
            {fixedTotal > 0 && (
              <p
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ${r.accent} ${m.jump}`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{" "}
                Senin sayende {fixedTotal} hatalı soru bulundu. Teşekkürler!
              </p>
            )}
          </div>
        </div>
        {body}
      </div>
    </div>
  );
}
