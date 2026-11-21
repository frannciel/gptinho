import { describe, it, expect } from "vitest";
import {
  pricingSchema,
  minimumViablePrice,
  aboveReference,
  winnerTotals,
  monetary4,
  maskMoney4,
} from "@/lib/pricing";
const input = {
  supplierId: "cm00000000000000000000000",
  acquisitionUnit: "100",
  freightUnit: "10",
  taxRate: "10",
  netProfitRate: "20",
  pricingAdministrativeRate: "5",
};
describe("precificação decimal exata", () => {
  it.each(["abc", "-1", "1,234", ""])(
    "recusa percentual inválido %s sem erro de conversão",
    (value) =>
      expect(
        pricingSchema.safeParse({ ...input, taxRate: value }).success,
      ).toBe(false),
  );
  it("calcula a fórmula com quatro casas e HALF_UP", () =>
    expect(minimumViablePrice(pricingSchema.parse(input))).toBe("169.2308"));
  it("arredonda meio para cima", () =>
    expect(
      minimumViablePrice(
        pricingSchema.parse({
          ...input,
          acquisitionUnit: "0.0001",
          freightUnit: "0",
          taxRate: "60",
          netProfitRate: "0",
          pricingAdministrativeRate: "0",
        }),
      ),
    ).toBe("0.0003"));
  it.each(["65", "66"])("recusa denominador não positivo %s", (p) =>
    expect(
      pricingSchema.safeParse({
        ...input,
        netProfitRate: p,
        taxRate: "30",
        pricingAdministrativeRate: "5",
      }).success,
    ).toBe(false),
  );
  it("aceita 99,99% sem precisão binária", () =>
    expect(
      minimumViablePrice(
        pricingSchema.parse({
          ...input,
          acquisitionUnit: "0.0001",
          freightUnit: "0",
          taxRate: "99.99",
          netProfitRate: "0",
          pricingAdministrativeRate: "0",
        }),
      ),
    ).toBe("1.0000"));
  it("aceita custo zero", () =>
    expect(
      minimumViablePrice(
        pricingSchema.parse({
          ...input,
          acquisitionUnit: "0",
          freightUnit: "0",
        }),
      ),
    ).toBe("0.0000"));
  it("rejeita overflow calculado", () =>
    expect(() =>
      minimumViablePrice(
        pricingSchema.parse({
          ...input,
          acquisitionUnit: "99999999999999",
          taxRate: "99.99",
          netProfitRate: "0",
          pricingAdministrativeRate: "0",
        }),
      ),
    ).toThrow("limite"));
  it("compara referências exatas sem bloquear", () => {
    expect(aboveReference("100.0001", "100.0000")).toBe(true);
    expect(aboveReference("100.0000", "100.0000")).toBe(false);
    expect(aboveReference(null, "100.0000")).toBe(false);
  });
  it("soma valores vencedores por item em centavos", () =>
    expect(
      winnerTotals([
        { quantity: "2.000", unitPrice: "100.1250" },
        { quantity: "1.500", unitPrice: "10.0000" },
      ]).total,
    ).toBe("215.25"));
  it("não apresenta soma parcial como total", () =>
    expect(
      winnerTotals([{ quantity: "2.000", unitPrice: null }]).total,
    ).toBeNull());
  it("normaliza quatro casas e recusa quinta", () => {
    expect(monetary4.parse("1.234,5678")).toBe("1234.5678");
    expect(monetary4.safeParse("1,23456").success).toBe(false);
  });
  it("aplica máscara brasileira com quatro casas", () =>
    expect(maskMoney4("1234567,12345")).toBe("1.234.567,1234"));
});
