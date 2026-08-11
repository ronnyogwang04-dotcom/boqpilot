import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Default is 1MB, which real-world historical BOQ spreadsheets exceed.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
