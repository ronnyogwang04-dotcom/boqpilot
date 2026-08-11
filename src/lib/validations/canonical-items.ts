import { z } from "zod";

export const updateCanonicalItemSchema = z.object({
  id: z.string().uuid(),
  normalisedDescription: z.string().trim().min(1, "Description can't be empty"),
  normalisedUnit: z.string().trim().min(1, "Unit can't be empty"),
  division: z.string().trim().min(1, "Choose a division"),
  category: z.string().trim().min(1, "Choose a category"),
  adminNotes: z.string().trim().max(2000).optional(),
});

export const mergeCanonicalItemsSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});
