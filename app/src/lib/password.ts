// Şifre kuralları — kayıt, şifre yenileme ve sunucu (app/api/auth/register) aynı sabiti kullanır.
// Supabase Auth'ta da password_min_length aynı değere ayarlı (2026-10-03, 6 → 8). Eski 6-7
// karakterli şifreler girişte geçerli kalır; kural yalnızca yeni şifre belirlenirken uygulanır.
export const MIN_PASSWORD_LENGTH = 8;

// Karışık okunmayan karakterler (0/O, 1/l/I) dışarıda — öğrenci şifreyi bir yere yazarsa hata yapmasın.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*?-';

function pick(set: string, rnd: number): string {
  return set[rnd % set.length];
}

// Kriptografik rastgelelikle (Math.random değil) güçlü şifre: her gruptan en az bir karakter.
export function generateStrongPassword(length = 14): string {
  const sets = [LOWER, UPPER, DIGITS, SYMBOLS];
  const all = sets.join('');
  const rnd = new Uint32Array(length + sets.length);
  crypto.getRandomValues(rnd);
  const chars = sets.map((set, i) => pick(set, rnd[i]));
  for (let i = chars.length; i < length; i++) chars.push(pick(all, rnd[i]));
  // Grup karakterleri başta toplanmasın diye Fisher–Yates karıştırma.
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = order[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

// Basit, anlaşılır güç tahmini (öğrenciye yönelik ipucu; güvenlik kararı değil).
export function passwordStrength(value: string): PasswordStrength {
  if (!value) return { score: 0, label: 'Harf ve rakam karıştırırsan daha güvenli olur.' };
  if (value.length < MIN_PASSWORD_LENGTH) return { score: 0, label: `Çok kısa, en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` };
  let score = 1;
  if (/[a-zçğıöşü]/i.test(value) && /\d/.test(value)) score++;
  if (value.length >= 12) score++;
  if (/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(value) && /[A-ZÇĞİÖŞÜ]/.test(value)) score++;
  const labels = ['', 'Kabul edilir.', 'İyi.', 'Güçlü.', 'Çok güçlü.'];
  return { score: Math.min(score, 4) as PasswordStrength['score'], label: labels[Math.min(score, 4)] };
}
