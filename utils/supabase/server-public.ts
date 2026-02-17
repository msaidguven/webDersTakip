import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service Role Key - RLS bypass (sadece server-side)
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase server client misconfigured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY.'
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseKey);
}
