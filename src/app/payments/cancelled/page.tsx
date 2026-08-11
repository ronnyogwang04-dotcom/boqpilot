import Link from "next/link";
import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment cancelled" };

export default async function PaymentCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment: paymentId } = await searchParams;
  const supabase = await createClient();

  const { data: payment } = paymentId
    ? await supabase.from("payments").select("boq_id").eq("id", paymentId).single()
    : { data: null };

  const { data: boq } = payment?.boq_id
    ? await supabase.from("boqs").select("project_id").eq("id", payment.boq_id).single()
    : { data: null };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center px-6 text-center">
      <XCircle className="h-10 w-10 text-zinc-400" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Payment cancelled</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        You cancelled the payment before it completed. No charge was made.
      </p>
      <Link
        href={boq ? `/dashboard/projects/${boq.project_id}/boq/${payment?.boq_id}` : "/dashboard/billing"}
        className="mt-8 inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {boq ? "Back to BOQ" : "Back to billing"}
      </Link>
    </div>
  );
}
