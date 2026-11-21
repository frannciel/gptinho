import { z } from "zod";
import { normalizeItemDecimal, itemsTotal } from "./contracting-items";
import { percentage } from "./catalog-validation";
import { idSchema } from "./validation";
export const monetary4 = z
  .string()
  .max(60)
  .transform((v, ctx) => {
    try {
      const n = normalizeItemDecimal(v, 4, 14);
      if (n === null) throw new Error("Informe o valor.");
      return n;
    } catch (e) {
      ctx.addIssue({ code: "custom", message: (e as Error).message });
      return z.NEVER;
    }
  });
export const pricingSchema = z
  .object({
    supplierId: idSchema,
    acquisitionUnit: monetary4,
    freightUnit: monetary4,
    taxRate: percentage,
    netProfitRate: percentage,
    pricingAdministrativeRate: percentage,
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      ![p.taxRate, p.netProfitRate, p.pricingAdministrativeRate].every((v) =>
        /^\d+\.\d{2}$/.test(v),
      )
    )
      return;
    if (
      [p.taxRate, p.netProfitRate, p.pricingAdministrativeRate].reduce(
        (sum, v) => sum + BigInt(v.replace(".", "")),
        0n,
      ) >= 10000n
    )
      ctx.addIssue({
        code: "custom",
        path: ["netProfitRate"],
        message:
          "A soma de tributos, custo administrativo e lucro líquido deve ser menor que 100%.",
      });
  });
export function minimumViablePrice(p: z.output<typeof pricingSchema>): string {
  const denominator =
    10000n -
    [p.taxRate, p.netProfitRate, p.pricingAdministrativeRate].reduce(
      (s, v) => s + BigInt(v.replace(".", "")),
      0n,
    );
  if (denominator <= 0n) throw new Error("O denominador deve ser positivo.");
  const numerator =
    (BigInt(p.acquisitionUnit.replace(".", "")) +
      BigInt(p.freightUnit.replace(".", ""))) *
    10000n;
  const scaled = (numerator * 2n + denominator) / (2n * denominator);
  if (scaled > 999999999999999999n)
    throw new Error("O preço calculado excede o limite monetário.");
  return `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, "0")}`;
}
export function aboveReference(
  minimum: string | null,
  reference: string | null,
) {
  return (
    minimum !== null &&
    reference !== null &&
    BigInt(minimum.replace(".", "")) > BigInt(reference.replace(".", ""))
  );
}
export function winnerTotals(
  items: { quantity: string; unitPrice: string | null }[],
) {
  return itemsTotal(items);
}
export function unitMoney(value: string | null) {
  if (value === null) return "Não informado";
  const [whole, fraction] = value.split(".");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${(fraction ?? "").padEnd(4, "0")}`;
}
export function maskMoney4(value: string) {
  let clean = value.replace(/[^\d,]/g, "");
  const [whole, ...parts] = clean.split(",");
  clean = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.length ? `${clean},${parts.join("").slice(0, 4)}` : clean;
}
