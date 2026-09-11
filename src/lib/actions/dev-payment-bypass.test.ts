import { beforeEach, describe, expect, it, vi } from "vitest";

const isDevPaymentBypassEnabledMock = vi.fn();
vi.mock("@/lib/payments/dev-bypass", () => ({
  isDevPaymentBypassEnabled: () => isDevPaymentBypassEnabledMock(),
}));

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: () => requireAdminMock(),
}));

const applyBoqPaymentCompletionMock = vi.fn();
vi.mock("@/lib/payments/service", () => ({
  applyBoqPaymentCompletion: (...args: unknown[]) => applyBoqPaymentCompletionMock(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const insertMock = vi.fn();

/** Table-keyed canned reads for the fake service client, plus a spy on payments.insert(). */
function makeFakeServiceClient(reads: Record<string, unknown>) {
  const from = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: reads[table] ?? null, error: null }),
      insert: (payload: unknown) => {
        insertMock(table, payload);
        return { error: null };
      },
    };
    return builder;
  };
  return { from };
}

let fakeServiceClient: ReturnType<typeof makeFakeServiceClient>;
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fakeServiceClient,
}));

beforeEach(() => {
  isDevPaymentBypassEnabledMock.mockReset();
  requireAdminMock.mockReset();
  applyBoqPaymentCompletionMock.mockReset();
  insertMock.mockReset();
  fakeServiceClient = makeFakeServiceClient({});
});

function formDataFor(boqId: string): FormData {
  const fd = new FormData();
  fd.set("boqId", boqId);
  return fd;
}

const adminContext = { userId: "admin-1", organisationId: "org-1", supabase: {} as never };

describe("simulateDevPayment", () => {
  it("rejects outright when the bypass isn't enabled, before ever checking who's asking", async () => {
    isDevPaymentBypassEnabledMock.mockReturnValue(false);
    const { simulateDevPayment } = await import("./dev-payment-bypass");

    const result = await simulateDevPayment({ status: "idle" }, formDataFor("boq-1"));

    expect(result.status).toBe("error");
    expect(requireAdminMock).not.toHaveBeenCalled();
    expect(applyBoqPaymentCompletionMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user who isn't an admin", async () => {
    isDevPaymentBypassEnabledMock.mockReturnValue(true);
    requireAdminMock.mockResolvedValue(null);
    const { simulateDevPayment } = await import("./dev-payment-bypass");

    const result = await simulateDevPayment({ status: "idle" }, formDataFor("boq-1"));

    expect(result.status).toBe("error");
    expect(applyBoqPaymentCompletionMock).not.toHaveBeenCalled();
  });

  it("rejects a BOQ belonging to a different organisation than the admin's own", async () => {
    isDevPaymentBypassEnabledMock.mockReturnValue(true);
    requireAdminMock.mockResolvedValue(adminContext);
    fakeServiceClient = makeFakeServiceClient({
      boqs: { id: "boq-1", project_id: "project-1", price: 99, currency: "ZAR" },
      projects: { organisation_id: "someone-elses-org" },
    });
    const { simulateDevPayment } = await import("./dev-payment-bypass");

    const result = await simulateDevPayment({ status: "idle" }, formDataFor("boq-1"));

    expect(result.status).toBe("error");
    expect(applyBoqPaymentCompletionMock).not.toHaveBeenCalled();
  });

  it("rejects a BOQ that isn't currently WAITING_FOR_PAYMENT", async () => {
    isDevPaymentBypassEnabledMock.mockReturnValue(true);
    requireAdminMock.mockResolvedValue(adminContext);
    fakeServiceClient = makeFakeServiceClient({
      boqs: { id: "boq-1", project_id: "project-1", price: 99, currency: "ZAR" },
      projects: { organisation_id: "org-1" },
      processing_jobs: { status: "COMPLETED" },
    });
    const { simulateDevPayment } = await import("./dev-payment-bypass");

    const result = await simulateDevPayment({ status: "idle" }, formDataFor("boq-1"));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/waiting for payment/i);
    expect(applyBoqPaymentCompletionMock).not.toHaveBeenCalled();
  });

  it("records a complete payment and applies the same completion side effects as a real payment, when every check passes", async () => {
    isDevPaymentBypassEnabledMock.mockReturnValue(true);
    requireAdminMock.mockResolvedValue(adminContext);
    fakeServiceClient = makeFakeServiceClient({
      boqs: { id: "boq-1", project_id: "project-1", price: 99, currency: "ZAR" },
      projects: { organisation_id: "org-1" },
      processing_jobs: { status: "WAITING_FOR_PAYMENT" },
    });
    const { simulateDevPayment } = await import("./dev-payment-bypass");

    const result = await simulateDevPayment({ status: "idle" }, formDataFor("boq-1"));

    expect(result.status).toBe("success");
    const [table, payload] = insertMock.mock.calls[0];
    expect(table).toBe("payments");
    expect(payload).toMatchObject({
      payment_provider: "dev-bypass",
      payment_status: "complete",
      boq_id: "boq-1",
      amount: 99,
    });
    expect(applyBoqPaymentCompletionMock).toHaveBeenCalledWith(fakeServiceClient, "boq-1", 99, {
      devBypass: true,
      triggeredBy: "admin-1",
    });
  });
});
