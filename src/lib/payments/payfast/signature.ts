import { createHash } from "crypto";

// PayFast signs using PHP's urlencode() semantics: spaces become '+', and a
// few characters encodeURIComponent leaves untouched (!'()*~) must still be
// percent-escaped for the hashes to match.
export function payfastEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function buildParamString(
  pairs: Array<[string, string]>,
  { skipEmpty = false }: { skipEmpty?: boolean } = {},
): string {
  const entries = skipEmpty
    ? pairs.filter(([, value]) => value !== undefined && value !== null && value !== "")
    : pairs;

  return entries.map(([key, value]) => `${key}=${payfastEncode(value ?? "")}`).join("&");
}

/**
 * Generates a PayFast MD5 signature.
 *
 * - Outbound (building the redirect to PayFast): pass `skipEmpty: true` —
 *   PayFast's docs require omitting unset optional fields from the hash.
 * - Inbound (verifying an ITN): pass `skipEmpty: false` — hash exactly the
 *   fields PayFast posted, in the order they arrived, excluding `signature`.
 */
export function generateSignature(
  pairs: Array<[string, string]>,
  passphrase: string | undefined,
  opts?: { skipEmpty?: boolean },
): string {
  let base = buildParamString(pairs, opts);
  if (passphrase) {
    base += `&passphrase=${payfastEncode(passphrase)}`;
  }
  return createHash("md5").update(base).digest("hex");
}
