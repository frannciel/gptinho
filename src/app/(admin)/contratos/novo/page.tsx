import { units, fixed } from "@/lib/contracts";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { ContractForm } from "@/components/contract-form";
import { PageHeader } from "@/components/page-header";
export default async function Page() {
  await requireAdminPage();
  const [agencies, sources] = await Promise.all([
    db.organization.findMany({
      where: { active: true, roles: { has: "PUBLIC_AGENCY" } },
      orderBy: { legalName: "asc" },
      select: { id: true, legalName: true },
    }),
    db.opportunity.findMany({
      where: { archived: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        organizationId: true,
        items: {
          where: { winner: true, winningUnitPrice: { not: null } },
          orderBy: { number: "asc" },
          include: {
            contractedItems: {
              include: { amendmentItems: { include: { amendment: true } } },
            },
          },
        },
      },
    }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Execução comercial"
        title="Novo contrato"
        description="Escolha o instrumento jurídico para iniciar o cadastro."
      />
      <section className="panel max-w-5xl p-6">
        <ContractForm
          agencies={agencies.map((i) => ({ id: i.id, label: i.legalName }))}
          sources={sources.map((i) => ({
            ...i,
            items: i.items
              .map((item) => ({
                id: item.id,
                number: item.number,
                description: item.description,
                unit: item.unit,
                brand: item.brand,
                model: item.model,
                quantity: fixed(
                  units(item.quantity, 3) -
                    item.contractedItems.reduce(
                      (s, i) => s + units(i.quantity, 3),
                      0n,
                    ),
                  3,
                ),
                unitPrice: item.winningUnitPrice!.toFixed(4),
              }))
              .filter((item) => units(item.quantity, 3) > 0n),
          }))}
        />
      </section>
    </>
  );
}
