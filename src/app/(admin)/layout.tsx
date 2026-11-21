import { requireAdminPage } from "@/lib/authorization";
import { SidebarFrame, SidebarToggle } from "@/components/sidebar-frame";
import { Navigation } from "@/components/navigation";
import { Logout } from "@/components/logout";
import { Menu, ShieldCheck } from "lucide-react";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminPage();
  return (
    <div className="min-h-screen">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-white focus:p-3"
      >
        Pular para o conteúdo
      </a>
      <SidebarFrame>
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 md:px-9">
          <div className="flex items-center gap-3">
            <SidebarToggle />
            <details className="relative lg:hidden">
              <summary
                className="list-none rounded-lg p-2"
                aria-label="Abrir menu"
              >
                <Menu size={22} />
              </summary>
              <div className="absolute top-12 left-0 z-30 w-64 rounded-xl bg-[var(--sidebar)] p-4 shadow-xl">
                <Navigation mobile />
              </div>
            </details>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Ambiente de gestão
              </p>
              <p className="mt-1 hidden text-xs text-slate-400 sm:block">
                Govnex Soluções Digitais
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700 md:flex">
              <ShieldCheck size={13} />
              Acesso protegido
            </span>
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf0f1] text-xs font-bold text-slate-700">
                {user.name
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="hidden sm:block">
                <p className="max-w-40 truncate text-sm font-semibold">
                  {user.name}
                </p>
                <p className="text-[11px] text-slate-500">Administrador</p>
              </div>
            </div>
            <Logout />
          </div>
        </header>
        <main id="conteudo" className="mx-auto max-w-[1500px] p-5 md:p-9">
          {children}
        </main>
        <footer className="px-5 py-6 text-xs text-slate-400 md:px-9">
          Govnex ERP · Gestão comercial e administrativa
        </footer>
      </SidebarFrame>
    </div>
  );
}
