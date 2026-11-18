export const money = (value: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value),
  );
export const date = (value: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    new Date(value),
  );
export const formatCnpj = (value: string | null) =>
  value
    ? value.replace(/^(..)(...)(...)(....)(..)$/, "$1.$2.$3/$4-$5")
    : "Não informado";
