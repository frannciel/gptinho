"use client";
import { useRouter } from "next/navigation";
import { CheckCheck, Mail, MailOpen } from "lucide-react";
import { ActionForm } from "./action-form";
import { notificationAction } from "@/app/(admin)/notificacoes/actions";
export function NotificationControls({
  id,
  read = false,
}: {
  id?: string;
  read?: boolean;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={async () => {
        const result = await notificationAction(
          !id ? "readAll" : read ? "unread" : "read",
          id,
        );
        if (result.ok) {
          window.dispatchEvent(new Event("govnex-notifications-changed"));
          router.refresh();
        }
        return result;
      }}
    >
      <button className="btn-secondary">
        {!id ? (
          <CheckCheck size={16} />
        ) : read ? (
          <Mail size={16} />
        ) : (
          <MailOpen size={16} />
        )}
        <span>
          {!id
            ? "Marcar todas como lidas"
            : read
              ? "Marcar como não lida"
              : "Marcar como lida"}
        </span>
      </button>
    </ActionForm>
  );
}
