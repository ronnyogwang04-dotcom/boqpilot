import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  organisationId: string;
};

/**
 * Resolves the current signed-in user's profile and confirms `role ===
 * "admin"`. Returns null rather than throwing so callers choose how to fail
 * — a page calls notFound() (matching /dashboard/admin), a Server Action
 * returns an ActionState error. RLS on rate_library_items is org-scoped but
 * not role-scoped (see migration 4), so this check is the only thing
 * preventing a non-admin org member from reaching canonical-item mutations.
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;

  return { supabase, userId: user.id, organisationId: profile.organisation_id };
}
