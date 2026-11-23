import { requireAdminPage } from "@/lib/authorization";
import { ContractForm } from "@/components/contract-form";
import { PageHeader } from "@/components/page-header";
export default async function Page() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        eyebrow="Execução comercial"
        title="Novo contrato"
        description="Selecione o instrumento e pesquise a contratação de origem ou o órgão público."
      />
      <section className="panel max-w-5xl p-6">
        <ContractForm />
      </section>
    </>
  );
}
