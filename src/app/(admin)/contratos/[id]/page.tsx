import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, Ban } from "lucide-react";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  getContract,
  contractBalances,
  contractValueCheck,
} from "@/server/contracts";
import {
  instrumentTypes,
  instrumentStatuses,
  amendmentKinds,
  endorsementKinds,
  guaranteeTypes,
  fixed,
  units,
  orderStatus,
  lineValue,
  quantityText,
  quantityInput,
} from "@/lib/contracts";
import { money } from "@/lib/format";
import { ContractStatusBadge } from "@/components/contract-status-badge";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
import { ContractForm } from "@/components/contract-form";
import { ContractOperation } from "@/components/contract-operation";
import { ContractAmendmentForm } from "@/components/contract-amendment-form";
import { ContractEndorsementForm } from "@/components/contract-endorsement-form";
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
        name={name}
        type={
          type === "quantity" ? "number" : type === "decimal" ? "text" : type
        }
        inputMode={
          type === "quantity"
            ? "numeric"
            : type === "decimal"
              ? "decimal"
              : undefined
        }
        step={type === "quantity" ? "1" : undefined}
        defaultValue={value}
        required={required}
      />
    </label>
  );
}
function Notes() {
  return (
    <>
      <Field
        name="documentUrl"
        label="Link do diretório ou documento"
        type="url"
      />
      <label>
        Observações
        <textarea className="field" name="notes" rows={2} />
      </label>
    </>
  );
}
function Save() {
  return (
    <div className="pt-4">
      <button className="btn">
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
  id,
  version,
  tab,
  operation,
  recordId,
  confirmation,
  children,
}: {
  id: string;
  version: number;
  tab: string;
  operation: string;
  recordId?: string;
  confirmation?: string;
  children: ReactNode;
}) {
  return (
    <ContractOperation
      id={id}
      version={version}
      operation={operation}
      recordId={recordId}
      confirmation={confirmation}
    >
      <input type="hidden" name="tab" value={tab} />
      {operation.startsWith("delete") && (
        <input type="hidden" name="confirmed" value="true" />
      )}
      {children}
    </ContractOperation>
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; saved?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const query = await searchParams;
  const contract = await getContract(db, id);
  if (!contract) notFound();
  const c = contract.case,
    b = contractBalances(c),
    version = c.version,
    check = contractValueCheck(c, id);
  const isTerm = contract.instrumentType === "TERM";
  const tabs = [
    ["geral", "Dados gerais"],
    ["pedidos", "Pedidos"],
    ["notas", "Notas Fiscais"],
    ["garantias", "Garantias"],
    ...(isTerm ? [["aditivos", "Aditivos"]] : []),
    ["apostilamento", "Apostilamento"],
  ];
  const tab = tabs.some((t) => t[0] === query.tab) ? query.tab! : "geral";
  const receiptCount = c.invoices.reduce((s, n) => s + n.receipts.length, 0);
  const eraseContract = `Excluir definitivamente o contrato ${contract.reference}? Serão apagados ${c.items.length} itens, ${c.orders.length} Pedidos, ${c.invoices.length} notas fiscais, ${receiptCount} recebimentos, ${c.guarantees.length} garantias, ${c.amendments.length} aditivos e ${c.endorsements.length} apostilamentos. Esta perda de dados é irreversível no sistema.`;
  const props = { id, version, tab };
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
          <div className="flex flex-wrap gap-3">
            <Link href="/contratos" className="btn-secondary">
              <ButtonContent action="back" />
            </Link>
            <Op
              {...props}
              operation="deleteContract"
              confirmation={eraseContract}
            >
              <button className="btn-secondary text-red-700">
                <Trash2 size={17} />
                Excluir contrato
              </button>
            </Op>
          </div>
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
        <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-4">
          Cadastro legado preservado. Complete os dados antes de iniciar a
          execução.
        </p>
      )}
      {!check.matches && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          Valor divergente: valor atualizado {money(check.declared ?? "0.00")};
          total dos itens atualizados {money(check.total)}. Confira os valores
          em centavos.
        </p>
      )}
      {c.instruments.filter(
        (i) => i.instrumentType !== "COMMITMENT" || i.substitutive,
      ).length > 1 && (
        <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-4 text-sm">
          Cadastro legado com itens compartilhados entre contratos. Revise a
          separação antes de novos lançamentos. Recebimentos de notas existentes
          continuam disponíveis.
        </p>
      )}
      {(c.items.some((i) => units(i.quantity, 3) % 1000n !== 0n) ||
        c.orders.some((o) =>
          o.items.some(
            (i) =>
              units(i.requestedQuantity, 3) % 1000n !== 0n ||
              units(i.suppliedQuantity, 3) % 1000n !== 0n,
          ),
        )) && (
        <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-4 text-sm">
          Há quantidades fracionárias legadas neste contrato. Os valores
          históricos foram preservados; revise-os antes de novas alterações.
          Novas quantidades devem ser inteiras.
        </p>
      )}
      <section className="panel mb-6 grid gap-5 p-5 sm:grid-cols-3">
        {[
          ["Valor original", contract.amount?.toFixed(2) ?? "0.00"],
          ["Valor atualizado", fixed(b.value, 2)],
          ["Saldo a faturar no período", fixed(b.remaining, 2)],
          ["Faturado acumulado", fixed(b.invoiced, 2)],
          ["Recebido acumulado", fixed(b.received, 2)],
          ["Saldo a receber", fixed(b.receivable, 2)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-semibold">{money(value)}</p>
          </div>
        ))}
        <p className="text-xs text-slate-500 sm:col-span-3">
          Período atual {b.currentPeriod.number}:{" "}
          {date(b.currentPeriod.startsAt)} a {date(b.currentPeriod.endsAt)}.
          Quantidades disponíveis e valor atualizado pertencem ao período atual;
          faturamento e recebimentos acumulados preservam todo o histórico.
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
                <h2 className="font-semibold">Dados do contrato</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  {[
                    ["Situação", instrumentStatuses[contract.status]],
                    ["Continuado", contract.continuous ? "Sim" : "Não"],
                    ...(isTerm
                      ? [
                          ["Assinatura", date(contract.signatureDate)],
                          [
                            "Vigência original",
                            `${date(contract.validFrom)} a ${date(contract.validUntil)}`,
                          ],
                          [
                            "Vigência atual",
                            `${date(b.currentPeriod.startsAt)} a ${date(b.currentPeriod.endsAt)}`,
                          ],
                        ]
                      : [
                          [
                            "Data de emissão do empenho",
                            date(contract.issuedAt),
                          ],
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
                {contract.publicationUrl && (
                  <a
                    className="mt-4 block text-brand-700 underline"
                    href={contract.publicationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir publicação
                  </a>
                )}
                {contract.documentUrl && (
                  <a
                    className="mt-4 block text-brand-700 underline"
                    href={contract.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir diretório ou documento
                  </a>
                )}
                {contract.notes && (
                  <p className="mt-4 whitespace-pre-wrap text-sm">
                    {contract.notes}
                  </p>
                )}
              </div>
              <div>
                <h2 className="font-semibold">Origem e órgão contratante</h2>
                {c.opportunity && (
                  <p className="mt-4 text-sm">
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
                <p className="mt-4 text-sm text-slate-500">
                  O valor original pode ser corrigido na edição sem alterar o
                  valor atualizado. Aditivos e apostilamentos atualizam o valor
                  do período e os itens.
                </p>
              </div>
            </div>
            <Box title="Editar contrato">
              <ContractForm
                id={id}
                version={version}
                initialItems={c.items.map((i) => ({
                  quantity: i.quantity.toFixed(3),
                  unitPrice: i.unitPrice.toFixed(4),
                }))}
                initial={{
                  instrumentType: contract.instrumentType,
                  reference: contract.reference,
                  amount: contract.amount?.toFixed(2) ?? "",
                  status: contract.status,
                  continuous: String(contract.continuous),
                  issuedAt: iso(contract.issuedAt),
                  signatureDate: iso(contract.signatureDate),
                  validFrom: iso(contract.validFrom),
                  validUntil: iso(contract.validUntil),
                  supplyDeadline: iso(contract.supplyDeadline),
                  documentUrl: contract.documentUrl,
                  publicationUrl: contract.publicationUrl,
                  notes: contract.notes,
                }}
              />
            </Box>
            {c.opportunityId && !c.items.length && (
              <Op
                {...props}
                operation="copySource"
                confirmation="Copiar os itens vencedores disponíveis atualmente na origem? Revise a proposta antes de confirmar."
              >
                <button className="btn-secondary">
                  Copiar itens vencedores da origem
                </button>
              </Op>
            )}
            <div>
              <h2 className="mb-4 font-semibold">
                Itens contratados — período {b.currentPeriod.number}
              </h2>
              <div className="overflow-x-auto">
                <table className="contract-table">
                  <thead>
                    <tr>
                      {[
                        "Item",
                        "Descrição",
                        "Quantidade inicial",
                        "Quantidade atualizada",
                        "Preço inicial",
                        "Preço atualizado",
                        "Pedido (reservado)",
                        "Fornecido",
                        "Disponível",
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
                        <td>{quantityText(i.quantity)}</td>
                        <td>{quantityText(i.effectiveQuantity)}</td>
                        <td>{i.unitPrice.toFixed(4).replace(".", ",")}</td>
                        <td>{i.effectivePrice.replace(".", ",")}</td>
                        <td>{quantityText(i.reserved)}</td>
                        <td>{quantityText(i.supplied)}</td>
                        <td>{quantityText(i.available)}</td>
                      </tr>
                    ))}
                    {!b.items.length && (
                      <tr>
                        <td colSpan={9}>Nenhum item cadastrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {!c.opportunityId &&
              !c.orders.length &&
              !c.invoices.length &&
              !c.amendments.length &&
              !c.endorsements.length && (
                <>
                  {[undefined, ...c.items].map((item, index) => (
                    <Box
                      key={item?.id ?? "new"}
                      title={
                        item
                          ? `Editar item ${item.number}`
                          : "Adicionar item contratado"
                      }
                    >
                      <Op {...props} operation="item" recordId={item?.id}>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            name="number"
                            label="Número do item"
                            type="number"
                            value={item ? String(item.number) : ""}
                            required
                          />
                          <Field
                            name="unit"
                            label="Unidade"
                            value={item?.unit}
                            required
                          />
                          <label className="sm:col-span-2">
                            Descrição *
                            <textarea
                              className="field"
                              name="description"
                              rows={3}
                              defaultValue={item?.description}
                              required
                            />
                          </label>
                          <Field
                            name="brand"
                            label="Marca"
                            value={item?.brand ?? ""}
                          />
                          <Field
                            name="model"
                            label="Modelo"
                            value={item?.model ?? ""}
                          />
                          <Field
                            name="quantity"
                            label="Quantidade"
                            type="quantity"
                            value={item ? quantityInput(item.quantity) : ""}
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
                      {index > 0 && item && (
                        <Op
                          {...props}
                          operation="deleteItem"
                          recordId={item.id}
                          confirmation="Excluir este item manual? A perda de dados é irreversível no sistema."
                        >
                          <button className="btn-secondary mt-4">
                            <Trash2 size={17} />
                            Excluir item
                          </button>
                        </Op>
                      )}
                    </Box>
                  ))}
                </>
              )}
            <Box title="Períodos de execução">
              <div className="overflow-x-auto">
                <table className="contract-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Início</th>
                      <th>Fim</th>
                      <th>Valor atualizado do período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.periods.map((p) => (
                      <tr key={p.id}>
                        <td>{p.number}</td>
                        <td>{date(p.startsAt)}</td>
                        <td>{date(p.endsAt)}</td>
                        <td>
                          {p.amount
                            ? money(p.amount.toFixed(2))
                            : "Não informado"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          </>
        )}
        {tab === "pedidos" && (
          <>
            <p className="text-sm text-slate-500">
              Novos Pedidos consomem somente o saldo do período atual. Pedidos
              anteriores mantêm seus dados, preços e fornecimento.
            </p>
            <Box title="Novo pedido">
              <Op {...props} operation="order">
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
                  <Field
                    name="commitmentNumber"
                    label="Número do empenho (opcional)"
                    value={!isTerm ? contract.reference : ""}
                  />
                  <Field
                    name="commitmentIssuedAt"
                    label="Data de emissão do empenho (opcional)"
                    type="date"
                    value={!isTerm ? iso(contract.issuedAt) : ""}
                  />
                </div>
                <label>
                  Observações
                  <textarea className="field" name="notes" rows={2} />
                </label>
                <div className="overflow-x-auto">
                  <table className="contract-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Descrição</th>
                        <th>Saldo disponível</th>
                        <th>Quantidade neste Pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.items.map((i) => (
                        <tr key={i.id}>
                          <td>{i.number}</td>
                          <td
                            className="max-w-72 truncate"
                            title={i.description}
                          >
                            {i.description}
                          </td>
                          <td>{quantityText(i.available)}</td>
                          <td>
                            <input type="hidden" name="itemId" value={i.id} />
                            <input
                              className="field w-36"
                              name={`quantity-${i.id}`}
                              aria-label={`Quantidade item ${i.number}`}
                              type="number"
                              step="1"
                              inputMode="numeric"
                              placeholder="0"
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
            {c.orders.map((order) => {
              const notes = c.invoices.filter((n) => n.orderId === order.id);
              const receipts = notes.reduce((s, n) => s + n.receipts.length, 0);
              const period = c.periods.find((p) => p.id === order.periodId);
              const orderAmount = order.items.every((i) => i.unitPrice !== null)
                ? order.items.reduce(
                    (s, i) =>
                      s +
                      units(
                        lineValue(
                          i.requestedQuantity.toFixed(3),
                          i.unitPrice!.toFixed(4),
                        ),
                        2,
                      ),
                    0n,
                  )
                : null;
              return (
                <article
                  key={order.id}
                  className="space-y-4 rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h2 className="font-semibold">
                      Pedido {order.reference ?? order.id.slice(-8)}
                    </h2>
                    <ContractStatusBadge
                      status={orderStatus(order.cancelled, order.items)}
                    />
                  </div>
                  <p className="text-sm text-slate-500">
                    Período {period?.number ?? 1} · {date(order.orderDate)} ·
                    Prazo: {date(order.deadline)}
                    {orderAmount !== null
                      ? ` · Valor: ${money(fixed(orderAmount, 2))}`
                      : " · Legado sem snapshot dos preços"}
                  </p>
                  <p className="text-sm text-slate-500">
                    Empenho: {order.commitmentNumber ?? "Não informado"} ·
                    Emissão: {date(order.commitmentIssuedAt)}
                  </p>
                  {order.notes && (
                    <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
                  )}
                  <Op {...props} operation="supply">
                    <input type="hidden" name="orderId" value={order.id} />
                    <div className="overflow-x-auto">
                      <table className="contract-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Pedido</th>
                            <th>Fornecido acumulado</th>
                            <th>Pendente</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((row) => (
                            <tr key={row.id}>
                              <td>
                                {
                                  c.items.find(
                                    (i) => i.id === row.contractItemId,
                                  )?.number
                                }
                              </td>
                              <td>{quantityText(row.requestedQuantity)}</td>
                              <td>
                                <input
                                  type="hidden"
                                  name="itemId"
                                  value={row.id}
                                />
                                <input
                                  className="field w-36"
                                  name={`supplied-${row.id}`}
                                  aria-label={`Fornecido item ${c.items.find((i) => i.id === row.contractItemId)?.number}`}
                                  type="number"
                                  step="1"
                                  inputMode="numeric"
                                  defaultValue={quantityInput(
                                    row.suppliedQuantity,
                                  )}
                                  disabled={order.cancelled}
                                />
                              </td>
                              <td>
                                {quantityText(
                                  units(row.requestedQuantity, 3) -
                                    units(row.suppliedQuantity, 3),
                                )}
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
                        {...props}
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
                          <Field
                            name="commitmentNumber"
                            label="Número do empenho (opcional)"
                            value={order.commitmentNumber ?? ""}
                          />
                          <Field
                            name="commitmentIssuedAt"
                            label="Data de emissão do empenho (opcional)"
                            type="date"
                            value={iso(order.commitmentIssuedAt)}
                          />
                        </div>
                        <label>
                          Observações
                          <textarea
                            className="field"
                            name="notes"
                            rows={2}
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
                              type="number"
                              step="1"
                              inputMode="numeric"
                              defaultValue={quantityInput(
                                row.requestedQuantity,
                              )}
                              required
                            />
                          </label>
                        ))}
                        <Save />
                      </Op>
                    </Box>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {!order.cancelled && (
                      <Op
                        {...props}
                        operation="cancelOrder"
                        recordId={order.id}
                        confirmation="Cancelar este Pedido? O histórico será preservado e os saldos já comprometidos continuarão protegidos."
                      >
                        <button className="btn-secondary">
                          <Ban size={17} />
                          Cancelar pedido
                        </button>
                      </Op>
                    )}
                    <Op
                      {...props}
                      operation="deleteOrder"
                      recordId={order.id}
                      confirmation={`Excluir definitivamente este Pedido, seus itens, ${notes.length} notas fiscais e ${receipts} recebimentos? A perda de dados é irreversível no sistema.`}
                    >
                      <button className="btn-secondary text-red-700">
                        <Trash2 size={17} />
                        Excluir pedido
                      </button>
                    </Op>
                  </div>
                </article>
              );
            })}
            {!c.orders.length && <p>Nenhum Pedido registrado.</p>}
          </>
        )}
        {tab === "notas" && (
          <>
            <Box title="Nova nota fiscal">
              <Op {...props} operation="invoice">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    Pedido *
                    <select className="field" name="orderId" required>
                      <option value="">Selecione o Pedido</option>
                      {c.orders
                        .filter((o) => !o.cancelled)
                        .map((o) => (
                          <option value={o.id} key={o.id}>
                            {o.reference ?? o.id.slice(-8)} · período{" "}
                            {c.periods.find((p) => p.id === o.periodId)
                              ?.number ?? 1}
                          </option>
                        ))}
                    </select>
                  </label>
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
                  <Field
                    name="amount"
                    label="Valor da nota fiscal (R$)"
                    type="decimal"
                    required
                  />
                  <Field name="accessKey" label="Chave de Acesso (opcional)" />
                </div>
                <Notes />
                <p className="text-xs text-slate-500">
                  Registre somente os dados da nota de cada Pedido, sem
                  cadastrar itens. O valor será conferido com os saldos
                  financeiros do Pedido e de seu período.
                </p>
                <Save />
              </Op>
            </Box>
            {c.invoices.map((n) => {
              const received = n.receipts.reduce(
                (s, r) => s + units(r.amount, 2),
                0n,
              );
              const pending = units(n.amount, 2) - received;
              return (
                <article
                  key={n.id}
                  className="space-y-4 rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h2 className="font-semibold">Nota fiscal {n.reference}</h2>
                    <ContractStatusBadge
                      status={
                        n.cancelled
                          ? "Cancelada"
                          : pending === 0n
                            ? "Recebida"
                            : received > 0n
                              ? "Parcialmente recebida"
                              : "A receber"
                      }
                    />
                  </div>
                  <p className="text-sm text-slate-500">
                    Emissão: {date(n.issueDate)} · Pedido:{" "}
                    {c.orders.find((o) => o.id === n.orderId)?.reference ??
                      (n.orderId
                        ? n.orderId.slice(-8)
                        : "Legado sem Pedido")}{" "}
                    · período{" "}
                    {c.periods.find((p) => p.id === n.periodId)?.number ?? 1}
                  </p>
                  {n.accessKey && (
                    <p className="break-all text-sm">
                      Chave de Acesso: {n.accessKey}
                    </p>
                  )}
                  {n.documentUrl && (
                    <a
                      className="text-brand-700 underline"
                      href={n.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir diretório ou documento
                    </a>
                  )}
                  {n.notes && (
                    <p className="whitespace-pre-wrap text-sm">{n.notes}</p>
                  )}
                  <p className="font-semibold">
                    Valor: {money(n.amount.toFixed(2))} · Recebido:{" "}
                    {money(fixed(received, 2))} · Saldo:{" "}
                    {money(fixed(pending, 2))}
                  </p>
                  {n.receipts.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {n.receipts.map((r) => (
                        <li key={r.id}>
                          Recebimento em {date(r.date)}:{" "}
                          {money(r.amount.toFixed(2))}
                          {r.notes ? ` · ${r.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!n.cancelled && pending > 0n && (
                    <Box title={`Registrar recebimento da NF ${n.reference}`}>
                      <Op {...props} operation="receipt">
                        <input type="hidden" name="invoiceId" value={n.id} />
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
                  <div className="flex flex-wrap gap-3">
                    {!n.cancelled && !n.receipts.length && (
                      <Op
                        {...props}
                        operation="cancelInvoice"
                        recordId={n.id}
                        confirmation="Cancelar esta nota fiscal? O histórico será preservado."
                      >
                        <button className="btn-secondary">
                          <Ban size={17} />
                          Cancelar nota fiscal
                        </button>
                      </Op>
                    )}
                    <Op
                      {...props}
                      operation="deleteInvoice"
                      recordId={n.id}
                      confirmation={`Excluir definitivamente a nota fiscal e ${n.receipts.length} recebimentos? A perda de dados é irreversível no sistema.`}
                    >
                      <button className="btn-secondary text-red-700">
                        <Trash2 size={17} />
                        Excluir nota fiscal
                      </button>
                    </Op>
                  </div>
                </article>
              );
            })}
            {!c.invoices.length && <p>Nenhuma nota fiscal registrada.</p>}
          </>
        )}
        {tab === "garantias" && (
          <>
            <p className="text-sm text-slate-500">Garantias são opcionais.</p>
            {[
              undefined,
              ...c.guarantees.filter((g) => g.instrumentId === id),
            ].map((g) => (
              <Box
                key={g?.id ?? "new"}
                title={
                  g
                    ? `${g.type} · ${money(g.amount.toFixed(2))} · ${date(g.validUntil)}`
                    : "Nova garantia"
                }
              >
                <Op {...props} operation="guarantee" recordId={g?.id}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      Tipo de garantia *
                      <select
                        className="field"
                        name="type"
                        defaultValue={
                          g &&
                          guaranteeTypes.includes(
                            g.type as (typeof guaranteeTypes)[number],
                          )
                            ? g.type
                            : ""
                        }
                        required
                      >
                        <option value="">
                          {g
                            ? `Selecione a opção legal (anterior: ${g.type})`
                            : "Selecione"}
                        </option>
                        {guaranteeTypes.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <Field
                      name="amount"
                      label="Valor (R$)"
                      type="decimal"
                      value={g?.amount.toFixed(2)}
                      required
                    />
                    <Field
                      name="validUntil"
                      label="Validade"
                      type="date"
                      value={g ? iso(g.validUntil) : ""}
                      required
                    />
                    <label>
                      Situação
                      <select
                        className="field"
                        name="status"
                        defaultValue={g?.status ?? "ACTIVE"}
                      >
                        <option value="ACTIVE">Ativa</option>
                        <option value="RELEASED">Liberada</option>
                        <option value="CANCELLED">Cancelada</option>
                      </select>
                    </label>
                    <Field
                      name="documentUrl"
                      label="Link do diretório ou documento"
                      type="url"
                      value={g?.documentUrl ?? ""}
                    />
                    <label>
                      Observações
                      <textarea
                        className="field"
                        name="notes"
                        rows={2}
                        defaultValue={g?.notes ?? ""}
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
              Acréscimo e Supressão alteram itens; Prorrogação altera vigência;
              Renovação reinicia o saldo do novo período em contratos
              continuados. Alterações anteriores permanecem no histórico.
            </p>
            <Box title="Novo aditivo">
              <ContractAmendmentForm
                id={id}
                version={version}
                continuous={contract.continuous}
                items={b.items.map((i) => ({
                  id: i.id,
                  number: i.number,
                  description: i.description,
                  quantity: i.effectiveQuantity,
                  price: i.effectivePrice,
                }))}
              />
            </Box>
            {c.amendments
              .filter((a) => a.instrumentId === id)
              .map((a) => (
                <article
                  key={a.id}
                  className="space-y-3 rounded-lg border border-slate-200 p-4"
                >
                  <h2 className="font-semibold">
                    Aditivo {a.reference}
                    {a.cancelled ? " · Cancelado" : ""}
                  </h2>
                  <p>
                    {date(a.date)} · {a.kind ? amendmentKinds[a.kind] : a.type}
                    {a.newEndDate
                      ? ` · Nova vigência até ${date(a.newEndDate)}`
                      : ""}
                  </p>
                  {a.updatedAmount !== null && (
                    <p className="text-sm">
                      Valor Atualizado do Contrato:{" "}
                      {money(a.updatedAmount.toFixed(2))}
                    </p>
                  )}
                  {a.kind === "RENEWAL" && (
                    <p className="text-sm">
                      Novo período de execução com o quantitativo atualizado
                      completo; saldo não pedido anterior expirado.
                    </p>
                  )}
                  {a.items.map((row) => (
                    <p key={row.id} className="text-sm">
                      Item{" "}
                      {c.items.find((i) => i.id === row.contractItemId)?.number}
                      : variação da quantidade {quantityText(row.quantityDelta)}{" "}
                      ·{" "}
                      {row.unitPrice !== null
                        ? `novo preço unitário ${row.unitPrice.toFixed(4).replace(".", ",")}`
                        : `variação legada de preço ${row.unitPriceDelta.toFixed(4).replace(".", ",")}`}
                    </p>
                  ))}
                  {a.documentUrl && (
                    <a
                      className="text-brand-700 underline"
                      href={a.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir diretório ou documento
                    </a>
                  )}
                  {a.notes && (
                    <p className="whitespace-pre-wrap text-sm">{a.notes}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {!a.cancelled && (
                      <Op
                        {...props}
                        operation="cancelAmendment"
                        recordId={a.id}
                        confirmation="Cancelar este aditivo? Alterações posteriores ou saldos já utilizados podem impedir a operação."
                      >
                        <button className="btn-secondary">
                          <Ban size={17} />
                          Cancelar aditivo
                        </button>
                      </Op>
                    )}
                    <Op
                      {...props}
                      operation="deleteAmendment"
                      recordId={a.id}
                      confirmation="Excluir definitivamente este aditivo? Seus efeitos serão recalculados e a perda do registro é irreversível no sistema. Alterações posteriores ou saldos utilizados podem impedir a exclusão."
                    >
                      <button className="btn-secondary text-red-700">
                        <Trash2 size={17} />
                        Excluir aditivo
                      </button>
                    </Op>
                  </div>
                </article>
              ))}
          </>
        )}
        {tab === "apostilamento" && (
          <>
            <p className="text-sm text-slate-500">
              Reajuste ou repactuação dos preços atualizados dos itens. Pedidos
              e notas anteriores mantêm seus valores.
            </p>
            <Box title="Novo apostilamento">
              <ContractEndorsementForm
                id={id}
                version={version}
                items={b.items.map((i) => ({
                  id: i.id,
                  number: i.number,
                  description: i.description,
                  price: i.effectivePrice,
                }))}
              />
            </Box>
            {c.endorsements
              .filter((e) => e.instrumentId === id)
              .map((e) => (
                <article
                  key={e.id}
                  className="space-y-3 rounded-lg border border-slate-200 p-4"
                >
                  <h2 className="font-semibold">Apostilamento {e.reference}</h2>
                  <p>
                    {date(e.signatureDate)} · {endorsementKinds[e.type]}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="contract-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Novo valor unitário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.items.map((row) => (
                          <tr key={row.id}>
                            <td>
                              {
                                c.items.find((i) => i.id === row.contractItemId)
                                  ?.number
                              }
                            </td>
                            <td>
                              {row.unitPrice.toFixed(4).replace(".", ",")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {e.documentUrl && (
                    <a
                      className="text-brand-700 underline"
                      href={e.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir diretório ou documento
                    </a>
                  )}
                  {e.notes && (
                    <p className="whitespace-pre-wrap text-sm">{e.notes}</p>
                  )}
                  <Op
                    {...props}
                    operation="deleteEndorsement"
                    recordId={e.id}
                    confirmation="Excluir definitivamente este apostilamento? Seus efeitos serão recalculados e a perda do registro é irreversível no sistema. Alterações posteriores ou saldos utilizados podem impedir a exclusão."
                  >
                    <button className="btn-secondary text-red-700">
                      <Trash2 size={17} />
                      Excluir apostilamento
                    </button>
                  </Op>
                </article>
              ))}
          </>
        )}
      </section>
    </>
  );
}
