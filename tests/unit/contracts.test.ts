import { describe, it, expect } from "vitest";
import {
  decimal,
  day,
  instrumentSchema,
  units,
  fixed,
  orderStatus,
  lineValue,
  reconcileContractValue,
  invoiceSchema,
  priceFromPercent,
  percentFromPrice,
} from "@/lib/contracts";
describe("Contratos: precisão, datas e modalidades", () => {
  it("aceita valores brasileiros e quatro casas sem arredondar o cadastro", () => {
    expect(decimal(4).parse("1.234,5678")).toBe("1234.5678");
    expect(decimal(4).safeParse("0,00001").success).toBe(false);
    expect(lineValue("3.000", "0.1250")).toBe("0.38");
  });
  it("não aceita data impossível e usa meia-noite UTC para datas civis", () => {
    expect(day.safeParse("2026-02-30").success).toBe(false);
    expect(day.parse("2026-11-21").toISOString()).toBe(
      "2026-11-21T00:00:00.000Z",
    );
  });
  it("trata variações negativas com precisão e recusa valores exponenciais", () => {
    expect(decimal(3, false, true).parse("-0,001")).toBe("-0.001");
    expect(units("-0.001", 3)).toBe(-1n);
    expect(fixed(-1n, 3)).toBe("-0.001");
    expect(decimal(2).safeParse("1e4").success).toBe(false);
    expect(decimal(2, true).safeParse("0").success).toBe(false);
  });
  it("não obriga vigência em empenho e rejeita link executável", () => {
    const input = {
      instrumentType: "COMMITMENT",
      reference: "NE-01",
      issuedAt: "2026-11-01",
      amount: "1",
      status: "ACTIVE",
    };
    expect(instrumentSchema.safeParse(input).success).toBe(true);
    expect(
      instrumentSchema.safeParse({
        ...input,
        documentUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      instrumentSchema.safeParse({ ...input, instrumentType: "TERM" }).success,
    ).toBe(false);
  });
  it("calcula situação a partir do fornecimento acumulado", () => {
    const row = (v: string) => [
      { requestedQuantity: "3.000", suppliedQuantity: v },
    ];
    expect(orderStatus(false, row("0"))).toBe("Pendente");
    expect(orderStatus(false, row("1"))).toBe("Parcialmente fornecido");
    expect(orderStatus(false, row("3"))).toBe("Fornecido");
    expect(orderStatus(true, row("3"))).toBe("Cancelado");
  });
  it("confere centavos por linha sem ponto flutuante", () => {
    expect(
      reconcileContractValue("0.38", [
        { quantity: "3.000", unitPrice: "0.1250" },
      ]),
    ).toEqual({ matches: true, total: "0.38", declared: "0.38" });
    expect(
      reconcileContractValue("0.39", [{ quantity: "3", unitPrice: "0.1250" }])
        .matches,
    ).toBe(false);
  });
  it("Termo não exige emissão e empenho substitutivo exige sua própria emissão", () => {
    const term = {
      instrumentType: "TERM",
      reference: "CT",
      amount: "100",
      status: "DRAFT",
      signatureDate: "2026-11-01",
      validFrom: "2026-11-01",
      validUntil: "2027-11-01",
    };
    expect(instrumentSchema.safeParse(term).success).toBe(true);
    expect(
      instrumentSchema.safeParse({ ...term, instrumentType: "COMMITMENT" })
        .success,
    ).toBe(false);
  });
  it("chave da NF é opcional e alfanumérica sem impor 44 dígitos", () => {
    const base = {
      reference: "NF",
      issueDate: "2026-11-01",
      orderId: "ck123456789012345678901234",
      amount: "100",
    };
    expect(
      invoiceSchema.safeParse({ ...base, accessKey: "AbC123" }).success,
    ).toBe(true);
    expect(invoiceSchema.safeParse(base).success).toBe(true);
    expect(
      invoiceSchema.safeParse({ ...base, accessKey: "123-456" }).success,
    ).toBe(false);
  });
  it("apostilamento calcula valor e percentual com quatro casas exatas", () => {
    expect(priceFromPercent("10.0000", "12.5")).toBe("11.2500");
    expect(percentFromPrice("10.0000", "11.2500")).toBe("12.5000");
    expect(priceFromPercent("10.0000", "-10")).toBe("9.0000");
    expect(percentFromPrice("0.0000", "1.0000")).toBeNull();
    expect(() => priceFromPercent("10.0000", "-100.0001")).toThrow();
    expect(priceFromPercent("0.0001", "50")).toBe("0.0002");
  });
});
