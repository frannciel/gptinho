import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createDb } from "@/lib/db-client";
import {
  savePriceRegistration,
  deletePriceRegistration,
  changeParticipant,
} from "@/server/price-registrations";
import { deleteOpportunity, saveOpportunity } from "@/server/opportunities";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Exige banco descartável _test.");
const db = createDb(url);
const tag = randomUUID().toUpperCase();
let actor: string;
let org: string;
let other: string;
let opp: string;
let item: string;
let registration: string;
const input = {
  reference: "ATA-001",
  signatureDate: "2026-11-25",
  validUntil: "2027-11-25",
  allowsAdhesion: true,
  documentUrl: "https://example.org/ata",
  notes: "Ata teste",
  itemIds: [] as string[],
};
const version = async () =>
  (await db.opportunity.findUniqueOrThrow({ where: { id: opp } })).version;
beforeAll(async () => {
  actor = (
    await db.user.create({
      data: {
        name: tag,
        email: `${tag.toLowerCase()}@example.org`,
        passwordHash: "unused",
        role: "ADMIN",
      },
    })
  ).id;
  org = (
    await db.organization.create({
      data: { legalName: tag, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
  other = (
    await db.organization.create({
      data: { legalName: `Participante ${tag}`, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
  const o = await db.opportunity.create({
    data: {
      reference: tag,
      subject: "Compra para registro de preços",
      organizationId: org,
      isSrp: true,
      estimatedValue: "61.73",
      items: {
        create: {
          number: 1,
          description: "Produto original",
          unit: "UN",
          quantity: "5",
          unitPrice: "12.3456",
          total: "61.73",
          winner: true,
          winningUnitPrice: "10.1234",
        },
      },
    },
    include: { items: true },
  });
  opp = o.id;
  item = o.items[0].id;
  input.itemIds = [item];
});
afterAll(async () => {
  await db.$transaction(async (tx) => {
    await tx.priceRegistration.deleteMany({ where: { opportunityId: opp } });
    await tx.opportunityParticipant.deleteMany({
      where: { opportunityId: opp },
    });
    await tx.opportunityItem.deleteMany({ where: { opportunityId: opp } });
    await tx.opportunity.deleteMany({ where: { id: opp } });
    await tx.organization.deleteMany({ where: { id: { in: [org, other] } } });
    await tx.auditLog.deleteMany({ where: { actorId: actor } });
    await tx.user.deleteMany({ where: { id: actor } });
  });
  await db.$disconnect();
});
describe.sequential("SRP: atas e participantes em PostgreSQL", () => {
  it("exige indicador SRP antes de registrar atas e participantes", async () => {
    await db.opportunity.update({ where: { id: opp }, data: { isSrp: false } });
    await expect(
      changeParticipant(db, actor, opp, await version(), other, false),
    ).rejects.toThrow("Marque Registro");
    await expect(
      savePriceRegistration(db, actor, opp, await version(), input),
    ).rejects.toThrow("Marque Registro");
    await db.opportunity.update({ where: { id: opp }, data: { isSrp: true } });
  });
  it("rejeita gerenciador como participante e aceita outro órgão", async () => {
    await expect(
      changeParticipant(db, actor, opp, await version(), org, false),
    ).rejects.toThrow("gerenciador");
    await changeParticipant(db, actor, opp, await version(), other, false);
    await expect(
      changeParticipant(db, actor, opp, await version(), other, false),
    ).rejects.toThrow("já participa");
  });
  it("protege o indicador SRP e a distinção entre participante e gerenciador ao editar a contratação", async () => {
    const fields = {
      reference: tag,
      organizationId: org,
      isSrp: true,
      subject: "Registro de preços para teste",
      procurementMethod: "UNDEFINED",
      processNumber: "",
      proposalDeadline: "",
      platformUrl: "",
      attachmentsUrl: "",
      notes: "",
      items: [
        {
          id: item,
          number: "1",
          description: "Produto original",
          unit: "UN",
          quantity: "5",
          unitPrice: "12.3456",
        },
      ],
    };
    await expect(
      saveOpportunity(
        db,
        actor,
        { ...fields, isSrp: false },
        opp,
        await version(),
      ),
    ).rejects.toThrow("desmarcar");
    await expect(
      saveOpportunity(
        db,
        actor,
        { ...fields, organizationId: other },
        opp,
        await version(),
      ),
    ).rejects.toThrow("gerenciador");
  });
  it("cria ata com cópia decimal exata e preço vencedor", async () => {
    const r = await savePriceRegistration(
      db,
      actor,
      opp,
      await version(),
      input,
    );
    registration = r.id;
    expect(r.items[0].unitPrice.toFixed(4)).toBe("10.1234");
    expect(r.items[0].quantity.toString()).toBe("5");
    expect(r.items[0].description).toBe("Produto original");
  });
  it("preserva cópia e ID do vínculo ao editar os dados da ata", async () => {
    const old = await db.priceRegistrationItem.findFirstOrThrow({
      where: { registrationId: registration },
    });
    await db.opportunityItem.update({
      where: { id: item },
      data: {
        description: "Descrição alterada depois",
        winningUnitPrice: "20.1234",
      },
    });
    const r = await savePriceRegistration(
      db,
      actor,
      opp,
      await version(),
      { ...input, notes: "Atualizada" },
      registration,
    );
    expect(r.items[0].description).toBe("Produto original");
    expect(r.items[0].unitPrice.toFixed(4)).toBe("10.1234");
    expect(r.items[0].id).toBe(old.id);
  });
  it("rejeita datas invertidas, itens estranhos e repetidos", async () => {
    await expect(
      savePriceRegistration(db, actor, opp, await version(), {
        ...input,
        validUntil: "2020-01-01",
      }),
    ).rejects.toThrow();
    await expect(
      savePriceRegistration(db, actor, opp, await version(), {
        ...input,
        reference: "INVALID-ITEM",
        itemIds: [org],
      }),
    ).rejects.toThrow("apenas itens");
    await expect(
      savePriceRegistration(db, actor, opp, await version(), {
        ...input,
        itemIds: [item, item],
      }),
    ).rejects.toThrow("repetido");
  });
  it("permite várias atas e rejeita números duplicados na mesma contratação", async () => {
    await expect(
      savePriceRegistration(db, actor, opp, await version(), input),
    ).rejects.toThrow("Número de ata já cadastrado");
    await savePriceRegistration(db, actor, opp, await version(), {
      ...input,
      reference: "ATA-002",
    });
    expect(
      await db.priceRegistration.count({ where: { opportunityId: opp } }),
    ).toBe(2);
  });
  it("protege contra edição desatualizada e arquivamento", async () => {
    await expect(
      savePriceRegistration(db, actor, opp, 1, input, registration),
    ).rejects.toThrow("alterada");
    await db.opportunity.update({
      where: { id: opp },
      data: { archived: true },
    });
    await expect(
      changeParticipant(db, actor, opp, await version(), other, true),
    ).rejects.toThrow("Restaure");
    await db.opportunity.update({
      where: { id: opp },
      data: { archived: false },
    });
  });
  it("bloqueia exclusão da contratação enquanto existirem vínculos SRP", async () => {
    await expect(
      deleteOpportunity(db, actor, opp, await version()),
    ).rejects.toThrow("atas e os participantes");
    await expect(
      db.opportunityItem.delete({ where: { id: item } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
  it("remove ata e participante com auditoria", async () => {
    await deletePriceRegistration(
      db,
      actor,
      opp,
      await version(),
      registration,
    );
    await changeParticipant(db, actor, opp, await version(), other, true);
    expect(
      await db.auditLog.count({
        where: {
          entity: "PriceRegistration",
          entityId: registration,
          action: "DELETE",
        },
      }),
    ).toBe(1);
  });
});
