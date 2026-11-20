"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { itemInput } from "@/server/item-input";
import { opportunitySchema } from "@/lib/opportunity-validation";
import { BusinessError } from "@/lib/errors";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import type { ActionResult } from "@/lib/validation";
import { archiveOpportunity, saveOpportunity } from "@/server/opportunities";
function failure(error: unknown): ActionResult {
  return error instanceof AccessError
    ? { ok: false, message: error.message }
    : actionError(error);
}
function refresh(id: string) {
  for (const path of [
    "/dashboard",
    "/contratacoes",
    `/contratacoes/${id}`,
    `/contratacoes/${id}/editar`,
  ])
    revalidatePath(path);
}
export async function saveOpportunityAction(
  input: unknown,
  id?: string,
  version?: number,
): Promise<ActionResult & { id?: string }> {
  try {
    const user = await requireAdmin();
    opportunitySchema.parse(input);
    const current = id
      ? await db.opportunity.findUnique({
          where: { id },
          include: { items: true },
        })
      : null;
    if (id && !current) throw new BusinessError("Contratação não encontrada.");
    const header = input as Record<string, unknown>;
    const result = await saveOpportunity(
      db,
      user.id,
      { ...header, items: current?.items.map(itemInput) ?? [] },
      id,
      version,
    );
    refresh(result.id);
    return {
      ok: true,
      message: "Contratação salva com sucesso.",
      id: result.id,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function archiveOpportunityAction(
  id: string,
  version: number,
  archived: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await archiveOpportunity(db, user.id, id, version, archived);
    refresh(id);
    return {
      ok: true,
      message: archived ? "Contratação arquivada." : "Contratação restaurada.",
    };
  } catch (error) {
    return failure(error);
  }
}
