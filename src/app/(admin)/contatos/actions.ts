"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import { saveContact, deleteContact } from "@/server/contacts";
export async function contactAction(
  input: unknown,
  id?: string,
  version?: number,
) {
  try {
    const user = await requireAdmin();
    await saveContact(db, user.id, input, id, version);
    for (const path of [
      "/contatos",
      "/orgaos",
      "/fornecedores",
      "/tarefas",
      "/calendario",
    ])
      revalidatePath(path, "layout");
    return { ok: true, message: "Contato salvo." };
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
}
export async function removeContactAction(id: string, version: number) {
  try {
    const user = await requireAdmin();
    await deleteContact(db, user.id, id, version);
    for (const path of ["/contatos", "/orgaos", "/fornecedores"])
      revalidatePath(path, "layout");
    return { ok: true, message: "Contato excluído." };
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
}
