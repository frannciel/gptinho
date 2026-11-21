import { z } from "zod";
import { percentage } from "./catalog-validation";
import { idSchema } from "./validation";
import {
  OPPORTUNITY_STATUS_VALUES,
  PROCUREMENT_METHOD_VALUES,
  parseBrasiliaDeadline,
} from "./opportunity-values";
import { normalizeItemDecimal, itemsTotal } from "./contracting-items";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const externalUrl = z
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
    items: z
      .array(
        z
          .object({
            id: idSchema.optional(),
            type: z.enum(["MATERIAL", "SERVICE"]).nullable().optional(),
            taxRate: percentage.nullable().optional(),
            winner: z.boolean().optional(),
            catalogProductId: idSchema.nullable().optional(),
            brand: optionalText(120).optional(),
            model: optionalText(120).optional(),
            margin: percentage.nullable().optional(),
            administrativeCost: percentage.nullable().optional(),
            supplierId: idSchema.nullable().optional(),
            number: z
              .string()
              .regex(/^\d{1,6}$/, "Informe um número de item entre 1 e 999999.")
              .transform(Number)
              .refine(
                (value) => value > 0,
                "O número do item deve ser positivo.",
              ),
            description: z
              .string()
              .trim()
              .min(3, "Descreva o item com pelo menos 3 caracteres.")
              .max(20000),
            unit: z
              .string()
              .trim()
              .min(1, "Informe a unidade.")
              .max(20)
              .transform((value) => value.toUpperCase()),
            quantity: z
              .string()
              .max(60)
              .transform((value, ctx) => {
                try {
                  const number = normalizeItemDecimal(value, 3, 15, true);
                  if (number === null) throw new Error("Informe a quantidade.");
                  return number;
                } catch (error) {
                  ctx.addIssue({
                    code: "custom",
                    message: (error as Error).message,
                  });
                  return z.NEVER;
                }
              }),
            unitPrice: z
              .string()
              .max(60)
              .transform((value, ctx) => {
                try {
                  return normalizeItemDecimal(value, 4, 14);
                } catch (error) {
                  ctx.addIssue({
                    code: "custom",
                    message: (error as Error).message,
                  });
                  return z.NEVER;
                }
              }),
          })
          .strict(),
      )
      .max(100, "Cadastre no máximo 100 itens por contratação."),
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
    platformUrl: externalUrl,
    attachmentsUrl: externalUrl,
    notes: optionalText(5000),
  })
  .strict()
  .superRefine((data, ctx) => {
    const numbers = new Set<number>();
    const ids = new Set<string>();
    data.items.forEach((item, index) => {
      if (numbers.has(item.number))
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "number"],
          message: "Número de item repetido nesta contratação.",
        });
      numbers.add(item.number);
      if (item.id) {
        if (ids.has(item.id))
          ctx.addIssue({
            code: "custom",
            path: ["items", index, "id"],
            message: "Item repetido no formulário.",
          });
        ids.add(item.id);
      }
    });
    try {
      if (
        data.items.every(
          (item) =>
            typeof item.quantity === "string" &&
            (item.unitPrice === null || typeof item.unitPrice === "string"),
        )
      )
        itemsTotal(data.items);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: (error as Error).message,
      });
    }
  });
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
