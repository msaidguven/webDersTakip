import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase browser client misconfigured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      },
    }
  )
}

// createClient()'ın zorladığı global "Content-Type: application/json" header'ı,
// Storage'a dosya yüklerken storage-js'in ürettiği multipart/form-data boundary
// header'ının üzerine yazıyor ve yüklenen dosya sunucuda "application/json" olarak
// algılanıp reddediliyor. Aynı oturumu (cookie tabanlı) paylaşan ama bu header'ı
// zorlamayan bu istemciyi SADECE storage.upload() gibi ikili/multipart istekler
// için kullan.
export function createStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase browser client misconfigured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
