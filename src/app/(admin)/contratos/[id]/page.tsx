import Link from "next/link";
import { Ban, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getContract, contractBalances } from "@/server/contracts";
import {
  instrumentTypes,
  instrumentStatuses,
  fixed,
  units,
  orderStatus,
} from "@/lib/contracts";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
import { ContractForm } from "@/components/contract-form";
import { ContractOperation } from "@/components/contract-operation";
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "";
const date = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d)
    : "Não informado";
function Field({
  name,
  label,
  type = "text",
  value = "",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      {required ? " *" : ""}
      <input
        className="field"
        type={type === "decimal" ? "text" : type}
        inputMode={type === "decimal" ? "decimal" : undefined}
        name={name}
        defaultValue={value}
        required={required}
      />
    </label>
  );
}
function Notes() {
  return (
    <>
      <Field name="documentUrl" label="Link do documento" type="url" />
      <label>
        Observações
        <textarea className="field" rows={2} name="notes" />
      </label>
    </>
  );
}
function Save() {
  return (
    <div className="pt-4">
      <button type="submit" className="btn">
        <ButtonContent action="save" />
      </button>
    </div>
  );
}
function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold text-brand-700">
        {title}
      </summary>
      <div className="pt-5">{children}</div>
    </details>
  );
}
function Op({
  operation,
  id,
  version,
  tab,
  recordId,
  children,
  confirmation,
}: {
  operation: string;
  id: string;
  version: number;
  tab: string;
  recordId?: string;
  children: ReactNode;
  confirmation?: string;
}) {
  return (
    <ContractOperation
      operation={operation}
      id={id}
      version={version}
      recordId={recordId}
      confirmation={confirmation}
    >
      <input type="hidden" name="tab" value={tab} />
      {children}
    </ContractOperation>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; saved?: string; edit?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const query = await searchParams;
  const contract = await getContract(db, id);
  if (!contract) notFound();
  const c = contract.case,
    b = contractBalances(c);
  const version = c.version;
  const isTerm = contract.instrumentType === "TERM";
  const tabs = [
    ["geral", "Dados gerais"],
    ["pedidos", "Pedidos"],
    ["notas", "Notas Fiscais"],
    ["garantias", "Garantias"],
    ...(isTerm ? [["aditivos", "Aditivos"]] : []),
  ];
  const tab = tabs.some((t) => t[0] === query.tab) ? query.tab! : "geral";
  const quantityFields = (mode: "order" | "invoice") => (
    <div className="overflow-x-auto">
      <table className="contract-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Descrição</th>
            <th>
              {mode === "order" ? "Saldo para pedidos" : "Saldo para faturar"}
            </th>
            <th>Quantidade nesta operação</th>
          </tr>
        </thead>
        <tbody>
          {b.items.map((item) => (
            <tr key={item.id}>
              <td>{item.number}</td>
              <td className="max-w-72 truncate" title={item.description}>
                {item.description}
              </td>
              <td>
                {fixed(
                  mode === "order"
                    ? item.available
                    : item.quantityUnits - item.invoiced,
                  3,
                ).replace(".", ",")}
              </td>
              <td>
                <input type="hidden" name="itemId" value={item.id} />
                <input
                  className="field w-36"
                  aria-label={`Quantidade item ${item.number}`}
                  name={`quantity-${item.id}`}
                  inputMode="decimal"
                  placeholder="0,000"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const itemForm = (item?: (typeof c.items)[number]) => (
    <Op
      id={id}
      version={version}
      tab={tab}
      operation="item"
      recordId={item?.id}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="number"
          label="Número do item"
          type="number"
          value={item ? String(item.number) : ""}
          required
        />
        <Field name="unit" label="Unidade" value={item?.unit} required />
        <label className="sm:col-span-2">
          Descrição *
          <textarea
            className="field"
            rows={3}
            name="description"
            required
            defaultValue={item?.description}
          />
        </label>
        <Field name="brand" label="Marca" value={item?.brand ?? ""} />
        <Field name="model" label="Modelo" value={item?.model ?? ""} />
        <Field
          name="quantity"
          label="Quantidade (até 3 casas)"
          type="decimal"
          value={item?.quantity.toFixed(3)}
          required
        />
        <Field
          name="unitPrice"
          label="Preço unitário contratado (R$, até 4 casas)"
          type="decimal"
          value={item?.unitPrice.toFixed(4)}
          required
        />
      </div>
      <Save />
    </Op>
  );
  const effectiveEnd =
    c.amendments
      .filter((a) => !a.cancelled && a.instrumentId === id && a.newEndDate)
      .at(-1)?.newEndDate ?? contract.validUntil;
  return (
    <>
      <PageHeader
        eyebrow={
          contract.instrumentType
            ? instrumentTypes[contract.instrumentType]
            : "Cadastro legado"
        }
        title={contract.reference}
        description={c.organization.legalName}
        action={
          <Link href="/contratos" className="btn-secondary">
            <ButtonContent action="back" />
          </Link>
        }
      />
      {query.saved && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-emerald-50 p-4 text-emerald-800"
        >
          Registro salvo com sucesso.
        </p>
      )}
      {!contract.instrumentType && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-amber-50 p-4 text-amber-900"
        >
          Cadastro legado preservado. Complete o tipo, as datas e o valor do
          instrumento antes de iniciar a execução.
        </p>
      )}
      <section className="panel mb-6 grid gap-5 p-5 sm:grid-cols-4">
        {[
          ["Valor vigente do negócio", b.value],
          ["Faturado", b.invoiced],
          ["Recebido", b.received],
          ["Saldo a receber", b.receivable],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-sm text-slate-500">{String(label)}</p>
            <p className="mt-2 text-xl font-semibold">
              {money(fixed(value as bigint, 2))}
            </p>
          </div>
        ))}
        <p className="text-xs text-slate-500 sm:col-span-4">
          Negócio {c.reference} · Valores compartilhados entre Termo e empenhos
          vinculados. Não somar os instrumentos. Saldo a faturar:{" "}
          {money(fixed(b.remaining, 2))}.
        </p>
      </section>
      <nav
        aria-label="Abas do contrato"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/contratos/${id}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-brand-600"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="panel contract-fields space-y-6 p-5 sm:p-6">
        {tab === "geral" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h2 className="font-semibold">Dados do instrumento</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  {[
                    ["Situação", instrumentStatuses[contract.status]],
                    ["Data", date(contract.issuedAt)],
                    [
                      "Valor original",
                      contract.amount !== null
                        ? money(contract.amount.toFixed(2))
                        : "Não informado",
                    ],
                    ...(isTerm
                      ? [
                          ["Assinatura", date(contract.signatureDate)],
                          [
                            "Vigência original",
                            `${date(contract.validFrom)} a ${date(contract.validUntil)}`,
                          ],
                          [
                            "Vigência atual",
                            `${date(contract.validFrom)} a ${date(effectiveEnd)}`,
                          ],
                          [
                            "Referência de empenho",
                            contract.commitmentReference ?? "Não informada",
                          ],
                        ]
                      : [
                          [
                            "Prazo de fornecimento",
                            date(contract.supplyDeadline),
                          ],
                        ]),
                  ].map(([l, v]) => (
                    <div key={l}>
                      <dt className="text-slate-500">{l}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                {contract.documentUrl && (
                  <a
                    className="mt-4 inline-block text-brand-700 underline"
                    href={contract.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir documento
                  </a>
                )}
                {contract.notes && (
                  <p className="mt-4 whitespace-pre-wrap text-sm">
                    {contract.notes}
                  </p>
                )}
              </div>
              <div>
                <h2 className="font-semibold">Instrumentos do mesmo negócio</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {c.instruments.map((i) => (
                    <li key={i.id}>
                      <Link
                        className="text-brand-700 underline"
                        href={`/contratos/${i.id}`}
                      >
                        {i.instrumentType
                          ? instrumentTypes[i.instrumentType]
                          : "Legado"}{" "}
                        · {i.reference}
                      </Link>
                      {i.parentTermId && (
                        <span className="block text-xs text-slate-500">
                          Vinculado ao Termo{" "}
                          {
                            c.instruments.find((t) => t.id === i.parentTermId)
                              ?.reference
                          }
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {c.opportunity && (
                  <p className="mt-5 text-sm">
                    Origem:{" "}
                    <Link
                      className="text-brand-700 underline"
                      href={`/contratacoes/${c.opportunity.id}`}
                    >
                      {c.opportunity.reference}
                    </Link>
                  </p>
                )}
                <p className="mt-4 text-sm text-slate-500">
                  Órgão registrado na criação:{" "}
                  {(c.organizationSnapshot as { legalName?: string })
                    .legalName ?? c.organization.legalName}
                </p>
              </div>
            </div>
            {c.opportunityId && !c.items.length && (
              <Op
                id={id}
                version={version}
                tab={tab}
                operation="copySource"
                confirmation="Copiar os itens e preços vencedores disponíveis atualmente na contratação de origem? Revise a proposta de origem antes de confirmar."
              >
                <button className="btn-secondary">
                  Copiar itens vencedores da origem
                </button>
              </Op>
            )}
            <Box title="Editar instrumento">
              <ContractForm
                id={id}
                version={version}
                availableTerms={c.instruments
                  .filter((i) => i.instrumentType === "TERM")
                  .map((i) => ({ id: i.id, label: i.reference }))}
                initial={{
                  instrumentType: contract.instrumentType,
                  reference: contract.reference,
                  amount: contract.amount?.toFixed(2) ?? "",
                  status: contract.status,
                  issuedAt: iso(contract.issuedAt),
                  signatureDate: iso(contract.signatureDate),
                  validFrom: iso(contract.validFrom),
                  validUntil: iso(contract.validUntil),
                  supplyDeadline: iso(contract.supplyDeadline),
                  parentTermId: contract.parentTermId,
                  commitmentReference: contract.commitmentReference,
                  notes: contract.notes,
                  documentUrl: contract.documentUrl,
                }}
              />
            </Box>
            <div>
              <h2 className="mb-4 font-semibold">Itens contratados e saldos</h2>
              <div className="overflow-x-auto">
                <table className="contract-table">
                  <thead>
                    <tr>
                      {[
                        "Item",
                        "Descrição",
                        "Quantidade original",
                        "Quantidade vigente",
                        "Preço original",
                        "Preço vigente",
                        "Pedido (reservado)",
                        "Fornecido",
                        "Faturado",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.number}</td>
                        <td className="max-w-72 truncate" title={i.description}>
                          {i.description}
                          <span className="block text-xs text-slate-500">
                            {[i.brand, i.model, i.unit]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </td>
                        <td>{i.quantity.toFixed(3).replace(".", ",")}</td>
                        <td>{i.effectiveQuantity.replace(".", ",")}</td>
                        <td>{i.unitPrice.toFixed(4).replace(".", ",")}</td>
                        <td>{i.effectivePrice.replace(".", ",")}</td>
                        <td>{fixed(i.reserved, 3).replace(".", ",")}</td>
                        <td>{fixed(i.supplied, 3).replace(".", ",")}</td>
                        <td>{fixed(i.invoiced, 3).replace(".", ",")}</td>
                      </tr>
                    ))}
                    {!b.items.length && (
                      <tr>
                        <td colSpan={9}>Nenhum item contratado cadastrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {!c.opportunityId &&
              !c.orders.length &&
              !c.invoices.length &&
              !c.amendments.length && (
                <>
                  <Box title="Adicionar item contratado">{itemForm()}</Box>
                  {c.items.map((i) => (
                    <Box key={i.id} title={`Editar item ${i.number}`}>
                      {itemForm(i)}
                      <Op
                        id={id}
                        version={version}
                        tab={tab}
                        operation="deleteItem"
                        recordId={i.id}
                        confirmation="Excluir este item manual? Esta ação não pode ser desfeita."
                      >
                        <button className="btn-secondary mt-4">
                          <Trash2 size={17} />
                          Excluir item
                        </button>
                      </Op>
                    </Box>
                  ))}
                </>
              )}
          </>
        )}
        {tab === "pedidos" && (
          <>
            <p className="text-sm text-slate-500">
              Pedidos do negócio comercial. Registre diretamente a quantidade
              acumulada fornecida em cada pedido; o saldo pendente é calculado
              automaticamente.
            </p>
            <Box title="Novo pedido">
              <Op id={id} version={version} tab={tab} operation="order">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    name="reference"
                    label="Referência do pedido (opcional)"
                  />
                  <Field
                    name="orderDate"
                    label="Data do pedido"
                    type="date"
                    required
                  />
                  <Field
                    name="deadline"
                    label="Prazo de fornecimento"
                    type="date"
                    value={iso(contract.supplyDeadline)}
                  />
                </div>
                <label>
                  Observações
                  <textarea className="field" rows={2} name="notes" />
                </label>
                {quantityFields("order")}
                <Save />
              </Op>
            </Box>
            {c.orders.map((order) => (
              <article
                key={order.id}
                className="space-y-4 rounded-lg border border-slate-200 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold">
                    Pedido {order.reference ?? order.id.slice(-8)}
                  </h2>
                  <span>{orderStatus(order.cancelled, order.items)}</span>
                </div>
                <p className="text-sm text-slate-500">
                  {date(order.orderDate)} · Prazo: {date(order.deadline)} ·
                  Instrumento:{" "}
                  {
                    c.instruments.find((i) => i.id === order.instrumentId)
                      ?.reference
                  }
                </p>
                {order.notes && (
                  <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
                )}
                <Op id={id} version={version} tab={tab} operation="supply">
                  <input type="hidden" name="orderId" value={order.id} />
                  <div className="overflow-x-auto">
                    <table className="contract-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Quantidade pedida</th>
                          <th>Fornecido acumulado</th>
                          <th>Pendente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((row) => (
                          <tr key={row.id}>
                            <td>
                              {
                                c.items.find((i) => i.id === row.contractItemId)
                                  ?.number
                              }
                            </td>
                            <td>
                              {row.requestedQuantity
                                .toFixed(3)
                                .replace(".", ",")}
                            </td>
                            <td>
                              <input
                                type="hidden"
                                name="itemId"
                                value={row.id}
                              />
                              <input
                                className="field w-36"
                                aria-label={`Fornecido item ${c.items.find((i) => i.id === row.contractItemId)?.number}`}
                                name={`supplied-${row.id}`}
                                inputMode="decimal"
                                defaultValue={row.suppliedQuantity.toFixed(3)}
                                disabled={order.cancelled}
                              />
                            </td>
                            <td>
                              {fixed(
                                units(row.requestedQuantity, 3) -
                                  units(row.suppliedQuantity, 3),
                                3,
                              ).replace(".", ",")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!order.cancelled && <Save />}
                </Op>
                {!order.cancelled && (
                  <Box
                    title={`Editar dados do pedido ${order.reference ?? order.id.slice(-8)}`}
                  >
                    <Op
                      id={id}
                      version={version}
                      tab={tab}
                      operation="updateOrder"
                      recordId={order.id}
                    >
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field
                          name="reference"
                          label="Referência do pedido"
                          value={order.reference ?? ""}
                        />
                        <Field
                          name="orderDate"
                          label="Data do pedido"
                          type="date"
                          value={iso(order.orderDate)}
                          required
                        />
                        <Field
                          name="deadline"
                          label="Prazo de fornecimento"
                          type="date"
                          value={iso(order.deadline)}
                        />
                      </div>
                      <label>
                        Observações
                        <textarea
                          className="field"
                          rows={2}
                          name="notes"
                          defaultValue={order.notes ?? ""}
                        />
                      </label>
                      {order.items.map((row) => (
                        <label key={row.id}>
                          Quantidade pedida · item{" "}
                          {
                            c.items.find((i) => i.id === row.contractItemId)
                              ?.number
                          }
                          <input
                            type="hidden"
                            name="itemId"
                            value={row.contractItemId}
                          />
                          <input
                            className="field"
                            name={`quantity-${row.contractItemId}`}
                            inputMode="decimal"
                            defaultValue={row.requestedQuantity.toFixed(3)}
                            required
                          />
                        </label>
                      ))}
                      <Save />
                    </Op>
                  </Box>
                )}
                {!order.cancelled && (
                  <Op
                    id={id}
                    version={version}
                    tab={tab}
                    operation="cancelOrder"
                    recordId={order.id}
                    confirmation="Cancelar este pedido? Quantidades já fornecidas e faturadas continuarão no histórico e nos saldos."
                  >
                    <button className="btn-secondary" type="submit">
                      Cancelar pedido
                    </button>
                  </Op>
                )}
              </article>
            ))}
            {!c.orders.length && <p>Nenhum pedido registrado.</p>}
          </>
        )}
        {tab === "notas" && (
          <>
            <Box title="Nova nota fiscal">
              <Op id={id} version={version} tab={tab} operation="invoice">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    name="reference"
                    label="Número da nota fiscal"
                    required
                  />
                  <Field
                    name="issueDate"
                    label="Data de emissão"
                    type="date"
                    required
                  />
                  <label>
                    Pedido (opcional)
                    <select className="field" name="orderId">
                      <option value="">Sem pedido vinculado</option>
                      {c.orders
                        .filter((o) => !o.cancelled)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.reference ?? o.id.slice(-8)}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <Notes />
                {quantityFields("invoice")}
                <p className="text-xs text-slate-500">
                  Os preços vigentes serão registrados na nota. Alterações
                  posteriores por aditivos não modificam notas já cadastradas.
                </p>
                <Save />
              </Op>
            </Box>
            {c.invoices.map((invoice) => {
              const received = invoice.receipts.reduce(
                (s, r) => s + units(r.amount, 2),
                0n,
              );
              const pending = units(invoice.amount, 2) - received;
              return (
                <article
                  key={invoice.id}
                  className="space-y-4 rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <h2 className="font-semibold">
                      Nota fiscal {invoice.reference}
                    </h2>
                    <span>
                      {invoice.cancelled
                        ? "Cancelada"
                        : pending === 0n
                          ? "Recebida"
                          : received > 0n
                            ? "Parcialmente recebida"
                            : "A receber"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Emissão: {date(invoice.issueDate)} · Instrumento:{" "}
                    {
                      c.instruments.find((i) => i.id === invoice.instrumentId)
                        ?.reference
                    }
                    {invoice.orderId
                      ? ` · Pedido: ${c.orders.find((o) => o.id === invoice.orderId)?.reference ?? invoice.orderId.slice(-8)}`
                      : ""}
                  </p>
                  {invoice.documentUrl && (
                    <a
                      className="text-brand-700 underline"
                      href={invoice.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir documento
                    </a>
                  )}
                  {invoice.notes && (
                    <p className="whitespace-pre-wrap text-sm">
                      {invoice.notes}
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="contract-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Descrição</th>
                          <th>Quantidade</th>
                          <th>Preço unitário</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.items.map((row) => (
                          <tr key={row.id}>
                            <td>
                              {
                                c.items.find((i) => i.id === row.contractItemId)
                                  ?.number
                              }
                            </td>
                            <td
                              className="max-w-72 truncate"
                              title={row.description}
                            >
                              {row.description}
                            </td>
                            <td>{row.quantity.toFixed(3).replace(".", ",")}</td>
                            <td>
                              {row.unitPrice.toFixed(4).replace(".", ",")}
                            </td>
                            <td>{money(row.total.toFixed(2))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="font-semibold">
                    Total: {money(invoice.amount.toFixed(2))} · Recebido:{" "}
                    {money(fixed(received, 2))} · Saldo:{" "}
                    {money(fixed(pending, 2))}
                  </p>
                  {invoice.receipts.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {invoice.receipts.map((r) => (
                        <li key={r.id}>
                          Recebimento em {date(r.date)}:{" "}
                          {money(r.amount.toFixed(2))}
                          {r.notes ? ` · ${r.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!invoice.cancelled && pending > 0n && (
                    <Box
                      title={`Registrar recebimento da NF ${invoice.reference}`}
                    >
                      <Op
                        id={id}
                        version={version}
                        tab={tab}
                        operation="receipt"
                      >
                        <input
                          type="hidden"
                          name="invoiceId"
                          value={invoice.id}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            name="date"
                            label="Data do recebimento"
                            type="date"
                            required
                          />
                          <Field
                            name="amount"
                            label="Valor recebido (R$)"
                            type="decimal"
                            required
                          />
                        </div>
                        <label>
                          Observações
                          <textarea className="field" name="notes" rows={2} />
                        </label>
                        <Save />
                      </Op>
                    </Box>
                  )}
                  {!invoice.cancelled && !invoice.receipts.length && (
                    <Op
                      id={id}
                      version={version}
                      tab={tab}
                      operation="cancelInvoice"
                      recordId={invoice.id}
                      confirmation="Cancelar a nota fiscal e liberar seus saldos? O documento continuará no histórico."
                    >
                      <button className="btn-secondary">
                        Cancelar nota fiscal
                      </button>
                    </Op>
                  )}
                </article>
              );
            })}
            {!c.invoices.length && <p>Nenhuma nota fiscal registrada.</p>}
          </>
        )}
        {tab === "garantias" && (
          <>
            <p className="text-sm text-slate-500">
              Garantias são opcionais e pertencem a este instrumento.
            </p>
            <Box title="Nova garantia">
              <Op id={id} version={version} tab={tab} operation="guarantee">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="type" label="Tipo de garantia" required />
                  <Field
                    name="amount"
                    label="Valor (R$)"
                    type="decimal"
                    required
                  />
                  <Field
                    name="validUntil"
                    label="Validade"
                    type="date"
                    required
                  />
                  <label>
                    Situação
                    <select className="field" name="status">
                      <option value="ACTIVE">Ativa</option>
                      <option value="RELEASED">Liberada</option>
                      <option value="CANCELLED">Cancelada</option>
                    </select>
                  </label>
                </div>
                <Notes />
                <Save />
              </Op>
            </Box>
            {c.guarantees
              .filter((g) => g.instrumentId === id)
              .map((g) => (
                <Box
                  key={g.id}
                  title={`${g.type} · ${money(g.amount.toFixed(2))} · ${g.status === "ACTIVE" ? "Ativa" : g.status === "RELEASED" ? "Liberada" : "Cancelada"} · ${date(g.validUntil)}`}
                >
                  <Op
                    id={id}
                    version={version}
                    tab={tab}
                    operation="guarantee"
                    recordId={g.id}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        name="type"
                        label="Tipo de garantia"
                        value={g.type}
                        required
                      />
                      <Field
                        name="amount"
                        label="Valor (R$)"
                        type="decimal"
                        value={g.amount.toFixed(2)}
                        required
                      />
                      <Field
                        name="validUntil"
                        label="Validade"
                        type="date"
                        value={iso(g.validUntil)}
                        required
                      />
                      <label>
                        Situação
                        <select
                          className="field"
                          name="status"
                          defaultValue={g.status}
                        >
                          <option value="ACTIVE">Ativa</option>
                          <option value="RELEASED">Liberada</option>
                          <option value="CANCELLED">Cancelada</option>
                        </select>
                      </label>
                      <Field
                        name="documentUrl"
                        label="Link do documento"
                        type="url"
                        value={g.documentUrl ?? ""}
                      />
                      <label>
                        Observações
                        <textarea
                          className="field"
                          name="notes"
                          rows={2}
                          defaultValue={g.notes ?? ""}
                        />
                      </label>
                    </div>
                    <Save />
                  </Op>
                </Box>
              ))}
          </>
        )}
        {tab === "aditivos" && isTerm && (
          <>
            <p className="text-sm text-slate-500">
              Informe acréscimos com valores positivos e reduções com negativos.
              Os valores originais são preservados; pedidos, notas e
              recebimentos anteriores não serão reescritos.
            </p>
            <Box title="Novo aditivo">
              <Op id={id} version={version} tab={tab} operation="amendment">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="reference" label="Número do aditivo" required />
                  <Field
                    name="date"
                    label="Data do aditivo"
                    type="date"
                    required
                  />
                  <Field name="type" label="Tipo / motivo" required />
                  <Field
                    name="valueDelta"
                    label="Variação do valor contratado (R$)"
                    type="decimal"
                    value="0,00"
                    required
                  />
                  <Field
                    name="newEndDate"
                    label="Nova data final de vigência (opcional)"
                    type="date"
                  />
                </div>
                <Notes />
                <div className="overflow-x-auto">
                  <table className="contract-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Variação de quantidade</th>
                        <th>Variação do preço unitário (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.items.map((i) => (
                        <tr key={i.id}>
                          <td>
                            {i.number} · {i.description.slice(0, 70)}
                          </td>
                          <td>
                            <input type="hidden" name="itemId" value={i.id} />
                            <input
                              className="field w-36"
                              aria-label={`Variação de quantidade item ${i.number}`}
                              name={`quantityDelta-${i.id}`}
                              inputMode="decimal"
                              defaultValue="0,000"
                            />
                          </td>
                          <td>
                            <input
                              className="field w-36"
                              aria-label={`Variação de preço item ${i.number}`}
                              name={`unitPriceDelta-${i.id}`}
                              inputMode="decimal"
                              defaultValue="0,0000"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Save />
              </Op>
            </Box>
            {c.amendments
              .filter((a) => a.instrumentId === id)
              .map((a) => (
                <article
                  className="space-y-3 rounded-lg border border-slate-200 p-4"
                  key={a.id}
                >
                  <h2 className="font-semibold">
                    Aditivo {a.reference}
                    {a.cancelled ? " · Cancelado" : ""}
                  </h2>
                  <p>
                    {date(a.date)} · {a.type} · Variação de valor:{" "}
                    {money(a.valueDelta.toFixed(2))}
                    {a.newEndDate
                      ? ` · Nova vigência até ${date(a.newEndDate)}`
                      : ""}
                  </p>
                  {a.items.map((i) => (
                    <p className="text-sm" key={i.id}>
                      Item{" "}
                      {
                        c.items.find((row) => row.id === i.contractItemId)
                          ?.number
                      }
                      : quantidade{" "}
                      {i.quantityDelta.toFixed(3).replace(".", ",")} · preço
                      unitário {i.unitPriceDelta.toFixed(4).replace(".", ",")}
                    </p>
                  ))}
                  {a.documentUrl && (
                    <a
                      className="text-brand-700 underline"
                      href={a.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir documento
                    </a>
                  )}
                  {a.notes && (
                    <p className="whitespace-pre-wrap text-sm">{a.notes}</p>
                  )}
                  {!a.cancelled && (
                    <Op
                      id={id}
                      version={version}
                      tab={tab}
                      operation="cancelAmendment"
                      recordId={a.id}
                      confirmation="Cancelar este aditivo? A operação só será permitida se os saldos já utilizados continuarem válidos."
                    >
                      <button className="btn-secondary">
                        <Ban size={17} />
                        Cancelar aditivo
                      </button>
                    </Op>
                  )}
                </article>
              ))}
          </>
        )}
      </section>
    </>
  );
}
