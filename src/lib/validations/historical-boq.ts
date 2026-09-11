import { z } from "zod";

// projectId is now optional "source project" metadata — Historical BOQs are
// an organisation-wide library, not project-owned data. FormData.get()
// returns null (not undefined) for an absent/empty field, so both null and
// "" are normalised to undefined before uuid validation.
const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.length > 0 ? value : undefined),
  z.string().uuid().optional(),
);

export const historicalBoqUploadSchema = z.object({
  projectId: optionalUuid,
  returnToProject: optionalUuid,
});
