'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Row = { id: number; label: string };
type LessonRow = { lessonId: number; name: string; isActive: boolean };
type UnitRow = { id: number; title: string; order_no: number; is_active: boolean };

type LessonGradeJoin = {
  lesson_id: number;
  is_active: boolean;
  lessons: { id: number; name: string } | { id: number; name: string }[] | null;
};

export default function PublishManagementPanel() {
  const [grades, setGrades] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);

  const [savingLessonId, setSavingLessonId] = useState<number | null>(null);
  const [savingUnitIds, setSavingUnitIds] = useState<Set<number>>(new Set());
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<number>>(new Set());

  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }

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
    setUnits([]);
    if (gradeId == null) return;
    setLoadingLessons(true);
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('lesson_grades')
        .select('lesson_id, is_active, lessons(id, name)')
        .eq('grade_id', gradeId);
      const rows = ((data as LessonGradeJoin[] | null) || [])
        .map((r) => {
          const lesson = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons;
          if (!lesson) return null;
          return { lessonId: lesson.id, name: lesson.name, isActive: r.is_active };
        })
        .filter((l): l is LessonRow => !!l)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      setLessons(rows);
      setLoadingLessons(false);
    })();
  }, [gradeId]);

  const loadUnits = React.useCallback(async () => {
    if (gradeId == null || lessonId == null) {
      setUnits([]);
      return;
    }
    setSelectedUnitIds(new Set());
    setLoadingUnits(true);
    try {
      const res = await fetch(`/api/admin/manage/units?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json();
      if (res.ok) setUnits(((data.items as UnitRow[] | null) || []).sort((a, b) => a.order_no - b.order_no));
    } finally {
      setLoadingUnits(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const selectedGrade = grades.find((g) => g.id === gradeId) ?? null;
  const selectedLesson = lessons.find((l) => l.lessonId === lessonId) ?? null;

  async function toggleLesson(lesson: LessonRow) {
    if (gradeId == null) return;
    setSavingLessonId(lesson.lessonId);
    try {
      const res = await fetch('/api/admin/manage/lesson-grades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.lessonId, gradeId, isActive: !lesson.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Güncellenemedi');
        return;
      }
      setLessons((prev) => prev.map((l) => (l.lessonId === lesson.lessonId ? { ...l, isActive: !lesson.isActive } : l)));
      showNotice('success', `"${lesson.name}" ${!lesson.isActive ? 'yayına alındı' : 'yayından kaldırıldı'}`);
    } catch {
      showNotice('error', 'Güncellenirken hata oluştu');
    } finally {
      setSavingLessonId(null);
    }
  }

  async function patchUnits(ids: number[], isActive: boolean) {
    if (!ids.length) return;
    setSavingUnitIds((prev) => new Set([...prev, ...ids]));
    try {
      const res = await fetch('/api/admin/manage/units', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, patch: { is_active: isActive } }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Güncellenemedi');
        return;
      }
      setUnits((prev) => prev.map((u) => (ids.includes(u.id) ? { ...u, is_active: isActive } : u)));
      showNotice('success', `${ids.length} ünite ${isActive ? 'yayına alındı' : 'yayından kaldırıldı'}`);
      setSelectedUnitIds(new Set());
    } catch {
      showNotice('error', 'Güncellenirken hata oluştu');
    } finally {
      setSavingUnitIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  function toggleUnitSelection(id: number) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllUnits() {
    setSelectedUnitIds((prev) => (prev.size === units.length ? new Set() : new Set(units.map((u) => u.id))));
  }

  const selectedIds = Array.from(selectedUnitIds);
  const publishedLessonCount = lessons.filter((l) => l.isActive).length;
  const publishedUnitCount = units.filter((u) => u.is_active).length;

  return (
    <div>
      {notice && (
        <div
          className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
            notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'
          }`}
        >
          <span>{notice.kind === 'success' ? '✓' : '✕'}</span>
          {notice.text}
        </div>
      )}

      <div className="flex rounded-2xl border border-white/10 bg-[#111114] overflow-hidden min-h-[600px] shadow-xl shadow-black/20">
        {/* Kolon 1: Sınıflar */}
        <div className="w-52 shrink-0 border-r border-white/5 flex flex-col bg-white/[0.015]">
          <ColumnHeader icon="🎓" label="Sınıflar" count={grades.length} />
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {grades.map((g) => (
              <NavRow key={g.id} active={gradeId === g.id} label={g.label} onClick={() => setGradeId(g.id)} />
            ))}
            {!grades.length && <EmptyColumnHint text="Sınıf yok" />}
          </nav>
        </div>

        {/* Kolon 2: Dersler */}
        <div className="w-72 shrink-0 border-r border-white/5 flex flex-col bg-white/[0.008]">
          <ColumnHeader
            icon="📚"
            label="Dersler"
            count={gradeId == null ? undefined : lessons.length}
            sub={gradeId != null && lessons.length ? `${publishedLessonCount}/${lessons.length} yayında` : undefined}
          />
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {gradeId == null ? (
              <EmptyColumnHint text="Önce bir sınıf seçin" />
            ) : loadingLessons ? (
              <EmptyColumnHint text="Yükleniyor…" />
            ) : !lessons.length ? (
              <EmptyColumnHint text="Bu sınıfta ders yok" />
            ) : (
              lessons.map((l) => (
                <LessonNavRow
                  key={l.lessonId}
                  active={lessonId === l.lessonId}
                  label={l.name}
                  isActive={l.isActive}
                  saving={savingLessonId === l.lessonId}
                  onSelect={() => setLessonId(l.lessonId)}
                  onToggle={() => toggleLesson(l)}
                />
              ))
            )}
          </div>
        </div>

        {/* Kolon 3: Üniteler */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedLesson ? (
            <div className="border-b border-white/5 p-4 flex items-center justify-between gap-4 bg-gradient-to-r from-white/[0.03] to-transparent">
              <div className="min-w-0">
                <p className="text-gray-500 text-xs">{selectedGrade?.label}</p>
                <h2 className="text-white font-bold text-lg truncate">{selectedLesson.name}</h2>
              </div>
              <LabeledSwitch
                checked={selectedLesson.isActive}
                saving={savingLessonId === selectedLesson.lessonId}
                onLabel="Yayında"
                offLabel="Taslak"
                onClick={() => toggleLesson(selectedLesson)}
              />
            </div>
          ) : (
            <ColumnHeader icon="📁" label="Üniteler" />
          )}

          <div className="flex-1 overflow-y-auto">
            {lessonId == null ? (
              <div className="p-8">
                <EmptyColumnHint text="Üniteleri görmek için soldan bir ders seçin" />
              </div>
            ) : loadingUnits ? (
              <div className="p-8">
                <EmptyColumnHint text="Yükleniyor…" />
              </div>
            ) : !units.length ? (
              <div className="p-8">
                <EmptyColumnHint text="Bu ders + sınıfta ünite yok" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <label className="flex items-center gap-2.5 text-xs text-gray-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={units.length > 0 && selectedUnitIds.size === units.length}
                      onChange={toggleSelectAllUnits}
                      className="accent-indigo-500"
                    />
                    {selectedIds.length ? `${selectedIds.length} seçili` : `Tümünü seç · ${publishedUnitCount}/${units.length} yayında`}
                  </label>
                  {selectedIds.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => patchUnits(selectedIds, true)}
                        className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
                      >
                        Yayınla
                      </button>
                      <button
                        onClick={() => patchUnits(selectedIds, false)}
                        className="px-3 py-1.5 bg-slate-500/15 hover:bg-slate-500/25 text-slate-300 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
                      >
                        Yayından Kaldır
                      </button>
                    </div>
                  )}
                </div>
                <ul className="divide-y divide-white/5">
                  {units.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors">
                      <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUnitIds.has(u.id)}
                          onChange={() => toggleUnitSelection(u.id)}
                          className="accent-indigo-500 shrink-0"
                        />
                        <span className="text-[11px] text-gray-600 font-mono w-6 shrink-0">{u.order_no}</span>
                        <span className="text-sm text-gray-200 truncate">{u.title}</span>
                      </label>
                      <LabeledSwitch
                        checked={u.is_active}
                        saving={savingUnitIds.has(u.id)}
                        onLabel="Yayında"
                        offLabel="Taslak"
                        onClick={() => patchUnits([u.id], !u.is_active)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColumnHeader({ icon, label, count, sub }: { icon: string; label: string; count?: number; sub?: string }) {
  return (
    <div className="px-3.5 py-3.5 border-b border-white/5 flex items-center justify-between gap-2">
      <p className="text-gray-400 text-xs uppercase font-bold tracking-wide flex items-center gap-1.5">
        <span>{icon}</span>
        {label}
      </p>
      {(count != null || sub) && <p className="text-gray-600 text-[11px] whitespace-nowrap">{sub ?? count}</p>}
    </div>
  );
}

function NavRow({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm truncate transition-colors border-l-2 ${
        active
          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-400 font-medium'
          : 'text-gray-300 hover:bg-white/5 border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

function LessonNavRow({
  active,
  label,
  isActive,
  saving,
  onSelect,
  onToggle,
}: {
  active: boolean;
  label: string;
  isActive: boolean;
  saving: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={`w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg transition-colors border-l-2 ${
        active ? 'bg-indigo-500/15 border-indigo-400' : 'hover:bg-white/5 border-transparent'
      }`}
    >
      <button
        onClick={onSelect}
        className={`flex-1 min-w-0 text-left text-sm truncate py-1 ${active ? 'text-indigo-300 font-medium' : 'text-gray-300'}`}
      >
        {label}
      </button>
      <MiniSwitch
        checked={isActive}
        saving={saving}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      />
    </div>
  );
}

function MiniSwitch({ checked, saving, onClick }: { checked: boolean; saving: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={checked ? 'Yayında — kapatmak için tıkla' : 'Taslak — yayınlamak için tıkla'}
      onClick={onClick}
      disabled={saving}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? 'bg-emerald-500' : 'bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function LabeledSwitch({
  checked,
  saving,
  onClick,
  onLabel,
  offLabel,
}: {
  checked: boolean;
  saving: boolean;
  onClick: () => void;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <span className={`text-xs font-bold whitespace-nowrap ${checked ? 'text-emerald-300' : 'text-gray-500'}`}>
        {saving ? 'Kaydediliyor…' : checked ? onLabel : offLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onClick}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
          checked ? 'bg-emerald-500' : 'bg-white/15'
        }`}
      >
        <span
          className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function EmptyColumnHint({ text }: { text: string }) {
  return <p className="text-gray-600 text-sm px-2 py-4 text-center">{text}</p>;
}
