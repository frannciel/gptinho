import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const t = await db.task.findUnique({
    where: { id },
    include: {
      assignee: true,
      organization: true,
      contact: true,
      opportunity: true,
      contract: true,
    },
  });
  if (!t) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Agenda operacional"
        title="Editar tarefa"
        description="Concluir a tarefa remove o destaque de atraso, preservando seu registro."
      />
      <TaskForm
        initial={{
          id,
          version: t.version,
          title: t.title,
          description: t.description ?? "",
          dueDate: t.dueDate.toISOString().slice(0, 10),
          status: t.status,
          priority: t.priority,
          assignee: t.assignee
            ? { id: t.assignee.id, label: t.assignee.name }
            : null,
          organization: t.organization
            ? { id: t.organization.id, label: t.organization.legalName }
            : null,
          contact: t.contact
            ? { id: t.contact.id, label: t.contact.name }
            : null,
          opportunity: t.opportunity
            ? { id: t.opportunity.id, label: t.opportunity.reference }
            : null,
          contract: t.contract
            ? { id: t.contract.id, label: t.contract.reference }
            : null,
        }}
      />
    </div>
  );
}
