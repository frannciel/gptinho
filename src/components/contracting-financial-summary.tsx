import type { OpportunityItem } from "@prisma/client";
import { financialSummary, type FinancialItem } from "@/lib/financial-summary";
import { money } from "@/lib/format";
export function financialItem(item: OpportunityItem): FinancialItem {
  return {
    quantity: item.quantity.toFixed(3),
    unitPrice: item.unitPrice?.toFixed(4) ?? null,
    winningUnitPrice: item.winningUnitPrice?.toFixed(4) ?? null,
    winner: item.winner,
    acquisitionUnit: item.acquisitionUnit?.toFixed(4) ?? null,
    freightUnit: item.freightUnit?.toFixed(4) ?? null,
    taxRate: item.taxRate?.toFixed(2) ?? null,
    pricingAdministrativeRate:
      item.pricingAdministrativeRate?.toFixed(2) ?? null,
  };
}
export function ContractingFinancialSummary({
  items,
}: {
  items: OpportunityItem[];
}) {
  const values = items.map(financialItem);
  const summaries = [
    {
      title: "Todos os itens",
      data: financialSummary(values, "estimated"),
      description: "Receita baseada nos valores estimados.",
    },
    {
      title: "Itens vencedores",
      data: financialSummary(
        values.filter((i) => i.winner),
        "winning",
      ),
      description: "Receita baseada nas ofertas vencedoras.",
    },
  ];
  return (
    <section className="panel mt-6 p-6" aria-label="Resumo Financeiro">
      <h2 className="font-semibold">Resumo Financeiro</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {summaries.map(({ title, data, description }) => (
          <section
            key={title}
            className="rounded-lg border border-slate-200 p-5"
          >
            <h3 className="font-semibold">
              {title}{" "}
              <span className="text-xs text-slate-500">({data.count})</span>
            </h3>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
            <dl className="mt-5 space-y-3">
              {(
                [
                  ["acquisition", "Custo de Aquisição"],
                  ["freight", "Custo de Frete"],
                  ["taxes", "Total de Tributos"],
                  ["administrative", "Custos Administrativos"],
                  ["profit", "Lucro Líquido"],
                ] as const
              ).map(([key, label]) => (
                <div
                  className={`flex justify-between gap-3 text-sm ${key === "profit" && data.profit !== null ? (data.profit.startsWith("-") ? "rounded-lg border border-red-200 bg-red-50 p-3 font-semibold text-red-800" : data.profit === "0.00" ? "rounded-lg border border-slate-200 bg-slate-50 p-3 font-semibold" : "rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800") : ""}`}
                  key={key}
                >
                  <dt>
                    {label}
                    {key === "profit" && data.profit !== null && (
                      <span className="sr-only">
                        {data.profit.startsWith("-")
                          ? " — negativo"
                          : data.profit === "0.00"
                            ? " — zero"
                            : " — positivo"}
                      </span>
                    )}
                  </dt>
                  <dd
                    className={
                      key === "profit" && data[key]?.startsWith("-")
                        ? "font-semibold text-red-700"
                        : "font-medium"
                    }
                  >
                    {data[key] === null ? "Pendente" : money(data[key]!)}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t pt-3 text-sm">
                <dt>Lucro líquido / receita</dt>
                <dd>
                  {data.profitRate === null
                    ? "Não apurável"
                    : `${data.profitRate.replace(".", ",")}%`}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Valores pendentes exigem custos, alíquotas ou receita ainda não
        informados. Percentual apurado sobre a receita total; receita zero não
        permite apurar percentual.
      </p>
    </section>
  );
}
