"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { contractAction } from "@/app/(admin)/contratos/actions";
import {
  decimal,
  priceFromPercent,
  percentFromPrice,
  endorsementKinds,
} from "@/lib/contracts";
export function ContractEndorsementForm({
  id,
  version,
  items,
}: {
  id: string;
  version: number;
  items: { id: string; number: number; description: string; price: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(
    items.map((i) => ({ ...i, newPrice: i.price, percent: "0.0000" })),
  );
  const [all, setAll] = useState("");
  const [error, setError] = useState("");
  function changePrice(itemId: string, raw: string) {
    setRows((old) =>
      old.map((i) => {
        if (i.id !== itemId) return i;
        const parsed = decimal(4).safeParse(raw);
        return {
          ...i,
          newPrice: raw,
          percent: parsed.success
            ? (percentFromPrice(i.price, parsed.data) ?? "")
            : "",
        };
      }),
    );
  }
  function changePercent(itemId: string, raw: string) {
    setRows((old) =>
      old.map((i) => {
        if (i.id !== itemId) return i;
        try {
          return {
            ...i,
            percent: raw,
            newPrice: priceFromPercent(i.price, raw),
          };
        } catch {
          return { ...i, percent: raw, newPrice: "" };
        }
      }),
    );
  }
  function applyAll() {
    try {
      const next = rows.map((i) => ({
        ...i,
        percent: decimal(4, false, true).parse(all),
        newPrice: priceFromPercent(i.price, all),
      }));
      setRows(next);
      setError("");
    } catch {
      setError(
        "Informe uma variação válida que não produza preço negativo ou fora do limite.",
      );
    }
  }
  return (
    <ActionForm
      className="space-y-4"
      action={async (data) => {
        const result = await contractAction(
          "endorsement",
          {
            ...Object.fromEntries(data),
            items: rows.map((i) => ({
              contractItemId: i.id,
              unitPrice: i.newPrice,
            })),
          },
          id,
          version,
        );
        if (result.ok) {
          router.push(`/contratos/${id}?tab=apostilamento&saved=1`);
          router.refresh();
        }
        return result;
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Número *<input className="field" name="reference" required />
        </label>
        <label>
          Data de Assinatura *
          <input className="field" type="date" name="signatureDate" required />
        </label>
        <label>
          Tipo *
          <select className="field" name="type">
            {Object.entries(endorsementKinds).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div>
          <label htmlFor="endorsement-all">Variação para todos (%)</label>
          <div className="mt-1 flex gap-2">
            <input
              id="endorsement-all"
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
        </div>
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
              <th>Descrição</th>
              <th>Valor atualizado</th>
              <th>Variação (%)</th>
              <th>Novo valor unitário (R$)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>{i.number}</td>
                <td className="max-w-72 truncate" title={i.description}>
                  {i.description}
                </td>
                <td>{i.price.replace(".", ",")}</td>
                <td>
                  <input
                    className="field w-36"
                    aria-label={`Variação percentual item ${i.number}`}
                    inputMode="decimal"
                    value={i.percent}
                    onChange={(e) => changePercent(i.id, e.target.value)}
                    placeholder={
                      i.price === "0.0000" ? "Sem base percentual" : "0,0000"
                    }
                  />
                </td>
                <td>
                  <input
                    className="field w-40"
                    aria-label={`Novo valor item ${i.number}`}
                    inputMode="decimal"
                    value={i.newPrice}
                    onChange={(e) => changePrice(i.id, e.target.value)}
                    required
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Informe o novo valor ou o percentual para calcular o outro campo.
        Somente o novo valor será gravado. Se o preço anterior for zero, informe
        diretamente o novo valor.
      </p>
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
