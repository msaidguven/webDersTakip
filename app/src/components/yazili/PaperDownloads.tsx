'use client';

// Örnek sınav kağıdı indirme düğmeleri — 2026-10-25'ten beri yalnız admin ve onaylı öğretmen görür
// (kullanıcı kararı, "şimdilik"); öğrenci ve misafir için hiçbir şey çizilmez. Sayfa ISR'da misafir HTML'i
// olarak önbellekte durduğu için rol tarayıcıda okunur (fetchMyProfile, 30 dk önbellekli). PDF route'u da
// ayrıca requireTeacher ister.
import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchMyProfile } from '@/app/src/lib/myProfileClient';
import r from '@/app/src/components/robotic/robotic.module.css';

type ProfileRole = { profile: { role: string | null; is_verified: boolean | null } | null } | null;

// Admin ya da onaylı öğretmen mi? (yazılı sayfasında öğretmen bölümünü açık başlatmak için de kullanılır)
export function useIsTeacherOrAdmin(): boolean {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<{ userId: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyProfile(user.id).then((data) => {
      const p = (data as ProfileRole)?.profile;
      if (!cancelled) setAllowed({ userId: user.id, ok: p?.role === 'admin' || (p?.role === 'teacher' && !!p.is_verified) });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);
  return !!user && allowed?.userId === user.id && allowed.ok;
}

export function PaperDownloads({ pdfBase, scenario, hasB }: { pdfBase: string; scenario: number; hasB: boolean }) {
  const canDownload = useIsTeacherOrAdmin();
  if (!canDownload) return null;
  const link = (v: 1 | 2, key: boolean, label: string) => (
    <a
      href={`${pdfBase}?s=${scenario}&v=${v}${key ? '&anahtar=1' : ''}`}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${key ? r.btnGhost : `${r.btnNeon} ${r.btnText}`}`}
    >
      <FileDown className="h-4 w-4" aria-hidden="true" /> {label}
    </a>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {link(1, false, 'A kağıdı')}
      {link(1, true, 'A cevap anahtarı')}
      {hasB && link(2, false, 'B kağıdı')}
      {hasB && link(2, true, 'B cevap anahtarı')}
    </div>
  );
}
