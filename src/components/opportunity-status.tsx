import {
  OPPORTUNITY_STATUSES,
  type OPPORTUNITY_STATUS_VALUES,
} from "@/lib/opportunity-values";
export function OpportunityStatusBadge({
  status,
  archived = false,
}: {
  status: (typeof OPPORTUNITY_STATUS_VALUES)[number];
  archived?: boolean;
}) {
  const color = archived
    ? "bg-slate-100 text-slate-500"
    : status === "CANCELLED"
      ? "bg-red-50 text-red-700"
      : status === "CLOSED" || status === "DRAFT"
        ? "bg-slate-100 text-slate-600"
        : "bg-brand-50 text-brand-700";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      {archived ? "Arquivada · " : ""}
      {OPPORTUNITY_STATUSES[status]}
    </span>
  );
}
