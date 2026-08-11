import type { PaymentRedirect } from "./types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders a tiny self-submitting HTML page that POSTs the buyer straight to
 * the provider's hosted payment page. Works for any PaymentProvider — not
 * PayFast-specific — since PaymentRedirect is provider-agnostic.
 */
export function renderRedirectForm(redirect: PaymentRedirect) {
  const inputs = Object.entries(redirect.fields)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join("\n    ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting to payment provider…</title>
  </head>
  <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
    <form id="payment-redirect" action="${escapeHtml(redirect.actionUrl)}" method="${redirect.method}">
    ${inputs}
      <noscript><button type="submit">Continue to payment</button></noscript>
    </form>
    <p>Redirecting to your payment provider…</p>
    <script>document.getElementById('payment-redirect').submit();</script>
  </body>
</html>`;
}
