import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[Supabase] URL:', supabaseUrl ? '✓ configured' : '✗ missing');
console.log('[Supabase] Key:', supabaseKey ? '✓ configured' : '✗ missing');

// Only create client if environment variables are available
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Helper to check if supabase is configured
export const isSupabaseConfigured = () => !!supabase;
