"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { archiveOpportunityAction } from "@/app/(admin)/oportunidades/actions";
export function OpportunityArchive({
  id,
  version,
  reference,
  archived,
}: {
  id: string;
  version: number;
  reference: string;
  archived: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        {archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}{" "}
        {archived ? "Restaurar" : "Arquivar"}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="archive-title"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 p-6 shadow-xl"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <h2 id="archive-title" className="text-xl font-bold">
          {archived ? "Restaurar" : "Arquivar"} oportunidade?
        </h2>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {reference}:{" "}
          {archived
            ? "voltará à carteira e poderá ser editada novamente."
            : "sairá da carteira ativa e dos indicadores. O cadastro e seu histórico serão preservados."}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            className="btn-secondary"
            onClick={() => dialog.current?.close()}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await archiveOpportunityAction(
                    id,
                    version,
                    !archived,
                  );
                  if (!result.ok) setError(result.message);
                  else {
                    dialog.current?.close();
                    router.push(
                      `/oportunidades?notice=${archived ? "restored" : "archived"}`,
                    );
                    router.refresh();
                  }
                } catch {
                  setError("Falha de conexão. Tente novamente.");
                }
              })
            }
          >
            {pending
              ? "Salvando…"
              : archived
                ? "Confirmar restauração"
                : "Confirmar arquivamento"}
          </button>
        </div>
      </dialog>
    </>
  );
}
