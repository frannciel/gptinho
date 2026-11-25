import { it, expect, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/authorization", () => {
  class AccessError extends Error {
    constructor(public status: number) {
      super("Restrito");
    }
  }
  return {
    AccessError,
    requireAdmin: vi.fn(async () => {
      throw new AccessError(403);
    }),
  };
});
import { srpAction } from "@/app/(admin)/contratacoes/[id]/registros-precos/actions";
it.each(["save", "delete", "addParticipant", "removeParticipant"] as const)(
  "exige administrador para %s",
  async (op) => {
    expect(await srpAction("invalid", 1, op, new FormData())).toMatchObject({
      ok: false,
      message: "Restrito",
    });
  },
);
