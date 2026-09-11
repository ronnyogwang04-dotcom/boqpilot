import type { MetadataRoute } from "next";
import { isProductionEnv } from "@/lib/env";

// Beta/staging must never be indexed. Only the future production deployment
// (APP_ENV=production) allows crawling.
export default function robots(): MetadataRoute.Robots {
  if (!isProductionEnv()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
