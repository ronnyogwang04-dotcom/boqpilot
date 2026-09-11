import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCanonicalItem, listPossibleDuplicates } from "@/lib/queries/canonical-items";
import { DIVISIONS } from "@/lib/construction-intelligence/category-hierarchy";
import { CATEGORIES, UNCATEGORISED } from "@/lib/historical-boq/categoriser";
import { isKnownUnit } from "@/lib/construction-intelligence/normalise-unit";
import { formatZAR } from "@/lib/format";
import { CanonicalItemEditForm } from "@/components/admin/canonical-item-edit-form";
import { CanonicalItemMergeButton } from "@/components/admin/canonical-item-merge-button";
import { EmbeddingStatusBadge } from "@/components/admin/embedding-status-badge";

export const metadata: Metadata = { title: "Canonical Item" };

function formatRate(value: number | null): string {
  return value === null ? "—" : formatZAR(Number(value));
}

export default async function CanonicalItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") notFound();

  const item = await getCanonicalItem(id);
  if (!item) notFound();

  const mergedIntoItem = item.merged_into_id ? await getCanonicalItem(item.merged_into_id) : null;
  const possibleDuplicates = item.merged_into_id ? [] : await listPossibleDuplicates(supabase, item);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/admin/canonical-items" className="text-sm text-zinc-500 hover:underline">
        ← Canonical Items
      </Link>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{item.normalised_description ?? "Untitled item"}</h1>

      {mergedIntoItem && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          This item was merged into{" "}
          <Link href={`/dashboard/admin/canonical-items/${mergedIntoItem.id}`} className="underline">
            {mergedIntoItem.normalised_description ?? "another canonical item"}
          </Link>
          . It&apos;s kept for audit purposes only and can no longer be edited.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Samples", value: String(item.sample_count) },
          { label: "Projects", value: String(item.project_count) },
          { label: "Avg rate", value: formatRate(item.avg_rate) },
          { label: "Median rate", value: formatRate(item.median_rate) },
          { label: "Min rate", value: formatRate(item.min_rate) },
          { label: "Max rate", value: formatRate(item.max_rate) },
          { label: "Std dev", value: formatRate(item.stddev_rate) },
          { label: "Most recent", value: formatRate(item.most_recent_rate) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Link
          href={`/dashboard/historical-library?canonicalItemId=${item.id}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          View {item.sample_count} source item{item.sample_count === 1 ? "" : "s"} in the Historical Library →
        </Link>
      </div>

      <div className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Embedding</h2>
          <EmbeddingStatusBadge status={item.embeddingStatus} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Original → deterministic normalised description above → embedding input below → OpenAI vector (Phase 3,
          similarity/retrieval only — never auto-merges canonical items).
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Model</dt>
            <dd className="mt-0.5">{item.embedding_model ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Generated</dt>
            <dd className="mt-0.5">
              {item.embedding_generated_at ? new Date(item.embedding_generated_at).toLocaleString("en-ZA") : "—"}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <dt className="text-zinc-500">Last error</dt>
            <dd className="mt-0.5 break-words">{item.embedding_last_error ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <p className="text-xs text-zinc-500">Embedding input text</p>
          <p className="mt-1 rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
            {item.embedding_input_text ?? "Not generated yet."}
          </p>
        </div>
      </div>

      {!mergedIntoItem && (
        <div className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Correct this item</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {!isKnownUnit(item.normalised_unit) &&
              "Its unit isn't in the recognised synonym list — check for a typo or a spelling the dictionary doesn't cover yet. "}
            Editing the description or unit updates every future import that matches this item.
          </p>
          <div className="mt-4">
            <CanonicalItemEditForm
              itemId={item.id}
              normalisedDescription={item.normalised_description ?? ""}
              normalisedUnit={item.normalised_unit ?? ""}
              division={item.category_division ?? DIVISIONS[0] ?? ""}
              category={item.construction_category ?? UNCATEGORISED}
              adminNotes={item.admin_notes ?? ""}
              divisions={DIVISIONS}
              categories={[...CATEGORIES, UNCATEGORISED]}
            />
          </div>
        </div>
      )}

      {!mergedIntoItem && (
        <div className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Possible duplicates</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Other canonical items with overlapping wording in the same division or unit — a suggestion only, nothing
            merges automatically.
          </p>
          {possibleDuplicates.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No likely duplicates found.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {possibleDuplicates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/admin/canonical-items/${candidate.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {candidate.normalised_description}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {candidate.normalised_unit ?? "—"} · {candidate.sample_count} sample
                      {candidate.sample_count === 1 ? "" : "s"} · {Math.round(candidate.similarity * 100)}% similar
                    </p>
                  </div>
                  <CanonicalItemMergeButton sourceId={candidate.id} targetId={item.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
