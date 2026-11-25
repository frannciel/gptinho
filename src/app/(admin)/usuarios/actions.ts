"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import {
  createManagedUser,
  editManagedUser,
  saveOwnProfile,
  changeOwnPassword,
  setUserActive,
} from "@/server/users";
const failure = (e: unknown) =>
  e instanceof AccessError ? { ok: false, message: e.message } : actionError(e);
function refresh() {
  revalidatePath("/usuarios", "layout");
  revalidatePath("/meu-perfil");
  revalidatePath("/trocar-senha");
  revalidatePath("/dashboard");
}
export async function saveUserAction(
  input: unknown,
  id?: string,
  version?: number,
) {
  try {
    const actor = await requireAdmin();
    let reauth = false;
    if (id) {
      const result = await editManagedUser(db, actor, id, version!, input);
      reauth = result.reauth;
    } else await createManagedUser(db, actor, input);
    if (!reauth) {
      refresh();
      if (id === actor.id) revalidatePath("/", "layout");
    }
    return { ok: true, message: "Usuário salvo com sucesso.", reauth };
  } catch (e) {
    return failure(e);
  }
}
export async function toggleUserAction(
  id: string,
  version: number,
  active: boolean,
) {
  try {
    const actor = await requireAdmin();
    const result = await setUserActive(db, actor, id, version, active);
    if (!result.reauth) refresh();
    return {
      ok: true,
      message: active ? "Usuário ativado." : "Usuário desativado.",
      reauth: result.reauth,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function profileAction(input: unknown, version: number) {
  try {
    const actor = await requireAdmin();
    const result = await saveOwnProfile(db, actor, version, input);
    if (!result.reauth) {
      refresh();
      revalidatePath("/", "layout");
    }
    return { ok: true, message: "Perfil atualizado.", reauth: result.reauth };
  } catch (e) {
    return failure(e);
  }
}
export async function passwordAction(input: unknown, version: number) {
  try {
    const actor = await requireAdmin();
    await changeOwnPassword(db, actor, version, input);
    return {
      ok: true,
      message: "Senha alterada. Entre novamente.",
      reauth: true,
    };
  } catch (e) {
    return failure(e);
  }
}
