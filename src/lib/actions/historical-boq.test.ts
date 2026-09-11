import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const logAuditEventMock = vi.fn();
vi.mock("@/lib/audit/log-event", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args),
}));

const processHistoricalBoqMock = vi.fn();
vi.mock("@/lib/historical-boq/process-historical-boq", () => ({
  processHistoricalBoq: (...args: unknown[]) => processHistoricalBoqMock(...args),
}));

const insertMock = vi.fn();
const uploadMock = vi.fn();

/** Table-keyed canned reads, plus spies on storage.upload() and every insert(). */
function makeFakeClient(reads: Record<string, unknown>) {
  const from = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: reads[table] ?? null, error: null }),
      insert: (payload: unknown) => {
        insertMock(table, payload);
        return {
          select: () => ({
            single: async () => ({ data: { id: `${table}-id` }, error: null }),
          }),
        };
      },
    };
    return builder;
  };
  return {
    auth: { getUser: async () => ({ data: { user: reads.__user ?? { id: "user-1" } } }) },
    from,
    storage: {
      from: () => ({
        upload: async (...args: unknown[]) => {
          uploadMock(...args);
          return { error: null };
        },
        remove: vi.fn(),
      }),
    },
  };
}

let fakeClient: ReturnType<typeof makeFakeClient>;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => fakeClient,
}));

beforeEach(() => {
  insertMock.mockReset();
  uploadMock.mockReset();
  logAuditEventMock.mockReset();
  processHistoricalBoqMock.mockReset();
  fakeClient = makeFakeClient({ profiles: { organisation_id: "org-1" } });
});

function formDataFor(fields: Record<string, string>, file: File): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  fd.set("file", file);
  return fd;
}

describe("uploadHistoricalBoq", () => {
  it("rejects a legacy .xls file with a friendly message before touching storage or the database", async () => {
    const { uploadHistoricalBoq } = await import("./historical-boq");
    const xlsFile = new File([new Uint8Array([1, 2, 3])], "old-boq.xls", { type: "application/vnd.ms-excel" });

    const result = await uploadHistoricalBoq({ status: "idle" }, formDataFor({}, xlsFile));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/legacy \.xls files are not currently supported/i);
    expect(result.message).not.toMatch(/XLS_FILE_NOT_SUPPORTED/);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("uploads successfully with no project selected — historical BOQs are an organisation-level library", async () => {
    const { uploadHistoricalBoq } = await import("./historical-boq");
    const xlsxFile = new File([new Uint8Array([1, 2, 3])], "boq.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await uploadHistoricalBoq({ status: "idle" }, formDataFor({ projectId: "" }, xlsxFile));

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const historicalBoqInsert = insertMock.mock.calls.find(([table]) => table === "historical_boqs");
    expect(historicalBoqInsert?.[1]).toMatchObject({ organisation_id: "org-1", project_id: null });

    const jobInsert = insertMock.mock.calls.find(([table]) => table === "historical_boq_processing_jobs");
    expect(jobInsert?.[1]).toMatchObject({ organisation_id: "org-1", project_id: null });

    expect(processHistoricalBoqMock).toHaveBeenCalledTimes(1);
  });
});
