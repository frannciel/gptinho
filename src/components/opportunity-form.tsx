"use client";
import { ButtonContent } from "./button-content";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { itemsTotal, normalizeItemDecimal } from "@/lib/contracting-items";
import { HelpTooltip } from "./help-tooltip";
import { Field, FormMessage } from "./form-fields";
import type { OpportunityInput } from "@/lib/opportunity-validation";
import type { ActionResult } from "@/lib/validation";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_VALUES,
  PROCUREMENT_METHODS,
  PROCUREMENT_METHOD_VALUES,
} from "@/lib/opportunity-values";
import { saveOpportunityAction } from "@/app/(admin)/contratacoes/actions";
export type AgencyChoice = {
  id: string;
  legalName: string;
  acronym: string | null;
  active: boolean;
};
export function OpportunityForm({
  initial,
  agencies,
  id,
  version,
}: {
  initial: OpportunityInput;
  agencies: AgencyChoice[];
  id?: string;
  version?: number;
}) {
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const set = <K extends keyof OpportunityInput>(
    key: K,
    value: OpportunityInput[K],
  ) => setValues((before) => ({ ...before, [key]: value }));
  const attrs = (key: keyof OpportunityInput) => ({
    id: key,
    name: key,
    "aria-invalid": !!result?.errors?.[key],
    "aria-describedby": result?.errors?.[key] ? `${key}-error` : undefined,
  });
  const estimatedTotal = itemsTotal(
    values.items.map((i) => ({
      quantity: normalizeItemDecimal(i.quantity, 3, 15, true)!,
      unitPrice: normalizeItemDecimal(i.unitPrice, 4, 14),
    })),
  ).total;
  const selected = agencies.find(
    (agency) => agency.id === values.organizationId,
  );
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        startTransition(async () => {
          try {
            const response = await saveOpportunityAction(
              {
                ...values,
                items: values.items,
              },
              id,
              version,
            );
            setResult(response);
            if (response.ok && response.id) {
              router.push(`/contratacoes/${response.id}?notice=saved`);
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
      }}
    >
      <FormMessage result={result} />
      {selected && !selected.active && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          O órgão vinculado está inativo. Você pode manter o vínculo existente
          ou selecionar outro órgão ativo.
        </p>
      )}
      <fieldset disabled={pending} className="panel p-6">
        <legend className="sr-only">Identificação da contratação</legend>
        <h2 className="font-semibold">Identificação da contratação</h2>
        <p className="mt-1 mb-6 text-xs text-slate-500">
          Campos com * são obrigatórios. A identificação deve ser única.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            name="reference"
            label="Identificação"
            required
            error={result?.errors?.reference}
          >
            <input
              {...attrs("reference")}
              className="field"
              value={values.reference}
              required
              minLength={3}
              maxLength={60}
              placeholder="Ex.: CT-2026-001"
              onChange={(event) => set("reference", event.target.value)}
            />
          </Field>
          <Field
            name="organizationId"
            label="Órgão público"
            required
            error={result?.errors?.organizationId}
          >
            <select
              {...attrs("organizationId")}
              className="field"
              value={values.organizationId}
              required
              onChange={(event) => set("organizationId", event.target.value)}
            >
              <option value="">Selecione um órgão</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.legalName}
                  {agency.acronym ? ` (${agency.acronym})` : ""}
                  {!agency.active ? " · Inativo" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field
            name="procurementMethod"
            label="Modalidade de contratação"
            required
            error={result?.errors?.procurementMethod}
          >
            <select
              {...attrs("procurementMethod")}
              className="field"
              value={values.procurementMethod}
              onChange={(event) =>
                set(
                  "procurementMethod",
                  event.target.value as OpportunityInput["procurementMethod"],
                )
              }
            >
              {PROCUREMENT_METHOD_VALUES.map((method) => (
                <option key={method} value={method}>
                  {PROCUREMENT_METHODS[method]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            name="processNumber"
            label="Número do processo"
            error={result?.errors?.processNumber}
          >
            <input
              {...attrs("processNumber")}
              className="field"
              value={values.processNumber}
              maxLength={120}
              onChange={(event) => set("processNumber", event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5">
          <Field
            name="subject"
            label="Objeto"
            required
            error={result?.errors?.subject}
          >
            <textarea
              {...attrs("subject")}
              className="field min-h-36"
              required
              minLength={10}
              maxLength={10000}
              value={values.subject}
              placeholder="Descreva a necessidade do órgão e o que poderá ser fornecido."
              onChange={(event) => set("subject", event.target.value)}
            />
          </Field>
        </div>
      </fieldset>
      <fieldset disabled={pending} className="panel p-6">
        <legend className="sr-only">Itens da contratação</legend>
        <h2 className="font-semibold">Itens da contratação</h2>
        <p className="my-3 text-sm">
          Salve a contratação para gerenciar seus itens em tela própria.
        </p>
        {values.items.map((item) => (
          <p key={item.id ?? item.number} className="border-b py-2 text-sm">
            {item.number} · {item.description} · {item.quantity} {item.unit}
          </p>
        ))}
        <p className="my-3">
          Valor estimado:{" "}
          {estimatedTotal === null ? "A definir" : money(estimatedTotal)}
        </p>
        {id && (
          <Link className="btn-secondary" href={`/contratacoes/${id}/itens`}>
            Gerenciar itens
          </Link>
        )}
      </fieldset>
      <fieldset disabled={pending} className="panel p-6">
        <legend className="sr-only">Acompanhamento comercial</legend>
        <h2 className="mb-6 font-semibold">Acompanhamento comercial</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            name="proposalDeadline"
            label="Prazo de apresentação"
            help={
              <HelpTooltip
                id="proposalDeadline-help"
                label="Ajuda sobre o prazo de apresentação"
                text="Data limite para apresentação da proposta e, nas licitações, data e hora da sessão pública."
              />
            }
            error={result?.errors?.proposalDeadline}
          >
            <input
              {...attrs("proposalDeadline")}
              className="field"
              type="datetime-local"
              min="2000-01-01T00:00"
              max="2199-12-31T23:59"
              value={values.proposalDeadline}
              onChange={(event) => set("proposalDeadline", event.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Informe data e hora de Brasília (UTC−3). Prazos passados geram
              alerta, sem impedir o registro.
            </p>
          </Field>
          <Field
            name="status"
            label="Situação"
            required
            error={result?.errors?.status}
          >
            <select
              {...attrs("status")}
              className="field"
              value={values.status}
              onChange={(event) =>
                set("status", event.target.value as OpportunityInput["status"])
              }
            >
              {OPPORTUNITY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {OPPORTUNITY_STATUSES[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            name="platformUrl"
            label="Link da plataforma de licitação"
            error={result?.errors?.platformUrl}
          >
            <input
              {...attrs("platformUrl")}
              className="field"
              type="url"
              placeholder="https://"
              maxLength={2048}
              value={values.platformUrl}
              onChange={(event) => set("platformUrl", event.target.value)}
            />
          </Field>
          <Field
            name="attachmentsUrl"
            label="Pasta na nuvem (anexos da licitação)"
            error={result?.errors?.attachmentsUrl}
          >
            <input
              {...attrs("attachmentsUrl")}
              className="field"
              type="url"
              placeholder="https://"
              maxLength={2048}
              value={values.attachmentsUrl}
              onChange={(event) => set("attachmentsUrl", event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5">
          <Field name="notes" label="Observações" error={result?.errors?.notes}>
            <textarea
              {...attrs("notes")}
              className="field min-h-28"
              maxLength={5000}
              value={values.notes}
              onChange={(event) => set("notes", event.target.value)}
            />
          </Field>
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-3">
        <Link
          href={id ? `/contratacoes/${id}` : "/contratacoes"}
          className="btn-secondary"
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <ButtonContent action="cancel" />
        </Link>
        <button
          disabled={pending}
          className="btn"
          aria-label="Salvar contratação"
        >
          <ButtonContent action="save" pending={pending} />
        </button>
      </div>
    </form>
  );
}
