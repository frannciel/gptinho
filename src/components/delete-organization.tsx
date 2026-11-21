"use client";
import { ButtonContent } from "./button-content";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { deleteOrganizationAction } from "@/app/(admin)/actions";
export function DeleteOrganization({
  id,
  version,
  name,
}: {
  id: string;
  version: number;
  name: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
        aria-label={`Excluir ${name}`}
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        <Trash2 size={16} />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`delete-title-${id}`}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 p-6 shadow-xl"
      >
        <TriangleAlert className="text-red-600" size={28} />
        <h2 id={`delete-title-${id}`} className="mt-4 text-xl font-bold">
          Excluir este cadastro?
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A organização <strong>{name}</strong> e seus contatos serão excluídos.
          Esta ação é definitiva. Prefira desativar cadastros que devem ser
          preservados.
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
            <ButtonContent action="cancel" />
          </button>
          <button
            type="button"
            disabled={pending}
            className="btn bg-red-700 hover:bg-red-800"
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await deleteOrganizationAction(id, version);
                  if (!result.ok) setError(result.message);
                  else {
                    dialog.current?.close();
                    router.refresh();
                  }
                } catch {
                  setError("Falha de conexão. Tente novamente.");
                }
              })
            }
          >
            {pending ? "Excluindo…" : "Excluir definitivamente"}
          </button>
        </div>
      </dialog>
    </>
  );
}
