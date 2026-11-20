"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
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
    const result = await saveOpportunity(db, user.id, input, id, version);
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
