import Link from "next/link";
import { z } from "zod";
import { Plus, CalendarDays, List } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { brazilDay, monthRange, eventTypes, isOverdue } from "@/lib/agenda";
import { getCalendarEvents } from "@/server/calendar";
import { idSchema } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
import { OrganizationFilter } from "@/components/organization-filter";
import { CalendarEvents } from "@/components/calendar-events";
export const metadata = { title: "Calendário" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPage();
  const params = await searchParams;
  const today = brazilDay();
  const parsed = z
    .object({
      month: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .refine((v) => v >= "1900-01" && v <= "2199-12")
        .default(today.slice(0, 7)),
      view: z.enum(["month", "list"]).default("month"),
      type: z
        .enum(["all", "SESSION", "DELIVERY", "CONTRACT", "GUARANTEE", "TASK"])
        .default("all"),
      status: z.enum(["all", "pending", "overdue", "unread"]).default("all"),
      organizationId: z
        .union([idSchema, z.literal("none"), z.literal("")])
        .default(""),
    })
    .safeParse(params);
  const filter = parsed.success
    ? parsed.data
    : {
        month: today.slice(0, 7),
        view: "month",
        type: "all",
        status: "all",
        organizationId: "",
      };
  const { start, end } = monthRange(filter.month);
  const { events, truncated } = await getCalendarEvents(
    db,
    start,
    end,
    user.id,
  );
  const items = events.filter(
    (e) =>
      (filter.type === "all" || e.type === filter.type) &&
      (!filter.organizationId ||
        (filter.organizationId === "none"
          ? !e.organizationId
          : e.organizationId === filter.organizationId)) &&
      (filter.status === "all" ||
        (filter.status === "pending" && e.pending) ||
        (filter.status === "overdue" && isOverdue(e, today)) ||
        (filter.status === "unread" && e.pending && !e.read)),
  );
  const org =
    filter.organizationId && filter.organizationId !== "none"
      ? await db.organization.findUnique({
          where: { id: filter.organizationId },
          select: { id: true, legalName: true },
        })
      : null;
  const days = (end.getTime() - start.getTime()) / 86400000;
  const offset = (start.getUTCDay() + 6) % 7;
  const previous = new Date(start);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const next = new Date(end);
  const href = (month: string, view = filter.view) =>
    `/calendario?${new URLSearchParams({ ...filter, month, view })}`;
  const grouped = Map.groupBy(items, (e) => e.day);
  return (
    <>
      <PageHeader
        eyebrow="Agenda operacional"
        title="Calendário"
        description="Sessões, propostas, entregas, vigências, garantias e tarefas. Horários de Brasília; demais prazos são de dia inteiro."
        action={
          <Link className="btn" href="/tarefas/nova">
            <Plus size={17} />
            Novo compromisso
          </Link>
        }
      />
      {!parsed.success && (
        <p role="alert">Filtros inválidos. Exibindo o mês atual.</p>
      )}
      <form className="panel mb-6 grid items-end gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        <label>
          Mês
          <input
            className="field"
            type="month"
            name="month"
            required
            min="1900-01"
            max="2199-12"
            defaultValue={filter.month}
          />
        </label>
        <label>
          Tipo
          <select className="field" name="type" defaultValue={filter.type}>
            <option value="all">Todos</option>
            {Object.entries(eventTypes).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select className="field" name="status" defaultValue={filter.status}>
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Prazos vencidos</option>
            <option value="unread">Alertas não lidos</option>
          </select>
        </label>
        <OrganizationFilter
          initial={org ? { id: org.id, label: org.legalName } : null}
          unlinked={filter.organizationId === "none"}
        />
        <input type="hidden" name="view" value={filter.view} />
        <div className="flex gap-2">
          <button className="btn">
            <ButtonContent action="filter" />
          </button>
          <Link
            className="btn-secondary"
            href={`/calendario?view=${filter.view}`}
          >
            <ButtonContent action="clear" />
          </Link>
        </div>
      </form>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Visualização do calendário"
          className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1"
        >
          <Link
            className={filter.view === "month" ? "btn" : "btn-secondary"}
            href={href(filter.month, "month")}
            aria-current={filter.view === "month" ? "page" : undefined}
          >
            <CalendarDays size={16} />
            Mensal
          </Link>
          <Link
            className={filter.view === "list" ? "btn" : "btn-secondary"}
            href={href(filter.month, "list")}
            aria-current={filter.view === "list" ? "page" : undefined}
          >
            <List size={16} />
            Lista
          </Link>
        </div>
        {filter.month > "1900-01" && (
          <Link
            className="btn-secondary"
            href={href(previous.toISOString().slice(0, 7))}
          >
            Mês anterior
          </Link>
        )}
        <Link className="btn-secondary" href={href(today.slice(0, 7))}>
          Hoje
        </Link>
        {filter.month < "2199-12" && (
          <Link
            className="btn-secondary"
            href={href(next.toISOString().slice(0, 7))}
          >
            Próximo mês
          </Link>
        )}
        <span className="text-sm">{items.length} evento(s) no período</span>
      </div>
      {truncated && (
        <p role="alert" className="mb-4 rounded bg-amber-50 p-4">
          Há mais de 1.000 eventos de um tipo neste período. A exibição foi
          limitada; consulte também as listas de origem.
        </p>
      )}
      {!items.length && (
        <p className="panel mb-4 p-8 text-center text-slate-500">
          Nenhum evento encontrado neste período.
        </p>
      )}
      {filter.view === "month" && (
        <div className="panel hidden overflow-hidden lg:block">
          <div className="grid grid-cols-7">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div
                key={d}
                className="border-b border-slate-100 p-3 text-center text-xs font-semibold"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div
                className="min-h-28 border-r border-b border-slate-100 bg-slate-50"
                key={`empty-${i}`}
              />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = `${filter.month}-${String(i + 1).padStart(2, "0")}`;
              return (
                <div
                  key={day}
                  className={`min-w-0 border-r border-b border-slate-100 p-2 ${day === today ? "bg-brand-50" : ""}`}
                >
                  <p className="mb-2 text-sm font-semibold">
                    {i + 1}
                    {day === today ? " · Hoje" : ""}
                  </p>
                  <CalendarEvents
                    events={grouped.get(day) ?? []}
                    today={today}
                    compact
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div
        className={
          filter.view === "month" ? "space-y-5 lg:hidden" : "space-y-5"
        }
      >
        {[...grouped].map(([day, dayEvents]) => (
          <section key={day} className="panel p-4">
            <h2 className="mb-3 font-semibold">
              {new Intl.DateTimeFormat("pt-BR", {
                timeZone: "UTC",
                dateStyle: "full",
              }).format(new Date(day + "T00:00:00Z"))}
            </h2>
            <CalendarEvents events={dayEvents} today={today} />
          </section>
        ))}
      </div>
      <p className="mt-5 text-xs text-slate-500">
        Eventos automáticos são atualizados no cadastro de origem. Marcar como
        lido afeta apenas o alerta do seu usuário.
      </p>
    </>
  );
}
