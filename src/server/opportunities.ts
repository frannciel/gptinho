import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
import {
  opportunitySchema,
  opportunityFilters,
} from "@/lib/opportunity-validation";
import {
  OPEN_OPPORTUNITY_STATUSES,
  DEADLINE_OPPORTUNITY_STATUSES,
} from "@/lib/opportunity-values";
import { itemsTotal } from "@/lib/contracting-items";
const includeItems = { items: { orderBy: { number: "asc" as const } } };
export async function saveOpportunity(
  db: PrismaClient,
  actorId: string,
  input: unknown,
  id?: string,
  version?: number,
) {
  const { items, ...data } = opportunitySchema.parse(input);
  const calculated = itemsTotal(items);
  if (id) {
    idSchema.parse(id);
    z.number().int().positive().parse(version);
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${data.organizationId} FOR UPDATE`;
      const before = id
        ? await tx.opportunity.findUnique({
            where: { id },
            include: includeItems,
          })
        : null;
      if (id && !before) throw new BusinessError("Contratação não encontrada.");
      if (before?.archived)
        throw new BusinessError("Restaure a contratação antes de editar.");
      const agency = await tx.organization.findUnique({
        where: { id: data.organizationId },
      });
      if (!agency?.roles.includes("PUBLIC_AGENCY"))
        throw new BusinessError("Selecione um órgão público válido.");
      if (!agency.active && before?.organizationId !== agency.id)
        throw new BusinessError(
          "Selecione um órgão público ativo para criar ou transferir a contratação.",
        );
      const owned = new Set(before?.items.map((item) => item.id) ?? []);
      for (const item of items)
        if (item.id && !owned.has(item.id))
          throw new BusinessError(
            "Um dos itens não pertence a esta contratação. Atualize a página.",
          );
      for (const item of items) {
        if (item.supplierId) {
          await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${item.supplierId} FOR UPDATE`;
          const supplier = await tx.organization.findUnique({
            where: { id: item.supplierId },
          });
          const old = before?.items.find((i) => i.id === item.id);
          if (
            !supplier?.roles.includes("SUPPLIER") ||
            (!supplier.active && old?.supplierId !== supplier.id)
          )
            throw new BusinessError(
              "Selecione um fornecedor ativo para o item.",
            );
        }
      }
      itemsTotal(
        items
          .filter(
            (item) =>
              item.winner ??
              before?.items.find((old) => old.id === item.id)?.winner ??
              false,
          )
          .map((item) => ({
            quantity: item.quantity,
            unitPrice:
              before?.items
                .find((old) => old.id === item.id)
                ?.winningUnitPrice?.toFixed(4) ?? null,
          })),
      );
      const payload = {
        ...data,
        estimatedValue:
          calculated.total === null
            ? null
            : new Prisma.Decimal(calculated.total),
      };
      let parentId = id;
      if (id) {
        const result = await tx.opportunity.updateMany({
          where: { id, version, archived: false },
          data: { ...payload, version: { increment: 1 } },
        });
        if (!result.count)
          throw new BusinessError(
            "A contratação foi alterada por outro usuário. Atualize a página antes de salvar.",
          );
      } else parentId = (await tx.opportunity.create({ data: payload })).id;
      const kept = items.flatMap((item) => (item.id ? [item.id] : []));
      if (before)
        await tx.opportunityItem.deleteMany({
          where: { opportunityId: parentId, id: { notIn: kept } },
        });
      const newItems: Prisma.OpportunityItemCreateManyInput[] = [];
      for (const [index, item] of items.entries()) {
        const { id: itemId, ...fields } = item;
        const old = before?.items.find((i) => i.id === itemId);
        const resetPricing =
          old && item.catalogProductId !== old.catalogProductId;
        const row = {
          ...(resetPricing
            ? {
                acquisitionUnit: null,
                freightUnit: null,
                netProfitRate: null,
                pricingAdministrativeRate: null,
                minimumPrice: null,
                pricingSnapshot: Prisma.DbNull,
                supplierId: null,
              }
            : {}),
          ...fields,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice:
            item.unitPrice === null ? null : new Prisma.Decimal(item.unitPrice),
          total:
            calculated.lines[index] === null
              ? null
              : new Prisma.Decimal(calculated.lines[index]!),
        };
        if (itemId)
          await tx.opportunityItem.update({ where: { id: itemId }, data: row });
        else newItems.push({ ...row, opportunityId: parentId! });
      }
      if (newItems.length)
        await tx.opportunityItem.createMany({ data: newItems });
      const after = await tx.opportunity.findUniqueOrThrow({
        where: { id: parentId },
        include: includeItems,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Opportunity",
          entityId: after.id,
          action: id ? "UPDATE" : "CREATE",
          changes: JSON.parse(JSON.stringify({ before, after })),
        },
      });
      return after;
    },
    { maxWait: 10000, timeout: 20000 },
  );
}
export async function archiveOpportunity(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  archived: boolean,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  z.boolean().parse(archived);
  return db.$transaction(async (tx) => {
    const before = await tx.opportunity.findUnique({
      where: { id },
      include: includeItems,
    });
    if (!before) throw new BusinessError("Contratação não encontrada.");
    const result = await tx.opportunity.updateMany({
      where: { id, version, archived: !archived },
      data: { archived, version: { increment: 1 } },
    });
    if (!result.count)
      throw new BusinessError(
        "A contratação foi alterada. Atualize a página antes de continuar.",
      );
    const after = await tx.opportunity.findUniqueOrThrow({
      where: { id },
      include: includeItems,
    });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Opportunity",
        entityId: id,
        action: archived ? "ARCHIVE" : "RESTORE",
        changes: JSON.parse(JSON.stringify({ before, after })),
      },
    });
    return after;
  });
}
export function opportunityWhere(
  params: unknown,
  now = new Date(),
): Prisma.OpportunityWhereInput {
  const filters = opportunityFilters.parse(params);
  const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    ...(filters.archived === "all"
      ? {}
      : { archived: filters.archived === "archived" }),
    ...(filters.status === "all" ? {} : { status: filters.status }),
    ...(filters.organizationId
      ? { organizationId: filters.organizationId }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { reference: { contains: filters.q, mode: "insensitive" } },
            { subject: { contains: filters.q, mode: "insensitive" } },
            { processNumber: { contains: filters.q, mode: "insensitive" } },
            {
              organization: {
                legalName: { contains: filters.q, mode: "insensitive" },
              },
            },
            {
              organization: {
                acronym: { contains: filters.q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
    ...(filters.deadline === "overdue"
      ? { proposalDeadline: { lt: now } }
      : filters.deadline === "next7days"
        ? { proposalDeadline: { gte: now, lte: until } }
        : filters.deadline === "without"
          ? { proposalDeadline: null }
          : {}),
  };
}
export async function listOpportunities(
  db: PrismaClient,
  params: unknown,
  now = new Date(),
) {
  const filters = opportunityFilters.parse(params);
  const where = opportunityWhere(filters, now);
  const orderBy: Prisma.OpportunityOrderByWithRelationInput[] =
    filters.sort === "deadline"
      ? [
          { proposalDeadline: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
          { id: "asc" },
        ]
      : filters.sort === "value"
        ? [{ estimatedValue: { sort: "desc", nulls: "last" } }, { id: "asc" }]
        : filters.sort === "reference"
          ? [{ reference: "asc" }, { id: "asc" }]
          : [{ createdAt: "desc" }, { id: "desc" }];
  return db.$transaction(async (tx) => {
    const count = await tx.opportunity.count({ where });
    const pages = Math.max(1, Math.ceil(count / 20));
    const page = Math.min(filters.page, pages);
    const items = await tx.opportunity.findMany({
      where,
      include: {
        organization: {
          select: { id: true, legalName: true, acronym: true, active: true },
        },
      },
      orderBy,
      skip: (page - 1) * 20,
      take: 20,
    });
    return { items, count, page, pages };
  });
}
export async function getOpportunityStats(db: PrismaClient, now = new Date()) {
  const where: Prisma.OpportunityWhereInput = {
    archived: false,
    status: { in: [...OPEN_OPPORTUNITY_STATUSES] },
  };
  const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [open, overdue, dueSoon, values, upcoming] = await db.$transaction([
    db.opportunity.count({ where }),
    db.opportunity.count({
      where: {
        ...where,
        status: { in: [...DEADLINE_OPPORTUNITY_STATUSES] },
        proposalDeadline: { lt: now },
      },
    }),
    db.opportunity.count({
      where: {
        ...where,
        status: { in: [...DEADLINE_OPPORTUNITY_STATUSES] },
        proposalDeadline: { gte: now, lte: until },
      },
    }),
    db.opportunity.aggregate({
      where,
      _sum: { estimatedValue: true },
      _count: { estimatedValue: true },
    }),
    db.opportunity.findMany({
      where: {
        ...where,
        status: { in: [...DEADLINE_OPPORTUNITY_STATUSES] },
        proposalDeadline: { gte: now, lte: until },
      },
      include: { organization: { select: { legalName: true } } },
      orderBy: [{ proposalDeadline: "asc" }, { id: "asc" }],
      take: 5,
    }),
  ]);
  return {
    open,
    overdue,
    dueSoon,
    estimatedValue: values._sum.estimatedValue?.toFixed(2) ?? null,
    withValue: values._count.estimatedValue,
    upcoming,
  };
}
export async function getOpportunityDetail(db: PrismaClient, id: string) {
  idSchema.parse(id);
  const opportunity = await db.opportunity.findUnique({
    where: { id },
    include: {
      organization: true,
      _count: { select: { contracts: true } },
      ...includeItems,
    },
  });
  if (!opportunity) return null;
  const [duplicates, history] = await Promise.all([
    opportunity.processNumber
      ? db.opportunity.findMany({
          where: {
            id: { not: id },
            organizationId: opportunity.organizationId,
            processNumber: opportunity.processNumber,
          },
          select: { id: true, reference: true, archived: true },
          take: 5,
        })
      : Promise.resolve([]),
    db.auditLog.findMany({
      where: { entity: "Opportunity", entityId: id },
      include: { actor: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);
  return { opportunity, duplicates, history };
}

export async function deleteOpportunity(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.opportunity.findUnique({
        where: { id },
        include: includeItems,
      });
      if (!before) throw new BusinessError("Contratação não encontrada.");
      if (before.archived)
        throw new BusinessError(
          "Contratações arquivadas não podem ser excluídas.",
        );
      if (before.version !== version)
        throw new BusinessError(
          "A contratação foi alterada. Atualize a página antes de excluir.",
        );
      if (await tx.contract.count({ where: { opportunityId: id } }))
        throw new BusinessError(
          "Contratações com contratos associados não podem ser excluídas.",
        );
      await tx.opportunityItem.deleteMany({ where: { opportunityId: id } });
      await tx.opportunity.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Opportunity",
          entityId: id,
          action: "DELETE",
          changes: JSON.parse(JSON.stringify({ before, after: null })),
        },
      });
    },
    { timeout: 20000 },
  );
}
