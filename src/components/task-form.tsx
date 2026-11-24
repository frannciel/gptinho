"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./action-form";
import { ButtonContent } from "./button-content";
import { ContractSearch, type ContractChoice } from "./contract-search";
import { taskAction } from "@/app/(admin)/tarefas/actions";
import { taskStatuses, taskPriorities } from "@/lib/agenda";
export type TaskFormData = {
  id?: string;
  version?: number;
  title: string;
  description: string;
  dueDate: string;
  status: keyof typeof taskStatuses;
  priority: keyof typeof taskPriorities;
  assignee: ContractChoice | null;
  organization: ContractChoice | null;
  contact: ContractChoice | null;
  opportunity: ContractChoice | null;
  contract: ContractChoice | null;
};
const links = [
  { key: "assignee", kind: "user", label: "Responsável" },
  { key: "organization", kind: "organization", label: "Organização" },
  { key: "contact", kind: "contact", label: "Contato" },
  { key: "opportunity", kind: "opportunity", label: "Contratação" },
  { key: "contract", kind: "contract", label: "Contrato" },
] as const;
export function TaskForm({ initial }: { initial: TaskFormData }) {
  const [choices, setChoices] = useState(initial);
  const router = useRouter();
  return (
    <ActionForm
      className="panel grid gap-5 p-6 sm:grid-cols-2"
      action={async (data) => {
        const result = await taskAction(
          {
            title: data.get("title"),
            description: data.get("description"),
            dueDate: data.get("dueDate"),
            status: data.get("status"),
            priority: data.get("priority"),
            ...Object.fromEntries(
              links.map(({ key }) => [key + "Id", choices[key]?.id ?? ""]),
            ),
          },
          initial.id,
          initial.version,
        );
        if (result.ok) {
          router.push("/tarefas?notice=saved");
          router.refresh();
        }
        return result;
      }}
    >
      <label className="sm:col-span-2">
        Título *
        <input
          className="field"
          name="title"
          required
          minLength={2}
          maxLength={180}
          defaultValue={initial.title}
        />
      </label>
      <label className="sm:col-span-2">
        Descrição
        <textarea
          className="field"
          name="description"
          rows={3}
          maxLength={5000}
          defaultValue={initial.description}
        />
      </label>
      <label>
        Data / prazo *
        <input
          className="field"
          name="dueDate"
          type="date"
          min="1900-01-01"
          max="2199-12-31"
          required
          defaultValue={initial.dueDate}
        />
      </label>
      <label>
        Situação
        <select
          className="field"
          name="status"
          aria-label="Situação"
          defaultValue={initial.status}
        >
          {Object.entries(taskStatuses).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prioridade
        <select
          className="field"
          name="priority"
          aria-label="Prioridade"
          defaultValue={initial.priority}
        >
          {Object.entries(taskPriorities).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {links.map(({ key, kind, label }) => (
        <ContractSearch
          key={key}
          kind={kind}
          label={`${label} (opcional)`}
          selected={choices[key]}
          onSelect={(choice) =>
            setChoices((old) => ({ ...old, [key]: choice }))
          }
        />
      ))}
      <div className="mt-4 flex gap-3 sm:col-span-2">
        <button className="btn">
          <ButtonContent action="save" />
        </button>
        <Link href="/tarefas" className="btn-secondary">
          <ButtonContent action="cancel" />
        </Link>
      </div>
    </ActionForm>
  );
}
