"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  UserRound,
  KeyRound,
  Bell,
  CalendarDays,
  Users,
  ListTodo,
  LayoutDashboard,
  Landmark,
  Truck,
  Settings,
  FileText,
  ArrowUpRight,
  PanelLeftClose,
} from "lucide-react";
import { Brand } from "./brand";
const links = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/catalogo", label: "Catálogo de itens", icon: FileText },
  { href: "/contratacoes", label: "Contratações", icon: FileText },
  { href: "/contratos", label: "Contratos", icon: FileText },
  { href: "/orgaos", label: "Órgãos públicos", icon: Landmark },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/contatos", label: "Contatos", icon: Users },
];
const groups = [
  {
    label: "Agenda operacional",
    icon: CalendarDays,
    items: [
      { href: "/calendario", label: "Calendário", icon: CalendarDays },
      { href: "/tarefas", label: "Tarefas", icon: ListTodo },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    label: "Administração",
    icon: Users,
    items: [
      { href: "/usuarios", label: "Usuários", icon: Users },
      { href: "/meu-perfil", label: "Meu perfil", icon: UserRound },
      { href: "/trocar-senha", label: "Trocar senha", icon: KeyRound },
    ],
  },
];
export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname();
  const item = (link: (typeof links)[number], nested = false) => {
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={(e) => {
          if (mobile)
            e.currentTarget
              .closest("[data-mobile-navigation]")
              ?.removeAttribute("open");
        }}
        aria-current={path.startsWith(link.href) ? "page" : undefined}
        className={`flex items-center gap-3 rounded-lg ${nested ? "py-2.5 pr-3 pl-6" : "px-3.5 py-3"} text-sm transition-colors ${path.startsWith(link.href) ? "bg-[#245050] font-semibold text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
      >
        <Icon size={nested ? 17 : 19} strokeWidth={1.7} />
        {link.label}
      </Link>
    );
  };
  return (
    <nav
      aria-label={mobile ? "Navegação móvel" : "Navegação principal"}
      className="space-y-1.5"
    >
      {links.map((link) => item(link))}
      {groups.map((group) => {
        const active = group.items.some((i) => path.startsWith(i.href));
        const Icon = group.icon;
        return (
          <details
            key={`${group.label}-${path}`}
            open={active}
            className="group rounded-lg"
          >
            <summary
              aria-label={group.label}
              className={`flex cursor-pointer list-none items-center gap-3 rounded-lg px-3.5 py-3 text-sm hover:bg-white/5 ${active ? "font-semibold text-white" : "text-slate-300"}`}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span className="flex-1">{group.label}</span>
              <ChevronDown
                size={15}
                className="transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-1 ml-3 space-y-1 border-l border-white/10 pl-2">
              {group.items.map((link) => item(link, true))}
            </div>
          </details>
        );
      })}
      {item({ href: "/configuracoes", label: "Configurações", icon: Settings })}
    </nav>
  );
}
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 overflow-y-auto flex-col bg-[var(--sidebar)] px-5 py-8 lg:flex">
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
