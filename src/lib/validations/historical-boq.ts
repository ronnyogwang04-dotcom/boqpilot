import { z } from "zod";

export const historicalBoqUploadSchema = z.object({
  projectId: z.string().uuid("Select a project"),
});
