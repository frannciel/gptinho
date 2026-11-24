import "dotenv/config";
import { randomUUID } from "node:crypto";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Banco E2E descartável obrigatório.");
test.describe.configure({ mode: "serial" });
const db = createDb(url),
  suffix = randomUUID(),
  password = `Teste!${randomUUID()}`,
  email = `contracts-${suffix}@example.org`,
  agency = `Órgão Contratos E2E ${suffix}`;
let actorId: string, agencyId: string, termId: string, caseId: string;
test.beforeAll(async () => {
  actorId = (
    await db.user.create({
      data: {
        email,
        name: "Admin Contratos E2E",
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    })
  ).id;
  agencyId = (
    await db.organization.create({
      data: { legalName: agency, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
});
test.afterAll(async () => {
  try {
    const ids = (
      await db.contractCase.findMany({
        where: { organizationId: agencyId },
        select: { id: true },
      })
    ).map((c) => c.id);
    await db.$transaction([
      db.invoiceReceipt.deleteMany({
        where: { invoice: { caseId: { in: ids } } },
      }),
      db.salesInvoiceItem.deleteMany({ where: { caseId: { in: ids } } }),
      db.salesInvoice.deleteMany({ where: { caseId: { in: ids } } }),
      db.supplyOrderItem.deleteMany({ where: { caseId: { in: ids } } }),
      db.supplyOrder.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractPeriod.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractEndorsementItem.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractEndorsement.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractAmendmentItem.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractAmendment.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractGuarantee.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractItem.deleteMany({ where: { caseId: { in: ids } } }),
      db.contract.updateMany({
        where: { caseId: { in: ids } },
        data: { parentTermId: null },
      }),
      db.contract.deleteMany({ where: { caseId: { in: ids } } }),
      db.contractCase.deleteMany({ where: { id: { in: ids } } }),
      db.auditLog.deleteMany({ where: { actorId } }),
      db.opportunityItem.deleteMany({
        where: { opportunity: { organizationId: agencyId } },
      }),
      db.opportunity.deleteMany({ where: { organizationId: agencyId } }),
      db.organization.delete({ where: { id: agencyId } }),
      db.user.delete({ where: { id: actorId } }),
    ]);
  } finally {
    await db.$disconnect();
  }
});
async function login(page: Page, loginEmail = email) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(loginEmail);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Entrar no sistema", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard|acesso-negado/);
}
async function box(page: Page, title: string) {
  const root = page
    .locator("details")
    .filter({ has: page.getByText(title, { exact: true }) });
  await expect(root).toBeVisible();
  if ((await root.getAttribute("open")) === null)
    await page.getByText(title, { exact: true }).click();
  return root;
}

async function save(page: Page, scope: Page | Locator) {
  await scope.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator("fieldset[disabled]")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Registro salvo com sucesso." }),
  ).toBeVisible();
}
async function search(
  page: Page,
  label: string,
  query: string,
  option: string,
) {
  await page.getByRole("combobox", { name: label, exact: false }).fill(query);
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function deleteConfirm(
  page: Page,
  button: Locator,
  accept = true,
  contains = "irreversível",
) {
  page.once("dialog", async (d) => {
    expect(d.message()).toContain(contains);
    if (accept) await d.accept();
    else await d.dismiss();
  });
  await button.click();
}
async function general(page: Page) {
  await page.goto(`/contratos/${termId}`);
  return page.getByRole("row").filter({ hasText: "Produto continuado E2E" });
}
test("Contrato: busca, edição do original, NF sem itens, garantia legal e apostilamento bidirecional", async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/contratos/novo");
  await page.getByLabel("Instrumento jurídico").selectOption("TERM");
  await search(page, "Órgão público", suffix, agency);
  await expect(page.getByLabel("Data do instrumento")).toHaveCount(0);
  await page.getByLabel("Número do contrato").fill(`CT-${suffix}`);
  await page.getByLabel("Valor original (R$)").fill("1000");
  await page.getByLabel("Continuado", { exact: true }).check();
  await page.getByLabel("Data de assinatura").fill("2026-11-01");
  await page.getByLabel("Início da vigência").fill("2026-11-01");
  await page.getByLabel("Fim da vigência").fill("2027-10-31");
  await page
    .getByRole("textbox", { name: "Link da publicação", exact: true })
    .fill("https://pncp.gov.br/app/contratos/1");
  await page
    .getByRole("button", { name: "Ajuda sobre link da publicação" })
    .click();
  await expect(page.getByRole("tooltip")).toContainText("Diário Oficial");
  await page.getByLabel("Fim da vigência").fill("2026-10-31");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Revise os campos" }),
  ).toContainText("Fim da vigência anterior");
  await expect(page.getByLabel("Continuado", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Instrumento jurídico")).toHaveValue("TERM");
  await page.getByLabel("Fim da vigência").fill("2027-10-31");
  await save(page, page);
  termId = page.url().split("/contratos/")[1].split("?")[0];
  caseId = (await db.contract.findUniqueOrThrow({ where: { id: termId } }))
    .caseId;
  await expect(
    page.getByRole("alert").filter({ hasText: "Valor divergente" }),
  ).toBeVisible();
  let form = await box(page, "Adicionar item contratado");
  await form.getByLabel("Número do item").fill("1");
  await form.getByLabel("Unidade").fill("UN");
  await form.getByLabel("Descrição").fill("Produto continuado E2E");
  await form.getByLabel("Quantidade", { exact: false }).fill("100");
  await form.getByLabel("Preço unitário contratado").fill("10");
  await save(page, form);
  await expect(
    page.getByRole("alert").filter({ hasText: "Valor divergente" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  form = await box(page, "Novo pedido");
  await form.getByLabel("Referência do pedido").fill("P-BASE");
  await form.getByLabel("Data do pedido").fill("2026-11-02");
  await form
    .getByLabel("Número do empenho (opcional)", { exact: true })
    .fill("NE-CONTABIL");
  await form
    .getByLabel("Data de emissão do empenho (opcional)", { exact: true })
    .fill("2026-11-01");
  await form.getByLabel("Quantidade item 1").fill("90");
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Pedido P-BASE" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .getByRole("status")
      .filter({ hasText: "Pendente" }),
  ).toBeVisible();
  expect(
    (await db.contract.findUniqueOrThrow({ where: { id: termId } })).status,
  ).toBe("ACTIVE");
  await page.getByRole("link", { name: "Notas Fiscais", exact: true }).click();
  form = await box(page, "Nova nota fiscal");
  await expect(form.getByLabel("Quantidade item 1")).toHaveCount(0);
  await form
    .getByLabel("Pedido", { exact: false })
    .selectOption({ label: "P-BASE · período 1" });
  await form.getByLabel("Número da nota fiscal").fill("NF-BASE");
  await form.getByLabel("Data de emissão", { exact: false }).fill("2026-11-03");
  await form.getByLabel("Valor da nota fiscal").fill("900");
  await form.getByLabel("Chave de Acesso").fill("ABC123");
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Nota fiscal NF-BASE" }),
  ).toBeVisible();
  expect(await db.salesInvoiceItem.count({ where: { caseId } })).toBe(0);
  form = await box(page, "Registrar recebimento da NF NF-BASE");
  await form.getByLabel("Data do recebimento").fill("2026-11-04");
  await form.getByLabel("Valor recebido").fill("500");
  await save(page, form);
  await expect(
    page.getByRole("status").filter({ hasText: "Parcialmente recebida" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Garantias", exact: true }).click();
  form = await box(page, "Nova garantia");
  await form.getByLabel("Tipo de garantia").selectOption("Seguro-garantia");
  await form.getByLabel("Valor (R$)").fill("50");
  await form.getByLabel("Validade").fill("2027-10-31");
  await save(page, form);
  await general(page);
  form = await box(page, "Editar contrato");
  await form.getByLabel("Valor original (R$)").fill("9999");
  await save(page, form);
  const corrected = await db.contract.findUniqueOrThrow({
    where: { id: termId },
  });
  expect(corrected.amount!.toFixed(2)).toBe("9999.00");
  expect(corrected.currentAmount!.toFixed(2)).toBe("9999.00");
  await page.getByRole("link", { name: "Apostilamento", exact: true }).click();
  form = await box(page, "Novo apostilamento");
  await form.getByLabel("Número", { exact: false }).fill("AP-01");
  await form
    .getByLabel("Data de Assinatura", { exact: false })
    .fill("2026-11-06");
  await form.getByLabel("Variação para todos (%)").fill("10");
  await form.getByRole("button", { name: "Aplicar a todos" }).click();
  await expect(form.getByLabel("Novo valor item 1")).toHaveValue("11.0000");
  await form.getByLabel("Novo valor item 1").fill("12");
  await expect(form.getByLabel("Variação percentual item 1")).toHaveValue(
    "20.0000",
  );
  await form.getByLabel("Variação percentual item 1").fill("10");
  await expect(form.getByLabel("Novo valor item 1")).toHaveValue("11.0000");
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Apostilamento AP-01" }),
  ).toBeVisible();
  expect(
    (
      await db.contract.findUniqueOrThrow({ where: { id: termId } })
    ).currentAmount!.toFixed(2),
  ).toBe("10099.00");
  expect(
    (
      await db.supplyOrderItem.findFirstOrThrow({ where: { caseId } })
    ).unitPrice!.toFixed(4),
  ).toBe("10.0000");
  await deleteConfirm(
    page,
    page.getByRole("button", { name: "Excluir apostilamento" }),
    false,
  );
  expect(await db.contractEndorsement.count({ where: { caseId } })).toBe(1);
  await deleteConfirm(
    page,
    page.getByRole("button", { name: "Excluir apostilamento" }),
  );
  await expect(
    page.getByRole("heading", { name: "Apostilamento AP-01" }),
  ).toHaveCount(0);
  expect(
    (
      await db.contract.findUniqueOrThrow({ where: { id: termId } })
    ).currentAmount!.toFixed(2),
  ).toBe("9999.00");
});
test("Renovação: 100 + 10 com saldo 20 inicia novo período com 110 disponíveis", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/contratos/${termId}?tab=aditivos`);
  let form = await box(page, "Novo aditivo");
  await form.getByLabel("Número do aditivo").fill("AD-BASE");
  await form.getByLabel("Data de Assinatura").fill("2026-11-05");
  await form.getByLabel("Tipo de alteração").selectOption("ADDITION");
  await form.getByLabel("Variação de quantidade item 1").fill("10");
  await form.getByLabel("Variação para todos (%)").fill("10");
  await form.getByRole("button", { name: "Aplicar a todos" }).click();
  await expect(form.getByLabel("Novo valor item 1")).toHaveValue("11.0000");
  await expect(form.getByLabel("Valor Atualizado do Contrato")).toHaveValue(
    "0,00",
  );
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Aditivo AD-BASE" }),
  ).toBeVisible();
  let row = await general(page);
  await expect(row.getByRole("cell").last()).toHaveText("20");
  await page.getByRole("link", { name: "Aditivos", exact: true }).click();
  form = await box(page, "Novo aditivo");
  await form.getByLabel("Número do aditivo").fill("REN-01");
  await form.getByLabel("Data de Assinatura").fill("2027-10-31");
  await form.getByLabel("Tipo de alteração").selectOption("RENEWAL");
  await expect(form.getByLabel("Variação de quantidade item 1")).toHaveCount(0);
  await form.getByLabel("Nova data final da vigência").fill("2028-10-31");
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Aditivo REN-01" }),
  ).toBeVisible();
  row = await general(page);
  await expect(row.getByRole("cell").last()).toHaveText("110");
  await expect(row.getByRole("cell").nth(5)).toHaveText("11,0000");
  expect(await db.contractPeriod.count({ where: { caseId } })).toBe(2);
  await page.getByRole("link", { name: "Aditivos", exact: true }).click();
  const original = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Aditivo AD-BASE", exact: true }),
  });
  await deleteConfirm(
    page,
    original.getByRole("button", { name: "Excluir aditivo" }),
  );
  await expect(original.getByRole("alert")).toContainText("posteriores");
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  form = await box(page, "Novo pedido");
  await form.getByLabel("Referência do pedido").fill("P-NOVO");
  await form.getByLabel("Data do pedido").fill("2027-11-01");
  await form.getByLabel("Quantidade item 1").fill("110");
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Pedido P-NOVO" }),
  ).toBeVisible();
  row = await general(page);
  await expect(row.getByRole("cell").last()).toHaveText("0");
});
test("Exclusões irreversíveis de NF, Pedido, renovação, aditivo e contrato preservam o escopo", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/contratos/${termId}?tab=notas`);
  let form = await box(page, "Nova nota fiscal");
  await form
    .getByLabel("Pedido", { exact: false })
    .selectOption({ label: "P-NOVO · período 2" });
  await form.getByLabel("Número da nota fiscal").fill("NF-NOVA");
  await form.getByLabel("Data de emissão", { exact: false }).fill("2027-11-02");
  await form.getByLabel("Valor da nota fiscal").fill("1210");
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Nota fiscal NF-NOVA" }),
  ).toBeVisible();
  form = await box(page, "Registrar recebimento da NF NF-NOVA");
  await form.getByLabel("Data do recebimento").fill("2027-11-03");
  await form.getByLabel("Valor recebido").fill("200");
  await save(page, form);
  let article = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Nota fiscal NF-NOVA",
      exact: true,
    }),
  });
  await deleteConfirm(
    page,
    article.getByRole("button", { name: "Excluir nota fiscal" }),
    true,
    "1 recebimentos",
  );
  await expect(article).toHaveCount(0);
  expect(await db.salesInvoice.count({ where: { caseId } })).toBe(1);
  expect(
    await db.invoiceReceipt.count({ where: { invoice: { caseId } } }),
  ).toBe(1);
  form = await box(page, "Nova nota fiscal");
  await form
    .getByLabel("Pedido", { exact: false })
    .selectOption({ label: "P-NOVO · período 2" });
  await form.getByLabel("Número da nota fiscal").fill("NF-NOVA2");
  await form.getByLabel("Data de emissão", { exact: false }).fill("2027-11-02");
  await form.getByLabel("Valor da nota fiscal").fill("1210");
  await save(page, form);
  await expect(
    page.getByRole("heading", { name: "Nota fiscal NF-NOVA2" }),
  ).toBeVisible();
  form = await box(page, "Registrar recebimento da NF NF-NOVA2");
  await form.getByLabel("Data do recebimento").fill("2027-11-03");
  await form.getByLabel("Valor recebido").fill("200");
  await save(page, form);
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  article = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Pedido P-NOVO", exact: true }),
  });
  await deleteConfirm(
    page,
    article.getByRole("button", { name: "Excluir pedido" }),
    true,
    "1 notas fiscais e 1 recebimentos",
  );
  await expect(article).toHaveCount(0);
  expect(await db.salesInvoice.count({ where: { caseId } })).toBe(1);
  let row = await general(page);
  await expect(row.getByRole("cell").last()).toHaveText("110");
  await page.getByRole("link", { name: "Aditivos", exact: true }).click();
  article = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Aditivo REN-01", exact: true }),
  });
  await deleteConfirm(
    page,
    article.getByRole("button", { name: "Excluir aditivo" }),
  );
  await expect(article).toHaveCount(0);
  row = await general(page);
  await expect(row.getByRole("cell").last()).toHaveText("20");
  await page.getByRole("link", { name: "Aditivos", exact: true }).click();
  article = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Aditivo AD-BASE", exact: true }),
  });
  await deleteConfirm(
    page,
    article.getByRole("button", { name: "Excluir aditivo" }),
  );
  await expect(article).toHaveCount(0);
  row = await general(page);
  await expect(row.getByRole("cell").last()).toHaveText("10");
  await deleteConfirm(
    page,
    page.getByRole("button", { name: "Excluir contrato" }),
    true,
    "1 recebimentos",
  );
  await expect(page).toHaveURL(/\/contratos$/);
  expect(await db.contract.count({ where: { id: termId } })).toBe(0);
  expect(await db.contractPeriod.count({ where: { caseId } })).toBe(0);
  expect(
    await db.auditLog.count({
      where: { entityId: caseId, action: "DELETE_CONTRACT" },
    }),
  ).toBe(1);
});
test("Contratação de origem é pesquisada e preenche órgão e itens automaticamente", async ({
  page,
}) => {
  const reference = `LIC-${suffix}`.toUpperCase();
  const source = await db.opportunity.create({
    data: {
      reference,
      subject: "Software",
      organizationId: agencyId,
      items: {
        create: [
          {
            number: 1,
            description: "Licença vencedora",
            unit: "LIC",
            quantity: "4",
            winningUnitPrice: "25",
            winner: true,
          },
          {
            number: 2,
            description: "Não vencedor",
            unit: "UN",
            quantity: "1",
            winner: false,
          },
        ],
      },
    },
  });
  await login(page);
  await page.goto("/contratos/novo");
  await page.getByLabel("Instrumento jurídico").selectOption("COMMITMENT");
  await search(
    page,
    "Contratação de origem",
    reference,
    `${reference} · ${agency}`,
  );
  await expect(
    page.getByRole("combobox", { name: "Órgão público" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Órgão público" }),
  ).toHaveValue(agency);
  await expect(page.getByLabel("Quantidade item 1")).toHaveValue("4");
  await expect(page.getByLabel("Quantidade item 2")).toHaveCount(0);
  await page.getByLabel("Número do empenho substitutivo").fill(`NE-${suffix}`);
  await page
    .getByLabel("Data de emissão do empenho", { exact: false })
    .fill("2026-11-06");
  await page.getByLabel("Valor original (R$)").fill("100");
  await save(page, page);
  await expect(
    page.getByRole("cell", { name: /Licença vencedora/ }),
  ).toBeVisible();
  const stored = await db.contract.findFirstOrThrow({
    where: { opportunityId: source.id },
    include: { case: { include: { items: true } } },
  });
  expect(stored.case.items).toHaveLength(1);
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  const form = await box(page, "Novo pedido");
  await expect(
    form.getByLabel("Número do empenho (opcional)", { exact: true }),
  ).toHaveValue(`NE-${suffix}`);
  await expect(
    form.getByLabel("Data de emissão do empenho (opcional)", { exact: true }),
  ).toHaveValue("2026-11-06");
  await form.getByLabel("Data do pedido").fill("2026-11-07");
  await form.getByLabel("Quantidade item 1").fill("4");
  await save(page, form);
  await expect(page.getByRole("heading", { name: /Pedido/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("Pesquisa de contratos e órgãos recusa acesso anônimo e perfil USER", async ({
  page,
  browser,
}) => {
  const anon = await browser.newContext();
  const response = await anon.request.get(
    "http://localhost:3000/api/admin/contratos/busca?kind=agency&q=Orgao",
  );
  expect(response.status()).toBe(401);
  await anon.close();
  const loginEmail = `user-${suffix}@example.org`;
  const user = await db.user.create({
    data: {
      email: loginEmail,
      name: "Sem acesso",
      passwordHash: await hashPassword(password),
      role: "USER",
    },
  });
  try {
    await login(page, loginEmail);
    await expect(page).toHaveURL(/acesso-negado/);
    const denied = await page.request.get(
      "/api/admin/contratos/busca?kind=opportunity&q=LIC",
    );
    expect(denied.status()).toBe(403);
    expect(await denied.text()).not.toContain(agency);
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
