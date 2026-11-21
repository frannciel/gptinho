"use client";
import { useState } from "react";
import { maskMoney4, unitMoney } from "@/lib/pricing";
export function WinningPriceInput({
  formId,
  value,
  number,
  disabled,
}: {
  formId: string;
  value: string | null;
  number: number;
  disabled: boolean;
}) {
  const [text, setText] = useState(
    value === null ? "" : unitMoney(value).replace("R$ ", ""),
  );
  return (
    <input
      className="field min-w-44"
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
  );
}
