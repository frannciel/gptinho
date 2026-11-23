"use client";
import { useState } from "react";
import { ContractOperation } from "./contract-operation";
import { ButtonContent } from "./button-content";
import { amendmentKinds } from "@/lib/contracts";
export function ContractAmendmentForm({
  id,
  version,
  continuous,
  items,
}: {
  id: string;
  version: number;
  continuous: boolean;
  items: {
    id: string;
    number: number;
    description: string;
    quantity: string;
    price: string;
  }[];
}) {
  const [kind, setKind] = useState("ADDITION");
  const periodOnly = kind === "EXTENSION" || kind === "RENEWAL";
  return (
    <ContractOperation operation="amendment" id={id} version={version}>
      <input type="hidden" name="tab" value="aditivos" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Número do aditivo *
          <input className="field" name="reference" required />
        </label>
        <label>
          Data do aditivo *
          <input className="field" name="date" type="date" required />
        </label>
        <label>
          Tipo de alteração *
          <select
            className="field"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {Object.entries(amendmentKinds).map(([code, label]) => (
              <option
                key={code}
                value={code}
                disabled={code === "RENEWAL" && !continuous}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        {!periodOnly && (
          <label>
            Variação do valor atualizado (R$, opcional)
            <input
              className="field"
              name="valueDelta"
              inputMode="decimal"
              defaultValue="0,00"
            />
            <span className="text-xs text-slate-500">
              Com zero, o valor será calculado pelas alterações dos itens.
            </span>
          </label>
        )}
        {(periodOnly || kind === "MIXED") && (
          <label>
            Nova data final da vigência{periodOnly ? " *" : ""}
            <input
              className="field"
              name="newEndDate"
              type="date"
              required={periodOnly}
            />
          </label>
        )}
      </div>
      {kind === "RENEWAL" && (
        <p role="note" className="rounded-lg bg-brand-50 p-4 text-sm">
          O novo período começa no dia seguinte ao término atual. O saldo
          disponível será reiniciado com a quantidade atualizada completa de
          cada item, mantendo o preço atualizado. O saldo não pedido do período
          anterior não será transferido.
        </p>
      )}
      {!continuous && (
        <p className="text-xs text-slate-500">
          Renovação fica disponível em contratos marcados como Continuado.
        </p>
      )}
      {!periodOnly && (
        <div className="overflow-x-auto">
          <table className="contract-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantidade atualizada</th>
                <th>Variação da quantidade</th>
                <th>Preço atualizado</th>
                <th>Variação do preço unitário (R$)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td title={i.description}>
                    {i.number} · {i.description.slice(0, 65)}
                  </td>
                  <td>{i.quantity.replace(".", ",")}</td>
                  <td>
                    <input type="hidden" name="itemId" value={i.id} />
                    <input
                      className="field w-36"
                      name={`quantityDelta-${i.id}`}
                      aria-label={`Variação de quantidade item ${i.number}`}
                      inputMode="decimal"
                      defaultValue="0,000"
                    />
                  </td>
                  <td>{i.price.replace(".", ",")}</td>
                  <td>
                    <input
                      className="field w-36"
                      name={`unitPriceDelta-${i.id}`}
                      aria-label={`Variação de preço item ${i.number}`}
                      inputMode="decimal"
                      defaultValue="0,0000"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <label>
        Link do diretório ou documento
        <input className="field" name="documentUrl" type="url" />
      </label>
      <label>
        Observações
        <textarea className="field" name="notes" rows={2} />
      </label>
      <div className="pt-4">
        <button className="btn">
          <ButtonContent action="save" />
        </button>
      </div>
    </ContractOperation>
  );
}
