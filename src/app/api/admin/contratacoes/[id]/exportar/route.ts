import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { BusinessError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  proposalExport,
  proposalFileText,
  exportOptions,
} from "@/server/proposal-export";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const options = exportOptions.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const data = await proposalExport(db, id, options.mode);
    const text = proposalFileText(data, options.format);
    if (new TextEncoder().encode(text).length > 4 * 1024 * 1024)
      throw new BusinessError(
        "O arquivo excede 4 MiB. Reduza o conteúdo antes de exportar.",
      );
    return new Response(text, {
      headers: {
        "Content-Type":
          options.format === "json"
            ? "application/json; charset=utf-8"
            : "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="govnex-proposta-${id}.${options.format === "json" ? "json" : "md"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AccessError || e instanceof BusinessError
            ? e.message
            : "Não foi possível exportar os dados.",
      },
      {
        status:
          e instanceof AccessError
            ? e.status
            : e instanceof ZodError
              ? 400
              : e instanceof BusinessError
                ? 422
                : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
