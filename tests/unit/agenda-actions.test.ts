import { expect, it, vi } from "vitest";
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
import {
  contactAction,
  removeContactAction,
} from "@/app/(admin)/contatos/actions";
import {
  taskAction,
  removeTaskAction,
  readEventAction,
} from "@/app/(admin)/tarefas/actions";
import { GET } from "@/app/api/admin/agenda/busca/route";
it("bloqueia todas as mutações sem administrador", async () => {
  for (const promise of [
    contactAction({}),
    removeContactAction("id", 1),
    taskAction({}),
    removeTaskAction("id", 1),
    readEventAction(new FormData()),
  ])
    expect(await promise).toMatchObject({
      ok: false,
      message: "Acesso restrito.",
    });
});
it("protege a consulta de vínculos", async () => {
  expect(
    (
      await GET(
        new Request("http://localhost/api/admin/agenda/busca?kind=contact"),
      )
    ).status,
  ).toBe(403);
});
