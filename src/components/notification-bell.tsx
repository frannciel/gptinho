"use client";
import Link from "next/link";
import { Bell, X, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
type Notice = {
  id: string;
  sourceKey: string;
  stage: string;
  title: string;
  body: string;
  href: string;
  dueAt: string;
  visibleAt: string;
  readAt: string | null;
  dismissedAt: string | null;
};
type Inbox = {
  count: number;
  items: Notice[];
  alerts: Notice[];
  serverNow: string;
};
export function NotificationBell() {
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const response = await fetch("/api/admin/notificacoes", {
        cache: "no-store",
        signal: current.signal,
      });
      if (!response.ok)
        throw Error(
          response.status === 401
            ? "Sessão expirada. Entre novamente."
            : "Notificações temporariamente indisponíveis.",
        );
      const next = (await response.json()) as Inbox;
      if (!current.signal.aborted) {
        setOffset(Date.parse(next.serverNow) - Date.now());
        setData(next);
        setError("");
        setClock(Date.now());
      }
    } catch (e) {
      if (!current.signal.aborted) {
        setError((e as Error).message);
        setData(null);
      }
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    const tick = setInterval(() => setClock(Date.now()), 1000);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("govnex-notifications-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
      controller.current?.abort();
      window.removeEventListener("govnex-notifications-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  async function mutate(
    operation: "read" | "dismiss" | "readAll",
    id?: string,
  ) {
    try {
      const response = await fetch("/api/admin/notificacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, id }),
      });
      if (!response.ok)
        throw Error(
          "Não foi possível atualizar a notificação. Tente novamente.",
        );
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const now = clock + offset;
  const alerts = (data?.alerts ?? []).filter(
    (n) =>
      Date.parse(n.visibleAt) <= now &&
      (n.stage === "15m"
        ? now < Date.parse(n.dueAt)
        : now >= Date.parse(n.dueAt) && now < Date.parse(n.dueAt) + 600000),
  );
  return (
    <>
      <details
        ref={details}
        className="relative"
        onKeyDown={(e) => {
          if (e.key === "Escape") details.current?.removeAttribute("open");
        }}
      >
        <summary
          className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label={`Notificações${data ? `, ${data.count} não lidas` : ""}`}
        >
          <Bell size={20} />
          {!!data?.count && (
            <span
              aria-hidden="true"
              className="absolute -top-2 -right-2 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] leading-5 font-bold text-white"
            >
              {data.count > 99 ? "99+" : data.count}
            </span>
          )}
        </summary>
        <section
          aria-label="Últimas notificações"
          className="fixed top-20 right-4 left-4 z-40 max-h-[75dvh] sm:absolute sm:top-12 sm:right-0 sm:left-auto sm:w-[min(22rem,85vw)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Notificações</h2>
            <button
              type="button"
              aria-label="Fechar notificações"
              onClick={() => details.current?.removeAttribute("open")}
            >
              <X size={16} />
            </button>
          </div>
          {error && (
            <p role="status" className="mb-3 text-sm text-amber-800">
              {error}
            </p>
          )}
          {!data && !error && (
            <p className="text-sm text-slate-500">Carregando…</p>
          )}
          {data && !data.items.length && (
            <p className="py-4 text-sm text-slate-500">
              Nenhuma notificação disponível.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {data?.items.map((n) => (
              <li key={n.id} className="py-3">
                <Link
                  href={n.href}
                  className={`block break-words text-sm ${!n.readAt ? "font-semibold" : "text-slate-600"}`}
                  onClick={() => {
                    details.current?.removeAttribute("open");
                    void mutate("read", n.id);
                  }}
                >
                  {!n.readAt && (
                    <span className="mr-1 text-brand-600" aria-label="Não lida">
                      ●
                    </span>
                  )}
                  {n.title}
                </Link>
                <p className="mt-1 text-xs text-slate-500">{n.body}</p>
              </li>
            ))}
          </ul>
          {!!data?.count && (
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-brand-600 underline"
              onClick={() => void mutate("readAll")}
            >
              Marcar todas como lidas
            </button>
          )}
          <Link
            href="/notificacoes"
            className="btn-secondary mt-4 w-full"
            onClick={() => details.current?.removeAttribute("open")}
          >
            Abrir central de notificações
          </Link>
        </section>
      </details>
      {!!alerts.length && (
        <aside
          aria-label="Alertas de sessões"
          className="fixed right-4 bottom-4 z-40 max-h-[55dvh] w-[min(26rem,calc(100vw-2rem))] space-y-3 overflow-y-auto"
        >
          {alerts.map((n) => (
            <section
              key={n.id}
              role="alert"
              className={`rounded-xl border p-4 shadow-lg ${n.stage === "DUE" ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {n.stage === "DUE"
                      ? "Sessão pública iniciada"
                      : "Sessão pública próxima"}
                  </h2>
                  <p className="mt-1 text-sm break-words">{n.title}</p>
                  <p className="mt-1 text-xs">
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(n.dueAt))}{" "}
                    · horário de Brasília
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Fechar alerta de ${n.title}`}
                  onClick={() => void mutate("dismiss", n.id)}
                >
                  <X size={18} />
                </button>
              </div>
              <Link
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold underline"
                href={n.href}
              >
                <ExternalLink size={14} />
                Abrir contratação
              </Link>
            </section>
          ))}
        </aside>
      )}
    </>
  );
}
