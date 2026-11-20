import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { listOpportunities } from "@/server/opportunities";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(
      await listOpportunities(
        db,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
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
          status === 401
            ? "Autenticação necessária."
            : status === 403
              ? "Acesso não permitido."
              : status === 400
                ? "Filtros inválidos."
                : "Serviço temporariamente indisponível.",
      },
      { status },
    );
  }
}
