import type { NotificationKind, NotificationChannel } from "@prisma/client";
import { brazilDay } from "./agenda";
export const notificationKinds: Record<NotificationKind, string> = {
  SESSION: "Sessão / proposta",
  DELIVERY: "Entrega de pedido",
  CONTRACT: "Vigência do contrato",
  PRICE_REGISTRATION: "Validade da ata",
  GUARANTEE: "Garantia",
  TASK: "Tarefa / compromisso",
};
export const notificationChannels: Readonly<
  Record<NotificationChannel, Readonly<{ enabled: boolean; label: string }>>
> = Object.freeze({
  IN_APP: Object.freeze({ enabled: true, label: "No sistema" }),
  EMAIL: Object.freeze({ enabled: false, label: "E-mail" }),
  WHATSAPP: Object.freeze({ enabled: false, label: "WhatsApp" }),
});
export interface ExternalNotificationProvider {
  channel: "EMAIL" | "WHATSAPP";
  send(message: {
    idempotencyKey: string;
    recipient: string;
    title: string;
    body: string;
    href: string;
  }): Promise<{ providerMessageId: string }>;
}
// No external dispatcher is enabled or invoked in the MVP.
export function requireEnabledChannel(channel: NotificationChannel) {
  if (!notificationChannels[channel].enabled)
    throw new Error("Canal de notificação desativado no MVP.");
}
export type NotificationSource = {
  key: string;
  kind: NotificationKind;
  title: string;
  href: string;
  dueAt: Date;
  createdAt: Date;
};
export function atBrazilEight(day: string) {
  return new Date(`${day}T08:00:00-03:00`);
}
export function shiftDay(day: string, offset: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function notificationSchedule(source: NotificationSource, now: Date) {
  const offsets: Record<NotificationKind, number[]> = {
    SESSION: [1440, 60, 15, 0],
    DELIVERY: [7, 3, 1, 0],
    CONTRACT: [90, 30, 7, 0],
    PRICE_REGISTRATION: [30, 7, 0],
    GUARANTEE: [30, 7, 1, 0],
    TASK: [7, 1, 0],
  };
  const day = source.dueAt.toISOString().slice(0, 10);
  const plans = offsets[source.kind].map((offset) => ({
    stage:
      offset === 0
        ? "DUE"
        : `${offset}${source.kind === "SESSION" ? "m" : "d"}`,
    at:
      source.kind === "SESSION"
        ? new Date(source.dueAt.getTime() - offset * 60000)
        : atBrazilEight(shiftDay(day, -offset)),
  }));
  if (
    (source.kind === "TASK" || source.kind === "DELIVERY") &&
    brazilDay(now) > day
  ) {
    let current = brazilDay(now);
    if (atBrazilEight(current) > now) current = shiftDay(current, -1);
    if (current > day)
      plans.push({ stage: `OVERDUE:${current}`, at: atBrazilEight(current) });
  }
  // Only the current condition is created retroactively; future milestones are planned.
  const past = plans
    .filter((p) => p.at <= now)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return [
    ...(past[0] ? [past[0]] : []),
    ...plans.filter((p) => p.at > now),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}
export function notificationText(source: NotificationSource, stage: string) {
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: source.kind === "SESSION" ? "America/Sao_Paulo" : "UTC",
    dateStyle: "short",
    ...(source.kind === "SESSION" ? { timeStyle: "short" as const } : {}),
  }).format(source.dueAt);
  return {
    title: `${notificationKinds[source.kind]} · ${source.title}`,
    body: `${stage.startsWith("OVERDUE:") ? "Prazo em atraso" : stage === "DUE" ? (source.kind === "SESSION" ? "Início da sessão / limite para apresentação da proposta" : "Data de vencimento") : "Lembrete de prazo"}: ${date}. Abra o registro para acompanhar a situação.`,
  };
}

export function notificationOverdueLabel(
  kind: NotificationKind,
  dueAt: Date,
  now = new Date(),
) {
  if (kind === "SESSION" || brazilDay(now) <= dueAt.toISOString().slice(0, 10))
    return null;
  return kind === "CONTRACT"
    ? "Vigência encerrada"
    : kind === "PRICE_REGISTRATION"
      ? "Ata vencida"
      : kind === "GUARANTEE"
        ? "Garantia vencida"
        : "Prazo vencido";
}
