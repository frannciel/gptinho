import { requireAdminPage } from "@/lib/authorization";
import { PageHeader } from "@/components/page-header";
import { ContactForm } from "@/components/contact-form";
export default async function Page() {
  await requireAdminPage();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Relacionamentos"
        title="Novo contato"
        description="Cadastre uma pessoa; o vínculo com organização é opcional."
      />
      <ContactForm
        initial={{
          name: "",
          position: "",
          email: "",
          phone: "",
          organization: null,
        }}
      />
    </div>
  );
}
