"use client";
import { useState } from "react";
export function SupplierMultiselect({
  options,
  initial,
}: {
  options: { id: string; legalName: string; active: boolean }[];
  initial: string[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initial);
  return (
    <fieldset className="space-y-2">
      <legend className="label">Fornecedores *</legend>
      <input
        className="field"
        aria-label="Pesquisar fornecedores"
        placeholder="Pesquisar fornecedores"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {selected.map((id) => (
        <input type="hidden" name="supplierIds" key={id} value={id} />
      ))}
      <p className="text-xs text-slate-500">{selected.length} selecionado(s)</p>
      <div className="max-h-48 overflow-y-auto rounded-lg border p-3">
        {options
          .filter((s) =>
            s.legalName
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
          )
          .map((s) => (
            <label key={s.id} className="flex gap-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, s.id]
                      : selected.filter((id) => id !== s.id),
                  )
                }
              />
              {s.legalName}
              {!s.active ? " (inativo)" : ""}
            </label>
          ))}
      </div>
    </fieldset>
  );
}
