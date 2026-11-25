'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { GENERAL_CATEGORY_OPTIONS, type FeedbackCategory } from '@/app/src/lib/siteFeedback';

export function ContactForm() {
  const { isAuthenticated } = useAuth();
  const renderedAtRef = useRef<number>(0);

  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    renderedAtRef.current = Date.now();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || message.trim().length < 3) return;

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
          message: message.trim(),
          source: 'contact_page',
          pagePath: '/iletisim',
          senderName: !isAuthenticated ? senderName.trim() || null : undefined,
          senderEmail: !isAuthenticated ? senderEmail.trim() || null : undefined,
          honeypot,
          formRenderedAt: renderedAtRef.current,
          context: { viewport },
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || 'Mesaj gönderilemedi, lütfen tekrar deneyin.');
        return;
      }
      setSent(true);
      setMessage('');
    } catch {
      setError('Bağlantı hatası oluştu, lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div className="space-y-1.5">
            <h2 className="!mt-0 !mb-0 text-base font-extrabold text-default">Mesajınız bize ulaştı</h2>
            <p className="!text-sm text-muted-foreground">
              {isAuthenticated
                ? 'Katkınız için teşekkür ederiz. Yanıt yazdığımızda üst menüdeki bildirim çanından (🔔) görebilirsiniz.'
                : 'Katkınız için teşekkür ederiz. E-posta adresi bıraktıysanız en kısa sürede dönüş yapacağız.'}
            </p>
            <button
              type="button"
              onClick={() => {
                renderedAtRef.current = Date.now();
                setSent(false);
              }}
              className="mt-2 inline-flex text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Yeni bir mesaj gönder
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-xl border border-default bg-surface px-3.5 py-2.5 text-sm text-default outline-none transition-colors focus:border-indigo-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-default bg-surface-elevated p-5 sm:p-6">
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

      <div>
        <span className="block text-xs font-bold text-default mb-2">Konu</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="İletişim konusu">
          {GENERAL_CATEGORY_OPTIONS.map((opt) => {
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
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'border-default bg-surface text-muted-foreground hover:text-default'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-default">
            Adınız (isteğe bağlı)
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={120}
              placeholder="Ad Soyad"
              className={`mt-1.5 font-normal ${inputCls}`}
            />
          </label>
          <label className="block text-xs font-bold text-default">
            E-posta (dönüş bekliyorsanız)
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              maxLength={254}
              placeholder="ornek@eposta.com"
              className={`mt-1.5 font-normal ${inputCls}`}
            />
          </label>
        </div>
      ) : (
        <p className="!text-xs text-muted-foreground">
          Giriş yaptığınız için bilgileriniz otomatik eklenir; yanıtımızı üst menüdeki bildirim çanından (🔔) takip edebilirsiniz.
        </p>
      )}

      <label className="block text-xs font-bold text-default">
        Mesajınız
        <textarea
          rows={4}
          required
          minLength={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Önerinizi, sorunuzu veya karşılaştığınız hatayı yazabilirsiniz…"
          className={`mt-1.5 resize-y font-normal ${inputCls}`}
        />
      </label>

      {error && (
        <p role="alert" className="!text-xs font-bold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || message.trim().length < 3}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Gönderiliyor…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" /> Mesajı Gönder
          </>
        )}
      </button>
    </form>
  );
}
