"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import { saveOrganization, deleteOrganization } from "@/server/organizations";
import { saveCompany } from "@/server/settings";
import type { ActionResult } from "@/lib/validation";
function failure(error: unknown): ActionResult {
  return error instanceof AccessError
    ? { ok: false, message: error.message }
    : actionError(error);
}
function refresh() {
  for (const path of [
    "/dashboard",
    "/orgaos",
    "/fornecedores",
    "/configuracoes",
    "/oportunidades",
    "/oportunidades/nova",
  ])
    revalidatePath(path);
}
export async function saveOrganizationAction(
  input: unknown,
  id?: string,
  version?: number,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await saveOrganization(db, user.id, input, id, version);
    refresh();
    return { ok: true, message: "Cadastro salvo com sucesso." };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteOrganizationAction(
  id: string,
  version: number,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await deleteOrganization(db, user.id, id, version);
    refresh();
    return { ok: true, message: "Cadastro excluído com sucesso." };
  } catch (error) {
    return failure(error);
  }
}
export async function saveCompanyAction(
  input: unknown,
  version: number,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await saveCompany(db, user.id, input, version);
    refresh();
    return { ok: true, message: "Configurações salvas com sucesso." };
  } catch (error) {
    return failure(error);
  }
}
