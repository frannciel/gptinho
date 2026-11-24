"use client";
import { useState } from "react";
import { ContractSearch, type ContractChoice } from "./contract-search";
export function OrganizationFilter({
  initial,
  unlinked = false,
}: {
  initial: ContractChoice | null;
  unlinked?: boolean;
}) {
  const [selected, setSelected] = useState(initial);
  const [none, setNone] = useState(unlinked);
  return (
    <div>
      <input
        type="hidden"
        name="organizationId"
        value={none ? "none" : (selected?.id ?? "")}
      />
      <ContractSearch
        kind="organization"
        label="Organização"
        selected={selected}
        onSelect={(c) => {
          setSelected(c);
          setNone(false);
        }}
      />
      <label className="mt-2 flex items-center gap-2">
        <input
          type="checkbox"
          checked={none}
          onChange={(e) => {
            setNone(e.target.checked);
            setSelected(null);
          }}
        />
        Somente sem organização
      </label>
    </div>
  );
}
