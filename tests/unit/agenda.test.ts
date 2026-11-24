import { describe, expect, it } from "vitest";
import {
  brazilDay,
  contactSchema,
  taskSchema,
  monthRange,
  eventKey,
  isOverdue,
  type CalendarEvent,
} from "@/lib/agenda";
const contact = {
  name: "Pessoa Teste",
  position: "",
  phone: "(61) 99999-0000",
  email: "  PESSOA@EXAMPLE.ORG  ",
  organizationId: "",
};
const task = {
  title: "Preparar proposta",
  description: "",
  dueDate: "2026-11-30",
  status: "PENDING",
  priority: "NORMAL",
  assigneeId: "",
  organizationId: "",
  contactId: "",
  opportunityId: "",
  contractId: "",
};
describe("Contatos e agenda: validação e datas", () => {
  it("aceita contato independente e normaliza meios de comunicação", () => {
    expect(contactSchema.parse(contact)).toMatchObject({
      organizationId: null,
      email: "pessoa@example.org",
      phone: "61999990000",
    });
    expect(contactSchema.parse({ ...contact, email: "" }).email).toBeNull();
  });
  it("rejeita e-mail inválido e organização inválida", () => {
    expect(
      contactSchema.safeParse({ ...contact, email: "invalido" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ ...contact, organizationId: "inexistente" })
        .success,
    ).toBe(false);
  });
  it("mantém datas de dia inteiro em UTC sem deslocamento", () => {
    expect(taskSchema.parse(task).dueDate.toISOString()).toBe(
      "2026-11-30T00:00:00.000Z",
    );
  });
  it.each([
    "2026-02-30",
    "2026-13-01",
    "01/11/2026",
    "1899-12-31",
    "2200-01-01",
  ])("rejeita data impossível ou fora do intervalo %s", (dueDate) => {
    expect(taskSchema.safeParse({ ...task, dueDate }).success).toBe(false);
  });
  it("considera a virada de dia em São Paulo", () => {
    expect(brazilDay(new Date("2026-12-01T02:59:00Z"))).toBe("2026-11-30");
    expect(brazilDay(new Date("2026-12-01T03:00:00Z"))).toBe("2026-12-01");
  });
  it("limita o mês com fim exclusivo, inclusive ano bissexto", () => {
    expect(monthRange("2028-02").end.toISOString()).toBe(
      "2028-03-01T00:00:00.000Z",
    );
    expect(() => monthRange("2026-13")).toThrow();
  });
  it("atraso é derivado: não altera a situação e ignora finalizados", () => {
    const e = { pending: true, day: "2026-11-29" } as CalendarEvent;
    expect(isOverdue(e, "2026-11-30")).toBe(true);
    expect(isOverdue(e, "2026-11-29")).toBe(false);
    expect(isOverdue({ ...e, pending: false }, "2026-11-30")).toBe(false);
  });
  it("mudança do prazo gera outro alerta", () => {
    expect(eventKey("TASK", "id", new Date("2026-11-30Z"))).not.toBe(
      eventKey("TASK", "id", new Date("2026-12-01Z")),
    );
  });
});
