import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { deadlineInput } from "@/lib/opportunity-values";
import type { OpportunityInput } from "@/lib/opportunity-validation";
import { PageHeader } from "./page-header";
import { OpportunityForm } from "./opportunity-form";
export async function OpportunityEditor({ id }: { id?: string }) {
  await requireAdminPage();
  if (id && !idSchema.safeParse(id).success) notFound();
  const opportunity = id
    ? await db.opportunity.findUnique({ where: { id } })
    : null;
  if (id && !opportunity) notFound();
  if (opportunity?.archived) redirect(`/oportunidades/${opportunity.id}`);
  const agencies = await db.organization.findMany({
    where: {
      roles: { has: "PUBLIC_AGENCY" },
      OR: [
        { active: true },
        ...(opportunity ? [{ id: opportunity.organizationId }] : []),
      ],
    },
    select: { id: true, legalName: true, acronym: true, active: true },
    orderBy: { legalName: "asc" },
  });
  const initial: OpportunityInput = opportunity
    ? {
        reference: opportunity.reference,
        organizationId: opportunity.organizationId,
        subject: opportunity.subject,
        procurementMethod: opportunity.procurementMethod,
        processNumber: opportunity.processNumber ?? "",
        estimatedValue:
          opportunity.estimatedValue?.toFixed(2).replace(".", ",") ?? "",
        proposalDeadline: deadlineInput(opportunity.proposalDeadline),
        status: opportunity.status,
        sourceUrl: opportunity.sourceUrl ?? "",
        notes: opportunity.notes ?? "",
      }
    : {
        reference: "",
        organizationId: "",
        subject: "",
        procurementMethod: "UNDEFINED",
        processNumber: "",
        estimatedValue: "",
        proposalDeadline: "",
        status: "OPEN",
        sourceUrl: "",
        notes: "",
      };
  return (
    <div className="max-w-4xl">
      <Link
        href={id ? `/oportunidades/${id}` : "/oportunidades"}
        className="mb-6 inline-flex text-sm text-slate-500 hover:text-brand-600"
      >
        ← Voltar
      </Link>
      <PageHeader
        eyebrow="Comercial · Oportunidades"
        title={id ? "Editar oportunidade" : "Nova oportunidade"}
        description="Registre a demanda e acompanhe o próximo passo do relacionamento com o órgão."
      />
      {agencies.length ? (
        <OpportunityForm
          key={opportunity?.id ?? "new"}
          initial={initial}
          agencies={agencies}
          id={id}
          version={opportunity?.version}
        />
      ) : (
        <section className="panel p-8">
          <h2 className="font-semibold">
            Cadastre um órgão público para começar
          </h2>
          <p className="my-4 text-sm text-slate-500">
            A oportunidade precisa estar vinculada a um órgão público ativo.
          </p>
          <Link href="/orgaos/novo" className="btn">
            Cadastrar órgão público
          </Link>
        </section>
      )}
    </div>
  );
}
