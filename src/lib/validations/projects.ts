import { z } from "zod";

const sectorEnum = z.enum(["building", "civil", "electrical", "mechanical"]);
const statusEnum = z.enum(["draft", "active", "submitted", "won", "lost", "archived"]);

export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  status: statusEnum.optional(),
  projectNumber: z.string().optional(),
  tenderNumber: z.string().optional(),
  contractNumber: z.string().optional(),
  clientName: z.string().optional(),
  contractorName: z.string().optional(),
  province: z.string().optional(),
  municipality: z.string().optional(),
  town: z.string().optional(),
  physicalAddress: z.string().optional(),
  sector: z.array(sectorEnum).optional(),
  estimatedContractValue: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().nonnegative().optional(),
  ),
  tenderClosingDate: z.string().optional(),
  awardDate: z.string().optional(),
  notes: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
