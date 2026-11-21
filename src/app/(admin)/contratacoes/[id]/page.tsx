import { ContractingTabs } from "@/components/contracting-tabs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ExternalLink } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { money } from "@/lib/format";
import {
  dateTime,
  PROCUREMENT_METHODS,
  hasActiveDeadline,
} from "@/lib/opportunity-values";
import { getOpportunityDetail } from "@/server/opportunities";
import { PageHeader } from "@/components/page-header";
import { OpportunityStatusBadge } from "@/components/opportunity-status";
import { OpportunityArchive } from "@/components/opportunity-archive";
export const metadata = { title: "Detalhes da contratação" };
export default async function OpportunityDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const data = await getOpportunityDetail(db, id);
  if (!data) notFound();
  const { opportunity, duplicates, history } = data;
  const search = await searchParams;
  return (
    <>
      <Link
        href="/contratacoes"
        className="mb-6 inline-flex text-sm text-slate-500 hover:text-brand-600"
      >
        ← Voltar às contratações
      </Link>
      <PageHeader
        eyebrow="Comercial · Contratação"
        title={opportunity.reference}
        description={opportunity.organization.legalName}
        action={
          <div className="flex flex-wrap gap-3">
            {!opportunity.archived && (
              <Link href={`/contratacoes/${id}/editar`} className="btn">
                <Pencil size={17} />
                Editar contratação
              </Link>
            )}
            <OpportunityArchive
              id={id}
              reference={opportunity.reference}
              version={opportunity.version}
              archived={opportunity.archived}
            />
          </div>
        }
      />
      <ContractingTabs id={id} active="resumo" />
      {search.notice === "saved" && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700"
        >
          Contratação salva com sucesso.
        </p>
      )}
      {opportunity.archived && (
        <p className="mb-5 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
          Contratação arquivada. O histórico está preservado. Restaure para
          editar novamente.
        </p>
      )}
      {!opportunity.organization.active && (
        <p className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          O órgão vinculado está inativo. O histórico da contratação foi
          mantido.
        </p>
      )}
      {!opportunity.archived &&
        hasActiveDeadline(opportunity.status) &&
        opportunity.proposalDeadline &&
        opportunity.proposalDeadline < new Date() && (
          <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            O prazo de apresentação desta contratação está vencido. Confira a
            situação e as observações.
          </p>
        )}
      {duplicates.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            Confira uma possível duplicidade de processo
          </p>
          <p className="mt-1">
            Há outras contratações com o mesmo órgão e número do processo. Os
            registros foram mantidos separados.
          </p>
          <ul className="mt-2 flex flex-wrap gap-3">
            {duplicates.map((other) => (
              <li key={other.id}>
                <Link href={`/contratacoes/${other.id}`} className="underline">
                  {other.reference}
                  {other.archived ? " (arquivada)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <section className="panel mb-6 overflow-hidden">
        <div className="p-6">
          <h2 className="font-semibold">Itens da contratação</h2>
          <p className="mt-1 text-xs text-slate-500">
            Valor estimado: soma dos totais dos itens. Quantidade × valor
            unitário, com arredondamento por item.
          </p>
        </div>
        {opportunity.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Item",
                    "Descrição",
                    "Unidade",
                    "Quantidade",
                    "Valor unitário",
                    "Total",
                  ].map((label) => (
                    <th scope="col" className="px-4 py-3" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opportunity.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4">{item.number}</td>
                    <td className="max-w-sm whitespace-pre-wrap break-words px-4 py-4">
                      {item.description}
                    </td>
                    <td className="px-4 py-4">{item.unit}</td>
                    <td className="px-4 py-4">
                      {item.quantity.toFixed(3).replace(".", ",")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {item.unitPrice === null
                        ? "Não informado"
                        : `R$ ${item.unitPrice.toFixed(4).replace(".", ",")}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">
                      {item.total === null
                        ? "Não informado"
                        : money(item.total.toFixed(2))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 pb-6 text-sm text-slate-500">
            Nenhum item cadastrado. O valor estimado permanece não informado.
          </p>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Resumo da contratação</h2>
            <OpportunityStatusBadge
              status={opportunity.status}
              archived={opportunity.archived}
            />
          </div>
          <h3 className="text-xs font-semibold text-slate-500">Objeto</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
            {opportunity.subject}
          </p>
          <dl className="mt-7 grid gap-6 sm:grid-cols-2">
            {[
              {
                label: "Modalidade",
                value: PROCUREMENT_METHODS[opportunity.procurementMethod],
              },
              {
                label: "Número do processo",
                value: opportunity.processNumber ?? "Não informado",
              },
              {
                label: "Valor estimado",
                value:
                  opportunity.estimatedValue === null
                    ? "Não informado"
                    : money(opportunity.estimatedValue.toFixed(2)),
              },
              {
                label: "Prazo · horário de Brasília",
                value: opportunity.proposalDeadline
                  ? dateTime(opportunity.proposalDeadline)
                  : "Não informado",
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-slate-500">{item.label}</dt>
                <dd className="mt-2 break-words text-sm font-semibold">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            O valor estimado é uma referência comercial. Não representa
            contrato, faturamento ou recebimento.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            {opportunity.platformUrl && (
              <a
                href={opportunity.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600"
              >
                Plataforma de licitação
                <ExternalLink size={15} />
              </a>
            )}
            {opportunity.attachmentsUrl && (
              <a
                href={opportunity.attachmentsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600"
              >
                Pasta de anexos
                <ExternalLink size={15} />
              </a>
            )}
            {opportunity.legacySourceUrl && (
              <a
                href={opportunity.legacySourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-slate-500"
              >
                Link anterior (para conferência)
                <ExternalLink size={15} />
              </a>
            )}
          </div>
          {opportunity.legacyEstimatedValue !== null && (
            <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Valor anterior preservado para conferência:{" "}
              {money(opportunity.legacyEstimatedValue.toFixed(2))}. Não compõe o
              total dos itens.
            </p>
          )}
          <h3 className="mt-7 text-xs font-semibold text-slate-500">
            Observações
          </h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
            {opportunity.notes ?? "Nenhuma observação registrada."}
          </p>
        </section>
        <aside className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-semibold">Órgão público</h2>
            <p className="mt-4 text-sm">{opportunity.organization.legalName}</p>
            {opportunity.organization.uasg && (
              <p className="mt-2 text-xs text-slate-500">
                UASG {opportunity.organization.uasg}
              </p>
            )}
            <Link
              href={`/orgaos/${opportunity.organizationId}/editar`}
              className="mt-4 inline-flex text-sm font-semibold text-brand-600"
            >
              Consultar cadastro do órgão
            </Link>
          </section>
          <section className="panel p-6">
            <h2 className="font-semibold">Histórico recente</h2>
            <p className="mt-1 text-xs text-slate-500">
              Últimas 10 alterações registradas
            </p>
            <ul className="mt-5 space-y-5">
              {history.map((log) => (
                <li key={log.id} className="border-l-2 border-brand-100 pl-3">
                  <p className="text-sm font-semibold">
                    {(
                      {
                        CREATE: "Contratação criada",
                        MIGRATE_CONTRACTING:
                          "Situação convertida para contratação",
                        UPDATE: "Cadastro atualizado",
                        ARCHIVE: "Contratação arquivada",
                        RESTORE: "Contratação restaurada",
                      } as Record<string, string>
                    )[log.action] ?? "Alteração registrada"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {log.actor?.name ?? "Usuário indisponível"} ·{" "}
                    {dateTime(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
