import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Vercel values pasted with quotes, whitespace or a trailing slash break fetch.
export function cleanEnv(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim().replace(/\/+$/, "");
}

export const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || "https://placeholder.supabase.co";
const supabaseKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || "placeholder";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
