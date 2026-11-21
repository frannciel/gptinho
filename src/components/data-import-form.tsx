"use client";
import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { FileCheck, Upload, Download } from "lucide-react";
import { SupplierMultiselect } from "./supplier-multiselect";
import { importFileAction } from "@/app/(admin)/arquivos/actions";
import { MAX_IMPORT_BYTES, type ImportKind } from "@/lib/data-files";
import type { ImportPreview } from "@/server/data-import";
import type { ActionResult } from "@/lib/validation";
export function DataImportForm({
  kind,
  target,
}: {
  kind: ImportKind;
  target?: string;
}) {
  const fileRead = useRef(0);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const invalidate = () => {
    setPreview(null);
    setResult(null);
    setDone(false);
  };
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <a
          className="btn-secondary"
          href={`/api/admin/arquivos/modelo?tipo=${kind}&formato=exemplo`}
        >
          <Download size={17} />
          Baixar exemplo JSON
        </a>
        <a
          className="btn-secondary"
          href={`/api/admin/arquivos/modelo?tipo=${kind}&formato=schema`}
        >
          <Download size={17} />
          Baixar JSON Schema
        </a>
      </div>
      <form
        className="panel space-y-5 p-6"
        onChange={invalidate}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const defaults = {
            supplierIds: kind === "catalogo" ? form.getAll("supplierIds") : [],
            taxRate:
              kind === "catalogo" && String(form.get("taxRate") ?? "").trim()
                ? String(form.get("taxRate")).trim().replace(",", ".")
                : null,
          };
          startTransition(async () => {
            try {
              const response = await importFileAction({
                text,
                kind,
                target,
                defaults,
                ...(preview ? { token: preview.token } : {}),
              });
              setResult(response);
              if (response.preview) setPreview(response.preview);
              if (response.result) {
                setDone(true);
                setPreview(null);
              }
              if (!response.ok) setPreview(null);
            } catch {
              setResult({
                ok: false,
                message:
                  "Falha de conexão. Valide novamente; o mesmo lote não será duplicado.",
              });
              setPreview(null);
            }
          });
        }}
      >
        <p className="text-sm text-slate-500">
          JSON UTF-8, até 2 MiB e 100 itens. A importação acrescenta registros;
          não substitui dados existentes. Nenhuma informação será gravada antes
          da confirmação.
        </p>
        <fieldset disabled={pending || done} className="space-y-5">
          <label className="block text-sm font-medium">
            Arquivo JSON
            <input
              className="field mt-2"
              type="file"
              accept=".json,application/json"
              required
              onChange={async (e) => {
                const sequence = ++fileRead.current;
                invalidate();
                setText("");
                const file = e.target.files?.[0];
                if (!file) return;
                setFilename(file.name);
                if (file.size > MAX_IMPORT_BYTES) {
                  setResult({
                    ok: false,
                    message: "O arquivo deve ter no máximo 2 MiB.",
                  });
                  return;
                }
                try {
                  const contents = await file.text();
                  if (sequence === fileRead.current) setText(contents);
                } catch {
                  setResult({
                    ok: false,
                    message: "Não foi possível ler o arquivo.",
                  });
                }
              }}
            />
          </label>
          {kind === "catalogo" && (
            <section className="space-y-4 rounded-lg border p-4">
              <h2 className="font-semibold">Complementos comerciais</h2>
              <p className="text-xs text-slate-500">
                Preencha apenas o que não estiver no arquivo. O termo de
                referência normalmente não informa nossos fornecedores e
                alíquotas.
              </p>
              <label className="block text-sm">
                Alíquota tributária padrão (%)
                <input
                  name="taxRate"
                  className="field mt-1"
                  inputMode="decimal"
                  maxLength={6}
                  placeholder="Sem valor padrão"
                />
              </label>
              <SupplierMultiselect
                initial={[]}
                onSelectionChange={invalidate}
              />
            </section>
          )}
          {preview && (
            <section aria-label="Prévia da importação" className="space-y-4">
              <h2 className="font-semibold">
                Prévia · {preview.rows.length} itens · Lote {preview.loteId}
              </h2>
              <p className="text-xs text-slate-500">Arquivo: {filename}</p>
              {preview.warnings.map((w) => (
                <p
                  key={w}
                  className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {w}
                </p>
              ))}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Item / Código",
                        "Tipo",
                        "Descrição",
                        "Marca / Modelo",
                        "Unidade",
                        ...(kind === "catalogo"
                          ? ["Alíquota (%)", "Fornecedores"]
                          : ["Quantidade", "Valor unitário", "Catálogo"]),
                      ].map((t) => (
                        <th className="p-2" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr className="border-t" key={r.key}>
                        <td className="p-2">{r.key}</td>
                        <td>{r.type === "SERVICE" ? "Serviço" : "Material"}</td>
                        <td className="max-w-sm p-2">
                          <span className="line-clamp-3" title={r.description}>
                            {r.description}
                          </span>
                        </td>
                        <td>
                          {r.brand ?? "—"} / {r.model ?? "—"}
                        </td>
                        <td>{r.unit}</td>
                        {kind === "catalogo" ? (
                          <>
                            <td>{r.taxRate?.replace(".", ",")}%</td>
                            <td>{r.supplierNames.join(", ")}</td>
                          </>
                        ) : (
                          <>
                            <td>{r.quantity}</td>
                            <td>{r.unitPrice ?? "Não informado"}</td>
                            <td>
                              {r.catalogProductLabel ?? "Vínculo pendente"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <div className="flex justify-end border-t pt-5">
            <button className="btn" disabled={!text || pending}>
              {preview ? <Upload size={17} /> : <FileCheck size={17} />}{" "}
              {pending
                ? "Processando…"
                : preview
                  ? "Confirmar importação"
                  : "Validar e visualizar"}
            </button>
          </div>
        </fieldset>
        {result && (
          <div
            role={result.ok ? "status" : "alert"}
            className={`rounded-lg p-4 text-sm ${result.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-800"}`}
          >
            <p>{result.message}</p>
            {result.errors && (
              <ul className="mt-2 list-inside list-disc">
                {Object.entries(result.errors).flatMap(([path, messages]) =>
                  messages.map((message, index) => (
                    <li key={`${path}-${index}`}>
                      {path}: {message}
                    </li>
                  )),
                )}
              </ul>
            )}
          </div>
        )}
        {done && (
          <Link
            className="btn-secondary"
            href={target ? `/contratacoes/${target}/itens` : "/catalogo"}
          >
            Ver itens importados
          </Link>
        )}
      </form>
    </>
  );
}
