import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { Modal } from "./modal";
import { ButtonContent } from "./button-content";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/authorization";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { ContractingTabs } from "./contracting-tabs";
import { PageHeader } from "./page-header";
import { SrpForm } from "./srp-form";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const date = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
export async function SrpPage({
  id,
  participants = false,
  query = {},
}: {
  id: string;
  participants?: boolean;
  query?: Record<string, string | string[] | undefined>;
}) {
  await requireAdminPage();
  if (!idSchema.safeParse(id).success) notFound();
  const o = await db.opportunity.findUnique({
    where: { id },
    include: {
      organization: true,
      items: { orderBy: { number: "asc" } },
      participants: {
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      },
      priceRegistrations: {
        include: { items: { orderBy: { number: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!o) notFound();
  const editable = o.isSrp && !o.archived;
  const props = { opportunityId: id, version: o.version };
  const base = `/contratacoes/${id}/${participants ? "participantes" : "registros-precos"}`;
  const creating =
    editable &&
    (participants ? query.acao === "participante" : query.acao === "nova");
  const editing = editable && !participants && query.acao === "editar";
  const selected = editing
    ? o.priceRegistrations.find((r) => r.id === query.ata)
    : undefined;
  if (editing && !selected) notFound();

  const fields = (r?: (typeof o.priceRegistrations)[number]) => (
    <>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Número da ata *
          <input
            className="field"
            name="reference"
            required
            maxLength={120}
            defaultValue={r?.reference}
          />
        </label>
        <label>
          Data de assinatura *
          <input
            className="field"
            type="date"
            name="signatureDate"
            required
            defaultValue={r ? iso(r.signatureDate) : ""}
          />
        </label>
        <label>
          Data de validade *
          <input
            className="field"
            type="date"
            name="validUntil"
            required
            defaultValue={r ? iso(r.validUntil) : ""}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="allowsAdhesion"
            defaultChecked={r?.allowsAdhesion}
          />
          Permite Adesão
        </label>
        <label className="sm:col-span-2">
          Link do diretório ou documento
          <input
            className="field"
            type="url"
            name="documentUrl"
            defaultValue={r?.documentUrl ?? ""}
            maxLength={2000}
          />
        </label>
        <label className="sm:col-span-2">
          Observações
          <textarea
            className="field"
            name="notes"
            rows={3}
            defaultValue={r?.notes ?? ""}
            maxLength={10000}
          />
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">Itens da contratação *</legend>
        {o.items.map((i) => (
          <label
            key={i.id}
            className="flex items-start gap-3 rounded border border-slate-200 p-3"
          >
            <input
              type="checkbox"
              name="itemIds"
              value={i.id}
              defaultChecked={r?.items.some((row) => row.sourceItemId === i.id)}
            />
            <span className="min-w-0">
              <strong>Item {i.number}</strong>
              <span className="block line-clamp-2 text-sm">
                {i.description}
              </span>
            </span>
          </label>
        ))}
        {!o.items.length && (
          <p>Cadastre os itens da contratação antes de criar uma ata.</p>
        )}
      </fieldset>
      <p className="text-xs text-slate-500">
        Novos vínculos copiam número, descrição, quantidade e valor unitário da
        contratação. O valor vencedor tem preferência sobre o estimado. Itens já
        vinculados conservam seus dados registrados na ata.
      </p>
    </>
  );
  return (
    <>
      <PageHeader
        eyebrow="Contratação · Registro de Preços"
        title={o.reference}
        description={`Gerenciador: ${o.organization.legalName}`}
        action={
          <div className="flex flex-wrap gap-3">
            {editable && (
              <Link
                className="btn"
                href={`${base}?acao=${participants ? "participante" : "nova"}`}
                scroll={false}
              >
                <Plus size={17} />
                {participants ? "Adicionar participante" : "Nova ata"}
              </Link>
            )}
            <Link className="btn-secondary" href={`/contratacoes/${id}`}>
              <ButtonContent action="back" />
            </Link>
          </div>
        }
      />
      <ContractingTabs
        id={id}
        active={participants ? "participantes" : "registros-precos"}
      />
      {!o.isSrp && (
        <p className="panel mb-5 p-4">
          Esta contratação não é SRP. Marque Registro de Preços na edição para
          cadastrar atas e participantes.{" "}
          <Link
            className="font-semibold underline"
            href={`/contratacoes/${id}/editar`}
          >
            Editar contratação
          </Link>
        </p>
      )}
      {o.archived && (
        <p className="panel mb-5 p-4">
          Contratação arquivada. Os registros estão disponíveis apenas para
          consulta.
        </p>
      )}
      {participants ? (
        <>
          <section className="panel mb-5 p-5">
            <h2 className="mb-3 font-semibold">Órgãos participantes</h2>
            <p className="mb-4 text-sm text-slate-500">
              O gerenciador não pode integrar esta lista. Cada órgão pode
              participar apenas uma vez.
            </p>
            <ul className="divide-y divide-slate-100">
              {o.participants.map((p) => (
                <li
                  key={p.organizationId}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <span>
                    {p.organization.legalName}
                    {!p.organization.active ? " · Inativo" : ""}
                  </span>
                  {editable && (
                    <SrpForm
                      {...props}
                      operation="removeParticipant"
                      confirmation="Remover este órgão participante da contratação?"
                    >
                      <input
                        type="hidden"
                        name="organizationId"
                        value={p.organizationId}
                      />
                    </SrpForm>
                  )}
                </li>
              ))}
            </ul>
            {!o.participants.length && <p>Nenhum participante cadastrado.</p>}
          </section>
        </>
      ) : (
        <>
          <h2 className="mb-4 text-xl font-semibold">Registros de preços</h2>
          {!o.priceRegistrations.length && (
            <p className="panel mb-5 p-5">Nenhuma ata cadastrada.</p>
          )}
          {o.priceRegistrations.map((r) => (
            <section key={r.id} className="panel mb-6 p-5">
              <h3 className="mb-3 text-lg font-semibold">Ata {r.reference}</h3>
              <p className="mb-3 text-sm">
                Assinatura: {date(r.signatureDate)} · Validade:{" "}
                {date(r.validUntil)} · Permite adesão:{" "}
                {r.allowsAdhesion ? "Sim" : "Não"}
              </p>
              {r.documentUrl && (
                <a
                  href={r.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 underline"
                >
                  Link do diretório ou documento
                </a>
              )}
              {r.notes && (
                <p className="mt-3 whitespace-pre-wrap text-sm">{r.notes}</p>
              )}
              <div className="my-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Item",
                        "Descrição",
                        "Quantidade",
                        "Valor unitário",
                        "Disponível",
                      ].map((s) => (
                        <th className="p-3" key={s}>
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((i) => (
                      <tr className="border-t border-slate-100" key={i.id}>
                        <td className="p-3">{i.number}</td>
                        <td className="max-w-sm p-3">
                          <span className="line-clamp-2" title={i.description}>
                            {i.description}
                          </span>
                        </td>
                        <td className="p-3">
                          {i.quantity.toString().replace(".", ",")}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          R${" "}
                          {`${new Intl.NumberFormat("pt-BR").format(BigInt(i.unitPrice.toFixed(4).split(".")[0]))},${i.unitPrice.toFixed(4).split(".")[1]}`}
                        </td>
                        <td className="p-3">
                          {i.quantity.toString().replace(".", ",")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                Disponível corresponde à quantidade registrada. Baixas por
                contratos, adesões ou pedidos ainda não estão vinculadas nesta
                etapa.
              </p>
              {editable && (
                <>
                  <Link
                    className="btn-secondary mb-4"
                    href={`${base}?acao=editar&ata=${r.id}`}
                    scroll={false}
                  >
                    <Pencil size={16} />
                    Editar ata {r.reference}
                  </Link>
                  <SrpForm
                    {...props}
                    operation="delete"
                    confirmation={`Excluir a ata ${r.reference} e seus itens? A perda dos dados é irreversível.`}
                  >
                    <input type="hidden" name="id" value={r.id} />
                  </SrpForm>
                </>
              )}
            </section>
          ))}
        </>
      )}
      {query.notice === "saved" && (
        <p role="status" className="panel mt-4 p-4 text-green-800">
          {participants
            ? "Participante cadastrado com sucesso."
            : "Ata salva com sucesso."}
        </p>
      )}
      {(creating || editing) && (
        <Modal
          title={
            participants
              ? "Adicionar participante"
              : selected
                ? `Editar ata ${selected.reference}`
                : "Nova ata de registro de preços"
          }
          closeHref={base}
        >
          <div className="p-6">
            <p className="mb-5 text-sm text-slate-500">
              Contratação {o.reference} · Gerenciador:{" "}
              {o.organization.legalName}
            </p>
            <SrpForm
              {...props}
              operation={participants ? "addParticipant" : "save"}
              returnHref={base}
            >
              {!participants && fields(selected)}
            </SrpForm>
          </div>
        </Modal>
      )}
    </>
  );
}
