"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { actionError } from "@/lib/errors";
import {
  saveItemPricing,
  saveWinningPrice,
  setItemWinner,
} from "@/server/pricing";
import { idSchema } from "@/lib/validation";
export async function pricingAction(form: FormData) {
  const id = idSchema.parse(form.get("opportunityId"));
  const itemId = idSchema.parse(form.get("itemId"));
  const operation = form.get("operation");
  try {
    const user = await requireAdmin();
    const version = Number(form.get("version"));
    if (operation === "winner")
      await setItemWinner(
        db,
        user.id,
        id,
        itemId,
        version,
        form.get("winner") === "true",
      );
    else if (operation === "winningPrice")
      await saveWinningPrice(
        db,
        user.id,
        id,
        itemId,
        version,
        String(form.get("winningUnitPrice") ?? ""),
      );
    else
      await saveItemPricing(
        db,
        user.id,
        id,
        itemId,
        version,
        Object.fromEntries(
          [
            "supplierId",
            "acquisitionUnit",
            "freightUnit",
            "taxRate",
            "netProfitRate",
            "pricingAdministrativeRate",
          ].map((k) => [k, String(form.get(k) ?? "")]),
        ),
      );
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
  for (const path of [
    "/dashboard",
    "/contratacoes",
    `/contratacoes/${id}`,
    `/contratacoes/${id}/itens`,
    `/contratacoes/${id}/editar`,
    `/contratacoes/${id}/precificacao`,
    `/contratacoes/${id}/proposta-vencedora`,
  ])
    revalidatePath(path);
  redirect(
    `/contratacoes/${id}/${operation === "winner" ? "itens" : operation === "winningPrice" ? "proposta-vencedora" : "precificacao"}?saved=1`,
  );
}
