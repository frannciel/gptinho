import { z } from "zod";
import { idSchema } from "./validation";
import {
  OPPORTUNITY_STATUS_VALUES,
  PROCUREMENT_METHOD_VALUES,
  normalizeEstimatedValue,
  parseBrasiliaDeadline,
} from "./opportunity-values";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
export const opportunitySchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(3, "Informe pelo menos 3 caracteres.")
      .max(60)
      .transform((value) => value.toUpperCase()),
    organizationId: idSchema,
    subject: z
      .string()
      .trim()
      .min(10, "Descreva o objeto com pelo menos 10 caracteres.")
      .max(10000),
    procurementMethod: z.enum(PROCUREMENT_METHOD_VALUES),
    processNumber: optionalText(120).transform(
      (value) => value?.replace(/\s+/g, " ").toUpperCase() ?? null,
    ),
    estimatedValue: z
      .string()
      .max(80)
      .transform((value, ctx) => {
        try {
          return normalizeEstimatedValue(value);
        } catch (error) {
          ctx.addIssue({ code: "custom", message: (error as Error).message });
          return z.NEVER;
        }
      }),
    proposalDeadline: z
      .string()
      .max(16)
      .transform((value, ctx) => {
        try {
          return parseBrasiliaDeadline(value);
        } catch (error) {
          ctx.addIssue({ code: "custom", message: (error as Error).message });
          return z.NEVER;
        }
      }),
    status: z.enum(OPPORTUNITY_STATUS_VALUES),
    sourceUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Informe um link HTTPS sem usuário ou senha.")
      .transform((value) => value || null),
    notes: optionalText(5000),
  })
  .strict();
export type OpportunityInput = z.input<typeof opportunitySchema>;
export const opportunityFilters = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["all", ...OPPORTUNITY_STATUS_VALUES]).default("all"),
  organizationId: z.union([z.literal(""), idSchema]).default(""),
  deadline: z.enum(["all", "overdue", "next7days", "without"]).default("all"),
  archived: z.enum(["active", "archived", "all"]).default("active"),
  sort: z
    .enum(["deadline", "newest", "value", "reference"])
    .default("deadline"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
