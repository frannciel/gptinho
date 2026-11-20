"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import { saveCatalog } from "@/server/catalog";
export async function saveCatalogAction(form: FormData) {
  const user = await requireAdmin();
  let id: string;
  try {
    const data = Object.fromEntries(
      [
        "description",
        "brand",
        "model",
        "unit",
        "margin",
        "administrativeCost",
        "supplierId",
      ].map((k) => [k, String(form.get(k) ?? "")]),
    );
    const row = await saveCatalog(
      db,
      user.id,
      data,
      String(form.get("id") || "") || undefined,
      Number(form.get("version")),
    );
    id = row.id;
  } catch (e) {
    return actionError(e);
  }

  revalidatePath("/catalogo");
  redirect(`/catalogo?edit=${id}&saved=1`);
}
export async function deactivateCatalogAction(form: FormData) {
  const user = await requireAdmin();
  const id = String(form.get("id") ?? "");
  try {
    const { idSchema } = await import("@/lib/validation");
    idSchema.parse(id);
    const { z } = await import("zod");
    const version = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("version"));
    await db.$transaction(async (tx) => {
      const before = await tx.catalogProduct.findUniqueOrThrow({
        where: { id },
      });
      const result = await tx.catalogProduct.updateMany({
        where: { id, version },
        data: { active: !before.active, version: { increment: 1 } },
      });
      if (!result.count) throw new Error("concurrent_update");
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          entity: "CatalogProduct",
          entityId: id,
          action: before.active ? "DEACTIVATE" : "ACTIVATE",
          changes: { active: !before.active },
        },
      });
    });
  } catch (e) {
    redirect(`/catalogo?error=${encodeURIComponent(actionError(e).message)}`);
  }
  revalidatePath("/catalogo");
  redirect("/catalogo?saved=1");
}
