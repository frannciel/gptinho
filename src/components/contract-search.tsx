"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
export type ContractChoice = { id: string; label: string };
export function ContractSearch({
  label,
  kind,
  selected,
  onSelect,
  disabled = false,
  required = false,
}: {
  label: string;
  kind:
    "agency" | "opportunity" | "organization" | "contact" | "contract" | "user";
  selected: ContractChoice | null;
  onSelect: (choice: ContractChoice | null) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ContractChoice[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/admin/${kind === "agency" || kind === "opportunity" ? "contratos" : "agenda"}/busca?${new URLSearchParams({ kind, q: query, page: String(page) })}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok)
          throw Error(
            response.status === 401
              ? "Sessão expirada. Entre novamente."
              : "Não foi possível pesquisar. Tente novamente.",
          );
        const data = (await response.json()) as {
          items: ContractChoice[];
          hasMore: boolean;
        };
        if (!controller.signal.aborted) {
          setRows((old) =>
            page === 1
              ? data.items
              : [
                  ...old,
                  ...data.items.filter((i) => !old.some((o) => o.id === i.id)),
                ],
          );
          setMore(data.hasMore);
          setCursor(-1);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, page, open, disabled]);
  const choose = (choice: ContractChoice) => {
    onSelect(choice);
    setOpen(false);
    setQuery("");
    setPage(1);
  };
  return (
    <div ref={root} className="relative min-w-0">
      <label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-3.5 left-3 text-slate-400"
          size={17}
        />
        <input
          id={id}
          name={`${kind}Search`}
          role="combobox"
          aria-expanded={open && !disabled}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && cursor >= 0 ? `${id}-${cursor}` : undefined
          }
          className="field pr-10 pl-10"
          disabled={disabled}
          required={required && !selected}
          placeholder={
            kind === "agency" || kind === "organization"
              ? "Pesquise por nome, sigla ou CNPJ…"
              : kind === "contact"
                ? "Pesquise por nome ou e-mail…"
                : kind === "user"
                  ? "Pesquise pelo nome…"
                  : "Pesquise por identificação ou órgão…"
          }
          value={open ? query : (selected?.label ?? query)}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setQuery("");
              setPage(1);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
            setOpen(true);
            if (selected) onSelect(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              e.preventDefault();
            }
            if (e.key === "ArrowDown") {
              setOpen(true);
              setCursor((c) => Math.min(c + 1, rows.length - 1));
              e.preventDefault();
            }
            if (e.key === "ArrowUp") {
              setCursor((c) => Math.max(0, c - 1));
              e.preventDefault();
            }
            if (e.key === "Enter" && open) {
              e.preventDefault();
              if (cursor >= 0 && rows[cursor]) choose(rows[cursor]);
            }
          }}
        />
        {selected && !disabled && (
          <button
            type="button"
            aria-label={`Limpar ${label}`}
            className="absolute top-3 right-3"
            onClick={() => {
              onSelect(null);
              setQuery("");
              setOpen(false);
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <ul
            role="listbox"
            id={`${id}-list`}
            aria-label={`Resultados de ${label}`}
          >
            {rows.map((row, index) => (
              <li
                key={row.id}
                id={`${id}-${index}`}
                role="option"
                aria-selected={selected?.id === row.id}
                className={`cursor-pointer rounded p-3 text-sm hover:bg-brand-50 ${cursor === index ? "bg-brand-50" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row)}
              >
                {row.label}
              </li>
            ))}
          </ul>
          {loading && (
            <p role="status" className="p-3 text-sm">
              Pesquisando…
            </p>
          )}
          {error && (
            <p role="alert" className="p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          {!loading && !error && !rows.length && (
            <p className="p-3 text-sm text-slate-500">
              Nenhum cadastro encontrado.
            </p>
          )}
          {more && !loading && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setPage((p) => p + 1)}
            >
              Carregar mais resultados
            </button>
          )}
        </div>
      )}
    </div>
  );
}
