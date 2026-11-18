"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  Truck,
  Settings,
  ArrowUpRight,
  PanelLeftClose,
} from "lucide-react";
import { Brand } from "./brand";
const links = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/orgaos", label: "Órgãos públicos", icon: Landmark },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname();
  return (
    <nav
      aria-label={mobile ? "Navegação móvel" : "Navegação principal"}
      className="space-y-1.5"
    >
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={(event) => {
            if (mobile)
              event.currentTarget.closest("details")?.removeAttribute("open");
          }}
          aria-current={path.startsWith(href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm transition-colors ${path.startsWith(href) ? "bg-[#245050] font-semibold text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
        >
          <Icon size={19} strokeWidth={1.7} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-[var(--sidebar)] px-5 py-8 lg:flex">
      <div className="px-3">
        <Brand light />
      </div>
      <p className="mt-14 mb-4 px-3 text-[10px] font-bold tracking-[.2em] text-slate-400 uppercase">
        Govnex ERP · Administração
      </p>
      <Navigation />
      <div className="mt-auto rounded-xl border border-white/10 bg-white/[.025] p-4">
        <div className="flex justify-between text-sm font-medium text-white">
          <span>Uma base para crescer</span>
          <ArrowUpRight size={17} className="text-teal-300" />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Organize os relacionamentos que conectam sua operação.
        </p>
      </div>
      <div className="mt-6 flex items-center justify-between px-2 text-[11px] text-slate-400">
        <span>Govnex ERP · v0.1</span>
        <PanelLeftClose size={15} />
      </div>
    </aside>
  );
}
