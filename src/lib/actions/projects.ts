"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { projectSchema } from "@/lib/validations/projects";
import type { ActionState } from "@/types/action-state";
import type { ProjectSector, ProjectStatus } from "@/types/database.types";

function fieldErrorsFromZod(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const { fieldErrors } = error.flatten();
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([, v]) => v && v.length > 0),
  ) as Record<string, string[]>;
}

function parseProjectForm(formData: FormData) {
  return projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    status: formData.get("status") || undefined,
    projectNumber: formData.get("projectNumber") || undefined,
    tenderNumber: formData.get("tenderNumber") || undefined,
    contractNumber: formData.get("contractNumber") || undefined,
    clientName: formData.get("clientName") || undefined,
    contractorName: formData.get("contractorName") || undefined,
    province: formData.get("province") || undefined,
    municipality: formData.get("municipality") || undefined,
    town: formData.get("town") || undefined,
    physicalAddress: formData.get("physicalAddress") || undefined,
    sector: formData.getAll("sector"),
    estimatedContractValue: formData.get("estimatedContractValue"),
    tenderClosingDate: formData.get("tenderClosingDate") || undefined,
    awardDate: formData.get("awardDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createProject(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseProjectForm(formData);

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You must be signed in to do that." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { status: "error", message: "Could not load your organisation." };
  }

  const data = parsed.data;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      organisation_id: profile.organisation_id,
      created_by: user.id,
      name: data.name,
      description: data.description || null,
      status: (data.status ?? "draft") as ProjectStatus,
      project_number: data.projectNumber || null,
      tender_number: data.tenderNumber || null,
      contract_number: data.contractNumber || null,
      client_name: data.clientName || null,
      contractor_name: data.contractorName || null,
      province: data.province || null,
      municipality: data.municipality || null,
      town: data.town || null,
      physical_address: data.physicalAddress || null,
      sector: (data.sector ?? []) as ProjectSector[],
      estimated_contract_value: data.estimatedContractValue ?? null,
      tender_closing_date: data.tenderClosingDate || null,
      award_date: data.awardDate || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { status: "error", message: error?.message ?? "Could not create project." };
  }

  await supabase.from("project_timeline").insert({
    project_id: project.id,
    event_type: "created",
  });

  await logAuditEvent(supabase, {
    organisationId: profile.organisation_id,
    actorUserId: user.id,
    eventType: "settings_change",
    entityType: "project",
    entityId: project.id,
    metadata: { action: "created" },
  });

  redirect(`/dashboard/projects/${project.id}`);
}

export async function updateProject(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseProjectForm(formData);

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You must be signed in to do that." };
  }

  const data = parsed.data;

  const { error } = await supabase
    .from("projects")
    .update({
      name: data.name,
      description: data.description || null,
      status: (data.status ?? "draft") as ProjectStatus,
      project_number: data.projectNumber || null,
      tender_number: data.tenderNumber || null,
      contract_number: data.contractNumber || null,
      client_name: data.clientName || null,
      contractor_name: data.contractorName || null,
      province: data.province || null,
      municipality: data.municipality || null,
      town: data.town || null,
      physical_address: data.physicalAddress || null,
      sector: (data.sector ?? []) as ProjectSector[],
      estimated_contract_value: data.estimatedContractValue ?? null,
      tender_closing_date: data.tenderClosingDate || null,
      award_date: data.awardDate || null,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    return { status: "error", message: error.message };
  }

  redirect(`/dashboard/projects/${projectId}`);
}
