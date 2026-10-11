'use client';

// "Hatalı soru bildir" (2026-10-12): AI soruları admin onayı olmadan yayınlandığı için öğrencinin
// hatayı bildirebildiği güvenlik ağı. Cevap/açıklama açıldıktan sonra görünür, form yerinde açılır
// (test oynatıcısının içinde ikinci bir pencere açmamak için). Yazma report_question RPC'siyle
// (supabase/migrations/question_reports.sql); 3 farklı öğrenci "cevap yanlış" derse soru gizlenir.
import { useId, useState } from 'react';
import Link from 'next/link';
import { Flag } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';

const REASONS = [
  { value: 'wrong_answer', label: 'Cevap yanlış' },
  { value: 'unclear', label: 'Soru anlaşılmıyor' },
  { value: 'typo', label: 'Yazım hatası var' },
  { value: 'other', label: 'Başka bir sorun' },
] as const;
type Reason = (typeof REASONS)[number]['value'];

type State = 'closed' | 'open' | 'sending' | 'sent' | 'error';

export function ReportQuestionButton({ questionId }: { questionId: number }) {
  const { user, supabase } = useAuth();
  const [state, setState] = useState<State>('closed');
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [errorText, setErrorText] = useState('');
  const formId = useId();

  if (state === 'sent') {
    return <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Teşekkürler! Bildirimin bize ulaştı, soruyu kontrol edeceğiz.</p>;
  }

  if (state === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setState('open')}
        aria-expanded={false}
        aria-controls={formId}
        className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-rose-600"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Hatalı soru mu? Bildir
      </button>
    );
  }

  if (!user) {
    return (
      <p id={formId} className="mt-2 text-xs text-muted-foreground">
        Bildirmek için{' '}
        <Link href="/login" className="font-bold text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
          giriş yap
        </Link>
        .{' '}
        <button type="button" onClick={() => setState('closed')} className="font-semibold hover:underline">
          Vazgeç
        </button>
      </p>
    );
  }

  const submit = async () => {
    if (!reason) return;
    setState('sending');
    const { error } = await supabase.rpc('report_question', { p_question_id: questionId, p_reason: reason, p_note: note.trim() || null });
    if (error) {
      setErrorText(error.code === '54000' ? 'Bugün çok fazla bildirim gönderdin, yarın tekrar dene.' : 'Bildirim gönderilemedi, biraz sonra tekrar dene.');
      setState('error');
      return;
    }
    setState('sent');
  };

  return (
    <fieldset id={formId} className="mt-2 flex flex-col gap-2 rounded-xl border border-default bg-background p-3" disabled={state === 'sending'}>
      <legend className="px-1 text-xs font-bold text-default">Bu soruda ne yanlış?</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sorun">
        {REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={reason === r.value}
            onClick={() => setReason(r.value)}
            className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              reason === r.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-default bg-surface text-default hover:border-indigo-400'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        İstersen kısaca açıkla
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={2}
          maxLength={500}
          className="rounded-lg border border-default bg-surface p-2 text-sm text-default"
        />
      </label>
      {state === 'error' && (
        <p role="alert" className="text-xs font-semibold text-rose-600">
          {errorText}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!reason || state === 'sending'}
          className="min-h-9 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {state === 'sending' ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        <button type="button" onClick={() => setState('closed')} className="min-h-9 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:text-default">
          Vazgeç
        </button>
      </div>
    </fieldset>
  );
}
