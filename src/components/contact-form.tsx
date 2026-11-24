"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { ContractSearch, type ContractChoice } from "./contract-search";
import { Plus, Trash2 } from "lucide-react";
import type { ContactTelephone } from "@/lib/agenda";
import { MaskedInput } from "./masked-input";
import { contactAction } from "@/app/(admin)/contatos/actions";
export type ContactFormData = {
  id?: string;
  version?: number;
  name: string;
  position: string;
  email: string;
  phone: string;
  phones?: ContactTelephone[];
  notes?: string;
  linkedInUrl?: string;
  organization: ContractChoice | null;
};
export function ContactForm({ initial }: { initial: ContactFormData }) {
  const [organization, setOrganization] = useState(initial.organization);
  const [phones, setPhones] = useState<ContactTelephone[]>(
    initial.phones?.length
      ? initial.phones
      : [{ number: initial.phone, whatsapp: false }],
  );
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
            phone: phones[0]?.number ?? "",
            phones: phones.filter((p) => p.number.trim() || p.whatsapp),
            notes: data.get("notes"),
            linkedInUrl: data.get("linkedInUrl"),
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
      <fieldset className="sm:col-span-2 space-y-4">
        <legend className="mb-3 font-semibold">Telefones</legend>
        {phones.map((phone, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1">
              {index === 0 ? "Telefone" : `Telefone ${index + 1}`}
              <MaskedInput
                className="field"
                name={`phone-${index}`}
                mask="phone"
                value={phone.number}
                onValueChange={(number) =>
                  setPhones((rows) =>
                    rows.map((p, i) => (i === index ? { ...p, number } : p)),
                  )
                }
              />
            </label>
            <label className="flex items-center gap-2 py-3">
              <input
                type="checkbox"
                checked={phone.whatsapp}
                onChange={(e) =>
                  setPhones((rows) =>
                    rows.map((p, i) =>
                      i === index ? { ...p, whatsapp: e.target.checked } : p,
                    ),
                  )
                }
                aria-label={`WhatsApp do telefone ${index + 1}`}
              />
              WhatsApp
            </label>
            <button
              type="button"
              className="btn-secondary"
              aria-label={`Remover telefone ${index + 1}`}
              onClick={() =>
                setPhones((rows) => rows.filter((_, i) => i !== index))
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          disabled={phones.length >= 20}
          onClick={() =>
            setPhones((rows) => [...rows, { number: "", whatsapp: false }])
          }
        >
          <Plus size={16} />
          Adicionar telefone
        </button>
      </fieldset>
      <label className="sm:col-span-2">
        Perfil no LinkedIn
        <input
          className="field"
          name="linkedInUrl"
          type="url"
          maxLength={500}
          placeholder="https://www.linkedin.com/in/nome-do-perfil"
          defaultValue={initial.linkedInUrl ?? ""}
        />
      </label>
      <label className="sm:col-span-2">
        Observações
        <textarea
          className="field"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={initial.notes ?? ""}
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
