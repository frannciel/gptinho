import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import {
  CatalogItemForm,
  DeleteContractingItem,
} from "@/components/catalog-item-form";
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
    include: {
      items: { include: { supplier: true }, orderBy: { number: "asc" } },
    },
  });
  if (!p) notFound();
  if (p.archived) redirect(`/contratacoes/${id}`);
  const s = await searchParams;
  const [products, suppliers] = await Promise.all([
    db.catalogProduct.findMany({
      where: { active: true },
      orderBy: { description: "asc" },
    }),
    db.organization.findMany({
      where: { roles: { has: "SUPPLIER" } },
      select: { id: true, legalName: true, active: true },
      orderBy: { legalName: "asc" },
    }),
  ]);
  const item = p.items.find((i) => i.id === s.edit);
  if (s.edit && !item) notFound();
  const serialize = (v: (typeof products)[number]) => ({
    id: v.id,
    description: v.description,
    brand: v.brand ?? "",
    model: v.model ?? "",
    unit: v.unit,
    margin: v.margin.toFixed(2),
    administrativeCost: v.administrativeCost.toFixed(2),
    supplierId: v.supplierId,
  });
  return (
    <div className="space-y-6">
      <Link href={`/contratacoes/${id}`} className="underline">
        ← Voltar à contratação
      </Link>
      <h1 className="text-2xl font-semibold">Itens · {p.reference}</h1>
      <p>
        Valor estimado:{" "}
        {p.estimatedValue === null
          ? "A definir"
          : money(p.estimatedValue.toFixed(2))}
      </p>
      {s.error && (
        <p role="alert" className="text-red-700">
          {s.error}
        </p>
      )}
      {s.saved && <p role="status">Item salvo. Total recalculado.</p>}
      <section className="panel overflow-x-auto p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Item",
                "Descrição",
                "Marca / Modelo",
                "Quantidade",
                "Fornecedor",
                "Margem",
                "Custo administrativo",
                "Total",
                "Ações",
              ].map((t) => (
                <th className="p-2" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.items.map((i) => (
              <tr key={i.id}>
                <td>{i.number}</td>
                <td className="p-2">{i.description}</td>
                <td>
                  {i.brand} / {i.model}
                </td>
                <td>
                  {i.quantity.toString()} {i.unit}
                </td>
                <td>{i.supplier?.legalName ?? "Pendente"}</td>
                <td>
                  {i.margin === null
                    ? "Pendente"
                    : `${i.margin.toFixed(2).replace(".", ",")}%`}
                </td>
                <td>
                  {i.administrativeCost === null
                    ? "Pendente"
                    : `${i.administrativeCost.toFixed(2).replace(".", ",")}%`}
                </td>
                <td>
                  {i.total === null ? "A definir" : money(i.total.toFixed(2))}
                </td>
                <td>
                  <Link
                    className="underline"
                    href={`/contratacoes/${id}/itens?edit=${i.id}`}
                  >
                    Editar
                  </Link>
                  <DeleteContractingItem
                    id={id}
                    itemId={i.id}
                    version={p.version}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!p.items.length && <p>Nenhum item cadastrado.</p>}
      </section>
      <div className="flex gap-4">
        <Link className="btn-secondary" href={`/contratacoes/${id}/itens`}>
          Novo item
        </Link>
        <Link className="btn-secondary" href="/catalogo">
          Abrir catálogo
        </Link>
      </div>
      <CatalogItemForm
        key={`${item?.id ?? "new"}-${p.version}`}
        opportunityId={id}
        version={p.version}
        products={products.map(serialize)}
        suppliers={suppliers.filter(
          (s) => s.active || s.id === item?.supplierId,
        )}
        number={String(Math.max(0, ...p.items.map((i) => i.number)) + 1)}
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
                margin: item.margin?.toFixed(2) ?? "",
                administrativeCost: item.administrativeCost?.toFixed(2) ?? "",
                supplierId: item.supplierId ?? "",
                quantity: item.quantity.toFixed(3),
                unitPrice: item.unitPrice?.toFixed(4) ?? "",
                number: String(item.number),
              }
            : undefined
        }
      />
    </div>
  );
}
