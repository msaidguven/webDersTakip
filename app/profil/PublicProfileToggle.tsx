'use client';

// Üye profil kartı göster/gizle (2026-10-20, kullanıcı kararı: varsayılan AÇIK, isteyen gizler; metin
// kısa ve korkutmayan — uzun izin açıklaması çocukları tedirgin ediyordu).
// Açıkken diğer üyeler sıralamada adına tıklayıp kartını görür: ad, fotoğraf, sınıf, seri, soru sayıları.
// Kullanıcı adı, e-posta, okul, il/ilçe hiçbir zaman görünmez (bkz. public_profile_card.sql).
// Profil sayfasında ve Ayarlar → Hesap'ta aynı bileşen kullanılır.
import Link from 'next/link';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clearMyProfileCache } from '@/app/src/lib/myProfileClient';
import r from '@/app/src/components/robotic/robotic.module.css';

export function PublicProfileToggle({ slug, initialOn, onChange }: { slug: string | null; initialOn: boolean; onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(initialOn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !on;
    setSaving(true);
    setError(null);
    setOn(next); // iyimser; hata olursa geri alınır
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { public_profile: next } }),
      });
      if (!res.ok) throw new Error();
      clearMyProfileCache();
      onChange?.(next);
    } catch {
      setOn(!next);
      setError('Kaydedilemedi, tekrar dener misin?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="profil-gorunurluk" className={`flex flex-col gap-4 p-5 sm:p-6 ${r.panel} ${on ? r.neonBorder : ''}`}>
      <div className="flex items-start gap-4">
        <span className={`h-11 w-11 shrink-0 ${r.chipBox}`} aria-hidden="true">
          {on ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="profil-gorunurluk" className={`text-base font-bold uppercase text-default ${r.display}`}>Profil kartım</h2>
          <p className={`mt-0.5 text-sm font-semibold ${on ? r.accent : 'text-muted-foreground'}`} aria-live="polite">
            {on ? 'Profilin görünür' : 'Profilin gizli'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="profil-gorunurluk"
          disabled={saving}
          onClick={() => void toggle()}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${on ? `${r.btnNeon} border-transparent` : 'border-[var(--edge)] bg-[var(--track)]'}`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
      {slug && (
        <Link href={`/uye/${slug}`} className={`w-fit text-sm font-semibold hover:underline ${r.accent}`}>
          Kartımı gör →
        </Link>
      )}
    </section>
  );
}
