import { z } from "zod";
import { organizationSchema, idSchema } from "./validation";
export const taskStatuses = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
} as const;
export const taskPriorities = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
} as const;
export const eventTypes = {
  SESSION: "Sessão / proposta",
  DELIVERY: "Entrega de pedido",
  CONTRACT: "Fim da vigência",
  GUARANTEE: "Vencimento da garantia",
  TASK: "Tarefa / compromisso",
} as const;
const nullableId = z
  .union([idSchema, z.literal("")])
  .transform((v) => v || null);
export const contactSchema = organizationSchema.shape.contacts.element
  .omit({ id: true })
  .extend({ organizationId: nullableId });
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return (
      Number.isFinite(d.getTime()) &&
      d.toISOString().slice(0, 10) === v &&
      v >= "1900-01-01" &&
      v <= "2199-12-31"
    );
  }, "Informe uma data válida entre 1900 e 2199.");
export const taskSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título.").max(180),
    description: z
      .string()
      .trim()
      .max(5000)
      .transform((v) => v || null),
    dueDate: dateOnly.transform((v) => new Date(v + "T00:00:00Z")),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]),
    assigneeId: nullableId,
    organizationId: nullableId,
    contactId: nullableId,
    opportunityId: nullableId,
    contractId: nullableId,
  })
  .strict();
export function brazilDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export type CalendarEvent = {
  key: string;
  type: keyof typeof eventTypes;
  title: string;
  day: string;
  time?: string;
  href: string;
  organizationId: string | null;
  organizationName: string;
  pending: boolean;
  statusLabel?: string;
  read?: boolean;
};
export function isOverdue(event: CalendarEvent, today: string) {
  return event.pending && event.day < today;
}
export function monthRange(month: string) {
  const valid = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine((v) => v >= "1900-01" && v <= "2199-12")
    .parse(month);
  const start = new Date(valid + "-01T00:00:00Z");
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}
export function eventKey(type: string, id: string, date: Date) {
  return `${type}:${id}:${date.toISOString()}`;
}
