import { it, expect } from "vitest";
import { hasSameOrigin } from "@/lib/request-origin";
it("aceita o host público mesmo com bind interno diferente", () => {
  expect(
    hasSameOrigin(
      new Request("http://0.0.0.0:3000/api/admin/notificacoes", {
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    ),
  ).toBe(true);
  expect(
    hasSameOrigin(
      new Request("http://internal/api/admin/notificacoes", {
        headers: {
          host: "app.govnex.com.br",
          origin: "https://app.govnex.com.br",
          "x-forwarded-proto": "https",
        },
      }),
    ),
  ).toBe(true);
});
it("rejeita origens ausentes, externas ou com protocolo diferente", () => {
  for (const origin of [
    "https://evil.example",
    "null",
    "https://localhost:3000",
    "http://localhost:3000/path",
  ]) {
    expect(
      hasSameOrigin(
        new Request("http://0.0.0.0:3000/api/admin/notificacoes", {
          headers: { host: "localhost:3000", origin },
        }),
      ),
    ).toBe(false);
  }
  expect(
    hasSameOrigin(new Request("http://localhost:3000/api/admin/notificacoes")),
  ).toBe(false);
});
