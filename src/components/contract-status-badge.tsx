import { Ban, CheckCircle2, Clock3, Truck, Wallet } from "lucide-react";
export function ContractStatusBadge({ status }: { status: string }) {
  const done = status === "Fornecido" || status === "Recebida";
  const partial =
    status === "Parcialmente fornecido" || status === "Parcialmente recebida";
  const cancelled = status === "Cancelado" || status === "Cancelada";
  const Icon = cancelled
    ? Ban
    : done
      ? CheckCircle2
      : partial
        ? status === "Parcialmente fornecido"
          ? Truck
          : Wallet
        : Clock3;
  const color = cancelled
    ? "border-slate-300 bg-slate-100 text-slate-700"
    : done
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : partial
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${color}`}
    >
      <Icon size={15} aria-hidden="true" />
      {status}
    </span>
  );
}
