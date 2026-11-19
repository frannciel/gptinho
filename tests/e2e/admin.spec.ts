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
  const cnpj = page.getByLabel("CNPJ", { exact: true });
  await cnpj.fill("11222333000181");
  await expect(cnpj).toHaveValue("11.222.333/0001-81");
  await cnpj.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(3, 3),
  );
  await cnpj.press("Backspace");
  await expect(cnpj).toHaveValue("12.223.330/0018-1");
  await cnpj.fill("11222333000181");
  await cnpj.evaluate((input: HTMLInputElement) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    nativeSetter.call(input, input.value.slice(0, 2) + input.value.slice(3));
    input.setSelectionRange(2, 2);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "deleteContentBackward",
      }),
    );
  });
  await expect(cnpj).toHaveValue("12.223.330/0018-1");
  await cnpj.fill("11222333000181");
  await page.getByLabel("Telefone", { exact: true }).fill("11988887777");
  await expect(page.getByLabel("Telefone", { exact: true })).toHaveValue(
    "(11) 98888-7777",
  );
  await page.getByLabel("Código UASG").fill("123456");
  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await page.locator("#contact-0-name").fill("Contato E2E");
  await page.locator("#contact-0-phone").fill("1133334444");
  await expect(page.locator("#contact-0-phone")).toHaveValue("(11) 3333-4444");
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
  await expect(page.getByLabel("CNPJ", { exact: true })).toHaveValue(
    "11.222.333/0001-81",
  );
  await expect(page.locator("#phone")).toHaveValue("(11) 98888-7777");
  await expect(page.locator("#contact-0-phone")).toHaveValue("(11) 3333-4444");
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
  await expect(page.getByLabel("Código UASG")).toHaveCount(0);
  await page.getByLabel("Nome / razão social").fill("Fornecedor E2E");
  await page
    .getByLabel("Endereço", { exact: true })
    .fill("Rua Fornecedor, 100, Centro");
  await page.getByLabel("CEP", { exact: true }).fill("01310100");
  await expect(page.getByLabel("CEP", { exact: true })).toHaveValue(
    "01310-100",
  );
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo");
  await page.getByLabel("Estado (UF)").selectOption("SP");
  await page
    .getByLabel("Categorias de produtos e serviços")
    .fill("Licenças, Serviços");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("link", { name: "Fornecedor E2E", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Editar Fornecedor E2E", exact: true })
    .click();
  await expect(page.getByLabel("Código UASG")).toHaveCount(0);
  await expect(page.getByLabel("CEP", { exact: true })).toHaveValue(
    "01310-100",
  );
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "São Paulo",
  );
  await expect(page.getByLabel("Estado (UF)")).toHaveValue("SP");
  await page
    .getByLabel("Endereço", { exact: true })
    .fill("Rua Fornecedor Atualizada, 200");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("status")).toContainText("salvo");
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
  await page.getByLabel("CNPJ", { exact: true }).fill("11222333000181");
  await page.getByLabel("Telefone", { exact: true }).fill("1133334444");
  await expect(page.getByLabel("CNPJ", { exact: true })).toHaveValue(
    "11.222.333/0001-81",
  );
  await expect(page.getByLabel("Telefone", { exact: true })).toHaveValue(
    "(11) 3333-4444",
  );
  await page
    .getByLabel("Endereço", { exact: true })
    .fill("Avenida Govnex, 1000, Sala 1");
  await page.getByLabel("CEP", { exact: true }).fill("70000000");
  await page.getByLabel("Cidade", { exact: true }).fill("Brasília");
  await page.getByLabel("Estado (UF)").selectOption("DF");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByRole("status")).toContainText("salvas");
  await page.reload();
  await expect(page.getByLabel("Nome fantasia")).toHaveValue("Govnex E2E");
  await expect(page.getByLabel("CEP", { exact: true })).toHaveValue(
    "70000-000",
  );
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "Brasília",
  );
  await expect(page.getByLabel("Estado (UF)")).toHaveValue("DF");
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue(
    "Avenida Govnex, 1000, Sala 1",
  );
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

test("e-mail de contato único com mensagem correta e edição sem falso duplicado", async ({
  page,
}) => {
  const suffix = randomUUID();
  const firstName = `Contato Único Primeiro ${suffix}`;
  const secondName = `Contato Único Segundo ${suffix}`;
  const contactEmail = `contato-${suffix}@example.org`;
  try {
    await page.goto("/login");
    await page.getByLabel("E-mail corporativo").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/fornecedores/novo");
    await page.getByLabel("Nome / razão social").fill(firstName);
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("#contact-0-name").fill("Pessoa Única");
    await page.locator("#contact-0-email").fill(contactEmail);
    await page.getByRole("button", { name: "Salvar cadastro" }).click();
    await expect(page.getByRole("status")).toContainText("salvo");
    await page.goto("/fornecedores/novo");
    await page.getByLabel("Nome / razão social").fill(secondName);
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("#contact-0-name").fill("Pessoa Repetida");
    await page.locator("#contact-0-email").fill(contactEmail.toUpperCase());
    await page.getByRole("button", { name: "Salvar cadastro" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Já existe uma pessoa de contato" }),
    ).toContainText("pessoa de contato cadastrada com este e-mail");
    await expect(page.getByLabel("Nome / razão social")).toHaveValue(
      secondName,
    );
    await page.locator("#contact-0-email").fill(`outro-${contactEmail}`);
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page
      .locator("#contact-1-name")
      .fill("Contato Repetido no Formulário");
    await page
      .locator("#contact-1-email")
      .fill(`OUTRO-${contactEmail}`.toUpperCase());
    await page.getByRole("button", { name: "Salvar cadastro" }).click();
    await expect(page.locator("#contact-1-email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator("#contact-1-email-error")).toContainText(
      "outro contato",
    );
    const first = await db.organization.findFirstOrThrow({
      where: { legalName: firstName },
    });
    await page.goto(`/fornecedores/${first.id}/editar`);
    await expect(page.locator("#contact-0-email")).toHaveValue(contactEmail);
    await page.getByRole("button", { name: "Salvar cadastro" }).click();
    await expect(page.getByRole("status")).toContainText("salvo");
  } finally {
    await db.organization.deleteMany({
      where: { legalName: { in: [firstName, secondName] } },
    });
  }
});
