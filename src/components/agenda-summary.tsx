import Link from "next/link";
import { db } from "@/lib/db";
import { brazilDay, isOverdue } from "@/lib/agenda";
import { getCalendarEvents } from "@/server/calendar";
import { CalendarEvents } from "./calendar-events";
export async function AgendaSummary({ actorId }: { actorId: string }) {
  const today = brazilDay();
  const end = new Date(today + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 7);
  const start = new Date(today + "T00:00:00Z");
  const [past, future] = await Promise.all([
    getCalendarEvents(db, new Date("1900-01-01T00:00:00Z"), start, actorId, {
      pendingOnly: true,
      newestFirst: true,
    }),
    getCalendarEvents(db, start, end, actorId, { pendingOnly: true }),
  ]);
  const overdue = past.events.filter((e) => isOverdue(e, today));
  const upcoming = future.events.filter((e) => e.pending);
  const truncated = past.truncated || future.truncated;
  return (
    <section className="panel mt-7 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Agenda operacional</h2>
        <Link
          className="text-sm font-semibold text-brand-600"
          href="/calendario"
        >
          Ver calendário →
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-red-700">
            Prazos vencidos ({overdue.length}
            {truncated ? "+" : ""})
          </h3>
          {overdue.length ? (
            <CalendarEvents
              events={overdue.slice(-5).reverse()}
              today={today}
            />
          ) : (
            <p className="text-sm text-slate-500">Nenhum prazo vencido.</p>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">
            Hoje e próximos 6 dias ({upcoming.length}
            {truncated ? "+" : ""})
          </h3>
          {upcoming.length ? (
            <CalendarEvents events={upcoming.slice(0, 5)} today={today} />
          ) : (
            <p className="text-sm text-slate-500">
              Nenhum compromisso previsto.
            </p>
          )}
        </div>
      </div>
      {truncated && (
        <p className="mt-3 text-xs text-amber-800">
          Resumo limitado. Consulte o calendário por mês e as listas de origem
          para os demais registros.
        </p>
      )}
    </section>
  );
}
