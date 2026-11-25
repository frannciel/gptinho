import { requireAdminPage } from "@/lib/authorization";
import { PageHeader } from "@/components/page-header";
import { UserForm } from "@/components/user-form";
export default async function Page() {
  await requireAdminPage();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Administração"
        title="Novo usuário"
        description="Crie uma conta individual com acesso de administrador e senha inicial segura."
      />
      <UserForm mode="create" initial={{ name: "", email: "", active: true }} />
    </div>
  );
}
