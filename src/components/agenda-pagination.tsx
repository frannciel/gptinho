import Link from "next/link";
export function AgendaPagination({
  base,
  params,
  page,
  pages,
}: {
  base: string;
  params: Record<string, string>;
  page: number;
  pages: number;
}) {
  const href = (p: number) =>
    `${base}?${new URLSearchParams({ ...params, page: String(p) })}`;
  return (
    <div className="mt-5 flex items-center gap-4 text-sm">
      <span>
        Página {page} de {pages}
      </span>
      {page > 1 && (
        <Link className="btn-secondary" href={href(page - 1)}>
          Anterior
        </Link>
      )}
      {page < pages && (
        <Link className="btn-secondary" href={href(page + 1)}>
          Próxima
        </Link>
      )}
    </div>
  );
}
