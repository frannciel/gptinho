import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { unitMoney, aboveReference } from "@/lib/pricing";
import {
  CatalogItemForm,
  DeleteContractingItem,
  WinnerToggle,
} from "@/components/catalog-item-form";
import { PageHeader } from "@/components/page-header";
import { ContractingTabs } from "@/components/contracting-tabs";
import { Modal } from "@/components/modal";
export default async function ItemsPage({
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
    include: { items: { orderBy: { number: "asc" } } },
  });
  if (!p) notFound();
  const s = await searchParams;
  const item = p.items.find((i) => i.id === s.edit);
  if (s.edit && !item) notFound();
  const products =
    (s.new || item) && !p.archived
      ? await db.catalogProduct.findMany({
          where: {
            OR: [
              { active: true },
              ...(item?.catalogProductId
                ? [{ id: item.catalogProductId }]
                : []),
            ],
          },
          orderBy: { description: "asc" },
        })
      : [];
  return (
    <>
      <PageHeader
        eyebrow="Comercial · Contratações"
        title={`Itens · ${p.reference}`}
        description="Gerencie os itens e marque os vencedores."
        action={
          !p.archived ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/contratacoes/${id}/importar`}
                className="btn-secondary"
              >
                Importar JSON
              </Link>
              <Link href={`/contratacoes/${id}/itens?new=1`} className="btn">
                <Plus size={17} />
                Novo item
              </Link>
            </div>
          ) : undefined
        }
      />
      <ContractingTabs id={id} active="itens" />
      {p.archived && (
        <p className="mb-5 text-sm">
          Contratação arquivada. Restaure para editar.
        </p>
      )}
      {s.saved && (
        <p role="status" className="mb-5 text-brand-700">
          Item salvo. Total recalculado.
        </p>
      )}
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {[
                  "Item",
                  "Descrição",
                  "Marca",
                  "Quant.",
                  "Valor estimado",
                  "Preço Mínimo Viável",
                  "Total Estimado",
                  "Ações",
                ].map((t) => (
                  <th className="px-4 py-3" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-4">{i.number}</td>
                  <td className="max-w-xs px-4 py-4">
                    <span className="line-clamp-2" title={i.description}>
                      {i.description}
                    </span>
                  </td>
                  <td className="px-4 py-4">{i.brand ?? "—"}</td>
                  <td className="px-4 py-4">
                    {i.quantity.toString()} {i.unit}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {unitMoney(i.unitPrice?.toFixed(4) ?? null)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-4 ${aboveReference(i.minimumPrice?.toFixed(4) ?? null, i.unitPrice?.toFixed(4) ?? null) ? "bg-amber-50 font-semibold text-amber-800" : ""}`}
                  >
                    {unitMoney(i.minimumPrice?.toFixed(4) ?? null)}
                  </td>
                  <td className="px-4 py-4">
                    {i.total === null ? "A definir" : money(i.total.toFixed(2))}
                  </td>
                  <td className="px-4 py-4">
                    {!p.archived && (
                      <div className="flex items-start gap-2">
                        <Link
                          href={`/contratacoes/${id}/itens?edit=${i.id}`}
                          className="btn-secondary"
                          aria-label={`Editar item ${i.number}`}
                        >
                          <Pencil size={16} />
                        </Link>
                        <DeleteContractingItem
                          id={id}
                          itemId={i.id}
                          version={p.version}
                        />
                        <WinnerToggle
                          key={`${i.id}-${p.version}`}
                          id={id}
                          itemId={i.id}
                          version={p.version}
                          winner={i.winner}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!p.items.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhum item cadastrado.
            </p>
          )}
        </div>
        <footer className="border-t p-6 text-right font-semibold">
          Valor Total Estimado:{" "}
          {p.estimatedValue === null
            ? "A definir"
            : money(p.estimatedValue.toFixed(2))}
        </footer>
      </section>
      {(s.new || item) && !p.archived && (
        <Modal
          title={
            item ? "Editar item da contratação" : "Novo item da contratação"
          }
          closeHref={`/contratacoes/${id}/itens`}
        >
          <CatalogItemForm
            key={`${item?.id ?? "new"}-${p.version}`}
            opportunityId={id}
            version={p.version}
            number={String(Math.max(0, ...p.items.map((i) => i.number)) + 1)}
            products={products.map((v) => ({
              id: v.id,
              description: v.description,
              brand: v.brand ?? "",
              model: v.model ?? "",
              unit: v.unit,
              type: v.type,
            }))}
            initial={
              item
                ? {
                    id: item.id,
                    itemId: item.id,
                    catalogProductId: item.catalogProductId ?? "",
                    description: item.description,
                    brand: item.brand ?? "",
                    model: item.model ?? "",
                    unit: item.unit,
                    type: item.type,
                    quantity: item.quantity.toFixed(3),
                    unitPrice: item.unitPrice?.toFixed(4) ?? "",
                    number: String(item.number),
                    winner: item.winner,
                  }
                : undefined
            }
          />
        </Modal>
      )}
    </>
  );
}
