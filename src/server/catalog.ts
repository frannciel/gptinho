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
  const { supplierIds, ...data } = catalogSchema.parse(input);
  if (id) {
    idSchema.parse(id);
    z.number().int().positive().parse(version);
  }
  return db.$transaction(async (tx) => {
    const before = id
      ? await tx.catalogProduct.findUnique({
          where: { id },
          include: { suppliers: true },
        })
      : null;
    for (const supplierId of [...supplierIds].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${supplierId} FOR UPDATE`;
      const supplier = await tx.organization.findUnique({
        where: { id: supplierId },
      });
      if (
        !supplier?.roles.includes("SUPPLIER") ||
        (!supplier.active &&
          !before?.suppliers.some((s) => s.supplierId === supplierId))
      )
        throw new BusinessError("Selecione fornecedores ativos.");
    }
    const payload = { ...data, supplierId: supplierIds[0] };
    let product;
    if (id) {
      const updated = await tx.catalogProduct.updateMany({
        where: { id, version },
        data: { ...payload, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new BusinessError("O item foi alterado. Atualize a página.");
      product = await tx.catalogProduct.findUniqueOrThrow({ where: { id } });
    } else product = await tx.catalogProduct.create({ data: payload });
    await tx.catalogSupplier.deleteMany({
      where: { catalogProductId: product.id },
    });
    await tx.catalogSupplier.createMany({
      data: supplierIds.map((supplierId) => ({
        catalogProductId: product.id,
        supplierId,
      })),
    });
    const after = await tx.catalogProduct.findUniqueOrThrow({
      where: { id: product.id },
      include: { suppliers: true },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "CatalogProduct",
        entityId: product.id,
        action: id ? "UPDATE" : "CREATE",
        changes: JSON.parse(JSON.stringify({ before, after })),
      },
    });
    return product;
  });
}
