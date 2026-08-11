import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type CanonicalItemInput = {
  normalisedDescription: string;
  normalisedUnit: string | null;
  division: string;
  category: string;
  duplicateKey: string;
};

/**
 * Batch-resolves a set of normalised items into canonical rate_library_items
 * rows, returning a Map<duplicateKey, canonicalItemId>. At most two round
 * trips regardless of batch size: one lookup for keys that already have a
 * canonical row, one upsert for the rest (guarded by the unique
 * (organisation_id, duplicate_group_key) index — `ignoreDuplicates` makes
 * this safe against two rows in the same upload sharing a key, or a
 * concurrent upload inserting the same key first).
 *
 * A matched row that has since been merged into another canonical item (via
 * the admin Canonical Item Manager) resolves to its merge target instead —
 * otherwise a later import producing the same duplicate_group_key would
 * silently resurrect the merged-away row instead of landing on the item an
 * admin already consolidated it into.
 */
export async function resolveCanonicalItemIds(
  supabase: SupabaseClient<Database>,
  organisationId: string,
  inputs: CanonicalItemInput[],
): Promise<Map<string, string>> {
  const inputByKey = new Map<string, CanonicalItemInput>();
  for (const input of inputs) {
    if (!inputByKey.has(input.duplicateKey)) inputByKey.set(input.duplicateKey, input);
  }
  const keys = [...inputByKey.keys()];
  if (keys.length === 0) return new Map();

  const idByKey = new Map<string, string>();

  const { data: existing } = await supabase
    .from("rate_library_items")
    .select("id, duplicate_group_key, merged_into_id")
    .eq("organisation_id", organisationId)
    .in("duplicate_group_key", keys);

  for (const row of existing ?? []) {
    if (row.duplicate_group_key) idByKey.set(row.duplicate_group_key, row.merged_into_id ?? row.id);
  }

  const missingKeys = keys.filter((key) => !idByKey.has(key));
  if (missingKeys.length > 0) {
    const toInsert = missingKeys.map((key) => {
      const input = inputByKey.get(key)!;
      return {
        organisation_id: organisationId,
        normalised_description: input.normalisedDescription,
        normalised_unit: input.normalisedUnit,
        construction_category: input.category,
        category_division: input.division,
        duplicate_group_key: key,
      };
    });

    const { data: inserted } = await supabase
      .from("rate_library_items")
      .upsert(toInsert, { onConflict: "organisation_id,duplicate_group_key", ignoreDuplicates: true })
      .select("id, duplicate_group_key");

    for (const row of inserted ?? []) {
      if (row.duplicate_group_key) idByKey.set(row.duplicate_group_key, row.id);
    }

    const stillMissing = missingKeys.filter((key) => !idByKey.has(key));
    if (stillMissing.length > 0) {
      const { data: refetched } = await supabase
        .from("rate_library_items")
        .select("id, duplicate_group_key")
        .eq("organisation_id", organisationId)
        .in("duplicate_group_key", stillMissing);

      for (const row of refetched ?? []) {
        if (row.duplicate_group_key) idByKey.set(row.duplicate_group_key, row.id);
      }
    }
  }

  return idByKey;
}
