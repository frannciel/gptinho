"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError } from "@/lib/errors";
import {
  savePriceRegistration,
  deletePriceRegistration,
  changeParticipant,
} from "@/server/price-registrations";
export async function srpAction(
  opportunityId: string,
  version: number,
  operation: "save" | "delete" | "addParticipant" | "removeParticipant",
  data: FormData,
) {
  try {
    const user = await requireAdmin();
    if (operation === "save")
      await savePriceRegistration(
        db,
        user.id,
        opportunityId,
        version,
        {
          reference: data.get("reference"),
          signatureDate: data.get("signatureDate"),
          validUntil: data.get("validUntil"),
          allowsAdhesion: data.get("allowsAdhesion") === "on",
          documentUrl: data.get("documentUrl"),
          notes: data.get("notes"),
          itemIds: data.getAll("itemIds"),
        },
        String(data.get("id") || "") || undefined,
      );
    else if (operation === "delete")
      await deletePriceRegistration(
        db,
        user.id,
        opportunityId,
        version,
        String(data.get("id")),
      );
    else if (
      operation === "addParticipant" ||
      operation === "removeParticipant"
    )
      await changeParticipant(
        db,
        user.id,
        opportunityId,
        version,
        String(data.get("organizationId")),
        operation === "removeParticipant",
      );
    else throw new Error("Operação inválida.");
    revalidatePath(`/contratacoes/${opportunityId}`, "layout");
    revalidatePath("/contratacoes");
    return { ok: true, message: "Registro salvo." };
  } catch (e) {
    return e instanceof AccessError
      ? { ok: false, message: e.message }
      : actionError(e);
  }
}
