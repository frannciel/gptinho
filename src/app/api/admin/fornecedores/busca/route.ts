import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { searchSuppliers } from "@/server/organizations";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(
      await searchSuppliers(
        db,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const status =
      e instanceof AccessError ? e.status : e instanceof ZodError ? 400 : 503;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Autenticação necessária."
            : status === 403
              ? "Acesso não permitido."
              : status === 400
                ? "Consulta inválida."
                : "Não foi possível consultar fornecedores.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
