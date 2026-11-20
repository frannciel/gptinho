import { describe, it, expect } from "vitest";
import {
  normalizeEstimatedValue,
  parseBrasiliaDeadline,
  deadlineInput,
  dateTime,
} from "@/lib/opportunity-values";
import {
  opportunitySchema,
  opportunityFilters,
} from "@/lib/opportunity-validation";
import { money } from "@/lib/format";
const base = {
  reference: " op-2026-001 ",
  organizationId: "cpublicagency0000000000000",
  subject: "Licenças de software para o órgão",
  procurementMethod: "ELECTRONIC_AUCTION",
  processNumber: "  proc  001/2026 ",
  estimatedValue: "1.234,56",
  proposalDeadline: "2026-11-19T17:30",
  status: "OPEN",
  sourceUrl: "",
  notes: "",
};
describe("Valores estimados com precisão decimal", () => {
  it.each([
    ["1.234,56", "1234.56"],
    ["1234.56", "1234.56"],
    ["R$ 1.234,50", "1234.50"],
    ["0", "0.00"],
    ["0,1", "0.10"],
    ["1.234", "1234.00"],
    ["00012,50", "12.50"],
    ["9.999.999.999.999.999,99", "9999999999999999.99"],
    ["", null],
  ])("normaliza %s", (input, output) =>
    expect(normalizeEstimatedValue(input)).toBe(output),
  );
  it.each(["-1", "1,234", "1.2,34", "1e6", "10000000000000000.00", "NaN"])(
    "rejeita %s sem arredondar/truncar",
    (input) => expect(() => normalizeEstimatedValue(input)).toThrow(),
  );
  it("formata grandes valores e centavos sem ponto flutuante", () => {
    expect(money("9999999999999999.99")).toBe(
      "R$\u00a09.999.999.999.999.999,99",
    );
    expect(money("10000000000000000.00")).toBe(
      "R$\u00a010.000.000.000.000.000,00",
    );
    expect(money("0.30")).toBe("R$\u00a00,30");
    expect(money("1.999")).toBe("R$\u00a02,00");
  });
});
describe("Prazo de apresentação no horário de Brasília", () => {
  it("converte horário de Brasília para UTC e volta sem mudar o dia", () => {
    const value = parseBrasiliaDeadline("2026-11-19T23:30")!;
    expect(value.toISOString()).toBe("2026-11-20T02:30:00.000Z");
    expect(deadlineInput(value)).toBe("2026-11-19T23:30");
    expect(dateTime(value)).toContain("19/11/2026");
  });
  it.each([
    "2026-02-30T12:00",
    "2026-13-01T12:00",
    "2026-01-01T25:00",
    "19/11/2026",
    "1999-01-01T00:00",
  ])("rejeita data inválida %s", (value) =>
    expect(() => parseBrasiliaDeadline(value)).toThrow(),
  );
  it("aceita passado e ausência de prazo sem inventar data", () => {
    expect(parseBrasiliaDeadline("")).toBeNull();
    expect(parseBrasiliaDeadline("2020-01-01T12:00")).toBeInstanceOf(Date);
  });
});
describe("Contrato de oportunidades", () => {
  it("normaliza identificação/processo e preserva desconhecidos como nulos", () => {
    const result = opportunitySchema.parse({
      ...base,
      estimatedValue: "",
      proposalDeadline: "",
    });
    expect(result).toMatchObject({
      reference: "OP-2026-001",
      processNumber: "PROC 001/2026",
      estimatedValue: null,
      proposalDeadline: null,
      sourceUrl: null,
      notes: null,
    });
  });
  it("rejeita propriedades administrativas, IDs inválidos e objeto insuficiente", () => {
    expect(
      opportunitySchema.safeParse({ ...base, archived: true }).success,
    ).toBe(false);
    expect(
      opportunitySchema.safeParse({ ...base, organizationId: "invalid" })
        .success,
    ).toBe(false);
    expect(
      opportunitySchema.safeParse({ ...base, subject: "curto" }).success,
    ).toBe(false);
  });
  it.each([
    "javascript:alert(1)",
    "http://example.org/edital",
    "https://user:password@example.org",
  ])("recusa fonte insegura %s", (sourceUrl) =>
    expect(opportunitySchema.safeParse({ ...base, sourceUrl }).success).toBe(
      false,
    ),
  );
  it("aceita fonte HTTPS sem credenciais", () =>
    expect(
      opportunitySchema.safeParse({
        ...base,
        sourceUrl: "https://example.org/edital",
      }).success,
    ).toBe(true));
  it("valida enumerações e filtros", () => {
    expect(
      opportunitySchema.safeParse({ ...base, status: "WON" }).success,
    ).toBe(false);
    expect(
      opportunityFilters.safeParse({ organizationId: "sql", page: -1 }).success,
    ).toBe(false);
    expect(opportunityFilters.parse({})).toMatchObject({
      archived: "active",
      status: "all",
      deadline: "all",
      page: 1,
    });
  });
});
