import "dotenv/config";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { createDb } from "../../src/lib/db-client";
import { hashPassword } from "../../src/lib/password";
const url = process.env.DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Contratos E2E exigem banco descartável.");
test.describe.configure({ mode: "serial" });
const db = createDb(url);
const suffix = randomUUID();
const password = `Teste!${randomUUID()}`;
const email = `contracts-${suffix}@example.org`;
let actorId: string, agencyId: string, termId: string;
const agency = `Órgão Contratos ${suffix}`;
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
    const cases = await db.contractCase.findMany({
      where: { organizationId: agencyId },
      select: { id: true },
    });
    const ids = cases.map((c) => c.id);
    await db.$transaction([
      db.invoiceReceipt.deleteMany({
        where: { invoice: { caseId: { in: ids } } },
      }),
      db.salesInvoiceItem.deleteMany({ where: { caseId: { in: ids } } }),
      db.salesInvoice.deleteMany({ where: { caseId: { in: ids } } }),
      db.supplyOrderItem.deleteMany({ where: { caseId: { in: ids } } }),
      db.supplyOrder.deleteMany({ where: { caseId: { in: ids } } }),
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
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Entrar no sistema", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
}
async function openBox(page: Page, text: string) {
  await page.getByText(text, { exact: true }).click();
  return page
    .locator("details")
    .filter({ has: page.getByText(text, { exact: true }) });
}
async function saved(page: Page) {
  await expect(page.locator("fieldset[disabled]")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Registro salvo com sucesso." }),
  ).toBeVisible();
}
test("Termo: item manual, pedido parcial, NF, recebimento e aditivo sem reescrever históricos", async ({
  page,
}) => {
  await login(page);
  await page.goto("/contratos");
  await page.getByRole("link", { name: "Novo contrato" }).click();
  await page.getByLabel("Instrumento jurídico").selectOption("TERM");
  await page.getByLabel("Órgão público").selectOption(agencyId);
  await page.getByLabel("Número do contrato").fill(`CT-${suffix}`);
  await expect(page.getByLabel("Data do instrumento")).toHaveCount(0);
  await page.getByLabel("Valor do instrumento").fill("1000,00");
  await page.getByLabel("Situação").selectOption("DRAFT");
  await page.getByLabel("Data de assinatura").fill("2026-11-01");
  await page
    .getByRole("textbox", { name: "Link da publicação", exact: true })
    .fill("https://pncp.gov.br/app/contratos/1");
  await page
    .getByRole("button", { name: "Ajuda sobre link da publicação" })
    .click();
  await expect(page.getByRole("tooltip")).toContainText("Diário Oficial");
  await page
    .getByRole("button", { name: "Ajuda sobre link da publicação" })
    .click();
  await page.getByLabel("Início da vigência").fill("2026-11-01");
  await page.getByLabel("Fim da vigência").fill("2027-11-01");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "Valor divergente" }),
  ).toBeVisible();
  termId = page.url().split("/contratos/")[1].split("?")[0];
  await expect(
    page
      .getByRole("navigation", { name: "Abas do contrato" })
      .getByRole("link", { name: "Aditivos" }),
  ).toBeVisible();
  let box = await openBox(page, "Adicionar item contratado");
  await box.getByLabel("Número do item").fill("1");
  await box.getByLabel("Unidade").fill("UN");
  await box.getByLabel("Descrição").fill("Licença contratada E2E");
  await box.getByLabel("Quantidade (até 3 casas)").fill("10");
  await box.getByLabel("Preço unitário contratado").fill("100,0000");
  await box.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "Valor divergente" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Abrir publicação" }),
  ).toHaveAttribute("href", "https://pncp.gov.br/app/contratos/1");
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  box = await openBox(page, "Novo pedido");
  await box.getByLabel("Referência do pedido").fill("P-E2E");
  await box.getByLabel("Data do pedido").fill("2026-11-02");
  await box
    .getByLabel("Número do empenho (opcional)", { exact: true })
    .fill("NE-CONTABIL-01");
  await box
    .getByLabel("Data de emissão do empenho (opcional)", { exact: true })
    .fill("2026-11-01");
  await box.getByLabel("Prazo de fornecimento").fill("2026-12-01");
  await box.getByLabel("Quantidade item 1").fill("6");
  await box.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await page.getByLabel("Fornecido item 1").fill("2");
  await page
    .getByRole("article")
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await saved(page);
  await expect(
    page.getByText("Parcialmente fornecido", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Notas Fiscais", exact: true }).click();
  box = await openBox(page, "Nova nota fiscal");
  await box.getByLabel("Número da nota fiscal").fill("NF-E2E");
  await box.getByLabel("Chave de Acesso").fill("ABC123xyz");
  await box.getByLabel("Data de emissão").fill("2026-11-03");
  await box.getByLabel("Pedido (opcional)").selectOption({ label: "P-E2E" });
  await box.getByLabel("Quantidade item 1").fill("2");
  await box.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("heading", { name: "Nota fiscal NF-E2E" }),
  ).toBeVisible();
  box = await openBox(page, "Registrar recebimento da NF NF-E2E");
  await box.getByLabel("Data do recebimento").fill("2026-11-04");
  await box.getByLabel("Valor recebido").fill("100");
  await box.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByText("Parcialmente recebida", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Aditivos", exact: true }).click();
  box = await openBox(page, "Novo aditivo");
  await box.getByLabel("Número do aditivo").fill("AD-E2E");
  await box.getByLabel("Data do aditivo").fill("2026-11-05");
  await box.getByLabel("Tipo / motivo").fill("Acréscimo");
  await box.getByLabel("Variação do valor contratado").fill("100");
  await box.getByLabel("Variação de quantidade item 1").fill("1");
  await box.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("heading", { name: "Aditivo AD-E2E" }),
  ).toBeVisible();
  const stored = await db.contract.findUniqueOrThrow({
    where: { id: termId },
    include: {
      case: {
        include: {
          items: true,
          invoices: { include: { items: true, receipts: true } },
          orders: { include: { items: true } },
        },
      },
    },
  });
  expect(stored.status).toBe("ACTIVE");
  expect(stored.case.orders[0].commitmentNumber).toBe("NE-CONTABIL-01");
  expect(stored.case.invoices[0].accessKey).toBe("ABC123xyz");
  expect(stored.amount!.toFixed(2)).toBe("1000.00");
  expect(stored.case.items[0].quantity.toFixed(3)).toBe("10.000");
  expect(stored.case.invoices[0].amount.toFixed(2)).toBe("200.00");
  expect(stored.case.orders[0].items[0].suppliedQuantity.toFixed(3)).toBe(
    "2.000",
  );
});
test("Empenho substitutivo independente: sem agrupamento, dados automáticos no Pedido e alerta de valores", async ({
  page,
}) => {
  await login(page);
  await page.goto("/contratos/novo");
  await page.getByLabel("Instrumento jurídico").selectOption("COMMITMENT");
  await expect(page.getByLabel("Negócio comercial existente")).toHaveCount(0);
  await expect(page.getByLabel("Termo vinculado")).toHaveCount(0);
  await expect(page.getByLabel("Data de assinatura")).toHaveCount(0);
  await expect(page.getByLabel("Início da vigência")).toHaveCount(0);
  await page.getByLabel("Órgão público").selectOption(agencyId);
  await page.getByLabel("Número do empenho substitutivo").fill(`NE-${suffix}`);
  await page
    .getByLabel("Data de emissão do empenho", { exact: false })
    .fill("2026-11-06");
  await page.getByLabel("Valor do instrumento").fill("200");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "Valor divergente" }),
  ).toBeVisible();
  let box = await openBox(page, "Adicionar item contratado");
  await box.getByLabel("Número do item").fill("1");
  await box.getByLabel("Unidade").fill("UN");
  await box.getByLabel("Descrição").fill("Produto do empenho substitutivo");
  await box.getByLabel("Quantidade (até 3 casas)").fill("2");
  await box.getByLabel("Preço unitário contratado").fill("100");
  await box.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "Valor divergente" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Abas do contrato" })
      .getByRole("link", { name: "Aditivos" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  box = await openBox(page, "Novo pedido");
  await expect(
    box.getByLabel("Número do empenho (opcional)", { exact: true }),
  ).toHaveValue(`NE-${suffix}`);
  await expect(
    box.getByLabel("Data de emissão do empenho (opcional)", { exact: true }),
  ).toHaveValue("2026-11-06");
  await box.getByLabel("Data do pedido").fill("2026-11-07");
  await box.getByLabel("Quantidade item 1").fill("1");
  await box.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  const stored = await db.contract.findFirstOrThrow({
    where: { reference: `NE-${suffix}` },
    include: { case: { include: { orders: true } } },
  });
  expect(stored.status).toBe("ACTIVE");
  expect(stored.case.orders[0].commitmentNumber).toBe(`NE-${suffix}`);
  expect(stored.caseId).not.toBe(
    (await db.contract.findUniqueOrThrow({ where: { id: termId } })).caseId,
  );
  await page.goto("/contratos");
  await expect(
    page.getByRole("columnheader", { name: "Negócio comercial" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Empenho substitutivo", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("origem: herda órgão e copia somente itens vencedores com preço e snapshot", async ({
  page,
}) => {
  const source = await db.opportunity.create({
    data: {
      organizationId: agencyId,
      reference: `LIC-${suffix}`.toUpperCase(),
      subject: "Licenças",
      items: {
        create: [
          {
            number: 1,
            description: "Licença vencedora de origem",
            unit: "LIC",
            quantity: "5",
            winningUnitPrice: "10.2500",
            winner: true,
          },
          {
            number: 2,
            description: "Item não vencedor",
            unit: "UN",
            quantity: "2",
            winner: false,
          },
        ],
      },
    },
    include: { items: true },
  });
  await login(page);
  await page.goto("/contratos/novo");
  await page.getByLabel("Instrumento jurídico").selectOption("COMMITMENT");
  await page.getByLabel("Contratação de origem").selectOption(source.id);
  await expect(page.getByLabel("Órgão público")).toBeDisabled();
  await expect(page.getByLabel("Quantidade item 1")).toHaveValue("5.000");
  await expect(page.getByLabel("Quantidade item 2")).toHaveCount(0);
  await page
    .getByLabel("Número do empenho substitutivo")
    .fill(`NE-ORIGEM-${suffix}`);
  await page.getByLabel("Data de emissão do empenho").fill("2026-11-06");
  await page.getByLabel("Valor do instrumento").fill("51,25");
  await page.getByLabel("Situação").selectOption("ACTIVE");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("cell", { name: /Licença vencedora de origem/ }),
  ).toBeVisible();
  const stored = await db.contractCase.findFirstOrThrow({
    where: { opportunityId: source.id },
    include: { items: true },
  });
  expect(stored.items).toHaveLength(1);
  expect(stored.items[0].unitPrice.toFixed(4)).toBe("10.2500");
  expect(stored.items[0].sourceSnapshot).toMatchObject({
    winner: true,
    description: "Licença vencedora de origem",
  });
});
