import Link from "next/link";
import { notFound } from "next/navigation";
import type { OrganizationRole } from "@prisma/client";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "./page-header";
import {
  OrganizationForm,
  type EditableOrganization,
} from "./organization-form";
export async function OrganizationEditor({
  role,
  id,
}: {
  role: OrganizationRole;
  id?: string;
}) {
  await requireAdminPage();
  const agency = role === "PUBLIC_AGENCY";
  const base = agency ? "/orgaos" : "/fornecedores";
  let initial: EditableOrganization = {
    legalName: "",
    tradeName: "",
    acronym: "",
    cnpj: "",
    uasg: "",
    roles: [role],
    email: "",
    phone: "",
    categories: [],
    notes: "",
    active: true,
    contacts: [],
  };
  if (id) {
    if (!idSchema.safeParse(id).success) notFound();
    const org = await db.organization.findFirst({
      where: { id, roles: { has: role } },
      include: { contacts: true },
    });
    if (!org) notFound();
    initial = {
      id: org.id,
      version: org.version,
      legalName: org.legalName,
      tradeName: org.tradeName ?? "",
      acronym: org.acronym ?? "",
      cnpj: org.cnpj ?? "",
      uasg: org.uasg ?? "",
      roles: org.roles,
      email: org.email ?? "",
      phone: org.phone ?? "",
      categories: org.categories,
      notes: org.notes ?? "",
      active: org.active,
      contacts: org.contacts.map((c) => ({
        name: c.name,
        position: c.position ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
      })),
    };
  }
  return (
    <div className="max-w-4xl">
      <Link
        href={base}
        className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={15} />
        Voltar para {agency ? "órgãos públicos" : "fornecedores"}
      </Link>
      <PageHeader
        eyebrow="Relacionamentos · Cadastro"
        title={
          id
            ? "Editar cadastro"
            : agency
              ? "Novo órgão público"
              : "Novo fornecedor"
        }
        description="Mantenha os dados de identificação, comunicação e relacionamento em um só lugar."
      />
      <OrganizationForm initial={initial} base={base} />
    </div>
  );
}
