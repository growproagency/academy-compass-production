import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Server-side Supabase client using the service role key.
 * This bypasses Row Level Security — only use on the server.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
