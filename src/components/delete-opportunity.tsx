"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { ButtonContent } from "./button-content";
import { deleteOpportunityAction } from "@/app/(admin)/contratacoes/actions";
export function DeleteOpportunity({
  id,
  version,
  reference,
  hasContracts,
}: {
  id: string;
  version: number;
  reference: string;
  hasContracts: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        className="btn-secondary text-red-700"
        disabled={hasContracts}
        title={
          hasContracts
            ? "Contratos associados impedem a exclusão."
            : "Excluir contratação"
        }
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        <Trash2 size={17} />
        Excluir contratação
      </button>
      <dialog
        ref={dialog}
        aria-label="Excluir contratação"
        className="fixed inset-0 m-auto w-[min(32rem,95vw)] rounded-xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-950/50"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-red-800">
          <TriangleAlert size={22} />
          Excluir contratação?
        </h2>
        <p className="mt-4 text-sm leading-6">
          {reference}: esta ação é permanente. Todos os itens, dados de
          precificação e ofertas vencedoras desta contratação serão perdidos. O
          registro de auditoria será preservado.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            <ButtonContent action="cancel" />
          </button>
          <button
            type="button"
            className="btn bg-red-700 hover:bg-red-800"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await deleteOpportunityAction(id, version);
                  if (!result.ok) setError(result.message);
                  else {
                    dialog.current?.close();
                    router.push("/contratacoes?notice=deleted");
                    router.refresh();
                  }
                } catch {
                  setError(
                    "Falha de conexão. Atualize a página antes de tentar novamente.",
                  );
                }
              })
            }
          >
            <Trash2 size={17} />
            {pending ? "Excluindo…" : "Confirmar exclusão"}
          </button>
        </div>
      </dialog>
    </>
  );
}
