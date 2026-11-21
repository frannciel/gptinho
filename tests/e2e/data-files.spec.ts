import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Arquivos E2E exigem banco descartável _test.");
const db = createDb(url);
const suffix = randomUUID();
const password = `Teste!${randomUUID()}`;
const email = `files-${suffix}@example.org`;
let actorId: string;
let agencyId: string;
let supplierId: string;
let opportunityId: string;
test.beforeAll(async () => {
  actorId = (
    await db.user.create({
      data: {
        name: "Admin Arquivos",
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    })
  ).id;
  agencyId = (
    await db.organization.create({
      data: { legalName: `Órgão Arquivos ${suffix}`, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
  supplierId = (
    await db.organization.create({
      data: { legalName: `Fornecedor Arquivos ${suffix}`, roles: ["SUPPLIER"] },
    })
  ).id;
  opportunityId = (
    await db.opportunity.create({
      data: {
        reference: `FILES-${suffix}`.toUpperCase(),
        organizationId: agencyId,
        subject: "Aquisição para importação de arquivos",
      },
    })
  ).id;
});
test.afterAll(async () => {
  try {
    await db.$transaction(async (tx) => {
      await tx.contract.deleteMany({
        where: { opportunity: { organizationId: agencyId } },
      });
      await tx.opportunityItem.deleteMany({
        where: { opportunity: { organizationId: agencyId } },
      });
      await tx.opportunity.deleteMany({ where: { organizationId: agencyId } });
      await tx.catalogProduct.deleteMany({ where: { supplierId } });
      await tx.auditLog.deleteMany({ where: { actorId } });
      await tx.organization.deleteMany({
        where: { id: { in: [agencyId, supplierId] } },
      });
      await tx.user.delete({ where: { id: actorId } });
    });
  } finally {
    await db.$disconnect();
  }
});
test("arquivos: prévia, complementos, confirmação, vínculo por lote e downloads JSON/Markdown", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  expect(
    (await request.get("/api/admin/arquivos/modelo?tipo=catalogo")).status(),
  ).toBe(401);
  expect(
    (
      await request.get(
        `/api/admin/contratacoes/${opportunityId}/exportar?mode=estimativa`,
      )
    ).status(),
  ).toBe(401);
  await page.goto("/login");
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const schema = await page.request.get(
    "/api/admin/arquivos/modelo?tipo=catalogo&formato=schema",
  );
  expect(schema.status()).toBe(200);
  expect((await schema.json()).properties).toBeDefined();
  const catalog = {
    versao: "1.0",
    tipo: "itens_catalogo",
    loteId: `catalog-${suffix}`,
    origem: { documento: "TR de teste.pdf", referencia: "Item 1" },
    itens: [
      {
        codigo: "CAT-001",
        tipo: "MATERIAL",
        descricao: `Produto de arquivo ${suffix}`,
        marca: null,
        modelo: null,
        unidade: "UN",
        aliquotaTributaria: null,
        fornecedoresCnpj: [],
      },
    ],
  };
  await page.goto("/catalogo/importar");
  await page.getByLabel("Arquivo JSON", { exact: true }).setInputFiles({
    name: "catalogo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(catalog)),
  });
  const pending = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await page.getByRole("button", { name: "Validar e visualizar" }).click();
  const previewRequest = await pending;
  await expect(
    page.getByRole("alert").filter({ hasText: "alíquota" }),
  ).toBeVisible();
  expect(await db.catalogProduct.count({ where: { supplierId } })).toBe(0);
  await page
    .getByLabel("Alíquota tributária padrão (%)", { exact: true })
    .fill("10,00");
  await page
    .getByLabel("Pesquisar fornecedores")
    .fill(`Fornecedor Arquivos ${suffix}`);
  await page
    .getByRole("listbox", { name: "Resultados de fornecedores" })
    .getByRole("option", { name: `Fornecedor Arquivos ${suffix}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Validar e visualizar" }).click();
  await expect(
    page.getByRole("region", { name: "Prévia da importação" }),
  ).toContainText(catalog.itens[0].descricao);
  expect(await db.catalogProduct.count({ where: { supplierId } })).toBe(0);
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("status")).toContainText("1 item(ns) importado");
  const product = await db.catalogProduct.findFirstOrThrow({
    where: { supplierId },
  });
  expect(product.taxRate?.toFixed(2)).toBe("10.00");
  const items = {
    versao: "1.0",
    tipo: "itens_contratacao",
    loteId: `items-${suffix}`,
    origem: { documento: "TR de teste.pdf", referencia: "Item 1" },
    itens: [
      {
        numero: 1,
        tipo: "MATERIAL",
        descricao: "Descrição completa extraída do termo de referência",
        marca: null,
        modelo: null,
        unidade: "UN",
        quantidade: "2.000",
        valorUnitarioEstimado: "100.1250",
        catalogoId: null,
        catalogoReferencia: { loteId: catalog.loteId, codigo: "CAT-001" },
      },
    ],
  };
  await page.goto(`/contratacoes/${opportunityId}/importar`);
  await page.getByLabel("Arquivo JSON", { exact: true }).setInputFiles({
    name: "itens.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(items)),
  });
  await page.getByRole("button", { name: "Validar e visualizar" }).click();
  await expect(
    page.getByRole("region", { name: "Prévia da importação" }),
  ).toContainText(catalog.itens[0].descricao);
  expect(await db.opportunityItem.count({ where: { opportunityId } })).toBe(0);
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("status")).toContainText("1 item(ns) importado");
  const item = await db.opportunityItem.findFirstOrThrow({
    where: { opportunityId },
  });
  expect(item.catalogProductId).toBe(product.id);
  expect(item.unitPrice?.toFixed(4)).toBe("100.1250");
  await page.goto(`/contratacoes/${opportunityId}/exportar`);
  await page
    .getByLabel("Conjunto de dados", { exact: true })
    .selectOption("vencedora");
  await page
    .getByRole("button", { name: "Baixar dados para proposta" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não há itens vencedores" }),
  ).toBeVisible();
  await page
    .getByLabel("Conjunto de dados", { exact: true })
    .selectOption("estimativa");
  const jsonDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Baixar dados para proposta" })
    .click();
  const jsonFile = await jsonDownload;
  const exported = JSON.parse(await readFile((await jsonFile.path())!, "utf8"));
  expect(exported.valorTotal).toBe("200.25");
  expect(exported.itens[0].valorUnitario).toBe("100.1250");
  expect(exported.orgao.razaoSocial).toBe(`Órgão Arquivos ${suffix}`);
  expect(JSON.stringify(exported)).not.toContain("minimumPrice");
  expect(JSON.stringify(exported)).not.toContain("supplierId");
  await page.getByLabel("Formato", { exact: true }).selectOption("markdown");
  const markdownDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Baixar dados para proposta" })
    .click();
  const md = await markdownDownload;
  expect(await readFile((await md.path())!, "utf8")).toContain("```json");
  await page.goto(`/contratacoes/${opportunityId}/importar`);
  await page.getByLabel("Arquivo JSON", { exact: true }).setInputFiles({
    name: "itens.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(items)),
  });
  await page.getByRole("button", { name: "Validar e visualizar" }).click();
  await expect(page.getByRole("status")).toContainText("já foi importado");
  expect(await db.opportunityItem.count({ where: { opportunityId } })).toBe(1);
  await db.opportunity.update({
    where: { id: opportunityId },
    data: { archived: true, version: { increment: 1 } },
  });
  await page.goto(`/contratacoes/${opportunityId}/importar`);
  await expect(
    page.getByText("Contratação arquivada. A importação está bloqueada."),
  ).toBeVisible();
  await expect(page.getByLabel("Arquivo JSON", { exact: true })).toHaveCount(0);
  const forged = await request.post(previewRequest.url(), {
    headers: {
      "content-type": previewRequest.headers()["content-type"],
      "next-action": previewRequest.headers()["next-action"],
      origin: "http://localhost:3000",
    },
    data: previewRequest.postData()!,
  });
  expect(await forged.text()).toContain("Sessão expirada");
});
test("arquivos recusam usuário sem perfil administrador em páginas e APIs", async ({
  page,
}) => {
  const user = await db.user.create({
    data: {
      name: "Leitor Arquivos",
      email: `reader-files-${suffix}@example.org`,
      passwordHash: await hashPassword(password),
      role: "USER",
    },
  });
  try {
    await page.goto("/login");
    await page.getByLabel("E-mail corporativo").fill(user.email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
    await expect(page).toHaveURL(/\/acesso-negado$/);
    for (const path of [
      "/catalogo/importar",
      `/contratacoes/${opportunityId}/importar`,
      `/contratacoes/${opportunityId}/exportar`,
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/acesso-negado$/);
    }
    expect(
      (
        await page.request.get("/api/admin/arquivos/modelo?tipo=contratacao")
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.get(
          `/api/admin/contratacoes/${opportunityId}/exportar?mode=estimativa`,
        )
      ).status(),
    ).toBe(403);
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }
});
