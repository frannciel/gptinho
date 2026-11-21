import { ButtonContent } from "@/components/button-content";
import Link from "next/link";
import { Plus, Search, FileText, ArrowUpRight, Pencil } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { opportunityFilters } from "@/lib/opportunity-validation";
import {
  dateTime,
  OPPORTUNITY_STATUSES,
  PROCUREMENT_METHODS,
  OPPORTUNITY_STATUS_VALUES,
  hasActiveDeadline,
} from "@/lib/opportunity-values";
import { listOpportunities, getOpportunityStats } from "@/server/opportunities";
import { PageHeader } from "@/components/page-header";
import { OpportunityStatusBadge } from "@/components/opportunity-status";
import { OpportunityMetrics } from "@/components/opportunity-metrics";
export const metadata = { title: "Contratações" };
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const parsed = opportunityFilters.safeParse(params);
  const filters = parsed.success ? parsed.data : opportunityFilters.parse({});
  const now = new Date();
  const [data, stats, agencies] = await Promise.all([
    listOpportunities(db, filters, now),
    getOpportunityStats(db, now),
    db.organization.findMany({
      where: { roles: { has: "PUBLIC_AGENCY" } },
      select: { id: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
  ]);
  const href = (page: number) =>
    `/contratacoes?${new URLSearchParams({ ...filters, page: String(page) })}`;
  const notice =
    params.notice === "archived"
      ? "Contratação arquivada. O histórico foi preservado."
      : params.notice === "restored"
        ? "Contratação restaurada."
        : null;
  return (
    <>
      <PageHeader
        eyebrow="Comercial · Carteira"
        title="Contratações"
        description="Acompanhe demandas dos órgãos, valores estimados e prazos de apresentação."
        action={
          <Link href="/contratacoes/nova" className="btn">
            <Plus size={17} />
            Nova contratação
          </Link>
        }
      />
      <OpportunityMetrics stats={stats} />
      <p className="mb-4 text-xs text-slate-500">
        Indicadores gerais da carteira ativa. A tabela segue os filtros abaixo.
      </p>
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700"
        >
          {notice}
        </p>
      )}
      {!parsed.success && (
        <p role="alert" className="mb-5 text-sm text-red-700">
          Filtros inválidos. Exibindo a consulta padrão.
        </p>
      )}
      <section className="panel overflow-hidden">
        <form
          key={JSON.stringify(filters)}
          method="get"
          className="grid items-end gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div className="sm:col-span-2">
            <label htmlFor="q" className="label text-xs">
              Buscar contratação
            </label>
            <div className="relative">
              <Search
                size={17}
                className="absolute top-3 left-3 text-slate-400"
              />
              <input
                id="q"
                name="q"
                className="field pl-10"
                defaultValue={filters.q}
                maxLength={120}
                placeholder="Identificação, objeto, processo ou órgão…"
              />
            </div>
          </div>
          <div>
            <label htmlFor="status" className="label text-xs">
              Situação
            </label>
            <select
              id="status"
              name="status"
              className="field"
              defaultValue={filters.status}
            >
              <option value="all">Todas as situações</option>
              {OPPORTUNITY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {OPPORTUNITY_STATUSES[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="organizationId" className="label text-xs">
              Órgão público
            </label>
            <select
              id="organizationId"
              name="organizationId"
              className="field"
              defaultValue={filters.organizationId}
            >
              <option value="">Todos os órgãos</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.legalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="deadline" className="label text-xs">
              Prazo
            </label>
            <select
              id="deadline"
              name="deadline"
              className="field"
              defaultValue={filters.deadline}
            >
              <option value="all">Todos os prazos</option>
              <option value="overdue">Prazo vencido</option>
              <option value="next7days">Próximos 7 dias</option>
              <option value="without">Sem prazo informado</option>
            </select>
          </div>
          <div>
            <label htmlFor="archived" className="label text-xs">
              Exibição
            </label>
            <select
              id="archived"
              name="archived"
              className="field"
              defaultValue={filters.archived}
            >
              <option value="active">Não arquivadas</option>
              <option value="archived">Somente arquivadas</option>
              <option value="all">Todas</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="label text-xs">
              Ordenar por
            </label>
            <select
              id="sort"
              name="sort"
              className="field"
              defaultValue={filters.sort}
            >
              <option value="deadline">Prazo mais próximo</option>
              <option value="newest">Mais recentes</option>
              <option value="value">Maior valor estimado</option>
              <option value="reference">Identificação</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary">
              <ButtonContent action="filter" />
            </button>
            <Link href="/contratacoes" className="btn-secondary">
              <ButtonContent action="clear" />
            </Link>
          </div>
        </form>
        {data.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Contratação / órgão",
                    "Modalidade / processo",
                    "Valor estimado",
                    "Prazo · Brasília",
                    "Situação",
                    "Ações",
                  ].map((label) => (
                    <th key={label} scope="col" className="px-5 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((opportunity) => (
                  <tr key={opportunity.id} className="hover:bg-slate-50/60">
                    <td className="max-w-xs px-5 py-5">
                      <Link
                        href={`/contratacoes/${opportunity.id}`}
                        className="font-semibold text-brand-700"
                      >
                        {opportunity.reference}
                      </Link>
                      <p
                        className="mt-1 truncate text-sm text-slate-600"
                        title={opportunity.subject}
                      >
                        {opportunity.subject}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {opportunity.organization.acronym ||
                          opportunity.organization.legalName}
                        {!opportunity.organization.active
                          ? " · Órgão inativo"
                          : ""}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <p className="text-xs">
                        {PROCUREMENT_METHODS[opportunity.procurementMethod]}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {opportunity.processNumber ?? "Processo não informado"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-xs font-semibold">
                      {opportunity.estimatedValue === null
                        ? "Não informado"
                        : money(opportunity.estimatedValue.toFixed(2))}
                    </td>
                    <td className="px-5 py-5 text-xs">
                      <p>
                        {opportunity.proposalDeadline
                          ? dateTime(opportunity.proposalDeadline)
                          : "Não informado"}
                      </p>
                      {!opportunity.archived &&
                        hasActiveDeadline(opportunity.status) &&
                        opportunity.proposalDeadline &&
                        opportunity.proposalDeadline < now && (
                          <p className="mt-1 font-semibold text-amber-700">
                            Prazo vencido
                          </p>
                        )}
                    </td>
                    <td className="px-5 py-5">
                      <OpportunityStatusBadge
                        status={opportunity.status}
                        archived={opportunity.archived}
                      />
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex gap-3">
                        <Link
                          aria-label={`Ver ${opportunity.reference}`}
                          href={`/contratacoes/${opportunity.id}`}
                          className="text-slate-500 hover:text-brand-600"
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                        {!opportunity.archived && (
                          <Link
                            aria-label={`Editar ${opportunity.reference}`}
                            href={`/contratacoes/${opportunity.id}/editar`}
                            className="text-slate-500 hover:text-brand-600"
                          >
                            <Pencil size={16} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-slate-300" size={30} />
            <h2 className="mt-5 font-semibold">
              Nenhuma contratação encontrada
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Adicione uma contratação ou ajuste os filtros da consulta.
            </p>
            <Link
              href="/contratacoes/nova"
              className="mt-5 inline-flex text-sm font-semibold text-brand-600"
            >
              Criar contratação
            </Link>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
          <span>{data.count} registros · Até 20 por página</span>
          <div className="flex items-center gap-3">
            {data.page > 1 && (
              <Link
                href={href(data.page - 1)}
                className="btn-secondary py-1.5 text-xs"
              >
                Anterior
              </Link>
            )}
            <span>
              Página {data.page} de {data.pages}
            </span>
            {data.page < data.pages && (
              <Link
                href={href(data.page + 1)}
                className="btn-secondary py-1.5 text-xs"
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
