import { z } from "zod";
import { normalizeItemDecimal, itemTotal } from "./contracting-items";
import { BusinessError } from "./errors";
import { idSchema } from "./validation";
export const instrumentTypes = {
  TERM: "Termo de Contrato",
  COMMITMENT: "Nota de Empenho",
} as const;
export const instrumentStatuses = {
  DRAFT: "Em preparação",
  ACTIVE: "Em andamento",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
} as const;
export const optionalText = z
  .string()
  .trim()
  .max(10000)
  .default("")
  .transform((v) => v || null);
export const shortText = z.string().trim().min(1, "Informe o campo.").max(200);
export const optionalId = z
  .union([idSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida.",
  )
  .transform((v) => new Date(`${v}T00:00:00.000Z`));
export const optionalDay = z
  .union([day, z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);
export const documentUrl = z
  .union([
    z
      .url()
      .max(2000)
      .refine((v) => /^https?:\/\//.test(v), "Use um link HTTP ou HTTPS."),
    z.literal(""),
  ])
  .default("")
  .transform((v) => v || null);
export function decimal(scale: number, positive = false, signed = false) {
  return z
    .string()
    .trim()
    .transform((raw, ctx) => {
      const negative = signed && raw.startsWith("-");
      let value: string | null = null;
      try {
        value = normalizeItemDecimal(
          negative ? raw.slice(1) : raw,
          scale,
          18 - scale,
          positive,
        );
      } catch {
        /* Convert parser errors into field validation issues. */
      }
      if (value === null) {
        ctx.addIssue({
          code: "custom",
          message: `Informe um valor ${positive ? "positivo" : "válido"} com até ${scale} casas decimais.`,
        });
        return z.NEVER;
      }
      return negative && !/^0\.0+$/.test(value) ? `-${value}` : value;
    });
}
export const instrumentSchema = z
  .object({
    instrumentType: z.enum(["TERM", "COMMITMENT"]),
    reference: shortText,
    issuedAt: day,
    amount: decimal(2),
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "CANCELLED"]),
    signatureDate: optionalDay,
    validFrom: optionalDay,
    validUntil: optionalDay,
    commitmentReference: optionalText,
    supplyDeadline: optionalDay,
    parentTermId: optionalId,
    documentUrl,
    notes: optionalText,
  })
  .superRefine((v, c) => {
    if (
      v.instrumentType === "TERM" &&
      (!v.signatureDate || !v.validFrom || !v.validUntil)
    )
      c.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Informe assinatura e início/fim da vigência do Termo.",
      });
    if (v.validFrom && v.validUntil && v.validUntil < v.validFrom)
      c.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Fim da vigência anterior ao início.",
      });
    if (v.instrumentType === "TERM" && v.parentTermId)
      c.addIssue({
        code: "custom",
        path: ["parentTermId"],
        message: "Somente empenhos podem vincular um Termo.",
      });
  });
export const contractItemSchema = z.object({
  number: z.coerce.number().int().min(1).max(999999),
  description: z.string().trim().min(2).max(20000),
  unit: shortText,
  brand: optionalText,
  model: optionalText,
  quantity: decimal(3, true),
  unitPrice: decimal(4),
  opportunityItemId: optionalId,
});
export const orderSchema = z.object({
  reference: optionalText,
  orderDate: day,
  deadline: optionalDay,
  notes: optionalText,
  items: z
    .array(z.object({ contractItemId: idSchema, quantity: decimal(3, true) }))
    .min(1)
    .max(1000),
});
export const invoiceSchema = z.object({
  reference: shortText,
  issueDate: day,
  orderId: optionalId,
  documentUrl,
  notes: optionalText,
  items: z
    .array(z.object({ contractItemId: idSchema, quantity: decimal(3, true) }))
    .min(1)
    .max(1000),
});
export const receiptSchema = z.object({
  invoiceId: idSchema,
  date: day,
  amount: decimal(2, true),
  notes: optionalText,
});
export const guaranteeSchema = z.object({
  type: shortText,
  amount: decimal(2),
  validUntil: day,
  status: z.enum(["ACTIVE", "RELEASED", "CANCELLED"]),
  documentUrl,
  notes: optionalText,
});
export const amendmentSchema = z.object({
  reference: shortText,
  date: day,
  type: shortText,
  valueDelta: decimal(2, false, true),
  newEndDate: optionalDay,
  documentUrl,
  notes: optionalText,
  items: z
    .array(
      z.object({
        contractItemId: idSchema,
        quantityDelta: decimal(3, false, true),
        unitPriceDelta: decimal(4, false, true),
      }),
    )
    .max(1000),
});
// All arithmetic uses integer fixed-point units. HALF_UP once per line, then sum cents.
export const units = (
  value: { toString(): string } | string,
  scale: number,
): bigint => {
  const raw = value.toString();
  const neg = raw.startsWith("-");
  const [i, f = ""] = raw.replace(/^-/, "").split(".");
  return BigInt(i + (f + "0".repeat(scale)).slice(0, scale)) * (neg ? -1n : 1n);
};
export const fixed = (value: bigint, scale: number) =>
  `${value < 0n ? "-" : ""}${(value < 0n ? -value : value) / 10n ** BigInt(scale)}.${((value < 0n ? -value : value) % 10n ** BigInt(scale)).toString().padStart(scale, "0")}`;
export function bounded(value: bigint, scale: number) {
  if (value < 0n || value >= 10n ** 18n)
    throw new BusinessError("Valor fora dos limites permitidos.");
  return fixed(value, scale);
}
export function orderStatus(
  cancelled: boolean,
  items: {
    requestedQuantity: { toString(): string };
    suppliedQuantity: { toString(): string };
  }[],
) {
  if (cancelled) return "Cancelado";
  if (
    items.every(
      (i) => units(i.suppliedQuantity, 3) === units(i.requestedQuantity, 3),
    )
  )
    return "Fornecido";
  return items.some((i) => units(i.suppliedQuantity, 3) > 0n)
    ? "Parcialmente fornecido"
    : "Pendente";
}
export function lineValue(quantity: string, unitPrice: string) {
  try {
    return itemTotal(quantity, unitPrice)!;
  } catch {
    throw new BusinessError(
      "O total do item excede o limite monetário permitido.",
    );
  }
}
