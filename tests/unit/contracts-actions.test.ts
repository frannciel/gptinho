import { it, expect, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/authorization", () => {
  class AccessError extends Error {
    constructor(public status: number) {
      super("Acesso restrito.");
    }
  }
  return {
    AccessError,
    requireAdmin: vi.fn(async () => {
      throw new AccessError(403);
    }),
  };
});
vi.mock("@/server/contracts", () => ({
  createContract: vi.fn(() => {
    throw Error("A operação não pode ser executada sem autorização.");
  }),
}));
import { contractAction } from "@/app/(admin)/contratos/actions";
it.each([
  "create",
  "update",
  "item",
  "deleteItem",
  "copySource",
  "order",
  "updateOrder",
  "supply",
  "cancelOrder",
  "invoice",
  "cancelInvoice",
  "receipt",
  "guarantee",
  "amendment",
  "cancelAmendment",
])(
  "protege a operação administrativa %s antes de ler/gravar dados",
  async (operation) => {
    expect(
      await contractAction(operation, {}, "invalid", 1, "invalid"),
    ).toEqual({ ok: false, message: "Acesso restrito." });
  },
);
