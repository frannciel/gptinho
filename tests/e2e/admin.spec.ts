import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error(
    "E2E exige DATABASE_URL de teste descartável com _test no nome.",
  );
const db = createDb(url);
const email = `e2e-${randomUUID()}@example.org`;
const secret = `E2e!${randomUUID()}`;
let userId: string;
test.beforeAll(async () => {
  const user = await db.user.create({
    data: {
      name: "Administrador E2E",
      email,
      passwordHash: await hashPassword(secret),
      role: "ADMIN",
    },
  });
  userId = user.id;
});
test.afterAll(async () => {
  if (userId) {
    await db.auditLog.deleteMany({ where: { actorId: userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
});
test("proteção, login, CRUD, configurações e logout", async ({
  page,
  request,
}, testInfo) => {
  const response = await request.get("/api/admin/organizacoes");
  expect(response.status()).toBe(401);
  for (const path of [
    "/dashboard",
    "/orgaos",
    "/fornecedores",
    "/configuracoes",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Órgãos públicos", exact: true })
    .click();
  await page.getByRole("link", { name: "Novo órgão", exact: true }).click();
  await page.getByLabel("Nome / razão social").fill("Órgão E2E");
  await page.getByLabel("CNPJ", { exact: true }).fill("11.222.333/0001-81");
  await page.getByLabel("Código UASG").fill("123456");
  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await page.locator("#contact-0-name").fill("Contato E2E");
  const pendingAction = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  const saveActionRequest = await pendingAction;
  await expect(page.getByRole("status")).toContainText("salvo");
  await expect(
    page.getByRole("link", { name: "Órgão E2E", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Buscar órgão").fill("Órgão E2E");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Órgão E2E", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Editar Órgão E2E", exact: true })
    .click();
  await page.getByLabel("Nome / razão social").fill("Órgão E2E Atualizado");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("link", { name: "Órgão E2E Atualizado", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir Órgão E2E Atualizado", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Órgão E2E Atualizado", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir Órgão E2E Atualizado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir definitivamente", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Órgão E2E Atualizado", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Fornecedores", exact: true }).click();
  await page
    .getByRole("link", { name: "Novo fornecedor", exact: true })
    .click();
  await page.getByLabel("Nome / razão social").fill("Fornecedor E2E");
  await page
    .getByLabel("Categorias de produtos e serviços")
    .fill("Licenças, Serviços");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("link", { name: "Fornecedor E2E", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir Fornecedor E2E", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir definitivamente", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Fornecedor E2E", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await page.getByLabel("Nome fantasia").fill("Govnex E2E");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByRole("status")).toContainText("salvas");
  await page.reload();
  await expect(page.getByLabel("Nome fantasia")).toHaveValue("Govnex E2E");
  const oldCookies = (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  await page.getByRole("button", { name: "Sair do sistema" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  const replay = await request.get("/api/admin/organizacoes", {
    headers: { cookie: oldCookies },
  });
  expect(replay.status()).toBe(401);
  const forged = await request.post("/orgaos/novo", {
    headers: {
      "next-action": saveActionRequest.headers()["next-action"],
      "Content-Type": saveActionRequest.headers()["content-type"],
      origin: "http://localhost:3000",
    },
    data: saveActionRequest.postData()!,
  });
  expect(await forged.text()).toContain("Sessão expirada");
  expect(
    await db.organization.count({ where: { legalName: "Órgão E2E" } }),
  ).toBe(0);
});
test("usuário sem perfil administrador é recusado no servidor", async ({
  page,
}) => {
  const readerEmail = `user-${randomUUID()}@example.org`;
  const user = await db.user.create({
    data: {
      name: "Sem permissão",
      email: readerEmail,
      passwordHash: await hashPassword(secret),
      role: "USER",
    },
  });
  try {
    await page.goto("/login");
    await page.getByLabel("E-mail corporativo").fill(readerEmail);
    await page.getByLabel("Senha", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
    await expect(page).toHaveURL(/\/acesso-negado$/);
    const response = await page.request.get("/api/admin/organizacoes");
    expect(response.status()).toBe(403);
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});

test("layout móvel e revogação de sessão no servidor", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.screenshot({
    path: testInfo.outputPath("login-mobile.png"),
    fullPage: true,
  });
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Abrir menu").click();
  await page
    .getByRole("navigation", { name: "Navegação móvel" })
    .getByRole("link", { name: "Fornecedores", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fornecedores", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegação móvel" }),
  ).not.toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("suppliers-mobile.png"),
    fullPage: true,
  });
  await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
  expect((await page.request.get("/api/admin/organizacoes")).status()).toBe(
    401,
  );
  await page.goto("/fornecedores");
  await expect(page).toHaveURL(/\/login$/);
});

test("login sem JavaScript nunca envia credenciais na URL", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: "http://localhost:3000",
  });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("E-mail corporativo").fill("nojs@example.org");
    await page.getByLabel("Senha", { exact: true }).fill(secret);
    const pending = page.waitForRequest((r) =>
      r.url().includes("/api/auth/callback/credentials"),
    );
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
    const submitted = await pending;
    expect(submitted.method()).toBe("POST");
    expect(new URL(submitted.url()).searchParams.has("password")).toBe(false);
    expect(page.url().includes(secret)).toBe(false);
  } finally {
    await context.close();
  }
});
