import { z } from "zod";
export const supplierIdentitySchema = z.object({
  id: z.string().min(1),
  legalName: z.string().min(1),
  tradeName: z.string().nullable(),
  cnpj: z.string().nullable(),
});
export type SupplierIdentity = z.infer<typeof supplierIdentitySchema>;
export function supplierIdentity(supplier: SupplierIdentity): SupplierIdentity {
  return {
    id: supplier.id,
    legalName: supplier.legalName,
    tradeName: supplier.tradeName,
    cnpj: supplier.cnpj,
  };
}
export function recordedSupplier(item: {
  supplierId: string | null;
  pricingSnapshot: unknown;
  supplier: SupplierIdentity | null;
}): SupplierIdentity | null {
  if (!item.supplierId) return null;
  const root = item.pricingSnapshot;
  if (
    root &&
    typeof root === "object" &&
    !Array.isArray(root) &&
    "supplierSnapshot" in root
  ) {
    const result = supplierIdentitySchema.safeParse(root.supplierSnapshot);
    if (result.success && result.data.id === item.supplierId)
      return result.data;
  }
  return item.supplier?.id === item.supplierId
    ? supplierIdentity(item.supplier)
    : null;
}
