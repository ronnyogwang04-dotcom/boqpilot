import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";

export type AuditEventType =
  | "upload"
  | "download"
  | "pricing"
  | "manual_rate_change"
  | "export"
  | "payment"
  | "login"
  | "settings_change"
  | "collaboration";

export interface AuditEventInput {
  organisationId: string;
  actorUserId: string | null;
  eventType: AuditEventType;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, Json>;
}

/**
 * Appends one row to the audit log. Never throws — a logging failure must
 * never block the action it's recording, so errors are only reported to the
 * server console. The table itself has no update/delete RLS policy, so once
 * written a row can't be edited.
 */
export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  input: AuditEventInput,
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    organisation_id: input.organisationId,
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    console.error("Failed to write audit log entry:", input.eventType, error.message);
  }
}
