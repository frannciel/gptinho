import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
import { deadlineInput } from "../../src/lib/opportunity-values";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error(
    "E2E de contratações exige banco descartável com _test no nome.",
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
        name: "Admin de Contratações",
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
    await db.$transaction(async (tx) => {
      await tx.opportunityItem.deleteMany({
        where: {
          opportunityId: {
            in: (
              await tx.opportunity.findMany({
                where: {
                  organizationId: {
                    in: [agencyId, supplierId, inactiveId].filter(Boolean),
                  },
                },
                select: { id: true },
              })
            ).map((row) => row.id),
          },
        },
      });
      await tx.opportunity.deleteMany({
        where: {
          organizationId: {
            in: [agencyId, supplierId, inactiveId].filter(Boolean),
          },
        },
      });
    });
    await db.catalogProduct.deleteMany({ where: { supplierId } });
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
test("contratações: cadastro, busca, prazo, edição, dashboard, arquivamento e proteção", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60000);
  for (const path of ["/contratacoes", "/contratacoes/nova"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get("/api/admin/contratacoes")).status()).toBe(401);
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Contratações", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Contratações", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Nova contratação", exact: true })
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
  await expect(
    page.getByRole("button", { name: "Adicionar item", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Situação").locator("option")).toHaveText([
    "Cancelada",
    "Suspensa",
    "Homologada",
    "Proposta Cadastrada",
    "Encerrada",
  ]);
  const help = page.getByRole("button", {
    name: "Ajuda sobre o prazo de apresentação",
  });
  await help.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "data e hora da sessão pública",
  );
  await help.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const deadline = deadlineInput(new Date(Date.now() + 24 * 60 * 60 * 1000));
  await page
    .getByLabel("Prazo de apresentação", { exact: true })
    .fill(deadline);
  await page
    .getByLabel("Link da plataforma de licitação")
    .fill("https://example.org/plataforma");
  await page
    .getByLabel("Pasta na nuvem (anexos da licitação)")
    .fill("https://example.org/anexos");
  await page
    .getByLabel("Observações", { exact: true })
    .fill("Cadastro de teste E2E");
  const pendingAction = page.waitForRequest(
    (req) => req.method() === "POST" && !!req.headers()["next-action"],
  );
  await page
    .getByRole("button", { name: "Salvar contratação", exact: true })
    .click();
  const savedRequest = await pendingAction;
  await expect(
    page.getByRole("heading", { name: reference, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("salva");
  await page
    .getByRole("link", { name: "Gerenciar itens", exact: true })
    .click();
  await page.getByRole("link", { name: "Abrir catálogo", exact: true }).click();
  await page
    .getByLabel("Descrição", { exact: false })
    .fill("Licenças catálogo E2E");
  await page.getByLabel("Marca", { exact: true }).fill("Marca E2E");
  await page.getByLabel("Modelo", { exact: true }).fill("Modelo E2E");
  await page.getByLabel("Margem (%)", { exact: false }).fill("15,50");
  await page
    .getByLabel("Custo Administrativo (%)", { exact: false })
    .fill("4,25");
  await page
    .getByLabel("Fornecedor", { exact: false })
    .selectOption(supplierId);
  await page
    .getByRole("button", { name: "Salvar item do catálogo", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Item salvo" }),
  ).toBeVisible();
  const product = await db.catalogProduct.findFirstOrThrow({
    where: { supplierId },
  });
  const created = await db.opportunity.findUniqueOrThrow({
    where: { reference },
  });
  await page.goto(`/contratacoes/${created.id}/itens`);
  await page
    .getByLabel("Item do catálogo", { exact: false })
    .selectOption(product.id);
  await expect(page.getByLabel("Marca", { exact: true })).toHaveValue(
    "Marca E2E",
  );
  await expect(page.getByLabel("Margem (%)", { exact: false })).toHaveValue(
    "15.50",
  );
  await page.getByLabel("Quantidade", { exact: false }).fill("2");
  await page
    .getByLabel("Valor unitário estimado (R$)", { exact: true })
    .fill("100,1250");
  await page
    .getByRole("button", { name: "Salvar item da contratação", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Item salvo" }),
  ).toBeVisible();
  await page
    .getByLabel("Item do catálogo", { exact: false })
    .selectOption(product.id);
  await page
    .getByLabel("Descrição", { exact: false })
    .fill("Serviço de implantação");
  await page.getByLabel("Quantidade", { exact: false }).fill("1,5");
  await page
    .getByLabel("Valor unitário estimado (R$)", { exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "Salvar item da contratação", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Item salvo" }),
  ).toBeVisible();
  await expect(page.getByText(/Valor estimado:/)).toContainText("215,25");
  const firstItem = await db.opportunityItem.findFirstOrThrow({
    where: { opportunityId: created.id, number: 1 },
  });
  await page.goto(`/contratacoes/${created.id}/itens?edit=${firstItem.id}`);
  await page.getByLabel("Margem (%)", { exact: false }).fill("100,01");
  await page.getByLabel("Quantidade", { exact: false }).fill("3");
  await page
    .getByRole("button", { name: "Salvar item da contratação", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "0 a 100" }),
  ).toBeVisible();
  await expect(page.getByLabel("Quantidade", { exact: false })).toHaveValue(
    "3",
  );
  await page.getByLabel("Margem (%)", { exact: false }).fill("15,50");
  await page
    .getByRole("button", { name: "Salvar item da contratação", exact: true })
    .click();
  await expect(page.getByText(/Valor estimado:/)).toContainText("315,38");
  await page.goto(`/contratacoes/${created.id}/itens?edit=${firstItem.id}`);
  await page.getByLabel("Quantidade", { exact: false }).fill("2");
  await page
    .getByRole("button", { name: "Salvar item da contratação", exact: true })
    .click();
  await expect(page.getByText(/Valor estimado:/)).toContainText("215,25");
  const secondRow = page
    .getByRole("row")
    .filter({ hasText: "Serviço de implantação" });
  page.once("dialog", (dialog) => dialog.accept());
  await secondRow.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText(/Valor estimado:/)).toContainText("200,25");
  await page
    .getByLabel("Item do catálogo", { exact: false })
    .selectOption(product.id);
  await page
    .getByLabel("Descrição", { exact: false })
    .fill("Serviço de implantação");
  await page.getByLabel("Quantidade", { exact: false }).fill("1,5");
  await page
    .getByLabel("Valor unitário estimado (R$)", { exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "Salvar item da contratação", exact: true })
    .click();
  await expect(page.getByText(/Valor estimado:/)).toContainText("215,25");
  await page
    .getByRole("link", { name: "Voltar à contratação", exact: false })
    .click();
  await expect(page.getByText("R$\u00a0215,25", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Plataforma de licitação" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  const op = await db.opportunity.findUniqueOrThrow({ where: { reference } });
  expect(op.estimatedValue!.toFixed(2)).toBe("215.25");
  const api = await page.request.get(
    `/api/admin/contratacoes?q=${encodeURIComponent(reference)}`,
  );
  expect(api.status()).toBe(200);
  expect(api.headers()["cache-control"]).toBe("no-store");
  const body = await api.json();
  expect(body.items[0].id).toBe(op.id);
  expect(typeof body.items[0].estimatedValue).toBe("string");
  expect(
    (await page.request.get("/api/admin/contratacoes?status=INVALID")).status(),
  ).toBe(400);
  await page.getByRole("link", { name: "Visão geral", exact: true }).click();
  await expect(
    page
      .getByRole("link", { name: /Contratações em acompanhamento/ })
      .getByText("1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Contratações", exact: true })
    .click();
  await page.getByLabel("Buscar contratação").fill(reference);
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
  await expect(page.getByText(/Valor estimado:/)).toContainText("215,25");
  await expect(page.getByLabel("Link da plataforma de licitação")).toHaveValue(
    "https://example.org/plataforma",
  );
  await expect(
    page.getByLabel("Pasta na nuvem (anexos da licitação)"),
  ).toHaveValue("https://example.org/anexos");
  await expect(
    page.getByRole("button", { name: "Arquivar", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Situação").selectOption("PROPOSAL_REGISTERED");
  await page
    .getByLabel("Prazo de apresentação", { exact: true })
    .fill("2020-01-01T12:00");
  await page
    .getByRole("button", { name: "Salvar contratação", exact: true })
    .click();
  await expect(
    page.getByText(/O prazo de apresentação desta contratação está vencido/),
  ).toBeVisible();
  await expect(
    page.getByText("Proposta Cadastrada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  expect(
    (await db.opportunity.findUniqueOrThrow({ where: { id: op.id } })).archived,
  ).toBe(false);
  await page
    .getByRole("link", { name: "Editar contratação", exact: true })
    .click();
  await page
    .getByLabel("Observações", { exact: true })
    .fill("Alteração não salva que será descartada");
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "As alterações não salvas",
  );
  await page
    .getByRole("button", { name: "Confirmar arquivamento", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("arquivada");
  expect(
    (await db.opportunity.findUniqueOrThrow({ where: { id: op.id } })).notes,
  ).toBe("Cadastro de teste E2E");
  await expect(
    page.getByRole("link", { name: reference, exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Exibição").selectOption("archived");
  await page.getByLabel("Buscar contratação").fill(reference);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page.getByRole("link", { name: reference, exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Editar contratação", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/contratacoes/${op.id}/editar`);
  await expect(page).toHaveURL(new RegExp(`/contratacoes/${op.id}$`));
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
  await page
    .getByRole("link", { name: "Editar contratação", exact: true })
    .click();
  const mobileHelp = page.getByRole("button", {
    name: "Ajuda sobre o prazo de apresentação",
  });
  await mobileHelp.click();
  await expect(page.getByRole("tooltip")).toContainText(
    "Data limite para apresentação da proposta",
  );
  const bounds = await page.getByRole("tooltip").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.getByLabel("Observações", { exact: true }).click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const cookies = (await page.context().cookies())
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  await page.getByRole("button", { name: "Sair do sistema" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (
      await request.get("/api/admin/contratacoes", {
        headers: { cookie: cookies },
      })
    ).status(),
  ).toBe(401);
  const forged = await request.post("/contratacoes/nova", {
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
test("contratações recusam USER em páginas, API e acesso ao cadastro", async ({
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
    await page.goto("/contratacoes/nova");
    await expect(page).toHaveURL(/\/acesso-negado$/);
    expect((await page.request.get("/api/admin/contratacoes")).status()).toBe(
      403,
    );
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
