import { hasSameOrigin } from "@/lib/request-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  synchronizeNotifications,
  notificationInbox,
  changeNotification,
} from "@/server/notifications";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  try {
    const user = await requireAdmin();
    await synchronizeNotifications(db);
    return NextResponse.json(await notificationInbox(db, user.id), { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AccessError
            ? e.message
            : "Não foi possível carregar as notificações.",
      },
      { status: e instanceof AccessError ? e.status : 503, headers },
    );
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    // Cookie-authenticated mutations require the application's own origin.
    if (!hasSameOrigin(request))
      return NextResponse.json(
        { error: "Origem não permitida." },
        { status: 403, headers },
      );
    const input = z
      .object({
        operation: z.enum(["read", "unread", "dismiss", "readAll"]),
        id: z.string().optional(),
      })
      .strict()
      .parse(await request.json());
    await changeNotification(db, user.id, input.operation, input.id);
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AccessError
            ? e.message
            : "Não foi possível atualizar a notificação.",
      },
      {
        status:
          e instanceof AccessError
            ? e.status
            : e instanceof z.ZodError
              ? 400
              : 400,
        headers,
      },
    );
  }
}
