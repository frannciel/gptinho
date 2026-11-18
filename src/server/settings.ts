import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { companySchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
export async function saveCompany(
  db: PrismaClient,
  actorId: string,
  input: unknown,
  version: number,
) {
  const data = companySchema.parse(input);
  z.number().int().nonnegative().parse(version);
  await db.$transaction(async (tx) => {
    const before = await tx.companySettings.findUnique({
      where: { id: "company" },
    });
    if (!before && version === 0)
      await tx.companySettings.create({ data: { id: "company", ...data } });
    else {
      const result = await tx.companySettings.updateMany({
        where: { id: "company", version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!result.count)
        throw new BusinessError(
          "Configurações alteradas por outro usuário. Atualize a página.",
        );
    }
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "CompanySettings",
        entityId: "company",
        action: "UPDATE",
        changes: JSON.parse(JSON.stringify({ before, after: data })),
      },
    });
  });
}
