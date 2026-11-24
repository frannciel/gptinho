"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionForm } from "./action-form";
import { removeContactAction } from "@/app/(admin)/contatos/actions";
import { removeTaskAction } from "@/app/(admin)/tarefas/actions";
export function AgendaDelete({
  kind,
  id,
  version,
}: {
  kind: "contact" | "task";
  id: string;
  version: number;
}) {
  const router = useRouter();
  return (
    <ActionForm
      confirmation={`Excluir ${kind === "contact" ? "este contato" : "esta tarefa"}? A perda dos dados é irreversível.${kind === "contact" ? " Contatos com tarefas vinculadas não podem ser excluídos." : ""}`}
      action={async () => {
        const result = await (
          kind === "contact" ? removeContactAction : removeTaskAction
        )(id, version);
        if (result.ok) {
          router.push(
            `/${kind === "contact" ? "contatos" : "tarefas"}?notice=deleted`,
          );
          router.refresh();
        }
        return result;
      }}
    >
      <button className="btn-secondary text-red-700" aria-label="Excluir">
        <Trash2 size={16} />
      </button>
    </ActionForm>
  );
}
