// Kullanıcı adı kuralı — kayıt formu, /api/auth/register ve /api/profile/update AYNI
// kuralı kullanır; DB'deki profiles_username_format CHECK'i ve make_unique_username()
// (bkz. supabase/migrations/username_auto_and_profile_prompt.sql) bununla birebir aynı.
// Nokta serbest: Google kullanıcılarına e-postanın @ öncesinden otomatik ad veriliyor
// (ör. ferit63.azad63) ve mobil uygulamadan gelen mevcut adlar da nokta içeriyor.
// Baş/son nokta ve ardışık nokta yok. 30 = Gmail kullanıcı adı üst sınırı.
export const USERNAME_PATTERN = /^(?=.{3,30}$)[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;

export const USERNAME_RULES_MESSAGE =
  'Kullanıcı adı 3-30 karakter olmalı; küçük harf, rakam, alt çizgi (_) ve nokta (.) içerebilir';

const TR_FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

// Yazarken anında uygulanan hafif düzeltme: küçük harf + Türkçe karakter katlama +
// izin verilmeyen karakterleri atma. Tam doğrulama USERNAME_PATTERN ile.
export function normalizeUsernameInput(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (ch) => TR_FOLD[ch] ?? ch)
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 30);
}
