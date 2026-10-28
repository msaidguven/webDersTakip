'use client';

// Üyeye günde en fazla BİR açılır pencere (2026-10-28, kullanıcı kararı; hiçbiri zorunlu değil):
//   1. sınıfı seçilmemiş öğrenci → pencerede sınıf seçer
//   2. branşı (teacher_lessons) seçilmemiş öğretmen → pencerede branş seçer
//   3. bildirdiği soruya cevap gelen / bildirimi kapanan üye → okunmamış bildirimler (notifications) özetlenir
// "Günde bir" o cihaz için (localStorage, TR günü): pencere gösterilince o günün hakkı biter, "Sonra" deyince de.
// Admin, giriş/kayıt ve profil sayfalarında (OAuth tamamlama orada) gösterilmez.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { clearMyProfileCache, fetchMyProfile } from '@/app/src/lib/myProfileClient';
import { TeacherLessonsEditor } from '@/app/src/components/teacher/TeacherLessonsEditor';
import r from '@/app/src/components/robotic/robotic.module.css';

const DAY_KEY = 'member-prompt-day';
const REPORT_TYPES = ['question_report_reply', 'question_report_closed'];
const HIDDEN_PREFIXES = ['/admin', '/profil', '/login', '/register', '/auth', '/sifremi-unuttum', '/sifre-yenile'];

type Prompt =
  | { kind: 'grade' }
  | { kind: 'lessons' }
  | { kind: 'reports'; ids: number[]; title: string; body: string | null; link: string };

const trDay = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

function shownToday(): boolean {
  try {
    return localStorage.getItem(DAY_KEY) === trDay();
  } catch {
    return false;
  }
}

function markShown() {
  try {
    localStorage.setItem(DAY_KEY, trDay());
  } catch {
    /* depolama kapalıysa pencere bir sonraki açılışta yine gelebilir */
  }
}

export function MemberPromptModal() {
  const pathname = usePathname() ?? '';
  const { user, supabase } = useAuth();
  const userId = user?.id;
  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    if (!userId || hidden || shownToday()) return;
    let cancelled = false;
    (async () => {
      const data = await fetchMyProfile(userId);
      const profile = data?.profile as { role?: string; grade_id?: number | null; onboarding_completed?: boolean } | null;
      if (!profile || profile.onboarding_completed === false) return;

      let next: Prompt | null = null;
      if (profile.role === 'student' && !profile.grade_id) next = { kind: 'grade' };
      else if (profile.role === 'teacher') {
        const { count } = await supabase.from('teacher_lessons').select('lesson_id', { count: 'exact', head: true }).eq('teacher_id', userId);
        if (count === 0) next = { kind: 'lessons' };
      }
      if (!next) {
        const { data: rows } = await supabase
          .from('notifications')
          .select('id, title, body, link')
          .eq('user_id', userId)
          .in('type', REPORT_TYPES)
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(20);
        const list = (rows as { id: number; title: string; body: string | null; link: string | null }[] | null) ?? [];
        if (list.length) {
          next = list.length === 1
            ? { kind: 'reports', ids: [list[0].id], title: list[0].title, body: list[0].body, link: list[0].link ?? '/profil/bildirdigim-sorular' }
            : { kind: 'reports', ids: list.map((n) => n.id), title: `Bildirdiğin ${list.length} soruya cevap geldi`, body: null, link: '/profil/bildirdigim-sorular' };
        }
      }
      if (cancelled || !next || shownToday()) return;
      markShown();
      setPrompt(next);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [userId, hidden, supabase]);

  if (!prompt) return null;
  const close = () => setPrompt(null);

  const content =
    prompt.kind === 'grade' ? (
      <GradePicker onSaved={close} />
    ) : prompt.kind === 'lessons' ? (
      <>
        <p className="text-sm text-muted-foreground">Branşını seçersen anasayfan ve öğretmen panelin derslerine göre gelir. Birden fazla ders seçebilirsin.</p>
        <TeacherLessonsEditor onSaved={close} />
      </>
    ) : (
      <>
        {prompt.body && <p className="text-sm text-default">{prompt.body}</p>}
        <div className="flex flex-wrap gap-3">
          <Link
            href={prompt.link}
            onClick={() => {
              close();
              // Görmeye gidince okundu sayılır (bildirim zilinde de düşer); "Sonra" okunmamış bırakır.
              void supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', prompt.ids);
            }}
            className={`inline-flex min-h-10 items-center rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}
          >
            Cevabı gör
          </Link>
        </div>
      </>
    );

  const title = prompt.kind === 'grade' ? 'Sınıfını seç' : prompt.kind === 'lessons' ? 'Branşını seç' : prompt.title;

  return <PromptDialog title={title} onClose={close}>{content}</PromptDialog>;
}

function PromptDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="uye-pencere-baslik"
        className={`${r.themeVars} flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl p-5 sm:max-w-lg sm:rounded-2xl ${r.menu}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="uye-pencere-baslik" className={`text-lg font-bold ${r.display} ${r.ink}`}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${r.btnGhost}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
        <button type="button" onClick={onClose} className="self-start text-sm font-semibold text-muted-foreground hover:underline">
          Sonra
        </button>
      </div>
    </div>
  );
}

function GradePicker({ onSaved }: { onSaved: () => void }) {
  const { supabase } = useAuth();
  const router = useRouter();
  const [grades, setGrades] = useState<{ id: number; name: string }[] | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('grades').select('id, name').eq('is_active', true).order('order_no')
      .then(({ data }) => setGrades((data as { id: number; name: string }[] | null) ?? []));
  }, [supabase]);

  const save = async (id: number) => {
    setSaving(id);
    setError(null);
    const res = await fetch('/api/profile/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch: { grade_id: id } }),
    }).catch(() => null);
    setSaving(null);
    if (!res?.ok) return setError('Kaydedilemedi, tekrar dene.');
    clearMyProfileCache();
    onSaved();
    router.refresh();
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">Sınıfını seçersen anasayfan, günün sorusu ve önerilen konular sınıfına göre gelir. Sonra profilinden değiştirebilirsin.</p>
      {grades === null ? (
        <div aria-busy="true" aria-label="Sınıflar yükleniyor" className="h-24 animate-pulse rounded-xl bg-surface" />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Sınıflar">
          {grades.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => void save(g.id)}
                disabled={saving !== null}
                className={`min-h-11 w-full rounded-xl px-3 text-sm font-semibold disabled:opacity-50 ${r.item}`}
              >
                {saving === g.id ? 'Kaydediliyor…' : g.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
    </>
  );
}
