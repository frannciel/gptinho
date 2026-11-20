import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
import { deadlineInput } from "../../src/lib/opportunity-values";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error(
    "E2E de oportunidades exige banco descartável com _test no nome.",
  );
const db = createDb(url);
const suffix = randomUUID();
const email = `opp-e2e-${suffix}@example.org`;
const password = `Teste!${randomUUID()}`;
const reference = `OP-E2E-${suffix}`.toUpperCase();
let actorId: string;
let agencyId: string;
let supplierId: string;
let inactiveId: string;
test.beforeAll(async () => {
  actorId = (
    await db.user.create({
      data: {
        name: "Admin de Oportunidades",
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    })
  ).id;
  agencyId = (
    await db.organization.create({
      data: {
        legalName: `Órgão E2E ${suffix}`,
        acronym: "OE2E",
        roles: ["PUBLIC_AGENCY"],
      },
    })
  ).id;
  supplierId = (
    await db.organization.create({
      data: { legalName: `Somente Fornecedor ${suffix}`, roles: ["SUPPLIER"] },
    })
  ).id;
  inactiveId = (
    await db.organization.create({
      data: {
        legalName: `Órgão Inativo ${suffix}`,
        roles: ["PUBLIC_AGENCY"],
        active: false,
      },
    })
  ).id;
});
test.afterAll(async () => {
  try {
    await db.opportunity.deleteMany({
      where: {
        organizationId: {
          in: [agencyId, supplierId, inactiveId].filter(Boolean),
        },
      },
    });
    await db.organization.deleteMany({
      where: { id: { in: [agencyId, supplierId, inactiveId].filter(Boolean) } },
    });
    if (actorId) {
      await db.auditLog.deleteMany({ where: { actorId } });
      await db.user.delete({ where: { id: actorId } });
    }
  } finally {
    await db.$disconnect();
  }
});
test("oportunidades: cadastro, busca, prazo, edição, dashboard, arquivamento e proteção", async ({
  page,
  request,
}, testInfo) => {
  for (const path of ["/oportunidades", "/oportunidades/nova"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get("/api/admin/oportunidades")).status()).toBe(401);
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Oportunidades", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Oportunidades", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Nova oportunidade", exact: true })
    .click();
  await expect(
    page.locator(`#organizationId option[value="${supplierId}"]`),
  ).toHaveCount(0);
  await expect(
    page.locator(`#organizationId option[value="${inactiveId}"]`),
  ).toHaveCount(0);
  await page.getByLabel("Identificação").fill(reference);
  await page.getByLabel("Órgão público").selectOption(agencyId);
  await page
    .getByLabel("Objeto")
    .fill(
      "Aquisição de licenças de software de produtividade para o órgão E2E",
    );
  await page
    .getByLabel("Modalidade de contratação")
    .selectOption("ELECTRONIC_AUCTION");
  await page.getByLabel("Número do processo").fill("12345/2026");
  await page.getByLabel("Valor estimado (R$)").fill("12.500,50");
  const deadline = deadlineInput(new Date(Date.now() + 24 * 60 * 60 * 1000));
  await page
    .getByLabel("Prazo de apresentação", { exact: true })
    .fill(deadline);
  await page
    .getByLabel("Link da fonte / edital")
    .fill("https://example.org/edital");
  await page
    .getByLabel("Observações", { exact: true })
    .fill("Cadastro de teste E2E");
  const pendingAction = page.waitForRequest(
    (req) => req.method() === "POST" && !!req.headers()["next-action"],
  );
  await page
    .getByRole("button", { name: "Salvar oportunidade", exact: true })
    .click();
  const savedRequest = await pendingAction;
  await expect(
    page.getByRole("heading", { name: reference, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("salva");
  await expect(
    page.getByText("R$\u00a012.500,50", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Consultar fonte / edital" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  const op = await db.opportunity.findUniqueOrThrow({ where: { reference } });
  expect(op.estimatedValue!.toFixed(2)).toBe("12500.50");
  const api = await page.request.get(
    `/api/admin/oportunidades?q=${encodeURIComponent(reference)}`,
  );
  expect(api.status()).toBe(200);
  expect(api.headers()["cache-control"]).toBe("no-store");
  const body = await api.json();
  expect(body.items[0].id).toBe(op.id);
  expect(typeof body.items[0].estimatedValue).toBe("string");
  expect(
    (
      await page.request.get("/api/admin/oportunidades?status=INVALID")
    ).status(),
  ).toBe(400);
  await page.getByRole("link", { name: "Visão geral", exact: true }).click();
  await expect(
    page
      .getByRole("link", { name: /Oportunidades abertas/ })
      .getByText("1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Oportunidades", exact: true })
    .click();
  await page.getByLabel("Buscar oportunidade").fill(reference);
  await page.getByLabel("Prazo", { exact: true }).selectOption("next7days");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: reference, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("opportunities.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: `Editar ${reference}`, exact: true })
    .click();
  await expect(
    page.getByLabel("Prazo de apresentação", { exact: true }),
  ).toHaveValue(deadline);
  await expect(page.getByLabel("Valor estimado (R$)")).toHaveValue("12500,50");
  await page.getByLabel("Situação").selectOption("IN_ANALYSIS");
  await page
    .getByLabel("Prazo de apresentação", { exact: true })
    .fill("2020-01-01T12:00");
  await page
    .getByRole("button", { name: "Salvar oportunidade", exact: true })
    .click();
  await expect(
    page.getByText(/O prazo de apresentação desta oportunidade está vencido/),
  ).toBeVisible();
  await expect(page.getByText("Em análise", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  expect(
    (await db.opportunity.findUniqueOrThrow({ where: { id: op.id } })).archived,
  ).toBe(false);
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar arquivamento", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("arquivada");
  await expect(
    page.getByRole("link", { name: reference, exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Exibição").selectOption("archived");
  await page.getByLabel("Buscar oportunidade").fill(reference);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page.getByRole("link", { name: reference, exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Editar oportunidade", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/oportunidades/${op.id}/editar`);
  await expect(page).toHaveURL(new RegExp(`/oportunidades/${op.id}$`));
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar restauração", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("restaurada");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: reference, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: reference, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("opportunity-mobile.png"),
    fullPage: true,
  });
  const cookies = (await page.context().cookies())
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  await page.getByRole("button", { name: "Sair do sistema" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (
      await request.get("/api/admin/oportunidades", {
        headers: { cookie: cookies },
      })
    ).status(),
  ).toBe(401);
  const forged = await request.post("/oportunidades/nova", {
    headers: {
      "next-action": savedRequest.headers()["next-action"],
      "Content-Type": savedRequest.headers()["content-type"],
      origin: "http://localhost:3000",
    },
    data: savedRequest.postData()!,
  });
  expect(await forged.text()).toContain("Sessão expirada");
  expect(await db.opportunity.count({ where: { reference } })).toBe(1);
});
test("oportunidades recusam USER em páginas, API e acesso ao cadastro", async ({
  page,
}) => {
  const readerEmail = `reader-${suffix}@example.org`;
  const user = await db.user.create({
    data: {
      name: "Usuário sem permissão",
      email: readerEmail,
      passwordHash: await hashPassword(password),
      role: "USER",
    },
  });
  try {
    await page.goto("/login");
    await page.getByLabel("E-mail corporativo").fill(readerEmail);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
    await expect(page).toHaveURL(/\/acesso-negado$/);
    await page.goto("/oportunidades/nova");
    await expect(page).toHaveURL(/\/acesso-negado$/);
    expect((await page.request.get("/api/admin/oportunidades")).status()).toBe(
      403,
    );
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
