"use client";

import { useActionState } from "react";
import { searchSimilarCanonicalItems, type SemanticSearchActionState } from "@/lib/actions/semantic-search";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

function formatRate(rate: number | null): string {
  return rate === null ? "—" : rate.toLocaleString(undefined, { style: "currency", currency: "ZAR" });
}

const initialState: SemanticSearchActionState = { status: "idle" };

export function SemanticSearchForm({ isConfigured }: { isConfigured: boolean }) {
  const [state, formAction] = useActionState(searchSimilarCanonicalItems, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

        {!isConfigured && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            OPENAI_API_KEY isn&apos;t set in the environment yet — add it before running a live search.
          </p>
        )}

        <fieldset disabled={!isConfigured} className="flex flex-col gap-3 disabled:opacity-50 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Description
            <input
              type="text"
              name="description"
              required
              placeholder="e.g. supply and install distribution board"
              className="h-9 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex w-32 flex-col gap-1 text-sm">
            Unit (optional)
            <input
              type="text"
              name="unit"
              placeholder="e.g. No"
              className="h-9 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <SubmitButton pendingText="Searching...">Search</SubmitButton>
        </fieldset>
      </form>

      {state.status === "success" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            {state.message}
            {(state.inferredCategory || state.inferredUnit) && (
              <>
                {" "}
                — inferred category <span className="font-medium">{state.inferredCategory ?? "none"}</span>, unit hint{" "}
                <span className="font-medium">{state.inferredUnit ?? "none"}</span>.
              </>
            )}
          </p>

          {state.results && state.results.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Similarity</th>
                    <th className="px-3 py-2 text-right">Samples</th>
                    <th className="px-3 py-2 text-right">Projects</th>
                    <th className="px-3 py-2 text-right">Avg</th>
                    <th className="px-3 py-2 text-right">Median</th>
                    <th className="px-3 py-2 text-right">Min</th>
                    <th className="px-3 py-2 text-right">Max</th>
                    <th className="px-3 py-2 text-right">Most recent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {state.results.map((result) => (
                    <tr key={result.id}>
                      <td className="px-3 py-2 font-medium">{result.description ?? "(no description)"}</td>
                      <td className="px-3 py-2">{result.unit ?? "—"}</td>
                      <td className="px-3 py-2 text-zinc-500">{result.category ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{result.similarity.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{result.sampleCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{result.projectCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRate(result.avgRate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRate(result.medianRate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRate(result.minRate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRate(result.maxRate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRate(result.mostRecentRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
