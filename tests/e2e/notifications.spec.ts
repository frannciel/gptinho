import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
import { synchronizeNotifications } from "../../src/server/notifications";
import { shiftDay } from "../../src/lib/notifications";
import { brazilDay } from "../../src/lib/agenda";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("E2E exige banco descartável.");
const db = createDb(url);
const tag = randomUUID().toUpperCase();
const email = `notifications-${tag.toLowerCase()}@example.org`;
const password = `E2e!${randomUUID()}`;
let actor: string;
let org: string;
let task: string;
let opp: string;
test.beforeAll(async () => {
  actor = (
    await db.user.create({
      data: {
        name: "Admin Notificações",
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    })
  ).id;
  org = (
    await db.organization.create({
      data: { legalName: tag, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
  task = (
    await db.task.create({
      data: {
        title: `Tarefa ${tag}`,
        dueDate: new Date(`${shiftDay(brazilDay(), -1)}T00:00:00Z`),
      },
    })
  ).id;
  opp = (
    await db.opportunity.create({
      data: {
        reference: tag,
        subject: "Sessão para aviso na barra superior",
        organizationId: org,
        proposalDeadline: new Date(Date.now() + 20000),
      },
    })
  ).id;
  await synchronizeNotifications(db, { force: true });
});
test.afterAll(async () => {
  await db.notification.deleteMany({ where: { recipientId: actor } });
  await db.notificationEvent.deleteMany({
    where: { key: { in: [`TASK:${task}`, `SESSION:${opp}`] } },
  });
  await db.notificationSyncState.deleteMany({ where: { id: "main" } });
  await db.task.deleteMany({ where: { id: task } });
  await db.opportunity.deleteMany({ where: { id: opp } });
  await db.organization.deleteMany({ where: { id: org } });
  await db.auditLog.deleteMany({ where: { actorId: actor } });
  await db.user.deleteMany({ where: { id: actor } });
  await db.$disconnect();
});
test("sino, leitura individual, alerta no início da sessão e central responsiva", async ({
  page,
  request,
}, info) => {
  test.setTimeout(45000);
  expect((await request.get("/api/admin/notificacoes")).status()).toBe(401);
  await page.goto("/notificacoes");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const pre = page.getByRole("alert").filter({ hasText: tag });
  await expect(pre).toContainText("Sessão pública próxima");
  await page.getByLabel(/^Notificações,/).click();
  const dropdown = page.getByRole("region", { name: "Últimas notificações" });
  await expect(dropdown).toContainText(`Tarefa ${tag}`);
  await dropdown
    .getByRole("button", { name: "Marcar todas como lidas", exact: true })
    .click();
  await expect(
    page.getByLabel("Notificações, 0 não lidas", { exact: true }),
  ).toBeVisible();
  expect(
    (await db.task.findUniqueOrThrow({ where: { id: task } })).status,
  ).toBe("PENDING");
  await page
    .getByRole("button", { name: "Fechar notificações", exact: true })
    .click();
  await pre.getByRole("button", { name: /Fechar alerta/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: tag })).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: tag })).toContainText(
    "Sessão pública iniciada",
    { timeout: 25000 },
  );
  await page
    .getByRole("alert")
    .filter({ hasText: tag })
    .getByRole("button", { name: /Fechar alerta/ })
    .click();
  await page.goto("/notificacoes");
  await expect(
    page.getByRole("heading", { name: "Central de notificações", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tipo", { exact: true }).selectOption("TASK");
  await page.getByLabel("Leitura", { exact: true }).selectOption("READ");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  const notice = page
    .getByRole("listitem")
    .filter({ hasText: `Tarefa ${tag}` });
  await expect(notice).toContainText("Lida");
  await notice
    .getByRole("button", { name: "Marcar como não lida", exact: true })
    .click();
  await expect(
    page.getByRole("listitem").filter({ hasText: `Tarefa ${tag}` }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Limpar", exact: true }).click();
  await expect(page.getByLabel("Leitura", { exact: true })).toHaveValue("ALL");
  await expect(
    page.getByRole("listitem").filter({ hasText: `Tarefa ${tag}` }),
  ).toContainText("Prazo vencido");
  await page.getByLabel(/^Notificações,/).click();
  await expect(
    page.getByRole("region", { name: "Últimas notificações" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("notificacoes-mobile.png"),
    fullPage: true,
  });
  expect(
    await db.notificationDelivery.count({
      where: {
        notification: { recipientId: actor },
        state: { not: "DISABLED" },
      },
    }),
  ).toBe(0);
});
