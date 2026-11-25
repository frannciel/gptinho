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
import {
  saveUserAction,
  toggleUserAction,
  profileAction,
  passwordAction,
} from "@/app/(admin)/usuarios/actions";
it("todas as operações exigem sessão administrativa", async () => {
  for (const result of await Promise.all([
    saveUserAction({}),
    saveUserAction({}, "id", 1),
    toggleUserAction("id", 1, false),
    profileAction({}, 1),
    passwordAction({}, 1),
  ]))
    expect(result).toMatchObject({ ok: false, message: "Restrito" });
});
