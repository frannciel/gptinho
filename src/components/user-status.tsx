"use client";
import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ActionForm } from "./action-form";
import { toggleUserAction } from "@/app/(admin)/usuarios/actions";
export function UserStatus({
  id,
  version,
  active,
  name,
}: {
  id: string;
  version: number;
  active: boolean;
  name: string;
}) {
  const router = useRouter();
  return (
    <ActionForm
      confirmation={
        active
          ? `Desativar a conta de ${name}? O acesso será bloqueado e as sessões serão encerradas. Os registros e o histórico serão preservados.`
          : undefined
      }
      action={async () => {
        const result = await toggleUserAction(id, version, !active);
        if (result.ok) {
          if ("reauth" in result && result.reauth)
            await signOut({ callbackUrl: "/login?notice=account-disabled" });
          else {
            router.push(
              `/usuarios?notice=${active ? "disabled" : "activated"}`,
            );
            router.refresh();
          }
        }
        return result;
      }}
    >
      <button
        className={`btn-secondary ${active ? "text-red-700" : "text-green-700"}`}
      >
        <Power size={16} />
        {active ? "Desativar" : "Ativar"}
      </button>
    </ActionForm>
  );
}
