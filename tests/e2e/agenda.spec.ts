import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("E2E exige banco descartável _test.");
const db = createDb(url);
const tag = randomUUID();
const email = `agenda-${tag}@example.org`;
const password = `E2e!${randomUUID()}`;
let actorId: string;
let orgId: string;
test.beforeAll(async () => {
  actorId = (
    await db.user.create({
      data: {
        name: `Admin ${tag}`,
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    })
  ).id;
  orgId = (
    await db.organization.create({
      data: { legalName: `Órgão Agenda ${tag}`, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
});
test.afterAll(async () => {
  await db.task.deleteMany({ where: { title: { contains: tag } } });
  await db.contact.deleteMany({
    where: { email: `pessoa-${tag}@example.org` },
  });
  await db.organization.deleteMany({ where: { id: orgId } });
  await db.eventRead.deleteMany({ where: { actorId } });
  await db.auditLog.deleteMany({ where: { actorId } });
  await db.user.deleteMany({ where: { id: actorId } });
  await db.$disconnect();
});
test("contato independente, vínculo, tarefa, alerta e calendário responsivo", async ({
  page,
  request,
}, info) => {
  for (const path of ["/contatos", "/tarefas", "/calendario"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect(
    (await request.get("/api/admin/agenda/busca?kind=contact")).status(),
  ).toBe(401);
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/contatos/novo");
  await page.getByLabel("Nome", { exact: false }).first().fill(`Pessoa ${tag}`);
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(`pessoa-${tag}@example.org`);
  await page.getByLabel("Telefone", { exact: true }).fill("61999991234");
  await expect(page.getByLabel("Telefone", { exact: true })).toHaveValue(
    "(61) 99999-1234",
  );
  await page.getByLabel("WhatsApp do telefone 1", { exact: true }).check();
  await page
    .getByRole("button", { name: "Adicionar telefone", exact: true })
    .click();
  await page.getByLabel("Telefone 2", { exact: true }).fill("6133334444");
  await page
    .getByLabel("Observações", { exact: true })
    .fill("Falar com o setor de compras");
  await page
    .getByLabel("Perfil no LinkedIn", { exact: true })
    .fill("https://www.linkedin.com/in/pessoa");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("salvo");
  await expect(
    page.getByRole("row").filter({ hasText: `Pessoa ${tag}` }),
  ).toContainText("Sem organização");
  await page
    .getByRole("link", { name: `Editar Pessoa ${tag}`, exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Organização (opcional)" })
    .fill(tag);
  await page
    .getByRole("option", { name: `Órgão Agenda ${tag}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("salvo");
  await expect(
    page.getByRole("row").filter({ hasText: `Pessoa ${tag}` }),
  ).toContainText(`Órgão Agenda ${tag}`);
  const contactRow = page.getByRole("row").filter({ hasText: `Pessoa ${tag}` });
  await expect(contactRow).toContainText("(61) 3333-4444");
  await expect(
    contactRow.getByRole("link", {
      name: `WhatsApp de Pessoa ${tag}`,
      exact: false,
    }),
  ).toHaveAttribute("href", "https://wa.me/5561999991234");
  await page.goto("/tarefas/nova");
  await page.getByLabel("Título", { exact: false }).fill(`Compromisso ${tag}`);
  await page.getByLabel("Data / prazo", { exact: false }).fill("2026-11-20");
  await page.getByRole("combobox", { name: "Contato (opcional)" }).fill(tag);
  await page
    .getByRole("option", { name: `Pessoa ${tag}`, exact: false })
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("salva");
  await expect(
    page.getByRole("row").filter({ hasText: `Compromisso ${tag}` }),
  ).toContainText("Atrasada");
  await page.goto("/calendario?month=2026-11&view=list&type=TASK");
  await page
    .getByRole("group", { name: "Visualização do calendário" })
    .getByRole("link", { name: "Mensal", exact: true })
    .click();
  await expect(page).toHaveURL(/view=month/);
  await page
    .getByRole("group", { name: "Visualização do calendário" })
    .getByRole("link", { name: "Lista", exact: true })
    .click();
  await expect(page).toHaveURL(/view=list/);
  await page.getByRole("link", { name: "Limpar", exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  const item = page
    .getByRole("listitem")
    .filter({ hasText: `Compromisso ${tag}` });
  await expect(item).toContainText("Prazo vencido");
  await item.getByRole("button", { name: "Marcar como lido" }).click();
  await expect(item).toContainText("Alerta lido");
  const t = await db.task.findFirstOrThrow({
    where: { title: `Compromisso ${tag}` },
  });
  expect(t.status).toBe("PENDING");
  await item.getByRole("link").click();
  await page.getByLabel("Situação", { exact: true }).selectOption("COMPLETED");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("salva");
  await page.goto("/calendario?month=2026-11&view=month&type=TASK");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Calendário", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: `Compromisso ${tag}` })
      .filter({ visible: true }),
  ).not.toContainText("Prazo vencido");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("calendario-mobile.png"),
    fullPage: true,
  });
  await page.goto(`/tarefas/${t.id}/editar`);
  await page.getByRole("link", { name: "Cancelar", exact: true }).click();
  await page.goto("/tarefas?status=all");
  const row = page.getByRole("row").filter({ hasText: `Compromisso ${tag}` });
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("excluída");
});

test("órgão público permite registrar endereço sem alterar telefones adicionais do contato", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/orgaos/${orgId}/editar`);
  await page.getByLabel("CEP", { exact: true }).fill("70040900");
  await page.getByLabel("Cidade", { exact: true }).fill("Brasília");
  await page.getByLabel("Estado (UF)", { exact: true }).selectOption("DF");
  await page
    .getByLabel("Endereço", { exact: true })
    .fill("Praça dos Três Poderes");
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("salvo");
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: { contacts: true },
  });
  expect(org).toMatchObject({
    postalCode: "70040900",
    city: "Brasília",
    state: "DF",
    address: "Praça dos Três Poderes",
  });
  expect(org.contacts[0].phones).toEqual([
    { number: "61999991234", whatsapp: true },
    { number: "6133334444", whatsapp: false },
  ]);
});
