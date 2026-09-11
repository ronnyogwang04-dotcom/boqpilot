// Explicit environment identity, independent of NODE_ENV — Next.js forces
// NODE_ENV=production for every `next build` output, including Vercel
// Preview deployments, so NODE_ENV alone can never distinguish Beta/staging
// from real production. APP_ENV is set explicitly per Vercel project
// (staging in the Beta project, production in the future prod project);
// VERCEL_ENV is a fallback for preview/dev deployments where APP_ENV wasn't
// configured, so previews default to the safer "staging" behaviour rather
// than silently behaving like production.
export type AppEnv = "development" | "staging" | "production";

export function getAppEnv(): AppEnv {
  const explicit = process.env.APP_ENV;
  if (explicit === "development" || explicit === "staging" || explicit === "production") {
    return explicit;
  }

  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV) return "staging";

  return "development";
}

export function isProductionEnv(): boolean {
  return getAppEnv() === "production";
}
