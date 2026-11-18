"use client";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { LogOut } from "lucide-react";
export function Logout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        aria-label="Sair do sistema"
        className="flex items-center gap-2 rounded-lg p-2 text-xs text-slate-500 hover:bg-slate-100"
        onClick={async () => {
          setPending(true);
          try {
            await signOut({ callbackUrl: "/login" });
          } catch {
            setPending(false);
            setError(true);
          }
        }}
      >
        <LogOut size={17} />
        <span className="hidden sm:inline">{pending ? "Saindo…" : "Sair"}</span>
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          Falha ao sair. Tente novamente.
        </p>
      )}
    </div>
  );
}
