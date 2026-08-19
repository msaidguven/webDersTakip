'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getCurrentCurriculumWeek, getWeekDateRange } from '@/app/src/lib/routeParsing';

type Option = { id: number; name: string };

type EventType = 'break' | 'special_content' | 'social_activity';

type SpecialWeek = {
  id: number;
  gradeId: number | null;
  gradeName: string | null;
  lessonId: number | null;
  lessonName: string | null;
  curriculumWeek: number;
  eventType: EventType;
  title: string;
  subtitle: string | null;
  contentHtml: string | null;
  isActive: boolean;
  priority: number;
};

type FormState = {
  id: number | null;
  curriculumWeek: string;
  eventType: EventType;
  title: string;
  subtitle: string;
  contentHtml: string;
  gradeId: string;
  lessonId: string;
  isActive: boolean;
  priority: string;
};

const EVENT_TYPE_META: Record<EventType, { label: string; icon: string; badge: string }> = {
  break: { label: 'Tatil / Ara Tatil', icon: '🏖️', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  special_content: { label: 'Özel İçerik', icon: '✨', badge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' },
  social_activity: { label: 'Sosyal Etkinlik', icon: '🎉', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
};

const EMPTY_FORM: FormState = {
  id: null,
  curriculumWeek: '',
  eventType: 'break',
  title: '',
  subtitle: '',
  contentHtml: '',
  gradeId: '',
  lessonId: '',
  isActive: true,
  priority: '0',
};

function fmtDay(d: Date) {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export default function CurriculumCalendarPanel() {
  // ---- Eğitim-öğretim yılı başlangıcı ----
  const [termStartDate, setTermStartDate] = useState<string | null>(null);
  const [termStartInput, setTermStartInput] = useState('');
  const [termUpdatedAt, setTermUpdatedAt] = useState<string | null>(null);
  const [loadingTerm, setLoadingTerm] = useState(true);
  const [savingTerm, setSavingTerm] = useState(false);
  const [termNotice, setTermNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const loadTermStart = useCallback(async () => {
    setLoadingTerm(true);
    try {
      const res = await fetch('/api/admin/manage/calendar-settings');
      const data = await res.json();
      if (res.ok) {
        setTermStartDate(data.termStartDate);
        setTermStartInput(data.termStartDate || '');
        setTermUpdatedAt(data.updatedAt);
      }
    } finally {
      setLoadingTerm(false);
    }
  }, []);

  useEffect(() => {
    loadTermStart();
  }, [loadTermStart]);

  async function saveTermStart() {
    if (!termStartInput) return;
    setSavingTerm(true);
    setTermNotice(null);
    try {
      const res = await fetch('/api/admin/manage/calendar-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termStartDate: termStartInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTermNotice({ kind: 'error', text: data.error || 'Kaydedilemedi' });
        return;
      }
      setTermNotice({ kind: 'success', text: 'Başlangıç tarihi güncellendi' });
      loadTermStart();
    } catch {
      setTermNotice({ kind: 'error', text: 'Kaydedilirken hata oluştu (ağ hatası)' });
    } finally {
      setSavingTerm(false);
    }
  }

  const previewWeek = useMemo(() => {
    if (!termStartInput) return null;
    return getCurrentCurriculumWeek(52, termStartInput);
  }, [termStartInput]);

  const previewRange = useMemo(() => {
    if (!termStartInput || !previewWeek) return null;
    const { start, end } = getWeekDateRange(previewWeek, 52, termStartInput);
    return `${fmtDay(start)} – ${fmtDay(end)}`;
  }, [termStartInput, previewWeek]);

  const weekDateHint = useCallback(
    (week: number) => {
      if (!termStartDate) return null;
      const { start, end } = getWeekDateRange(week, 52, termStartDate);
      return `${fmtDay(start)} – ${fmtDay(end)}`;
    },
    [termStartDate]
  );

  // ---- Özel haftalar (tatiller vb.) ----
  const [grades, setGrades] = useState<Option[]>([]);
  const [lessons, setLessons] = useState<Option[]>([]);
  const [items, setItems] = useState<SpecialWeek[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SpecialWeek | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: gradesData }, { data: lessonsData }] = await Promise.all([
        supabase.from('grades').select('id, name').order('order_no'),
        supabase.from('lessons').select('id, name').order('order_no'),
      ]);
      setGrades(((gradesData as Option[] | null) || []));
      setLessons(((lessonsData as Option[] | null) || []));
    })();
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetch('/api/admin/manage/special-weeks');
      const data = await res.json();
      if (res.ok) setItems(data.items || []);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(item: SpecialWeek) {
    setForm({
      id: item.id,
      curriculumWeek: String(item.curriculumWeek),
      eventType: item.eventType,
      title: item.title,
      subtitle: item.subtitle || '',
      contentHtml: item.contentHtml || '',
      gradeId: item.gradeId != null ? String(item.gradeId) : '',
      lessonId: item.lessonId != null ? String(item.lessonId) : '',
      isActive: item.isActive,
      priority: String(item.priority),
    });
  }

  async function submitForm() {
    if (!form) return;
    const week = Number(form.curriculumWeek);
    if (!Number.isFinite(week) || week < 1 || week > 52) {
      showNotice('error', 'Hafta 1-52 arasında olmalı');
      return;
    }
    if (!form.title.trim()) {
      showNotice('error', 'Başlık zorunlu');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: form.id ?? undefined,
        curriculumWeek: week,
        eventType: form.eventType,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        contentHtml: form.contentHtml.trim() || null,
        gradeId: form.gradeId ? Number(form.gradeId) : null,
        lessonId: form.lessonId ? Number(form.lessonId) : null,
        isActive: form.isActive,
        priority: Number(form.priority) || 0,
      };
      const res = await fetch('/api/admin/manage/special-weeks', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Kaydedilemedi');
        return;
      }
      showNotice('success', form.id ? 'Güncellendi' : 'Eklendi');
      setForm(null);
      loadItems();
    } catch {
      showNotice('error', 'Kaydedilirken hata oluştu (ağ hatası)');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: SpecialWeek) {
    try {
      const res = await fetch('/api/admin/manage/special-weeks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          curriculumWeek: item.curriculumWeek,
          eventType: item.eventType,
          title: item.title,
          subtitle: item.subtitle,
          contentHtml: item.contentHtml,
          gradeId: item.gradeId,
          lessonId: item.lessonId,
          isActive: !item.isActive,
          priority: item.priority,
        }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isActive: !it.isActive } : it)));
    } catch {
      showNotice('error', 'Durum güncellenemedi');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/manage/special-weeks?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Silinemedi');
        return;
      }
      showNotice('success', 'Silindi');
      setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id));
    } catch {
      showNotice('error', 'Silinirken hata oluştu');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const visibleItems = typeFilter === 'all' ? items : items.filter((it) => it.eventType === typeFilter);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ---- Eğitim-Öğretim Yılı Başlangıcı ---- */}
      <section className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-lg shrink-0">
            🗓️
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Eğitim-Öğretim Yılı Başlangıcı</h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
              1. haftanın Pazartesi tarihi. Sitedeki tüm &quot;kaçıncı hafta&quot; hesapları buna göre yapılır.
            </p>
          </div>
        </div>

        {loadingTerm ? (
          <p className="text-gray-500 text-sm">Yükleniyor...</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">1. Hafta Başlangıcı</label>
              <input
                type="date"
                value={termStartInput}
                onChange={(e) => setTermStartInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 [color-scheme:dark]"
              />
            </div>

            {previewWeek && previewRange && (
              <div className="px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm">
                <span className="text-indigo-300 font-semibold">Bugün {previewWeek}. hafta</span>
                <span className="text-indigo-300/60"> · {previewRange}</span>
              </div>
            )}

            <button
              onClick={saveTermStart}
              disabled={savingTerm || !termStartInput || termStartInput === termStartDate}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-all shrink-0"
            >
              {savingTerm ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}

        {termUpdatedAt && (
          <p className="text-gray-600 text-xs mt-3">Son güncelleme: {new Date(termUpdatedAt).toLocaleString('tr-TR')}</p>
        )}

        {termNotice && (
          <div
            className={`mt-4 px-4 py-3 rounded-xl text-sm ${
              termNotice.kind === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-300 border border-red-500/30'
            }`}
          >
            {termNotice.text}
          </div>
        )}
      </section>

      {/* ---- Özel Haftalar ---- */}
      <section className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-lg shrink-0">
              🏖️
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Özel Haftalar</h2>
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Bayram tatilleri, ara tatiller ve diğer özel haftalar</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-all shrink-0"
          >
            + Yeni Ekle
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          <FilterPill active={typeFilter === 'all'} label="Tümü" onClick={() => setTypeFilter('all')} />
          {(Object.keys(EVENT_TYPE_META) as EventType[]).map((t) => (
            <FilterPill key={t} active={typeFilter === t} label={`${EVENT_TYPE_META[t].icon} ${EVENT_TYPE_META[t].label}`} onClick={() => setTypeFilter(t)} />
          ))}
        </div>

        {notice && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl text-sm ${
              notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
            }`}
          >
            {notice.text}
          </div>
        )}

        {loadingItems ? (
          <p className="text-gray-500 text-sm py-8 text-center">Yükleniyor...</p>
        ) : !visibleItems.length ? (
          <div className="text-center py-10 sm:py-14">
            <p className="text-gray-500 text-sm">Henüz özel hafta eklenmemiş.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleItems.map((item) => {
              const meta = EVENT_TYPE_META[item.eventType];
              const dateHint = weekDateHint(item.curriculumWeek);
              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all ${
                    item.isActive ? 'bg-white/[0.03] border-white/5' : 'bg-white/[0.01] border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:w-28 shrink-0">
                    <div className="w-11 h-11 rounded-lg bg-white/5 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] text-gray-500 font-bold uppercase leading-none">Hafta</span>
                      <span className="text-white font-bold text-sm leading-tight">{item.curriculumWeek}</span>
                    </div>
                    {dateHint && <span className="text-gray-500 text-xs sm:hidden">{dateHint}</span>}
                  </div>

                  <div className="hidden sm:block text-gray-500 text-xs w-28 shrink-0">{dateHint || '—'}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.badge}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <p className="text-white font-semibold text-sm truncate">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {item.subtitle && <p className="text-gray-400 text-xs truncate">{item.subtitle}</p>}
                      <span className="text-gray-600 text-xs">
                        {item.gradeName || 'Tüm sınıflar'} · {item.lessonName || 'Tüm dersler'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => toggleActive(item)}
                      title={item.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                      className={`relative w-10 h-6 rounded-full transition-colors ${item.isActive ? 'bg-indigo-500' : 'bg-white/10'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          item.isActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                      title="Düzenle"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-all"
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {form && (
        <FormModal
          form={form}
          setForm={setForm}
          grades={grades}
          lessons={lessons}
          saving={saving}
          weekDateHint={weekDateHint}
          onCancel={() => setForm(null)}
          onSubmit={submitForm}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/10 w-full max-w-md p-4 sm:p-6">
            <h3 className="text-lg font-bold text-white mb-2">&quot;{deleteTarget.title}&quot; silinsin mi?</h3>
            <p className="text-gray-400 text-sm mb-4">Bu özel hafta kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 text-sm">
                Vazgeç
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 text-sm"
              >
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
        active ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function FormModal({
  form,
  setForm,
  grades,
  lessons,
  saving,
  weekDateHint,
  onCancel,
  onSubmit,
}: {
  form: FormState;
  setForm: (updater: (prev: FormState | null) => FormState | null) => void;
  grades: Option[];
  lessons: Option[];
  saving: boolean;
  weekDateHint: (week: number) => string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const week = Number(form.curriculumWeek);
  const dateHint = Number.isFinite(week) && week >= 1 && week <= 52 ? weekDateHint(week) : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/10 w-full max-w-lg p-4 sm:p-6 my-8">
        <h3 className="text-lg font-bold text-white mb-4">{form.id ? 'Özel Haftayı Düzenle' : 'Yeni Özel Hafta'}</h3>

        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Hafta No (1-52)</label>
              <input
                type="number"
                min={1}
                max={52}
                value={form.curriculumWeek}
                onChange={(e) => update('curriculumWeek', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="ör. 12"
              />
              {dateHint && <p className="text-gray-500 text-xs mt-1">{dateHint}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Tür</label>
              <select
                value={form.eventType}
                onChange={(e) => update('eventType', e.target.value as EventType)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {(Object.keys(EVENT_TYPE_META) as EventType[]).map((t) => (
                  <option key={t} value={t} className="bg-[#111114]">
                    {EVENT_TYPE_META[t].icon} {EVENT_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Başlık</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="ör. Yarıyıl Tatili"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Alt Başlık (opsiyonel)</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => update('subtitle', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="ör. 2 hafta sürer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Sınıf</label>
              <select
                value={form.gradeId}
                onChange={(e) => update('gradeId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="" className="bg-[#111114]">Tüm sınıflar</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id} className="bg-[#111114]">{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Ders</label>
              <select
                value={form.lessonId}
                onChange={(e) => update('lessonId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="" className="bg-[#111114]">Tüm dersler</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id} className="bg-[#111114]">{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">İçerik (opsiyonel, HTML)</label>
            <textarea
              value={form.contentHtml}
              onChange={(e) => update('contentHtml', e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
              placeholder="Bu hafta özel olarak gösterilecek içerik (varsa)"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <span className="text-sm text-gray-300">Aktif (sitede/hesaplamalarda dikkate alınsın)</span>
          </label>
        </div>

        <div className="flex gap-2 sm:gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all text-sm">
            Vazgeç
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-all text-sm"
          >
            {saving ? 'Kaydediliyor...' : form.id ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}
