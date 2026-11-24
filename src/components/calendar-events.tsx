import Link from "next/link";
import { Check } from "lucide-react";
import { eventTypes, isOverdue, type CalendarEvent } from "@/lib/agenda";
import { ActionForm } from "./action-form";
import { readEventAction } from "@/app/(admin)/tarefas/actions";
const colors = {
  SESSION: "border-blue-200 bg-blue-50 text-blue-900",
  DELIVERY: "border-amber-200 bg-amber-50 text-amber-900",
  CONTRACT: "border-violet-200 bg-violet-50 text-violet-900",
  GUARANTEE: "border-orange-200 bg-orange-50 text-orange-900",
  TASK: "border-teal-200 bg-teal-50 text-teal-900",
};
export function CalendarEvents({
  events,
  today,
  compact = false,
}: {
  events: CalendarEvent[];
  today: string;
  compact?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li
          key={e.key}
          className={`rounded-lg border p-3 ${isOverdue(e, today) ? "border-red-200 bg-red-50 text-red-900" : colors[e.type]}`}
        >
          <Link className="block" href={e.href}>
            <span className="text-[11px] font-semibold">
              {!compact && `${e.day.split("-").reverse().join("/")} · `}
              {eventTypes[e.type]}
              {e.time ? ` · ${e.time}` : ""}
            </span>
            <p className="mt-1 text-sm font-semibold break-words">{e.title}</p>
            {!compact && (
              <p className="mt-1 text-xs break-words">{e.organizationName}</p>
            )}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {isOverdue(e, today) && <strong>Prazo vencido</strong>}
            {e.statusLabel && <span>{e.statusLabel}</span>}
            {e.read ? (
              <span className="flex items-center gap-1">
                <Check size={12} />
                Alerta lido
              </span>
            ) : (
              e.pending && (
                <ActionForm action={readEventAction}>
                  <input type="hidden" name="key" value={e.key} />
                  <input type="hidden" name="day" value={e.day} />
                  <button className="underline">Marcar como lido</button>
                </ActionForm>
              )
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
