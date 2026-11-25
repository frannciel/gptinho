import { requireAdminPage } from "@/lib/authorization";
import { PageHeader } from "@/components/page-header";
import { PasswordForm } from "@/components/password-form";
export const metadata = { title: "Trocar senha" };
export default async function Page() {
  const user = await requireAdminPage();
  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Minha conta"
        title="Trocar senha"
        description="Confirme sua senha atual e defina uma nova senha para sua conta."
      />
      <PasswordForm version={user.version} />
    </div>
  );
}
