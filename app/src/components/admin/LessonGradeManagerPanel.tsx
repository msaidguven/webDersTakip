'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

type GradeItem = {
  id: number;
  name: string;
  orderNo: number;
  isActive: boolean;
  slug: string | null;
};

type LessonItem = {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  orderNo: number;
  isActive: boolean;
  slug: string | null;
  assignedGradeCount: number;
  totalUnitCount: number;
  teacherCount: number;
};

type LessonGradeItem = {
  lessonId: number;
  gradeId: number;
  isActive: boolean;
  weeklyHours: number | null;
  tymmPageUrl: string | null;
  tymmVerified: boolean;
  unitCount: number;
};

type ViewTab = 'by-grade' | 'matrix' | 'catalog';

const EMOJI_PRESETS = ['📖', '🔢', '🔬', '🌍', '🇬🇧', '🕌', '💻', '📜', '🧬', '⚗️', '⚡', '🎨', '🎵', '⚽', '🧭', '📚'];

export default function LessonGradeManagerPanel() {
  const [view, setView] = useState<ViewTab>('by-grade');
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [lessonGrades, setLessonGrades] = useState<LessonGradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);

  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  // Sınıf bazlı hızlı atama state
  const [assignWeeklyHours, setAssignWeeklyHours] = useState<string>('');
  const [quickNewName, setQuickNewName] = useState('');
  const [quickNewIcon, setQuickNewIcon] = useState('📘');
  const [quickNewHours, setQuickNewHours] = useState('');

  // Detay (haftalık saat & TYMM) düzenleme state
  const [expandedPairKey, setExpandedPairKey] = useState<string | null>(null);
  const [hoursDrafts, setHoursDrafts] = useState<Record<string, string>>({});
  const [tymmUrlDrafts, setTymmUrlDrafts] = useState<Record<string, string>>({});

  // Matris filtresi
  const [matrixShowAllGrades, setMatrixShowAllGrades] = useState(false);

  // Katalog state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    icon: '📘',
    description: '',
    orderNo: '',
    isActive: true,
    weeklyHours: '',
    gradeIds: [] as number[],
  });
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    icon: '',
    description: '',
    orderNo: '',
    isActive: true,
  });

  const showNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  }, []);

  const setBusy = useCallback((key: string, on: boolean) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/manage/lessons', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Veriler yüklenemedi');
        return;
      }
      const nextGrades = (data.grades as GradeItem[]) || [];
      setGrades(nextGrades);
      setLessons((data.lessons as LessonItem[]) || []);
      setLessonGrades((data.lessonGrades as LessonGradeItem[]) || []);
      setSelectedGradeId((prev) => {
        if (prev && nextGrades.some((g) => g.id === prev)) return prev;
        const firstActive = nextGrades.find((g) => g.isActive);
        return firstActive?.id ?? nextGrades[0]?.id ?? null;
      });
    } catch {
      showNotice('error', 'Sunucuya bağlanırken hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/manage/lessons', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          showNotice('error', data.error || 'Veriler yüklenemedi');
          return;
        }
        const nextGrades = (data.grades as GradeItem[]) || [];
        setGrades(nextGrades);
        setLessons((data.lessons as LessonItem[]) || []);
        setLessonGrades((data.lessonGrades as LessonGradeItem[]) || []);
        setSelectedGradeId((prev) => {
          if (prev && nextGrades.some((g) => g.id === prev)) return prev;
          const firstActive = nextGrades.find((g) => g.isActive);
          return firstActive?.id ?? nextGrades[0]?.id ?? null;
        });
      } catch {
        if (!cancelled) showNotice('error', 'Sunucuya bağlanırken hata oluştu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showNotice]);

  // Hızlı erişim haritaları
  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);
  const gradeById = useMemo(() => new Map(grades.map((g) => [g.id, g])), [grades]);
  const lgByKey = useMemo(() => new Map(lessonGrades.map((lg) => [`${lg.gradeId}:${lg.lessonId}`, lg])), [lessonGrades]);

  const countByGrade = useMemo(() => {
    const map = new Map<number, { total: number; active: number }>();
    for (const lg of lessonGrades) {
      const cur = map.get(lg.gradeId) ?? { total: 0, active: 0 };
      cur.total += 1;
      if (lg.isActive) cur.active += 1;
      map.set(lg.gradeId, cur);
    }
    return map;
  }, [lessonGrades]);

  const gradesByLesson = useMemo(() => {
    const map = new Map<number, LessonGradeItem[]>();
    for (const lg of lessonGrades) {
      const arr = map.get(lg.lessonId) ?? [];
      arr.push(lg);
      map.set(lg.lessonId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (gradeById.get(a.gradeId)?.orderNo ?? 0) - (gradeById.get(b.gradeId)?.orderNo ?? 0));
    }
    return map;
  }, [lessonGrades, gradeById]);

  // KPI özetleri
  const stats = useMemo(() => {
    const activeGrades = grades.filter((g) => g.isActive).length;
    const activeAssignments = lessonGrades.filter((lg) => lg.isActive).length;
    const draftAssignments = lessonGrades.length - activeAssignments;
    const emptyAssignments = lessonGrades.filter((lg) => lg.unitCount === 0).length;
    return {
      totalGrades: grades.length,
      activeGrades,
      totalLessons: lessons.length,
      totalAssignments: lessonGrades.length,
      activeAssignments,
      draftAssignments,
      emptyAssignments,
    };
  }, [grades, lessons, lessonGrades]);

  const selectedGrade = selectedGradeId != null ? gradeById.get(selectedGradeId) ?? null : null;

  const assignedInSelectedGrade = useMemo(() => {
    if (selectedGradeId == null) return [];
    return lessonGrades
      .filter((lg) => lg.gradeId === selectedGradeId)
      .map((lg) => ({ lg, lesson: lessonById.get(lg.lessonId) }))
      .filter((x): x is { lg: LessonGradeItem; lesson: LessonItem } => Boolean(x.lesson))
      .sort((a, b) => (a.lesson.orderNo - b.lesson.orderNo) || a.lesson.name.localeCompare(b.lesson.name, 'tr'));
  }, [lessonGrades, selectedGradeId, lessonById]);

  const unassignedInSelectedGrade = useMemo(() => {
    if (selectedGradeId == null) return [];
    const assignedIds = new Set(assignedInSelectedGrade.map((x) => x.lesson.id));
    return lessons.filter((l) => !assignedIds.has(l.id));
  }, [lessons, assignedInSelectedGrade, selectedGradeId]);

  const matrixGrades = useMemo(() => {
    if (matrixShowAllGrades) return grades;
    const active = grades.filter((g) => g.isActive);
    return active.length > 0 ? active : grades;
  }, [grades, matrixShowAllGrades]);

  const filteredCatalogLessons = useMemo(() => {
    const q = catalogSearch.trim().toLocaleLowerCase('tr');
    if (!q) return lessons;
    return lessons.filter(
      (l) =>
        l.name.toLocaleLowerCase('tr').includes(q) ||
        (l.slug ?? '').toLocaleLowerCase('tr').includes(q) ||
        (l.description ?? '').toLocaleLowerCase('tr').includes(q)
    );
  }, [lessons, catalogSearch]);

  // ==================== ACTIONS ====================

  async function toggleGradeActive(grade: GradeItem) {
    if (grade.isActive && !window.confirm(`"${grade.name}" sitede gizlensin mi? Bu sınıfın tüm sayfaları ziyaretçilere kapanır.`)) {
      return;
    }
    const key = `grade:${grade.id}`;
    setBusy(key, true);
    try {
      const res = await fetch('/api/admin/manage/grades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId: grade.id, isActive: !grade.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Sınıf güncellenemedi');
        return;
      }
      setGrades((prev) => prev.map((g) => (g.id === grade.id ? { ...g, isActive: !grade.isActive } : g)));
      showNotice('success', `"${grade.name}" ${!grade.isActive ? 'yayına alındı' : 'sitede gizlendi'}`);
    } catch {
      showNotice('error', 'Sınıf güncellenirken hata oluştu');
    } finally {
      setBusy(key, false);
    }
  }

  async function assignLessonToGrade(gradeId: number, lessonId: number, weeklyHoursRaw?: string) {
    const key = `assign:${gradeId}:${lessonId}`;
    setBusy(key, true);
    try {
      const payload: Record<string, unknown> = { gradeId, lessonId };
      if (weeklyHoursRaw && weeklyHoursRaw.trim() !== '') {
        payload.weeklyHours = Number(weeklyHoursRaw);
      }
      const res = await fetch('/api/admin/manage/lesson-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Ders atanamadı');
        return;
      }
      await loadData();
      const lName = lessonById.get(lessonId)?.name ?? 'Ders';
      const gName = gradeById.get(gradeId)?.name ?? 'Sınıf';
      showNotice('success', `"${lName}" → ${gName} sınıfına taslak olarak atandı`);
    } catch {
      showNotice('error', 'Ders atanırken hata oluştu');
    } finally {
      setBusy(key, false);
    }
  }

  async function quickCreateAndAssign(e: React.FormEvent) {
    e.preventDefault();
    if (selectedGradeId == null || !quickNewName.trim()) return;
    const key = 'quick-create';
    setBusy(key, true);
    try {
      const res = await fetch('/api/admin/manage/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickNewName.trim(),
          icon: quickNewIcon.trim() || null,
          gradeIds: [selectedGradeId],
          weeklyHours: quickNewHours.trim() ? Number(quickNewHours) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Ders oluşturulamadı');
        return;
      }
      setQuickNewName('');
      setQuickNewHours('');
      await loadData();
      showNotice('success', `"${quickNewName.trim()}" oluşturuldu ve ${selectedGrade?.name ?? 'sınıfa'} atandı`);
    } catch {
      showNotice('error', 'Ders oluşturulurken hata oluştu');
    } finally {
      setBusy(key, false);
    }
  }

  async function patchLessonGrade(
    gradeId: number,
    lessonId: number,
    patch: { isActive?: boolean; weeklyHours?: number | null; tymmPageUrl?: string | null; tymmVerified?: boolean },
    successMsg?: string
  ) {
    const key = `patch:${gradeId}:${lessonId}`;
    setBusy(key, true);
    try {
      const res = await fetch('/api/admin/manage/lesson-grades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId, lessonId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Güncellenemedi');
        return;
      }
      setLessonGrades((prev) =>
        prev.map((lg) =>
          lg.gradeId === gradeId && lg.lessonId === lessonId
            ? {
                ...lg,
                ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
                ...(patch.weeklyHours !== undefined ? { weeklyHours: patch.weeklyHours } : {}),
                ...(patch.tymmPageUrl !== undefined ? { tymmPageUrl: patch.tymmPageUrl } : {}),
                ...(patch.tymmVerified !== undefined ? { tymmVerified: patch.tymmVerified } : {}),
              }
            : lg
        )
      );
      if (successMsg) showNotice('success', successMsg);
    } catch {
      showNotice('error', 'Güncellenirken hata oluştu');
    } finally {
      setBusy(key, false);
    }
  }

  async function removeLessonFromGrade(gradeId: number, lessonId: number) {
    const lName = lessonById.get(lessonId)?.name ?? 'Bu ders';
    const gName = gradeById.get(gradeId)?.name ?? 'bu sınıf';
    if (!window.confirm(`"${lName}" dersi ${gName} listesinden kaldırılsın mı?`)) return;

    const key = `remove:${gradeId}:${lessonId}`;
    setBusy(key, true);
    try {
      const res = await fetch(`/api/admin/manage/lesson-grades?lessonId=${lessonId}&gradeId=${gradeId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Ders kaldırılamadı');
        return;
      }
      await loadData();
      showNotice('success', `"${lName}" → ${gName} sınıfından kaldırıldı`);
    } catch {
      showNotice('error', 'Ders kaldırılırken hata oluştu');
    } finally {
      setBusy(key, false);
    }
  }

  async function createCatalogLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setBusy('catalog-create', true);
    try {
      const res = await fetch('/api/admin/manage/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          slug: createForm.slug.trim() || undefined,
          icon: createForm.icon.trim() || null,
          description: createForm.description.trim() || null,
          orderNo: createForm.orderNo.trim() ? Number(createForm.orderNo) : undefined,
          isActive: createForm.isActive,
          weeklyHours: createForm.weeklyHours.trim() ? Number(createForm.weeklyHours) : null,
          gradeIds: createForm.gradeIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Ders eklenemedi');
        return;
      }
      setCreateForm({
        name: '',
        slug: '',
        icon: '📘',
        description: '',
        orderNo: '',
        isActive: true,
        weeklyHours: '',
        gradeIds: [],
      });
      setShowCreateForm(false);
      await loadData();
      showNotice('success', 'Yeni ders kataloğa eklendi');
    } catch {
      showNotice('error', 'Ders eklenirken hata oluştu');
    } finally {
      setBusy('catalog-create', false);
    }
  }

  function startEditLesson(lesson: LessonItem) {
    setEditingLessonId(lesson.id);
    setEditForm({
      name: lesson.name,
      slug: lesson.slug ?? '',
      icon: lesson.icon ?? '',
      description: lesson.description ?? '',
      orderNo: String(lesson.orderNo),
      isActive: lesson.isActive,
    });
  }

  async function saveEditLesson(lessonId: number) {
    const key = `edit-lesson:${lessonId}`;
    setBusy(key, true);
    try {
      const res = await fetch('/api/admin/manage/lessons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lessonId,
          name: editForm.name.trim(),
          slug: editForm.slug.trim(),
          icon: editForm.icon.trim() || null,
          description: editForm.description.trim() || null,
          orderNo: Number(editForm.orderNo),
          isActive: editForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Ders güncellenemedi');
        return;
      }
      setEditingLessonId(null);
      await loadData();
      showNotice('success', 'Ders bilgileri güncellendi');
    } catch {
      showNotice('error', 'Güncellenirken hata oluştu');
    } finally {
      setBusy(key, false);
    }
  }

  async function deleteCatalogLesson(lesson: LessonItem) {
    if (!window.confirm(`"${lesson.name}" dersi katalogdan KALICI olarak silinsin mi?`)) return;
    const key = `delete-lesson:${lesson.id}`;
    setBusy(key, true);
    try {
      const res = await fetch(`/api/admin/manage/lessons?lessonId=${lesson.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Ders silinemedi');
        return;
      }
      await loadData();
      showNotice('success', `"${lesson.name}" katalogdan silindi`);
    } catch {
      showNotice('error', 'Silinirken hata oluştu');
    } finally {
      setBusy(key, false);
    }
  }

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 space-y-6 max-w-7xl">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Ders Ata / Ekle / Sil</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sınıflara ders atayın, yayın durumunu ve haftalık saatleri yönetin, ders kataloğunu düzenleyin.
          </p>
        </div>
        <button
          onClick={() => loadData()}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-border bg-card text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          ↻ Yenile
        </button>
      </div>

      {/* Bildirim */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 ${
            notice.kind === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Aktif Sınıf"
          value={`${stats.activeGrades} / ${stats.totalGrades}`}
          sub="Sitede görünür sınıflar"
          accent="indigo"
        />
        <StatCard
          label="Ders Kataloğu"
          value={String(stats.totalLessons)}
          sub="Tanımlı benzersiz ders"
          accent="purple"
        />
        <StatCard
          label="Sınıf–Ders Ataması"
          value={`${stats.activeAssignments} yayında`}
          sub={`${stats.draftAssignments} taslak (toplam ${stats.totalAssignments})`}
          accent="emerald"
        />
        <StatCard
          label="Ünitesi Boş Atama"
          value={String(stats.emptyAssignments)}
          sub="Kaldırılabilir veya içerik bekleyen"
          accent="amber"
        />
      </div>

      {/* Görünüm Sekmeleri */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <TabPill active={view === 'by-grade'} onClick={() => setView('by-grade')} label="📋 Sınıf Bazlı Yönetim" />
        <TabPill active={view === 'matrix'} onClick={() => setView('matrix')} label="🧩 Sınıf × Ders Matrisi" />
        <TabPill active={view === 'catalog'} onClick={() => setView('catalog')} label="📚 Ders Kataloğu (Ekle / Düzenle / Sil)" />
      </div>

      {/* ==================== TAB 1: SINIF BAZLI YÖNETİM ==================== */}
      {view === 'by-grade' && (
        <div className="space-y-5">
          {/* Sınıf Seçici Şerit */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sınıf Seçin</span>
              <span className="text-xs text-muted-foreground">Yeşil nokta: sitede aktif</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {grades.map((g) => {
                const counts = countByGrade.get(g.id) ?? { total: 0, active: 0 };
                const isSelected = g.id === selectedGradeId;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGradeId(g.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                      isSelected
                        ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                        : 'bg-background border-border text-foreground hover:bg-accent'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        g.isActive ? (isSelected ? 'bg-emerald-300' : 'bg-emerald-500') : 'bg-muted-foreground/40'
                      }`}
                    />
                    <span>{g.name}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-accent text-muted-foreground'
                      }`}
                    >
                      {counts.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedGrade && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
              {/* Sol / Ana Alan: Atanmış Dersler */}
              <div className="xl:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-foreground">{selectedGrade.name}</h2>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          selectedGrade.isActive
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {selectedGrade.isActive ? 'Sitede Aktif' : 'Gizli'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {assignedInSelectedGrade.length} ders atanmış
                      {selectedGrade.slug ? ` · /${selectedGrade.slug}` : ''}
                    </p>
                  </div>
                  <button
                    disabled={busyKeys.has(`grade:${selectedGrade.id}`)}
                    onClick={() => toggleGradeActive(selectedGrade)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50 ${
                      selectedGrade.isActive
                        ? 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    {selectedGrade.isActive ? 'Sınıfı Gizle' : 'Sınıfı Yayına Al'}
                  </button>
                </div>

                {assignedInSelectedGrade.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    Bu sınıfa henüz hiç ders atanmamış. Sağdaki panelden mevcut dersleri atayabilir veya yeni ders oluşturabilirsiniz.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {assignedInSelectedGrade.map(({ lg, lesson }) => {
                      const pairKey = `${lg.gradeId}:${lg.lessonId}`;
                      const isExpanded = expandedPairKey === pairKey;
                      const isBusy =
                        busyKeys.has(`patch:${pairKey}`) || busyKeys.has(`remove:${pairKey}`);
                      const hoursValue = hoursDrafts[pairKey] ?? (lg.weeklyHours != null ? String(lg.weeklyHours) : '');
                      const tymmUrlValue = tymmUrlDrafts[pairKey] ?? (lg.tymmPageUrl ?? '');

                      return (
                        <div key={pairKey} className="p-4 hover:bg-accent/30 transition-colors">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Sol: İkon & Ders Adı */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-lg shrink-0">
                                {lesson.icon || '📘'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm sm:text-base text-foreground truncate">
                                    {lesson.name}
                                  </span>
                                  <span
                                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                      lg.unitCount > 0
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    }`}
                                  >
                                    {lg.unitCount > 0 ? `${lg.unitCount} ünite` : 'Ünite yok'}
                                  </span>
                                  {lg.tymmVerified && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                                      TYMM ✓
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  /{lesson.slug || '—'} · Haftalık: {lg.weeklyHours ? `${lg.weeklyHours} saat` : 'Belirtilmedi'}
                                </p>
                              </div>
                            </div>

                            {/* Sağ: Kontroller */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                disabled={isBusy}
                                onClick={() =>
                                  patchLessonGrade(
                                    lg.gradeId,
                                    lg.lessonId,
                                    { isActive: !lg.isActive },
                                    `"${lesson.name}" ${!lg.isActive ? 'yayına alındı' : 'taslağa çekildi'}`
                                  )
                                }
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
                                  lg.isActive
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                                }`}
                              >
                                {lg.isActive ? '● Yayında' : '○ Taslak'}
                              </button>

                              <button
                                onClick={() => setExpandedPairKey(isExpanded ? null : pairKey)}
                                className="px-2.5 py-1.5 rounded-xl text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              >
                                {isExpanded ? 'Kapat ▲' : 'Detay ▼'}
                              </button>

                              <button
                                disabled={isBusy || lg.unitCount > 0}
                                title={
                                  lg.unitCount > 0
                                    ? `Bu derste ${lg.unitCount} ünite var. Önce Yönetim > Toplu Sil'den üniteleri silin.`
                                    : 'Dersi bu sınıftan kaldır'
                                }
                                onClick={() => removeLessonFromGrade(lg.gradeId, lg.lessonId)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Kaldır
                              </button>
                            </div>
                          </div>

                          {/* Detay Düzenleme Satırı */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                              <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                  Haftalık Ders Saati
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={40}
                                  placeholder="Örn: 5"
                                  value={hoursValue}
                                  onChange={(e) => setHoursDrafts((p) => ({ ...p, [pairKey]: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                  TYMM Sayfa URL
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://tymm.meb.gov.tr/..."
                                  value={tymmUrlValue}
                                  onChange={(e) => setTymmUrlDrafts((p) => ({ ...p, [pairKey]: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                                />
                              </div>
                              <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-1">
                                <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={lg.tymmVerified}
                                    disabled={isBusy}
                                    onChange={(e) =>
                                      patchLessonGrade(
                                        lg.gradeId,
                                        lg.lessonId,
                                        { tymmVerified: e.target.checked },
                                        'TYMM doğrulama durumu güncellendi'
                                      )
                                    }
                                    className="rounded border-border"
                                  />
                                  TYMM doğrulandı olarak işaretle
                                </label>
                                <button
                                  disabled={isBusy}
                                  onClick={() =>
                                    patchLessonGrade(
                                      lg.gradeId,
                                      lg.lessonId,
                                      {
                                        weeklyHours: hoursValue.trim() ? Number(hoursValue) : null,
                                        tymmPageUrl: tymmUrlValue.trim() || null,
                                      },
                                      `"${lesson.name}" detayları kaydedildi`
                                    )
                                  }
                                  className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  Değişiklikleri Kaydet
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sağ Panel: Bu Sınıfa Ders Ata & Yeni Ders Oluştur */}
              <div className="space-y-4">
                {/* Mevcut Katalogdan Ata */}
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Katalogdan Ders Ata</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedGrade.name} için henüz atanmamış derslere tıklayıp ekleyin.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Opsiyonel Haftalık Saat (atanacak ders için)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      placeholder="Boş bırakılabilir"
                      value={assignWeeklyHours}
                      onChange={(e) => setAssignWeeklyHours(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                    />
                  </div>

                  {unassignedInSelectedGrade.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center bg-accent/40 rounded-xl">
                      Katalogdaki tüm dersler bu sınıfa zaten atanmış.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {unassignedInSelectedGrade.map((l) => {
                        const key = `assign:${selectedGrade.id}:${l.id}`;
                        const isBusy = busyKeys.has(key);
                        return (
                          <button
                            key={l.id}
                            disabled={isBusy}
                            onClick={() => assignLessonToGrade(selectedGrade.id, l.id, assignWeeklyHours)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-background hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left disabled:opacity-50"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{l.icon || '📘'}</span>
                              <span className="text-xs sm:text-sm font-medium text-foreground truncate">{l.name}</span>
                            </span>
                            <span className="text-xs font-semibold text-indigo-500 shrink-0">+ Ata</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Yeni Ders Oluştur & Bu Sınıfa Ata */}
                <form onSubmit={quickCreateAndAssign} className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Yeni Ders Oluştur & Ata</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Katalogda olmayan bir dersi oluşturup doğrudan {selectedGrade.name} listesine ekler.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={quickNewIcon}
                      onChange={(e) => setQuickNewIcon(e.target.value)}
                      maxLength={4}
                      title="İkon (emoji)"
                      className="w-12 text-center px-2 py-2 rounded-xl bg-background border border-border text-base"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Ders adı (örn. Fizik)"
                      value={quickNewName}
                      onChange={(e) => setQuickNewName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {EMOJI_PRESETS.slice(0, 10).map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => setQuickNewIcon(em)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-colors ${
                          quickNewIcon === em ? 'bg-indigo-500/20 ring-1 ring-indigo-500' : 'hover:bg-accent'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min={1}
                    max={40}
                    placeholder="Haftalık saat (opsiyonel)"
                    value={quickNewHours}
                    onChange={(e) => setQuickNewHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                  />

                  <button
                    type="submit"
                    disabled={busyKeys.has('quick-create') || !quickNewName.trim()}
                    className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {busyKeys.has('quick-create') ? 'Ekleniyor...' : `Oluştur ve ${selectedGrade.name} Sınıfına Ata`}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SINIF × DERS MATRİSİ ==================== */}
      {view === 'matrix' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Sınıf × Ders Atama Matrisi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Boş hücreye tıklayarak dersi taslak atayın; taslak hücreye tıklayarak yayına alın.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={matrixShowAllGrades}
                onChange={(e) => setMatrixShowAllGrades(e.target.checked)}
                className="rounded border-border"
              />
              Pasif sınıfları da göster (1–12)
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-accent/40">
                  <th className="text-left p-3 font-semibold text-foreground sticky left-0 bg-card z-10 min-w-[200px] border-r border-border">
                    Ders
                  </th>
                  {matrixGrades.map((g) => (
                    <th key={g.id} className="p-3 text-center font-semibold text-foreground min-w-[100px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{g.name}</span>
                        <span className={`text-[10px] font-normal ${g.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {g.isActive ? 'Aktif' : 'Gizli'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lessons.map((lesson) => (
                  <tr key={lesson.id} className="hover:bg-accent/20">
                    <td className="p-3 font-medium text-foreground sticky left-0 bg-card z-10 border-r border-border">
                      <div className="flex items-center gap-2">
                        <span>{lesson.icon || '📘'}</span>
                        <span className="truncate max-w-[180px]" title={lesson.name}>
                          {lesson.name}
                        </span>
                      </div>
                    </td>
                    {matrixGrades.map((g) => {
                      const pairKey = `${g.id}:${lesson.id}`;
                      const lg = lgByKey.get(pairKey);
                      const isBusy =
                        busyKeys.has(`assign:${pairKey}`) ||
                        busyKeys.has(`patch:${pairKey}`) ||
                        busyKeys.has(`remove:${pairKey}`);

                      if (!lg) {
                        return (
                          <td key={g.id} className="p-2 text-center">
                            <button
                              disabled={isBusy}
                              onClick={() => assignLessonToGrade(g.id, lesson.id)}
                              title={`${lesson.name} dersini ${g.name} sınıfına ata`}
                              className="w-full py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-500/5 transition-colors disabled:opacity-40"
                            >
                              +
                            </button>
                          </td>
                        );
                      }

                      return (
                        <td key={g.id} className="p-2 text-center">
                          <div
                            className={`rounded-lg px-2 py-1.5 border flex flex-col items-center gap-1 ${
                              lg.isActive
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                patchLessonGrade(
                                  g.id,
                                  lesson.id,
                                  { isActive: !lg.isActive },
                                  `"${lesson.name}" (${g.name}) ${!lg.isActive ? 'yayına alındı' : 'taslağa çekildi'}`
                                )
                              }
                              className="text-[11px] font-semibold hover:underline disabled:opacity-50"
                            >
                              {lg.isActive ? '● Yayında' : '○ Taslak'}
                            </button>
                            <div className="flex items-center gap-1.5 text-[10px] opacity-80">
                              <span>{lg.unitCount} ünite</span>
                              {lg.unitCount === 0 && (
                                <button
                                  disabled={isBusy}
                                  title="Sınıftan kaldır"
                                  onClick={() => removeLessonFromGrade(g.id, lesson.id)}
                                  className="text-red-500 hover:text-red-600 font-bold"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: DERS KATALOĞU ==================== */}
      {view === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              type="search"
              placeholder="Ders adı veya slug ara..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 rounded-xl bg-card border border-border text-sm text-foreground"
            />
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              {showCreateForm ? 'Formu Kapat' : '+ Yeni Ders Ekle'}
            </button>
          </div>

          {/* Yeni Ders Ekle Formu */}
          {showCreateForm && (
            <form onSubmit={createCatalogLesson} className="bg-card border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
              <h3 className="text-sm sm:text-base font-bold text-foreground">Yeni Ders Oluştur</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Ders Adı *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Fizik"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Slug (boşsa otomatik)</label>
                  <input
                    type="text"
                    placeholder="fizik"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm((p) => ({ ...p, slug: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">İkon</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={createForm.icon}
                      onChange={(e) => setCreateForm((p) => ({ ...p, icon: e.target.value }))}
                      className="w-full text-center px-2 py-2 rounded-xl bg-background border border-border text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Sıra No</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Oto"
                      value={createForm.orderNo}
                      onChange={(e) => setCreateForm((p) => ({ ...p, orderNo: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {EMOJI_PRESETS.map((em) => (
                  <button
                    type="button"
                    key={em}
                    onClick={() => setCreateForm((p) => ({ ...p, icon: em }))}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${
                      createForm.icon === em ? 'bg-indigo-500/20 ring-1 ring-indigo-500' : 'hover:bg-accent'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Açıklama (opsiyonel)</label>
                  <input
                    type="text"
                    placeholder="Kısa ders açıklaması"
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Varsayılan Haftalık Saat (atanacak sınıflar için)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    placeholder="Opsiyonel"
                    value={createForm.weeklyHours}
                    onChange={(e) => setCreateForm((p) => ({ ...p, weeklyHours: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Oluştururken Şu Sınıflara da Ata (taslak olarak):
                </label>
                <div className="flex flex-wrap gap-2">
                  {grades.map((g) => {
                    const checked = createForm.gradeIds.includes(g.id);
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() =>
                          setCreateForm((p) => ({
                            ...p,
                            gradeIds: checked ? p.gradeIds.filter((id) => id !== g.id) : [...p.gradeIds, g.id],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                          checked
                            ? 'bg-indigo-500 text-white border-indigo-500'
                            : 'bg-background border-border text-foreground hover:bg-accent'
                        }`}
                      >
                        {checked ? '✓ ' : ''}
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={busyKeys.has('catalog-create') || !createForm.name.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
                >
                  {busyKeys.has('catalog-create') ? 'Kaydediliyor...' : 'Dersi Oluştur'}
                </button>
              </div>
            </form>
          )}

          {/* Ders Kataloğu Listesi */}
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {filteredCatalogLessons.map((lesson) => {
              const isEditing = editingLessonId === lesson.id;
              const assigned = gradesByLesson.get(lesson.id) ?? [];
              const canDelete =
                lesson.assignedGradeCount === 0 && lesson.totalUnitCount === 0 && lesson.teacherCount === 0;
              const deleteReason = !canDelete
                ? [
                    lesson.assignedGradeCount > 0 ? `${lesson.assignedGradeCount} sınıfa atanmış` : '',
                    lesson.totalUnitCount > 0 ? `${lesson.totalUnitCount} ünitesi var` : '',
                    lesson.teacherCount > 0 ? `${lesson.teacherCount} öğretmene bağlı` : '',
                  ]
                    .filter(Boolean)
                    .join(', ')
                : 'Katalogdan kalıcı sil';

              return (
                <div key={lesson.id} className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Ders Adı</label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Slug</label>
                          <input
                            type="text"
                            value={editForm.slug}
                            onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">İkon</label>
                            <input
                              type="text"
                              maxLength={4}
                              value={editForm.icon}
                              onChange={(e) => setEditForm((p) => ({ ...p, icon: e.target.value }))}
                              className="w-full text-center px-2 py-2 rounded-xl bg-background border border-border text-base"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Sıra</label>
                            <input
                              type="number"
                              min={0}
                              value={editForm.orderNo}
                              onChange={(e) => setEditForm((p) => ({ ...p, orderNo: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                            className="rounded border-border"
                          />
                          Ders katalogda aktif
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingLessonId(null)}
                            className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground"
                          >
                            İptal
                          </button>
                          <button
                            disabled={busyKeys.has(`edit-lesson:${lesson.id}`)}
                            onClick={() => saveEditLesson(lesson.id)}
                            className="px-4 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-lg shrink-0">
                          {lesson.icon || '📘'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">#{lesson.orderNo}</span>
                            <span className="font-semibold text-sm sm:text-base text-foreground">{lesson.name}</span>
                            {!lesson.isActive && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                Pasif
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-xs text-muted-foreground mr-1">/{lesson.slug || '—'}</span>
                            {assigned.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic">Hiçbir sınıfa atanmamış</span>
                            ) : (
                              assigned.map((lg) => {
                                const g = gradeById.get(lg.gradeId);
                                if (!g) return null;
                                return (
                                  <span
                                    key={lg.gradeId}
                                    className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                                      lg.isActive
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    }`}
                                  >
                                    {g.name}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-2">
                          {lesson.totalUnitCount} ünite
                        </span>
                        <button
                          onClick={() => startEditLesson(lesson)}
                          className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
                        >
                          Düzenle
                        </button>
                        <button
                          disabled={!canDelete || busyKeys.has(`delete-lesson:${lesson.id}`)}
                          title={deleteReason}
                          onClick={() => deleteCatalogLesson(lesson)}
                          className="px-3 py-1.5 rounded-xl border border-red-500/30 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: 'indigo' | 'purple' | 'emerald' | 'amber';
}) {
  const accentMap = {
    indigo: 'border-indigo-500/25 bg-indigo-500/5',
    purple: 'border-purple-500/25 bg-purple-500/5',
    emerald: 'border-emerald-500/25 bg-emerald-500/5',
    amber: 'border-amber-500/25 bg-amber-500/5',
  };
  return (
    <div className={`rounded-2xl border p-4 ${accentMap[accent]}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-lg sm:text-xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function TabPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
        active
          ? 'bg-indigo-500 text-white shadow-sm'
          : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {label}
    </button>
  );
}
