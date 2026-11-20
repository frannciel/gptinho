export function normalizeItemDecimal(
  value: string,
  scale: number,
  integerDigits: number,
  positive = false,
): string | null {
  let clean = value
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (!clean) return null;
  if (clean.includes(",")) {
    if (
      !new RegExp(`^(?:\\d+|\\d{1,3}(?:\\.\\d{3})+),\\d{1,${scale}}$`).test(
        clean,
      )
    )
      throw new Error(`Informe até ${scale} casas decimais.`);
    clean = clean.replaceAll(".", "").replace(",", ".");
  }
  // Without a comma, '.' is the canonical decimal separator for items.
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(clean))
    throw new Error(
      `Informe um número não negativo com até ${scale} casas decimais.`,
    );
  const [whole, fraction = ""] = clean.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  if (integer.length > integerDigits)
    throw new Error(`Use no máximo ${integerDigits} dígitos inteiros.`);
  const result = `${integer}.${fraction.padEnd(scale, "0")}`;
  if (positive && BigInt(integer + fraction.padEnd(scale, "0")) === 0n)
    throw new Error("A quantidade deve ser maior que zero.");
  return result;
}
const MAX_CENTS = 999999999999999999n;
const centsText = (value: bigint) =>
  `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
export function itemTotal(
  quantity: string,
  unitPrice: string | null,
): string | null {
  if (unitPrice === null) return null;
  const q = BigInt(quantity.replace(".", ""));
  const price = BigInt(unitPrice.replace(".", ""));
  const cents = (q * price + 50000n) / 100000n;
  if (cents > MAX_CENTS)
    throw new Error("O total do item excede o limite monetário.");
  return centsText(cents);
}
export function itemsTotal(
  items: { quantity: string; unitPrice: string | null }[],
): { total: string | null; lines: (string | null)[] } {
  const lines = items.map((item) => itemTotal(item.quantity, item.unitPrice));
  if (!lines.length || lines.some((value) => value === null))
    return { total: null, lines };
  const cents = lines.reduce<bigint>(
    (sum, value) => sum + BigInt(value!.replace(".", "")),
    0n,
  );
  if (cents > MAX_CENTS)
    throw new Error("O total da contratação excede o limite monetário.");
  return { total: centsText(cents), lines };
}
