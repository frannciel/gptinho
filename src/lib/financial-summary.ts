export type FinancialItem = {
  quantity: string;
  unitPrice: string | null;
  winningUnitPrice: string | null;
  winner: boolean;
  acquisitionUnit: string | null;
  freightUnit: string | null;
  taxRate: string | null;
  pricingAdministrativeRate: string | null;
};
const scaled = (value: string) => BigInt(value.replace(".", ""));
const round = (numerator: bigint, denominator: bigint) => {
  const sign = numerator < 0n ? -1n : 1n;
  const n = numerator < 0n ? -numerator : numerator;
  return sign * ((n * 2n + denominator) / (2n * denominator));
};
const text = (value: bigint) =>
  `${value < 0n ? "-" : ""}${(value < 0n ? -value : value) / 100n}.${((value < 0n ? -value : value) % 100n).toString().padStart(2, "0")}`;
export function itemFinancials(
  item: FinancialItem,
  revenueUnit: string | null,
) {
  const q = scaled(item.quantity);
  const total = (unit: string | null) =>
    unit === null ? null : round(scaled(unit) * q, 100000n);
  const acquisition = total(item.acquisitionUnit),
    freight = total(item.freightUnit),
    revenue = total(revenueUnit);
  const taxes =
    revenue === null || item.taxRate === null
      ? null
      : round(revenue * scaled(item.taxRate), 10000n);
  const administrative =
    revenue === null || item.pricingAdministrativeRate === null
      ? null
      : round(revenue * scaled(item.pricingAdministrativeRate), 10000n);
  const profit = [revenue, acquisition, freight, taxes, administrative].some(
    (v) => v === null,
  )
    ? null
    : revenue! - acquisition! - freight! - taxes! - administrative!;
  return { acquisition, freight, revenue, taxes, administrative, profit };
}
export function financialSummary(
  items: FinancialItem[],
  basis: "estimated" | "winning",
) {
  const rows = items.map((item) =>
    itemFinancials(
      item,
      basis === "winning" ? item.winningUnitPrice : item.unitPrice,
    ),
  );
  const sum = (field: keyof ReturnType<typeof itemFinancials>) =>
    rows.some((row) => row[field] === null)
      ? null
      : rows.reduce((sum, row) => sum + row[field]!, 0n);
  const acquisition = sum("acquisition"),
    profit = sum("profit");
  return {
    acquisition: acquisition === null ? null : text(acquisition),
    freight: sum("freight") === null ? null : text(sum("freight")!),
    taxes: sum("taxes") === null ? null : text(sum("taxes")!),
    administrative:
      sum("administrative") === null ? null : text(sum("administrative")!),
    profit: profit === null ? null : text(profit),
    profitRate:
      profit === null || acquisition === null || acquisition === 0n
        ? null
        : text(round(profit * 10000n, acquisition)),
    count: items.length,
  };
}
export function itemProfitRate(
  item: FinancialItem,
  revenueUnit: string | null,
) {
  const { profit, acquisition } = itemFinancials(item, revenueUnit);
  return profit === null || acquisition === null || acquisition === 0n
    ? null
    : text(round(profit * 10000n, acquisition));
}
