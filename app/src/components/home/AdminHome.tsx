'use client';

// Admin anasayfası (2026-10-22). "Acil uyarılar" yalnız admin'in bir şey yapması gereken durumları gösterir;
// ilk kaynak onay bekleyen öğretmenler (/api/admin/alerts), satırdan onaylanır.
// "Öğrenci / Öğretmen anasayfası" düğmeleri o anasayfaları admin'in kendi hesabıyla önizletir (başka
// birinin hesabına bürünme değildir; öğrenci görünümündeki ilerleme verisi admin'in kendi verisidir).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, Check, GraduationCap, LayoutDashboard, Presentation, UserCheck } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';

export type HomePreview = 'student' | 'teacher';

const card = `rounded-[22px] ${r.panel}`;

type PendingTeacher = { id: string; name: string; email: string | null; signedUpAt: string | null; school: string | null; lessons: string[] };

function daysAgo(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'bugün' : `${days} gün önce`;
}

function AlertsSection() {
  const [teachers, setTeachers] = useState<PendingTeacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approved, setApproved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/alerts')
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) setError(data?.error || 'Uyarılar yüklenemedi');
        else setTeachers(data.pendingTeachers ?? []);
      })
      .catch(() => !cancelled && setError('Uyarılar yüklenemedi'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function approve(t: PendingTeacher) {
    if (!window.confirm(`${t.name} öğretmen olarak onaylansın mı?`)) return;
    setBusyId(t.id);
    setError(null);
    const res = await fetch('/api/admin/teachers/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusyId(null);
    if (!res?.ok) {
      setError(data?.error || 'Onaylanamadı');
      return;
    }
    setTeachers((list) => list?.filter((x) => x.id !== t.id) ?? null);
    setApproved(t.name);
  }

  return (
    <section aria-labelledby="uyarilar" className={`flex flex-col gap-3 p-5 sm:p-7 ${card}`}>
      <h2 id="uyarilar" className="flex items-center gap-2 text-lg font-extrabold text-default">
        <BellRing className="h-5 w-5" aria-hidden="true" /> Acil uyarılar
        {!!teachers?.length && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{teachers.length}</span>}
      </h2>
      {approved && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
          <Check className="h-4 w-4" aria-hidden="true" /> {approved} onaylandı, kendisine bildirim gitti.
        </p>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
      {teachers === null && !error ? (
        <div className={`h-16 animate-pulse rounded-xl ${r.item}`} aria-hidden="true" />
      ) : teachers && teachers.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-default">
            <UserCheck className="h-4 w-4" aria-hidden="true" /> Onay bekleyen öğretmenler
          </h3>
          <ul className="flex flex-col gap-2">
            {teachers.map((t) => (
              <li key={t.id} className={`flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between ${r.item}`}>
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-default">
                    {t.name} <span className="font-normal text-muted-foreground">· {daysAgo(t.signedUpAt)}</span>
                  </p>
                  <p className="truncate text-muted-foreground">{t.email ?? 'e-posta yok'}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.lessons.length ? t.lessons.join(', ') : 'Branş seçmemiş'}
                    {t.school ? ` · ${t.school}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => approve(t)}
                  disabled={busyId !== null}
                  className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${r.btnNeon}`}
                >
                  {busyId === t.id ? 'Onaylanıyor…' : 'Onayla'}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Şüpheli hesaplar için Admin paneli → Üyeler.</p>
        </div>
      ) : (
        !error && (
          <p className="rounded-xl border border-dashed border-[var(--edge)] p-5 text-center text-sm text-muted-foreground">
            Şu an gösterilecek uyarı yok.
          </p>
        )
      )}
    </section>
  );
}

export function AdminHome({ firstName, onPreview }: { firstName: string | null; onPreview: (view: HomePreview) => void }) {
  return (
    <section aria-labelledby="admin-baslik" className="flex flex-col gap-6">
      <div className={`flex flex-col gap-5 p-5 sm:p-7 ${card} ${r.hero}`}>
        <span className={r.scan} aria-hidden="true" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={r.label}>Yönetim</p>
            <h1 id="admin-baslik" className={`mt-1 text-[26px] leading-tight sm:text-3xl ${r.chrome}`}>
              {firstName ? `Merhaba, ${firstName}` : 'Merhaba'}
            </h1>
          </div>
          <Link href="/admin" className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Admin paneli
          </Link>
        </div>
        <div className={`flex flex-col gap-2 border-t pt-5 ${r.divider}`}>
          <p className="text-sm text-muted-foreground">Anasayfayı kullanıcıların gördüğü gibi gör:</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button type="button" onClick={() => onPreview('student')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold hover:-translate-y-0.5 ${r.item}`}>
              <span className={`h-9 w-9 shrink-0 ${r.chipBox}`}><GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              Öğrenci anasayfası
            </button>
            <button type="button" onClick={() => onPreview('teacher')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold hover:-translate-y-0.5 ${r.item}`}>
              <span className={`h-9 w-9 shrink-0 ${r.chipBox}`}><Presentation className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              Öğretmen anasayfası
            </button>
          </div>
        </div>
      </div>

      <AlertsSection />
    </section>
  );
}

// Önizleme sırasında sayfanın üstünde durur; admin'e hangi görünümde olduğunu hatırlatır.
export function PreviewBanner({ view, onExit }: { view: HomePreview; onExit: () => void }) {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm">
      <span className="font-semibold text-default">
        Önizleme: {view === 'student' ? 'öğrenci' : 'öğretmen'} anasayfası <span className="font-normal text-muted-foreground">(kendi hesabının verisiyle)</span>
      </span>
      <button type="button" onClick={onExit} className="font-bold text-amber-600 hover:underline dark:text-amber-400">
        Admin anasayfasına dön
      </button>
    </div>
  );
}
