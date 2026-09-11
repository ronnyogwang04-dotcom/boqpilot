import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatZAR } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || profile.role !== "admin") {
    notFound();
  }

  const service = createServiceClient();

  const [
    { count: projectCount },
    { count: userCount },
    { count: boqCount },
    { count: pricingRunCount },
    { count: paymentCount },
    { data: completedPayments },
    { count: activeJobCount },
    { count: completedJobCount },
    { count: failedJobCount },
    { data: completedJobs },
    { data: profiles },
  ] = await Promise.all([
    service.from("projects").select("*", { count: "exact", head: true }),
    service.from("profiles").select("*", { count: "exact", head: true }),
    service.from("boqs").select("*", { count: "exact", head: true }),
    service.from("pricing_runs").select("*", { count: "exact", head: true }),
    service.from("payments").select("*", { count: "exact", head: true }),
    service.from("payments").select("amount").eq("payment_status", "complete"),
    service
      .from("processing_jobs")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(COMPLETED,FAILED,CANCELLED)"),
    service.from("processing_jobs").select("*", { count: "exact", head: true }).eq("status", "COMPLETED"),
    service.from("processing_jobs").select("*", { count: "exact", head: true }).eq("status", "FAILED"),
    service.from("processing_jobs").select("started_at, completed_at").eq("status", "COMPLETED"),
    service.from("profiles").select("total_pages_processed"),
  ]);

  const revenue = (completedPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const pagesProcessed = (profiles ?? []).reduce((sum, p) => sum + p.total_pages_processed, 0);

  const durations = (completedJobs ?? [])
    .filter((j) => j.started_at && j.completed_at)
    .map((j) => new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime());
  const avgProcessingMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const stats: { label: string; value: string }[] = [
    { label: "Projects", value: String(projectCount ?? 0) },
    { label: "Users", value: String(userCount ?? 0) },
    { label: "Revenue", value: formatZAR(revenue) },
    { label: "Active jobs", value: String(activeJobCount ?? 0) },
    { label: "Completed jobs", value: String(completedJobCount ?? 0) },
    { label: "Failed jobs", value: String(failedJobCount ?? 0) },
    { label: "Avg. processing time", value: avgProcessingMs ? `${Math.round(avgProcessingMs / 1000)}s` : "—" },
    { label: "Pages processed", value: String(pagesProcessed) },
    { label: "BOQs uploaded", value: String(boqCount ?? 0) },
    { label: "Pricing runs", value: String(pricingRunCount ?? 0) },
    { label: "Payments", value: String(paymentCount ?? 0) },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Platform-wide metrics across all organisations.</p>

      <div className="mt-4 flex flex-col gap-1">
        <Link
          href="/dashboard/admin/canonical-items"
          className="inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Manage canonical construction items →
        </Link>
        <Link
          href="/dashboard/admin/embeddings"
          className="inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Embeddings (Phase 3) →
        </Link>
        <Link
          href="/dashboard/admin/semantic-search"
          className="inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Semantic Rate Explorer (Phase 4) →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
