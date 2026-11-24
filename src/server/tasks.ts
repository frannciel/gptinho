import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { taskSchema, brazilDay } from "@/lib/agenda";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
export const taskFilters = z.object({
  q: z.string().trim().max(120).default(""),
  status: z
    .enum([
      "all",
      "open",
      "overdue",
      "PENDING",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ])
    .default("open"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export async function listTasks(db: PrismaClient, input: unknown) {
  const { q, status, page } = taskFilters.parse(input);
  const where: Prisma.TaskWhereInput = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status === "all"
      ? {}
      : status === "open" || status === "overdue"
        ? {
            status: { in: ["PENDING", "IN_PROGRESS"] },
            ...(status === "overdue"
              ? { dueDate: { lt: new Date(brazilDay() + "T00:00:00Z") } }
              : {}),
          }
        : { status }),
  };
  const [items, count] = await db.$transaction([
    db.task.findMany({
      where,
      include: {
        assignee: { select: { name: true } },
        organization: true,
        contact: true,
        opportunity: true,
        contract: true,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.task.count({ where }),
  ]);
  return { items, count, page, pages: Math.max(1, Math.ceil(count / 20)) };
}
export async function saveTask(
  db: PrismaClient,
  actorId: string,
  input: unknown,
  id?: string,
  version?: number,
) {
  const data = taskSchema.parse(input);
  if (id) {
    idSchema.parse(id);
    z.number().int().positive().parse(version);
  }
  return db.$transaction(async (tx) => {
    if (
      data.assigneeId &&
      !(await tx.user.findFirst({
        where: { id: data.assigneeId, active: true, role: "ADMIN" },
      }))
    )
      throw new BusinessError(
        "Selecione um administrador ativo como responsável.",
      );
    if (
      data.organizationId &&
      !(await tx.organization.findUnique({
        where: { id: data.organizationId },
      }))
    )
      throw new BusinessError("Organização não encontrada.");
    if (
      data.contactId &&
      !(await tx.contact.findUnique({ where: { id: data.contactId } }))
    )
      throw new BusinessError("Contato não encontrado.");
    if (
      data.opportunityId &&
      !(await tx.opportunity.findUnique({ where: { id: data.opportunityId } }))
    )
      throw new BusinessError("Contratação não encontrada.");
    if (
      data.contractId &&
      !(await tx.contract.findFirst({
        where: {
          id: data.contractId,
          OR: [
            { instrumentType: "TERM" },
            { instrumentType: "COMMITMENT", substitutive: true },
          ],
        },
      }))
    )
      throw new BusinessError("Contrato não encontrado.");
    const before = id ? await tx.task.findUnique({ where: { id } }) : null;
    if (id) {
      const changed = await tx.task.updateMany({
        where: { id, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new BusinessError(
          "A tarefa foi alterada ou excluída. Atualize a página.",
        );
    }
    const result = id
      ? await tx.task.findUniqueOrThrow({ where: { id } })
      : await tx.task.create({ data });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Task",
        entityId: result.id,
        action: id ? "UPDATE" : "CREATE",
        changes: JSON.parse(JSON.stringify({ before, after: result })),
      },
    });
    return result;
  });
}
export async function deleteTask(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  await db.$transaction(async (tx) => {
    const before = await tx.task.findUnique({ where: { id } });
    const result = await tx.task.deleteMany({ where: { id, version } });
    if (!result.count)
      throw new BusinessError(
        "A tarefa foi alterada ou excluída. Atualize a página.",
      );
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Task",
        entityId: id,
        action: "DELETE",
        changes: JSON.parse(JSON.stringify({ before })),
      },
    });
  });
}
