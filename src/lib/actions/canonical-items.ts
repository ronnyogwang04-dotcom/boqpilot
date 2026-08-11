"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAuditEvent } from "@/lib/audit/log-event";
import { normaliseUnit } from "@/lib/construction-intelligence/normalise-unit";
import { buildDuplicateGroupKey } from "@/lib/construction-intelligence/duplicate-key";
import { updateCanonicalItemSchema, mergeCanonicalItemsSchema } from "@/lib/validations/canonical-items";
import type { ActionState } from "@/types/action-state";

function fieldErrorsFromZod(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const { fieldErrors } = error.flatten();
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([, v]) => v && v.length > 0),
  ) as Record<string, string[]>;
}

function revalidateCanonicalItemPaths(id: string) {
  revalidatePath(`/dashboard/admin/canonical-items/${id}`);
  revalidatePath("/dashboard/admin/canonical-items");
  revalidatePath("/dashboard/rate-explorer");
}

/**
 * Corrects a canonical item's description/unit/category — the admin's
 * typed description is stored as-is (not re-run through normaliseDescription's
 * abbreviation expansion, which is for raw extracted text, not a deliberate
 * human correction); the unit is still passed through normaliseUnit() so a
 * typo like "m2" still resolves to the canonical "m²" token. Since
 * duplicate_group_key is derived from both, it's recomputed here too — a
 * collision with a different existing canonical item means the edit would
 * make two rows identical, which is what merging is for instead.
 */
export async function updateCanonicalItem(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateCanonicalItemSchema.safeParse({
    id,
    normalisedDescription: formData.get("normalisedDescription"),
    normalisedUnit: formData.get("normalisedUnit"),
    division: formData.get("division"),
    category: formData.get("category"),
    adminNotes: formData.get("adminNotes") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "You must be an admin to do that." };
  }

  const description = parsed.data.normalisedDescription.replace(/\s+/g, " ").trim();
  const unit = normaliseUnit(parsed.data.normalisedUnit);
  const duplicateGroupKey = buildDuplicateGroupKey(description, unit);

  const { error } = await admin.supabase
    .from("rate_library_items")
    .update({
      normalised_description: description,
      normalised_unit: unit,
      category_division: parsed.data.division,
      construction_category: parsed.data.category,
      admin_notes: parsed.data.adminNotes || null,
      duplicate_group_key: duplicateGroupKey,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "This description and unit match another canonical item — merge them instead of editing separately.",
      };
    }
    return { status: "error", message: error.message };
  }

  await logAuditEvent(admin.supabase, {
    organisationId: admin.organisationId,
    actorUserId: admin.userId,
    eventType: "manual_rate_change",
    entityType: "rate_library_item",
    entityId: id,
    metadata: { action: "corrected", description, unit },
  });

  revalidateCanonicalItemPaths(id);
  return { status: "success", message: "Canonical item updated." };
}

/**
 * Merges `sourceId` into `targetId`: every historical_boq_items row pointing
 * at the source is repointed to the target, the source is marked
 * merged_into_id rather than deleted (so it — and anything referencing it —
 * stays intact for audit purposes), and the target's rate statistics are
 * recomputed. resolveCanonicalItemIds() follows merged_into_id, so a future
 * import that produces the source's old duplicate_group_key still lands on
 * the target, not the merged-away row.
 */
export async function mergeCanonicalItems(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = mergeCanonicalItemsSchema.safeParse({
    sourceId: formData.get("sourceId"),
    targetId: formData.get("targetId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Invalid merge request." };
  }
  const { sourceId, targetId } = parsed.data;

  if (sourceId === targetId) {
    return { status: "error", message: "Can't merge an item into itself." };
  }

  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "You must be an admin to do that." };
  }

  const { data: items, error: fetchError } = await admin.supabase
    .from("rate_library_items")
    .select("id, merged_into_id")
    .in("id", [sourceId, targetId]);

  if (fetchError || !items || items.length !== 2) {
    return { status: "error", message: "Could not find both canonical items." };
  }
  if (items.some((item) => item.merged_into_id !== null)) {
    return { status: "error", message: "One of these items has already been merged." };
  }

  const { error: repointError } = await admin.supabase
    .from("historical_boq_items")
    .update({ canonical_item_id: targetId })
    .eq("canonical_item_id", sourceId);

  if (repointError) {
    return { status: "error", message: repointError.message };
  }

  const { error: mergeError } = await admin.supabase
    .from("rate_library_items")
    .update({ merged_into_id: targetId, updated_at: new Date().toISOString() })
    .eq("id", sourceId);

  if (mergeError) {
    return { status: "error", message: mergeError.message };
  }

  const { error: statsError } = await admin.supabase.rpc("recompute_rate_library_stats", {
    p_canonical_ids: [targetId],
  });
  if (statsError) console.error("recompute_rate_library_stats failed after merge:", statsError.message);

  await logAuditEvent(admin.supabase, {
    organisationId: admin.organisationId,
    actorUserId: admin.userId,
    eventType: "manual_rate_change",
    entityType: "rate_library_item",
    entityId: targetId,
    metadata: { action: "merged", merged_from: sourceId },
  });

  revalidateCanonicalItemPaths(sourceId);
  revalidateCanonicalItemPaths(targetId);
  return { status: "success", message: "Merged. This item now redirects into the surviving canonical item." };
}
