import Link from "next/link";
export function ContractingTabs({
  id,
  active,
}: {
  id: string;
  active:
    | "resumo"
    | "itens"
    | "precificacao"
    | "proposta-vencedora"
    | "registros-precos"
    | "participantes";
}) {
  return (
    <nav
      aria-label="Seções da contratação"
      className="mb-6 flex flex-wrap gap-1 border-b border-slate-200"
    >
      {(
        [
          ["resumo", "Visão geral", ""],
          ["itens", "Gerenciar itens", "/itens"],
          ["precificacao", "Precificação", "/precificacao"],
          ["proposta-vencedora", "Proposta Vencedora", "/proposta-vencedora"],
          ["registros-precos", "Registros de preços", "/registros-precos"],
          ["participantes", "Participantes", "/participantes"],
        ] as const
      ).map(([key, label, suffix]) => (
        <Link
          key={key}
          aria-current={active === key ? "page" : undefined}
          href={`/contratacoes/${id}${suffix}`}
          className={`border-b-2 px-4 py-3 text-sm ${active === key ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-slate-500 hover:text-brand-700"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
