import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/format";

export const metadata: Metadata = { title: "Payment received" };

const copy = {
  complete: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    title: "Payment successful",
    body: "Thanks — your payment has been confirmed.",
  },
  pending: {
    icon: Clock,
    iconClass: "text-amber-600 dark:text-amber-400",
    title: "Confirming your payment",
    body: "PayFast is finalizing this payment. It usually only takes a moment — refresh this page or check Billing shortly.",
  },
  failed: {
    icon: XCircle,
    iconClass: "text-red-600 dark:text-red-400",
    title: "We couldn't confirm this payment",
    body: "Something went wrong verifying this payment. If you were charged, contact support.",
  },
} as const;

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment: paymentId } = await searchParams;
  const supabase = await createClient();

  const { data: payment } = paymentId
    ? await supabase
        .from("payments")
        .select("item_name, amount, payment_status, boq_id")
        .eq("id", paymentId)
        .single()
    : { data: null };

  const { data: boq } = payment?.boq_id
    ? await supabase.from("boqs").select("filename, page_count, project_id").eq("id", payment.boq_id).single()
    : { data: null };

  const status =
    payment?.payment_status === "complete"
      ? "complete"
      : payment?.payment_status === "failed"
        ? "failed"
        : "pending";
  const { icon: Icon, iconClass, title, body } = copy[status];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center px-6 text-center">
      <Icon className={`h-10 w-10 ${iconClass}`} />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>

      {payment && (
        <div className="mt-6 w-full rounded-lg border border-zinc-200 p-4 text-left text-sm dark:border-zinc-800">
          <div className="flex justify-between">
            <span className="text-zinc-500">Item</span>
            <span>{boq ? boq.filename : payment.item_name}</span>
          </div>
          {boq && (
            <div className="mt-1 flex justify-between">
              <span className="text-zinc-500">Pages</span>
              <span>{boq.page_count}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between">
            <span className="text-zinc-500">Amount</span>
            <span>{formatZAR(Number(payment.amount))}</span>
          </div>
        </div>
      )}

      <Link
        href={boq ? `/dashboard/projects/${boq.project_id}/boq/${payment?.boq_id}` : "/dashboard/billing"}
        className="mt-8 inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {boq ? "Back to BOQ" : "Back to billing"}
      </Link>
    </div>
  );
}
