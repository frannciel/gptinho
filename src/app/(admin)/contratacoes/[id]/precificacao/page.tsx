import { recordedSupplier } from "@/lib/item-supplier";
import { ButtonContent } from "@/components/button-content";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { unitMoney, aboveReference } from "@/lib/pricing";
import { ContractingTabs } from "@/components/contracting-tabs";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { pricingAction } from "../pricing-actions";
export default async function PricingPage({
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
    include: {
      items: {
        orderBy: { number: "asc" },
        include: {
          supplier: true,
          catalogProduct: {
            include: { suppliers: { include: { supplier: true } } },
          },
        },
      },
    },
  });
  if (!p) notFound();
  const s = await searchParams;
  return (
    <>
      <PageHeader
        eyebrow="Comercial · Contratações"
        title={`Precificação · ${p.reference}`}
        description="Calcule o preço mínimo viável de cada item com custos unitários e percentuais."
      />
      <ContractingTabs id={id} active="precificacao" />
      {s.saved && (
        <p role="status" className="mb-5 text-brand-700">
          Precificação salva.
        </p>
      )}
      <p className="mb-5 text-sm text-slate-500">
        Frete e aquisição são unitários. A soma dos percentuais deve ser menor
        que 100%. A cor amarela indica preço mínimo acima do valor estimado e
        não impede a participação. Salve cada linha antes de editar a próxima.
      </p>
      {p.archived && (
        <p className="mb-5">
          Contratação arquivada. Os valores estão disponíveis para consulta.
        </p>
      )}
      <section className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {[
                "Item",
                "Descrição",
                "Fornecedor",
                "Valor de Aquisição",
                "Custo de frete",
                "Alíquota tributária (%)",
                "Lucro Líquido (%)",
                "Custo Administrativo (%)",
                "Preço Mínimo Viável",
                "Ações",
              ].map((t) => (
                <th className="px-3 py-3" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {p.items.map((i) => {
              const formId = `pricing-${i.id}`;
              const savedSupplier = recordedSupplier(i);
              const suppliers = [
                ...(savedSupplier
                  ? [
                      {
                        id: savedSupplier.id,
                        legalName: savedSupplier.legalName,
                        recorded: true,
                      },
                    ]
                  : []),
                ...(!p.archived && i.catalogProduct?.active
                  ? i.catalogProduct.suppliers
                      .filter(
                        (s) =>
                          s.supplier.active &&
                          s.supplier.roles.includes("SUPPLIER") &&
                          s.supplierId !== i.supplierId,
                      )
                      .map((s) => ({
                        id: s.supplierId,
                        legalName: s.supplier.legalName,
                        recorded: false,
                      }))
                  : []),
              ];
              const alert = aboveReference(
                i.minimumPrice?.toFixed(4) ?? null,
                i.unitPrice?.toFixed(4) ?? null,
              );
              return (
                <tr key={`${i.id}-${p.version}`}>
                  <td className="px-3 py-4">{i.number}</td>
                  <td className="min-w-48 max-w-xs px-3 py-4">
                    <span className="line-clamp-2" title={i.description}>
                      {i.description}
                    </span>
                  </td>
                  <td className="min-w-52 px-3 py-4">
                    <select
                      className="field"
                      form={formId}
                      name="supplierId"
                      aria-label={`Fornecedor do item ${i.number}`}
                      defaultValue={i.supplierId ?? ""}
                      required
                      disabled={p.archived}
                    >
                      <option value="">
                        {p.archived ? "Não informado" : "Selecione"}
                      </option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.legalName}
                          {s.recorded ? " · Registrado na contratação" : ""}
                        </option>
                      ))}
                    </select>
                    {savedSupplier && (
                      <p className="mt-1 text-xs text-slate-500">
                        O fornecedor registrado é preservado mesmo após
                        alterações no catálogo.
                      </p>
                    )}
                  </td>
                  {(
                    [
                      "acquisitionUnit",
                      "freightUnit",
                      "taxRate",
                      "netProfitRate",
                      "pricingAdministrativeRate",
                    ] as const
                  ).map((k) => (
                    <td key={k} className="min-w-40 px-3 py-4">
                      <input
                        className="field"
                        form={formId}
                        name={k}
                        aria-label={`${{ acquisitionUnit: "Valor de Aquisição", freightUnit: "Custo de frete", taxRate: "Alíquota tributária", netProfitRate: "Lucro Líquido", pricingAdministrativeRate: "Custo Administrativo" }[k]} do item ${i.number}`}
                        defaultValue={
                          i[k]
                            ?.toFixed(
                              k === "acquisitionUnit" || k === "freightUnit"
                                ? 4
                                : 2,
                            )
                            .replace(".", ",") ?? ""
                        }
                        required
                        inputMode="decimal"
                        maxLength={60}
                        disabled={p.archived}
                      />
                    </td>
                  ))}
                  <td
                    className={`whitespace-nowrap px-3 py-4 ${alert ? "bg-amber-50 font-semibold text-amber-800" : ""}`}
                  >
                    {unitMoney(i.minimumPrice?.toFixed(4) ?? null)}
                    {alert && (
                      <p className="mt-1 text-xs">Acima do valor estimado</p>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {!p.archived && (
                      <ActionForm id={formId} action={pricingAction}>
                        <input type="hidden" name="opportunityId" value={id} />
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="version" value={p.version} />
                        <button
                          className="btn"
                          aria-label={`Salvar precificação do item ${i.number}`}
                        >
                          <ButtonContent action="save" />
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
            Cadastre os itens para iniciar a precificação.
          </p>
        )}
      </section>
    </>
  );
}
