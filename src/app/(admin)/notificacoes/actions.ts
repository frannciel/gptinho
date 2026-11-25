"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import { changeNotification } from "@/server/notifications";
export async function notificationAction(
  operation: "read" | "unread" | "readAll",
  id?: string,
) {
  try {
    const user = await requireAdmin();
    const op = z.enum(["read", "unread", "readAll"]).parse(operation);
    await changeNotification(db, user.id, op, id);
    revalidatePath("/notificacoes");
    return { ok: true, message: "Notificação atualizada." };
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
}
