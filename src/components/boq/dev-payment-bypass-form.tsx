"use client";

import { useActionState } from "react";
import { simulateDevPayment } from "@/lib/actions/dev-payment-bypass";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function DevPaymentBypassForm({ boqId }: { boqId: string }) {
  const [state, formAction] = useActionState(simulateDevPayment, initialActionState);

  return (
    <div className="mt-4 rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="font-medium text-amber-800 dark:text-amber-300">
        Development payment bypass — no real payment will be processed.
      </p>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        Visible only to admins while DEV_PAYMENT_BYPASS is enabled on the server. Simulates a successful payment so
        the pricing pipeline can be tested without PayFast.
      </p>

      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <form action={formAction} className="mt-3">
        <input type="hidden" name="boqId" value={boqId} />
        <SubmitButton pendingText="Simulating..." variant="outline">
          Simulate successful payment (dev only)
        </SubmitButton>
      </form>
    </div>
  );
}
