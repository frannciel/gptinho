import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { ProposalExportForm } from "@/components/proposal-export-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const p = await db.opportunity.findUnique({
    where: { id },
    include: { _count: { select: { items: { where: { winner: true } } } } },
  });
  if (!p) notFound();
  return (
    <>
      <Link href={`/contratacoes/${id}`} className="btn-secondary mb-6">
        ← Voltar
      </Link>
      <PageHeader
        title={`Exportar dados para proposta · ${p.reference}`}
        eyebrow="Comercial · Arquivos"
        description="Baixe um arquivo para o agente de IA preparar a proposta comercial conforme seu modelo."
      />
      <ProposalExportForm id={id} hasWinners={p._count.items > 0} />
    </>
  );
}
