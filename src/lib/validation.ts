import { z } from "zod";
import { BRAZIL_STATES } from "./input-masks";
export function isValidCnpj(value: string) {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(value) || /^(.)\1+$/.test(value))
    return false;
  const digit = (base: string) => {
    let weight = base.length - 7;
    let sum = 0;
    for (const ch of base) {
      sum += (ch.charCodeAt(0) - 48) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return (
    digit(value.slice(0, 12)) === Number(value[12]) &&
    digit(value.slice(0, 13)) === Number(value[13])
  );
}
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => v || null);
export const cnpjSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[.\/\-\s]/g, "").toUpperCase())
  .refine((v) => !v || isValidCnpj(v), "Informe um CNPJ válido.")
  .transform((v) => v || null);
const email = z
  .string()
  .trim()
  .max(254)
  .refine(
    (v) => !v || z.string().email().safeParse(v).success,
    "Informe um e-mail válido.",
  )
  .transform((v) => (v ? v.toLowerCase() : null));
const phone = z
  .string()
  .trim()
  .max(25)
  .refine(
    (v) => !v || /^[+()\d\s.-]{8,25}$/.test(v),
    "Informe um telefone válido.",
  )
  .refine(
    (v) =>
      !v ||
      (v.replace(/\D/g, "").length >= 8 && v.replace(/\D/g, "").length <= 15),
    "Informe um telefone válido.",
  )
  .transform((v) => (v ? v.replace(/[^\d+]/g, "") : null));
export const postalCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => !v || /^\d{8}$/.test(v), "Informe um CEP com 8 dígitos.")
  .transform((v) => v || null);
const addressShape = {
  address: optionalText(500).optional(),
  postalCode: postalCodeSchema.optional(),
  city: optionalText(120).optional(),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (v) => !v || BRAZIL_STATES.some((state) => state === v),
      "Selecione um estado válido.",
    )
    .transform((v) => v || null)
    .optional(),
};
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export const passwordSchema = z
  .string()
  .min(12, "Use pelo menos 12 caracteres.")
  .max(128)
  .regex(/[a-z]/, "Inclua uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
  .regex(/[0-9]/, "Inclua um número.")
  .regex(/[^a-zA-Z0-9]/, "Inclua um símbolo.");
export const organizationSchema = z
  .object({
    legalName: z
      .string()
      .trim()
      .min(3, "Informe pelo menos 3 caracteres.")
      .max(180),
    tradeName: optionalText(180),
    acronym: optionalText(30),
    cnpj: cnpjSchema,
    uasg: z
      .string()
      .trim()
      .regex(/^([0-9]{6})?$/, "A UASG deve ter 6 dígitos.")
      .transform((v) => v || null),
    roles: z
      .array(z.enum(["PUBLIC_AGENCY", "SUPPLIER"]))
      .min(1, "Selecione um papel.")
      .max(2)
      .transform((v) => [...new Set(v)]),
    email,
    phone,
    ...addressShape,
    categories: z.array(z.string().trim().min(1).max(80)).max(20),
    notes: optionalText(5000),
    active: z.boolean(),
    contacts: z
      .array(
        z
          .object({
            name: z
              .string()
              .trim()
              .min(2, "Informe o nome do contato.")
              .max(120),
            position: optionalText(100),
            email,
            phone,
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.contacts.forEach((contact, index) => {
      if (!contact.email) return;
      if (seen.has(contact.email))
        ctx.addIssue({
          code: "custom",
          path: ["contacts", index, "email"],
          message: "Este e-mail já foi informado em outro contato.",
        });
      seen.add(contact.email);
    });
  });
export const companySchema = z
  .object({
    legalName: z.string().trim().min(3).max(180),
    tradeName: z.string().trim().min(2).max(180),
    cnpj: cnpjSchema,
    email,
    phone,
    ...addressShape,
  })
  .strict();
export type OrganizationInput = z.input<typeof organizationSchema>;
export type CompanyInput = z.input<typeof companySchema>;
export type ActionResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
};
export const idSchema = z.string().cuid();
