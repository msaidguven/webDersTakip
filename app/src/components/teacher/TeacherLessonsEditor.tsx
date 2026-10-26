'use client';

// Öğretmenin ders listesi (teacher_lessons) seçici — profil (Derslerim) ve öğretmen anasayfasındaki
// "Derslerimi düzenle" aynı bileşeni kullanır. Öğretmen paneli "Derslerim" ve ders filtresi de bu listeden.
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/src/context/AuthContext';
import r from '@/app/src/components/robotic/robotic.module.css';

type Lesson = { id: number; name: string };

export const MAX_TEACHER_LESSONS = 10;

export function TeacherLessonsEditor({ onSaved }: { onSaved?: () => void }) {
  const { user, supabase } = useAuth();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: lessonRows }, { data: mineRows }] = await Promise.all([
        supabase.from('lessons').select('id, name').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('teacher_lessons').select('lesson_id').eq('teacher_id', user.id),
      ]);
      if (cancelled) return;
      const mine = new Set(((mineRows as { lesson_id: number }[] | null) || []).map((row) => row.lesson_id));
      setLessons((lessonRows as Lesson[] | null) || []);
      setSaved(mine);
      setSelected(new Set(mine));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const toggle = (id: number) => {
    setMessage(null);
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_TEACHER_LESSONS) next.add(id);
      return next;
    });
  };

  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));

  const handleSave = async () => {
    if (!selected.size) {
      setMessage({ ok: false, text: 'En az bir ders seçmelisin' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonIds: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
      setSaved(new Set(selected));
      setMessage({ ok: true, text: 'Derslerin kaydedildi' });
      onSaved?.();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {lessons === null ? (
        <div aria-busy="true" aria-label="Dersler yükleniyor" className="h-24 animate-pulse rounded-xl bg-surface" />
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Dersler">
          {lessons.map((l) => {
            const on = selected.has(l.id);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(l.id)}
                  disabled={!on && selected.size >= MAX_TEACHER_LESSONS}
                  className={`min-h-10 rounded-xl px-3.5 text-sm font-semibold disabled:opacity-40 ${r.item} ${on ? r.navActive : 'text-muted-foreground'}`}
                >
                  {l.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || saving || lessons === null}
          className={`inline-flex min-h-10 items-center justify-center rounded-xl px-5 text-sm font-bold disabled:opacity-50 ${r.btnNeon} ${r.btnText}`}
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${message.ok ? r.accent : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
