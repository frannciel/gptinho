"use client";
import { ActionForm } from "./action-form";
import { useState } from "react";
import { saveItemAction } from "@/app/(admin)/contratacoes/[id]/itens/actions";
type Product = {
  id: string;
  description: string;
  brand: string;
  model: string;
  unit: string;
  margin: string;
  administrativeCost: string;
  supplierId: string;
};
export function CatalogItemForm({
  opportunityId,
  version,
  products,
  suppliers,
  initial,
  number,
}: {
  opportunityId: string;
  version: number;
  products: Product[];
  suppliers: { id: string; legalName: string }[];
  initial?: Product & {
    itemId: string;
    catalogProductId: string;
    quantity: string;
    unitPrice: string;
    number: string;
  };
  number: string;
}) {
  const [fields, setFields] = useState(
    initial ?? {
      id: "",
      description: "",
      brand: "",
      model: "",
      unit: "UN",
      margin: "",
      administrativeCost: "",
      supplierId: "",
    },
  );
  const [catalogId, setCatalogId] = useState(initial?.catalogProductId ?? "");
  return (
    <ActionForm action={saveItemAction} className="panel space-y-4 p-6">
      <h2 className="font-semibold">
        {initial ? "Editar item" : "Incluir item"}
      </h2>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="itemId" value={initial?.itemId ?? ""} />
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
              {p.description} ·{" "}
              {suppliers.find((s) => s.id === p.supplierId)?.legalName}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate-500">
        Ao selecionar, os dados são copiados do catálogo. Ajustes aqui valem
        somente para esta contratação.
      </p>
      {(
        [
          "description",
          "brand",
          "model",
          "unit",
          "margin",
          "administrativeCost",
        ] as const
      ).map((k) => (
        <label className="block text-sm" key={k}>
          {
            {
              description: "Descrição",
              brand: "Marca",
              model: "Modelo",
              unit: "Unidade",
              margin: "Margem (%)",
              administrativeCost: "Custo Administrativo (%)",
            }[k]
          }
          {!["brand", "model"].includes(k) && " *"}
          <input
            className="field mt-1"
            name={k}
            required={!["brand", "model"].includes(k)}
            value={fields[k]}
            maxLength={k === "description" ? 5000 : k === "unit" ? 20 : 120}
            inputMode={
              k === "margin" || k === "administrativeCost" ? "decimal" : "text"
            }
            onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
            onBlur={() => {
              if (k === "margin" || k === "administrativeCost") {
                const n = Number(fields[k].replace(",", "."));
                if (fields[k] && Number.isFinite(n))
                  setFields({ ...fields, [k]: n.toFixed(2).replace(".", ",") });
              }
            }}
          />
        </label>
      ))}
      <label className="block text-sm">
        Fornecedor *
        <select
          className="field mt-1"
          name="supplierId"
          required
          value={fields.supplierId}
          onChange={(e) => setFields({ ...fields, supplierId: e.target.value })}
        >
          <option value="">Selecione</option>
          {suppliers.map((s) => (
            <option value={s.id} key={s.id}>
              {s.legalName}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          ["number", "Número do item", initial?.number ?? number, true],
          ["quantity", "Quantidade", initial?.quantity ?? "1", true],
          [
            "unitPrice",
            "Valor unitário estimado (R$)",
            initial?.unitPrice ?? "",
            false,
          ],
        ] as const
      ).map(([name, label, value, required]) => (
        <label className="block text-sm" key={name}>
          {label}
          {required && " *"}
          <input
            className="field mt-1"
            name={name}
            required={required}
            defaultValue={value}
            inputMode="decimal"
            maxLength={60}
          />
        </label>
      ))}
      <button className="btn">Salvar item da contratação</button>
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
      <button className="btn-secondary" name="operation" value="delete">
        Excluir
      </button>
    </ActionForm>
  );
}
