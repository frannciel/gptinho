"use client";
import type { ActionResult } from "@/lib/validation";
export function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-brand-600">
            *
          </span>
        )}
      </label>
      {children}
      {error?.length ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-700">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}
export function FormMessage({ result }: { result: ActionResult | null }) {
  return result ? (
    <div
      role={result.ok ? "status" : "alert"}
      className={`rounded-lg border p-4 text-sm ${result.ok ? "border-brand-100 bg-brand-50 text-brand-700" : "border-red-200 bg-red-50 text-red-800"}`}
    >
      {result.message}
      {result.errors &&
        Object.entries(result.errors)
          .filter(([key]) => ["contacts", "roles", "categories"].includes(key))
          .map(([key, errors]) => (
            <p key={key} className="mt-1">
              {errors.join(" ")}
            </p>
          ))}
    </div>
  ) : null;
}
