"use client";
import { useRef } from "react";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { pricingAction } from "@/app/(admin)/contratacoes/[id]/pricing-actions";
export function WinningOfferForm({
  formId,
  id,
  itemId,
  number,
  version,
  status,
}: {
  formId: string;
  id: string;
  itemId: string;
  number: number;
  version: number;
  status: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const nextStatus = useRef<HTMLInputElement>(null);
  const allowed = status === "CLASSIFIED" || status === "HOMOLOGATED";
  const choose = (value: "CLASSIFIED" | "HOMOLOGATED") => {
    if (nextStatus.current) {
      nextStatus.current.value = value;
      confirmed.current = true;
      dialog.current?.close();
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }
  };
  return (
    <ActionForm
      id={formId}
      action={pricingAction}
      beforeSubmit={(e) => {
        if (!allowed && !confirmed.current) {
          e.preventDefault();
          dialog.current?.showModal();
        } else {
          confirmed.current = false;
        }
      }}
    >
      <input type="hidden" name="operation" value="winningPrice" />
      <input type="hidden" name="opportunityId" value={id} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" ref={nextStatus} name="nextStatus" defaultValue="" />
      <dialog
        ref={dialog}
        aria-label={`Atualizar situação para registrar proposta do item ${number}`}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[min(32rem,95vw)] overflow-y-auto rounded-xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-950/50"
      >
        <h2 className="text-lg font-semibold">
          Atualize a situação da contratação
        </h2>
        <p className="mt-3 text-sm leading-6">
          Para registrar uma proposta vencedora, a contratação deve estar
          Classificada ou Homologada. Escolha a situação atual; a alteração e a
          oferta serão salvas juntas.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              confirmed.current = false;
              if (nextStatus.current) nextStatus.current.value = "";
              dialog.current?.close();
            }}
          >
            <ButtonContent action="cancel" />
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => choose("CLASSIFIED")}
          >
            Classificada
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => choose("HOMOLOGATED")}
          >
            Homologada
          </button>
        </div>
      </dialog>
    </ActionForm>
  );
}
