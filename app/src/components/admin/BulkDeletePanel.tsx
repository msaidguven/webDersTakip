'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Row = { id: number; label: string };
type UnitSummary = { id: number; title: string; topicCount: number; outcomeCount: number; questionCount: number; contentCount: number };
type Scope = 'unit-questions' | 'unit-topics' | 'unit-contents' | 'grade-lesson-units' | 'grade-lesson-outcomes';

const SCOPE_LABEL: Record<Scope, string> = {
  'unit-questions': 'Soruları Sil',
  'unit-topics': 'Konuları Sil',
  'unit-contents': 'İçerikleri Sil',
  'grade-lesson-units': 'Tüm Üniteleri Sil',
  'grade-lesson-outcomes': 'Tüm Kazanımları Sil',
};

export default function BulkDeletePanel() {
  const [grades, setGrades] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<Row[]>([]);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);

  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ scope: Scope; unitId?: number; title: string; count: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('grades').select('id, name').eq('is_active', true).order('order_no');
      setGrades(((data as { id: number; name: string }[] | null) || []).map((g) => ({ id: g.id, label: g.name })));
    })();
  }, []);

  useEffect(() => {
    setLessonId(null);
    setLessons([]);
    if (gradeId == null) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('lesson_grades').select('lesson_id, lessons(id, name)').eq('grade_id', gradeId);
      type LG = { lesson_id: number; lessons: { id: number; name: string } | { id: number; name: string }[] | null };
      const rows = ((data as LG[] | null) || [])
        .map((r) => (Array.isArray(r.lessons) ? r.lessons[0] : r.lessons))
        .filter((l): l is { id: number; name: string } => !!l)
        .map((l) => ({ id: l.id, label: l.name }));
      setLessons(rows);
    })();
  }, [gradeId]);

  const loadUnits = React.useCallback(async () => {
    if (gradeId == null || lessonId == null) {
      setUnits([]);
      return;
    }
    setLoadingUnits(true);
    try {
      const res = await fetch(`/api/admin/manage/bulk-delete/unit-summary?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json();
      if (res.ok) setUnits(data.units || []);
    } finally {
      setLoadingUnits(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  function openConfirm(scope: Scope, title: string, count: number, unitId?: number) {
    if (!count) return;
    setConfirm({ scope, unitId, title, count });
  }

  async function handleConfirmDelete() {
    if (!confirm) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/manage/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: confirm.scope, gradeId, lessonId, unitId: confirm.unitId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Silinemedi');
        return;
      }
      const parts = [`${data.deletedCount} kayıt silindi`];
      if (data.failed?.length) {
        parts.push(`${data.failed.length} kayıt silinemedi — ${(data.failed as { id: number; reason: string }[]).map((f) => f.reason).join(' • ')}`);
      }
      showNotice(data.failed?.length ? 'error' : 'success', parts.join(' • '));
      loadUnits();
    } catch {
      showNotice('error', 'Silinirken hata oluştu');
    } finally {
      setDeleting(false);
      setConfirm(null);
    }
  }

  const totals = units.reduce(
    (acc, u) => ({
      topics: acc.topics + u.topicCount,
      outcomes: acc.outcomes + u.outcomeCount,
      questions: acc.questions + u.questionCount,
      contents: acc.contents + u.contentCount,
    }),
    { topics: 0, outcomes: 0, questions: 0, contents: 0 }
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <aside className="lg:w-48 shrink-0">
        <p className="text-muted-foreground text-xs uppercase font-medium mb-2">Sınıflar</p>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {grades.map((g) => (
            <SidebarItem key={g.id} active={gradeId === g.id} label={g.label} onClick={() => setGradeId(g.id)} />
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {notice && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl text-sm ${
              notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
            }`}
          >
            {notice.text}
          </div>
        )}

        {gradeId == null ? (
          <EmptyHint text="Başlamak için bir sınıf seçin" />
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {lessons.map((l) => (
                <TabButton key={l.id} active={lessonId === l.id} label={l.label} onClick={() => setLessonId(l.id)} />
              ))}
              {!lessons.length && <p className="text-muted-foreground text-sm px-1 py-2">Bu sınıfta ders yok</p>}
            </div>

            {lessonId == null ? (
              <EmptyHint text="Şimdi bir ders seçin" />
            ) : loadingUnits ? (
              <EmptyHint text="Yükleniyor..." />
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                      <th className="p-3 text-left font-medium">Ünite</th>
                      <th className="p-3 text-left font-medium">Konu</th>
                      <th className="p-3 text-left font-medium">Kazanım</th>
                      <th className="p-3 text-left font-medium">Soru</th>
                      <th className="p-3 text-left font-medium">İçerik</th>
                      <th className="p-3 text-left font-medium">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="bg-surface-elevated">
                      <td className="p-3 text-foreground font-medium">Bu ders + sınıfın tamamı ({units.length} ünite)</td>
                      <td className="p-3 text-muted-foreground">{totals.topics}</td>
                      <td className="p-3 text-muted-foreground">{totals.outcomes}</td>
                      <td className="p-3 text-muted-foreground">{totals.questions}</td>
                      <td className="p-3 text-muted-foreground">{totals.contents}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <DangerButton
                            count={totals.outcomes}
                            onClick={() => openConfirm('grade-lesson-outcomes', SCOPE_LABEL['grade-lesson-outcomes'], totals.outcomes)}
                          >
                            {SCOPE_LABEL['grade-lesson-outcomes']}
                          </DangerButton>
                          <DangerButton
                            count={units.length}
                            onClick={() => openConfirm('grade-lesson-units', SCOPE_LABEL['grade-lesson-units'], units.length)}
                          >
                            {SCOPE_LABEL['grade-lesson-units']}
                          </DangerButton>
                        </div>
                      </td>
                    </tr>
                    {units.map((u) => (
                      <tr key={u.id} className="hover:bg-accent">
                        <td className="p-3 text-foreground">{u.title}</td>
                        <td className="p-3 text-muted-foreground">{u.topicCount}</td>
                        <td className="p-3 text-muted-foreground">{u.outcomeCount}</td>
                        <td className="p-3 text-muted-foreground">{u.questionCount}</td>
                        <td className="p-3 text-muted-foreground">{u.contentCount}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <DangerButton
                              count={u.questionCount}
                              onClick={() => openConfirm('unit-questions', `"${u.title}" — ${SCOPE_LABEL['unit-questions']}`, u.questionCount, u.id)}
                            >
                              {SCOPE_LABEL['unit-questions']}
                            </DangerButton>
                            <DangerButton
                              count={u.topicCount}
                              onClick={() => openConfirm('unit-topics', `"${u.title}" — ${SCOPE_LABEL['unit-topics']}`, u.topicCount, u.id)}
                            >
                              {SCOPE_LABEL['unit-topics']}
                            </DangerButton>
                            <DangerButton
                              count={u.contentCount}
                              onClick={() => openConfirm('unit-contents', `"${u.title}" — ${SCOPE_LABEL['unit-contents']}`, u.contentCount, u.id)}
                            >
                              {SCOPE_LABEL['unit-contents']}
                            </DangerButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!units.length && (
                      <tr>
                        <td className="p-4 text-muted-foreground text-sm" colSpan={6}>
                          Bu ders+sınıfta ünite yok
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          count={confirm.count}
          deleting={deleting}
          onCancel={() => setConfirm(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

function SidebarItem({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-left text-sm whitespace-nowrap transition-all ${
        active ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
        active ? 'bg-indigo-500 text-white' : 'bg-surface text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}

function DangerButton({ children, count, onClick }: { children: React.ReactNode; count: number; onClick: () => void }) {
  if (!count) {
    return (
      <span className="px-2.5 py-1.5 bg-surface text-muted-foreground/60 rounded-lg text-xs whitespace-nowrap cursor-not-allowed">
        {children} (0)
      </span>
    );
  }
  return (
    <button onClick={onClick} className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs whitespace-nowrap">
      {children} ({count})
    </button>
  );
}

function ConfirmModal({
  title,
  count,
  deleting,
  onCancel,
  onConfirm,
}: {
  title: string;
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border w-full max-w-md p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">{title}</h3>
        <p className="text-muted-foreground text-sm">
          <span className="text-red-300 font-semibold">{count} kayıt</span> kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misiniz?
        </p>
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button onClick={onCancel} className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-surface text-foreground hover:bg-accent transition-all text-sm">
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 text-sm"
          >
            {deleting ? 'Siliniyor...' : 'Evet, Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}
