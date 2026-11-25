"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { ContractSearch } from "./contract-search";
import { srpAction } from "@/app/(admin)/contratacoes/[id]/registros-precos/actions";
export function SrpForm({
  opportunityId,
  version,
  operation,
  children,
  confirmation,
}: {
  opportunityId: string;
  version: number;
  operation: "save" | "delete" | "addParticipant" | "removeParticipant";
  children?: React.ReactNode;
  confirmation?: string;
}) {
  const router = useRouter();
  const [organization, setOrganization] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  return (
    <ActionForm
      className="space-y-4"
      confirmation={confirmation}
      action={async (data) => {
        setMessage("");
        const result = await srpAction(opportunityId, version, operation, data);
        if (result.ok) {
          setMessage(
            operation === "delete" || operation === "removeParticipant"
              ? "Registro removido."
              : "Registro salvo.",
          );
          router.refresh();
        }
        return result;
      }}
    >
      {message && (
        <p role="status" className="rounded bg-green-50 p-3 text-green-800">
          {message}
        </p>
      )}
      {operation === "addParticipant" && (
        <>
          <ContractSearch
            kind="agency"
            label="Órgão participante"
            required
            selected={organization}
            onSelect={setOrganization}
          />
          <input
            type="hidden"
            name="organizationId"
            value={organization?.id ?? ""}
          />
        </>
      )}
      {children}
      <button
        className={
          operation === "delete" || operation === "removeParticipant"
            ? "btn-secondary text-red-700"
            : "btn"
        }
      >
        {operation === "delete" ? (
          "Excluir ata"
        ) : operation === "removeParticipant" ? (
          "Remover participante"
        ) : (
          <ButtonContent action="save" />
        )}
      </button>
    </ActionForm>
  );
}
