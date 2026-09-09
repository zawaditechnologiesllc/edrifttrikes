import { createClient } from "@/lib/supabase/server";
import { adminConfigured } from "@/lib/supabase/admin";

/**
 * Is the caller a signed-in admin?
 *
 * ⚠️ ROUTE HANDLERS DO NOT RUN LAYOUTS. Every page under /admin is gated by
 * app/admin/layout.tsx, but a route handler in the same folder is not — it is
 * reached directly and would happily serve whatever it builds to anyone who
 * guessed the URL. Anything under /admin that is a `route.ts` has to call this
 * itself.
 *
 * Returns a boolean rather than redirecting, because a route handler answering
 * a fetch wants a 403, not a redirect to a login page it cannot render.
 */
export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "admin";
}
