import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to inbox if authenticated, otherwise to login
  if (user) {
    redirect("/inbox");
  } else {
    redirect("/login");
  }
}
