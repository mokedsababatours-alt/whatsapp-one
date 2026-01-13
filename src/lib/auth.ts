import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign in with email and password (client-side)
 */
export async function signIn(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign out the current user (client-side)
 */
export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * Get the current session (server-side)
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
 * Get the current user (server-side)
 */
export async function getUser() {
  const supabase = await getSupabaseServerClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}
