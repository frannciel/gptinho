// String amounts are formatted exactly, without converting cents to floating point.
export const money = (value: string | number) => {
  const raw =
    typeof value === "number"
      ? value.toLocaleString("en-US", {
          useGrouping: false,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : value;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return "Valor inválido";
  const fraction = (match[3] ?? "").padEnd(3, "0");
  const cents =
    BigInt(match[2]) * 100n +
    BigInt(fraction.slice(0, 2)) +
    (fraction[2] >= "5" ? 1n : 0n);
  const integer = (cents / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${match[1] && cents ? "-" : ""}R$\u00a0${integer},${(cents % 100n).toString().padStart(2, "0")}`;
};
export const date = (value: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    new Date(value),
  );
export const formatCnpj = (value: string | null) =>
  value
    ? value.replace(/^(..)(...)(...)(....)(..)$/, "$1.$2.$3/$4-$5")
    : "Não informado";
