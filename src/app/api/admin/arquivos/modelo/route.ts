import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { importExample, importJsonSchema } from "@/lib/data-files";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = z
      .object({
        tipo: z.enum(["catalogo", "contratacao"]),
        formato: z.enum(["exemplo", "schema"]).default("exemplo"),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const data =
      params.formato === "schema"
        ? importJsonSchema(params.tipo)
        : importExample(params.tipo);
    return new Response(JSON.stringify(data, null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="govnex-${params.tipo}-v1.${params.formato}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AccessError
            ? e.message
            : "Não foi possível gerar o modelo.",
      },
      {
        status:
          e instanceof AccessError
            ? e.status
            : e instanceof z.ZodError
              ? 400
              : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
