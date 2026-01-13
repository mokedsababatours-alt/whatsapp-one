import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Get the current session (server-side only)
 */
export async function getSession() {
  const supabase = await getSupabaseServerClient();
  
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

/**
 * Get the current user (server-side only)
 */
export async function getUser() {
  const supabase = await getSupabaseServerClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}
