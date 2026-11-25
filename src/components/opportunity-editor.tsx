import { ButtonContent } from "@/components/button-content";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { deadlineInput } from "@/lib/opportunity-values";
import type { OpportunityInput } from "@/lib/opportunity-validation";
import { PageHeader } from "./page-header";
import { OpportunityArchive } from "./opportunity-archive";
import { money } from "@/lib/format";
import { OpportunityForm } from "./opportunity-form";
export async function OpportunityEditor({ id }: { id?: string }) {
  await requireAdminPage();
  if (id && !idSchema.safeParse(id).success) notFound();
  const opportunity = id
    ? await db.opportunity.findUnique({
        where: { id },
        include: { items: { orderBy: { number: "asc" } } },
      })
    : null;
  if (id && !opportunity) notFound();
  if (opportunity?.archived) redirect(`/contratacoes/${opportunity.id}`);
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
        isSrp: opportunity.isSrp,
        organizationId: opportunity.organizationId,
        subject: opportunity.subject,
        procurementMethod: opportunity.procurementMethod,
        processNumber: opportunity.processNumber ?? "",
        items: opportunity.items.map((item) => ({
          id: item.id,
          type: item.type,
          taxRate: item.taxRate?.toFixed(2) ?? null,
          winner: item.winner,
          catalogProductId: item.catalogProductId,
          brand: item.brand ?? "",
          model: item.model ?? "",
          margin: item.margin?.toFixed(2) ?? null,
          administrativeCost: item.administrativeCost?.toFixed(2) ?? null,
          supplierId: item.supplierId,
          number: String(item.number),
          description: item.description,
          unit: item.unit,
          quantity: item.quantity.toFixed(3).replace(".", ","),
          unitPrice: item.unitPrice?.toFixed(4).replace(".", ",") ?? "",
        })),
        proposalDeadline: deadlineInput(opportunity.proposalDeadline),
        status: opportunity.status,
        platformUrl: opportunity.platformUrl ?? "",
        attachmentsUrl: opportunity.attachmentsUrl ?? "",
        notes: opportunity.notes ?? "",
      }
    : {
        reference: "",
        organizationId: "",
        subject: "",
        procurementMethod: "UNDEFINED",
        processNumber: "",
        items: [],
        proposalDeadline: "",
        status: "IN_ANALYSIS",
        platformUrl: "",
        attachmentsUrl: "",
        notes: "",
      };
  return (
    <div className="max-w-4xl">
      <Link
        href={id ? `/contratacoes/${id}` : "/contratacoes"}
        className="btn-secondary mb-6"
      >
        <ButtonContent action="back" />
      </Link>
      <PageHeader
        eyebrow="Comercial · Contratações"
        title={id ? "Editar contratação" : "Nova contratação"}
        description="Registre a demanda e acompanhe o próximo passo do relacionamento com o órgão."
        action={
          opportunity ? (
            <OpportunityArchive
              id={opportunity.id}
              reference={opportunity.reference}
              version={opportunity.version}
              archived={opportunity.archived}
              editing
            />
          ) : undefined
        }
      />
      {opportunity?.legacyEstimatedValue !== null &&
        opportunity?.legacyEstimatedValue !== undefined && (
          <p className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Valor anterior para conferência:{" "}
            {money(opportunity.legacyEstimatedValue.toFixed(2))}. Ele foi
            preservado, mas não entra no valor estimado atual. Cadastre os itens
            para compor o total.
          </p>
        )}
      {opportunity?.legacySourceUrl && (
        <p className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Há um{" "}
          <a
            className="underline"
            href={opportunity.legacySourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            link anterior preservado
          </a>
          . Confira e preencha o campo da plataforma ou da pasta de anexos,
          conforme o conteúdo.
        </p>
      )}
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
            A contratação precisa estar vinculada a um órgão público ativo.
          </p>
          <Link href="/orgaos/novo" className="btn">
            Cadastrar órgão público
          </Link>
        </section>
      )}
    </div>
  );
}
