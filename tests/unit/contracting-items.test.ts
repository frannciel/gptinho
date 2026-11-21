import { describe, it, expect } from "vitest";
import {
  normalizeItemDecimal,
  itemTotal,
  itemsTotal,
} from "@/lib/contracting-items";
import { opportunitySchema } from "@/lib/opportunity-validation";
import {
  OPPORTUNITY_STATUS_VALUES,
  OPPORTUNITY_STATUSES,
  hasActiveDeadline,
} from "@/lib/opportunity-values";
const item = {
  number: "1",
  description: "Licença de software",
  unit: "UN",
  quantity: "2",
  unitPrice: "100,1250",
};
const base = {
  reference: "CT-2026-001",
  organizationId: "cpublicagency0000000000000",
  subject: "Licenças de software para o órgão",
  procurementMethod: "ELECTRONIC_AUCTION",
  processNumber: "",
  items: [item],
  proposalDeadline: "",
  status: "PROPOSAL_REGISTERED",
  platformUrl: "https://example.org/plataforma",
  attachmentsUrl: "https://example.org/anexos",
  notes: "",
};
describe("Totais derivados dos itens", () => {
  it("normaliza quantidade com 3 e valor unitário com 4 casas sem ponto flutuante", () => {
    expect(normalizeItemDecimal("1,5", 3, 15, true)).toBe("1.500");
    expect(normalizeItemDecimal("R$ 1.234,5678", 4, 14)).toBe("1234.5678");
    expect(itemTotal("1.500", "12.3456")).toBe("18.52");
  });
  it("soma os totais de cada item depois de arredondar os centavos", () =>
    expect(
      itemsTotal([
        { quantity: "1.000", unitPrice: "0.0050" },
        { quantity: "1.000", unitPrice: "0.0050" },
      ]),
    ).toEqual({ total: "0.02", lines: ["0.01", "0.01"] }));
  it("diferencia ausência de itens, preço desconhecido e zero real", () => {
    expect(itemsTotal([]).total).toBeNull();
    expect(
      itemsTotal([{ quantity: "1.000", unitPrice: null }]).total,
    ).toBeNull();
    expect(itemsTotal([{ quantity: "1.000", unitPrice: "0.0000" }]).total).toBe(
      "0.00",
    );
    expect(
      itemsTotal([
        { quantity: "2.000", unitPrice: "10.0000" },
        { quantity: "1.000", unitPrice: null },
      ]),
    ).toEqual({ total: null, lines: ["20.00", null] });
  });
  it("recusa total de item e somatório acima do limite monetário", () => {
    expect(() =>
      itemsTotal([{ quantity: "101.000", unitPrice: "99999999999999.9900" }]),
    ).toThrow("total do item");
    expect(() =>
      itemsTotal([
        { quantity: "100.000", unitPrice: "99999999999999.9900" },
        { quantity: "100.000", unitPrice: "99999999999999.9900" },
      ]),
    ).toThrow("total da contratação");
  });
  it.each(["0", "-1", "1,0001", "NaN"])(
    "rejeita quantidade inválida %s",
    (quantity) =>
      expect(() => normalizeItemDecimal(quantity, 3, 15, true)).toThrow(),
  );
  it("rejeita mais casas no preço em vez de truncar", () =>
    expect(() => normalizeItemDecimal("1,23456", 4, 14)).toThrow());
  it("valida os itens e ignora nenhuma tentativa de enviar valor manual", () => {
    expect(opportunitySchema.parse(base).items[0]).toMatchObject({
      number: 1,
      quantity: "2.000",
      unitPrice: "100.1250",
    });
    expect(
      opportunitySchema.safeParse({ ...base, estimatedValue: "1,00" }).success,
    ).toBe(false);
    expect(
      opportunitySchema.safeParse({ ...base, sourceUrl: "https://example.org" })
        .success,
    ).toBe(false);
  });
  it("rejeita números/IDs repetidos e campos administrativos nos itens", () => {
    expect(
      opportunitySchema.safeParse({ ...base, items: [item, item] }).success,
    ).toBe(false);
    const id = "citem000000000000000000001";
    expect(
      opportunitySchema.safeParse({
        ...base,
        items: [
          { ...item, id },
          { ...item, id, number: "2" },
        ],
      }).success,
    ).toBe(false);
    expect(
      opportunitySchema.safeParse({
        ...base,
        items: [{ ...item, total: "0.01" }],
      }).success,
    ).toBe(false);
  });
  it("permite estimativa ainda sem preço e limita o número de itens", () => {
    expect(
      opportunitySchema.parse({ ...base, items: [{ ...item, unitPrice: "" }] })
        .items[0].unitPrice,
    ).toBeNull();
    expect(
      opportunitySchema.safeParse({
        ...base,
        items: Array.from({ length: 101 }, (_, i) => ({
          ...item,
          number: String(i + 1),
        })),
      }).success,
    ).toBe(false);
  });
});
describe("Situações e links de contratação", () => {
  it("oferece as seis situações incluindo Classificada", () => {
    expect(
      OPPORTUNITY_STATUS_VALUES.map((value) => OPPORTUNITY_STATUSES[value]),
    ).toEqual([
      "Classificada",
      "Cancelada",
      "Suspensa",
      "Homologada",
      "Proposta Cadastrada",
      "Encerrada",
    ]);
    for (const status of OPPORTUNITY_STATUS_VALUES)
      expect(opportunitySchema.safeParse({ ...base, status }).success).toBe(
        true,
      );
    expect(
      opportunitySchema.safeParse({ ...base, status: "OPEN" }).success,
    ).toBe(false);
  });
  it("não alerta prazo como ativo em contratação suspensa ou homologada", () => {
    expect(hasActiveDeadline("PROPOSAL_REGISTERED")).toBe(true);
    for (const status of ["CANCELLED", "SUSPENDED", "HOMOLOGATED", "CLOSED"])
      expect(hasActiveDeadline(status)).toBe(false);
  });
  it.each(["platformUrl", "attachmentsUrl"] as const)(
    "valida o link %s independentemente",
    (key) => {
      expect(
        opportunitySchema.safeParse({ ...base, [key]: "javascript:alert(1)" })
          .success,
      ).toBe(false);
      expect(
        opportunitySchema.safeParse({
          ...base,
          [key]: "https://user:password@example.org",
        }).success,
      ).toBe(false);
      expect(opportunitySchema.parse({ ...base, [key]: "" })[key]).toBeNull();
    },
  );
});
