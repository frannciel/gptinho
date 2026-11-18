import { NextResponse } from "next/server";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { listOrganizations } from "@/server/organizations";
import { ZodError, z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const search = new URL(request.url).searchParams;
    const role = z
      .enum(["PUBLIC_AGENCY", "SUPPLIER"])
      .parse(search.get("role") ?? "PUBLIC_AGENCY");
    return NextResponse.json(
      await listOrganizations(db, role, Object.fromEntries(search)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status =
      error instanceof AccessError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 503;
    return NextResponse.json(
      {
        error:
          status === 503
            ? "Serviço temporariamente indisponível."
            : status === 400
              ? "Filtros inválidos."
              : status === 401
                ? "Autenticação necessária."
                : "Acesso não permitido.",
      },
      { status },
    );
  }
}
