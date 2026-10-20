import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = !!(url && key);
export const sb = configured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE === 'true';

// throw on errors so callers can use plain try/catch
export async function q(promise) {
  const { data, error, count } = await promise;
  if (error) throw error;
  return count != null && data == null ? count : data;
}
