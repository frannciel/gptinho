import { money } from "@/lib/format";
export function OpportunityMetrics({
  stats,
}: {
  stats: {
    open: number;
    overdue: number;
    dueSoon: number;
    estimatedValue: string | null;
    withValue: number;
  };
}) {
  return (
    <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {
          label: "Em acompanhamento",
          value: String(stats.open),
          detail: "Abertas, em análise, cotação ou proposta",
        },
        {
          label: "Prazos vencidos",
          value: String(stats.overdue),
          detail: "Na carteira em acompanhamento",
        },
        {
          label: "Próximos 7 dias",
          value: String(stats.dueSoon),
          detail: "Prazos de apresentação em aberto",
        },
        {
          label: "Valor estimado em aberto",
          value:
            stats.estimatedValue === null
              ? "Não informado"
              : money(stats.estimatedValue),
          detail: `${stats.withValue} ${stats.withValue === 1 ? "oportunidade" : "oportunidades"} com valor informado`,
        },
      ].map((metric) => (
        <div className="panel p-5" key={metric.label}>
          <p className="text-sm text-slate-500">{metric.label}</p>
          <p className="mt-3 break-words text-2xl font-bold text-ink">
            {metric.value}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            {metric.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
