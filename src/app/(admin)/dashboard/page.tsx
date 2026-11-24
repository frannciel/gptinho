import Link from "next/link";
import { AgendaSummary } from "@/components/agenda-summary";
import {
  Landmark,
  Truck,
  ArrowUpRight,
  ArrowRight,
  FileText,
  ShoppingBag,
  Wallet,
  CircleDot,
  Plus,
} from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { getContractStats } from "@/server/contracts";
import { fixed } from "@/lib/contracts";
import { getOpportunityStats } from "@/server/opportunities";
import { OpportunityMetrics } from "@/components/opportunity-metrics";
import { dateTime } from "@/lib/opportunity-values";
import { PageHeader } from "@/components/page-header";
export const metadata = { title: "Visão geral" };
export default async function Dashboard() {
  const user = await requireAdminPage();
  const [[agencies, suppliers, recent], opportunityStats, contractStats] =
    await Promise.all([
      db.$transaction([
        db.organization.count({
          where: { roles: { has: "PUBLIC_AGENCY" }, active: true },
        }),
        db.organization.count({
          where: { roles: { has: "SUPPLIER" }, active: true },
        }),
        db.organization.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      ]),
      getOpportunityStats(db),
      getContractStats(db),
    ]);
  return (
    <>
      <PageHeader
        eyebrow="Seu ponto de partida"
        title="Visão geral"
        description={`Olá, ${user.name.split(" ")[0]}. Acompanhe a base de relacionamentos e prepare os próximos passos da operação.`}
        action={
          <Link href="/contratacoes/nova" className="btn">
            <Plus size={17} />
            Nova contratação
          </Link>
        }
      />
      <div className="mb-7 flex flex-col justify-between gap-5 rounded-xl bg-[#e7f2ef] px-6 py-5 sm:flex-row sm:items-center">
        <div className="flex gap-4">
          <span className="mt-1 text-brand-600">
            <CircleDot size={23} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-brand-700">
              Sua operação começa por uma boa base.
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[#52746c]">
              Centralize órgãos públicos e fornecedores para construir novos
              negócios.
            </p>
          </div>
        </div>
        <Link
          href="/fornecedores/novo"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold text-brand-700"
        >
          Adicionar fornecedor
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Órgãos públicos",
            value: agencies,
            detail: "Cadastros ativos",
            Icon: Landmark,
            href: "/orgaos",
          },
          {
            label: "Fornecedores",
            value: suppliers,
            detail: "Parceiros ativos",
            Icon: Truck,
            href: "/fornecedores",
          },
          {
            label: "Contratações em acompanhamento",
            value: opportunityStats.open,
            detail: "Carteira em acompanhamento · não arquivadas",
            Icon: FileText,
            href: "/contratacoes",
          },
        ].map(({ label, value, detail, Icon, href }) => (
          <Link
            href={href}
            key={label}
            className="panel p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon size={20} />
              </span>
              <ArrowUpRight size={17} className="text-slate-400" />
            </div>
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-3 text-xs text-slate-400">{detail}</p>
          </Link>
        ))}
        {[{ label: "Pedidos em andamento", Icon: ShoppingBag }].map(
          ({ label, Icon }) => (
            <div key={label} className="panel p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon size={20} />
              </div>
              <p className="mt-5 text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {contractStats.orders}
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Pedidos pendentes ou parcialmente fornecidos
              </p>
            </div>
          ),
        )}
      </div>
      <AgendaSummary actorId={user.id} />
      <section className="mt-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Carteira de contratações</h2>
            <p className="mt-1 text-xs text-slate-500">
              Indicadores calculados a partir das contratações em
              acompanhamento.
            </p>
          </div>
          <Link
            href="/contratacoes"
            className="text-sm font-semibold text-brand-600"
          >
            Ver contratações →
          </Link>
        </div>
        <OpportunityMetrics stats={opportunityStats} />
        {opportunityStats.upcoming.length > 0 && (
          <div className="panel p-5">
            <h3 className="mb-4 text-sm font-semibold">
              Prazos nos próximos 7 dias
            </h3>
            <ul className="divide-y divide-slate-100">
              {opportunityStats.upcoming.map((opportunity) => (
                <li key={opportunity.id}>
                  <Link
                    href={`/contratacoes/${opportunity.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm hover:text-brand-600"
                  >
                    <span>
                      <strong>{opportunity.reference}</strong> ·{" "}
                      {opportunity.organization.legalName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {dateTime(opportunity.proposalDeadline!)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-semibold">Cadastros recentes</h2>
              <p className="mt-1 text-xs text-slate-500">
                Últimas organizações adicionadas
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
              {recent.length} registros
            </span>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-slate-100">
              {recent.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`${org.roles.includes("PUBLIC_AGENCY") ? "/orgaos" : "/fornecedores"}/${org.id}/editar`}
                    className="flex items-center gap-4 p-5 hover:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      {org.roles.includes("PUBLIC_AGENCY") ? (
                        <Landmark size={18} />
                      ) : (
                        <Truck size={18} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {org.legalName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {org.roles
                          .map((role) =>
                            role === "PUBLIC_AGENCY"
                              ? "Órgão público"
                              : "Fornecedor",
                          )
                          .join(" · ")}
                        {!org.active ? " · Inativo" : ""}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {date(org.createdAt)}
                    </span>
                    <ArrowUpRight size={16} className="text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-14 text-center">
              <Landmark size={28} className="mx-auto text-slate-300" />
              <h3 className="mt-4 text-sm font-semibold">
                Tudo pronto para o primeiro cadastro
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Adicione os órgãos e parceiros da sua operação.
              </p>
              <Link
                href="/orgaos/novo"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600"
              >
                Criar cadastro
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </section>
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <Wallet size={19} className="text-brand-600" />
            <h2 className="font-semibold">Resumo comercial</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Valores apurados a partir dos contratos, notas fiscais e
            recebimentos registrados. Termos e Empenhos substitutivos são
            acompanhados como contratos independentes. O valor atualizado
            corresponde ao período atual; faturamento e recebimentos são
            acumulados.
          </p>
          <dl className="mt-5 divide-y divide-slate-100">
            {[
              [
                "Valor atualizado dos períodos atuais",
                contractStats.contracted,
              ],
              ["Valor faturado", contractStats.invoiced],
              ["Valor recebido", contractStats.received],
              ["Saldo a receber", contractStats.receivable],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex justify-between gap-3 py-3.5"
              >
                <dt className="text-sm text-slate-500">{String(label)}</dt>
                <dd className="text-sm font-semibold">
                  {money(fixed(value as bigint, 2))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Cadastros legados sem valor informado precisam ser completados para
            integrar o total contratado.
          </p>
        </section>
      </div>
      <section className="mt-7">
        <h2 className="text-sm font-semibold">O caminho da sua operação</h2>
        <p className="mt-1 text-xs text-slate-500">
          Fluxo operacional disponível no Govnex. Propostas são elaboradas
          externamente a partir da exportação de dados.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            "Contratação",
            "Importação de itens",
            "Precificação",
            "Proposta",
            "Contrato / empenho",
            "Fornecimento",
            "Faturamento",
            "Recebimento",
          ].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                {label}
              </span>
              {i < 7 && <ArrowRight size={12} className="text-slate-300" />}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
