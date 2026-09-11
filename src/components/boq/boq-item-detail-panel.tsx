"use client";

import { useActionState, useEffect, useState } from "react";
import { getLineItemBenchmark, saveEstimatorDecision } from "@/lib/actions/boq-pricing";
import type { HistoricalBenchmarkResult } from "@/lib/boq-pricing/benchmark";
import { calculateCostBuildup, type CostBuildupComponents, type CostBuildupResult } from "@/lib/boq-pricing/cost-buildup";
import type { MarkupSettings } from "@/lib/actions/pricing-settings";
import { ConfidenceBadge } from "@/components/boq/confidence-badge";
import { MarketResearchSection, type MarketResearchSnapshot } from "@/components/boq/market-research-section";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatZAR } from "@/lib/format";
import { initialActionState } from "@/types/action-state";
import type { BoqLineItemRow } from "@/lib/queries/boq-line-items";
import type { BoqLineItemRateSource } from "@/types/database.types";

function formatRate(rate: number | null): string {
  return rate === null ? "—" : formatZAR(rate);
}

function HistoricalBenchmarkSection({ itemId, onLoaded }: { itemId: string; onLoaded: (benchmark: HistoricalBenchmarkResult) => void }) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "loaded"; benchmark: HistoricalBenchmarkResult } | { status: "error"; message: string }
  >({ status: "idle" });
  const [showEvidence, setShowEvidence] = useState(false);

  async function load() {
    setState({ status: "loading" });
    const result = await getLineItemBenchmark(itemId);
    if (result.ok) {
      setState({ status: "loaded", benchmark: result.benchmark });
      onLoaded(result.benchmark);
    } else {
      setState({ status: "error", message: result.error });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Historical benchmark</h4>
        {state.status === "idle" && (
          <button type="button" onClick={load} className="text-xs text-zinc-600 underline dark:text-zinc-400">
            Load benchmark
          </button>
        )}
      </div>

      {state.status === "loading" && <p className="mt-2 text-sm text-zinc-500">Searching the historical rate library...</p>}
      {state.status === "error" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      {state.status === "loaded" && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={state.benchmark.confidence} />
          </div>

          {state.benchmark.bestMatch ? (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3">
                <span className="text-zinc-500">Best match: </span>
                <span className="font-medium">{state.benchmark.bestMatch.description ?? "(no description)"}</span>
              </div>
              <div>
                <span className="text-zinc-500">Unit: </span>
                {state.benchmark.bestMatch.unit ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Category: </span>
                {state.benchmark.bestMatch.category ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Similarity: </span>
                {state.benchmark.bestMatch.similarity.toFixed(3)}
              </div>
              <div>
                <span className="text-zinc-500">Samples: </span>
                {state.benchmark.bestMatch.sampleCount}
              </div>
              <div>
                <span className="text-zinc-500">Projects: </span>
                {state.benchmark.bestMatch.projectCount}
              </div>
              <div>
                <span className="text-zinc-500">Average: </span>
                {formatRate(state.benchmark.bestMatch.avgRate)}
              </div>
              <div>
                <span className="text-zinc-500">Median: </span>
                {formatRate(state.benchmark.bestMatch.medianRate)}
              </div>
              <div>
                <span className="text-zinc-500">Min: </span>
                {formatRate(state.benchmark.bestMatch.minRate)}
              </div>
              <div>
                <span className="text-zinc-500">Max: </span>
                {formatRate(state.benchmark.bestMatch.maxRate)}
              </div>
              <div>
                <span className="text-zinc-500">Most recent: </span>
                {formatRate(state.benchmark.bestMatch.mostRecentRate)}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No reliable historical benchmark found.</p>
          )}

          {state.benchmark.evidence.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowEvidence((v) => !v)}
                className="text-xs text-zinc-600 underline dark:text-zinc-400"
              >
                {showEvidence ? "Hide" : "View"} underlying evidence ({state.benchmark.evidence.length} more match
                {state.benchmark.evidence.length === 1 ? "" : "es"})
              </button>
              {showEvidence && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {state.benchmark.evidence.map((match) => (
                    <li key={match.id}>
                      [{match.similarity.toFixed(3)}] {match.description} — {match.unit ?? "—"}, {match.sampleCount} sample
                      {match.sampleCount === 1 ? "" : "s"}, avg {formatRate(match.avgRate)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const COMPONENT_FIELDS: { key: keyof CostBuildupComponents; label: string }[] = [
  { key: "materialCost", label: "Material" },
  { key: "labourCost", label: "Labour" },
  { key: "plantCost", label: "Plant/equipment" },
  { key: "consumablesCost", label: "Consumables/sundries" },
  { key: "transportCost", label: "Delivery/transport" },
  { key: "subcontractorCost", label: "Subcontractor" },
  { key: "otherDirectCost", label: "Other direct costs" },
];

type CostBuildupMarkupState = {
  siteOverheadPercent: number;
  headOfficeOverheadPercent: number;
  contingencyPercent: number;
  profitPercent: number;
};

function CostBuildupSection({
  markupDefaults,
  components,
  markups,
  setComponent,
  setMarkup,
  onSuggestedRate,
}: {
  markupDefaults: MarkupSettings;
  components: CostBuildupComponents;
  markups: CostBuildupMarkupState;
  setComponent: (key: keyof CostBuildupComponents, value: string) => void;
  setMarkup: (key: keyof CostBuildupMarkupState, value: string) => void;
  onSuggestedRate: (rate: number) => void;
}) {
  const result: CostBuildupResult = calculateCostBuildup(components, markups);

  return (
    <div>
      <h4 className="text-sm font-semibold">Cost build-up</h4>
      <p className="mt-1 text-xs text-zinc-500">
        Only fill in what applies to this item — nothing is assumed present. Markup percentages default from your
        organisation&apos;s pricing settings and can be adjusted here for this item only.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COMPONENT_FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-xs">
            {field.label}
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              onChange={(e) => setComponent(field.key, e.target.value)}
              className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs">
          Wastage %
          <input
            type="number"
            min={0}
            step={0.1}
            defaultValue={markupDefaults.wastagePercent}
            onChange={(e) => setComponent("wastagePercent", e.target.value)}
            className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          Site overhead %
          <input
            type="number"
            min={0}
            step={0.1}
            defaultValue={markupDefaults.siteOverheadPercent}
            onChange={(e) => setMarkup("siteOverheadPercent", e.target.value)}
            className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Head office %
          <input
            type="number"
            min={0}
            step={0.1}
            defaultValue={markupDefaults.headOfficeOverheadPercent}
            onChange={(e) => setMarkup("headOfficeOverheadPercent", e.target.value)}
            className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Contingency %
          <input
            type="number"
            min={0}
            step={0.1}
            defaultValue={markupDefaults.contingencyPercent}
            onChange={(e) => setMarkup("contingencyPercent", e.target.value)}
            className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Profit %
          <input
            type="number"
            min={0}
            step={0.1}
            defaultValue={markupDefaults.profitPercent}
            onChange={(e) => setMarkup("profitPercent", e.target.value)}
            className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      {(result.directCostLines.length > 0 || result.markupLines.length > 0) && (
        <div className="mt-3 rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
          {result.directCostLines.map((line) => (
            <div key={line.label} className="flex justify-between">
              <span className="text-zinc-500">{line.label}</span>
              <span>{formatZAR(line.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-medium dark:border-zinc-800">
            <span>Direct cost subtotal</span>
            <span>{formatZAR(result.directCostSubtotal)}</span>
          </div>
          {result.markupLines.map((line) => (
            <div key={line.label} className="mt-1 flex justify-between">
              <span className="text-zinc-500">{line.label}</span>
              <span>{formatZAR(line.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-semibold dark:border-zinc-800">
            <span>Suggested tender rate</span>
            <span>{formatZAR(result.suggestedRate)}</span>
          </div>
          <button
            type="button"
            onClick={() => onSuggestedRate(result.suggestedRate)}
            className="mt-2 text-xs text-zinc-600 underline dark:text-zinc-400"
          >
            Use this rate below
          </button>
        </div>
      )}
    </div>
  );
}

function EstimatorDecisionSection({
  item,
  prefillRate,
  costBuildupComponents,
  costBuildupMarkups,
  benchmarkSnapshot,
  marketResearchSnapshot,
}: {
  item: BoqLineItemRow;
  prefillRate: number | null;
  costBuildupComponents: CostBuildupComponents;
  costBuildupMarkups: CostBuildupMarkupState;
  benchmarkSnapshot: HistoricalBenchmarkResult | null;
  marketResearchSnapshot: MarketResearchSnapshot | null;
}) {
  const [state, formAction] = useActionState(saveEstimatorDecision, initialActionState);
  const [rate, setRate] = useState(item.estimator_rate?.toString() ?? "");
  const [source, setSource] = useState<BoqLineItemRateSource>(item.rate_source ?? "manual");

  useEffect(() => {
    if (prefillRate !== null) {
      setRate(prefillRate.toFixed(2));
      setSource("build_up");
    }
  }, [prefillRate]);

  const onlineSelectedWithNoEvidence = source === "online" && (!marketResearchSnapshot || marketResearchSnapshot.acceptedEvidence.length === 0);

  return (
    <div>
      <h4 className="text-sm font-semibold">Estimator decision</h4>
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}
      {onlineSelectedWithNoEvidence && <Alert>Accept at least one piece of market evidence above before saving with &ldquo;Use online evidence&rdquo;.</Alert>}

      <form action={formAction} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="lineItemId" value={item.id} />
        <input type="hidden" name="costBuildupComponents" value={JSON.stringify(costBuildupComponents)} />
        <input type="hidden" name="costBuildupMarkups" value={JSON.stringify(costBuildupMarkups)} />
        <input type="hidden" name="benchmarkSnapshot" value={benchmarkSnapshot ? JSON.stringify(benchmarkSnapshot) : ""} />
        <input type="hidden" name="marketResearchSnapshot" value={marketResearchSnapshot ? JSON.stringify(marketResearchSnapshot) : ""} />

        <div className="flex flex-wrap gap-2">
          {(["historical", "build_up", "online", "manual"] as const).map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-xs">
              <input
                type="radio"
                name="rateSource"
                value={option}
                checked={source === option}
                onChange={() => setSource(option)}
              />
              {option === "historical" ? "Use historical rate" : option === "build_up" ? "Use build-up rate" : option === "online" ? "Use online evidence" : "Enter own rate"}
            </label>
          ))}
        </div>

        <label className="flex w-40 flex-col gap-1 text-xs">
          Rate (per {item.unit ?? "unit"})
          <input
            type="number"
            name="estimatorRate"
            min={0}
            step={0.01}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          Notes
          <input
            type="text"
            name="rateNotes"
            defaultValue={item.rate_notes ?? ""}
            placeholder="Why this rate was chosen"
            className="h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="flex gap-2">
          <SubmitButton pendingText="Saving..." className="self-start">
            Save rate
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function BoqItemDetailPanel({ item, markupDefaults }: { item: BoqLineItemRow; markupDefaults: MarkupSettings }) {
  const [buildupRate, setBuildupRate] = useState<number | null>(null);
  const [loadedBenchmark, setLoadedBenchmark] = useState<HistoricalBenchmarkResult | null>(null);
  const [loadedMarketResearch, setLoadedMarketResearch] = useState<MarketResearchSnapshot | null>(null);
  const [components, setComponents] = useState<CostBuildupComponents>({ wastagePercent: markupDefaults.wastagePercent });
  const [markups, setMarkups] = useState<CostBuildupMarkupState>({
    siteOverheadPercent: markupDefaults.siteOverheadPercent,
    headOfficeOverheadPercent: markupDefaults.headOfficeOverheadPercent,
    contingencyPercent: markupDefaults.contingencyPercent,
    profitPercent: markupDefaults.profitPercent,
  });

  function setComponent(key: keyof CostBuildupComponents, value: string) {
    const n = value === "" ? null : Number(value);
    setComponents((prev) => ({ ...prev, [key]: n !== null && Number.isFinite(n) ? n : null }));
  }
  function setMarkup(key: keyof CostBuildupMarkupState, value: string) {
    const n = value === "" ? 0 : Number(value);
    setMarkups((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  }

  return (
    <div className="flex flex-col gap-6 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <HistoricalBenchmarkSection itemId={item.id} onLoaded={setLoadedBenchmark} />
      <MarketResearchSection
        itemId={item.id}
        onUseMaterialCost={(cost) => setComponent("materialCost", cost.toString())}
        onSnapshotChange={setLoadedMarketResearch}
      />
      <CostBuildupSection
        markupDefaults={markupDefaults}
        components={components}
        markups={markups}
        setComponent={setComponent}
        setMarkup={setMarkup}
        onSuggestedRate={setBuildupRate}
      />
      <EstimatorDecisionSection
        item={item}
        prefillRate={buildupRate}
        costBuildupComponents={components}
        costBuildupMarkups={markups}
        benchmarkSnapshot={loadedBenchmark}
        marketResearchSnapshot={loadedMarketResearch}
      />
    </div>
  );
}
