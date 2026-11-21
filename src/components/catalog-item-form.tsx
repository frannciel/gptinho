"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm } from "./action-form";
import { saveItemAction } from "@/app/(admin)/contratacoes/[id]/itens/actions";
import { pricingAction } from "@/app/(admin)/contratacoes/[id]/pricing-actions";
export type ProductChoice = {
  id: string;
  description: string;
  brand: string;
  model: string;
  unit: string;
  type: "MATERIAL" | "SERVICE" | null;
};
export type ContractingItemInitial = ProductChoice & {
  itemId: string;
  catalogProductId: string;
  quantity: string;
  unitPrice: string;
  number: string;
  winner: boolean;
};
export function CatalogItemForm({
  opportunityId,
  version,
  products,
  initial,
  number,
}: {
  opportunityId: string;
  version: number;
  products: ProductChoice[];
  initial?: ContractingItemInitial;
  number: string;
}) {
  const [fields, setFields] = useState<
    Pick<ProductChoice, "description" | "brand" | "model" | "unit" | "type">
  >(
    initial ?? {
      description: "",
      brand: "",
      model: "",
      unit: "UN",
      type: "MATERIAL" as const,
    },
  );
  const [catalogId, setCatalogId] = useState(initial?.catalogProductId ?? "");
  return (
    <ActionForm action={saveItemAction} className="space-y-5 p-6">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="itemId" value={initial?.itemId ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Número do item *
          <input
            className="field mt-1"
            name="number"
            required
            defaultValue={initial?.number ?? number}
            maxLength={6}
            inputMode="numeric"
          />
        </label>
        <label className="text-sm">
          Tipo *
          <select
            className="field mt-1"
            name="type"
            required
            value={fields.type ?? ""}
            onChange={(e) =>
              setFields({
                ...fields,
                type: e.target.value as "MATERIAL" | "SERVICE",
              })
            }
          >
            <option value="">Selecione</option>
            <option value="MATERIAL">Material</option>
            <option value="SERVICE">Serviço</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Item do catálogo *
        <select
          className="field mt-1"
          name="catalogProductId"
          required
          value={catalogId}
          onChange={(e) => {
            setCatalogId(e.target.value);
            const p = products.find((p) => p.id === e.target.value);
            if (p) setFields(p);
          }}
        >
          <option value="">Selecione</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.description}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Descrição *
        <textarea
          className="field mt-1"
          name="description"
          rows={4}
          required
          minLength={3}
          maxLength={20000}
          value={fields.description}
          onChange={(e) =>
            setFields({ ...fields, description: e.target.value })
          }
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["brand", "model", "unit"] as const).map((k) => (
          <label className="text-sm" key={k}>
            {{ brand: "Marca", model: "Modelo", unit: "Unidade" }[k]}
            {k === "unit" && " *"}
            <input
              className="field mt-1"
              name={k}
              required={k === "unit"}
              value={fields[k]}
              maxLength={k === "unit" ? 20 : 120}
              onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="text-sm">
          Quantidade *
          <input
            className="field mt-1"
            name="quantity"
            required
            inputMode="decimal"
            defaultValue={initial?.quantity ?? "1"}
            maxLength={60}
          />
        </label>
        <label className="text-sm">
          Valor estimado (R$)
          <input
            className="field mt-1"
            aria-label="Valor estimado (R$)"
            name="unitPrice"
            inputMode="decimal"
            defaultValue={initial?.unitPrice ?? ""}
            maxLength={60}
          />
          <span className="text-xs text-slate-500">
            Valor unitário com até quatro casas decimais.
          </span>
        </label>
      </div>
      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          name="winner"
          defaultChecked={initial?.winner ?? false}
        />
        Vencedor
      </label>
      <div className="flex justify-end">
        <button className="btn">Salvar item da contratação</button>
      </div>
    </ActionForm>
  );
}
export function DeleteContractingItem({
  id,
  itemId,
  version,
}: {
  id: string;
  itemId: string;
  version: number;
}) {
  return (
    <ActionForm
      action={saveItemAction}
      confirmation="Excluir este item da contratação? O valor estimado será recalculado."
    >
      <input type="hidden" name="opportunityId" value={id} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="version" value={version} />
      <button
        className="btn-secondary"
        name="operation"
        value="delete"
        aria-label="Excluir item"
      >
        <Trash2 size={16} />
      </button>
    </ActionForm>
  );
}
export function WinnerToggle({
  id,
  itemId,
  version,
  winner,
}: {
  id: string;
  itemId: string;
  version: number;
  winner: boolean;
}) {
  const [checked, setChecked] = useState(winner);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div>
      <input
        type="checkbox"
        aria-label="Vencedor"
        title="Marcar ou desmarcar item vencedor"
        checked={checked}
        disabled={pending}
        onChange={async (e) => {
          setChecked(e.target.checked);
          const form = new FormData();
          form.set("opportunityId", id);
          form.set("itemId", itemId);
          form.set("version", String(version));
          form.set("operation", "winner");
          form.set("winner", String(e.target.checked));
          setPending(true);
          try {
            const result = await pricingAction(form);
            setError(result?.message ?? "");
            if (result && !result.ok) setChecked(winner);
          } catch {
            setChecked(winner);
            setError("Falha ao salvar. Atualize e tente novamente.");
          } finally {
            setPending(false);
          }
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
