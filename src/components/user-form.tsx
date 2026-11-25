"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { saveUserAction, profileAction } from "@/app/(admin)/usuarios/actions";
export function UserForm({
  mode,
  initial,
}: {
  mode: "create" | "edit" | "profile";
  initial: {
    id?: string;
    version?: number;
    name: string;
    email: string;
    active?: boolean;
  };
}) {
  const router = useRouter();
  const base = mode === "profile" ? "/meu-perfil" : "/usuarios";
  return (
    <ActionForm
      className="panel grid gap-5 p-6 sm:grid-cols-2"
      action={async (form) => {
        const identity = { name: form.get("name"), email: form.get("email") };
        const result =
          mode === "profile"
            ? await profileAction(identity, initial.version!)
            : await saveUserAction(
                {
                  ...identity,
                  active: form.get("active") === "on",
                  ...(mode === "create"
                    ? {
                        password: form.get("password"),
                        confirmation: form.get("confirmation"),
                      }
                    : {}),
                },
                initial.id,
                initial.version,
              );
        if (result.ok) {
          if ("reauth" in result && result.reauth)
            await signOut({ callbackUrl: "/login?notice=profile-updated" });
          else {
            router.push(`${base}?notice=saved`);
            router.refresh();
          }
        }
        return result;
      }}
    >
      <label>
        Nome completo *
        <input
          className="field"
          name="name"
          defaultValue={initial.name}
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
        />
      </label>
      <label>
        E-mail *
        <input
          className="field"
          type="email"
          name="email"
          defaultValue={initial.email}
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      {mode !== "profile" && (
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial.active ?? true}
          />
          Usuário ativo
        </label>
      )}
      {mode === "create" && (
        <>
          <label>
            Senha inicial *
            <input
              className="field"
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirmar senha inicial *
            <input
              className="field"
              type="password"
              name="confirmation"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Use ao menos 12 caracteres, com maiúscula, minúscula, número e
            símbolo. A senha não será exibida após o cadastro.
          </p>
        </>
      )}
      {mode === "profile" && (
        <p className="text-sm text-slate-500 sm:col-span-2">
          Alterar seu e-mail encerra as sessões abertas. Você entrará novamente
          com o novo endereço e sua senha atual.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3 sm:col-span-2">
        <button className="btn">
          <ButtonContent action="save" />
        </button>
        <Link
          className="btn-secondary"
          href={mode === "profile" ? "/dashboard" : "/usuarios"}
        >
          <ButtonContent action="cancel" />
        </Link>
        {mode === "profile" && (
          <Link className="btn-secondary" href="/trocar-senha">
            Trocar senha
          </Link>
        )}
      </div>
    </ActionForm>
  );
}
