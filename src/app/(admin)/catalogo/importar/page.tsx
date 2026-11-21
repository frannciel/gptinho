import Link from "next/link";
import { requireAdminPage } from "@/lib/authorization";
import { DataImportForm } from "@/components/data-import-form";
import { PageHeader } from "@/components/page-header";
import { ButtonContent } from "@/components/button-content";
export default async function Page() {
  await requireAdminPage();
  return (
    <>
      <Link className="btn-secondary mb-6" href="/catalogo">
        <ButtonContent action="back" />
      </Link>
      <PageHeader
        title="Importar itens do catálogo"
        eyebrow="Comercial · Arquivos"
        description="Importe itens extraídos do termo de referência e complete os dados comerciais."
      />
      <DataImportForm kind="catalogo" />
    </>
  );
}
