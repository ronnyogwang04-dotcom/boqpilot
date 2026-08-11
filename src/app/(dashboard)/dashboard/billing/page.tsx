import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { billingPlans } from "@/config/billing";
import { formatZAR } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PaymentStatus } from "@/lib/payments/types";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, item_name, amount, currency, payment_status, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Payments are processed securely by PayFast in South African Rand.
      </p>

      <section className="mt-8 flex flex-col gap-4">
        {billingPlans.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col justify-between gap-4 rounded-lg border border-zinc-200 p-6 sm:flex-row sm:items-center dark:border-zinc-800"
          >
            <div>
              <h2 className="text-sm font-semibold">{plan.name}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{plan.description}</p>
              <p className="mt-2 text-lg font-semibold">
                {formatZAR(plan.amount)}
                <span className="text-sm font-normal text-zinc-500">
                  {plan.interval === "month" ? " / month" : ""}
                </span>
              </p>
            </div>
            <form action="/api/payments/payfast/create" method="POST">
              <input type="hidden" name="planId" value={plan.id} />
              <SubmitButton pendingText="Redirecting...">Pay with PayFast</SubmitButton>
            </form>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Payment history</h2>
        {!payments || payments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No payments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(payment.created_at).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="px-4 py-2">{payment.item_name}</td>
                    <td className="px-4 py-2">{formatZAR(Number(payment.amount))}</td>
                    <td className="px-4 py-2">
                      <PaymentStatusBadge status={payment.payment_status as PaymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
