import { beforeEach, describe, expect, it, vi } from "vitest";

const processCurrentBoqMock = vi.fn();
vi.mock("@/lib/boq-pricing/process-boq", () => ({
  processCurrentBoq: (...args: unknown[]) => processCurrentBoqMock(...args),
}));

const logAuditEventMock = vi.fn();
vi.mock("@/lib/audit/log-event", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args),
}));

type Call = { table: string; op: string; payload?: unknown };

/**
 * Minimal fake Supabase client covering exactly the call shapes
 * applyBoqPaymentCompletion makes: .from(table).select().eq().single() for
 * reads, .from(table).update(payload).eq() / .insert(payload) for writes
 * (both awaited directly, without .single() — Supabase's real query builder
 * is thenable). Records every call so tests can assert on payloads without
 * mocking Supabase's full chainable builder.
 */
function makeFakeSupabase(reads: Record<string, unknown>, calls: Call[]) {
  const from = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: reads[table] ?? null, error: null }),
      update: (payload: unknown) => {
        calls.push({ table, op: "update", payload });
        return builder;
      },
      insert: (payload: unknown) => {
        calls.push({ table, op: "insert", payload });
        return builder;
      },
      then: (resolve: (v: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
    };
    return builder;
  };
  return { from } as never;
}

beforeEach(() => {
  processCurrentBoqMock.mockReset();
  logAuditEventMock.mockReset();
});

describe("applyBoqPaymentCompletion", () => {
  const boqRow = { id: "boq-1", user_id: "user-1", project_id: "project-1", page_count: 5 };
  const profileRow = { organisation_id: "org-1", paid_boq_count: 2, total_pages_processed: 40, lifetime_spend: "100" };

  it("advances the job to QUEUED and runs extraction inline, for a real payment (no dev_bypass metadata)", async () => {
    const calls: Call[] = [];
    const supabase = makeFakeSupabase({ boqs: boqRow, profiles: profileRow }, calls);
    const { applyBoqPaymentCompletion } = await import("./service");

    await applyBoqPaymentCompletion(supabase, "boq-1", 99);

    const jobUpdate = calls.find((c) => c.table === "processing_jobs" && c.op === "update");
    expect(jobUpdate?.payload).toMatchObject({ status: "QUEUED" });
    expect(processCurrentBoqMock).toHaveBeenCalledWith(supabase, "boq-1");

    const auditCall = logAuditEventMock.mock.calls[0][1];
    expect(auditCall.metadata).toEqual({ amount: 99 });
    expect(auditCall.metadata.dev_bypass).toBeUndefined();
  });

  it("tags project_timeline and the audit log with dev_bypass metadata when devBypass is set", async () => {
    const calls: Call[] = [];
    const supabase = makeFakeSupabase({ boqs: boqRow, profiles: profileRow }, calls);
    const { applyBoqPaymentCompletion } = await import("./service");

    await applyBoqPaymentCompletion(supabase, "boq-1", 99, { devBypass: true, triggeredBy: "admin-1" });

    const timelineInsert = calls.find((c) => c.table === "project_timeline" && c.op === "insert");
    expect(timelineInsert?.payload).toMatchObject({ metadata: { boq_id: "boq-1", amount: 99, dev_bypass: true } });

    const auditCall = logAuditEventMock.mock.calls[0][1];
    expect(auditCall.metadata).toEqual({ amount: 99, dev_bypass: true, triggered_by: "admin-1" });
  });

  it("increments usage/spend stats on the BOQ owner's profile", async () => {
    const calls: Call[] = [];
    const supabase = makeFakeSupabase({ boqs: boqRow, profiles: profileRow }, calls);
    const { applyBoqPaymentCompletion } = await import("./service");

    await applyBoqPaymentCompletion(supabase, "boq-1", 50);

    const profileUpdate = calls.find((c) => c.table === "profiles" && c.op === "update");
    expect(profileUpdate?.payload).toMatchObject({
      paid_boq_count: 3,
      total_pages_processed: 45,
      lifetime_spend: 150,
    });
  });

  it("does nothing (no extraction, no stat updates) when the BOQ can't be found", async () => {
    const calls: Call[] = [];
    const supabase = makeFakeSupabase({ boqs: null }, calls);
    const { applyBoqPaymentCompletion } = await import("./service");

    await applyBoqPaymentCompletion(supabase, "missing-boq", 50);

    expect(processCurrentBoqMock).not.toHaveBeenCalled();
    expect(calls.find((c) => c.table === "processing_jobs")).toBeUndefined();
  });
});
