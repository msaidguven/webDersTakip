'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Flag, Loader2, MessageSquareHeart, Send } from 'lucide-react';
import { BottomSheet } from '@/app/src/components/ui/BottomSheet';
import r from '@/app/src/components/robotic/robotic.module.css';
import {
  GENERAL_CATEGORY_OPTIONS,
  STUDENT_AREA_OPTIONS,
  STUDENT_REACTIONS,
  TEACHER_CATEGORY_OPTIONS,
  type FeedbackArea,
  type FeedbackCategory,
  type FeedbackContextData,
  type FeedbackSource,
} from '@/app/src/lib/siteFeedback';

export type FeedbackVariant = 'teacher' | 'student' | 'general';

export interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  variant: FeedbackVariant;
  source: FeedbackSource;
  isAuthenticated?: boolean;
  initialCategory?: FeedbackCategory;
  extraContext?: Partial<FeedbackContextData>;
  onSubmitted?: () => void;
}

export function FeedbackSheet(props: FeedbackSheetProps) {
  if (!props.open) return null;
  return <FeedbackSheetOpen {...props} />;
}

function FeedbackSheetOpen({
  onClose,
  variant,
  source,
  isAuthenticated = true,
  initialCategory,
  extraContext,
  onSubmitted,
}: FeedbackSheetProps) {
  const pathname = usePathname();
  const defaultCat: FeedbackCategory =
    initialCategory ?? (variant === 'teacher' ? 'idea' : variant === 'student' ? 'like' : 'idea');

  const [category, setCategory] = useState<FeedbackCategory>(defaultCat);
  const [area, setArea] = useState<FeedbackArea | null>(null);
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const isNoteOptional = source === 'student_today';
  const canSubmit = !busy && (isNoteOptional || message.trim().length >= 3);

  const activePlaceholder =
    variant === 'teacher'
      ? TEACHER_CATEGORY_OPTIONS.find((o) => o.value === category)?.placeholder ?? 'Görüş veya önerinizi yazın…'
      : variant === 'student'
        ? STUDENT_REACTIONS.find((o) => o.value === category)?.placeholder ?? 'İstersen kısaca not ekleyebilirsin…'
        : 'Görüşünüzü, önerinizi veya karşılaştığınız sorunu kısaca yazın…';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const viewport: 'mobile' | 'desktop' =
        typeof window !== 'undefined' && window.innerWidth < 1024 ? 'mobile' : 'desktop';

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          area,
          message: message.trim() || null,
          source,
          pagePath: pathname,
          senderName: !isAuthenticated ? senderName.trim() || null : undefined,
          senderEmail: !isAuthenticated ? senderEmail.trim() || null : undefined,
          honeypot,
          context: { ...extraContext, viewport },
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || 'Gönderilemedi, lütfen tekrar deneyin.');
        return;
      }
      setSent(true);
      onSubmitted?.();
    } catch {
      setError('Bağlantı hatası oluştu, lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  const sheetTitle =
    variant === 'teacher'
      ? 'Kurucuya Mesaj Gönder'
      : variant === 'student'
        ? 'Ders Takip nasıl gidiyor?'
        : 'Görüş & Hata Bildir';

  const sheetSubtitle =
    variant === 'teacher'
      ? 'Her mesajı bizzat okuyup geliştirme sırasına alıyorum'
      : variant === 'student'
        ? 'Seçimini yap, istersen kısa bir not ekle'
        : 'Fikir, öneri ve hata bildirimleriniz doğrudan bize ulaşır';

  const inputCls =
    'w-full rounded-xl border border-[var(--edge)] bg-[var(--panel-solid)] px-3.5 py-2.5 text-sm text-default outline-none transition-colors focus:border-[var(--neon)]';

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={sheetTitle}
      subtitle={sheetSubtitle}
      icon={<MessageSquareHeart className="h-5 w-5" aria-hidden="true" />}
      footer={
        sent ? (
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}
          >
            Tamam
          </button>
        ) : (
          <button
            type="submit"
            form="site-feedback-sheet-form"
            disabled={!canSubmit}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${r.btnNeon} ${r.btnText}`}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Gönderiliyor…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" /> Gönder
              </>
            )}
          </button>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="text-base font-extrabold text-default">
            {variant === 'teacher' ? 'Çok teşekkür ederim, Hocam!' : 'Teşekkürler, mesajın ulaştı!'}
          </h3>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {variant === 'teacher'
              ? 'Görüşünüz doğrudan notlarıma düştü. İnceleyip gelişme olduğunda bildirim çanınızdan (🔔) size bilgi vereceğim.'
              : isAuthenticated
                ? 'Katkın Ders Takip’i daha iyi hale getirmemize yardımcı oluyor. Yanıt yazdığımızda bildirim çanından görebilirsin.'
                : 'Mesajınızı aldık. E-posta bıraktıysanız en kısa sürede dönüş yapacağız.'}
          </p>
        </div>
      ) : (
        <form id="site-feedback-sheet-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="sr-only"
          />

          {variant === 'student' ? (
            <>
              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">Ne hissediyorsun?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Tepki seçimi">
                  {STUDENT_REACTIONS.map((item) => {
                    const active = category === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setCategory(item.value)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all active:scale-[0.98] ${
                          active
                            ? 'border-[var(--neon)] bg-[color-mix(in_srgb,var(--neon)_12%,var(--panel-solid))] text-[var(--neon)]'
                            : 'border-[var(--edge)] bg-[var(--panel-solid)] text-default hover:border-[var(--neon)]/50'
                        }`}
                      >
                        <span className="text-base leading-none" aria-hidden="true">{item.emoji}</span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">Hangi bölümle ilgili? (isteğe bağlı)</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bölüm seçimi">
                  {STUDENT_AREA_OPTIONS.map((opt) => {
                    const active = area === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setArea(active ? null : opt.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'border-[var(--neon)] bg-[color-mix(in_srgb,var(--neon)_12%,var(--panel-solid))] text-[var(--neon)]'
                            : 'border-[var(--edge)] bg-[var(--panel-solid)] text-muted-foreground hover:text-default'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">Konu başlığı</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Konu başlığı">
                {(variant === 'teacher' ? TEACHER_CATEGORY_OPTIONS : GENERAL_CATEGORY_OPTIONS).map((opt) => {
                  const active = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setCategory(opt.value)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                        active
                          ? 'border-[var(--neon)] bg-[color-mix(in_srgb,var(--neon)_12%,var(--panel-solid))] text-[var(--neon)]'
                          : 'border-[var(--edge)] bg-[var(--panel-solid)] text-muted-foreground hover:text-default'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {category === 'bug' && variant !== 'teacher' && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Belirli bir sorunun cevabı veya metni hatalıysa test içindeki <b>Hatalı Soru</b> bayrağını kullanırsan doğrudan o soruyu inceleyebiliriz.
              </span>
            </p>
          )}

          {!isAuthenticated && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Adınız (isteğe bağlı)
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  maxLength={120}
                  placeholder="Ad Soyad"
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                E-posta (dönüş için isteğe bağlı)
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  maxLength={254}
                  placeholder="ornek@eposta.com"
                  className={`mt-1 ${inputCls}`}
                />
              </label>
            </div>
          )}

          <label className="block text-xs font-bold text-muted-foreground">
            {isNoteOptional ? 'Eklemek istediğin kısa not (isteğe bağlı)' : 'Mesajınız'}
            <textarea
              rows={variant === 'teacher' ? 4 : 3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              required={!isNoteOptional}
              placeholder={activePlaceholder}
              className={`mt-1.5 resize-y ${inputCls}`}
            />
          </label>

          {error && (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </form>
      )}
    </BottomSheet>
  );
}
