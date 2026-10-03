import type { ReactNode } from 'react';
import s from './Auth.module.css';

// Giriş, kayıt, şifremi unuttum ve yeni şifre ekranlarının ortak iskeleti: solda form, masaüstünde
// sağda sitenin ne işe yaradığını anlatan sakin sütun (mobilde gizli). Logo yok — sitenin üst menüsü
// bu sayfalarda da görünüyor.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.main}>
          {children}
        </div>
        <aside className={s.aside} aria-label="Ders Takip hakkında">
          <h2 className={s.asideTitle}>Okulda işlenen konular, aynı hafta burada.</h2>
          <ul className={s.points}>
            <li><span className={s.num} aria-hidden="true">1</span><div><b>Konu anlatımı ve sesli anlatım</b><span>MEB müfredatına uygun, sınıfına göre.</span></div></li>
            <li><span className={s.num} aria-hidden="true">2</span><div><b>Cevap anahtarlı sorular</b><span>Yanlış yaptıkların tekrar karşına çıkar.</span></div></li>
            <li><span className={s.num} aria-hidden="true">3</span><div><b>İlerlemen kayıtlı</b><span>Serin, günlük hedefin ve zorlandığın konular.</span></div></li>
          </ul>
          <p className={s.asideFoot}>Ücretsiz. Telefonda, bilgisayarda ve akıllı tahtada çalışır.</p>
        </aside>
      </div>
    </div>
  );
}

export function AuthLoading({ text = 'Yükleniyor…' }: { text?: string }) {
  return (
    <div className={s.page}>
      <p className={s.center} role="status">{text}</p>
    </div>
  );
}

export function AuthBanner({ kind, children, onClose }: { kind: 'ok' | 'err' | 'warn'; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`${s.banner} ${s[kind]}`} role={kind === 'err' ? 'alert' : 'status'}>
      <span aria-hidden="true">{kind === 'ok' ? '✓' : '!'}</span>
      <span>{children}</span>
      {onClose && (
        <button type="button" className={s.bannerClose} onClick={onClose} aria-label="Mesajı kapat">×</button>
      )}
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}

export { s as authStyles };
