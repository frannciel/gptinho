"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, LoaderCircle } from "lucide-react";
import type { OrganizationInput, ActionResult } from "@/lib/validation";
import { saveOrganizationAction } from "@/app/(admin)/actions";
import { MaskedInput } from "./masked-input";
import { AddressFields } from "./address-fields";
import { Field, FormMessage } from "./form-fields";
export type EditableOrganization = OrganizationInput & {
  id?: string;
  version?: number;
};
export function OrganizationForm({
  initial,
  base,
}: {
  initial: EditableOrganization;
  base: string;
}) {
  const [values, setValues] = useState(initial);
  const [categories, setCategories] = useState(initial.categories.join(", "));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const set = <K extends keyof OrganizationInput>(
    key: K,
    value: OrganizationInput[K],
  ) => setValues((v) => ({ ...v, [key]: value }));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        const { id, version, ...input } = values;
        const response = await saveOrganizationAction(
          {
            ...input,
            categories: categories
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          },
          id,
          version,
        );
        setResult(response);
        if (response.ok) {
          router.push(`${base}?notice=saved`);
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          message:
            "Falha de conexão. Seus dados foram preservados; tente novamente.",
        });
      }
    });
  }
  const input = (
    key:
      | "legalName"
      | "tradeName"
      | "acronym"
      | "cnpj"
      | "uasg"
      | "email"
      | "phone",
    label: string,
    options: {
      required?: boolean;
      maxLength?: number;
      type?: string;
      placeholder?: string;
    } = {},
  ) => (
    <Field
      name={key}
      label={label}
      required={options.required}
      error={result?.errors?.[key]}
    >
      {key === "cnpj" || key === "phone" ? (
        <MaskedInput
          id={key}
          name={key}
          className="field"
          mask={key}
          value={values[key]}
          onValueChange={(value) => set(key, value)}
          placeholder={
            key === "cnpj" ? "00.000.000/0000-00" : "(00) 00000-0000"
          }
          aria-invalid={!!result?.errors?.[key]}
          aria-describedby={result?.errors?.[key] ? `${key}-error` : undefined}
        />
      ) : (
        <input
          id={key}
          name={key}
          className="field"
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={!!result?.errors?.[key]}
          aria-describedby={result?.errors?.[key] ? `${key}-error` : undefined}
          {...options}
        />
      )}
    </Field>
  );
  return (
    <form onSubmit={submit} className="space-y-6">
      <FormMessage result={result} />
      <fieldset disabled={pending} className="panel p-5 md:p-7">
        <legend className="sr-only">Identificação e classificação</legend>
        <div className="mb-6 border-b border-slate-100 pb-5">
          <h2 className="font-semibold">Identificação da organização</h2>
          <p className="mt-1 text-xs text-slate-500">
            Campos com * são obrigatórios. Uma organização pode ter os dois
            papéis.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {input("legalName", "Nome / razão social", {
            required: true,
            maxLength: 180,
          })}
          {input("tradeName", "Nome fantasia", { maxLength: 180 })}
          {input("cnpj", "CNPJ", {
            maxLength: 18,
            placeholder: "00.000.000/0000-00",
          })}
          {input("acronym", "Sigla", { maxLength: 30 })}
          {base === "/orgaos" &&
            input("uasg", "Código UASG", {
              maxLength: 6,
              placeholder: "6 dígitos, quando aplicável",
            })}
          <div>
            <p id="roles-label" className="label">
              Classificação <span className="text-brand-600">*</span>
            </p>
            <div
              role="group"
              aria-labelledby="roles-label"
              className="flex flex-wrap gap-5 pt-2"
            >
              {(
                [
                  ["PUBLIC_AGENCY", "Órgão público"],
                  ["SUPPLIER", "Fornecedor"],
                ] as const
              ).map(([role, label]) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={values.roles.includes(role)}
                    onChange={(e) =>
                      set(
                        "roles",
                        e.target.checked
                          ? [...values.roles, role]
                          : values.roles.filter((r) => r !== role),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={values.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            Cadastro ativo
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Desative para preservar um cadastro que não é mais utilizado.
          </p>
        </div>
      </fieldset>
      <fieldset disabled={pending} className="panel p-5 md:p-7">
        <legend className="sr-only">
          Comunicação e informações comerciais
        </legend>
        <h2 className="mb-5 font-semibold">
          Comunicação e informações comerciais
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {input("email", "E-mail institucional", {
            type: "email",
            maxLength: 254,
          })}
          {input("phone", "Telefone", { maxLength: 25 })}
        </div>
        <div className="mt-5">
          <Field
            name="categories"
            label="Categorias de produtos e serviços"
            error={result?.errors?.categories}
          >
            <input
              id="categories"
              className="field"
              value={categories}
              maxLength={1600}
              placeholder="Licenças de software, equipamentos, serviços de TI"
              onChange={(e) => setCategories(e.target.value)}
            />
          </Field>
          <p className="mt-1.5 text-xs text-slate-500">
            Separe as categorias por vírgula. Usado principalmente para
            fornecedores.
          </p>
        </div>
        <div className="mt-5">
          <Field name="notes" label="Observações" error={result?.errors?.notes}>
            <textarea
              id="notes"
              className="field min-h-28"
              maxLength={5000}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              aria-invalid={!!result?.errors?.notes}
              aria-describedby={
                result?.errors?.notes ? "notes-error" : undefined
              }
            />
          </Field>
        </div>
      </fieldset>
      {base === "/fornecedores" && (
        <fieldset disabled={pending} className="panel p-5 md:p-7">
          <legend className="sr-only">Endereço do fornecedor</legend>
          <h2 className="mb-5 font-semibold">Endereço do fornecedor</h2>
          <AddressFields
            values={values}
            errors={result?.errors}
            onChange={(key, value) => set(key, value)}
          />
        </fieldset>
      )}
      <fieldset disabled={pending} className="panel p-5 md:p-7">
        <legend className="sr-only">Contatos</legend>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Pessoas de contato</h2>
            <p className="mt-1 text-xs text-slate-500">
              Adicione os responsáveis pelo relacionamento.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={values.contacts.length >= 20}
            onClick={() =>
              set("contacts", [
                ...values.contacts,
                { name: "", position: "", email: "", phone: "" },
              ])
            }
          >
            <Plus size={16} />
            Adicionar contato
          </button>
        </div>
        {!values.contacts.length && (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Nenhum contato adicionado.
          </p>
        )}
        <div className="space-y-5">
          {values.contacts.map((contact, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500">
                  Contato {index + 1}
                </h3>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-red-700"
                  aria-label={`Remover contato ${index + 1}`}
                  onClick={() =>
                    set(
                      "contacts",
                      values.contacts.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 size={14} />
                  Remover
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["name", "Nome", true],
                    ["position", "Cargo / função", false],
                    ["email", "E-mail", false],
                    ["phone", "Telefone", false],
                  ] as const
                ).map(([key, label, required]) => (
                  <Field
                    key={key}
                    name={`contact-${index}-${key}`}
                    label={label}
                    required={required}
                    error={result?.errors?.[`contacts.${index}.${key}`]}
                  >
                    {key === "phone" ? (
                      <MaskedInput
                        id={`contact-${index}-${key}`}
                        className="field"
                        mask="phone"
                        value={contact.phone}
                        onValueChange={(value) =>
                          set(
                            "contacts",
                            values.contacts.map((c, i) =>
                              i === index ? { ...c, phone: value } : c,
                            ),
                          )
                        }
                      />
                    ) : (
                      <input
                        id={`contact-${index}-${key}`}
                        className="field"
                        value={contact[key]}
                        required={required}
                        aria-invalid={
                          !!result?.errors?.[`contacts.${index}.${key}`]
                        }
                        aria-describedby={
                          result?.errors?.[`contacts.${index}.${key}`]
                            ? `contact-${index}-${key}-error`
                            : undefined
                        }
                        type={key === "email" ? "email" : "text"}
                        maxLength={key === "email" ? 254 : 100}
                        onChange={(e) =>
                          set(
                            "contacts",
                            values.contacts.map((c, i) =>
                              i === index ? { ...c, [key]: e.target.value } : c,
                            ),
                          )
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-end gap-3">
        <Link
          href={base}
          className="btn-secondary"
          aria-disabled={pending}
          onClick={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          Cancelar
        </Link>
        <button disabled={pending} className="btn">
          {pending ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <Save size={17} />
          )}
          {pending ? "Salvando…" : "Salvar cadastro"}
        </button>
      </div>
    </form>
  );
}
