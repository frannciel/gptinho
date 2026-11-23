"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { HelpTooltip } from "./help-tooltip";
import { contractAction } from "@/app/(admin)/contratos/actions";
import {
  instrumentStatuses,
  instrumentTypes,
  reconcileContractValue,
  decimal,
} from "@/lib/contracts";
import { ContractSearch, type ContractChoice } from "./contract-search";
import { money } from "@/lib/format";
type Item = {
  id: string;
  number: number;
  description: string;
  unit: string;
  brand: string | null;
  model: string | null;
  quantity: string;
  unitPrice: string;
};
type Source = {
  id: string;
  reference: string;
  organizationId: string;
  items: Item[];
  organization: ContractChoice;
};
export function InstrumentFields({
  type,
  initial = {},
}: {
  type: string;
  initial?: Record<string, string | null>;
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
        type === "TERM"
          ? "Número do contrato"
          : "Número do empenho substitutivo",
        "text",
        true,
      )}
      {type === "COMMITMENT" &&
        field("issuedAt", "Data de emissão do empenho", "date", true)}
      <label>
        Valor original (R$) *
        <input
          className="field"
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          required
          defaultValue={initial.amount ?? ""}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="continuous"
          defaultChecked={initial.continuous === "true"}
        />
        Continuado
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
        </>
      ) : (
        field("supplyDeadline", "Prazo de fornecimento (se aplicável)", "date")
      )}
      <div className="sm:col-span-2">
        <div className="flex items-center gap-2">
          <label htmlFor="contract-publication-url">Link da publicação</label>
          <HelpTooltip
            id="contract-publication-help"
            label="Ajuda sobre link da publicação"
            text="Informe o link da publicação no PNCP ou no Diário Oficial da União, do Estado ou do Município."
          />
        </div>
        <input
          id="contract-publication-url"
          className="field"
          type="url"
          name="publicationUrl"
          defaultValue={initial.publicationUrl ?? ""}
        />
      </div>
      <label className="sm:col-span-2">
        Link do diretório ou documento
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
  initial,
  id,
  version,
  initialItems = [],
}: {
  initial?: Record<string, string | null>;
  id?: string;
  version?: number;
  initialItems?: { quantity: string; unitPrice: string }[];
}) {
  const router = useRouter();
  const [type, setType] = useState(initial?.instrumentType ?? "");
  const [source, setSource] = useState<Source | null>(null);
  const [sourceChoice, setSourceChoice] = useState<ContractChoice | null>(null);
  const [agency, setAgency] = useState<ContractChoice | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const sourceRequest = useRef<AbortController | null>(null);
  useEffect(() => () => sourceRequest.current?.abort(), []);
  async function selectSource(choice: ContractChoice | null) {
    sourceRequest.current?.abort();
    setSourceChoice(choice);
    setSource(null);
    setSourceError("");
    setComparison(null);
    if (!choice) {
      setSourceLoading(false);
      return;
    }
    const controller = new AbortController();
    sourceRequest.current = controller;
    setSourceLoading(true);
    try {
      const response = await fetch(
        `/api/admin/contratos/busca?kind=source&sourceId=${encodeURIComponent(choice.id)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok)
        throw Error(
          "Não foi possível carregar a contratação. Pesquise e selecione novamente.",
        );
      const data = (await response.json()) as Source;
      if (!controller.signal.aborted) {
        setSource(data);
        setAgency(data.organization);
      }
    } catch (e) {
      if (!controller.signal.aborted) setSourceError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setSourceLoading(false);
    }
  }
  const [comparison, setComparison] = useState<
    ReturnType<typeof reconcileContractValue> | null | undefined
  >(undefined);
  const current =
    comparison === undefined
      ? initial?.amount
        ? reconcileContractValue(initial.amount, initialItems)
        : null
      : comparison;
  const compare = (target: EventTarget) => {
    if (!(target instanceof HTMLInputElement)) return;
    if (
      target.name !== "amount" &&
      !target.name.startsWith("quantity-") &&
      !target.name.startsWith("include-")
    )
      return;
    const form = target.closest("form");
    if (!form) return;
    const data = new FormData(form);
    const amount = decimal(2).safeParse(String(data.get("amount") ?? ""));
    if (!amount.success) {
      setComparison(null);
      return;
    }
    try {
      const items = id
        ? initialItems
        : (source?.items ?? [])
            .filter((i) => data.get(`include-${i.id}`) === "on")
            .map((i) => ({
              quantity: decimal(3, true).parse(
                String(data.get(`quantity-${i.id}`) ?? ""),
              ),
              unitPrice: i.unitPrice,
            }));
      setComparison(reconcileContractValue(amount.data, items));
    } catch {
      setComparison(null);
    }
  };
  return (
    <div onInput={(e) => compare(e.target)} onChange={(e) => compare(e.target)}>
      <ActionForm
        className="contract-fields space-y-6"
        action={async (data) => {
          const raw = Object.fromEntries(data);
          const instrument = {
            ...raw,
            instrumentType: type,
            continuous: data.get("continuous") === "on",
          };
          const items = source
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
                  opportunityId: sourceChoice?.id ?? "",
                  organizationId: agency?.id ?? "",
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
            name="instrumentType"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setComparison(null);
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
                <ContractSearch
                  label="Contratação de origem (opcional)"
                  kind="opportunity"
                  selected={sourceChoice}
                  onSelect={selectSource}
                />
                <ContractSearch
                  label="Órgão público"
                  kind="agency"
                  selected={agency}
                  onSelect={setAgency}
                  disabled={!!sourceChoice}
                  required
                />
                {sourceLoading && (
                  <p role="status">Carregando os itens vencedores…</p>
                )}
                {sourceError && (
                  <p role="alert" className="text-red-800">
                    {sourceError}
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <InstrumentFields key={type} type={type} initial={initial} />
            </div>
            {!id && source && (
              <section className="space-y-3">
                <h2 className="font-semibold">
                  Itens vencedores da contratação
                </h2>
                <p className="text-sm text-slate-500">
                  Selecione os itens e as quantidades deste contrato. Descrição
                  e preço serão copiados da proposta vencedora.
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
                    Não há itens vencedores com preço preenchido e quantidade
                    disponível nesta contratação.
                  </p>
                )}
              </section>
            )}
            {current && !current.matches && (
              <p
                role="alert"
                className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
              >
                Valor divergente: informado {money(current.declared ?? "0.00")};
                total dos itens {money(current.total)}. Os valores devem
                coincidir até os centavos. Confira o valor e conclua o cadastro
                dos itens.
              </p>
            )}
            {current?.matches && (
              <p className="text-sm text-emerald-800">
                Valor conferido com o total dos itens: {money(current.total)}.
              </p>
            )}
            {!id && !source && (
              <p className="text-sm text-slate-500">
                Após salvar, cadastre os itens contratados na aba Dados gerais.
                O alerta de divergência será atualizado a cada alteração.
              </p>
            )}
            <div className="flex gap-3 border-t border-slate-100 pt-5">
              <button
                className="btn"
                type="submit"
                disabled={
                  sourceLoading ||
                  (!id && (!agency || (!!sourceChoice && !source)))
                }
              >
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
    </div>
  );
}
