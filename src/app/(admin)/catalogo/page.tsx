import { CatalogToggle } from "@/components/catalog-toggle";
import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { saveCatalogAction } from "./actions";
export const metadata = { title: "Catálogo de itens comercializados" };
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const s = await searchParams;
  const [products, suppliers, editing] = await Promise.all([
    db.catalogProduct.findMany({
      where: s.q
        ? { description: { contains: s.q.slice(0, 120), mode: "insensitive" } }
        : {},
      include: { supplier: true },
      orderBy: { description: "asc" },
      take: 100,
    }),
    db.organization.findMany({
      where: { roles: { has: "SUPPLIER" } },
      orderBy: { legalName: "asc" },
    }),
    s.edit ? db.catalogProduct.findUnique({ where: { id: s.edit } }) : null,
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Catálogo de itens comercializados
      </h1>
      {s.error && (
        <p role="alert" className="text-red-700">
          {s.error}
        </p>
      )}
      {s.saved && <p role="status">Item salvo.</p>}
      <form className="flex gap-3">
        <input
          aria-label="Buscar no catálogo"
          name="q"
          defaultValue={s.q}
          className="field"
          maxLength={120}
        />
        <button className="btn-secondary">Buscar</button>
        <Link href="/catalogo" className="btn-secondary">
          Novo item
        </Link>
      </form>
      <section className="panel overflow-x-auto p-5">
        <p className="text-sm">Até 100 resultados por busca.</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Descrição",
                "Marca / Modelo",
                "Unidade",
                "Fornecedor",
                "Margem",
                "Custo administrativo",
                "",
              ].map((t) => (
                <th className="p-2" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="p-2">
                  {p.description}
                  {!p.active && " (inativo)"}
                </td>
                <td>
                  {p.brand} / {p.model}
                </td>
                <td>{p.unit}</td>
                <td>{p.supplier.legalName}</td>
                <td>{p.margin.toFixed(2).replace(".", ",")}%</td>
                <td>{p.administrativeCost.toFixed(2).replace(".", ",")}%</td>
                <td>
                  <Link className="underline" href={`/catalogo?edit=${p.id}`}>
                    Editar
                  </Link>
                  <CatalogToggle
                    id={p.id}
                    version={p.version}
                    active={p.active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && <p>Nenhum item encontrado.</p>}
      </section>
      <ActionForm
        key={editing?.id ?? "new"}
        action={saveCatalogAction}
        className="panel space-y-4 p-6"
      >
        <h2 className="font-semibold">
          {editing ? "Editar item" : "Novo item"}
        </h2>
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <input type="hidden" name="version" value={editing?.version ?? ""} />
        {(
          [
            ["description", "Descrição", true, editing?.description],
            ["brand", "Marca", false, editing?.brand],
            ["model", "Modelo", false, editing?.model],
            ["unit", "Unidade", true, editing?.unit ?? "UN"],
            ["margin", "Margem (%)", true, editing?.margin.toFixed(2)],
            [
              "administrativeCost",
              "Custo Administrativo (%)",
              true,
              editing?.administrativeCost.toFixed(2),
            ],
          ] as const
        ).map(([name, label, required, value]) => (
          <label key={name} className="block text-sm">
            {label}
            {required ? " *" : ""}
            <input
              className="field mt-1"
              name={name}
              required={required}
              defaultValue={value ?? ""}
              maxLength={
                name === "description" ? 5000 : name === "unit" ? 20 : 120
              }
              inputMode={
                name === "margin" || name === "administrativeCost"
                  ? "decimal"
                  : "text"
              }
            />
          </label>
        ))}
        <label className="block text-sm">
          Fornecedor *
          <select
            name="supplierId"
            className="field mt-1"
            required
            defaultValue={editing?.supplierId ?? ""}
          >
            <option value="">Selecione</option>
            {suppliers
              .filter((p) => p.active || p.id === editing?.supplierId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.legalName}
                  {!p.active ? " (inativo)" : ""}
                </option>
              ))}
          </select>
        </label>
        <button className="btn">Salvar item do catálogo</button>
      </ActionForm>
    </div>
  );
}
