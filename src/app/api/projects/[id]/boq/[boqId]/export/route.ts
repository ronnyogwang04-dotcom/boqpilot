import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listBoqRateItems } from "@/lib/queries/boq-line-items";
import { getMarkupSettings } from "@/lib/actions/pricing-settings";
import { createSupabaseSemanticSearchRepository } from "@/lib/embeddings/semantic-search";
import { isEmbeddingConfigured } from "@/lib/embeddings/openai-client";
import { getHistoricalBenchmarksBatch } from "@/lib/boq-pricing/benchmark-batch";
import type { HistoricalBenchmarkResult } from "@/lib/boq-pricing/benchmark";
import { parseBenchmarkSnapshot, parseCostBuildupComponents, parseCostBuildupMarkups, parseMarketResearchSnapshot } from "@/lib/boq-pricing/export/parse-snapshot";
import { buildExportData } from "@/lib/boq-pricing/export/build-export-data";
import { generateWorkbook } from "@/lib/boq-pricing/export/generate-workbook";
import type { ExportLineItemInput } from "@/lib/boq-pricing/export/types";
import type { Json } from "@/types/database.types";

function safeFilenameBase(filename: string): string {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, "");
  const cleaned = withoutExtension.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
  return cleaned || "boq";
}

/**
 * Downloads the priced BOQ as a professional .xlsx workbook — the primary
 * output of the estimator (see src/lib/boq-pricing/export/). For any rate
 * item the estimator hasn't reviewed yet and that has no cached suggestion,
 * this computes one batch historical-benchmark lookup (not one per item —
 * see semantic-search-batch.ts) and caches the result on the row so repeat
 * exports of the same BOQ don't re-run the search. That cache write is
 * best-effort: a failure there must never block the export itself, and a
 * missing OPENAI_API_KEY simply means those rows stay flagged for review
 * rather than the export failing outright — consistent with never
 * fabricating a rate when there's no evidence for it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; boqId: string }> }) {
  const { id, boqId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Could not load your profile." }, { status: 400 });

  const [{ data: project }, { data: boq }, rawItems, markupDefaults] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).single(),
    supabase.from("boqs").select("id, filename").eq("id", boqId).eq("project_id", id).single(),
    listBoqRateItems(boqId),
    getMarkupSettings(),
  ]);

  if (!project || !boq) return NextResponse.json({ error: "BOQ not found." }, { status: 404 });

  const freshSuggestions = new Map<string, HistoricalBenchmarkResult>();
  const undecidedWithoutSuggestion = rawItems.filter((item) => item.estimator_rate === null && !item.system_suggested_snapshot);

  if (undecidedWithoutSuggestion.length > 0 && isEmbeddingConfigured()) {
    try {
      const repo = createSupabaseSemanticSearchRepository(supabase);
      const benchmarks = await getHistoricalBenchmarksBatch(
        repo,
        profile.organisation_id,
        undecidedWithoutSuggestion.map((item) => ({
          id: item.id,
          description: item.normalised_description ?? item.description,
          unit: item.normalised_unit ?? item.unit,
        })),
      );
      for (const [itemId, benchmark] of benchmarks) freshSuggestions.set(itemId, benchmark);

      // Every row here already exists (it came from listBoqRateItems), so
      // this is always an update-by-id, never an insert — looped .update()
      // calls, not .upsert(), which would otherwise need the full Insert
      // shape. Cheap: each is an indexed update by primary key, and the
      // expensive part (embedding + ranking) already happened once above.
      const now = new Date().toISOString();
      const updateResults = await Promise.all(
        [...benchmarks.entries()].map(([itemId, benchmark]) =>
          supabase
            .from("boq_line_items")
            .update({ system_suggested_snapshot: benchmark as unknown as Json, system_suggested_at: now })
            .eq("id", itemId),
        ),
      );
      const failedUpdate = updateResults.find((result) => result.error);
      if (failedUpdate?.error) console.error("boq export: failed to cache a system-suggested benchmark", { boqId }, failedUpdate.error.message);
    } catch (err) {
      // Best-effort suggestion pass — a search failure must not fail the
      // export. Affected rows simply stay "insufficient data" downstream.
      console.error("boq export: batch benchmark lookup failed", { boqId }, err);
    }
  }

  const exportInputs: ExportLineItemInput[] = rawItems.map((item) => ({
    id: item.id,
    itemCode: item.item_code,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    originalRate: item.unit_rate,
    categoryDivision: item.category_division,
    constructionCategory: item.construction_category,
    estimatorRate: item.estimator_rate,
    rateSource: item.rate_source,
    rateNotes: item.rate_notes,
    costBuildupComponents: parseCostBuildupComponents(item.cost_buildup_components),
    costBuildupMarkups: parseCostBuildupMarkups(item.cost_buildup_markups),
    benchmarkSnapshot: parseBenchmarkSnapshot(item.benchmark_snapshot),
    systemSuggestedSnapshot: freshSuggestions.get(item.id) ?? parseBenchmarkSnapshot(item.system_suggested_snapshot),
    marketResearchSnapshot: parseMarketResearchSnapshot(item.market_research_snapshot),
  }));

  const exportData = buildExportData(
    exportInputs,
    {
      projectName: project.name,
      boqName: boq.filename,
      dateProcessed: new Date().toLocaleDateString("en-ZA"),
    },
    markupDefaults,
  );

  const buffer = await generateWorkbook(exportData);
  const filename = `${safeFilenameBase(boq.filename)}-priced-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
