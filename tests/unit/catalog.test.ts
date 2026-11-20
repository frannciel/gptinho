import { describe, it, expect } from "vitest";
import { catalogSchema, percentage } from "@/lib/catalog-validation";
describe("percentuais do catálogo", () => {
  it.each([
    ["12,34", "12.34"],
    ["0", "0.00"],
    ["100", "100.00"],
  ])("normaliza %s", (input, value) =>
    expect(percentage.parse(input)).toBe(value),
  );
  it.each(["", "-1", "100,01", "1,234", "1e2", "NaN"])(
    "recusa percentual %s",
    (v) => expect(percentage.safeParse(v).success).toBe(false),
  );
  it("exige margem, custo administrativo e fornecedor", () =>
    expect(
      catalogSchema.safeParse({
        description: "Software",
        brand: "",
        model: "",
        unit: "UN",
      }).success,
    ).toBe(false));
});
