import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sign in with email and password (client-side only)
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
 * Sign out the current user (client-side only)
 */
export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
