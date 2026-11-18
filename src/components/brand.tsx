import { Blocks } from "lucide-react";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-3 ${light ? "text-white" : "text-ink"}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
        <Blocks size={24} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-2xl font-bold tracking-tight">
          govnex<span className="text-brand-500">.</span>
        </span>
        <span
          className={`block text-[10px] font-semibold tracking-[.22em] uppercase ${light ? "text-teal-100/60" : "text-slate-500"}`}
        >
          Gestão que conecta
        </span>
      </span>
    </span>
  );
}
