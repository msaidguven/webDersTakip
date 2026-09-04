'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

// Sunucudan gelen üye satırları join'li alanlar içerdiği için gevşek tipliyoruz.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = Record<string, any>;
type LookupRow = { id: number; label: string };

const ROLE_LABELS: Record<string, string> = { student: 'Öğrenci', teacher: 'Öğretmen', admin: 'Admin' };

export default function MembersTab() {
  const [grades, setGrades] = useState<LookupRow[]>([]);
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [editRow, setEditRow] = useState<Member | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ ids: string[]; unban?: boolean } | null>(null);

  const showNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('grades').select('id, name').order('order_no');
      setGrades(((data as { id: number; name: string }[] | null) || []).map((g) => ({ id: g.id, label: g.name })));
    })();
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      const res = await fetch(`/api/admin/manage/members?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Liste yüklenemedi');
        setItems([]);
        return;
      }
      setItems(data.items || []);
    } catch {
      showNotice('error', 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [search, role, showNotice]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  function toggleSelectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleBanToggle(ids: string[], hard: boolean, unban?: boolean) {
    const res = await fetch('/api/admin/manage/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, hard, unban }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'İşlem başarısız');
      return;
    }
    const okCount = data.deletedIds?.length ?? 0;
    const failedCount = data.failed?.length ?? 0;
    const actionLabel = hard ? 'kalıcı olarak silindi' : unban ? 'aktifleştirildi' : 'pasifleştirildi (yasaklandı)';
    if (failedCount) {
      const reasons = (data.failed as { id: string; reason: string }[]).map((f) => f.reason).join(' • ');
      showNotice('error', `${okCount} üye ${actionLabel}, ${failedCount} üye için işlem başarısız: ${reasons}`);
    } else {
      showNotice('success', `${okCount} üye ${actionLabel}`);
    }
    setConfirmTarget(null);
    loadList();
  }

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Üyeler</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Kullanıcı hesaplarını görüntüle, düzenle, pasifleştir veya sil</p>
      </header>

      {notice && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-3 sm:p-4 mb-4 flex flex-wrap gap-2 sm:gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm w-36">
            <option value="">Tümü</option>
            <option value="student">Öğrenci</option>
            <option value="teacher">Öğretmen</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Ara</label>
          <div className="flex gap-1">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
              placeholder="İsim veya kullanıcı adı..."
              className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm w-48 sm:w-64"
            />
            <button onClick={() => setSearch(searchInput)} className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground text-sm">
              Ara
            </button>
          </div>
        </div>
        <button onClick={loadList} className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm ml-auto">
          Yenile
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-indigo-300 text-sm font-medium">{selected.size} üye seçili</span>
          <div className="flex-1" />
          <button onClick={() => handleBanToggle(Array.from(selected), false, true)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs sm:text-sm hover:bg-emerald-500/30">
            Aktifleştir
          </button>
          <button onClick={() => setConfirmTarget({ ids: Array.from(selected) })} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-xs sm:text-sm hover:bg-red-500/30">
            Seçilenleri Sil / Pasifleştir
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
          <p className="text-muted-foreground text-sm">Yükleniyor...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
          <p className="text-muted-foreground text-sm">Üye bulunamadı</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="p-3 text-left w-10">
                  <input type="checkbox" checked={selected.size > 0 && selected.size === items.length} onChange={toggleSelectAll} className="accent-indigo-500" />
                </th>
                <th className="p-3 text-left font-medium">Ad Soyad</th>
                <th className="p-3 text-left font-medium">E-posta</th>
                <th className="p-3 text-left font-medium">Rol</th>
                <th className="p-3 text-left font-medium">Sınıf</th>
                <th className="p-3 text-left font-medium">Durum</th>
                <th className="p-3 text-right w-40">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-accent">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="accent-indigo-500" />
                  </td>
                  <td className="p-3 text-foreground">{m.full_name || m.username || '—'}</td>
                  <td className="p-3 text-muted-foreground">{m.email || '—'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300">{ROLE_LABELS[m.role] || m.role}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{m.grades?.name || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${m.banned ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {m.banned ? 'Pasif' : 'Aktif'}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditRow(m)} className="text-indigo-400 hover:text-indigo-300 text-xs mr-3">
                      Düzenle
                    </button>
                    <button onClick={() => setConfirmTarget({ ids: [m.id] })} className="text-red-400 hover:text-red-300 text-xs">
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <MemberEditModal
          row={editRow}
          grades={grades}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); loadList(); }}
          showNotice={showNotice}
        />
      )}

      {confirmTarget && (
        <ConfirmMemberModal
          count={confirmTarget.ids.length}
          onCancel={() => setConfirmTarget(null)}
          onBan={() => handleBanToggle(confirmTarget.ids, false)}
          onHardDelete={() => handleBanToggle(confirmTarget.ids, true)}
        />
      )}
    </div>
  );
}

function MemberEditModal({
  row,
  grades,
  onClose,
  onSaved,
  showNotice,
}: {
  row: Member;
  grades: LookupRow[];
  onClose: () => void;
  onSaved: () => void;
  showNotice: (kind: 'success' | 'error', text: string) => void;
}) {
  const [fullName, setFullName] = useState(row.full_name || '');
  const [username, setUsername] = useState(row.username || '');
  const [roleValue, setRoleValue] = useState(row.role || 'student');
  const [gradeId, setGradeId] = useState(row.grade_id ? String(row.grade_id) : '');
  const [schoolName, setSchoolName] = useState(row.school_name || '');
  const [isVerified, setIsVerified] = useState(!!row.is_verified);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/admin/manage/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [row.id],
        patch: {
          full_name: fullName || null,
          username: username || null,
          role: roleValue,
          grade_id: gradeId ? Number(gradeId) : null,
          school_name: schoolName || null,
          is_verified: isVerified,
        },
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      showNotice('error', data.error || 'Kaydedilemedi');
      return;
    }
    showNotice('success', 'Üye kaydedildi');
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-elevated rounded-xl sm:rounded-2xl border border-border w-full max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-foreground">Üye Düzenle</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Ad Soyad</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Kullanıcı Adı</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Rol</label>
            <select value={roleValue} onChange={(e) => setRoleValue(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500">
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Sınıf</label>
            <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500">
              <option value="">Belirtilmemiş</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-muted-foreground text-xs sm:text-sm mb-1">Okul</label>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-foreground text-sm outline-none focus:border-indigo-500" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
            <span className="text-muted-foreground text-sm">Doğrulanmış hesap</span>
          </label>
        </div>

        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm">İptal</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 text-sm">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmMemberModal({
  count,
  onCancel,
  onBan,
  onHardDelete,
}: {
  count: number;
  onCancel: () => void;
  onBan: () => void;
  onHardDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-elevated rounded-xl sm:rounded-2xl border border-border w-full max-w-md p-4 sm:p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">Ne yapmak istersiniz?</h3>
        <p className="text-muted-foreground text-sm mb-4">
          {count} üye seçildi. &ldquo;Pasifleştir&rdquo; hesabı geri döndürülebilir şekilde askıya alır (giriş yapamaz). &ldquo;Kalıcı Sil&rdquo; hesabı ve tüm
          verilerini kalıcı olarak siler — geri alınamaz.
        </p>
        <div className="flex flex-col gap-2 sm:gap-3">
          <button onClick={onBan} className="px-4 py-2 rounded-xl bg-gray-600 text-white hover:bg-gray-500 text-sm">
            Pasifleştir (Yasakla)
          </button>
          <button onClick={onHardDelete} className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 text-sm">
            Kalıcı Sil
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm">
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
