import { requireAdminPage } from "@/lib/authorization";
import { PageHeader } from "@/components/page-header";
import { UserForm } from "@/components/user-form";
export const metadata = { title: "Meu perfil" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPage();
  const params = await searchParams;
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Minha conta"
        title="Meu perfil"
        description="Atualize seu nome e seu e-mail. Seu acesso é de administrador."
      />
      {params.notice === "saved" && (
        <p
          role="status"
          className="mb-5 rounded bg-green-50 p-4 text-green-800"
        >
          Perfil atualizado com sucesso.
        </p>
      )}
      <UserForm mode="profile" initial={user} />
    </div>
  );
}
