"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./action-form";
import { contractAction } from "@/app/(admin)/contratos/actions";
export function ContractOperation({
  operation,
  id,
  version,
  recordId,
  children,
  confirmation,
}: {
  operation: string;
  id: string;
  version: number;
  recordId?: string;
  children: ReactNode;
  confirmation?: string;
}) {
  const router = useRouter();
  return (
    <ActionForm
      className="space-y-4"
      confirmation={confirmation}
      action={async (form) => {
        const input: Record<string, unknown> = Object.fromEntries(form);
        const ids = form.getAll("itemId").map(String);
        if (["order", "updateOrder", "invoice"].includes(operation))
          input.items = ids
            .filter(
              (i) =>
                String(form.get(`quantity-${i}`) ?? "").trim() &&
                !/^0([.,]0+)?$/.test(String(form.get(`quantity-${i}`))),
            )
            .map((i) => ({
              contractItemId: i,
              quantity: String(form.get(`quantity-${i}`)),
            }));
        if (operation === "supply")
          input.items = ids.map((i) => ({
            id: i,
            suppliedQuantity: String(form.get(`supplied-${i}`) ?? ""),
          }));
        if (operation === "amendment")
          input.items = ids
            .map((i) => ({
              contractItemId: i,
              quantityDelta: String(form.get(`quantityDelta-${i}`) ?? "0"),
              unitPriceDelta: String(form.get(`unitPriceDelta-${i}`) ?? "0"),
            }))
            .filter(
              (i) =>
                !/^0([.,]0+)?$/.test(i.quantityDelta) ||
                !/^0([.,]0+)?$/.test(i.unitPriceDelta),
            );
        const result = await contractAction(
          operation,
          input,
          id,
          version,
          recordId,
        );
        if (result.ok) {
          router.push(
            `/contratos/${id}?tab=${String(form.get("tab") ?? "geral")}&saved=1`,
          );
          router.refresh();
        }
        return result;
      }}
    >
      {children}
    </ActionForm>
  );
}
