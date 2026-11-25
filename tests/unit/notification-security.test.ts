import { it, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/server/notifications", () => ({
  synchronizeNotifications: vi.fn(async () => ({ skipped: false, created: 0 })),
  notificationInbox: vi.fn(),
  changeNotification: vi.fn(),
}));
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
import { GET as cron } from "@/app/api/cron/notificacoes/route";
import { GET, POST } from "@/app/api/admin/notificacoes/route";
import { notificationAction } from "@/app/(admin)/notificacoes/actions";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());
it("cron recusa acesso sem segredo ou com segredo inválido", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect(
    (await cron(new Request("https://example.org/api/cron/notificacoes")))
      .status,
  ).toBe(503);
  vi.stubEnv("CRON_SECRET", "x".repeat(40));
  expect(
    (
      await cron(
        new Request("https://example.org/api/cron/notificacoes", {
          headers: { authorization: "Bearer errado" },
        }),
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await cron(
        new Request("https://example.org/api/cron/notificacoes", {
          headers: { authorization: `Bearer ${"x".repeat(40)}` },
        }),
      )
    ).status,
  ).toBe(200);
});
it("páginas usam APIs e mutações restritas a administradores", async () => {
  expect((await GET()).status).toBe(403);
  expect(
    (
      await POST(
        new Request("https://example.org/api/admin/notificacoes", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(403);
  expect(await notificationAction("readAll")).toMatchObject({
    ok: false,
    message: "Restrito",
  });
});
