"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { ContractSearch, type ContractChoice } from "./contract-search";
import { MaskedInput } from "./masked-input";
import { contactAction } from "@/app/(admin)/contatos/actions";
export type ContactFormData = {
  id?: string;
  version?: number;
  name: string;
  position: string;
  email: string;
  phone: string;
  organization: ContractChoice | null;
};
export function ContactForm({ initial }: { initial: ContactFormData }) {
  const [organization, setOrganization] = useState(initial.organization);
  const [phone, setPhone] = useState(initial.phone);
  const router = useRouter();
  return (
    <ActionForm
      className="panel grid gap-5 p-6 sm:grid-cols-2"
      action={async (data) => {
        const result = await contactAction(
          {
            name: data.get("name"),
            position: data.get("position"),
            email: data.get("email"),
            phone,
            organizationId: organization?.id ?? "",
          },
          initial.id,
          initial.version,
        );
        if (result.ok) {
          router.push("/contatos?notice=saved");
          router.refresh();
        }
        return result;
      }}
    >
      <label>
        Nome *
        <input
          className="field"
          name="name"
          defaultValue={initial.name}
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label>
        Cargo / função
        <input
          className="field"
          name="position"
          defaultValue={initial.position}
          maxLength={100}
        />
      </label>
      <label>
        E-mail
        <input
          className="field"
          name="email"
          type="email"
          defaultValue={initial.email}
          maxLength={254}
        />
      </label>
      <label>
        Telefone
        <MaskedInput
          className="field"
          name="phone"
          mask="phone"
          value={phone}
          onValueChange={setPhone}
        />
      </label>
      <div className="sm:col-span-2">
        <ContractSearch
          label="Organização (opcional)"
          kind="organization"
          selected={organization}
          onSelect={setOrganization}
        />
        <p className="mt-2 text-xs text-slate-500">
          O contato pode ser cadastrado sem organização e vinculado
          posteriormente.
        </p>
      </div>
      <div className="mt-4 flex gap-3 sm:col-span-2">
        <button className="btn">
          <ButtonContent action="save" />
        </button>
        <Link className="btn-secondary" href="/contatos">
          <ButtonContent action="cancel" />
        </Link>
      </div>
    </ActionForm>
  );
}
