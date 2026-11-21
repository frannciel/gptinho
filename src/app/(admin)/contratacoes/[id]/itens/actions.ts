"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { actionError, BusinessError } from "@/lib/errors";
import type { OpportunityInput } from "@/lib/opportunity-validation";
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
    const old = parent.items.find((i) => i.id === itemId);
    if (itemId && !old)
      throw new BusinessError("Item não encontrado nesta contratação.");
    const rows: OpportunityInput["items"] = parent.items
      .filter((i) => i.id !== itemId)
      .map(itemInput);
    if (form.get("operation") !== "delete") {
      const catalogProductId = idSchema.parse(form.get("catalogProductId"));
      const product = await db.catalogProduct.findUnique({
        where: { id: catalogProductId },
      });
      if (!product || (!product.active && old?.catalogProductId !== product.id))
        throw new BusinessError("Selecione um item ativo do catálogo.");
      const type = z.enum(["MATERIAL", "SERVICE"]).parse(form.get("type"));
      rows.push({
        id: itemId || undefined,
        catalogProductId,
        type,
        winner: form.get("winner") === "on",
        number: String(form.get("number") ?? ""),
        description: String(form.get("description") ?? ""),
        brand: String(form.get("brand") ?? ""),
        model: String(form.get("model") ?? ""),
        unit: String(form.get("unit") ?? ""),
        quantity: String(form.get("quantity") ?? ""),
        unitPrice: String(form.get("unitPrice") ?? ""),
        taxRate:
          old?.catalogProductId === product.id
            ? (old.taxRate?.toFixed(2) ?? null)
            : (product.taxRate?.toFixed(2) ?? null),
        supplierId:
          old?.catalogProductId === product.id ? old.supplierId : null,
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
    `/contratacoes/${id}/precificacao`,
    `/contratacoes/${id}/proposta-vencedora`,
  ])
    revalidatePath(path);
  redirect(`/contratacoes/${id}/itens?saved=1`);
}
