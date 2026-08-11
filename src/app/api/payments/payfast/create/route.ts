import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentService } from "@/lib/payments/service";
import { renderRedirectForm } from "@/lib/payments/render-redirect-form";
import { billingPlans } from "@/config/billing";
import { getOrigin } from "@/lib/get-origin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const planId = formData.get("planId");
  const plan = billingPlans.find((p) => p.id === planId);

  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const origin = await getOrigin();
  const [firstName, ...rest] = (user.user_metadata?.full_name as string | undefined)?.split(" ") ?? [];

  const redirect = await getPaymentService().createPayment(supabase, {
    userId: user.id,
    amount: plan.amount,
    currency: plan.currency,
    itemName: plan.name,
    itemDescription: plan.description,
    buyerEmail: user.email ?? undefined,
    buyerFirstName: firstName,
    buyerLastName: rest.join(" ") || undefined,
    returnUrl: `${origin}/payments/success`,
    cancelUrl: `${origin}/payments/cancelled`,
    notifyUrl: `${origin}/api/payments/payfast/itn`,
  });

  return new NextResponse(renderRedirectForm(redirect), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
