import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
import {
  opportunitySchema,
  opportunityFilters,
} from "@/lib/opportunity-validation";
import { OPEN_OPPORTUNITY_STATUSES } from "@/lib/opportunity-values";
export async function saveOpportunity(
  db: PrismaClient,
  actorId: string,
  input: unknown,
  id?: string,
  version?: number,
) {
  const data = opportunitySchema.parse(input);
  if (id) {
    idSchema.parse(id);
    z.number().int().positive().parse(version);
  }
  return db.$transaction(async (tx) => {
    // Share the organization lock with organization edits to protect its public-agency role.
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${data.organizationId} FOR UPDATE`;
    const before = id
      ? await tx.opportunity.findUnique({ where: { id } })
      : null;
    if (id && !before) throw new BusinessError("Oportunidade não encontrada.");
    if (before?.archived)
      throw new BusinessError("Restaure a oportunidade antes de editar.");
    const agency = await tx.organization.findUnique({
      where: { id: data.organizationId },
    });
    if (!agency?.roles.includes("PUBLIC_AGENCY"))
      throw new BusinessError("Selecione um órgão público válido.");
    if (!agency.active && before?.organizationId !== agency.id)
      throw new BusinessError(
        "Selecione um órgão público ativo para criar ou transferir a oportunidade.",
      );
    const payload = {
      ...data,
      estimatedValue:
        data.estimatedValue === null
          ? null
          : new Prisma.Decimal(data.estimatedValue),
    };
    if (id) {
      const updated = await tx.opportunity.updateMany({
        where: { id, version, archived: false },
        data: { ...payload, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new BusinessError(
          "A oportunidade foi alterada por outro usuário. Atualize a página antes de salvar.",
        );
    }
    const after = id
      ? await tx.opportunity.findUniqueOrThrow({ where: { id } })
      : await tx.opportunity.create({ data: payload });
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
  });
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
    const before = await tx.opportunity.findUnique({ where: { id } });
    if (!before) throw new BusinessError("Oportunidade não encontrada.");
    const result = await tx.opportunity.updateMany({
      where: { id, version, archived: !archived },
      data: { archived, version: { increment: 1 } },
    });
    if (!result.count)
      throw new BusinessError(
        "A oportunidade foi alterada. Atualize a página antes de continuar.",
      );
    const after = await tx.opportunity.findUniqueOrThrow({ where: { id } });
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
          : [{ createdAt: "desc" }, { id: "asc" }];
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
      where: { ...where, proposalDeadline: { lt: now } },
    }),
    db.opportunity.count({
      where: { ...where, proposalDeadline: { gte: now, lte: until } },
    }),
    db.opportunity.aggregate({
      where,
      _sum: { estimatedValue: true },
      _count: { estimatedValue: true },
    }),
    db.opportunity.findMany({
      where: { ...where, proposalDeadline: { gte: now, lte: until } },
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
    include: { organization: true },
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
      take: 10,
    }),
  ]);
  return { opportunity, duplicates, history };
}
