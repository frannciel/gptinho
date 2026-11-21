import { describe, it, expect } from "vitest";
import { recordedSupplier } from "@/lib/item-supplier";
const original = {
  id: "supplier-a",
  legalName: "Fornecedor original",
  tradeName: "Original",
  cnpj: "00000000000000",
};
describe("identificação do fornecedor da contratação", () => {
  it("prioriza o snapshot em vez do cadastro atual", () =>
    expect(
      recordedSupplier({
        supplierId: original.id,
        pricingSnapshot: { supplierSnapshot: original },
        supplier: { ...original, legalName: "Nome alterado" },
      }),
    ).toEqual(original));
  it("consulta o cadastro para registros legados sem inventar identificação passada", () =>
    expect(
      recordedSupplier({
        supplierId: original.id,
        pricingSnapshot: { supplierId: original.id },
        supplier: original,
      }),
    ).toEqual(original));
  it("recusa snapshot de outro fornecedor e usa o vínculo correto", () =>
    expect(
      recordedSupplier({
        supplierId: original.id,
        pricingSnapshot: { supplierSnapshot: { ...original, id: "other" } },
        supplier: original,
      }),
    ).toEqual(original));
  it("não cria fornecedor para item sem seleção", () =>
    expect(
      recordedSupplier({
        supplierId: null,
        pricingSnapshot: { supplierSnapshot: original },
        supplier: original,
      }),
    ).toBeNull());
  it("tolera snapshot antigo ou inválido sem ocultar a relação válida", () =>
    expect(
      recordedSupplier({
        supplierId: original.id,
        pricingSnapshot: { supplierSnapshot: { id: original.id } },
        supplier: original,
      }),
    ).toEqual(original));
});
