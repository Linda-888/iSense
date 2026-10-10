import { createClient } from "@supabase/supabase-js";

/**
 * Shared Supabase client (Person 3's module).
 *
 * Reads the PUBLIC anon key from Vite env vars. RLS on the Supabase side is
 * what actually protects the data — the anon key is safe in the frontend.
 * NEVER import or commit the service_role key.
 *
 * If env vars are missing (e.g. a teammate hasn't set .env.local yet), this
 * exports `null` so the app can fall back to local demo data instead of crashing.
 */
const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);
