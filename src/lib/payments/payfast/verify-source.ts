import { lookup } from "dns/promises";
import { getPayFastConfig } from "./config";

/**
 * Confirms an ITN request actually originated from PayFast by resolving
 * their known hostnames and checking the request's source IP against them.
 * DNS lookups are best-effort: if a hostname fails to resolve we simply
 * exclude it rather than failing the whole check.
 */
export async function isValidPayFastSourceIp(ip: string | null): Promise<boolean> {
  if (!ip) return false;

  const normalizedIp = ip.replace(/^::ffff:/, "");
  const { validHosts } = getPayFastConfig();

  const resolved = await Promise.allSettled(
    validHosts.map((hostname) => lookup(hostname, { all: true })),
  );

  const validIps = new Set<string>();
  for (const result of resolved) {
    if (result.status === "fulfilled") {
      for (const { address } of result.value) validIps.add(address);
    }
  }

  return validIps.has(normalizedIp);
}
