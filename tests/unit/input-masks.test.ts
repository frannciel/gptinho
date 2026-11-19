import { describe, expect, it } from "vitest";
import { maskCnpj, maskPhone, maskPostalCode } from "@/lib/input-masks";
import { organizationSchema, companySchema } from "@/lib/validation";
import { actionError } from "@/lib/errors";
const organization = {
  legalName: "Fornecedor Teste",
  tradeName: "",
  acronym: "",
  cnpj: "",
  uasg: "",
  roles: ["SUPPLIER"],
  email: "",
  phone: "",
  categories: [],
  notes: "",
  active: true,
  contacts: [],
};
const contact = {
  name: "Pessoa Teste",
  email: "Pessoa@EXAMPLE.ORG ",
  phone: "",
  position: "",
};
describe("Máscaras brasileiras", () => {
  it.each([
    ["11222333000181", "11.222.333/0001-81"],
    ["11.222.333/0001-81", "11.222.333/0001-81"],
    ["12abc34501de35", "12.ABC.345/01DE-35"],
    ["112", "11.2"],
    ["", ""],
  ])("CNPJ %s", (value, expected) => expect(maskCnpj(value)).toBe(expected));
  it.each([
    ["1133334444", "(11) 3333-4444"],
    ["11988887777", "(11) 98888-7777"],
    ["+5511988887777", "+55 (11) 98888-7777"],
    ["5511988887777", "+55 (11) 98888-7777"],
    ["+351912345678", "+351912345678"],
    ["351912345678", "351912345678"],
    ["11", "(11"],
    ["", ""],
  ])("telefone %s", (value, expected) =>
    expect(maskPhone(value)).toBe(expected),
  );
  it("formata CEP completo ou parcial e aceita colagem", () => {
    expect(maskPostalCode("01310100")).toBe("01310-100");
    expect(maskPostalCode("01310-100")).toBe("01310-100");
    expect(maskPostalCode("01310")).toBe("01310");
  });
});
describe("Endereços e contatos", () => {
  it("normaliza telefone, CEP e UF preservando endereço e cidade", () => {
    const parsed = organizationSchema.parse({
      ...organization,
      phone: "(11) 98888-7777",
      address: " Avenida Paulista, 1000 ",
      postalCode: "01310-100",
      city: " São Paulo ",
      state: "sp",
    });
    expect(parsed).toMatchObject({
      phone: "11988887777",
      postalCode: "01310100",
      state: "SP",
      address: "Avenida Paulista, 1000",
      city: "São Paulo",
    });
  });
  it("aceita novos campos vazios e mantém compatibilidade com payload anterior", () => {
    expect(organizationSchema.safeParse(organization).success).toBe(true);
    expect(
      organizationSchema.parse({
        ...organization,
        address: "",
        city: "",
        state: "",
        postalCode: "",
      }),
    ).toMatchObject({
      address: null,
      city: null,
      state: null,
      postalCode: null,
    });
  });
  it.each([
    { postalCode: "12345" },
    { postalCode: "01310-1000" },
    { state: "XX" },
    { phone: "(11) 12" },
  ])("rejeita endereço/telefone inválido: %o", (invalid) =>
    expect(
      organizationSchema.safeParse({ ...organization, ...invalid }).success,
    ).toBe(false),
  );
  it("rejeita contato repetido ignorando espaços e caixa e identifica o campo", () => {
    const result = organizationSchema.safeParse({
      ...organization,
      contacts: [contact, { ...contact, email: "pessoa@example.org" }],
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(actionError(result.error).errors?.["contacts.1.email"]).toContain(
        "Este e-mail já foi informado em outro contato.",
      );
  });
  it("permite múltiplos contatos sem e-mail", () =>
    expect(
      organizationSchema.safeParse({
        ...organization,
        contacts: [
          { ...contact, email: "" },
          { ...contact, email: "" },
        ],
      }).success,
    ).toBe(true));
  it("valida endereço separado da Govnex", () => {
    expect(
      companySchema.parse({
        legalName: "Govnex",
        tradeName: "Govnex",
        cnpj: "",
        email: "",
        phone: "",
        address: "Rua Exemplo, 12",
        postalCode: "70000-000",
        city: "Brasília",
        state: "DF",
      }),
    ).toMatchObject({
      address: "Rua Exemplo, 12",
      postalCode: "70000000",
      city: "Brasília",
      state: "DF",
    });
  });
});
