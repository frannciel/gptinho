import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db-client";
import { saveContact, deleteContact, listContacts } from "@/server/contacts";
import { saveOrganization, deleteOrganization } from "@/server/organizations";
import { saveTask, deleteTask, listTasks } from "@/server/tasks";
import { getCalendarEvents, markEventRead } from "@/server/calendar";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Exige banco descartável _test.");
const db = createDb(url);
const tag = randomUUID().toUpperCase();
let actorId: string;
let organizationId: string;
let contactId: string;
let taskId: string;
let contractId: string;
let caseId: string;
const person = {
  name: `Pessoa ${tag}`,
  email: `${tag.toLowerCase()}@example.org`,
  phone: "(61) 99999-1234",
  position: "Compras",
  organizationId: "",
};
const activity = {
  title: `Tarefa ${tag}`,
  description: "Teste",
  dueDate: "2026-11-30",
  status: "PENDING",
  priority: "HIGH",
  assigneeId: "",
  organizationId: "",
  contactId: "",
  opportunityId: "",
  contractId: "",
};
const orgInput = {
  legalName: `Órgão ${tag}`,
  tradeName: "",
  acronym: "",
  cnpj: "",
  uasg: "",
  roles: ["PUBLIC_AGENCY"],
  email: "",
  phone: "",
  categories: [],
  notes: "",
  active: true,
  contacts: [],
};
const events = () =>
  getCalendarEvents(
    db,
    new Date("2026-11-01Z"),
    new Date("2026-12-01Z"),
    actorId,
  );
beforeAll(async () => {
  actorId = (
    await db.user.create({
      data: {
        name: "Agenda teste",
        email: `actor-${tag}@example.org`,
        passwordHash: "unused",
        role: "ADMIN",
      },
    })
  ).id;
  organizationId = (await saveOrganization(db, actorId, orgInput)).id;
});
afterAll(async () => {
  await db.eventRead.deleteMany({ where: { actorId } });
  await db.task.deleteMany({ where: { title: { contains: tag } } });
  if (caseId) {
    await db.contractPeriod.deleteMany({ where: { caseId } });
    await db.contractAmendment.deleteMany({ where: { caseId } });
    await db.supplyOrderItem.deleteMany({ where: { caseId } });
    await db.supplyOrder.deleteMany({ where: { caseId } });
    await db.contractGuarantee.deleteMany({ where: { caseId } });
    await db.contractItem.deleteMany({ where: { caseId } });
    await db.contract.deleteMany({ where: { caseId } });
    await db.contractCase.deleteMany({ where: { id: caseId } });
  }
  await db.opportunity.deleteMany({
    where: { reference: { startsWith: tag } },
  });
  await db.contact.deleteMany({ where: { name: { contains: tag } } });
  await db.organization.deleteMany({ where: { id: organizationId } });
  await db.auditLog.deleteMany({ where: { actorId } });
  await db.user.deleteMany({ where: { id: actorId } });
  await db.$disconnect();
});
describe.sequential("Contatos, tarefas e calendário em PostgreSQL", () => {
  it("cadastra contato sem organização e permite busca", async () => {
    const c = await saveContact(db, actorId, person);
    contactId = c.id;
    expect(c.organizationId).toBeNull();
    expect(c.phone).toBe("61999991234");
    expect(
      (await listContacts(db, { q: tag, organizationId: "none" })).count,
    ).toBe(1);
  });
  it("persiste telefones, observações e LinkedIn sem perder adicionais em edições embutidas", async () => {
    const standalone = await saveContact(db, actorId, {
      ...person,
      email: `multi-${tag.toLowerCase()}@example.org`,
      phones: [
        { number: "(61) 99999-1234", whatsapp: true },
        { number: "(61) 3333-4444", whatsapp: false },
      ],
      notes: "Contato de compras",
      linkedInUrl: "https://www.linkedin.com/in/pessoa",
      organizationId,
    });
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    await saveOrganization(
      db,
      actorId,
      {
        ...orgInput,
        contacts: [
          {
            id: standalone.id,
            name: standalone.name,
            email: standalone.email,
            phone: standalone.phone,
            position: "Compras",
          },
        ],
      },
      org.id,
      org.version,
    );
    const after = await db.contact.findUniqueOrThrow({
      where: { id: standalone.id },
    });
    expect(after.phones).toEqual([
      { number: "61999991234", whatsapp: true },
      { number: "6133334444", whatsapp: false },
    ]);
    expect(
      (await listContacts(db, { q: "(61) 3333-4444" })).items.some(
        (c) => c.id === standalone.id,
      ),
    ).toBe(true);
    expect(after.notes).toBe("Contato de compras");
    expect(after.linkedInUrl).toBe("https://www.linkedin.com/in/pessoa");
    await deleteContact(db, actorId, after.id, after.version);
  });
  it("unicidade de e-mail vale com ou sem organização", async () => {
    await expect(
      saveContact(db, actorId, {
        ...person,
        email: person.email.toUpperCase(),
        organizationId,
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
  it("vincula o contato e invalida versões antigas da organização", async () => {
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const c = await saveContact(
      db,
      actorId,
      { ...person, organizationId },
      contactId,
      1,
    );
    expect(c.organizationId).toBe(organizationId);
    await expect(
      saveOrganization(db, actorId, orgInput, org.id, org.version),
    ).rejects.toThrow("alterado por outro");
    await expect(
      saveContact(db, actorId, person, contactId, 1),
    ).rejects.toThrow("alterado");
  });
  it("cria tarefa vinculada ao contato e protege sua exclusão", async () => {
    const t = await saveTask(db, actorId, {
      ...activity,
      assigneeId: actorId,
      contactId,
    });
    taskId = t.id;
    await expect(
      deleteContact(db, actorId, contactId, 2),
    ).rejects.toMatchObject({ code: "P2003" });
    expect((await listTasks(db, { q: tag, status: "all" })).count).toBe(1);
  });
  it("edição embutida conserva ID e vínculos da tarefa", async () => {
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { contacts: true },
    });
    const c = org.contacts[0];
    await saveOrganization(
      db,
      actorId,
      {
        ...orgInput,
        contacts: [
          {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            position: "Diretoria",
          },
        ],
      },
      org.id,
      org.version,
    );
    expect(
      (await db.contact.findUniqueOrThrow({ where: { id: contactId } }))
        .position,
    ).toBe("Diretoria");
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: taskId } })).contactId,
    ).toBe(contactId);
  });
  it("remover da organização desvincula, sem apagar a pessoa", async () => {
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    await saveOrganization(db, actorId, orgInput, org.id, org.version);
    expect(
      (await db.contact.findUniqueOrThrow({ where: { id: contactId } }))
        .organizationId,
    ).toBeNull();
  });
  it("o alerta é individual e não muda situação ou prazo", async () => {
    const event = (await events()).events.find(
      (e) => e.title === activity.title,
    )!;
    await markEventRead(db, actorId, { key: event.key, day: event.day });
    expect((await events()).events.find((e) => e.key === event.key)?.read).toBe(
      true,
    );
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: taskId } })).status,
    ).toBe("PENDING");
    const other = await getCalendarEvents(
      db,
      new Date("2026-11-01Z"),
      new Date("2026-12-01Z"),
      "outro-usuario",
    );
    expect(other.events.find((e) => e.key === event.key)?.read).toBe(false);
  });
  it("novo prazo gera alerta não lido e conclusão elimina atraso", async () => {
    const t = await db.task.findUniqueOrThrow({ where: { id: taskId } });
    await saveTask(
      db,
      actorId,
      { ...activity, dueDate: "2026-11-29", status: "COMPLETED", contactId },
      taskId,
      t.version,
    );
    const e = (await events()).events.find((e) => e.title === activity.title)!;
    expect(e.read).toBe(false);
    expect(e.pending).toBe(false);
    expect(e.day).toBe("2026-11-29");
    await expect(
      saveTask(db, actorId, activity, taskId, t.version),
    ).rejects.toThrow("alterada");
  });
  it("sessão na madrugada UTC pertence ao dia anterior em Brasília", async () => {
    await db.opportunity.create({
      data: {
        reference: `${tag}-SESSAO`,
        subject: "Teste",
        organizationId,
        proposalDeadline: new Date("2026-12-01T02:30:00Z"),
      },
    });
    const e = (await events()).events.find((e) => e.title === `${tag}-SESSAO`)!;
    expect(e.day).toBe("2026-11-30");
    expect(e.time).toBe("23:30");
  });
  it("vigência acompanha prorrogação e ignora ato cancelado", async () => {
    const c = await db.contractCase.create({
      data: { reference: tag, organizationId, organizationSnapshot: {} },
    });
    caseId = c.id;
    const term = await db.contract.create({
      data: {
        caseId,
        organizationId,
        reference: tag,
        instrumentType: "TERM",
        validUntil: new Date("2026-10-31Z"),
        continuous: true,
        signatureDate: new Date("2026-01-01Z"),
        validFrom: new Date("2026-01-01Z"),
        amount: 0,
      },
    });
    contractId = term.id;
    await db.contractAmendment.create({
      data: {
        caseId,
        instrumentId: term.id,
        reference: "A1",
        date: new Date("2026-10-01Z"),
        type: "Prorrogação",
        kind: "EXTENSION",
        newEndDate: new Date("2026-11-30Z"),
      },
    });
    await db.contractAmendment.create({
      data: {
        caseId,
        instrumentId: term.id,
        reference: "A2",
        date: new Date("2026-10-02Z"),
        type: "Prorrogação",
        kind: "EXTENSION",
        newEndDate: new Date("2026-12-31Z"),
        cancelled: true,
      },
    });
    expect(
      (await events()).events.find(
        (e) => e.type === "CONTRACT" && e.title === tag,
      )?.day,
    ).toBe("2026-11-30");
  });
  it("renovação move o fim de vigência sem manter evento antigo", async () => {
    await db.contractAmendment.create({
      data: {
        caseId,
        instrumentId: contractId,
        reference: "REN",
        date: new Date("2026-11-01Z"),
        type: "Renovação",
        kind: "RENEWAL",
        newEndDate: new Date("2027-11-30Z"),
      },
    });
    expect(
      (await events()).events.some(
        (e) => e.type === "CONTRACT" && e.title === tag,
      ),
    ).toBe(false);
    const future = await getCalendarEvents(
      db,
      new Date("2027-11-01Z"),
      new Date("2027-12-01Z"),
      actorId,
    );
    expect(
      future.events.find((e) => e.type === "CONTRACT" && e.title === tag)?.day,
    ).toBe("2027-11-30");
  });
  it("pedido entregue não permanece pendente e dia inteiro não muda", async () => {
    const i = await db.contractItem.create({
      data: {
        caseId,
        number: 1,
        description: "Produto",
        unit: "UN",
        quantity: 2,
        unitPrice: 10,
      },
    });
    const o = await db.supplyOrder.create({
      data: {
        caseId,
        instrumentId: contractId,
        reference: tag,
        orderDate: new Date("2026-11-01Z"),
        deadline: new Date("2026-11-20Z"),
        items: {
          create: {
            contractItemId: i.id,
            requestedQuantity: 2,
            suppliedQuantity: 2,
          },
        },
      },
    });
    const e = (await events()).events.find((e) => e.key.includes(o.id))!;
    expect(e.day).toBe("2026-11-20");
    expect(e.pending).toBe(false);
  });
  it("protege exclusão por versão e audita a tarefa", async () => {
    const t = await db.task.findUniqueOrThrow({ where: { id: taskId } });
    await expect(deleteTask(db, actorId, taskId, 1)).rejects.toThrow(
      "alterada",
    );
    await deleteTask(db, actorId, taskId, t.version);
    expect(
      await db.auditLog.count({
        where: { entityId: taskId, action: "DELETE" },
      }),
    ).toBe(1);
  });
  it("exclusão da organização preserva contato independente", async () => {
    const c = await db.contact.findUniqueOrThrow({ where: { id: contactId } });
    await saveContact(
      db,
      actorId,
      { ...person, organizationId },
      c.id,
      c.version,
    );
    // The main organization has contracts; use another unreferenced organization.
    const other = await saveOrganization(db, actorId, {
      ...orgInput,
      legalName: `Outro ${tag}`,
    });
    const linked = await db.contact.findUniqueOrThrow({
      where: { id: contactId },
    });
    await saveContact(
      db,
      actorId,
      { ...person, organizationId: other.id },
      c.id,
      linked.version,
    );
    const latest = await db.organization.findUniqueOrThrow({
      where: { id: other.id },
    });
    await deleteOrganization(db, actorId, latest.id, latest.version);
    expect(
      (await db.contact.findUniqueOrThrow({ where: { id: contactId } }))
        .organizationId,
    ).toBeNull();
  });
});
