import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { contactSchema } from "@/lib/agenda";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
export const contactFilters = z.object({
  q: z.string().trim().max(120).default(""),
  organizationId: z
    .union([idSchema, z.literal(""), z.literal("none")])
    .default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export async function listContacts(db: PrismaClient, input: unknown) {
  const { q, organizationId, page } = contactFilters.parse(input);
  const where: Prisma.ContactWhereInput = {
    ...(organizationId
      ? { organizationId: organizationId === "none" ? null : organizationId }
      : {}),
    ...(q
      ? {
          OR: ["name", "email", "phone", "position"].map((field) => ({
            [field]: { contains: q, mode: "insensitive" },
          })),
        }
      : {}),
  };
  const [items, count] = await db.$transaction([
    db.contact.findMany({
      where,
      include: { organization: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.contact.count({ where }),
  ]);
  return { items, count, page, pages: Math.max(1, Math.ceil(count / 20)) };
}
export async function saveContact(
  db: PrismaClient,
  actorId: string,
  input: unknown,
  id?: string,
  version?: number,
) {
  const data = contactSchema.parse(input);
  if (id) {
    idSchema.parse(id);
    z.number().int().positive().parse(version);
  }
  return db.$transaction(async (tx) => {
    // Same organization lock as its editor; versions invalidate stale embedded forms.
    const before = id ? await tx.contact.findUnique({ where: { id } }) : null;
    if (id && !before) throw new BusinessError("Contato não encontrado.");
    const organizations = [
      ...new Set(
        [before?.organizationId, data.organizationId].filter(
          (v): v is string => !!v,
        ),
      ),
    ].sort();
    for (const organizationId of organizations) {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
      if (
        !(await tx.organization.findUnique({ where: { id: organizationId } }))
      )
        throw new BusinessError("Organização não encontrada.");
    }
    if (id) {
      const changed = await tx.contact.updateMany({
        where: { id, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new BusinessError(
          "O contato foi alterado. Atualize a página antes de salvar.",
        );
    }
    const result = id
      ? await tx.contact.findUniqueOrThrow({ where: { id } })
      : await tx.contact.create({ data });
    await tx.organization.updateMany({
      where: { id: { in: organizations } },
      data: { version: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Contact",
        entityId: result.id,
        action: id ? "UPDATE" : "CREATE",
        changes: JSON.parse(JSON.stringify({ before, after: result })),
      },
    });
    return result;
  });
}
export async function deleteContact(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  await db.$transaction(async (tx) => {
    const before = await tx.contact.findUnique({ where: { id } });
    if (!before) throw new BusinessError("Contato não encontrado.");
    if (before.organizationId)
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${before.organizationId} FOR UPDATE`;
    const result = await tx.contact.deleteMany({ where: { id, version } });
    if (!result.count)
      throw new BusinessError("O contato foi alterado. Atualize a página.");
    if (before.organizationId)
      await tx.organization.update({
        where: { id: before.organizationId },
        data: { version: { increment: 1 } },
      });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Contact",
        entityId: id,
        action: "DELETE",
        changes: JSON.parse(JSON.stringify({ before })),
      },
    });
  });
}
