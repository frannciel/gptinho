import { requireAdminPage } from "@/lib/authorization";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { brazilDay } from "@/lib/agenda";
export default async function Page() {
  const user = await requireAdminPage();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Agenda operacional"
        title="Nova tarefa ou compromisso"
        description="Defina o prazo e os vínculos necessários para acompanhar a atividade."
      />
      <TaskForm
        initial={{
          title: "",
          description: "",
          dueDate: brazilDay(),
          status: "PENDING",
          priority: "NORMAL",
          assignee: { id: user.id, label: user.name },
          organization: null,
          contact: null,
          opportunity: null,
          contract: null,
        }}
      />
    </div>
  );
}
