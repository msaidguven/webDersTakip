'use client';

// Öğretmen profili (2026-10-25): /profil aynı adres, öğretmen öğrenci istatistikleri (seri, halkalar,
// test sayıları) yerine derslerini (teacher_lessons) ve öğretmen araçlarını görür.
import { useState } from 'react';
import Link from 'next/link';
import { ClipboardList, ListChecks, Mail, MailCheck } from 'lucide-react';
import { MAX_TEACHER_LESSONS, TeacherLessonsEditor } from '@/app/src/components/teacher/TeacherLessonsEditor';
import { TeacherVerifiedBadge } from '@/app/src/components/teacher/TeacherVerifiedBadge';
import r from '@/app/src/components/robotic/robotic.module.css';

const TOOLS = [
  { href: '/ogretmen/yazili', label: 'Yazılı hazırla', Icon: ClipboardList },
  { href: '/ogretmen', label: 'Konudan soru seç', Icon: ListChecks },
] as const;

const EMAIL_RESULT: Record<string, { ok: boolean; text: string }> = {
  dogrulandi: { ok: true, text: 'E-posta adresin doğrulandı. Teşekkürler!' },
  'suresi-doldu': { ok: false, text: 'Bağlantının süresi dolmuş. Yeni bir bağlantı gönderebilirsin.' },
  gecersiz: { ok: false, text: 'Bağlantı geçersiz ya da daha önce kullanılmış.' },
};

export function TeacherProfile({ isVerified, emailVerified, emailResult }: { isVerified: boolean; emailVerified: boolean; emailResult: string | null }) {
  return (
    <>
      <section aria-labelledby="derslerim" className={`flex flex-col gap-4 p-5 sm:p-6 ${r.panel}`}>
        <div>
          <h2 id="derslerim" className={r.label}>Derslerim</h2>
          <p className="mt-1 text-sm text-muted-foreground">Girdiğin ya da incelemek istediğin dersleri seç (en fazla {MAX_TEACHER_LESSONS}). Anasayfan ve öğretmen paneli buna göre gelir.</p>
        </div>
        <TeacherLessonsEditor />
      </section>

      <section aria-labelledby="ogretmen-durum" className={`flex flex-col gap-2 p-5 sm:p-6 ${r.panel}`}>
        <h2 id="ogretmen-durum" className={r.label}>Öğretmen hesabı</h2>
        {isVerified && <div><TeacherVerifiedBadge verified /></div>}
        <EmailVerification verified={emailVerified || EMAIL_RESULT[emailResult ?? '']?.ok === true} result={EMAIL_RESULT[emailResult ?? ''] ?? null} />
      </section>

      <nav aria-label="Öğretmen araçları" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOOLS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl p-4 font-bold text-default ${r.item}`}>
            <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

// E-posta doğrulaması (2026-10-28): rozet onayının ön şartı (öğretmene onaydan söz edilmez); bağlantı kayıtta
// gider, buradan yeniden istenir.
function EmailVerification({ verified, result }: { verified: boolean; result: { ok: boolean; text: string } | null }) {
  const [state, setState] = useState<{ busy: boolean; message: { ok: boolean; text: string } | null }>({ busy: false, message: result });

  const send = async () => {
    setState({ busy: true, message: null });
    const res = await fetch('/api/auth/eposta-dogrula/gonder', { method: 'POST' }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setState({ busy: false, message: res?.ok ? { ok: true, text: 'Doğrulama bağlantısı e-postana gönderildi. Gelen kutunu (ve gereksiz klasörünü) kontrol et.' } : { ok: false, text: data?.error || 'Gönderilemedi, tekrar dene.' } });
  };

  return (
    <div className="flex flex-col gap-2">
      {verified ? (
        <p className="flex items-center gap-1.5 text-sm text-default"><MailCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" /> E-posta adresin doğrulandı.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-4 w-4" aria-hidden="true" /> E-posta adresini doğrulayabilirsin.</p>
          <button type="button" onClick={() => void send()} disabled={state.busy} className={`inline-flex min-h-9 items-center rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${r.btnGhost}`}>
            {state.busy ? 'Gönderiliyor…' : 'Doğrulama bağlantısı gönder'}
          </button>
        </div>
      )}
      {state.message && <p role={state.message.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${state.message.ok ? 'text-emerald-500' : 'text-red-500'}`}>{state.message.text}</p>}
    </div>
  );
}
