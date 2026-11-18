import { adminDb, readAdminInput } from "./admin-common";
import { hashPassword } from "../src/lib/password";
const db = adminDb();
try {
  const { email, secret } = await readAdminInput(false);
  const passwordHash = await hashPassword(secret);
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user || user.role !== "ADMIN")
      throw new Error("Administrador não encontrado.");
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        entity: "User",
        entityId: user.id,
        action: "PASSWORD_RESET",
      },
    });
  });
  console.info("Senha alterada e sessões anteriores revogadas.");
} catch {
  console.error(
    "Recuperação não concluída. Confira os dados, a política de senha e a conexão.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
