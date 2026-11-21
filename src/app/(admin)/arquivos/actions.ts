"use server";
import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { actionError, BusinessError } from "@/lib/errors";
import {
  previewImport,
  commitImport,
  type ImportPreview,
  type ImportResult,
} from "@/server/data-import";
import type { ImportKind } from "@/lib/data-files";
import type { ActionResult } from "@/lib/validation";
export async function importFileAction(input: {
  text: string;
  kind: ImportKind;
  target?: string;
  defaults: unknown;
  token?: string;
}): Promise<ActionResult & { preview?: ImportPreview; result?: ImportResult }> {
  try {
    const user = await requireAdmin();
    if (input.token) {
      const result = await commitImport(
        db,
        user.id,
        input.text,
        input.kind,
        input.target,
        input.defaults,
        input.token,
      );
      for (const path of [
        "/catalogo",
        "/contratacoes",
        "/dashboard",
        ...(input.target
          ? [
              `/contratacoes/${input.target}`,
              `/contratacoes/${input.target}/itens`,
              `/contratacoes/${input.target}/precificacao`,
            ]
          : []),
      ])
        revalidatePath(path);
      return {
        ok: true,
        message: result.alreadyImported
          ? "Este lote já foi importado. Nenhum registro foi duplicado."
          : `${result.count} item(ns) importado(s).`,
        result,
      };
    }
    const preview = await previewImport(
      db,
      input.text,
      input.kind,
      input.target,
      input.defaults,
    );
    return "rows" in preview
      ? {
          ok: true,
          message: "Prévia validada. Confira os itens e confirme a importação.",
          preview,
        }
      : {
          ok: true,
          message: "Este lote já foi importado. Nenhum registro foi duplicado.",
          result: preview,
        };
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, message: e.message };
    if (e instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const path = issue.path.join(".") || "arquivo";
        const messages: Record<string, string> = {
          invalid_type:
            "Campo obrigatório ou tipo incorreto. Confira o JSON Schema.",
          unrecognized_keys: "Campo não permitido no formato de importação.",
          invalid_value: "Valor não permitido. Confira tipo e versão.",
          too_big: "Valor ou quantidade acima do limite permitido.",
          too_small: "Campo vazio ou abaixo do mínimo permitido.",
          invalid_format:
            "Formato inválido. Confira as casas decimais, os identificadores e o JSON Schema.",
        };
        (errors[path] ??= []).push(
          issue.code === "custom"
            ? issue.message
            : (messages[issue.code] ?? "Campo inválido."),
        );
      }
      return {
        ok: false,
        message:
          "Arquivo ou complementos inválidos. Revise os campos indicados.",
        errors,
      };
    }
    return actionError(
      e instanceof SyntaxError
        ? new BusinessError("JSON inválido.")
        : e instanceof Error &&
            [
              "Arquivo JSON inválido.",
              "O arquivo deve ter no máximo 2 MiB.",
            ].includes(e.message)
          ? new BusinessError(e.message)
          : e,
    );
  }
}
