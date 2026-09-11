import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Default is 1MB, which real-world historical BOQ spreadsheets exceed.
    // Kept above the 20MB app-level maxUploadSizeMb (src/config/pricing.ts,
    // src/config/historical-boq.ts) so multipart/form-data framing overhead
    // on a file at exactly the limit doesn't get rejected before the app's
    // own, more informative size-check ever runs.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  // pdf-parse (and its pdfjs-dist dependency) crashes at module-evaluation
  // time when webpack bundles it into a Server Action's "action-browser"
  // chunk — pdfjs-dist's browser/ESM build interop is incompatible with
  // that bundling target (`Object.defineProperty called on non-object`,
  // thrown from pdfjs-dist's own module init, before any of our code runs).
  // Marking it external forces a native Node `require()` at runtime instead
  // of a webpack bundle, which is where it already works correctly (proven
  // by both the Vitest unit tests and a direct-Node end-to-end run).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
