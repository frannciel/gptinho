import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { day, documentUrl, optionalText } from "@/lib/contracts";
import { BusinessError } from "@/lib/errors";
export const priceRegistrationSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .transform((v) => v.toUpperCase()),
    signatureDate: day,
    validUntil: day,
    allowsAdhesion: z.boolean(),
    documentUrl,
    notes: optionalText,
    itemIds: z
      .array(idSchema)
      .min(1, "Selecione ao menos um item.")
      .max(1000)
      .refine((ids) => new Set(ids).size === ids.length, "Item repetido."),
  })
  .strict()
  .refine((v) => v.validUntil >= v.signatureDate, {
    message: "A validade não pode ser anterior à assinatura.",
    path: ["validUntil"],
  });
async function lock(
  tx: Prisma.TransactionClient,
  opportunityId: string,
  version: number,
) {
  idSchema.parse(opportunityId);
  z.number().int().positive().parse(version);
  await tx.$queryRaw`SELECT id FROM "Opportunity" WHERE id = ${opportunityId} FOR UPDATE`;
  const o = await tx.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
  });
  if (o.archived)
    throw new BusinessError(
      "Restaure a contratação antes de alterar seus registros.",
    );
  if (!o.isSrp)
    throw new BusinessError(
      "Marque Registro de Preços na contratação antes de cadastrar atas ou participantes.",
    );
  if (o.version !== version)
    throw new BusinessError("A contratação foi alterada. Atualize a página.");
  return o;
}
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  opportunityId: string,
  entity: string,
  entityId: string,
  action: string,
  changes: unknown,
) {
  await tx.opportunity.update({
    where: { id: opportunityId },
    data: { version: { increment: 1 } },
  });
  await tx.auditLog.create({
    data: {
      actorId,
      entity,
      entityId,
      action,
      changes: JSON.parse(JSON.stringify(changes)),
    },
  });
  await tx.auditLog.create({
    data: {
      actorId,
      entity: "Opportunity",
      entityId: opportunityId,
      action: "UPDATE",
      changes: { module: entity, recordId: entityId, operation: action },
    },
  });
}
export async function savePriceRegistration(
  db: PrismaClient,
  actorId: string,
  opportunityId: string,
  version: number,
  input: unknown,
  id?: string,
) {
  const { itemIds, ...data } = priceRegistrationSchema.parse(input);
  if (id) idSchema.parse(id);
  return db.$transaction(async (tx) => {
    await lock(tx, opportunityId, version);
    const before = id
      ? await tx.priceRegistration.findFirst({
          where: { id, opportunityId },
          include: { items: true },
        })
      : null;
    if (id && !before)
      throw new BusinessError("Ata não encontrada nesta contratação.");
    if (
      await tx.priceRegistration.findFirst({
        where: {
          opportunityId,
          reference: data.reference,
          ...(id ? { id: { not: id } } : {}),
        },
      })
    )
      throw new BusinessError("Número de ata já cadastrado nesta contratação.");
    const source = await tx.opportunityItem.findMany({
      where: { id: { in: itemIds }, opportunityId },
    });
    if (source.length !== itemIds.length)
      throw new BusinessError("Selecione apenas itens desta contratação.");
    const rows = source.map((i) => {
      const previous = before?.items.find((r) => r.sourceItemId === i.id);
      const price = previous?.unitPrice ?? i.winningUnitPrice ?? i.unitPrice;
      if (price === null)
        throw new BusinessError(
          `Informe o valor do item ${i.number} na contratação antes de vinculá-lo à ata.`,
        );
      return {
        sourceItemId: i.id,
        number: previous?.number ?? i.number,
        description: previous?.description ?? i.description,
        quantity: previous?.quantity ?? i.quantity,
        unitPrice: price,
      };
    });
    const result = before
      ? await tx.priceRegistration.update({
          where: { id: before.id },
          data: {
            ...data,
            version: { increment: 1 },
            items: {
              deleteMany: { sourceItemId: { notIn: itemIds } },
              create: rows.filter(
                (row) =>
                  !before.items.some(
                    (old) => old.sourceItemId === row.sourceItemId,
                  ),
              ),
            },
          },
          include: { items: true },
        })
      : await tx.priceRegistration.create({
          data: { ...data, opportunityId, items: { create: rows } },
          include: { items: true },
        });
    await audit(
      tx,
      actorId,
      opportunityId,
      "PriceRegistration",
      result.id,
      before ? "UPDATE" : "CREATE",
      { before, after: result },
    );
    return result;
  });
}
export async function deletePriceRegistration(
  db: PrismaClient,
  actorId: string,
  opportunityId: string,
  version: number,
  id: string,
) {
  idSchema.parse(id);
  return db.$transaction(async (tx) => {
    await lock(tx, opportunityId, version);
    const before = await tx.priceRegistration.findFirst({
      where: { id, opportunityId },
      include: { items: true },
    });
    if (!before) throw new BusinessError("Ata não encontrada.");
    await tx.priceRegistration.delete({ where: { id } });
    await audit(tx, actorId, opportunityId, "PriceRegistration", id, "DELETE", {
      before,
    });
  });
}
export async function changeParticipant(
  db: PrismaClient,
  actorId: string,
  opportunityId: string,
  version: number,
  organizationId: string,
  remove: boolean,
) {
  idSchema.parse(organizationId);
  return db.$transaction(async (tx) => {
    const o = await lock(tx, opportunityId, version);
    const key = { opportunityId, organizationId };
    if (remove) {
      const result = await tx.opportunityParticipant.deleteMany({ where: key });
      if (!result.count)
        throw new BusinessError("Participante não encontrado.");
    } else {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (organizationId === o.organizationId)
        throw new BusinessError(
          "O órgão gerenciador não pode ser participante.",
        );
      if (!org?.active || !org.roles.includes("PUBLIC_AGENCY"))
        throw new BusinessError("Selecione um órgão público ativo.");
      if (
        await tx.opportunityParticipant.findUnique({
          where: { opportunityId_organizationId: key },
        })
      )
        throw new BusinessError("Este órgão já participa da contratação.");
      await tx.opportunityParticipant.create({ data: key });
    }
    await audit(
      tx,
      actorId,
      opportunityId,
      "OpportunityParticipant",
      opportunityId,
      remove ? "DELETE" : "CREATE",
      key,
    );
  });
}
