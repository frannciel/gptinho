import { describe, it, expect } from "vitest";
import {
  financialSummary,
  itemProfitRate,
  type FinancialItem,
} from "@/lib/financial-summary";
const item: FinancialItem = {
  quantity: "2.000",
  unitPrice: "100.1250",
  winningUnitPrice: "180.1234",
  winner: true,
  acquisitionUnit: "100.0000",
  freightUnit: "10.0000",
  taxRate: "10.00",
  pricingAdministrativeRate: "5.00",
};
describe("resumo financeiro decimal", () => {
  it("apura referência com tributos e despesa sobre receita e lucro sobre aquisição", () =>
    expect(financialSummary([item], "estimated")).toMatchObject({
      acquisition: "200.00",
      freight: "20.00",
      taxes: "20.03",
      administrative: "10.01",
      profit: "-49.79",
      profitRate: "-24.90",
    }));
  it("apura oferta vencedora e simulação com a mesma regra", () => {
    expect(financialSummary([item], "winning")).toMatchObject({
      taxes: "36.03",
      administrative: "18.01",
      profit: "86.21",
      profitRate: "43.11",
    });
    expect(itemProfitRate(item, "180.1234")).toBe("43.11");
  });
  it("soma os resultados dos itens e calcula percentual ponderado pela aquisição", () => {
    const summary = financialSummary(
      [item, { ...item, quantity: "1.000", acquisitionUnit: "50.0000" }],
      "winning",
    );
    expect(summary.acquisition).toBe("250.00");
    expect(summary.profit).toBe("179.31");
    expect(summary.profitRate).toBe("71.72");
  });
  it("mantém pendências e diferencia aquisição zero", () => {
    expect(
      financialSummary([{ ...item, winningUnitPrice: null }], "winning").profit,
    ).toBeNull();
    expect(
      financialSummary([{ ...item, acquisitionUnit: null }], "winning")
        .acquisition,
    ).toBeNull();
    expect(
      itemProfitRate({ ...item, acquisitionUnit: "0.0000" }, "180.1234"),
    ).toBeNull();
  });
  it("oferece totais zero para conjunto vazio sem inventar percentual", () =>
    expect(financialSummary([], "winning")).toMatchObject({
      acquisition: "0.00",
      profit: "0.00",
      profitRate: null,
      count: 0,
    }));
  it("preserva quantidades fracionárias e arredonda centavos HALF_UP", () =>
    expect(
      financialSummary(
        [
          {
            ...item,
            quantity: "0.001",
            acquisitionUnit: "5.0000",
            freightUnit: "0.0000",
            unitPrice: "10.0000",
            taxRate: "0.00",
            pricingAdministrativeRate: "0.00",
          },
        ],
        "estimated",
      ),
    ).toMatchObject({
      acquisition: "0.01",
      profit: "0.00",
      profitRate: "0.00",
    }));
});
