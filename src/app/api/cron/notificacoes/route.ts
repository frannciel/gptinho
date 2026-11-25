import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { synchronizeNotifications } from "@/server/notifications";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headers = { "Cache-Control": "no-store" };
  if (!secret || secret.length < 32)
    return NextResponse.json(
      { error: "Agendamento não configurado." },
      { status: 503, headers },
    );
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers },
    );
  try {
    return NextResponse.json(await synchronizeNotifications(db), { headers });
  } catch {
    return NextResponse.json(
      { error: "Falha na geração de notificações." },
      { status: 503, headers },
    );
  }
}
export const POST = GET;
