import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import type { ActionResult } from "./validation";
export class BusinessError extends Error {}
export function actionError(error: unknown): ActionResult {
  if (error instanceof ZodError)
    return {
      ok: false,
      message: "Revise os campos indicados.",
      errors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  if (error instanceof BusinessError)
    return { ok: false, message: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return {
        ok: false,
        message:
          "Este CNPJ já está cadastrado. Edite a organização existente para adicionar outro papel.",
      };
    if (error.code === "P2003")
      return {
        ok: false,
        message: "O registro possui vínculos e não pode ser excluído.",
      };
    if (error.code === "P2025")
      return {
        ok: false,
        message:
          "Registro não encontrado ou alterado por outro usuário. Atualize a página.",
      };
  }
  console.error("govnex.operation_failed", {
    category:
      error instanceof Prisma.PrismaClientInitializationError
        ? "database_unavailable"
        : "internal",
  });
  return {
    ok: false,
    message:
      "Não foi possível concluir a operação. Tente novamente ou contate o administrador.",
  };
}
