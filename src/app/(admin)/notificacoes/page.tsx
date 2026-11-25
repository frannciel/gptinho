import Link from "next/link";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  notificationKinds,
  notificationChannels,
  notificationOverdueLabel,
} from "@/lib/notifications";
import {
  synchronizeNotifications,
  listNotifications,
  notificationFilters,
} from "@/server/notifications";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
import { NotificationControls } from "@/components/notification-controls";
import { AgendaPagination } from "@/components/agenda-pagination";
export const metadata = { title: "Central de notificações" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPage();
  await synchronizeNotifications(db);
  const parsed = notificationFilters.safeParse(await searchParams);
  const filters = parsed.success ? parsed.data : notificationFilters.parse({});
  const result = await listNotifications(db, user.id, filters);
  const stamp = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  const labels = {
    ACTIVE: "Em acompanhamento",
    RESOLVED: "Resolvida",
    CANCELLED: "Cancelada por alteração de prazo",
  };
  return (
    <>
      <PageHeader
        eyebrow="Agenda operacional"
        title="Central de notificações"
        description="Acompanhe os prazos e a leitura dos seus avisos. Ler ou fechar um alerta não altera a obrigação de origem."
        action={<NotificationControls />}
      />
      <div className="mb-6 flex flex-wrap gap-3">
        {Object.entries(notificationChannels).map(([key, c]) => (
          <span
            key={key}
            className={`rounded-full px-3 py-1 text-xs ${c.enabled ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-500"}`}
          >
            {c.label}: {c.enabled ? "ativo" : "envio desativado no MVP"}
          </span>
        ))}
      </div>
      {!parsed.success && (
        <p role="alert" className="mb-4 rounded bg-amber-50 p-4 text-sm">
          Filtros inválidos. Confira o período informado; exibindo a consulta
          padrão.
        </p>
      )}
      <form
        key={JSON.stringify(filters)}
        className="panel mb-6 grid items-end gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div>
          <label htmlFor="notice-kind">Tipo</label>
          <select
            id="notice-kind"
            className="field"
            name="kind"
            defaultValue={filters.kind}
          >
            <option value="ALL">Todos</option>
            {Object.entries(notificationKinds).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <label>
          Situação
          <select
            aria-label="Situação da notificação"
            className="field"
            name="state"
            defaultValue={filters.state}
          >
            <option value="ALL">Todas</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Leitura
          <select
            aria-label="Leitura"
            className="field"
            name="reading"
            defaultValue={filters.reading}
          >
            <option value="ALL">Todas</option>
            <option value="UNREAD">Não lidas</option>
            <option value="READ">Lidas</option>
          </select>
        </label>
        <label>
          De
          <input
            className="field"
            type="date"
            name="from"
            defaultValue={filters.from}
          />
        </label>
        <label>
          Até
          <input
            className="field"
            type="date"
            name="to"
            defaultValue={filters.to}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn">
            <ButtonContent action="filter" />
          </button>
          <Link href="/notificacoes" className="btn-secondary">
            <ButtonContent action="clear" />
          </Link>
        </div>
      </form>
      <p className="mb-4 text-sm text-slate-500">
        {result.count} notificação(ões). Horários de Brasília.
      </p>
      <ul className="space-y-4">
        {result.items.map((n) => {
          const overdue =
            n.state === "ACTIVE"
              ? notificationOverdueLabel(n.kind, n.dueAt)
              : null;
          return (
            <li
              key={n.id}
              className={`panel border-l-4 p-5 ${overdue ? "border-l-red-500" : !n.readAt && n.state === "ACTIVE" ? "border-l-brand-500" : "border-l-slate-200"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-slate-100 px-2 py-1">
                      {notificationKinds[n.kind]}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-1">
                      {labels[n.state]}
                    </span>
                    {overdue && (
                      <span className="rounded bg-red-50 px-2 py-1 font-semibold text-red-800">
                        {overdue}
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-1 ${n.readAt ? "bg-slate-50 text-slate-500" : "bg-brand-50 text-brand-700"}`}
                    >
                      {n.readAt ? "Lida" : "Não lida"}
                    </span>
                  </div>
                  <h2 className="break-words font-semibold">{n.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{n.body}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Disponível em {stamp(n.visibleAt)}
                    {n.readAt ? ` · Lida em ${stamp(n.readAt)}` : ""}
                    {n.closedAt ? ` · Atualizada em ${stamp(n.closedAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="btn-secondary" href={n.href}>
                    Abrir registro
                  </Link>
                  <NotificationControls id={n.id} read={!!n.readAt} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {!result.items.length && (
        <p className="panel p-8 text-center text-slate-500">
          Nenhuma notificação encontrada para os filtros selecionados.
        </p>
      )}
      <AgendaPagination
        base="/notificacoes"
        params={{
          kind: filters.kind,
          state: filters.state,
          reading: filters.reading,
          from: filters.from,
          to: filters.to,
        }}
        page={result.page}
        pages={result.pages}
      />
    </>
  );
}
