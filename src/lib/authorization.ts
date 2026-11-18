import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { db } from "./db";
export class AccessError extends Error {
  constructor(public status: 401 | 403) {
    super(
      status === 401
        ? "Sessão expirada. Entre novamente."
        : "Acesso restrito a administradores.",
    );
  }
}
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AccessError(401);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      sessionVersion: true,
    },
  });
  if (!user?.active || user.sessionVersion !== session.user.sessionVersion)
    throw new AccessError(401);
  if (user.role !== "ADMIN") throw new AccessError(403);
  return user;
}
export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (e) {
    if (e instanceof AccessError)
      redirect(e.status === 401 ? "/login" : "/acesso-negado");
    throw e;
  }
}
