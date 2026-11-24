"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { BusinessError, actionError } from "@/lib/errors";
import type { ActionResult } from "@/lib/validation";
import * as contracts from "@/server/contracts";
export async function contractAction(
  operation: string,
  input: unknown,
  id?: string,
  version?: number,
  recordId?: string,
): Promise<ActionResult & { id?: string; warning?: string }> {
  try {
    const actor = await requireAdmin();
    let resultId = id;
    if (operation === "create")
      resultId = (await contracts.createContract(db, actor.id, input)).id;
    else {
      if (!id || !version)
        throw new BusinessError("Atualize a página antes de salvar.");
      switch (operation) {
        case "deleteContract":
          await contracts.deleteContract(db, actor.id, id, version, input);
          resultId = undefined;
          break;
        case "deleteOrder":
          await contracts.deleteOrder(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
            input,
          );
          break;
        case "deleteInvoice":
          await contracts.deleteInvoice(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
            input,
          );
          break;
        case "deleteAmendment":
          await contracts.deleteAmendment(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
            input,
          );
          break;
        case "deleteEndorsement":
          await contracts.deleteEndorsement(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
            input,
          );
          break;
        case "endorsement":
          await contracts.createEndorsement(db, actor.id, id, version, input);
          break;
        case "update":
          await contracts.updateContract(db, actor.id, id, version, input);
          break;
        case "item":
          await contracts.saveContractItem(
            db,
            actor.id,
            id,
            version,
            input,
            recordId,
          );
          break;
        case "copySource":
          await contracts.copySourceItems(db, actor.id, id, version);
          break;
        case "deleteItem":
          await contracts.deleteContractItem(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
          );
          break;
        case "updateOrder":
          await contracts.updateOrder(
            db,
            actor.id,
            id,
            version,
            input,
            recordId ?? "",
          );
          break;
        case "order":
          await contracts.createOrder(db, actor.id, id, version, input);
          break;
        case "supply":
          await contracts.updateSupply(db, actor.id, id, version, input);
          break;
        case "cancelOrder":
          await contracts.cancelOrder(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
          );
          break;
        case "invoice":
          await contracts.createInvoice(db, actor.id, id, version, input);
          break;
        case "cancelInvoice":
          await contracts.cancelInvoice(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
          );
          break;
        case "receipt":
          await contracts.createReceipt(db, actor.id, id, version, input);
          break;
        case "guarantee":
          await contracts.saveGuarantee(
            db,
            actor.id,
            id,
            version,
            input,
            recordId,
          );
          break;
        case "amendment":
          await contracts.createAmendment(db, actor.id, id, version, input);
          break;
        case "cancelAmendment":
          await contracts.cancelAmendment(
            db,
            actor.id,
            id,
            version,
            recordId ?? "",
          );
          break;
        default:
          throw new BusinessError("Operação inválida.");
      }
    }
    const current = resultId ? await contracts.getContract(db, resultId) : null;
    const siblings = current?.case.instruments ?? [];
    const warning =
      current && !contracts.contractValueCheck(current.case, current.id).matches
        ? "O valor do instrumento diverge do total dos itens. Confira os valores."
        : undefined;
    for (const path of [
      "/contratos",
      "/dashboard",
      "/contratacoes",
      ...siblings.map((i) => `/contratos/${i.id}`),
    ])
      revalidatePath(path);
    revalidatePath("/calendario");
    return {
      ok: true,
      message: "Registro salvo com sucesso.",
      id: resultId,
      warning,
    };
  } catch (error) {
    if (error instanceof AccessError)
      return { ok: false, message: error.message };
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      return {
        ok: false,
        message:
          "Número de instrumento, item ou documento já cadastrado. Confira os registros existentes.",
      };
    return actionError(error);
  }
}
