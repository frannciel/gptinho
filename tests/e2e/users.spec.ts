import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("E2E exige banco descartável.");
const db = createDb(url);
const tag = randomUUID();
let email = `user-admin-${tag}@example.org`;
let secret = `Seguro!${randomUUID()}`;
const targetEmail = `user-target-${tag}@example.org`;
const targetSecret = `Inicial!${randomUUID()}`;
let actorId: string;
let targetId: string;
async function login(page: Page, loginEmail = email, loginSecret = secret) {
  await page.goto("/login");
  await page.getByLabel("E-mail corporativo").fill(loginEmail);
  await page.getByLabel("Senha", { exact: true }).fill(loginSecret);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test.beforeAll(async () => {
  actorId = (
    await db.user.create({
      data: {
        name: `Administrador ${tag}`,
        email,
        passwordHash: await hashPassword(secret),
        role: "ADMIN",
      },
    })
  ).id;
});
test.afterAll(async () => {
  await db.auditLog.deleteMany({
    where: { actorId: { in: [actorId, targetId].filter(Boolean) } },
  });
  await db.user.deleteMany({
    where: { id: { in: [actorId, targetId].filter(Boolean) } },
  });
  await db.$disconnect();
});
test("usuários: cadastro, edição, busca, duplicidade e revogação ao desativar", async ({
  page,
  browser,
}) => {
  for (const path of [
    "/usuarios",
    "/usuarios/novo",
    "/meu-perfil",
    "/trocar-senha",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await login(page);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByLabel("Administração", { exact: true }).click();
  await nav.getByRole("link", { name: "Usuários", exact: true }).click();
  await page.getByRole("link", { name: "Novo usuário", exact: true }).click();
  await page
    .getByLabel("Nome completo *", { exact: true })
    .fill(`Pessoa ${tag}`);
  await page.getByLabel("E-mail *", { exact: true }).fill(targetEmail);
  await page.getByLabel("Senha inicial *", { exact: true }).fill(targetSecret);
  await page
    .getByLabel("Confirmar senha inicial *", { exact: true })
    .fill(targetSecret);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("salvo");
  const user = await db.user.findUniqueOrThrow({
    where: { email: targetEmail },
  });
  targetId = user.id;
  expect(user.role).toBe("ADMIN");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  try {
    await login(otherPage, targetEmail, targetSecret);
    await page.getByLabel("Buscar usuário", { exact: true }).fill(tag);
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await page
      .getByRole("link", { name: `Editar Pessoa ${tag}`, exact: true })
      .click();
    await page
      .getByLabel("Nome completo *", { exact: true })
      .fill(`Editado ${tag}`);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("salvo");
    const row = page.getByRole("row").filter({ hasText: targetEmail });
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Usuário desativado" }),
    ).toBeVisible();
    await otherPage.goto("/meu-perfil");
    await expect(otherPage).toHaveURL(/\/login$/);
    await row.getByRole("button", { name: "Ativar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Usuário ativado" }),
    ).toBeVisible();
    await otherPage.goto("/dashboard");
    await expect(otherPage).toHaveURL(/\/login$/);
    await login(otherPage, targetEmail, targetSecret);
    await page.getByRole("link", { name: "Novo usuário", exact: true }).click();
    await page.getByLabel("Nome completo *", { exact: true }).fill("Duplicado");
    await page
      .getByLabel("E-mail *", { exact: true })
      .fill(targetEmail.toUpperCase());
    await page
      .getByLabel("Senha inicial *", { exact: true })
      .fill(targetSecret);
    await page
      .getByLabel("Confirmar senha inicial *", { exact: true })
      .fill(targetSecret);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "já está cadastrado" }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});
test("agenda operacional mantém três telas e funciona no menu móvel", async ({
  page,
}, info) => {
  await login(page);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByLabel("Agenda operacional", { exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "Calendário", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Tarefas", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Notificações", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Calendário", exact: true }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await nav.getByRole("link", { name: "Tarefas", exact: true }).click();
  await expect(page).toHaveURL(/\/tarefas$/);
  await nav.getByRole("link", { name: "Notificações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Central de notificações", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByLabel("Abrir menu", { exact: true }).click();
  const mobile = page.getByRole("navigation", { name: "Navegação móvel" });
  await mobile.getByLabel("Agenda operacional", { exact: true }).click();
  await mobile.getByRole("link", { name: "Calendário", exact: true }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(page.locator("[data-mobile-navigation]")).toHaveJSProperty(
    "open",
    false,
  );
  await page.getByLabel("Abrir menu", { exact: true }).click();
  await mobile.getByLabel("Administração", { exact: true }).click();
  await mobile.getByRole("link", { name: "Usuários", exact: true }).click();
  await expect(page.locator("[data-mobile-navigation]")).toHaveJSProperty(
    "open",
    false,
  );
  await expect(page.getByLabel(/^Notificações,/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("usuarios-mobile.png"),
    fullPage: true,
  });
});
test("meu perfil e troca de senha exigem novo login quando necessário", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Meu perfil", exact: true })
    .click();
  await page
    .getByLabel("Nome completo *", { exact: true })
    .fill(`Nome atualizado ${tag}`);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Perfil atualizado");
  await expect(page.getByRole("banner")).toContainText(
    `Nome atualizado ${tag}`,
  );
  const nextEmail = `changed-${tag}@example.org`;
  await page.getByLabel("E-mail *", { exact: true }).fill(nextEmail);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?notice=profile-updated$/);
  email = nextEmail;
  await login(page);
  await page.goto("/trocar-senha");
  const nextSecret = `Alterada!${randomUUID()}`;
  await page
    .getByLabel("Senha atual *", { exact: true })
    .fill("Errada!Senha123");
  await page.getByLabel("Nova senha *", { exact: true }).fill(nextSecret);
  await page
    .getByLabel("Confirmar nova senha *", { exact: true })
    .fill(nextSecret);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "senha atual está incorreta" }),
  ).toBeVisible();
  await page.getByLabel("Senha atual *", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?notice=password-changed$/);
  await expect(page.getByRole("status")).toContainText("Senha alterada");
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível entrar" }),
  ).toBeVisible();
  secret = nextSecret;
  await login(page);
});

test("mensagens de confirmação ignoram chaves de protótipo nas URLs", async ({
  page,
}) => {
  const response = await page.goto("/login?notice=__proto__");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo à Govnex", exact: true }),
  ).toBeVisible();
  await login(page);
  await page.goto("/usuarios?notice=__proto__");
  await expect(
    page.getByRole("heading", { name: "Usuários", exact: true }),
  ).toBeVisible();
});
