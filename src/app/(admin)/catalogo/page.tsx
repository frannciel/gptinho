import { ButtonContent } from "@/components/button-content";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Plus, Pencil } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/modal";
import { ActionForm } from "@/components/action-form";
import { SupplierMultiselect } from "@/components/supplier-multiselect";
import { CatalogToggle } from "@/components/catalog-toggle";
import { saveCatalogAction } from "./actions";
export const metadata = { title: "Catálogo de itens comercializados" };
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const raw = await searchParams;
  const s = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
  const status = s.status === "inactive" ? "inactive" : "active";
  const where: Prisma.CatalogProductWhereInput = {
    active: status === "active",
    ...(s.q
      ? { description: { contains: s.q.slice(0, 120), mode: "insensitive" } }
      : {}),
    ...(s.type === "MATERIAL" || s.type === "SERVICE" ? { type: s.type } : {}),
    ...(s.brand ? { brand: { equals: s.brand, mode: "insensitive" } } : {}),
    ...(s.supplierId
      ? { suppliers: { some: { supplierId: s.supplierId } } }
      : {}),
  };
  const count = await db.catalogProduct.count({ where });
  const pages = Math.max(1, Math.ceil(count / 20));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(s.page ?? "1", 10) || 1),
  );
  const [products, supplierFilter, brands, editing] = await Promise.all([
    db.catalogProduct.findMany({
      where,
      include: { suppliers: { include: { supplier: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    s.supplierId
      ? db.organization.findUnique({
          where: { id: s.supplierId },
          select: { id: true, legalName: true, active: true },
        })
      : null,
    db.catalogProduct.findMany({
      where: { brand: { not: null } },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    }),
    s.edit
      ? db.catalogProduct.findUnique({
          where: { id: s.edit },
          include: {
            suppliers: {
              include: {
                supplier: {
                  select: { id: true, legalName: true, active: true },
                },
              },
            },
          },
        })
      : null,
  ]);
  const pageHref = (n: number) =>
    `/catalogo?${new URLSearchParams({ q: s.q ?? "", type: s.type ?? "", brand: s.brand ?? "", supplierId: s.supplierId ?? "", status, page: String(n) })}`;
  return (
    <>
      <PageHeader
        eyebrow="Comercial · Cadastros"
        title="Catálogo de itens comercializados"
        description="Produtos e serviços, características e fornecedores disponíveis."
        action={
          <Link href="/catalogo?new=1" className="btn">
            <Plus size={17} />
            Novo item
          </Link>
        }
      />
      {s.saved && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700"
        >
          Item salvo.
        </p>
      )}
      {s.error && <p role="alert">{s.error}</p>}
      <section className="panel overflow-hidden">
        <form
          key={JSON.stringify({
            q: s.q ?? "",
            status,
            type: s.type ?? "",
            brand: s.brand ?? "",
            supplierId: s.supplierId ?? "",
          })}
          className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-5"
        >
          <label className="min-w-48 flex-1 text-xs">
            Buscar item
            <input
              name="q"
              className="field mt-1"
              defaultValue={s.q}
              maxLength={120}
            />
          </label>
          <label className="text-xs">
            Tipo
            <select
              aria-label="Tipo"
              className="field mt-1"
              name="type"
              defaultValue={s.type ?? ""}
            >
              <option value="">Todos</option>
              <option value="MATERIAL">Material</option>
              <option value="SERVICE">Serviço</option>
            </select>
          </label>
          <label className="text-xs">
            Marca
            <select
              aria-label="Marca"
              name="brand"
              className="field mt-1"
              defaultValue={s.brand ?? ""}
            >
              <option value="">Todas</option>
              {brands.map((b) => (
                <option key={b.brand} value={b.brand!}>
                  {b.brand}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-64 max-w-sm">
            <SupplierMultiselect
              key={s.supplierId ?? "filter"}
              multiple={false}
              name="supplierId"
              includeInactive
              initial={supplierFilter ? [supplierFilter] : []}
            />
          </div>
          <label className="text-xs">
            Situação
            <select
              aria-label="Situação"
              name="status"
              className="field mt-1"
              defaultValue={status}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          <button className="btn-secondary">
            <ButtonContent action="filter" />
          </button>
          <Link href="/catalogo" className="btn-secondary">
            <ButtonContent action="clear" />
          </Link>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                {[
                  "Descrição",
                  "Tipo",
                  "Marca / Modelo",
                  "Unidade",
                  "Alíquota tributária",
                  "Fornecedores",
                  "Ações",
                ].map((t) => (
                  <th className="px-5 py-3 font-medium" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="max-w-xs px-5 py-4">
                    <span className="line-clamp-2">{p.description}</span>
                    {!p.active && (
                      <span className="text-xs text-slate-500">Inativo</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {p.type === "MATERIAL"
                      ? "Material"
                      : p.type === "SERVICE"
                        ? "Serviço"
                        : "A definir"}
                  </td>
                  <td className="px-5 py-4">
                    {p.brand ?? "—"} / {p.model ?? "—"}
                  </td>
                  <td className="px-5 py-4">{p.unit}</td>
                  <td className="px-5 py-4">
                    {p.taxRate?.toFixed(2).replace(".", ",") ?? "A definir"}
                    {p.taxRate !== null && "%"}
                  </td>
                  <td className="max-w-xs px-5 py-4">
                    <select
                      className="field min-w-48"
                      aria-label={`Fornecedores de ${p.description}`}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {p.suppliers.length} fornecedor(es)
                      </option>
                      {p.suppliers.map((s) => (
                        <option key={s.supplierId} value={s.supplierId}>
                          {s.supplier.legalName}
                          {!s.supplier.active ? " (inativo)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        className="btn-secondary"
                        href={`/catalogo?edit=${p.id}`}
                        aria-label={`Editar ${p.description}`}
                      >
                        <Pencil size={16} />
                      </Link>
                      <CatalogToggle
                        id={p.id}
                        version={p.version}
                        active={p.active}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!products.length && (
            <p className="p-10 text-center text-sm text-slate-500">
              Nenhum item encontrado.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t p-5 text-sm">
          <span>
            {count} itens · Página {page} de {pages}
          </span>
          <div className="flex gap-3">
            {page > 1 && <Link href={pageHref(page - 1)}>Anterior</Link>}
            {page < pages && <Link href={pageHref(page + 1)}>Próxima</Link>}
          </div>
        </div>
      </section>
      {(s.new || editing) && (
        <Modal
          title={editing ? "Editar item do catálogo" : "Novo item do catálogo"}
          closeHref="/catalogo"
        >
          <ActionForm
            key={editing?.id ?? "new"}
            action={saveCatalogAction}
            className="space-y-5 p-6"
          >
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <input
              type="hidden"
              name="version"
              value={editing?.version ?? ""}
            />
            <label className="block text-sm">
              Tipo *
              <select
                className="field mt-1"
                name="type"
                defaultValue={editing?.type ?? "MATERIAL"}
                required
              >
                <option value="MATERIAL">Material</option>
                <option value="SERVICE">Serviço</option>
              </select>
            </label>
            <label className="block text-sm">
              Descrição *
              <textarea
                className="field mt-1"
                name="description"
                rows={2}
                required
                minLength={3}
                maxLength={20000}
                defaultValue={editing?.description ?? ""}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["brand", "Marca", editing?.brand, false],
                  ["model", "Modelo", editing?.model, false],
                  ["unit", "Unidade", editing?.unit ?? "", true],
                  [
                    "taxRate",
                    "Alíquota tributária (%)",
                    editing?.taxRate?.toFixed(2),
                    true,
                  ],
                ] as const
              ).map(([name, label, value, required]) => (
                <label className="block text-sm" key={name}>
                  {label}
                  {required && " *"}
                  <input
                    className="field mt-1"
                    name={name}
                    required={required}
                    defaultValue={value ?? ""}
                    maxLength={name === "unit" ? 20 : 120}
                    inputMode={name === "taxRate" ? "decimal" : "text"}
                  />
                </label>
              ))}
            </div>
            <SupplierMultiselect
              initial={editing?.suppliers.map((s) => s.supplier) ?? []}
            />
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
              <Link href="/catalogo" className="btn-secondary">
                <ButtonContent action="cancel" />
              </Link>
              <button className="btn" aria-label="Salvar item do catálogo">
                <ButtonContent action="save" />
              </button>
            </div>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
