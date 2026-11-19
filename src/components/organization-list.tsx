import Link from "next/link";
import {
  Search,
  Plus,
  Pencil,
  ArrowRight,
  Landmark,
  Truck,
} from "lucide-react";
import type { OrganizationRole } from "@prisma/client";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { maskPhone } from "@/lib/input-masks";
import { formatCnpj, date } from "@/lib/format";
import { listOrganizations, listSchema } from "@/server/organizations";
import { PageHeader } from "./page-header";
import { DeleteOrganization } from "./delete-organization";
export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
export async function OrganizationList({
  role,
  searchParams,
}: {
  role: OrganizationRole;
  searchParams: SearchParams;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const parsed = listSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : listSchema.parse({});
  const { items, count, page, pages } = await listOrganizations(
    db,
    role,
    filters,
  );
  const agency = role === "PUBLIC_AGENCY";
  const base = agency ? "/orgaos" : "/fornecedores";
  const title = agency ? "Órgãos públicos" : "Fornecedores";
  const Icon = agency ? Landmark : Truck;
  const pageHref = (n: number) =>
    `${base}?${new URLSearchParams({ q: filters.q, status: filters.status, page: String(n) })}`;
  return (
    <>
      <PageHeader
        eyebrow="Relacionamentos · Cadastros"
        title={title}
        description={
          agency
            ? "Organize os órgãos e entidades públicas da sua rede de relacionamento."
            : "Centralize parceiros, contatos e informações comerciais de fornecimento."
        }
        action={
          <Link href={`${base}/novo`} className="btn">
            <Plus size={17} />
            {agency ? "Novo órgão" : "Novo fornecedor"}
          </Link>
        }
      />
      {params.notice === "saved" && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700"
        >
          Cadastro salvo com sucesso.
        </p>
      )}
      {!parsed.success && (
        <p role="alert" className="mb-5 text-sm text-red-700">
          Filtros inválidos. Exibindo a consulta padrão.
        </p>
      )}
      <section className="panel overflow-hidden">
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-5"
        >
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="label text-xs">
              Buscar {agency ? "órgão" : "fornecedor"}
            </label>
            <div className="relative">
              <Search
                size={17}
                className="absolute top-3 left-3 text-slate-400"
              />
              <input
                name="q"
                id="q"
                className="field pl-10"
                defaultValue={filters.q}
                maxLength={120}
                placeholder={
                  agency
                    ? "Nome, sigla, CNPJ ou UASG…"
                    : "Razão social, nome fantasia ou CNPJ…"
                }
              />
            </div>
          </div>
          <div className="w-40">
            <label htmlFor="status" className="label text-xs">
              Situação
            </label>
            <select
              name="status"
              id="status"
              className="field"
              defaultValue={filters.status}
            >
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <button className="btn-secondary" type="submit">
            Filtrar
          </button>
          <Link
            href={base}
            className="px-2 py-2.5 text-xs font-medium text-slate-500 hover:text-brand-600"
          >
            Limpar
          </Link>
        </form>
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold">
            {title}{" "}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-normal text-slate-500">
              {count}
            </span>
          </p>
          <p className="text-xs text-slate-400">
            Cadastros compartilhados por organização
          </p>
        </div>
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    {agency ? "Órgão / entidade" : "Fornecedor"}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {agency ? "CNPJ / UASG" : "CNPJ"}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Contato
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Situação
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/60">
                    <td className="max-w-xs px-5 py-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf3f3] text-[#62817e]">
                          <Icon size={19} />
                        </span>
                        <div>
                          <Link
                            href={`${base}/${org.id}/editar`}
                            className="font-semibold text-slate-700 hover:text-brand-600"
                          >
                            {org.legalName}
                          </Link>
                          <p className="mt-1 text-xs text-slate-400">
                            {(agency ? org.acronym : org.tradeName) ||
                              `Cadastrado em ${date(org.createdAt)}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-xs text-slate-600">
                        {formatCnpj(org.cnpj)}
                      </p>
                      {agency && org.uasg && (
                        <p className="mt-1 text-xs text-slate-400">
                          UASG {org.uasg}
                        </p>
                      )}
                    </td>
                    <td className="max-w-56 px-4 py-5">
                      <p className="truncate text-xs text-slate-600">
                        {org.email || "Não informado"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {org.phone
                          ? maskPhone(org.phone)
                          : `${org.contacts.length} contatos`}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${org.active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${org.active ? "bg-brand-500" : "bg-slate-400"}`}
                        />
                        {org.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`${base}/${org.id}/editar`}
                          aria-label={`Editar ${org.legalName}`}
                          className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Pencil size={16} />
                        </Link>
                        <DeleteOrganization
                          id={org.id}
                          name={org.legalName}
                          version={org.version}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-t border-slate-100 px-6 py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Icon size={26} />
            </span>
            <h2 className="mt-5 font-semibold">
              {filters.q || filters.status !== "active"
                ? "Nenhum resultado encontrado"
                : agency
                  ? "Sua rede de órgãos começa aqui"
                  : "Construa sua rede de fornecedores"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {filters.q || filters.status !== "active"
                ? "Ajuste os filtros ou limpe a busca para consultar os cadastros."
                : "Adicione o primeiro cadastro com dados de identificação e contato."}
            </p>
            <Link
              href={
                filters.q || filters.status !== "active" ? base : `${base}/novo`
              }
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600"
            >
              {filters.q || filters.status !== "active"
                ? "Limpar filtros"
                : "Criar primeiro cadastro"}
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
          <span>
            {count}{" "}
            {count === 1 ? "registro encontrado" : "registros encontrados"} ·
            Até 20 por página
          </span>
          <div className="flex items-center gap-3">
            {page > 1 && (
              <Link
                className="btn-secondary py-1.5 text-xs"
                href={pageHref(page - 1)}
              >
                Anterior
              </Link>
            )}
            <span>
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link
                className="btn-secondary py-1.5 text-xs"
                href={pageHref(page + 1)}
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
