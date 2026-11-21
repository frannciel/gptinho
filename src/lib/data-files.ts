import { z } from "zod";
import { normalizeItemDecimal } from "./contracting-items";
import { idSchema, cnpjSchema } from "./validation";
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const optionalText = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .default(null)
  .transform((v) => v || null);
const decimal = (scale: number, integerDigits: number, positive = false) =>
  z
    .string()
    .max(60)
    .regex(
      new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`),
      `Use texto decimal com ponto e até ${scale} casas, sem separador de milhar.`,
    )
    .transform((value, ctx) => {
      try {
        return normalizeItemDecimal(value, scale, integerDigits, positive)!;
      } catch (e) {
        ctx.addIssue({ code: "custom", message: (e as Error).message });
        return z.NEVER;
      }
    });
const rate = z
  .string()
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/)
  .transform((v) => normalizeItemDecimal(v, 2, 3)!)
  .refine(
    (v) => BigInt(v.replace(".", "")) <= 10000n,
    "Alíquota deve estar entre 0 e 100%.",
  );
const common = {
  tipo: z.enum(["MATERIAL", "SERVICO"]),
  descricao: z.string().trim().min(3).max(20000),
  marca: optionalText,
  modelo: optionalText,
  unidade: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((v) => v.toUpperCase()),
};
const envelope = {
  versao: z.literal("1.0"),
  loteId: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/),
  origem: z
    .object({
      documento: z.string().trim().max(300),
      referencia: z.string().trim().max(300).nullable().default(null),
    })
    .strict()
    .nullable()
    .default(null),
};
export const contractingFileSchema = z
  .object({
    ...envelope,
    tipo: z.literal("itens_contratacao"),
    itens: z
      .array(
        z
          .object({
            ...common,
            numero: z.number().int().min(1).max(999999),
            quantidade: decimal(3, 15, true),
            valorUnitarioEstimado: decimal(4, 14).nullable().default(null),
            catalogoId: idSchema.nullable().default(null),
            catalogoReferencia: z
              .object({
                loteId: z
                  .string()
                  .min(3)
                  .max(100)
                  .regex(/^[A-Za-z0-9._-]+$/),
                codigo: z.string().min(1).max(80),
              })
              .strict()
              .nullable()
              .default(null),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((d, ctx) => {
    const seen = new Set<number>();
    d.itens.forEach((i, index) => {
      if (i.catalogoId && i.catalogoReferencia)
        ctx.addIssue({
          code: "custom",
          path: ["itens", index, "catalogoReferencia"],
          message: "Use catalogoId ou catalogoReferencia, não ambos.",
        });
      if (seen.has(i.numero))
        ctx.addIssue({
          code: "custom",
          path: ["itens", index, "numero"],
          message: "Número repetido no arquivo.",
        });
      seen.add(i.numero);
    });
  });
export const catalogFileSchema = z
  .object({
    ...envelope,
    tipo: z.literal("itens_catalogo"),
    itens: z
      .array(
        z
          .object({
            ...common,
            codigo: z.string().trim().min(1).max(80),
            aliquotaTributaria: rate.nullable().default(null),
            fornecedoresCnpj: z
              .array(
                cnpjSchema
                  .refine((v) => v !== null, "CNPJ não pode ser vazio.")
                  .transform((v) => v!),
              )
              .max(100)
              .default([]),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((d, ctx) => {
    const seen = new Set<string>();
    d.itens.forEach((i, index) => {
      if (seen.has(i.codigo))
        ctx.addIssue({
          code: "custom",
          path: ["itens", index, "codigo"],
          message: "Código repetido no arquivo.",
        });
      seen.add(i.codigo);
    });
  });
export const importDefaultsSchema = z
  .object({
    supplierIds: z
      .array(idSchema)
      .max(100)
      .default([])
      .transform((v) => [...new Set(v)].sort()),
    taxRate: rate.nullable().default(null),
  })
  .strict();
export type ImportKind = "catalogo" | "contratacao";
export function parseImportFile(text: string, kind: ImportKind) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new Error("O arquivo deve ter no máximo 2 MiB.");
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Arquivo JSON inválido.");
  }
  return kind === "catalogo"
    ? catalogFileSchema.parse(value)
    : contractingFileSchema.parse(value);
}
export function importExample(kind: ImportKind) {
  return {
    versao: "1.0",
    tipo: kind === "catalogo" ? "itens_catalogo" : "itens_contratacao",
    loteId: "tr-exemplo-001",
    origem: { documento: "termo-de-referencia.pdf", referencia: "Item 1" },
    itens: [
      {
        ...(kind === "catalogo" ? { codigo: "CAT-001" } : { numero: 1 }),
        tipo: "MATERIAL",
        descricao: "Descrição completa do item conforme o termo de referência.",
        marca: null,
        modelo: null,
        unidade: "UN",
        ...(kind === "catalogo"
          ? { aliquotaTributaria: null, fornecedoresCnpj: [] }
          : {
              quantidade: "2.000",
              valorUnitarioEstimado: "100.0000",
              catalogoId: null,
              catalogoReferencia: null,
            }),
      },
    ],
  };
}
export function importJsonSchema(kind: ImportKind) {
  return z.toJSONSchema(
    kind === "catalogo" ? catalogFileSchema : contractingFileSchema,
    { io: "input", unrepresentable: "any" },
  );
}
