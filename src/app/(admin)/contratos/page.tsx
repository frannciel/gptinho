import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { listContracts } from "@/server/contracts";
import { instrumentTypes, instrumentStatuses } from "@/lib/contracts";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
export const metadata = { title: "Contratos" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 200);
  const page = Math.min(100000, Math.max(1, Number(params.page) || 1));
  const { rows, count } = await listContracts(db, q, Math.floor(page));
  return (
    <>
      <PageHeader
        title="Contratos"
        eyebrow="Execução comercial"
        description="Termos de Contrato e Notas de Empenho, pedidos, faturamento e recebimentos."
        action={
          <Link href="/contratos/novo" className="btn">
            <Plus size={17} />
            Novo contrato
          </Link>
        }
      />
      <form className="panel mb-6 flex flex-wrap items-end gap-3 p-5">
        <label className="min-w-56 flex-1">
          Buscar instrumento
          <input
            className="field"
            name="q"
            defaultValue={q}
            placeholder="Número, órgão ou identificação gerencial"
          />
        </label>
        <button className="btn">
          <ButtonContent action="filter" />
        </button>
        <Link href="/contratos" className="btn-secondary">
          <ButtonContent action="clear" />
        </Link>
      </form>
      <div className="panel overflow-x-auto">
        <table className="contract-table">
          <thead>
            <tr>
              {[
                "Instrumento",
                "Número",
                "Órgão público",
                "Negócio comercial",
                "Valor original",
                "Situação",
                "Ações",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.instrumentType
                    ? instrumentTypes[i.instrumentType]
                    : "Legado · revisar"}
                </td>
                <td className="font-semibold">{i.reference}</td>
                <td>{i.organization.legalName}</td>
                <td className="max-w-40 truncate" title={i.case.reference}>
                  {i.case.reference}
                </td>
                <td>
                  {i.amount !== null
                    ? money(i.amount.toFixed(2))
                    : "Não informado"}
                </td>
                <td>{instrumentStatuses[i.status]}</td>
                <td>
                  <Link className="btn-secondary" href={`/contratos/${i.id}`}>
                    Consultar
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  Nenhum contrato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex items-center justify-between text-sm">
        <p>
          {count} instrumento(s) · página {page}
        </p>
        <div className="flex gap-3">
          {page > 1 && (
            <Link
              className="btn-secondary"
              href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}
            >
              Anterior
            </Link>
          )}
          {page * 25 < count && (
            <Link
              className="btn-secondary"
              href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}
            >
              Próxima
            </Link>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Os valores dos instrumentos não devem ser somados: Termo e empenhos
        relacionados compartilham um único negócio comercial.
      </p>
    </>
  );
}
