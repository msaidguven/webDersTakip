import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cookie'siz, anon-key'li Supabase client. Kimlik doğrulama/kullanıcıya özel veri
// GEREKTİRMEYEN, ISR ile cache'lenmesi gereken public sayfalar için kullanılır.
// utils/supabase/server.ts'teki createClient() await cookies() çağırıyor — bu,
// hiç kullanılmasa bile Next.js'in o route'u otomatik olarak "dinamik" kabul edip
// export const revalidate ayarını devre dışı bırakmasına yol açıyor (bkz.
// [topicSlug]/page.tsx). Anonim ziyaretçi zaten oturumsuz (anon rol) sorgu attığı
// için bu client aynı RLS yetkisiyle çalışır, sadece cookies() çağırmaz.
export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase anon client misconfigured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseKey);
}
