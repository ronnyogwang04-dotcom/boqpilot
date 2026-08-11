import { NextResponse, type NextRequest } from "next/server";
import { getPaymentService } from "@/lib/payments/service";

// The source-IP check does DNS lookups, which requires the Node.js runtime.
export const runtime = "nodejs";

// PayFast calls this server-to-server (no browser, no session) after a
// payment completes. We always respond 200 once the notification has been
// read, per PayFast's guidance — a non-2xx makes them retry indefinitely,
// which doesn't help once we've decided a payload is invalid.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");

  await getPaymentService().processITN(rawBody, sourceIp);

  return new NextResponse("OK", { status: 200 });
}
