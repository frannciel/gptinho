"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import { saveTask, deleteTask } from "@/server/tasks";
import { markEventRead } from "@/server/calendar";
function refresh() {
  for (const path of ["/tarefas", "/calendario", "/dashboard"])
    revalidatePath(path, "layout");
}
export async function taskAction(
  input: unknown,
  id?: string,
  version?: number,
) {
  try {
    const user = await requireAdmin();
    await saveTask(db, user.id, input, id, version);
    refresh();
    return { ok: true, message: "Tarefa salva." };
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
}
export async function removeTaskAction(id: string, version: number) {
  try {
    const user = await requireAdmin();
    await deleteTask(db, user.id, id, version);
    refresh();
    return { ok: true, message: "Tarefa excluída." };
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
}
export async function readEventAction(data: FormData) {
  try {
    const user = await requireAdmin();
    await markEventRead(db, user.id, Object.fromEntries(data));
    refresh();
    return { ok: true, message: "Alerta lido." };
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
}
