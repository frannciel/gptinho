import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { BusinessError } from "@/lib/errors";
import { searchContractOptions } from "@/server/contracts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(
      await searchContractOptions(
        db,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status =
      error instanceof AccessError
        ? error.status
        : error instanceof ZodError || error instanceof BusinessError
          ? 400
          : 503;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Sessão expirada. Entre novamente."
            : status === 403
              ? "Acesso não permitido."
              : status === 400
                ? "Revise os dados da consulta."
                : "Não foi possível pesquisar os cadastros.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
