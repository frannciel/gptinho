"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { CompanyInput, ActionResult } from "@/lib/validation";
import { saveCompanyAction } from "@/app/(admin)/actions";
import { MaskedInput } from "./masked-input";
import { AddressFields } from "./address-fields";
import { Field, FormMessage } from "./form-fields";
export function CompanyForm({
  initial,
  version,
}: {
  initial: CompanyInput;
  version: number;
}) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  return (
    <form
      className="max-w-4xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        startTransition(async () => {
          try {
            const response = await saveCompanyAction(values, version);
            setResult(response);
            if (response.ok) router.refresh();
          } catch {
            setResult({
              ok: false,
              message: "Falha de conexão. Tente novamente.",
            });
          }
        });
      }}
    >
      <FormMessage result={result} />
      <fieldset disabled={pending} className="panel p-6">
        <legend className="sr-only">Dados da empresa</legend>
        <h2 className="mb-6 font-semibold">Identificação e contato</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {(
            [
              ["legalName", "Razão social", true],
              ["tradeName", "Nome fantasia", true],
              ["cnpj", "CNPJ", false],
              ["email", "E-mail", false],
              ["phone", "Telefone", false],
            ] as const
          ).map(([key, label, required]) => (
            <Field
              key={key}
              name={key}
              label={label}
              required={required}
              error={result?.errors?.[key]}
            >
              {key === "cnpj" || key === "phone" ? (
                <MaskedInput
                  id={key}
                  className="field"
                  mask={key}
                  value={values[key]}
                  onValueChange={(value) =>
                    setValues((v) => ({ ...v, [key]: value }))
                  }
                  aria-invalid={!!result?.errors?.[key]}
                  aria-describedby={
                    result?.errors?.[key] ? `${key}-error` : undefined
                  }
                />
              ) : (
                <input
                  id={key}
                  required={required}
                  className="field"
                  value={values[key]}
                  type={key === "email" ? "email" : "text"}
                  maxLength={key === "email" ? 254 : 180}
                  aria-invalid={!!result?.errors?.[key]}
                  aria-describedby={
                    result?.errors?.[key] ? `${key}-error` : undefined
                  }
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={pending} className="panel p-6">
        <legend className="sr-only">Endereço da Govnex</legend>
        <h2 className="mb-6 font-semibold">Endereço da Govnex</h2>
        <AddressFields
          values={values}
          errors={result?.errors}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
      </fieldset>
      <div className="flex justify-end">
        <button disabled={pending} className="btn">
          <Save size={17} />
          {pending ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
