"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpportunityInput } from "@/lib/opportunity-validation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { actionError, BusinessError } from "@/lib/errors";
import { catalogSchema } from "@/lib/catalog-validation";
import { saveOpportunity } from "@/server/opportunities";
import { itemInput, headerInput } from "@/server/item-input";
export async function saveItemAction(form: FormData) {
  const user = await requireAdmin();
  const id = idSchema.parse(form.get("opportunityId"));
  try {
    const parent = await db.opportunity.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { number: "asc" } } },
    });
    const version = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("version"));
    if (version !== parent.version)
      throw new BusinessError("A contratação foi alterada. Atualize a página.");
    const itemId = String(form.get("itemId") ?? "");
    if (itemId && !parent.items.some((i) => i.id === itemId))
      throw new BusinessError("Item não encontrado nesta contratação.");
    const rows: OpportunityInput["items"] = parent.items
      .filter((i) => i.id !== itemId)
      .map(itemInput);
    if (form.get("operation") !== "delete") {
      const catalogProductId = idSchema.parse(form.get("catalogProductId"));
      const product = await db.catalogProduct.findUnique({
        where: { id: catalogProductId },
      });
      if (!product?.active)
        throw new BusinessError("Selecione um item ativo do catálogo.");
      const fields = catalogSchema.parse(
        Object.fromEntries(
          [
            "description",
            "brand",
            "model",
            "unit",
            "margin",
            "administrativeCost",
            "supplierId",
          ].map((k) => [k, String(form.get(k) ?? "")]),
        ),
      );
      const supplier = await db.organization.findUnique({
        where: { id: fields.supplierId },
      });
      const old = parent.items.find((i) => i.id === itemId);
      if (
        !supplier?.roles.includes("SUPPLIER") ||
        (!supplier.active && old?.supplierId !== supplier.id)
      )
        throw new BusinessError("Selecione um fornecedor ativo.");
      rows.push({
        ...fields,
        brand: fields.brand ?? "",
        model: fields.model ?? "",
        id: itemId || undefined,
        catalogProductId,
        number: String(form.get("number") ?? ""),
        quantity: String(form.get("quantity") ?? ""),
        unitPrice: String(form.get("unitPrice") ?? ""),
      });
    }
    await saveOpportunity(
      db,
      user.id,
      { ...headerInput(parent), items: rows },
      id,
      version,
    );
  } catch (e) {
    return actionError(e);
  }

  for (const path of [
    "/dashboard",
    "/contratacoes",
    `/contratacoes/${id}`,
    `/contratacoes/${id}/editar`,
    `/contratacoes/${id}/itens`,
  ])
    revalidatePath(path);
  redirect(`/contratacoes/${id}/itens?saved=1`);
}
