"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
type Supplier = { id: string; legalName: string; active: boolean };
export function SupplierMultiselect({
  initial,
  multiple = true,
  name = "supplierIds",
  includeInactive = false,
}: {
  initial: Supplier[];
  multiple?: boolean;
  name?: string;
  includeInactive?: boolean;
}) {
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Supplier[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(-1);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/admin/fornecedores/busca?${new URLSearchParams({ q: query, page: String(page), status: includeInactive ? "all" : "active" })}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Sessão expirada. Entre novamente."
              : "Não foi possível consultar os fornecedores.",
          );
        const data = (await response.json()) as {
          items: Supplier[];
          hasMore: boolean;
        };
        if (!controller.signal.aborted) {
          setRows((before) =>
            page === 1
              ? data.items
              : [
                  ...before,
                  ...data.items.filter(
                    (item) => !before.some((old) => old.id === item.id),
                  ),
                ],
          );
          setHasMore(data.hasMore);
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
  }, [query, page, open, includeInactive]);
  useEffect(() => {
    if (open && cursor >= 0)
      document
        .getElementById(`${listId}-${cursor}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [cursor, open, listId]);
  const toggle = (s: Supplier) => {
    setSelected((before) =>
      before.some((item) => item.id === s.id)
        ? before.filter((item) => item.id !== s.id)
        : !multiple
          ? [s]
          : before.length < 100
            ? [...before, s]
            : before,
    );
    input.current?.focus();
    setOpen(false);
  };
  return (
    <div ref={root} className="relative space-y-2">
      <label className="label" htmlFor={`${listId}-input`}>
        {multiple ? "Fornecedores *" : "Fornecedor"}
      </label>
      <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border border-slate-300 bg-white p-2">
        {selected.map((s) => (
          <span
            key={s.id}
            className="inline-flex max-w-full items-center gap-2 rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-700"
          >
            <span className="truncate">
              {s.legalName}
              {!s.active ? " (inativo)" : ""}
            </span>
            <input type="hidden" name={name} value={s.id} />
            <button
              type="button"
              className="rounded p-0.5 hover:bg-brand-100"
              aria-label={`Remover ${s.legalName}`}
              onClick={() =>
                setSelected((before) =>
                  before.filter((item) => item.id !== s.id),
                )
              }
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <input
            ref={input}
            id={`${listId}-input`}
            className="min-w-0 flex-1 px-1 py-1 text-sm outline-none"
            role="combobox"
            aria-label={
              multiple ? "Pesquisar fornecedores" : "Pesquisar fornecedor"
            }
            aria-controls={listId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={
              open && cursor >= 0 ? `${listId}-${cursor}` : undefined
            }
            placeholder="Pesquisar razão social, nome fantasia ou CNPJ"
            value={query}
            maxLength={120}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setRows([]);
              setHasMore(false);
              setLoading(true);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setOpen(true);
                setCursor((before) =>
                  Math.max(
                    0,
                    Math.min(
                      rows.length - 1,
                      before + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
              } else if (e.key === "Enter" && open) {
                e.preventDefault();
                if (rows[cursor]) toggle(rows[cursor]);
              } else if (e.key === "Tab") setOpen(false);
            }}
          />
          <button
            type="button"
            aria-label="Abrir lista de fornecedores"
            className="p-1 text-slate-500"
            onClick={() => {
              setOpen(!open);
              if (!open) input.current?.focus();
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {selected.length}/100 selecionados. Pesquise para adicionar
        fornecedores.
      </p>
      {open && (
        <div className="absolute right-0 left-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div
            id={listId}
            role="listbox"
            aria-label="Resultados de fornecedores"
            aria-multiselectable={multiple}
            className="max-h-48 overflow-y-auto"
          >
            {rows.map((s, index) => (
              <div
                id={`${listId}-${index}`}
                key={s.id}
                role="option"
                aria-selected={selected.some((item) => item.id === s.id)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(s)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-brand-50 ${cursor === index ? "bg-brand-50" : ""}`}
              >
                <span>{s.legalName}</span>
                {selected.some((item) => item.id === s.id) && (
                  <Check size={16} className="shrink-0 text-brand-700" />
                )}
              </div>
            ))}
          </div>
          {loading && (
            <p
              role="status"
              className="flex items-center gap-2 px-3 py-2 text-xs"
            >
              <LoaderCircle size={14} className="animate-spin" />
              Consultando…
            </p>
          )}
          {error && (
            <p role="alert" className="p-3 text-xs text-red-700">
              {error}
            </p>
          )}
          {!loading && !error && !rows.length && (
            <p className="p-3 text-xs text-slate-500">
              Nenhum fornecedor encontrado.
            </p>
          )}
          {hasMore && !loading && (
            <button
              type="button"
              className="w-full border-t px-3 py-2 text-sm text-brand-700"
              onClick={() => setPage((before) => before + 1)}
            >
              Carregar mais
            </button>
          )}
        </div>
      )}
    </div>
  );
}
