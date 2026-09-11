"use client";

import { useActionState, useEffect, useState } from "react";
import {
  getMarketEvidence,
  researchMarketPrice,
  refreshMarketPrice,
  saveManualMarketEvidence,
  setMarketEvidenceAcceptance,
} from "@/lib/actions/market-research";
import type { PersistedEvidence } from "@/lib/boq-pricing/market-research/repository";
import type { MarketResearchResult, MarketResearchSnapshot } from "@/lib/boq-pricing/market-research/types";
import { MARKET_EVIDENCE_CLASSIFICATION_LABELS } from "@/lib/boq-pricing/market-research/types";
import { evidenceToMaterialCostGuidance } from "@/lib/boq-pricing/market-research/cost-input";
import { INTERNATIONAL_REFERENCE_LABEL } from "@/lib/boq-pricing/market-research/source-origin";
import { MarketEvidenceQualityBadge } from "@/components/boq/market-evidence-quality-badge";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatZAR } from "@/lib/format";
import { initialActionState } from "@/types/action-state";

export type { MarketResearchSnapshot };

function EvidenceRow({ evidence, onUseMaterialCost, onAccept, onReject }: {
  evidence: PersistedEvidence;
  onUseMaterialCost: (cost: number, unit: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const guidance = evidenceToMaterialCostGuidance(evidence);

  return (
    <li className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{evidence.supplierName}</span>
        <div className="flex items-center gap-2">
          {evidence.isManual && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">Manual quote</span>}
          {!evidence.isManual && (
            <span className={evidence.verified ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {evidence.verified ? "Verified source" : "Unverified — not cited by web search"}
            </span>
          )}
        </div>
      </div>

      {evidence.sourceOrigin === "international" && (
        <p className="mt-1 font-medium text-amber-600 dark:text-amber-400">{INTERNATIONAL_REFERENCE_LABEL}</p>
      )}

      {evidence.productDescription && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{evidence.productDescription}</p>}

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>
          <span className="text-zinc-500">Source price: </span>
          {evidence.sourcePrice === null ? (
            <span className="italic text-zinc-500">Price not published — supplier quotation required</span>
          ) : (
            <>
              {formatZAR(evidence.sourcePrice)} / {evidence.pricingBasis}
              {evidence.packQuantity ? ` (×${evidence.packQuantity})` : ""}
            </>
          )}
        </div>
        <div>
          <span className="text-zinc-500">Normalised: </span>
          {evidence.normalisedPrice !== null ? `${formatZAR(evidence.normalisedPrice)}/${evidence.normalisedUnit}` : "Could not normalise"}
        </div>
        <div>
          <span className="text-zinc-500">VAT: </span>
          {evidence.vatStatus}
        </div>
        <div>
          <span className="text-zinc-500">Classification: </span>
          {MARKET_EVIDENCE_CLASSIFICATION_LABELS[evidence.evidenceClassification]}
        </div>
        <div>
          <span className="text-zinc-500">Match: </span>
          {evidence.matchType}
        </div>
        <div>
          <span className="text-zinc-500">Researched: </span>
          {new Date(evidence.retrievedAt).toLocaleDateString()}
        </div>
        {evidence.sourceDate && (
          <div>
            <span className="text-zinc-500">Source dated: </span>
            {evidence.sourceDate}
          </div>
        )}
        {evidence.quoteReference && (
          <div>
            <span className="text-zinc-500">Quote ref: </span>
            {evidence.quoteReference}
          </div>
        )}
      </div>

      {evidence.normalisationCalculation && <p className="mt-1 text-zinc-500 italic">{evidence.normalisationCalculation}</p>}

      {evidence.sourceUrl && (
        <p className="mt-1">
          <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-600 underline dark:text-zinc-400">
            {evidence.sourceDomain || evidence.sourceUrl}
          </a>
        </p>
      )}

      {!evidence.isAccepted && evidence.rejectionReason && (
        <p className="mt-1 text-red-600 dark:text-red-400">Rejected: {evidence.rejectionReason}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {guidance.usableAsMaterialCost ? (
          <button type="button" onClick={() => onUseMaterialCost(guidance.materialCost, guidance.unit)} className="text-zinc-600 underline dark:text-zinc-400">
            Use as material cost below
          </button>
        ) : (
          <span className="text-zinc-400">{guidance.reason}</span>
        )}
        {evidence.isAccepted ? (
          <button type="button" onClick={() => onReject(evidence.id)} className="text-red-600 underline dark:text-red-400">
            Reject
          </button>
        ) : (
          <button type="button" onClick={() => onAccept(evidence.id)} className="text-emerald-600 underline dark:text-emerald-400">
            Accept
          </button>
        )}
      </div>
    </li>
  );
}

function ManualQuoteForm({ itemId, onSaved }: { itemId: string; onSaved: () => void }) {
  const [state, formAction] = useActionState(saveManualMarketEvidence, initialActionState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-zinc-600 underline dark:text-zinc-400">
        + Add a manual supplier quote
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <input type="hidden" name="lineItemId" value={itemId} />
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          Supplier
          <input name="supplierName" required className="h-8 rounded-md border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1">
          Quote reference
          <input name="quoteReference" className="h-8 rounded-md border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1">
          Price
          <input name="sourcePrice" type="number" min={0} step={0.01} required className="h-8 rounded-md border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1">
          Pricing basis
          <select name="pricingBasis" defaultValue="each" className="h-8 rounded-md border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900">
            {["each", "metre", "length", "pack", "box", "kg", "tonne", "litre", "m2", "m3", "day", "hour", "other"].map((basis) => (
              <option key={basis} value={basis}>
                {basis}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          VAT status
          <select name="vatStatus" defaultValue="unknown" className="h-8 rounded-md border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="inclusive">Inclusive</option>
            <option value="exclusive">Exclusive</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Quote date
          <input name="quoteDate" type="date" className="h-8 rounded-md border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        Notes
        <input name="notes" className="h-8 rounded-md border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <div className="flex gap-2">
        <SubmitButton pendingText="Saving...">Save quote</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function MarketResearchSection({
  itemId,
  onUseMaterialCost,
  onSnapshotChange,
}: {
  itemId: string;
  onUseMaterialCost: (cost: number, unit: string) => void;
  onSnapshotChange: (snapshot: MarketResearchSnapshot | null) => void;
}) {
  const [evidence, setEvidence] = useState<PersistedEvidence[] | null>(null);
  const [runSummary, setRunSummary] = useState<MarketResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEvidence() {
    const res = await getMarketEvidence(itemId);
    if (res.ok) setEvidence(res.evidence);
  }

  useEffect(() => {
    loadEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    const accepted = (evidence ?? []).filter((e) => e.isAccepted);
    if (accepted.length === 0 && !runSummary) {
      onSnapshotChange(null);
      return;
    }
    onSnapshotChange({
      runStatus: runSummary?.status ?? null,
      overallConfidence: runSummary?.overallConfidence ?? "none",
      observedRange: runSummary?.observedRange ?? null,
      representativeBaseline: runSummary?.representativeBaseline ?? null,
      highVariance: runSummary?.highVariance ?? false,
      comparabilityNote: runSummary?.comparabilityNote ?? null,
      researchedAt: runSummary?.researchedAt ?? null,
      acceptedEvidence: accepted,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidence, runSummary]);

  async function runResearch(refresh: boolean) {
    setLoading(true);
    setError(null);
    const res = refresh ? await refreshMarketPrice(itemId) : await researchMarketPrice(itemId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRunSummary(res.result);
    if (res.result.status === "failed") {
      setError(res.result.errorMessage);
    } else if (res.result.status === "no_result") {
      setError("No reliable current market price found — a supplier quotation or manual review is recommended.");
    }
    await loadEvidence();
  }

  async function handleAccept(id: string) {
    await setMarketEvidenceAcceptance(id, true, null);
    await loadEvidence();
  }
  async function handleReject(id: string) {
    const reason = window.prompt("Why reject this evidence?") ?? "Rejected by estimator";
    await setMarketEvidenceAcceptance(id, false, reason);
    await loadEvidence();
  }

  const acceptedEvidence = (evidence ?? []).filter((e) => e.isAccepted);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Current market / online evidence</h4>
        <div className="flex items-center gap-3">
          <button type="button" disabled={loading} onClick={() => runResearch(false)} className="text-xs text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400">
            {loading ? "Researching..." : "Research market price"}
          </button>
          {evidence && evidence.length > 0 && (
            <button type="button" disabled={loading} onClick={() => runResearch(true)} className="text-xs text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400">
              Refresh
            </button>
          )}
        </div>
      </div>

      {runSummary && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MarketEvidenceQualityBadge quality={runSummary.overallConfidence} />
          {runSummary.cached && <span className="text-xs text-zinc-500">(cached result)</span>}
          {runSummary.observedRange && (
            <span className="text-xs text-zinc-500">
              Observed range: {formatZAR(runSummary.observedRange.min)}–{formatZAR(runSummary.observedRange.max)}/{runSummary.observedRange.unit} across{" "}
              {runSummary.observedRange.sourceCount} comparable sources
              {runSummary.representativeBaseline !== null && ` — representative baseline ${formatZAR(runSummary.representativeBaseline)}`}
            </span>
          )}
          {runSummary.highVariance && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">High market price variation — supplier quotation recommended.</span>
          )}
          {runSummary.comparabilityNote && <span className="text-xs text-amber-600 dark:text-amber-400">{runSummary.comparabilityNote}</span>}
          {runSummary.usedInternationalFallback && (
            <span className="text-xs text-amber-600 dark:text-amber-400">No South African evidence found — showing international reference evidence only.</span>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {evidence === null && !loading && <p className="mt-2 text-sm text-zinc-500">Loading...</p>}
      {evidence !== null && evidence.length === 0 && !loading && !runSummary && (
        <p className="mt-2 text-sm text-zinc-500">No online evidence loaded yet. Click &ldquo;Research market price&rdquo; to search current South African suppliers.</p>
      )}

      {evidence && evidence.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {evidence.map((e) => (
            <EvidenceRow key={e.id} evidence={e} onUseMaterialCost={onUseMaterialCost} onAccept={handleAccept} onReject={handleReject} />
          ))}
        </ul>
      )}

      <div className="mt-3">
        <ManualQuoteForm itemId={itemId} onSaved={loadEvidence} />
      </div>

      {acceptedEvidence.length === 0 && evidence !== null && evidence.length > 0 && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">No accepted evidence — this item cannot be saved with &ldquo;Use online evidence&rdquo; until at least one source is accepted.</p>
      )}
    </div>
  );
}
