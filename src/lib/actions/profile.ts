"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validations/auth";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { ActionState } from "@/types/action-state";

export async function updateProfile(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    return {
      status: "error",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).filter(([, v]) => v && v.length > 0),
      ) as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You must be signed in to do that." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id)
    .select("organisation_id")
    .single();

  if (error || !profile) {
    return { status: "error", message: error?.message ?? "Could not update profile." };
  }

  await logAuditEvent(supabase, {
    organisationId: profile.organisation_id,
    actorUserId: user.id,
    eventType: "settings_change",
    entityType: "profile",
    entityId: user.id,
    metadata: { field: "full_name" },
  });

  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Profile updated." };
}
