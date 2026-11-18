import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
export const metadata = { title: "Acesso" };
export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#102c30] p-14 lg:flex">
        <Brand light />
        <div className="relative z-10 max-w-lg">
          <p className="mb-5 text-xs font-semibold tracking-[.25em] text-teal-300 uppercase">
            Govnex Soluções Digitais
          </p>
          <h1 className="text-5xl leading-[1.15] font-semibold tracking-tight text-white">
            Conecte oportunidades.
            <br />
            <span className="text-teal-300">Construa resultados.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
            Uma base integrada para a gestão comercial e administrativa da
            Govnex.
          </p>
          <div className="mt-10 space-y-4 text-sm text-teal-50">
            {[
              "Relacionamentos organizados",
              "Informações centralizadas",
              "Mais clareza para cada decisão",
            ].map((t) => (
              <p key={t} className="flex items-center gap-3">
                <Check size={17} className="text-teal-300" />
                {t}
              </p>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <span>Tecnologia a serviço da gestão.</span>
          <ArrowUpRight size={18} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 -bottom-40 h-[650px] w-[650px] rounded-full border-[100px] border-white/[.025]"
        />
      </section>
      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-12 lg:hidden">
          <Brand />
        </div>
        <div className="w-full max-w-[380px]">
          <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
            <ShieldCheck size={25} />
          </span>
          <p className="eyebrow">Área administrativa</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Bem-vindo à Govnex
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Entre com sua conta para acessar o ambiente de gestão.
          </p>
          <LoginForm />
        </div>
        <p className="mt-14 text-xs text-slate-400">
          Govnex ERP · Ambiente de acesso restrito
        </p>
      </section>
    </main>
  );
}
