"use client";
import { useState } from "react";
import { Download } from "lucide-react";
export function ProposalExportForm({
  id,
  hasWinners,
}: {
  id: string;
  hasWinners: boolean;
}) {
  const [mode, setMode] = useState(hasWinners ? "vencedora" : "estimativa");
  const [format, setFormat] = useState("json");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="panel max-w-3xl space-y-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const response = await fetch(
            `/api/admin/contratacoes/${id}/exportar?${new URLSearchParams({ mode, format })}`,
            { cache: "no-store" },
          );
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error ?? "Não foi possível exportar.");
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `govnex-proposta-${id}.${format === "json" ? "json" : "md"}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-5">
        <label className="block text-sm">
          Conjunto de dados
          <select
            aria-label="Conjunto de dados"
            className="field mt-2"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="vencedora">
              Itens vencedores · ofertas vencedoras
            </option>
            <option value="estimativa">
              Todos os itens · valores estimados de referência
            </option>
          </select>
        </label>
        <label className="block text-sm">
          Formato
          <select
            aria-label="Formato"
            className="field mt-2"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="json">JSON</option>
            <option value="markdown">Markdown com dados JSON</option>
          </select>
        </label>
        <p className="text-sm text-slate-500">
          Inclui empresa, órgão, contratação e itens, sem custos internos,
          margens, fornecedores ou preço mínimo. Preencha os preços de todos os
          itens selecionados. Valores estimados são referências e precisam de
          revisão antes de apresentar a proposta comercial.
        </p>
        <button className="btn">
          <Download size={17} />
          {pending ? "Preparando arquivo…" : "Baixar dados para proposta"}
        </button>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </form>
  );
}
