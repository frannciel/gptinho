import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { safeUserSelect } from "@/lib/users";
import { PageHeader } from "@/components/page-header";
import { UserForm } from "@/components/user-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const user = await db.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });
  if (!user) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Administração"
        title="Editar usuário"
        description="Atualize a identificação e a situação da conta. Alterações de e-mail ou acesso encerram as sessões existentes."
      />
      {user.role !== "ADMIN" && (
        <p className="mb-5 rounded bg-amber-50 p-4">
          Ao salvar, esta conta terá acesso de administrador, conforme o padrão
          das contas do sistema.
        </p>
      )}
      <UserForm mode="edit" initial={user} />
    </div>
  );
}
