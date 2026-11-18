import Link from "next/link";
export default function AccessDenied() {
  return (
    <main className="mx-auto max-w-lg p-12">
      <h1 className="text-2xl font-bold">Acesso restrito</h1>
      <p className="my-4">
        Esta área exige um perfil de administrador. Contate o responsável pelo
        sistema.
      </p>
      <Link href="/login" className="btn">
        Voltar ao acesso
      </Link>
    </main>
  );
}
