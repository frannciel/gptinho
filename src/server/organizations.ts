import type { OrganizationRole, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { organizationSchema, idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
export const listSchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["active", "inactive", "all"]).default("active"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export async function listOrganizations(
  db: PrismaClient,
  role: OrganizationRole,
  params: unknown,
) {
  const { q, status, page } = listSchema.parse(params);
  const where = {
    roles: { has: role },
    ...(status === "all" ? {} : { active: status === "active" }),
    ...(q
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" as const } },
            { tradeName: { contains: q, mode: "insensitive" as const } },
            { acronym: { contains: q, mode: "insensitive" as const } },
            { cnpj: { contains: q.replace(/[.\/-]/g, "").toUpperCase() } },
            { uasg: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, count] = await db.$transaction([
    db.organization.findMany({
      where,
      orderBy: [{ legalName: "asc" }, { id: "asc" }],
      skip: (page - 1) * 20,
      take: 20,
      include: { contacts: true },
    }),
    db.organization.count({ where }),
  ]);
  return { items, count, page, pages: Math.max(1, Math.ceil(count / 20)) };
}
export async function saveOrganization(
  db: PrismaClient,
  actorId: string,
  input: unknown,
  id?: string,
  version?: number,
) {
  const { contacts, ...data } = organizationSchema.parse(input);
  if (id) {
    idSchema.parse(id);
    z.number().int().positive().parse(version);
  }
  return db.$transaction(async (tx) => {
    if (id)
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${id} FOR UPDATE`;
    const before = id
      ? await tx.organization.findUnique({
          where: { id },
          include: { contacts: true },
        })
      : null;
    if (id && !before) throw new BusinessError("Registro não encontrado.");
    if (
      id &&
      !data.roles.includes("PUBLIC_AGENCY") &&
      (await tx.opportunity.count({ where: { organizationId: id } }))
    )
      throw new BusinessError(
        "Este órgão possui contratações vinculadas e não pode perder o papel de órgão público. Você pode desativá-lo preservando o histórico.",
      );
    if (
      id &&
      !data.roles.includes("SUPPLIER") &&
      ((await tx.catalogProduct.count({ where: { supplierId: id } })) ||
        (await tx.opportunityItem.count({ where: { supplierId: id } })))
    )
      throw new BusinessError(
        "Este fornecedor possui itens vinculados. Desative-o para preservar o histórico.",
      );
    if (id) {
      const update = await tx.organization.updateMany({
        where: { id, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!update.count)
        throw new BusinessError(
          "Este cadastro foi alterado por outro usuário. Atualize a página antes de salvar.",
        );
      await tx.contact.deleteMany({ where: { organizationId: id } });
      if (contacts.length)
        await tx.contact.createMany({
          data: contacts.map((contact) => ({ ...contact, organizationId: id })),
        });
    }
    const result = id
      ? await tx.organization.findUniqueOrThrow({
          where: { id },
          include: { contacts: true },
        })
      : await tx.organization.create({
          data: { ...data, contacts: { create: contacts } },
          include: { contacts: true },
        });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Organization",
        entityId: result.id,
        action: id ? "UPDATE" : "CREATE",
        changes: JSON.parse(JSON.stringify({ before, after: result })),
      },
    });
    return result;
  });
}
export async function deleteOrganization(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id },
      include: { contacts: true },
    });
    if (!before) throw new BusinessError("Registro não encontrado.");
    if (before.roles.length > 1)
      throw new BusinessError(
        "A organização possui dois papéis. Desative-a ou remova um papel antes de excluir.",
      );
    const result = await tx.organization.deleteMany({ where: { id, version } });
    if (!result.count)
      throw new BusinessError(
        "O cadastro foi alterado. Atualize a página antes de excluir.",
      );
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Organization",
        entityId: id,
        action: "DELETE",
        changes: JSON.parse(JSON.stringify({ before })),
      },
    });
  });
}
