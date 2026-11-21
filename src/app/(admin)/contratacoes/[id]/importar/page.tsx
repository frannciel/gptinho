import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { DataImportForm } from "@/components/data-import-form";
import { PageHeader } from "@/components/page-header";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const p = await db.opportunity.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <>
      <Link href={`/contratacoes/${id}/itens`} className="btn-secondary mb-6">
        ← Voltar
      </Link>
      <PageHeader
        title={`Importar itens · ${p.reference}`}
        eyebrow="Comercial · Arquivos"
        description="Acrescente os itens do termo de referência a esta contratação."
      />
      {p.archived ? (
        <p className="panel p-6">
          Contratação arquivada. A importação está bloqueada.
        </p>
      ) : (
        <DataImportForm kind="contratacao" target={id} />
      )}
    </>
  );
}
