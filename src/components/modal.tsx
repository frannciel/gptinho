"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
export function Modal({
  title,
  closeHref,
  children,
}: {
  title: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  const close = () => router.push(closeHref, { scroll: false });
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(48rem,95vw)] overflow-y-auto rounded-xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/50"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          className="btn-secondary"
          aria-label="Fechar modal"
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
