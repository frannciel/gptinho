import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { unitMoney, winnerTotals, aboveReference } from "@/lib/pricing";
import { money } from "@/lib/format";
import { ContractingTabs } from "@/components/contracting-tabs";
import { PageHeader } from "@/components/page-header";
import { HelpTooltip } from "@/components/help-tooltip";
import { WinningPriceInput } from "@/components/winning-price-input";
import { ActionForm } from "@/components/action-form";
import { pricingAction } from "../pricing-actions";
export default async function WinnersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const p = await db.opportunity.findUnique({
    where: { id },
    include: { items: { where: { winner: true }, orderBy: { number: "asc" } } },
  });
  if (!p) notFound();
  const s = await searchParams;
  const totals = winnerTotals(
    p.items.map((i) => ({
      quantity: i.quantity.toFixed(3),
      unitPrice: i.winningUnitPrice?.toFixed(4) ?? null,
    })),
  );
  return (
    <>
      <PageHeader
        eyebrow="Comercial · Contratações"
        title={`Proposta Vencedora · ${p.reference}`}
        description="Registre o valor unitário ofertado dos itens marcados como vencedores."
      />
      <ContractingTabs id={id} active="proposta-vencedora" />
      {s.saved && (
        <p role="status" className="mb-5 text-brand-700">
          Proposta vencedora salva.
        </p>
      )}
      <p className="mb-5 text-sm text-slate-500">
        Somente os itens vencedores são exibidos. Salve cada linha antes de
        editar a próxima.
      </p>
      <section className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Valor Estimado</th>
              <th className="px-4 py-3">Preço mínimo</th>
              <th className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  Proposta Vencedora
                  <HelpTooltip
                    id="winning-price-help"
                    label="Ajuda sobre Proposta Vencedora"
                    text="Informe o valor unitário ofertado que venceu a contratação, com até quatro casas decimais. O valor total é calculado pela quantidade do item. Este campo não substitui o preço mínimo da precificação."
                  />
                </span>
              </th>
              <th className="px-4 py-3">Valor Total</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {p.items.map((i, index) => {
              const formId = `winning-${i.id}`;
              return (
                <tr key={`${i.id}-${p.version}`}>
                  <td className="px-4 py-4">{i.number}</td>
                  <td className="max-w-xs px-4 py-4">
                    <span className="line-clamp-2" title={i.description}>
                      {i.description}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {unitMoney(i.unitPrice?.toFixed(4) ?? null)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-4 ${aboveReference(i.minimumPrice?.toFixed(4) ?? null, i.unitPrice?.toFixed(4) ?? null) ? "bg-amber-50 text-amber-800" : ""}`}
                  >
                    {unitMoney(i.minimumPrice?.toFixed(4) ?? null)}
                  </td>
                  <td className="px-4 py-4">
                    <WinningPriceInput
                      formId={formId}
                      number={i.number}
                      value={i.winningUnitPrice?.toFixed(4) ?? null}
                      disabled={p.archived}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {totals.lines[index] === null
                      ? "Pendente"
                      : money(totals.lines[index]!)}
                  </td>
                  <td className="px-4 py-4">
                    {!p.archived && (
                      <ActionForm id={formId} action={pricingAction}>
                        <input
                          type="hidden"
                          name="operation"
                          value="winningPrice"
                        />
                        <input type="hidden" name="opportunityId" value={id} />
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="version" value={p.version} />
                        <button
                          className="btn"
                          aria-label={`Salvar proposta do item ${i.number}`}
                        >
                          Salvar
                        </button>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!p.items.length && (
          <p className="p-8 text-center text-sm">
            Nenhum item marcado como vencedor.
          </p>
        )}
        <footer className="border-t p-6 text-right font-semibold">
          Total da proposta vencedora:{" "}
          {p.items.length === 0
            ? money("0.00")
            : totals.total === null
              ? "Pendente — informe o valor de todos os itens vencedores"
              : money(totals.total)}
        </footer>
      </section>
    </>
  );
}
