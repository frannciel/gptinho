"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { contractAction } from "@/app/(admin)/contratos/actions";
import { instrumentStatuses, instrumentTypes } from "@/lib/contracts";
type Choice = { id: string; label: string };
type Source = {
  id: string;
  reference: string;
  organizationId: string;
  items: {
    id: string;
    number: number;
    description: string;
    unit: string;
    brand: string | null;
    model: string | null;
    quantity: string;
    unitPrice: string;
  }[];
};
type Existing = {
  id: string;
  label: string;
  termId: string | null;
  hasTerm: boolean;
  organizationId: string;
};
export function InstrumentFields({
  type,
  initial = {},
  terms = [],
}: {
  type: string;
  initial?: Record<string, string | null>;
  terms?: Choice[];
}) {
  const field = (
    name: string,
    label: string,
    kind = "text",
    required = false,
  ) => (
    <label key={name}>
      {label}
      {required ? " *" : ""}
      <input
        className="field"
        name={name}
        type={kind}
        required={required}
        maxLength={kind === "text" ? 200 : undefined}
        defaultValue={initial[name] ?? ""}
      />
    </label>
  );
  return (
    <>
      {field(
        "reference",
        type === "TERM" ? "Número do contrato" : "Número da nota de empenho",
        "text",
        true,
      )}
      {field(
        "issuedAt",
        type === "TERM" ? "Data do instrumento" : "Data de emissão",
        "date",
        true,
      )}
      <label>
        Valor do instrumento (R$) *
        <input
          className="field"
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          required
          defaultValue={initial.amount ?? ""}
        />
      </label>
      <label>
        Situação *
        <select
          className="field"
          name="status"
          defaultValue={initial.status ?? "DRAFT"}
        >
          {Object.entries(instrumentStatuses).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {type === "TERM" ? (
        <>
          {field("signatureDate", "Data de assinatura", "date", true)}
          {field("validFrom", "Início da vigência", "date", true)}
          {field("validUntil", "Fim da vigência", "date", true)}
          {field(
            "commitmentReference",
            "Referência de empenho (texto opcional)",
          )}
        </>
      ) : (
        <>
          {field(
            "supplyDeadline",
            "Prazo de fornecimento (se aplicável)",
            "date",
          )}
          <label>
            Termo vinculado (opcional)
            <select
              className="field"
              name="parentTermId"
              defaultValue={initial.parentTermId ?? ""}
            >
              <option value="">Sem Termo vinculado</option>
              {terms.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="sm:col-span-2">
        Link do documento
        <input
          className="field"
          type="url"
          name="documentUrl"
          defaultValue={initial.documentUrl ?? ""}
        />
      </label>
      <label className="sm:col-span-2">
        Observações
        <textarea
          className="field"
          rows={2}
          name="notes"
          defaultValue={initial.notes ?? ""}
        />
      </label>
    </>
  );
}
export function ContractForm({
  agencies = [],
  sources = [],
  cases = [],
  initial,
  id,
  version,
  availableTerms = [],
}: {
  availableTerms?: Choice[];
  agencies?: Choice[];
  sources?: Source[];
  cases?: Existing[];
  initial?: Record<string, string | null>;
  id?: string;
  version?: number;
}) {
  const router = useRouter();
  const [type, setType] = useState(initial?.instrumentType ?? "");
  const [sourceId, setSource] = useState("");
  const [caseId, setCase] = useState("");
  const source = sources.find((i) => i.id === sourceId);
  const existing = cases.find((i) => i.id === caseId);
  return (
    <ActionForm
      className="contract-fields space-y-6"
      action={async (data) => {
        const raw = Object.fromEntries(data);
        const instrument = { ...raw, instrumentType: type };
        const items =
          source && !caseId
            ? source.items
                .filter((i) => data.get(`include-${i.id}`) === "on")
                .map((i) => ({
                  number: i.number,
                  description: i.description,
                  unit: i.unit,
                  brand: i.brand ?? "",
                  model: i.model ?? "",
                  quantity: String(data.get(`quantity-${i.id}`) ?? ""),
                  unitPrice: i.unitPrice,
                  opportunityItemId: i.id,
                }))
            : [];
        const result = await contractAction(
          id ? "update" : "create",
          id
            ? instrument
            : {
                instrument,
                caseId,
                opportunityId: caseId ? "" : sourceId,
                organizationId: raw.organizationId,
                items,
              },
          id,
          version,
        );
        if (result.ok) {
          router.push(`/contratos/${result.id}?saved=1`);
          router.refresh();
        }
        return result;
      }}
    >
      <label>
        Instrumento jurídico *
        <select
          className="field"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setCase("");
          }}
          required
          disabled={!!initial?.instrumentType}
        >
          <option value="">Selecione o instrumento</option>
          {Object.entries(instrumentTypes).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {type && (
        <>
          {!id && (
            <div className="grid gap-5 sm:grid-cols-2">
              {
                <label className="sm:col-span-2">
                  Negócio comercial existente (opcional)
                  <select
                    className="field"
                    value={caseId}
                    onChange={(e) => setCase(e.target.value)}
                  >
                    <option value="">Criar novo negócio comercial</option>
                    {cases
                      .filter((i) => type === "COMMITMENT" || !i.hasTerm)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-slate-500">
                    Use o mesmo negócio para instrumentos da mesma contratação.
                    Os valores e itens não serão duplicados.
                  </span>
                </label>
              }
              {!caseId && (
                <>
                  <label>
                    Contratação de origem (opcional)
                    <select
                      className="field"
                      value={sourceId}
                      onChange={(e) => setSource(e.target.value)}
                    >
                      <option value="">Cadastro manual, sem licitação</option>
                      {sources.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.reference}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Órgão público *
                    <select
                      className="field"
                      name="organizationId"
                      required
                      key={sourceId}
                      defaultValue={source?.organizationId ?? ""}
                      disabled={!!source}
                    >
                      <option value="">Selecione</option>
                      {agencies.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <InstrumentFields
              key={`${type}-${caseId}`}
              type={type}
              initial={initial}
              terms={
                id
                  ? availableTerms
                  : existing?.termId
                    ? [{ id: existing.termId, label: existing.label }]
                    : []
              }
            />
          </div>
          {!id && source && !caseId && (
            <section className="space-y-3">
              <h2 className="font-semibold">Itens vencedores da contratação</h2>
              <p className="text-sm text-slate-500">
                Selecione os itens e as quantidades deste negócio. Descrição e
                preço serão copiados da proposta vencedora.
              </p>
              {source.items.map((i) => (
                <label
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3"
                >
                  <input
                    type="checkbox"
                    name={`include-${i.id}`}
                    defaultChecked
                  />
                  <span className="min-w-40 flex-1">
                    {i.number} · {i.description}
                  </span>
                  <span>Quantidade</span>
                  <input
                    className="field w-32"
                    aria-label={`Quantidade item ${i.number}`}
                    name={`quantity-${i.id}`}
                    inputMode="decimal"
                    defaultValue={i.quantity}
                  />
                </label>
              ))}
              {!source.items.length && (
                <p>
                  Não há itens vencedores com preço preenchido nesta
                  contratação.
                </p>
              )}
            </section>
          )}
          {!id && !source && !caseId && (
            <p className="text-sm text-slate-500">
              Após salvar, cadastre os itens contratados na aba Dados gerais.
            </p>
          )}
          <div className="flex gap-3 border-t border-slate-100 pt-5">
            <button className="btn" type="submit">
              <ButtonContent action="save" />
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() =>
                router.push(id ? `/contratos/${id}` : "/contratos")
              }
            >
              <ButtonContent action="cancel" />
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
