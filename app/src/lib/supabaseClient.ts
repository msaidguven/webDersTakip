import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fallback (publishable) values kept for development/local builds
const fallbackUrl = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const fallbackKey = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

// Always returns a SupabaseClient (uses fallbacks if env vars are missing/invalid).
// This avoids throwing during static prerender/build and keeps existing behavior.
export const createSupabaseBrowserClient = (): SupabaseClient => {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let usedFallback = false;

  try {
    if (!supabaseUrl || typeof supabaseUrl !== 'string') throw new Error('missing');
    new URL(supabaseUrl);
  } catch (e) {
    supabaseUrl = fallbackUrl;
    usedFallback = true;
  }

  if (!supabaseKey) {
    supabaseKey = fallbackKey;
    usedFallback = true;
  }

  if (usedFallback && typeof window === 'undefined') {
    console.warn("Warning: Using fallback Supabase credentials during build. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY in your environment for production.");
  }

  try {
    return createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.warn('Supabase client creation failed, returning fallback client:', error);
    return createClient(fallbackUrl, fallbackKey);
  }
};