import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
import { itemsTotal } from "@/lib/contracting-items";
import {
  PROCUREMENT_METHODS,
  OPPORTUNITY_STATUSES,
} from "@/lib/opportunity-values";
export const exportOptions = z.object({
  mode: z.enum(["estimativa", "vencedora"]),
  format: z.enum(["json", "markdown"]).default("json"),
});
export async function proposalExport(
  db: PrismaClient,
  id: string,
  mode: "estimativa" | "vencedora",
) {
  idSchema.parse(id);
  z.enum(["estimativa", "vencedora"]).parse(mode);
  const opportunity = await db.opportunity.findUnique({
    where: { id },
    include: {
      organization: { include: { contacts: true } },
      items: {
        where: mode === "vencedora" ? { winner: true } : {},
        orderBy: { number: "asc" },
      },
    },
  });
  if (!opportunity) throw new BusinessError("Contratação não encontrada.");
  if (!opportunity.items.length)
    throw new BusinessError(
      mode === "vencedora"
        ? "Não há itens vencedores para exportar."
        : "Não há itens para exportar.",
    );
  const prices = opportunity.items.map((i) => ({
    quantity: i.quantity.toFixed(3),
    unitPrice:
      (mode === "vencedora" ? i.winningUnitPrice : i.unitPrice)?.toFixed(4) ??
      null,
  }));
  const missing = prices.findIndex((i) => i.unitPrice === null);
  if (missing >= 0)
    throw new BusinessError(
      `Item ${opportunity.items[missing].number}: preencha o ${mode === "vencedora" ? "valor da oferta vencedora" : "valor unitário estimado"} antes de exportar.`,
    );
  const totals = itemsTotal(prices);
  const settings = await db.companySettings.findUnique({
    where: { id: "company" },
  });
  const agency = opportunity.organization;
  return {
    versao: "1.0",
    tipo: "dados_proposta_comercial",
    moeda: "BRL",
    geradoEm: new Date().toISOString(),
    naturezaPrecos:
      mode === "vencedora" ? "OFERTA_VENCEDORA" : "REFERENCIA_ESTIMADA",
    observacaoPrecos:
      mode === "vencedora"
        ? "Valores unitários ofertados nos itens marcados como vencedores."
        : "Valores de referência estimados. Revisar e autorizar os preços comerciais antes de apresentar a proposta.",
    empresa: settings
      ? {
          razaoSocial: settings.legalName,
          nomeFantasia: settings.tradeName,
          cnpj: settings.cnpj,
          email: settings.email,
          telefone: settings.phone,
          endereco: settings.address,
          cep: settings.postalCode,
          cidade: settings.city,
          uf: settings.state,
        }
      : null,
    orgao: {
      razaoSocial: agency.legalName,
      sigla: agency.acronym,
      cnpj: agency.cnpj,
      uasg: agency.uasg,
      email: agency.email,
      telefone: agency.phone,
      endereco: agency.address,
      cep: agency.postalCode,
      cidade: agency.city,
      uf: agency.state,
      contatos: agency.contacts.map((c) => ({
        nome: c.name,
        cargo: c.position,
        email: c.email,
        telefone: c.phone,
      })),
    },
    contratacao: {
      id: opportunity.id,
      identificacao: opportunity.reference,
      objeto: opportunity.subject,
      modalidade: PROCUREMENT_METHODS[opportunity.procurementMethod],
      numeroProcesso: opportunity.processNumber,
      situacao: OPPORTUNITY_STATUSES[opportunity.status],
      arquivada: opportunity.archived,
      prazoApresentacao: opportunity.proposalDeadline?.toISOString() ?? null,
      plataforma: opportunity.platformUrl,
      pastaAnexos: opportunity.attachmentsUrl,
    },
    itens: opportunity.items.map((i, index) => ({
      numero: i.number,
      tipo:
        i.type === "MATERIAL"
          ? "MATERIAL"
          : i.type === "SERVICE"
            ? "SERVICO"
            : null,
      descricao: i.description,
      marca: i.brand,
      modelo: i.model,
      unidade: i.unit,
      quantidade: prices[index].quantity,
      valorUnitario: prices[index].unitPrice,
      valorTotal: totals.lines[index],
    })),
    valorTotal: totals.total,
    pendencias: [
      ...(!settings ? ["Dados da empresa não cadastrados."] : []),
      ...(!agency.cnpj ? ["CNPJ do órgão não informado."] : []),
      "Validade, condições de entrega, pagamento e demais cláusulas comerciais devem ser conferidas com o edital e o modelo da proposta.",
    ],
  };
}
export function proposalFileText(
  data: Awaited<ReturnType<typeof proposalExport>>,
  format: "json" | "markdown",
) {
  const json = JSON.stringify(data, null, 2);
  return format === "json"
    ? json + "\n"
    : `# Dados para elaboração da proposta comercial\n\nValores monetários em reais; decimais com ponto. Campos null indicam dados não informados.\n\n## Dados estruturados\n\n\`\`\`json\n${json}\n\`\`\`\n`;
}
