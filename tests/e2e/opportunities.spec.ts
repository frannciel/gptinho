import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
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
let secondSupplierId: string;
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
  secondSupplierId = (
    await db.organization.create({
      data: { legalName: `Segundo Fornecedor ${suffix}`, roles: ["SUPPLIER"] },
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
                    in: [
                      agencyId,
                      supplierId,
                      secondSupplierId,
                      inactiveId,
                    ].filter(Boolean),
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
            in: [agencyId, supplierId, secondSupplierId, inactiveId].filter(
              Boolean,
            ),
          },
        },
      });
    });
    await db.catalogProduct.deleteMany({
      where: { supplierId: { in: [supplierId, secondSupplierId] } },
    });
    await db.organization.deleteMany({
      where: {
        id: {
          in: [agencyId, supplierId, secondSupplierId, inactiveId].filter(
            Boolean,
          ),
        },
      },
    });
    if (actorId) {
      await db.auditLog.deleteMany({ where: { actorId } });
      await db.user.delete({ where: { id: actorId } });
    }
  } finally {
    await db.$disconnect();
  }
});
test("catálogo modal, itens, precificação exata, proposta vencedora e arquivamento", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  for (const path of ["/catalogo", "/contratacoes/nova"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get("/api/admin/contratacoes")).status()).toBe(401);
  expect((await request.get("/api/admin/fornecedores/busca")).status()).toBe(
    401,
  );
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/catalogo");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Novo item", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await modal.getByLabel("Tipo", { exact: false }).selectOption("SERVICE");
  await modal
    .getByLabel("Descrição", { exact: false })
    .fill("Licenças catálogo E2E");
  await expect(modal.getByLabel("Descrição", { exact: false })).toHaveAttribute(
    "rows",
    "2",
  );
  await modal.getByLabel("Marca", { exact: true }).fill("Marca E2E");
  await modal.getByLabel("Modelo", { exact: true }).fill("Modelo E2E");
  await expect(modal.getByLabel("Unidade", { exact: false })).toHaveValue("");
  await modal.getByLabel("Unidade", { exact: false }).fill("LIC");
  await modal
    .getByLabel("Alíquota tributária (%)", { exact: false })
    .fill("10,00");
  await expect(modal.getByText("Custo Administrativo")).toHaveCount(0);
  await expect(modal.getByText("Margem (%)")).toHaveCount(0);
  await modal.getByLabel("Pesquisar fornecedores").fill("Somente Fornecedor");
  await modal
    .getByRole("option", {
      name: `Somente Fornecedor ${suffix}`,
      exact: true,
    })
    .click();
  await modal.getByLabel("Pesquisar fornecedores").fill("Segundo Fornecedor");
  await modal
    .getByRole("option", {
      name: `Segundo Fornecedor ${suffix}`,
      exact: true,
    })
    .click();
  await modal
    .getByRole("button", { name: "Salvar item do catálogo", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const product = await db.catalogProduct.findFirstOrThrow({
    where: { description: "Licenças catálogo E2E" },
  });
  expect(
    await db.catalogSupplier.count({ where: { catalogProductId: product.id } }),
  ).toBe(2);
  await page.getByLabel("Tipo", { exact: true }).selectOption("SERVICE");
  await page.getByLabel("Marca", { exact: true }).selectOption("Marca E2E");
  await page
    .getByLabel("Pesquisar fornecedor", { exact: true })
    .fill("Segundo Fornecedor");
  await page
    .getByRole("listbox", { name: "Resultados de fornecedores" })
    .getByRole("option", { name: `Segundo Fornecedor ${suffix}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Licenças catálogo E2E", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Editar Licenças catálogo E2E", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("Tipo", { exact: false }),
  ).toHaveValue("SERVICE");
  await page.getByRole("button", { name: "Fechar modal" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/contratacoes/nova");
  await page.getByLabel("Identificação").fill(reference);
  await page.getByLabel("Órgão público").selectOption(agencyId);
  await page
    .getByLabel("Objeto")
    .fill("Aquisição de licenças de software para o órgão E2E");
  await page.getByLabel("Situação").selectOption("CLASSIFIED");
  await expect(page.getByLabel("Situação").locator("option")).toContainText([
    "Classificada",
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
  await page
    .getByRole("button", { name: "Salvar contratação", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: reference, exact: true }),
  ).toBeVisible();
  const op = await db.opportunity.findUniqueOrThrow({ where: { reference } });
  await page
    .getByRole("link", { name: "Gerenciar itens", exact: true })
    .click();
  await page.getByRole("link", { name: "Novo item", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Item do catálogo", { exact: false })
    .selectOption(product.id);
  await expect(
    page.getByRole("dialog").getByLabel("Tipo", { exact: false }),
  ).toHaveValue("SERVICE");
  await expect(page.getByLabel("Marca", { exact: true })).toHaveValue(
    "Marca E2E",
  );
  await page.getByLabel("Quantidade", { exact: false }).fill("2");
  await page
    .getByLabel("Valor estimado (R$)", { exact: true })
    .fill("100,1250");
  await page
    .getByRole("button", { name: "Salvar item da contratação", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/Valor estimado:/)).toContainText("200,25");
  const item = await db.opportunityItem.findFirstOrThrow({
    where: { opportunityId: op.id },
  });
  await page.getByRole("link", { name: "Editar item 1", exact: true }).click();
  await expect(
    page.getByLabel("Valor estimado (R$)", { exact: true }),
  ).toHaveValue("100.1250");
  await page.getByRole("button", { name: "Fechar modal" }).click();
  await page
    .getByRole("link", { name: "Proposta Vencedora", exact: true })
    .click();
  await expect(
    page.getByText("Nenhum item marcado como vencedor."),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Gerenciar itens", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Vencedor", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "Vencedor", exact: true }),
  ).toBeChecked();
  await page.getByRole("link", { name: "Precificação", exact: true }).click();
  await expect(
    page.getByLabel("Fornecedor do item 1").locator("option"),
  ).toHaveCount(3);
  await page.getByLabel("Fornecedor do item 1").selectOption(secondSupplierId);
  await page.getByLabel("Valor de Aquisição do item 1").fill("100");
  await page.getByLabel("Custo de frete do item 1").fill("10");
  await expect(page.getByLabel("Alíquota tributária do item 1")).toHaveValue(
    "10,00",
  );
  await page.getByLabel("Lucro Líquido do item 1").fill("90");
  await page.getByLabel("Custo Administrativo do item 1").fill("5");
  await page
    .getByRole("button", { name: "Salvar precificação do item 1" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "menor que 100" }),
  ).toBeVisible();
  await expect(page.getByLabel("Valor de Aquisição do item 1")).toHaveValue(
    "100",
  );
  await page.getByLabel("Lucro Líquido do item 1").fill("20");
  await page
    .getByRole("button", { name: "Salvar precificação do item 1" })
    .click();
  await expect(
    page.getByText("Acima do valor estimado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /169,2308/ })).toHaveClass(
    /bg-amber-50/,
  );
  await page
    .getByRole("link", { name: "Proposta Vencedora", exact: true })
    .click();
  await expect(page.getByText(/Pendente — informe/)).toBeVisible();
  const proposalHelp = page.getByRole("button", {
    name: "Ajuda sobre Proposta Vencedora",
  });
  await proposalHelp.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "valor unitário ofertado",
  );
  await proposalHelp.press("Escape");
  await page.getByLabel("Proposta Vencedora do item 1").fill("180,1234");
  const pending = page.waitForRequest(
    (req) => req.method() === "POST" && !!req.headers()["next-action"],
  );
  await page.getByRole("button", { name: "Salvar proposta do item 1" }).click();
  const saved = await pending;
  await expect(page.getByText(/Total da proposta vencedora:/)).toContainText(
    "360,25",
  );
  expect(
    (
      await db.opportunityItem.findUniqueOrThrow({ where: { id: item.id } })
    ).winningUnitPrice?.toFixed(4),
  ).toBe("180.1234");
  await page.screenshot({
    path: testInfo.outputPath("proposta-vencedora.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Proposta Vencedora do item 1")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("proposta-vencedora-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("link", { name: "Visão geral", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar arquivamento", exact: true })
    .click();
  await expect(page).toHaveURL(/\/contratacoes\?notice=archived$/);
  await page.goto(`/contratacoes/${op.id}`);
  await expect(
    page.getByText("Contratação arquivada. O histórico está preservado.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Precificação", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Salvar precificação do item 1" }),
  ).toHaveCount(0);
  await page.context().clearCookies();
  const forged = await request.post(saved.url(), {
    headers: {
      "content-type": saved.headers()["content-type"],
      "next-action": saved.headers()["next-action"],
      origin: "http://localhost:3000",
    },
    data: saved.postData()!,
  });
  expect(await forged.text()).toContain("Sessão expirada");
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
    const op = await db.opportunity.create({
      data: {
        reference: `ACCESS-${suffix}`.toUpperCase(),
        organizationId: agencyId,
        subject: "Contratação para testar acesso",
      },
    });
    for (const path of [
      "/catalogo",
      "/contratacoes/nova",
      `/contratacoes/${op.id}/itens`,
      `/contratacoes/${op.id}/precificacao`,
      `/contratacoes/${op.id}/proposta-vencedora`,
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/acesso-negado$/);
    }
    expect((await page.request.get("/api/admin/contratacoes")).status()).toBe(
      403,
    );
    expect(
      (await page.request.get("/api/admin/fornecedores/busca")).status(),
    ).toBe(403);
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
test("catálogo: ativos por padrão, filtro de inativos, mais recentes e fornecedores por linha", async ({
  page,
}) => {
  const term = `LISTA-${suffix}`;
  for (const [name, active, createdAt] of [
    [`${term} A antigo`, true, "2025-01-01"],
    [`${term} Z recente`, true, "2026-01-01"],
    [`${term} Inativo`, false, "2027-01-01"],
  ] as const)
    await db.catalogProduct.create({
      data: {
        description: name,
        unit: "UN",
        type: "MATERIAL",
        taxRate: "10",
        supplierId,
        active,
        createdAt: new Date(createdAt),
        suppliers: {
          create: [{ supplierId }, { supplierId: secondSupplierId }],
        },
      },
    });
  await page.goto("/login");
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/catalogo?q=${term}`);
  await expect(page.getByLabel("Situação", { exact: true })).toHaveValue(
    "active",
  );
  const descriptions = page.locator("tbody tr td:first-child");
  await expect(descriptions).toHaveText([
    `${term} Z recente`,
    `${term} A antigo`,
  ]);
  const dropdown = page.getByRole("combobox", {
    name: `Fornecedores de ${term} Z recente`,
    exact: true,
  });
  await expect(dropdown.locator("option")).toHaveCount(3);
  await dropdown.selectOption(secondSupplierId);
  await page.getByLabel("Situação", { exact: true }).selectOption("inactive");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr td:first-child")).toContainText(
    `${term} Inativo`,
  );
  await page.getByRole("link", { name: "Limpar", exact: true }).click();
  await expect(page.getByLabel("Situação", { exact: true })).toHaveValue(
    "active",
  );
  await expect(page.getByText(`${term} Inativo`, { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Novo item", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Unidade", { exact: false })).toHaveValue("");
  await modal.getByLabel("Pesquisar fornecedores").fill("Somente Fornecedor");
  const option = modal.getByRole("option", {
    name: `Somente Fornecedor ${suffix}`,
    exact: true,
  });
  await option.click();
  await expect(
    modal.getByRole("button", {
      name: `Remover Somente Fornecedor ${suffix}`,
      exact: true,
    }),
  ).toBeVisible();
  await modal
    .getByRole("button", {
      name: `Remover Somente Fornecedor ${suffix}`,
      exact: true,
    })
    .click();
  await expect(modal.locator('input[name="supplierIds"]')).toHaveCount(0);
  await modal.getByRole("link", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
