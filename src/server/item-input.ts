import type { Opportunity, OpportunityItem } from "@prisma/client";
import { deadlineInput } from "@/lib/opportunity-values";
export function itemInput(i: OpportunityItem) {
  return {
    id: i.id,
    number: String(i.number),
    description: i.description,
    unit: i.unit,
    quantity: i.quantity.toFixed(3),
    unitPrice: i.unitPrice?.toFixed(4) ?? "",
    catalogProductId: i.catalogProductId,
    brand: i.brand ?? "",
    model: i.model ?? "",
    margin: i.margin?.toFixed(2) ?? null,
    administrativeCost: i.administrativeCost?.toFixed(2) ?? null,
    supplierId: i.supplierId,
  };
}
export function headerInput(p: Opportunity) {
  return {
    reference: p.reference,
    organizationId: p.organizationId,
    subject: p.subject,
    procurementMethod: p.procurementMethod,
    processNumber: p.processNumber ?? "",
    proposalDeadline: deadlineInput(p.proposalDeadline),
    status: p.status,
    platformUrl: p.platformUrl ?? "",
    attachmentsUrl: p.attachmentsUrl ?? "",
    notes: p.notes ?? "",
  };
}
