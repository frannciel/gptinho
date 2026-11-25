import { describe, it, expect } from "vitest";
import {
  notificationSchedule,
  notificationOverdueLabel,
  atBrazilEight,
  notificationChannels,
  requireEnabledChannel,
  type NotificationSource,
} from "@/lib/notifications";
const source = (
  kind: NotificationSource["kind"],
  date = "2027-05-01T00:00:00Z",
): NotificationSource => ({
  key: `${kind}:example`,
  kind,
  title: "Teste",
  href: "/tarefas/example/editar",
  dueAt: new Date(date),
  createdAt: new Date("2026-01-01Z"),
});
describe("Matriz de notificações", () => {
  it.each([
    ["CONTRACT", ["90d", "30d", "7d", "DUE"]],
    ["PRICE_REGISTRATION", ["30d", "7d", "DUE"]],
    ["GUARANTEE", ["30d", "7d", "1d", "DUE"]],
    ["TASK", ["7d", "1d", "DUE"]],
    ["DELIVERY", ["7d", "3d", "1d", "DUE"]],
    ["SESSION", ["1440m", "60m", "15m", "DUE"]],
  ] as const)("planeja a sequência de %s", (kind, stages) => {
    expect(
      notificationSchedule(source(kind), new Date("2026-01-01Z")).map(
        (p) => p.stage,
      ),
    ).toEqual([...stages]);
  });
  it("contrato novo dentro dos últimos 7 dias recebe apenas a condição atual, sem avisos de 90 e 30 dias", () => {
    expect(
      notificationSchedule(
        source("CONTRACT"),
        new Date("2027-04-27T12:00:00Z"),
      ).map((p) => p.stage),
    ).toEqual(["7d", "DUE"]);
  });
  it("dia inteiro usa 8h de Brasília", () => {
    expect(atBrazilEight("2027-05-01").toISOString()).toBe(
      "2027-05-01T11:00:00.000Z",
    );
  });
  it("notifica o início da sessão no horário exato, sem duplicar apresentação de proposta", () => {
    const s = source("SESSION", "2027-05-01T14:30:00Z");
    const plans = notificationSchedule(s, new Date("2027-05-01T14:29:59Z"));
    expect(plans.map((p) => p.stage)).toEqual(["15m", "DUE"]);
    expect(plans[1].at.toISOString()).toBe("2027-05-01T14:30:00.000Z");
    expect(
      notificationSchedule(s, new Date("2027-05-01T14:30:00Z")).map(
        (p) => p.stage,
      ),
    ).toEqual(["DUE"]);
  });
  it("tarefas e entregas atrasadas recebem aviso diário depois das 8h", () => {
    for (const kind of ["TASK", "DELIVERY"] as const) {
      const s = source(kind);
      expect(
        notificationSchedule(s, new Date("2027-05-03T12:00:00Z")).map(
          (p) => p.stage,
        ),
      ).toEqual(["OVERDUE:2027-05-03"]);
      expect(
        notificationSchedule(s, new Date("2027-05-03T10:00:00Z")).map(
          (p) => p.stage,
        ),
      ).toEqual(["OVERDUE:2027-05-02"]);
    }
  });
  it("contratos e atas vencidos não recebem repetição diária", () => {
    for (const kind of ["CONTRACT", "PRICE_REGISTRATION"] as const)
      expect(
        notificationSchedule(source(kind), new Date("2027-05-20Z")).map(
          (p) => p.stage,
        ),
      ).toEqual(["DUE"]);
  });
  it("e-mail e WhatsApp permanecem desativados", () => {
    expect(notificationChannels.IN_APP.enabled).toBe(true);
    for (const c of ["EMAIL", "WHATSAPP"] as const) {
      expect(notificationChannels[c].enabled).toBe(false);
      expect(() => requireEnabledChannel(c)).toThrow("desativado");
    }
  });
});

it("indica vencimento apenas após o dia final, sem tratar sessão passada como atraso", () => {
  const due = new Date("2027-05-01Z");
  expect(
    notificationOverdueLabel("CONTRACT", due, new Date("2027-05-02T02:00:00Z")),
  ).toBeNull();
  expect(
    notificationOverdueLabel("CONTRACT", due, new Date("2027-05-02T12:00:00Z")),
  ).toBe("Vigência encerrada");
  expect(
    notificationOverdueLabel(
      "PRICE_REGISTRATION",
      due,
      new Date("2027-05-02T12:00:00Z"),
    ),
  ).toBe("Ata vencida");
  expect(
    notificationOverdueLabel("SESSION", due, new Date("2027-05-20Z")),
  ).toBeNull();
});
