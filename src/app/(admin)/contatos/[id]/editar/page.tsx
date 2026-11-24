import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { idSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ContactForm } from "@/components/contact-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const c = await db.contact.findUnique({
    where: { id },
    include: { organization: true },
  });
  if (!c) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Relacionamentos"
        title="Editar contato"
        description="Alterações também aparecem no cadastro da organização vinculada."
      />
      <ContactForm
        initial={{
          id,
          version: c.version,
          name: c.name,
          position: c.position ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          organization: c.organization
            ? { id: c.organization.id, label: c.organization.legalName }
            : null,
        }}
      />
    </div>
  );
}
