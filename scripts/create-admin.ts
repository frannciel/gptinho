import { adminDb, readAdminInput } from "./admin-common";
import { createFirstAdmin } from "../src/server/admin";
const db = adminDb();
try {
  const { email, name, secret } = await readAdminInput();
  await createFirstAdmin(db, { email, name, password: secret });
  console.info(
    "Primeiro administrador criado. Nenhuma credencial foi gravada em arquivo.",
  );
} catch (error) {
  console.error(
    error instanceof Error &&
      (error.name === "BusinessError" ||
        error.message.startsWith("Já existe") ||
        error.message.startsWith("As senhas") ||
        error.message === "Operação cancelada.")
      ? error.message
      : "Não foi possível criar o administrador. Confira os dados, a política de senha e a conexão.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
