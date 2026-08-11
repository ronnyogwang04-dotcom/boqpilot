import { headers } from "next/headers";

// Prefer the actual request origin (correct in preview/staging deployments),
// falling back to the configured site URL when headers are unavailable.
export async function getOrigin() {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
