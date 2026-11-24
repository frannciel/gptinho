import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { listTasks, taskFilters } from "@/server/tasks";
import { taskStatuses, taskPriorities, brazilDay } from "@/lib/agenda";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
import { AgendaPagination } from "@/components/agenda-pagination";
import { AgendaDelete } from "@/components/agenda-delete";
export const metadata = { title: "Tarefas" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const parsed = taskFilters.safeParse(params);
  const filters = parsed.success ? parsed.data : taskFilters.parse({});
  const { items, count, page, pages } = await listTasks(db, filters);
  const today = brazilDay();
  return (
    <>
      <PageHeader
        eyebrow="Agenda operacional"
        title="Tarefas e compromissos"
        description="Organize atividades e acompanhe os prazos da operação."
        action={
          <Link className="btn" href="/tarefas/nova">
            <Plus size={17} />
            Nova tarefa
          </Link>
        }
      />
      {params.notice === "saved" && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-green-50 p-4 text-green-800"
        >
          Tarefa salva com sucesso.
        </p>
      )}
      {params.notice === "deleted" && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-green-50 p-4 text-green-800"
        >
          Tarefa excluída.
        </p>
      )}
      {!parsed.success && (
        <p role="alert">Filtros inválidos. Exibindo a consulta padrão.</p>
      )}
      <form className="panel mb-6 grid items-end gap-4 p-5 md:grid-cols-3">
        <label>
          Buscar tarefa
          <input
            className="field"
            name="q"
            placeholder="Título ou descrição…"
            defaultValue={filters.q}
            maxLength={120}
          />
        </label>
        <label>
          Situação
          <select className="field" name="status" defaultValue={filters.status}>
            <option value="open">Em aberto</option>
            <option value="overdue">Atrasadas</option>
            <option value="all">Todas</option>
            {Object.entries(taskStatuses).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="btn">
            <ButtonContent action="filter" />
          </button>
          <Link className="btn-secondary" href="/tarefas">
            <ButtonContent action="clear" />
          </Link>
        </div>
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Tarefa",
                "Prazo",
                "Situação",
                "Prioridade",
                "Responsável",
                "Vínculos",
                "Ações",
              ].map((l) => (
                <th className="p-4" key={l}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((t) => {
              const overdue =
                t.dueDate.toISOString().slice(0, 10) < today &&
                (t.status === "PENDING" || t.status === "IN_PROGRESS");
              return (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="p-4 font-medium">{t.title}</td>
                  <td
                    className={`p-4 whitespace-nowrap ${overdue ? "font-semibold text-red-700" : ""}`}
                  >
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "UTC",
                    }).format(t.dueDate)}
                    {overdue && <span className="block text-xs">Atrasada</span>}
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${t.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-slate-100"}`}
                    >
                      {taskStatuses[t.status]}
                    </span>
                  </td>
                  <td className="p-4">{taskPriorities[t.priority]}</td>
                  <td className="p-4">{t.assignee?.name ?? "Não definido"}</td>
                  <td className="space-y-1 p-4">
                    {t.organization && <p>{t.organization.legalName}</p>}
                    {t.contact && (
                      <p>
                        <Link href={`/contatos/${t.contactId}/editar`}>
                          {t.contact.name}
                        </Link>
                      </p>
                    )}
                    {t.opportunity && (
                      <p>
                        <Link href={`/contratacoes/${t.opportunityId}`}>
                          {t.opportunity.reference}
                        </Link>
                      </p>
                    )}
                    {t.contract && (
                      <p>
                        <Link href={`/contratos/${t.contractId}`}>
                          {t.contract.reference}
                        </Link>
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link
                        className="btn-secondary"
                        aria-label={`Editar ${t.title}`}
                        href={`/tarefas/${t.id}/editar`}
                      >
                        <Pencil size={16} />
                      </Link>
                      <AgendaDelete kind="task" id={t.id} version={t.version} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Nenhuma tarefa encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-slate-500">{count} tarefa(s)</p>
      <AgendaPagination
        base="/tarefas"
        params={{ q: filters.q, status: filters.status }}
        page={page}
        pages={pages}
      />
    </>
  );
}
