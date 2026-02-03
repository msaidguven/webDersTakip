import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  console.log('[Supabase Client] URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[Supabase Client] ANON_KEY var mi:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
