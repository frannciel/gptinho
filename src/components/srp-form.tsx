"use client";
import Link from "next/link";
import { Trash2, UserMinus } from "lucide-react";
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
  returnHref,
}: {
  opportunityId: string;
  version: number;
  operation: "save" | "delete" | "addParticipant" | "removeParticipant";
  children?: React.ReactNode;
  confirmation?: string;
  returnHref?: string;
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
          if (returnHref)
            router.push(`${returnHref}?notice=saved`, { scroll: false });
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
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className={
            operation === "delete" || operation === "removeParticipant"
              ? "btn-secondary text-red-700"
              : "btn"
          }
        >
          {operation === "delete" ? (
            <>
              <Trash2 size={16} />
              Excluir ata
            </>
          ) : operation === "removeParticipant" ? (
            <>
              <UserMinus size={16} />
              Remover participante
            </>
          ) : (
            <ButtonContent action="save" />
          )}
        </button>
        {returnHref && (
          <Link className="btn-secondary" href={returnHref} scroll={false}>
            <ButtonContent action="cancel" />
          </Link>
        )}
      </div>
    </ActionForm>
  );
}
