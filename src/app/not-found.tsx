import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-12">
      <p className="eyebrow">Govnex ERP · 404</p>
      <h1 className="mt-4 text-3xl font-bold">Página não encontrada</h1>
      <p className="my-5 text-slate-600">
        O endereço não existe ou o registro foi removido.
      </p>
      <Link href="/dashboard" className="btn">
        Voltar ao início
      </Link>
    </main>
  );
}
