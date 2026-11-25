import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { userFilters } from "@/lib/users";
import { listUsers } from "@/server/users";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
import { AgendaPagination } from "@/components/agenda-pagination";
import { UserStatus } from "@/components/user-status";
export const metadata = { title: "Usuários" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const parsed = userFilters.safeParse(params);
  const f = parsed.success ? parsed.data : userFilters.parse({});
  const data = await listUsers(db, f);
  const notices: Record<string, string> = {
    saved: "Usuário salvo com sucesso.",
    disabled: "Usuário desativado. As sessões foram encerradas.",
    activated: "Usuário ativado.",
  };
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description="Gerencie as contas de acesso. Os usuários cadastrados ou atualizados nesta tela possuem acesso de administrador."
        action={
          <Link className="btn" href="/usuarios/novo">
            <Plus size={17} />
            Novo usuário
          </Link>
        }
      />
      {typeof params.notice === "string" &&
        Object.hasOwn(notices, params.notice) &&
        notices[params.notice] && (
          <p
            role="status"
            className="mb-5 rounded bg-green-50 p-4 text-green-800"
          >
            {notices[params.notice]}
          </p>
        )}
      {!parsed.success && (
        <p role="alert" className="mb-4">
          Filtros inválidos. Exibindo a consulta padrão.
        </p>
      )}
      <form
        key={JSON.stringify(f)}
        className="panel mb-6 grid items-end gap-4 p-5 md:grid-cols-3"
      >
        <label>
          Buscar usuário
          <input
            className="field"
            name="q"
            maxLength={120}
            defaultValue={f.q}
            placeholder="Nome ou e-mail…"
          />
        </label>
        <label>
          Situação
          <select
            className="field"
            aria-label="Situação"
            name="status"
            defaultValue={f.status}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button className="btn">
            <ButtonContent action="filter" />
          </button>
          <Link className="btn-secondary" href="/usuarios">
            <ButtonContent action="clear" />
          </Link>
        </div>
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Nome", "E-mail", "Situação", "Cadastro", "Ações"].map((l) => (
                <th className="p-4" key={l}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="p-4 font-medium">{u.name}</td>
                <td className="p-4">{u.email}</td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${u.active ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {u.role !== "ADMIN"
                      ? "Atualização pendente"
                      : u.active
                        ? "Ativo"
                        : "Inativo"}
                  </span>
                </td>
                <td className="p-4 whitespace-nowrap">
                  {new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  }).format(u.createdAt)}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <Link
                      className="btn-secondary"
                      aria-label={`Editar ${u.name}`}
                      href={`/usuarios/${u.id}/editar`}
                    >
                      <Pencil size={16} />
                    </Link>
                    <UserStatus
                      id={u.id}
                      version={u.version}
                      active={u.active}
                      name={u.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!data.items.length && (
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={5}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-slate-500">{data.count} usuário(s)</p>
      <AgendaPagination
        base="/usuarios"
        params={{ q: f.q, status: f.status }}
        page={data.page}
        pages={data.pages}
      />
    </>
  );
}
