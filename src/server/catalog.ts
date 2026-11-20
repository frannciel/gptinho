import { z } from "zod";
import { type PrismaClient } from "@prisma/client";
import { catalogSchema } from "@/lib/catalog-validation";
import { BusinessError } from "@/lib/errors";
import { idSchema } from "@/lib/validation";
export async function saveCatalog(
  db: PrismaClient,
  actorId: string,
  input: unknown,
  id?: string,
  version?: number,
) {
  const data = catalogSchema.parse(input);
  if (id) {
    idSchema.parse(id);
    z.number().int().positive().parse(version);
  }
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${data.supplierId} FOR UPDATE`;
    const before = id
      ? await tx.catalogProduct.findUnique({ where: { id } })
      : null;
    const supplier = await tx.organization.findUnique({
      where: { id: data.supplierId },
    });
    if (
      !supplier?.roles.includes("SUPPLIER") ||
      (!supplier.active && before?.supplierId !== supplier.id)
    )
      throw new BusinessError("Selecione um fornecedor ativo.");
    let product;
    if (id) {
      const updated = await tx.catalogProduct.updateMany({
        where: { id, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new BusinessError("O item foi alterado. Atualize a página.");
      product = await tx.catalogProduct.findUniqueOrThrow({ where: { id } });
    } else product = await tx.catalogProduct.create({ data });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "CatalogProduct",
        entityId: product.id,
        action: id ? "UPDATE" : "CREATE",
        changes: JSON.parse(JSON.stringify({ before, after: product })),
      },
    });
    return product;
  });
}
