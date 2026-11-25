import { describe, it, expect } from "vitest";
import {
  createUserSchema,
  editUserSchema,
  userIdentitySchema,
  changePasswordSchema,
} from "@/lib/users";
const identity = { name: " Pessoa Teste ", email: "  PESSOA@EXAMPLE.ORG " };
const password = "UmaSenha!MuitoForte123";
describe("Validação de contas", () => {
  it("normaliza identidade sem permitir definição de perfil", () => {
    expect(userIdentitySchema.parse(identity)).toEqual({
      name: "Pessoa Teste",
      email: "pessoa@example.org",
    });
    expect(
      editUserSchema.safeParse({ ...identity, active: true, role: "USER" })
        .success,
    ).toBe(false);
  });
  it("exige senha forte e confirmação no cadastro", () => {
    expect(
      createUserSchema.safeParse({
        ...identity,
        active: true,
        password,
        confirmation: password,
      }).success,
    ).toBe(true);
    expect(
      createUserSchema.safeParse({
        ...identity,
        active: true,
        password: "fraca",
        confirmation: "fraca",
      }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({
        ...identity,
        active: true,
        password,
        confirmation: "OutraSenha!123",
      }).success,
    ).toBe(false);
  });
  it("a alteração de conta não recebe senha ou hash", () => {
    expect(
      editUserSchema.safeParse({
        ...identity,
        active: true,
        passwordHash: "inventado",
      }).success,
    ).toBe(false);
    expect(
      userIdentitySchema.safeParse({
        ...identity,
        id: "outra-pessoa",
        active: false,
      }).success,
    ).toBe(false);
  });
  it("troca de senha exige atual, diferença e confirmação", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: password,
        confirmation: password,
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: password,
        newPassword: password,
        confirmation: password,
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Outra!Senha123",
        newPassword: password,
        confirmation: password,
      }).success,
    ).toBe(true);
  });
});
