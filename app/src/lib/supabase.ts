import { createClient } from '@supabase/supabase-js';

// Client-side only - window kontrolü
const getSupabase = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Supabase] Missing credentials');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

// Lazy initialization - only when needed
let supabaseInstance: ReturnType<typeof getSupabase> = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance && typeof window !== 'undefined') {
    supabaseInstance = getSupabase();
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();

export const isSupabaseConfigured = () => {
  if (typeof window === 'undefined') return false;
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
};
