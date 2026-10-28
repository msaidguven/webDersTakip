// Öğretmen kaydında okul (2026-10-28): İSTEĞE BAĞLI (kullanıcı kararı — resmî okulda çalışmayan öğretmenler de
// kullanabilsin; onay için zorunlu tutmak ileride düşünülecek). Verildiyse doğrulanır; admin onayı okul + branş +
// ad soyad ile yapılır. Kayıt (api/auth/register) ve Google ile ilk girişte rol tamamlama (api/profile/update POST).
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TeacherSchool = { city_id: number; district_id: number; school_id: number | null; school_name: string };

const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);

// Hiçbir alan verilmediyse null; aksi halde hata metni ya da profile yazılacak alanlar. Listeden seçilen okulun adı ve konumu DB'den alınır (istemci ne
// yazarsa yazsın); listede olmayan okul için yazılan ad (2-150 karakter) kabul edilir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseTeacherSchool(service: SupabaseClient<any, any, any>, raw: unknown): Promise<TeacherSchool | { error: string } | null> {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const cityId = int(body.cityId);
  const districtId = int(body.districtId);
  const schoolId = int(body.schoolId);
  const name = typeof body.schoolName === 'string' ? body.schoolName.replace(/\s+/g, ' ').trim() : '';
  if (!cityId && !districtId && !schoolId && !name) return null;
  if (!cityId || !districtId) return { error: 'Okulunun ilini ve ilçesini seçmelisin (ya da okul alanlarını boş bırak)' };

  const { data: district } = await service.from('districts').select('id').eq('id', districtId).eq('city_id', cityId).maybeSingle();
  if (!district) return { error: 'İl ve ilçe uyuşmuyor, tekrar seçer misin?' };

  if (schoolId) {
    const { data: school } = await service.from('schools').select('name').eq('id', schoolId).eq('district_id', districtId).maybeSingle();
    if (!school) return { error: 'Seçtiğin okul bu ilçede bulunamadı, tekrar seçer misin?' };
    return { city_id: cityId, district_id: districtId, school_id: schoolId, school_name: (school as { name: string }).name };
  }
  if (name.length < 2 || name.length > 150) return { error: 'Okulunun adını seçmelisin (ya da okul alanlarını boş bırak)' };
  return { city_id: cityId, district_id: districtId, school_id: null, school_name: name };
}
