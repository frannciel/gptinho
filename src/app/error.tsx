"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-bold">
        Não foi possível carregar esta página
      </h1>
      <p className="my-4 text-slate-600">
        O serviço pode estar temporariamente indisponível. Tente novamente em
        instantes. Se o problema persistir, contate o administrador.
      </p>
      <button className="btn" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
