"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { contractAction } from "@/app/(admin)/contratos/actions";
import {
  amendmentKinds,
  decimal,
  priceFromPercent,
  quantityText,
} from "@/lib/contracts";
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
  const router = useRouter();
  const [kind, setKind] = useState("ADDITION");
  const [rows, setRows] = useState(
    items.map((i) => ({ ...i, newPrice: i.price, quantityDelta: "0" })),
  );
  const [all, setAll] = useState("");
  const [error, setError] = useState("");
  const periodOnly = kind === "EXTENSION" || kind === "RENEWAL";
  function applyAll() {
    try {
      const next = rows.map((i) => ({
        ...i,
        newPrice: priceFromPercent(i.price, all),
      }));
      decimal(4, false, true).parse(all);
      setRows(next);
      setError("");
    } catch {
      setError(
        "Informe uma variação percentual válida, sem produzir preço negativo ou fora do limite.",
      );
    }
  }
  return (
    <ActionForm
      className="space-y-4"
      action={async (form) => {
        const result = await contractAction(
          "amendment",
          {
            ...Object.fromEntries(form),
            kind,
            updatedAmount: periodOnly
              ? "0"
              : String(form.get("updatedAmount") ?? "0"),
            items: periodOnly
              ? []
              : rows.map((i) => ({
                  contractItemId: i.id,
                  quantityDelta: i.quantityDelta,
                  unitPrice: i.newPrice,
                })),
          },
          id,
          version,
        );
        if (result.ok) {
          router.push(`/contratos/${id}?tab=aditivos&saved=1`);
          router.refresh();
        }
        return result;
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Número do aditivo *
          <input className="field" name="reference" required />
        </label>
        <label>
          Data de Assinatura *
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
            Valor Atualizado do Contrato (R$, opcional)
            <input
              className="field"
              name="updatedAmount"
              inputMode="decimal"
              defaultValue="0,00"
            />
            <span className="text-xs text-slate-500">
              Com zero, será calculado o somatório dos totais dos itens após o
              aditivo. Um valor informado representa o total atualizado, não uma
              variação.
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
          cada item, mantendo o preço atualizado. O saldo não pedido anterior
          não será transferido.
        </p>
      )}
      {!continuous && (
        <p className="text-xs text-slate-500">
          Renovação fica disponível em contratos marcados como Continuado.
        </p>
      )}
      {!periodOnly && (
        <>
          <div>
            <label htmlFor="amendment-all">Variação para todos (%)</label>
            <div className="mt-1 flex gap-2">
              <input
                id="amendment-all"
                className="field"
                inputMode="decimal"
                value={all}
                onChange={(e) => setAll(e.target.value)}
                placeholder="Opcional"
              />
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={applyAll}
              >
                <RefreshCw size={17} />
                Aplicar a todos
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Aplica o percentual sobre o preço atualizado de cada item. Os
              novos valores podem ser ajustados individualmente. O percentual
              não será gravado.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="contract-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantidade atualizada</th>
                  <th>Variação da quantidade</th>
                  <th>Preço atualizado</th>
                  <th>Novo valor unitário (R$)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td title={i.description}>
                      {i.number} · {i.description.slice(0, 65)}
                    </td>
                    <td>{quantityText(i.quantity)}</td>
                    <td>
                      <input
                        className="field w-36"
                        type="number"
                        step="1"
                        inputMode="numeric"
                        aria-label={`Variação de quantidade item ${i.number}`}
                        value={i.quantityDelta}
                        onChange={(e) =>
                          setRows((old) =>
                            old.map((r) =>
                              r.id === i.id
                                ? { ...r, quantityDelta: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>{i.price.replace(".", ",")}</td>
                    <td>
                      <input
                        className="field w-40"
                        aria-label={`Novo valor item ${i.number}`}
                        inputMode="decimal"
                        value={i.newPrice}
                        onChange={(e) =>
                          setRows((old) =>
                            old.map((r) =>
                              r.id === i.id
                                ? { ...r, newPrice: e.target.value }
                                : r,
                            ),
                          )
                        }
                        required
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
    </ActionForm>
  );
}
