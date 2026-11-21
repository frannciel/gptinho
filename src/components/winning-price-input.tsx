"use client";
import { useState } from "react";
import { maskMoney4, unitMoney } from "@/lib/pricing";
import { normalizeItemDecimal } from "@/lib/contracting-items";
import { itemProfitRate, type FinancialItem } from "@/lib/financial-summary";
export function WinningPriceInput({
  formId,
  value,
  number,
  disabled,
  item,
}: {
  formId: string;
  value: string | null;
  number: number;
  disabled: boolean;
  item: FinancialItem;
}) {
  const [text, setText] = useState(
    value === null ? "" : unitMoney(value).replace("R$ ", ""),
  );
  let rate: string | null = null;
  try {
    rate = itemProfitRate(item, normalizeItemDecimal(text, 4, 14));
  } catch {}
  return (
    <div>
      <div className="flex min-w-64">
        <input
          className="field min-w-32 rounded-r-none"
          form={formId}
          name="winningUnitPrice"
          aria-label={`Proposta Vencedora do item ${number}`}
          inputMode="decimal"
          required
          maxLength={30}
          disabled={disabled}
          value={text}
          onChange={(e) => setText(maskMoney4(e.target.value))}
          onBlur={() => {
            if (text) {
              const [whole, fraction = ""] = text.split(",");
              setText(`${whole},${fraction.padEnd(4, "0")}`);
            }
          }}
        />
        <output
          className={`flex shrink-0 items-center justify-center rounded-r-lg border border-l-0 px-3 text-sm font-semibold ${rate?.startsWith("-") ? "border-red-200 bg-red-50 text-red-800" : "border-slate-300 bg-slate-50 text-slate-800"}`}
          aria-label={`Lucro líquido do item ${number}`}
          aria-live="polite"
          title="Percentual de lucro líquido sobre a receita."
        >
          {rate === null ? "—" : `${rate.replace(".", ",")}%`}
        </output>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Lucro líquido / receita · simulação
      </p>
    </div>
  );
}
