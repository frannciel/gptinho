import { describe, expect, it } from "vitest";
import {
  companySchema,
  isValidCnpj,
  loginSchema,
  organizationSchema,
  passwordSchema,
} from "@/lib/validation";
import { formatCnpj, money, date } from "@/lib/format";
import { hashPassword, verifyPassword } from "@/lib/password";
const valid = {
  legalName: "Órgão Exemplo",
  tradeName: "",
  acronym: "",
  cnpj: "11.222.333/0001-81",
  uasg: "123456",
  roles: ["PUBLIC_AGENCY"],
  email: " CONTATO@EXAMPLE.ORG ",
  phone: "(61) 3333-4444",
  categories: [],
  notes: "",
  active: true,
  contacts: [],
};
describe("Cadastros", () => {
  it("normaliza CNPJ, e-mail e campos opcionais", () => {
    const result = organizationSchema.parse(valid);
    expect(result.cnpj).toBe("11222333000181");
    expect(result.email).toBe("contato@example.org");
    expect(result.notes).toBeNull();
  });
  it.each(["11111111111111", "11222333000180", "123", ""])(
    "rejeita CNPJ inválido no verificador: %s",
    (value) => expect(isValidCnpj(value)).toBe(false),
  );
  it("aceita CNPJ alfanumérico com dígitos verificadores válidos", () =>
    expect(isValidCnpj("12ABC34501DE35")).toBe(true));
  it("aceita órgão sem CNPJ quando não aplicável", () =>
    expect(organizationSchema.parse({ ...valid, cnpj: "" }).cnpj).toBeNull());
  it("exige papel e valida UASG e contatos", () => {
    expect(organizationSchema.safeParse({ ...valid, roles: [] }).success).toBe(
      false,
    );
    expect(
      organizationSchema.safeParse({ ...valid, uasg: "123" }).success,
    ).toBe(false);
    expect(
      organizationSchema.safeParse({
        ...valid,
        contacts: [{ name: "", email: "erro", phone: "", position: "" }],
      }).success,
    ).toBe(false);
  });
  it("rejeita propriedades não previstas", () =>
    expect(
      organizationSchema.safeParse({ ...valid, passwordHash: "test" }).success,
    ).toBe(false));
  it("limita texto e quantidade de contatos", () => {
    expect(
      organizationSchema.safeParse({ ...valid, notes: "a".repeat(5001) })
        .success,
    ).toBe(false);
    expect(
      organizationSchema.safeParse({
        ...valid,
        contacts: Array(21).fill({
          name: "Contato",
          email: "",
          phone: "",
          position: "",
        }),
      }).success,
    ).toBe(false);
  });
  it("valida dados da empresa", () =>
    expect(
      companySchema.safeParse({
        legalName: "Govnex",
        tradeName: "Govnex",
        cnpj: "inválido",
        email: "",
        phone: "",
        address: "",
      }).success,
    ).toBe(false));
});
describe("Segurança e apresentação", () => {
  it("exige senha forte", () => {
    expect(passwordSchema.safeParse("123456").success).toBe(false);
    expect(passwordSchema.safeParse("SenhaForte!2026").success).toBe(true);
  });
  it("normaliza login e limita senha", () => {
    expect(
      loginSchema.parse({ email: "ADMIN@example.org", password: "x" }).email,
    ).toBe("admin@example.org");
    expect(
      loginSchema.safeParse({
        email: "admin@example.org",
        password: "x".repeat(129),
      }).success,
    ).toBe(false);
  });
  it("armazena Argon2id com salt e confere senha", async () => {
    const a = await hashPassword("SenhaForte!2026");
    const b = await hashPassword("SenhaForte!2026");
    expect(a).toMatch(/^\$argon2id\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "SenhaForte!2026")).toBe(true);
    expect(await verifyPassword(a, "incorreta")).toBe(false);
  });
  it("usa formatos brasileiros e fuso explícito", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(money("1234.50")).toContain("1.234,50");
    expect(date("2026-11-18T01:00:00Z")).toBe("17/11/2026");
  });
});
