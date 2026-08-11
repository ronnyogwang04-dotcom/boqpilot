import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/format";
import { processingStageLabels } from "@/lib/processing/status";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import type { PaymentStatus } from "@/lib/payments/types";

export const metadata: Metadata = { title: "Project" };

const timelineLabels: Record<string, string> = {
  created: "Project created",
  boq_uploaded: "BOQ uploaded",
  payment_received: "Payment received",
  processing_started: "Processing started",
  ai_extraction_completed: "AI extraction completed",
  benchmark_completed: "Benchmark completed",
  pricing_completed: "Pricing completed",
  export_generated: "Export generated",
};

export default async function ProjectDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();

  if (!project) {
    notFound();
  }

  const [{ data: versions }, { data: boqs }, { data: jobs }, { data: timeline }, { data: pricingRuns }, { data: exportsList }] =
    await Promise.all([
      supabase
        .from("project_versions")
        .select("id, version_number, version_label, created_at")
        .eq("project_id", id)
        .order("version_number", { ascending: false }),
      supabase
        .from("boqs")
        .select("id, project_version_id, filename, page_count, pricing_tier, price, currency, is_free")
        .eq("project_id", id),
      supabase.from("processing_jobs").select("id, job_number, boq_id, status, progress").eq("project_id", id),
      supabase
        .from("project_timeline")
        .select("id, event_type, event_at")
        .eq("project_id", id)
        .order("event_at", { ascending: false }),
      supabase.from("pricing_runs").select("id, run_number").eq("project_id", id),
      supabase.from("exports").select("id, export_type").eq("project_id", id),
    ]);

  const boqsByVersion = new Map((boqs ?? []).map((b) => [b.project_version_id, b]));
  const jobsByBoq = new Map((jobs ?? []).map((j) => [j.boq_id, j]));
  const boqIds = (boqs ?? []).map((b) => b.id);

  const { data: payments } = boqIds.length
    ? await supabase
        .from("payments")
        .select("id, amount, currency, payment_status, created_at, boq_id")
        .in("boq_id", boqIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {[project.client_name, project.tender_number].filter(Boolean).join(" · ") || "No client or tender number set"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/projects/${project.id}/boq/upload`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Upload BOQ
          </Link>
          <Link
            href={`/dashboard/projects/${project.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Project Summary */}
      <section className="mt-8 rounded-lg border border-zinc-200 p-6 text-sm dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Project summary</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><dt className="text-zinc-500">Status</dt><dd className="font-medium capitalize">{project.status}</dd></div>
          <div><dt className="text-zinc-500">Contract number</dt><dd className="font-medium">{project.contract_number ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Contractor</dt><dd className="font-medium">{project.contractor_name ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Location</dt><dd className="font-medium">{[project.town, project.municipality, project.province].filter(Boolean).join(", ") || "—"}</dd></div>
          <div><dt className="text-zinc-500">Sector</dt><dd className="font-medium capitalize">{project.sector.length ? project.sector.join(", ") : "—"}</dd></div>
          <div><dt className="text-zinc-500">Estimated value</dt><dd className="font-medium">{project.estimated_contract_value ? formatZAR(Number(project.estimated_contract_value)) : "—"}</dd></div>
          <div><dt className="text-zinc-500">Tender closing</dt><dd className="font-medium">{project.tender_closing_date ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Award date</dt><dd className="font-medium">{project.award_date ?? "—"}</dd></div>
        </dl>
      </section>

      {/* Project Timeline */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Project timeline</h2>
        {!timeline || timeline.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No activity yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {timeline.map((entry) => (
              <li key={entry.id} className="flex justify-between border-b border-zinc-100 pb-2 dark:border-zinc-900">
                <span>{timelineLabels[entry.event_type] ?? entry.event_type}</span>
                <span className="text-zinc-500">{new Date(entry.event_at).toLocaleString("en-ZA")}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* BOQ Versions (covers both "Uploaded BOQs" and "Historical Versions") */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">BOQ versions</h2>
        {!versions || versions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No BOQs uploaded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Filename</th>
                  <th className="px-4 py-2 font-medium">Pages</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Job status</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => {
                  const boq = boqsByVersion.get(version.id);
                  const job = boq ? jobsByBoq.get(boq.id) : undefined;
                  return (
                    <tr key={version.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                      <td className="px-4 py-2">
                        {boq ? (
                          <Link href={`/dashboard/projects/${project.id}/boq/${boq.id}`} className="font-medium hover:underline">
                            {version.version_label}
                          </Link>
                        ) : (
                          version.version_label
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{boq?.filename ?? "—"}</td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{boq?.page_count ?? "—"}</td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {boq ? (boq.is_free ? "FREE" : formatZAR(Number(boq.price))) : "—"}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {job ? processingStageLabels[job.status] : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Processing Jobs */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Processing jobs</h2>
        {!jobs || jobs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No processing jobs yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <span>Job #{job.job_number}</span>
                <span className="text-zinc-500">{processingStageLabels[job.status]}</span>
                <Link
                  href={`/dashboard/projects/${project.id}/boq/${job.boq_id}/processing`}
                  className="text-zinc-600 hover:underline dark:text-zinc-400"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pricing Runs (schema-ready, populated once the Pricing Engine's AI stages exist) */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Pricing runs</h2>
        <p className="mt-3 text-sm text-zinc-500">
          {pricingRuns && pricingRuns.length > 0 ? `${pricingRuns.length} pricing run(s).` : "None yet — pricing runs are created once AI benchmarking ships."}
        </p>
      </section>

      {/* Exports (schema-ready) */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Exports</h2>
        <p className="mt-3 text-sm text-zinc-500">
          {exportsList && exportsList.length > 0 ? `${exportsList.length} export(s).` : "None yet — exports are generated once processing completes."}
        </p>
      </section>

      {/* Payment History */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Payment history</h2>
        {!payments || payments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <span>{formatZAR(Number(payment.amount))}</span>
                <PaymentStatusBadge status={payment.payment_status as PaymentStatus} />
                <span className="text-zinc-500">{new Date(payment.created_at).toLocaleDateString("en-ZA")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Project Notes */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Notes</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
          {project.notes || "No notes yet."}
        </p>
      </section>

      {/* Future Collaboration */}
      <section className="mt-8 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        Collaboration (inviting teammates to this project) is coming soon.
      </section>
    </div>
  );
}
