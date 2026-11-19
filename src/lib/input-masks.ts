function grouped(value: string, breaks: Record<number, string>) {
  return Array.from(
    value,
    (char, index) => `${breaks[index] ?? ""}${char}`,
  ).join("");
}
export function maskCnpj(value: string) {
  const normalized = value
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase()
    .slice(0, 14);
  return grouped(normalized, { 2: ".", 5: ".", 8: "/", 12: "-" });
}
export function maskPostalCode(value: string) {
  return grouped(value.replace(/\D/g, "").slice(0, 8), { 5: "-" });
}
export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.trim().startsWith("+") ? "+" : "";
  const international = value.trim().startsWith("+");
  // Keep international numbers intact; use the Brazilian layout for +55.
  if (international && !digits.startsWith("55"))
    return `+${digits.slice(0, 15)}`;
  const country =
    (international && digits.startsWith("55")) ||
    (digits.startsWith("55") && digits.length > 11);
  if (!country && digits.length > 11) return digits.slice(0, 15);
  const local = (country ? digits.slice(2) : digits).slice(0, 11);
  const prefix = country ? "+55 " : "";
  if (!local) return prefix.trimEnd();
  if (local.length <= 2) return `${prefix}(${local}`;
  const area = local.slice(0, 2);
  const number = local.slice(2);
  const split = number.length > 8 ? 5 : 4;
  return `${prefix}(${area}) ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ""}`;
}
export const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
