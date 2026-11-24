import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AccessError } from "@/lib/authorization";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { kind, q, page } = z
      .object({
        kind: z.enum(["organization", "contact", "contract", "user"]),
        q: z.string().trim().max(120).default(""),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const options = {
      take: 21,
      skip: (page - 1) * 20,
      orderBy: { id: "asc" as const },
    };
    const contains = { contains: q, mode: "insensitive" as const };
    const items =
      kind === "organization"
        ? (
            await db.organization.findMany({
              ...options,
              where: {
                OR: [
                  { legalName: contains },
                  { acronym: contains },
                  { cnpj: contains },
                ],
              },
              select: { id: true, legalName: true },
            })
          ).map((r) => ({ id: r.id, label: r.legalName }))
        : kind === "contact"
          ? (
              await db.contact.findMany({
                ...options,
                where: { OR: [{ name: contains }, { email: contains }] },
                select: { id: true, name: true, email: true },
              })
            ).map((r) => ({
              id: r.id,
              label: `${r.name}${r.email ? ` · ${r.email}` : ""}`,
            }))
          : kind === "user"
            ? (
                await db.user.findMany({
                  ...options,
                  where: { active: true, role: "ADMIN", name: contains },
                  select: { id: true, name: true },
                })
              ).map((r) => ({ id: r.id, label: r.name }))
            : (
                await db.contract.findMany({
                  ...options,
                  where: {
                    AND: [
                      {
                        OR: [
                          { instrumentType: "TERM" },
                          { instrumentType: "COMMITMENT", substitutive: true },
                        ],
                      },
                      {
                        OR: [
                          { reference: contains },
                          { organization: { legalName: contains } },
                        ],
                      },
                    ],
                  },
                  select: {
                    id: true,
                    reference: true,
                    organization: { select: { legalName: true } },
                  },
                })
              ).map((r) => ({
                id: r.id,
                label: `${r.reference} · ${r.organization.legalName}`,
              }));
    return NextResponse.json(
      { items: items.slice(0, 20), hasMore: items.length > 20 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Não foi possível pesquisar." },
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
