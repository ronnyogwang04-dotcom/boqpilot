"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultMarkupSettings, type MarkupSettings } from "@/config/pricing-markup";
import type { ActionState } from "@/types/action-state";

export type { MarkupSettings };

export async function getMarkupSettings(): Promise<MarkupSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return defaultMarkupSettings;

  const { data: profile } = await supabase.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile) return defaultMarkupSettings;

  const { data } = await supabase
    .from("pricing_markup_settings")
    .select("wastage_percent, site_overhead_percent, head_office_overhead_percent, profit_percent, contingency_percent")
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();

  if (!data) return defaultMarkupSettings;
  return {
    wastagePercent: data.wastage_percent,
    siteOverheadPercent: data.site_overhead_percent,
    headOfficeOverheadPercent: data.head_office_overhead_percent,
    profitPercent: data.profit_percent,
    contingencyPercent: data.contingency_percent,
  };
}

function parsePercent(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  const n = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function saveMarkupSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const { data: profile } = await supabase.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile) return { status: "error", message: "Could not load your profile." };

  const { error } = await supabase.from("pricing_markup_settings").upsert({
    organisation_id: profile.organisation_id,
    wastage_percent: parsePercent(formData, "wastagePercent", defaultMarkupSettings.wastagePercent),
    site_overhead_percent: parsePercent(formData, "siteOverheadPercent", defaultMarkupSettings.siteOverheadPercent),
    head_office_overhead_percent: parsePercent(
      formData,
      "headOfficeOverheadPercent",
      defaultMarkupSettings.headOfficeOverheadPercent,
    ),
    profit_percent: parsePercent(formData, "profitPercent", defaultMarkupSettings.profitPercent),
    contingency_percent: parsePercent(formData, "contingencyPercent", defaultMarkupSettings.contingencyPercent),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) return { status: "error", message: "Could not save markup settings. Please try again." };

  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Markup settings saved." };
}
