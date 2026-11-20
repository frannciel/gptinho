export const OPPORTUNITY_STATUS_VALUES = [
  "CANCELLED",
  "SUSPENDED",
  "HOMOLOGATED",
  "PROPOSAL_REGISTERED",
  "CLOSED",
] as const;
export const OPPORTUNITY_STATUSES: Record<
  (typeof OPPORTUNITY_STATUS_VALUES)[number],
  string
> = {
  CANCELLED: "Cancelada",
  SUSPENDED: "Suspensa",
  HOMOLOGATED: "Homologada",
  PROPOSAL_REGISTERED: "Proposta Cadastrada",
  CLOSED: "Encerrada",
};
export const OPEN_OPPORTUNITY_STATUSES = [
  "PROPOSAL_REGISTERED",
  "SUSPENDED",
  "HOMOLOGATED",
] as const;
export const DEADLINE_OPPORTUNITY_STATUSES = ["PROPOSAL_REGISTERED"] as const;
export const PROCUREMENT_METHOD_VALUES = [
  "UNDEFINED",
  "ELECTRONIC_AUCTION",
  "IN_PERSON_AUCTION",
  "ELECTRONIC_WAIVER",
  "WAIVER",
  "INEXIGIBILITY",
  "COMPETITION",
  "OTHER",
] as const;
export const PROCUREMENT_METHODS: Record<
  (typeof PROCUREMENT_METHOD_VALUES)[number],
  string
> = {
  UNDEFINED: "A definir",
  ELECTRONIC_AUCTION: "Pregão eletrônico",
  IN_PERSON_AUCTION: "Pregão presencial",
  ELECTRONIC_WAIVER: "Dispensa eletrônica",
  WAIVER: "Dispensa de licitação",
  INEXIGIBILITY: "Inexigibilidade",
  COMPETITION: "Concorrência",
  OTHER: "Outra modalidade",
};
export function normalizeEstimatedValue(value: string): string | null {
  let clean = value
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (!clean) return null;
  if (clean.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(clean))
      throw new Error("Informe um valor em reais com até duas casas decimais.");
    clean = clean.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(clean))
    clean = clean.replaceAll(".", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean))
    throw new Error(
      "Informe um valor não negativo com até duas casas decimais.",
    );
  const [whole, fraction = ""] = clean.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  if (integer.length > 16)
    throw new Error("O valor excede o limite de 16 dígitos inteiros.");
  return `${integer}.${fraction.padEnd(2, "0")}`;
}
export function parseBrasiliaDeadline(value: string): Date | null {
  if (!value) return null;
  if (!/^(?:20|21)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Informe uma data e hora válidas entre 2000 e 2199.");
  const date = new Date(`${value}:00-03:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16) !==
      value
  )
    throw new Error("Informe uma data e hora válidas.");
  return date;
}
export function deadlineInput(value: Date | string | null): string {
  if (!value) return "";
  // Business input uses Brasília (UTC-3), independent of the browser/server locale.
  return new Date(new Date(value).getTime() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}
export const dateTime = (value: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "Etc/GMT+3",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export function isOpenOpportunity(status: string) {
  return OPEN_OPPORTUNITY_STATUSES.some((value) => value === status);
}

export function hasActiveDeadline(status: string) {
  return DEADLINE_OPPORTUNITY_STATUSES.some((value) => value === status);
}
