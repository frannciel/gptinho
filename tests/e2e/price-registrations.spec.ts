import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("E2E exige banco descartável.");
const db = createDb(url);
const tag = randomUUID().toUpperCase();
const email = `srp-${tag.toLowerCase()}@example.org`;
const password = `E2e!${randomUUID()}`;
let actor: string;
let org: string;
let participant: string;
let opp: string;
test.beforeAll(async () => {
  actor = (
    await db.user.create({
      data: {
        name: "Admin SRP",
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    })
  ).id;
  org = (
    await db.organization.create({
      data: { legalName: `Gerenciador ${tag}`, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
  participant = (
    await db.organization.create({
      data: { legalName: `Participante ${tag}`, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
  opp = (
    await db.opportunity.create({
      data: {
        reference: tag,
        organizationId: org,
        subject: "Aquisição de produtos para registro de preços",
        estimatedValue: "100.00",
        items: {
          create: {
            number: 1,
            description: "Produto para ata",
            unit: "UN",
            quantity: 10,
            unitPrice: 10,
            total: 100,
          },
        },
      },
    })
  ).id;
});
test.afterAll(async () => {
  await db.$transaction(async (tx) => {
    await tx.priceRegistration.deleteMany({ where: { opportunityId: opp } });
    await tx.opportunityParticipant.deleteMany({
      where: { opportunityId: opp },
    });
    await tx.opportunityItem.deleteMany({ where: { opportunityId: opp } });
    await tx.opportunity.deleteMany({ where: { id: opp } });
    await tx.organization.deleteMany({
      where: { id: { in: [org, participant] } },
    });
    await tx.auditLog.deleteMany({ where: { actorId: actor } });
    await tx.user.deleteMany({ where: { id: actor } });
  });
  await db.$disconnect();
});
test("SRP: indicador, participantes e cadastro/edição/exclusão da ata", async ({
  page,
}) => {
  await page.goto(`/contratacoes/${opp}/registros-precos`);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/contratacoes/${opp}/editar`);
  await page.getByLabel("Registro de Preços (SRP)", { exact: true }).check();
  await page
    .getByRole("button", { name: "Salvar contratação", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/contratacoes/${opp}\\?notice=saved`),
  );
  await page.getByRole("link", { name: "Participantes", exact: true }).click();
  await page.getByRole("combobox", { name: "Órgão participante *" }).fill(tag);
  await page
    .getByRole("option", { name: `Participante ${tag}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remover participante", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Registros de preços", exact: true })
    .click();
  const form = page
    .locator("form")
    .filter({ has: page.getByLabel("Número da ata *", { exact: true }) });
  await form.getByLabel("Número da ata *", { exact: true }).fill("ARP-01");
  await form
    .getByLabel("Data de assinatura *", { exact: true })
    .fill("2026-11-25");
  await form
    .getByLabel("Data de validade *", { exact: true })
    .fill("2027-11-25");
  await form.getByLabel("Permite Adesão", { exact: true }).check();
  await form.getByRole("checkbox", { name: /Item 1/ }).check();
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ata ARP-01", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "R$ 10,0000", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Disponível", exact: true }),
  ).toBeVisible();
  await page.getByText("Editar ata ARP-01", { exact: true }).click();
  const edit = page.locator("details").locator("form");
  await edit
    .getByLabel("Observações", { exact: true })
    .fill("Observação atualizada");
  await edit.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Observação atualizada", { exact: true }).first(),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir ata", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ata ARP-01", exact: true }),
  ).toHaveCount(0);
});
