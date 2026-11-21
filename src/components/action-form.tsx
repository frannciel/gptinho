"use client";
import { useActionState, useRef, useEffect, type ReactNode } from "react";
import type { ActionResult } from "@/lib/validation";
export function ActionForm({
  action,
  children,
  className,
  confirmation,
  id,
  beforeSubmit,
}: {
  action: (data: FormData) => Promise<ActionResult | void>;
  children: ReactNode;
  className?: string;
  confirmation?: string;
  id?: string;
  beforeSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);
  const [result, submit, pending] = useActionState(
    async (_: ActionResult | null, data: FormData) => {
      submitted.current = data;
      try {
        return (await action(data)) ?? null;
      } catch {
        return {
          ok: false,
          message:
            "Falha de conexão. Confira a conexão e tente novamente; seus campos foram preservados.",
        };
      }
    },
    null,
  );
  useEffect(() => {
    if (result && !result.ok && submitted.current && formRef.current) {
      for (const element of Array.from(formRef.current.elements)) {
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          const value = submitted.current.get(element.name);
          if (typeof value === "string") element.value = value;
        }
      }
    }
  }, [result]);
  return (
    <form
      id={id}
      ref={formRef}
      action={submit}
      className={className}
      onSubmit={(e) => {
        if (confirmation && !confirm(confirmation)) e.preventDefault();
        if (!e.defaultPrevented) beforeSubmit?.(e);
      }}
    >
      {result && !result.ok && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{result.message}</p>
          {result.errors && (
            <ul className="mt-2 list-inside list-disc">
              {Object.entries(result.errors).flatMap(([field, messages]) =>
                messages.map((message, i) => (
                  <li key={`${field}-${i}`}>{message}</li>
                )),
              )}
            </ul>
          )}
        </div>
      )}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && <p role="status">Salvando…</p>}
    </form>
  );
}
