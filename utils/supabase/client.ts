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
