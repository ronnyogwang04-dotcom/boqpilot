import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentService } from "@/lib/payments/service";
import { renderRedirectForm } from "@/lib/payments/render-redirect-form";
import { getOrigin } from "@/lib/get-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: boq } = await supabase
    .from("boqs")
    .select("id, filename, page_count, pricing_tier, price, currency, is_free")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!boq) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
  }

  const { data: job } = await supabase
    .from("processing_jobs")
    .select("status")
    .eq("boq_id", id)
    .single();

  if (boq.is_free || !job || job.status !== "WAITING_FOR_PAYMENT") {
    return NextResponse.json({ error: "This BOQ is not awaiting payment" }, { status: 400 });
  }

  const origin = await getOrigin();
  const [firstName, ...rest] = (user.user_metadata?.full_name as string | undefined)?.split(" ") ?? [];

  // Price and tier were determined by the Pricing Engine at upload time and
  // are never re-derived from anything the client sends here.
  const redirect = await getPaymentService().createPayment(supabase, {
    userId: user.id,
    amount: Number(boq.price),
    currency: boq.currency,
    itemName: `BOQ pricing — ${boq.filename}`,
    itemDescription: `${boq.page_count} pages (${boq.pricing_tier})`,
    buyerEmail: user.email ?? undefined,
    buyerFirstName: firstName,
    buyerLastName: rest.join(" ") || undefined,
    returnUrl: `${origin}/payments/success`,
    cancelUrl: `${origin}/payments/cancelled`,
    notifyUrl: `${origin}/api/payments/payfast/itn`,
    boqId: boq.id,
    pricingTier: boq.pricing_tier,
  });

  return new NextResponse(renderRedirectForm(redirect), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
