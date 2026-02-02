import { createClient, SupabaseClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const fallbackKey = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

export const createSupabaseBrowserClient = (): SupabaseClient | null => {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // some files use NEXT_PUBLIC_SUPABASE_KEY, others NEXT_PUBLIC_SUPABASE_ANON_KEY — accept both
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let usedFallback = false;

  // URL kontrolü: Tanımsızsa, string değilse veya geçerli bir URL değilse yedeği kullan
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
      // Bu uyarı Vercel derleme günlüklerinde görünecektir
      console.warn("Warning: Using fallback Supabase credentials. For production builds, ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY are set correctly in your environment variables.");
  }

  try {
    return createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.warn("Supabase client creation failed:", error);
    return null;
  }
};