import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const fallbackUrl = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const fallbackKey = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

export async function createClient() {
  const cookieStore = await cookies()

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let usedFallback = false;

  try {
    if (!supabaseUrl || typeof supabaseUrl !== 'string') throw new Error('missing');
    new URL(supabaseUrl);
  } catch {
    supabaseUrl = fallbackUrl;
    usedFallback = true;
  }

  if (!supabaseKey) {
    supabaseKey = fallbackKey;
    usedFallback = true;
  }

  if (usedFallback) {
    console.warn(
      'Warning: Using fallback Supabase credentials on server. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY in your environment for production.'
    );
  }

  try {
    return createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Handle error
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Handle error
            }
          },
        },
      }
    )
  } catch (error) {
    console.warn('Supabase server client creation failed, retrying with fallback credentials:', error);
    return createServerClient(
      fallbackUrl,
      fallbackKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Handle error
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Handle error
            }
          },
        },
      }
    )
  }
}
