import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  parseImportFile,
  importDefaultsSchema,
  type ImportKind,
} from "@/lib/data-files";
import { BusinessError } from "@/lib/errors";
import { idSchema } from "@/lib/validation";
import { itemsTotal, itemTotal } from "@/lib/contracting-items";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const id = () => `c${randomBytes(12).toString("hex")}`;
const kindSchema = z.enum(["catalogo", "contratacao"]);
export type ImportRow = {
  key: string;
  number?: number;
  description: string;
  brand: string | null;
  model: string | null;
  unit: string;
  type: "MATERIAL" | "SERVICE";
  quantity?: string;
  unitPrice?: string | null;
  catalogProductId?: string | null;
  taxRate: string | null;
  supplierIds: string[];
  supplierNames: string[];
  catalogProductLabel?: string | null;
};
export type ImportPreview = {
  token: string;
  version: number | null;
  rows: ImportRow[];
  loteId: string;
  warnings: string[];
};
export type ImportResult = {
  count: number;
  loteId: string;
  alreadyImported: boolean;
};
function inputs(
  text: string,
  kind: ImportKind,
  target: string | undefined,
  defaults: unknown,
) {
  kindSchema.parse(kind);
  if (kind === "contratacao") idSchema.parse(target);
  const document = parseImportFile(text, kind);
  const settings = importDefaultsSchema.parse(defaults);
  const fingerprint = hash(
    JSON.stringify({
      document,
      settings,
      target: kind === "contratacao" ? target : null,
    }),
  );
  const key = hash(
    `${kind}:${kind === "contratacao" ? target : "catalogo"}:${document.loteId}`,
  );
  return { document, settings, fingerprint, key };
}
async function prepare(
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof inputs>,
  target?: string,
): Promise<ImportPreview> {
  const { document, settings } = input;
  let version: number | null = null;
  const rows: ImportRow[] = [];
  const warnings: string[] = [];
  if (document.tipo === "itens_contratacao") {
    const parent = await tx.opportunity.findUnique({
      where: { id: target },
      include: { items: true },
    });
    if (!parent) throw new BusinessError("Contratação não encontrada.");
    if (parent.archived)
      throw new BusinessError(
        "Contratações arquivadas não podem receber importações.",
      );
    version = parent.version;
    if (parent.items.length + document.itens.length > 100)
      throw new BusinessError("A contratação comporta até 100 itens.");
    const used = new Set(parent.items.map((i) => i.number));
    const refs = document.itens.flatMap((i) =>
      i.catalogoReferencia ? [i.catalogoReferencia] : [],
    );
    const batches = refs.length
      ? await tx.auditLog.findMany({
          where: {
            entity: "ImportBatch",
            entityId: {
              in: refs.map((r) => hash(`catalogo:catalogo:${r.loteId}`)),
            },
          },
        })
      : [];
    const linkedIds = document.itens.map((item) => {
      if (!item.catalogoReferencia) return item.catalogoId;
      const reference = item.catalogoReferencia;
      const batch = batches.find(
        (b) => b.entityId === hash(`catalogo:catalogo:${reference.loteId}`),
      );
      if (!batch)
        throw new BusinessError(
          `Item ${item.numero}: importe primeiro o lote de catálogo ${reference.loteId}.`,
        );
      const receipt = z
        .object({
          createdIds: z.array(idSchema),
          items: z.array(z.object({ key: z.string() })),
        })
        .parse(batch.changes);
      const index = receipt.items.findIndex((r) => r.key === reference.codigo);
      if (index < 0 || !receipt.createdIds[index])
        throw new BusinessError(
          `Item ${item.numero}: código ${reference.codigo} não encontrado no lote do catálogo.`,
        );
      return receipt.createdIds[index];
    });
    const products = await tx.catalogProduct.findMany({
      where: { id: { in: linkedIds.filter((id): id is string => !!id) } },
    });
    for (const [index, item] of document.itens.entries()) {
      const catalogoId = linkedIds[index];
      if (used.has(item.numero))
        throw new BusinessError(
          `Item ${item.numero}: número já cadastrado. A importação não sobrescreve itens.`,
        );
      const product = catalogoId
        ? products.find((p) => p.id === catalogoId)
        : null;
      if (catalogoId && !product?.active)
        throw new BusinessError(
          `Item ${item.numero}: selecione um produto ativo do catálogo.`,
        );
      if (
        product?.type &&
        product.type !== (item.tipo === "SERVICO" ? "SERVICE" : "MATERIAL")
      )
        throw new BusinessError(
          `Item ${item.numero}: tipo diferente do produto do catálogo.`,
        );
      rows.push({
        key: String(item.numero),
        number: item.numero,
        description: item.descricao,
        brand: item.marca,
        model: item.modelo,
        unit: item.unidade,
        type: item.tipo === "SERVICO" ? "SERVICE" : "MATERIAL",
        quantity: item.quantidade,
        unitPrice: item.valorUnitarioEstimado,
        catalogProductId: catalogoId,
        taxRate: product?.taxRate?.toFixed(2) ?? null,
        supplierIds: [],
        supplierNames: [],
        catalogProductLabel: product?.description.slice(0, 200) ?? null,
      });
    }
    itemsTotal([
      ...parent.items.map((i) => ({
        quantity: i.quantity.toFixed(3),
        unitPrice: i.unitPrice?.toFixed(4) ?? null,
      })),
      ...rows.map((r) => ({
        quantity: r.quantity!,
        unitPrice: r.unitPrice ?? null,
      })),
    ]);
    if (rows.some((r) => !r.catalogProductId))
      warnings.push(
        "Itens sem vínculo de catálogo serão importados. Vincule-os ao catálogo antes de precificar.",
      );
    if (rows.some((r) => r.unitPrice === null))
      warnings.push(
        "Há preços estimados desconhecidos. O total estimado ficará pendente até o preenchimento.",
      );
  } else {
    const cnpjs = [
      ...new Set(document.itens.flatMap((i) => i.fornecedoresCnpj)),
    ];
    const suppliers = await tx.organization.findMany({
      where: {
        OR: [{ id: { in: settings.supplierIds } }, { cnpj: { in: cnpjs } }],
      },
      select: {
        id: true,
        cnpj: true,
        active: true,
        roles: true,
        legalName: true,
      },
    });
    const seen = new Set<string>();
    for (const item of document.itens) {
      const taxRate = item.aliquotaTributaria ?? settings.taxRate;
      if (taxRate === null)
        throw new BusinessError(
          `${item.codigo}: informe a alíquota no arquivo ou no complemento da importação.`,
        );
      const supplierIds = item.fornecedoresCnpj.length
        ? item.fornecedoresCnpj.map((cnpj) => {
            const s = suppliers.find((s) => s.cnpj === cnpj);
            if (!s)
              throw new BusinessError(
                `${item.codigo}: fornecedor CNPJ ${cnpj} não cadastrado.`,
              );
            return s.id;
          })
        : settings.supplierIds;
      if (!supplierIds.length)
        throw new BusinessError(
          `${item.codigo}: selecione os fornecedores no complemento ou informe CNPJs cadastrados no arquivo.`,
        );
      for (const sid of supplierIds) {
        const s = suppliers.find((s) => s.id === sid);
        if (!s?.active || !s.roles.includes("SUPPLIER"))
          throw new BusinessError(
            `${item.codigo}: fornecedor inexistente, inativo ou sem papel de fornecedor.`,
          );
      }
      const identity = JSON.stringify([
        item.tipo,
        item.descricao.toLocaleLowerCase("pt-BR"),
        item.marca?.toLocaleLowerCase("pt-BR"),
        item.modelo?.toLocaleLowerCase("pt-BR"),
        item.unidade,
      ]);
      if (seen.has(identity))
        throw new BusinessError(`${item.codigo}: item repetido no arquivo.`);
      seen.add(identity);
      rows.push({
        key: item.codigo,
        description: item.descricao,
        brand: item.marca,
        model: item.modelo,
        unit: item.unidade,
        type: item.tipo === "SERVICO" ? "SERVICE" : "MATERIAL",
        taxRate,
        supplierIds: [...new Set(supplierIds)].sort(),
        supplierNames: [...new Set(supplierIds)]
          .sort()
          .map((id) => suppliers.find((s) => s.id === id)!.legalName),
      });
    }
    const existing = await tx.catalogProduct.findMany({
      where: {
        OR: rows.map((r) => ({
          description: { equals: r.description, mode: "insensitive" },
          brand:
            r.brand === null ? null : { equals: r.brand, mode: "insensitive" },
          model:
            r.model === null ? null : { equals: r.model, mode: "insensitive" },
          unit: r.unit,
          type: r.type,
        })),
      },
      select: { id: true, description: true },
    });
    if (existing.length)
      throw new BusinessError(
        `Já existe item equivalente no catálogo: ${existing[0].description.slice(0, 100)}. A carga não atualiza registros existentes.`,
      );
  }
  return {
    token: hash(
      JSON.stringify({ fingerprint: input.fingerprint, version, rows }),
    ),
    version,
    rows,
    loteId: document.loteId,
    warnings,
  };
}
async function previousResult(
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof inputs>,
): Promise<ImportResult | null> {
  const previous = await tx.auditLog.findFirst({
    where: { entity: "ImportBatch", entityId: input.key },
  });
  if (!previous) return null;
  const saved = z
    .object({
      fingerprint: z.string(),
      result: z.object({
        count: z.number(),
        loteId: z.string(),
        alreadyImported: z.boolean(),
      }),
    })
    .parse(previous.changes);
  if (saved.fingerprint !== input.fingerprint)
    throw new BusinessError(
      "O loteId já foi utilizado com outro conteúdo ou complemento. Use um novo loteId.",
    );
  return { ...saved.result, alreadyImported: true };
}
export async function previewImport(
  db: PrismaClient,
  text: string,
  kind: ImportKind,
  target: string | undefined,
  defaults: unknown,
) {
  const input = inputs(text, kind, target, defaults);
  return db.$transaction(
    async (tx) =>
      (await previousResult(tx, input)) ?? prepare(tx, input, target),
    { timeout: 20000 },
  );
}
export async function commitImport(
  db: PrismaClient,
  actorId: string,
  text: string,
  kind: ImportKind,
  target: string | undefined,
  defaults: unknown,
  token: string,
): Promise<ImportResult> {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const input = inputs(text, kind, target, defaults);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${kind === "catalogo" ? "govnex:catalog-import" : input.key},0))`;
      const previous = await previousResult(tx, input);
      if (previous) return previous;
      if (kind === "contratacao")
        await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id" = ${target} FOR UPDATE`;
      // Lock supplier rows in the same order as catalog saves, then resolve again.
      const initial = await prepare(tx, input, target);
      const supplierIds = [
        ...new Set(initial.rows.flatMap((r) => r.supplierIds)),
      ].sort();
      if (supplierIds.length)
        await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" IN (${Prisma.join(supplierIds)}) ORDER BY "id" FOR UPDATE`;
      const productIds =
        kind === "contratacao"
          ? [
              ...new Set(
                initial.rows.flatMap((r) =>
                  r.catalogProductId ? [r.catalogProductId] : [],
                ),
              ),
            ].sort()
          : [];
      if (productIds.length)
        await tx.$queryRaw`SELECT "id" FROM "CatalogProduct" WHERE "id" IN (${Prisma.join(productIds)}) ORDER BY "id" FOR UPDATE`;
      const prepared = await prepare(tx, input, target);
      if (prepared.token !== token)
        throw new BusinessError(
          "Os dados mudaram desde a prévia. Valide o arquivo novamente antes de confirmar.",
        );
      const createdIds = prepared.rows.map(() => id());
      if (kind === "catalogo") {
        await tx.catalogProduct.createMany({
          data: prepared.rows.map((r, index) => ({
            id: createdIds[index],
            description: r.description,
            brand: r.brand,
            model: r.model,
            unit: r.unit,
            type: r.type,
            taxRate: r.taxRate!,
            supplierId: r.supplierIds[0],
          })),
        });
        await tx.catalogSupplier.createMany({
          data: prepared.rows.flatMap((r, index) =>
            r.supplierIds.map((supplierId) => ({
              catalogProductId: createdIds[index],
              supplierId,
            })),
          ),
        });
      } else {
        const parent = await tx.opportunity.findUniqueOrThrow({
          where: { id: target },
          include: { items: true },
        });
        const total = itemsTotal([
          ...parent.items.map((i) => ({
            quantity: i.quantity.toFixed(3),
            unitPrice: i.unitPrice?.toFixed(4) ?? null,
          })),
          ...prepared.rows.map((r) => ({
            quantity: r.quantity!,
            unitPrice: r.unitPrice ?? null,
          })),
        ]).total;
        await tx.opportunity.update({
          where: { id: target },
          data: { version: { increment: 1 }, estimatedValue: total },
        });
        await tx.opportunityItem.createMany({
          data: prepared.rows.map((r, index) => ({
            id: createdIds[index],
            opportunityId: target!,
            number: r.number!,
            description: r.description,
            brand: r.brand,
            model: r.model,
            unit: r.unit,
            type: r.type,
            quantity: r.quantity!,
            unitPrice: r.unitPrice ?? null,
            total: itemTotal(r.quantity!, r.unitPrice ?? null),
            catalogProductId: r.catalogProductId ?? null,
            taxRate: r.taxRate,
            winner: false,
          })),
        });
        await tx.auditLog.create({
          data: {
            actorId,
            entity: "Opportunity",
            entityId: target,
            action: "IMPORT_ITEMS",
            changes: JSON.parse(
              JSON.stringify({
                loteId: prepared.loteId,
                addedIds: createdIds,
                items: prepared.rows,
              }),
            ),
          },
        });
      }
      const result = {
        count: createdIds.length,
        loteId: prepared.loteId,
        alreadyImported: false,
      };
      await tx.auditLog.create({
        data: {
          actorId,
          entity: "ImportBatch",
          entityId: input.key,
          action: "IMPORT",
          changes: JSON.parse(
            JSON.stringify({
              fingerprint: input.fingerprint,
              kind,
              target: target ?? null,
              origin: input.document.origem,
              result,
              createdIds,
              items: prepared.rows,
            }),
          ),
        },
      });
      return result;
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
