import { z } from "zod";
import { passwordSchema } from "./validation";
export const identitySchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome completo.").max(120),
    email: z
      .email("Informe um e-mail válido.")
      .max(254)
      .transform((v) => v.toLowerCase()),
  })
  .strict();
// Normalize the address before validating it; never trim passwords.
export const userIdentitySchema = identitySchema.extend({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Informe um e-mail válido.").max(254)),
});
export const createUserSchema = userIdentitySchema
  .extend({
    active: z.boolean(),
    password: passwordSchema,
    confirmation: z.string().max(128),
  })
  .strict()
  .refine((v) => v.password === v.confirmation, {
    message: "A confirmação da senha não confere.",
    path: ["confirmation"],
  });
export const editUserSchema = userIdentitySchema
  .extend({ active: z.boolean() })
  .strict();
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual.").max(128),
    newPassword: passwordSchema,
    confirmation: z.string().max(128),
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmation, {
    message: "A confirmação da senha não confere.",
    path: ["confirmation"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "A nova senha deve ser diferente da senha atual.",
    path: ["newPassword"],
  });
export const userFilters = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
