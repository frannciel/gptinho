import { z } from "zod";
import { idSchema } from "./validation";
export const percentage = z
  .string()
  .trim()
  .regex(
    /^\d{1,3}([.,]\d{1,2})?$/,
    "Informe um percentual com até duas casas decimais.",
  )
  .transform((v) => Number(v.replace(",", ".")))
  .refine((v) => v >= 0 && v <= 100, "Informe de 0 a 100%.")
  .transform((v) => v.toFixed(2));
export const catalogSchema = z
  .object({
    description: z.string().trim().min(3).max(5000),
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
    margin: percentage,
    administrativeCost: percentage,
    supplierId: idSchema,
  })
  .strict();
