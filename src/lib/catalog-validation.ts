import { z } from "zod";
import { idSchema } from "./validation";
export const percentage = z
  .string()
  .trim()
  .regex(
    /^\d{1,3}([.,]\d{1,2})?$/,
    "Informe um percentual com até duas casas decimais.",
  )
  .transform((v) => {
    const [whole, fraction = ""] = v.replace(",", ".").split(".");
    return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0")}`;
  })
  .refine((v) => BigInt(v.replace(".", "")) <= 10000n, "Informe de 0 a 100%.");
export const catalogSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(3, "Informe pelo menos 3 caracteres.")
      .max(20000, "Use no máximo 20000 caracteres."),
    brand: z
      .string()
      .trim()
      .max(120)
      .transform((v) => v || null),
    model: z
      .string()
      .trim()
      .max(120)
      .transform((v) => v || null),
    unit: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((v) => v.toUpperCase()),
    type: z.enum(["MATERIAL", "SERVICE"]),
    taxRate: percentage,
    supplierIds: z
      .array(idSchema)
      .min(1, "Selecione pelo menos um fornecedor.")
      .max(100)
      .refine((v) => new Set(v).size === v.length, "Fornecedor repetido."),
  })
  .strict();
