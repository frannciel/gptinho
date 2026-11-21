import { describe, it, expect } from "vitest";
import {
  parseImportFile,
  importExample,
  importJsonSchema,
  MAX_IMPORT_BYTES,
} from "@/lib/data-files";
const valid = () => importExample("contratacao");
describe("arquivos JSON versionados", () => {
  it("aceita exemplos dos dois formatos e normaliza decimais exatos", () => {
    const data = parseImportFile(JSON.stringify(valid()), "contratacao");
    expect(data.itens).toHaveLength(1);
    expect(
      parseImportFile(JSON.stringify(importExample("catalogo")), "catalogo")
        .tipo,
    ).toBe("itens_catalogo");
  });
  it("aceita UTF-8 com BOM", () =>
    expect(
      parseImportFile("\uFEFF" + JSON.stringify(valid()), "contratacao").versao,
    ).toBe("1.0"));
  it.each([1.2, "1,25", "1.23456", "-1"])(
    "recusa valor fora do contrato decimal %s",
    (value) => {
      const data = valid();
      (data.itens[0] as Record<string, unknown>).valorUnitarioEstimado = value;
      expect(() =>
        parseImportFile(JSON.stringify(data), "contratacao"),
      ).toThrow();
    },
  );
  it("recusa quantidade zero, itens repetidos e campos não permitidos", () => {
    const data = valid();
    Object.assign(data.itens[0], { quantidade: "0" });
    expect(() =>
      parseImportFile(JSON.stringify(data), "contratacao"),
    ).toThrow();
    const second = valid();
    second.itens.push(second.itens[0]);
    expect(() =>
      parseImportFile(JSON.stringify(second), "contratacao"),
    ).toThrow();
    Object.assign(valid().itens[0], { winner: true });
    const third = valid();
    Object.assign(third.itens[0], { minimumPrice: "1" });
    expect(() =>
      parseImportFile(JSON.stringify(third), "contratacao"),
    ).toThrow();
  });
  it("rejeita versão, tipo, JSON inválido e arquivo excessivo", () => {
    expect(() =>
      parseImportFile(
        JSON.stringify({ ...valid(), versao: "2.0" }),
        "contratacao",
      ),
    ).toThrow();
    expect(() =>
      parseImportFile(JSON.stringify(valid()), "catalogo"),
    ).toThrow();
    expect(() => parseImportFile("{", "catalogo")).toThrow("JSON inválido");
    expect(() =>
      parseImportFile(" ".repeat(MAX_IMPORT_BYTES + 1), "catalogo"),
    ).toThrow("2 MiB");
  });
  it("gera JSON Schema e limita o lote a 100 itens", () => {
    expect(importJsonSchema("catalogo")).toHaveProperty("$schema");
    expect(importJsonSchema("contratacao")).toHaveProperty("properties");
    const data = valid();
    data.itens = Array.from({ length: 101 }, (_, i) => ({
      ...data.itens[0],
      numero: i + 1,
    }));
    expect(() =>
      parseImportFile(JSON.stringify(data), "contratacao"),
    ).toThrow();
  });
});
