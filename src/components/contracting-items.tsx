"use client";
import { Plus, Trash2 } from "lucide-react";
import type { OpportunityInput } from "@/lib/opportunity-validation";
import { normalizeItemDecimal, itemsTotal } from "@/lib/contracting-items";
import { money } from "@/lib/format";
import { Field } from "./form-fields";
export type ItemRow = OpportunityInput["items"][number] & { clientKey: string };
export function ContractingItems({
  rows,
  onChange,
  errors,
}: {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  errors?: Record<string, string[]>;
}) {
  const change = (
    index: number,
    key: keyof OpportunityInput["items"][number],
    value: string,
  ) =>
    onChange(
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  let preview: { total: string | null; lines: (string | null)[] } | null = null;
  try {
    preview = itemsTotal(
      rows.map((row) => {
        const quantity = normalizeItemDecimal(row.quantity, 3, 15, true);
        if (!quantity) throw new Error();
        return {
          quantity,
          unitPrice: normalizeItemDecimal(row.unitPrice, 4, 14),
        };
      }),
    );
  } catch {}
  const error = (index: number, key: string) =>
    errors?.[`items.${index}.${key}`];
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Itens da contratação</h2>
          <p className="mt-1 text-xs text-slate-500">
            O valor estimado é calculado exclusivamente pelos itens.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={rows.length >= 100}
          onClick={() =>
            onChange([
              ...rows,
              {
                clientKey: crypto.randomUUID(),
                number: String(
                  Math.max(0, ...rows.map((row) => Number(row.number) || 0)) +
                    1,
                ),
                description: "",
                unit: "UN",
                quantity: "1",
                unitPrice: "",
              },
            ])
          }
        >
          <Plus size={16} />
          Adicionar item
        </button>
      </div>
      {!rows.length && (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Nenhum item cadastrado. Adicione os itens para compor o valor
          estimado.
        </p>
      )}
      <div className="space-y-5">
        {rows.map((row, index) => (
          <div
            key={row.clientKey}
            className="rounded-lg border border-slate-200 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Item {row.number || index + 1}
              </h3>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-red-700"
                aria-label={`Remover item ${index + 1}`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                <Trash2 size={15} />
                Remover
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["number", "Número do item", true],
                  ["unit", "Unidade", true],
                  ["quantity", "Quantidade", true],
                  ["unitPrice", "Valor unitário estimado (R$)", false],
                ] as const
              ).map(([key, label, required]) => (
                <Field
                  key={key}
                  name={`item-${index}-${key}`}
                  label={label}
                  required={required}
                  error={error(index, key)}
                >
                  <input
                    id={`item-${index}-${key}`}
                    className="field"
                    value={row[key]}
                    required={required}
                    type={key === "number" ? "number" : "text"}
                    min={key === "number" ? 1 : undefined}
                    max={key === "number" ? 999999 : undefined}
                    inputMode={
                      key === "quantity" || key === "unitPrice"
                        ? "decimal"
                        : key === "number"
                          ? "numeric"
                          : "text"
                    }
                    maxLength={key === "unit" ? 20 : 60}
                    aria-invalid={!!error(index, key)}
                    aria-describedby={
                      error(index, key)
                        ? `item-${index}-${key}-error`
                        : undefined
                    }
                    onChange={(event) => change(index, key, event.target.value)}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-4">
              <Field
                name={`item-${index}-description`}
                label="Descrição do item"
                required
                error={error(index, "description")}
              >
                <textarea
                  id={`item-${index}-description`}
                  className="field min-h-24"
                  required
                  minLength={3}
                  maxLength={5000}
                  value={row.description}
                  aria-invalid={!!error(index, "description")}
                  aria-describedby={
                    error(index, "description")
                      ? `item-${index}-description-error`
                      : undefined
                  }
                  onChange={(event) =>
                    change(index, "description", event.target.value)
                  }
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs">
              <p className="text-slate-500">
                Quantidade: até 3 casas decimais. Valor unitário: até 4. Use
                vírgula para decimais e não use separador de milhar.
              </p>
              <p className="font-semibold" data-testid={`item-total-${index}`}>
                Total do item:{" "}
                {preview?.lines[index] != null
                  ? money(preview.lines[index]!)
                  : "Não informado"}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Field name="estimatedValue" label="Valor estimado (R$)">
          <input
            id="estimatedValue"
            className="field bg-slate-50 font-semibold"
            readOnly
            value={
              !rows.length
                ? "Sem itens cadastrados"
                : preview?.total != null
                  ? money(preview.total)
                  : preview
                    ? "Estimativa incompleta"
                    : "Revise os itens"
            }
          />
        </Field>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Soma dos totais dos itens, arredondados para centavos. Sem preço em
          algum item, o total fica não informado. Este campo não pode ser
          alterado manualmente.
        </p>
      </div>
    </>
  );
}
