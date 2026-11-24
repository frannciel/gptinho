import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { contactFilters, listContacts } from "@/server/contacts";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
import { OrganizationFilter } from "@/components/organization-filter";
import { AgendaDelete } from "@/components/agenda-delete";
import { AgendaPagination } from "@/components/agenda-pagination";
import { maskPhone } from "@/lib/input-masks";
export const metadata = { title: "Contatos" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const parsed = contactFilters.safeParse(params);
  const filters = parsed.success ? parsed.data : contactFilters.parse({});
  const { items, count, page, pages } = await listContacts(db, filters);
  const org =
    filters.organizationId && filters.organizationId !== "none"
      ? await db.organization.findUnique({
          where: { id: filters.organizationId },
          select: { id: true, legalName: true },
        })
      : null;
  return (
    <>
      <PageHeader
        eyebrow="Relacionamentos"
        title="Contatos"
        description="Gerencie pessoas com ou sem vínculo a órgãos públicos e fornecedores."
        action={
          <Link className="btn" href="/contatos/novo">
            <Plus size={17} />
            Novo contato
          </Link>
        }
      />
      {params.notice === "saved" && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-green-50 p-4 text-green-800"
        >
          Contato salvo com sucesso.
        </p>
      )}
      {params.notice === "deleted" && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-green-50 p-4 text-green-800"
        >
          Contato excluído.
        </p>
      )}
      {!parsed.success && (
        <p role="alert">Filtros inválidos. Exibindo a consulta padrão.</p>
      )}
      <form className="panel mb-6 grid items-end gap-4 p-5 md:grid-cols-3">
        <label>
          Buscar contato
          <input
            className="field"
            name="q"
            placeholder="Nome, e-mail, telefone ou cargo…"
            maxLength={120}
            defaultValue={filters.q}
          />
        </label>
        <OrganizationFilter
          initial={org ? { id: org.id, label: org.legalName } : null}
          unlinked={filters.organizationId === "none"}
        />
        <div className="flex gap-2">
          <button className="btn">
            <ButtonContent action="filter" />
          </button>
          <Link className="btn-secondary" href="/contatos">
            <ButtonContent action="clear" />
          </Link>
        </div>
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Nome",
                "Cargo / função",
                "E-mail",
                "Telefone",
                "Organização",
                "Ações",
              ].map((l) => (
                <th className="p-4" key={l}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr className="border-t border-slate-100" key={c.id}>
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4">{c.position ?? "—"}</td>
                <td className="p-4">{c.email ?? "—"}</td>
                <td className="p-4 whitespace-nowrap">
                  {c.phone ? maskPhone(c.phone) : "—"}
                </td>
                <td className="p-4">
                  {c.organization?.legalName ?? "Sem organização"}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <Link
                      aria-label={`Editar ${c.name}`}
                      className="btn-secondary"
                      href={`/contatos/${c.id}/editar`}
                    >
                      <Pencil size={16} />
                    </Link>
                    <AgendaDelete
                      kind="contact"
                      id={c.id}
                      version={c.version}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={6}>
                  Nenhum contato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-slate-500">{count} contato(s)</p>
      <AgendaPagination
        base="/contatos"
        params={{ q: filters.q, organizationId: filters.organizationId }}
        page={page}
        pages={pages}
      />
    </>
  );
}
