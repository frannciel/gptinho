"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      } else
        setError(
          "Não foi possível entrar. Confira seus dados ou aguarde 15 minutos se houve várias tentativas.",
        );
    } catch {
      setError("Serviço indisponível. Tente novamente em instantes.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      method="post"
      action="/api/auth/callback/credentials"
      onSubmit={submit}
      className="mt-8 space-y-5"
    >
      <div>
        <label htmlFor="email" className="label">
          E-mail corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          className="field"
          placeholder="seu.nome@govnex.com.br"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={128}
            className="field pr-12"
          />
          <button
            type="button"
            className="absolute top-0 right-0 flex h-full w-12 items-center justify-center text-slate-500"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <button disabled={pending} className="btn w-full py-3">
        {pending ? <LoaderCircle size={18} className="animate-spin" /> : null}
        {pending ? "Entrando…" : "Entrar no sistema"}
        <ArrowRight size={17} />
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">
        Acesso exclusivo para usuários autorizados.
        <br />
        Para recuperar o acesso, contate o administrador.
      </p>
    </form>
  );
}
