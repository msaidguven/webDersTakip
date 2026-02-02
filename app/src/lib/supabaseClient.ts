import { createClient, SupabaseClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const fallbackKey = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

export const createSupabaseBrowserClient = (): SupabaseClient | null => {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  let usedFallback = false;

  // Ortam değişkeninden gelen URL'nin geçerli olup olmadığını kontrol et
  try {
    if (supabaseUrl) {
      new URL(supabaseUrl);
    } else {
      // URL tanımsız, null veya boş ise hatayı yakalayıp yedeği kullan
      throw new Error("URL is falsy");
    }
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

  return createClient(supabaseUrl, supabaseKey);
};