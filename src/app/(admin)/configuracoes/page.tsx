import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { CompanyForm } from "@/components/company-form";
export const metadata = { title: "Configurações" };
export default async function SettingsPage() {
  await requireAdminPage();
  const settings = await db.companySettings.findUnique({
    where: { id: "company" },
  });
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Configurações da empresa"
        description="Atualize os dados de identificação e contato da Govnex."
      />
      <CompanyForm
        version={settings?.version ?? 0}
        initial={{
          legalName: settings?.legalName ?? "Govnex Soluções Digitais Ltda.",
          tradeName: settings?.tradeName ?? "Govnex",
          cnpj: settings?.cnpj ?? "",
          email: settings?.email ?? "",
          phone: settings?.phone ?? "",
          address: settings?.address ?? "",
          postalCode: settings?.postalCode ?? "",
          city: settings?.city ?? "",
          state: settings?.state ?? "",
        }}
      />
    </>
  );
}
