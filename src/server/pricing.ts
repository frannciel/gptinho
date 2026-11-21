import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  pricingSchema,
  minimumViablePrice,
  monetary4,
  winnerTotals,
} from "@/lib/pricing";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
async function changeItem(
  db: PrismaClient,
  actorId: string,
  id: string,
  itemId: string,
  version: number,
  operation: "PRICE" | "WINNER" | "WINNING_PRICE",
  value: unknown,
  nextStatus?: "CLASSIFIED" | "HOMOLOGATED",
) {
  idSchema.parse(id);
  idSchema.parse(itemId);
  z.number().int().positive().parse(version);
  return db.$transaction(
    async (tx) => {
      const parent = await tx.opportunity.findUnique({ where: { id } });
      if (!parent || parent.archived)
        throw new BusinessError("Contratação indisponível para edição.");
      const before = await tx.opportunityItem.findFirst({
        where: { id: itemId, opportunityId: id },
      });
      if (!before)
        throw new BusinessError("Item não encontrado nesta contratação.");
      let data: Prisma.OpportunityItemUpdateInput;
      let statusChange: "CLASSIFIED" | "HOMOLOGATED" | undefined;
      if (operation === "PRICE") {
        const input = pricingSchema.parse(value);
        if (!before.catalogProductId)
          throw new BusinessError(
            "Vincule o item ao catálogo antes de precificar.",
          );
        await tx.$queryRaw`SELECT "id" FROM "CatalogProduct" WHERE "id" = ${before.catalogProductId} FOR UPDATE`;
        const membership = await tx.catalogSupplier.findUnique({
          where: {
            catalogProductId_supplierId: {
              catalogProductId: before.catalogProductId,
              supplierId: input.supplierId,
            },
          },
          include: { supplier: true },
        });
        if (
          !membership?.supplier.active ||
          !membership.supplier.roles.includes("SUPPLIER")
        )
          throw new BusinessError(
            "Selecione um fornecedor ativo da lista deste item do catálogo.",
          );
        const minimumPrice = minimumViablePrice(input);
        const { supplierId, ...fields } = input;
        data = {
          ...fields,
          supplier: { connect: { id: supplierId } },
          minimumPrice,
          pricingSnapshot: {
            ...input,
            minimumPrice,
            formulaVersion: "1",
            rounding: "HALF_UP",
            unitScale: 4,
            totalScale: 2,
            catalogProductId: before.catalogProductId,
            itemNumber: before.number,
            quantity: before.quantity.toFixed(3),
            referenceUnitPrice: before.unitPrice?.toFixed(4) ?? null,
            calculatedAt: new Date().toISOString(),
          },
        };
      } else if (operation === "WINNER") {
        const winner = z.boolean().parse(value);
        const candidates = await tx.opportunityItem.findMany({
          where: { opportunityId: id, OR: [{ winner: true }, { id: itemId }] },
        });
        winnerTotals(
          candidates
            .filter((i) => i.id !== itemId || winner)
            .map((i) => ({
              quantity: i.quantity.toFixed(3),
              unitPrice: i.winningUnitPrice?.toFixed(4) ?? null,
            })),
        );
        data = { winner };
      } else {
        if (!before.winner)
          throw new BusinessError(
            "Marque o item como vencedor antes de registrar a proposta.",
          );
        const selectedStatus = z
          .enum(["CLASSIFIED", "HOMOLOGATED"])
          .optional()
          .parse(nextStatus);
        if (parent.status !== "CLASSIFIED" && parent.status !== "HOMOLOGATED") {
          if (!selectedStatus)
            throw new BusinessError(
              "Atualize a situação para Classificada ou Homologada antes de salvar a proposta vencedora.",
            );
          statusChange = selectedStatus;
        }
        const price = monetary4.parse(value);
        const winners = await tx.opportunityItem.findMany({
          where: { opportunityId: id, winner: true },
        });
        winnerTotals(
          winners.map((i) => ({
            quantity: i.quantity.toFixed(3),
            unitPrice:
              i.id === itemId
                ? price
                : (i.winningUnitPrice?.toFixed(4) ?? null),
          })),
        );
        data = { winningUnitPrice: price };
      }
      const updated = await tx.opportunity.updateMany({
        where: { id, version, archived: false },
        data: {
          version: { increment: 1 },
          ...(statusChange ? { status: statusChange } : {}),
        },
      });
      if (!updated.count)
        throw new BusinessError(
          "A contratação foi alterada. Atualize a página antes de salvar.",
        );
      const after = await tx.opportunityItem.update({
        where: { id: itemId },
        data,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          entity: "Opportunity",
          entityId: id,
          action: operation,
          changes: JSON.parse(
            JSON.stringify({
              before,
              after,
              beforeStatus: parent.status,
              afterStatus: statusChange ?? parent.status,
            }),
          ),
        },
      });
      return after;
    },
    { timeout: 20000 },
  );
}
export const saveItemPricing = (
  db: PrismaClient,
  actorId: string,
  id: string,
  itemId: string,
  version: number,
  input: unknown,
) => changeItem(db, actorId, id, itemId, version, "PRICE", input);
export const setItemWinner = (
  db: PrismaClient,
  actorId: string,
  id: string,
  itemId: string,
  version: number,
  winner: boolean,
) => changeItem(db, actorId, id, itemId, version, "WINNER", winner);
export const saveWinningPrice = (
  db: PrismaClient,
  actorId: string,
  id: string,
  itemId: string,
  version: number,
  price: unknown,
  nextStatus?: "CLASSIFIED" | "HOMOLOGATED",
) =>
  changeItem(
    db,
    actorId,
    id,
    itemId,
    version,
    "WINNING_PRICE",
    price,
    nextStatus,
  );
