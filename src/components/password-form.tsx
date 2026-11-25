"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { passwordAction } from "@/app/(admin)/usuarios/actions";
export function PasswordForm({ version }: { version: number }) {
  return (
    <ActionForm
      className="panel space-y-5 p-6"
      action={async (form) => {
        const result = await passwordAction(
          {
            currentPassword: form.get("currentPassword"),
            newPassword: form.get("newPassword"),
            confirmation: form.get("confirmation"),
          },
          version,
        );
        if (result.ok)
          await signOut({ callbackUrl: "/login?notice=password-changed" });
        return result;
      }}
    >
      <label className="block">
        Senha atual *
        <input
          className="field"
          name="currentPassword"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
        />
      </label>
      <label className="block">
        Nova senha *
        <input
          className="field"
          name="newPassword"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <label className="block">
        Confirmar nova senha *
        <input
          className="field"
          name="confirmation"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <p className="text-xs text-slate-500">
        Use ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.
        Após a troca, todas as sessões serão encerradas, incluindo esta.
      </p>
      <div className="mt-6 flex gap-3">
        <button className="btn">
          <ButtonContent action="save" />
        </button>
        <Link className="btn-secondary" href="/meu-perfil">
          <ButtonContent action="cancel" />
        </Link>
      </div>
    </ActionForm>
  );
}
