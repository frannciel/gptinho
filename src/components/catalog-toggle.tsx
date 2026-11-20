"use client";
import { deactivateCatalogAction } from "@/app/(admin)/catalogo/actions";
export function CatalogToggle({
  id,
  version,
  active,
}: {
  id: string;
  version: number;
  active: boolean;
}) {
  return (
    <form
      action={deactivateCatalogAction}
      onSubmit={(e) => {
        if (
          !confirm(
            active
              ? "Desativar este item do catálogo? Os itens das contratações serão preservados."
              : "Reativar este item do catálogo?",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <button className="btn-secondary">
        {active ? "Desativar" : "Reativar"}
      </button>
    </form>
  );
}
