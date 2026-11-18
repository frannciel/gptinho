import "dotenv/config";
import { input, password, confirm } from "@inquirer/prompts";
import { z } from "zod";
import { createDb } from "../src/lib/db-client";
import { passwordSchema } from "../src/lib/validation";
export function adminDb() {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure DATABASE_URL antes de continuar.");
  return createDb(process.env.DATABASE_URL);
}
export async function readAdminInput(withName = true) {
  const email = z
    .email()
    .max(254)
    .parse(
      (await input({ message: "E-mail do administrador:" }))
        .trim()
        .toLowerCase(),
    );
  const name = withName
    ? z
        .string()
        .trim()
        .min(2)
        .max(120)
        .parse(await input({ message: "Nome completo:" }))
    : "";
  const secret = await password({
    message: "Senha (12+ caracteres, maiúscula, minúscula, número e símbolo):",
    mask: "*",
  });
  passwordSchema.parse(secret);
  if (secret !== (await password({ message: "Confirme a senha:", mask: "*" })))
    throw new Error("As senhas não coincidem.");
  if (
    !(await confirm({
      message: "Confirmar alteração no banco configurado?",
      default: false,
    }))
  )
    throw new Error("Operação cancelada.");
  return { email, name, secret };
}
