"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { cn } from "@/lib/utils";

export function LoginForm({
  revealed,
  className,
}: {
  revealed?: boolean;
  className?: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const identifierRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { locale, messages } = useI18n();
  const resetSubject = encodeURIComponent(messages.login.forgotPasswordSubject);

  useEffect(() => {
    if (!revealed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      identifierRef.current?.focus();
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [revealed]);

  async function handleSubmit(formData: FormData) {
    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    setPending(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        identifier,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(messages.login.invalidCredentials);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(messages.login.invalidCredentials);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={cn("space-y-5", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(new FormData(event.currentTarget));
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#d8d0c1]" htmlFor="identifier">
          {messages.login.emailLabel}
        </label>
        <Input
          ref={identifierRef}
          id="identifier"
          name="identifier"
          placeholder={messages.login.emailPlaceholder}
          required
          autoComplete="username"
          aria-invalid={Boolean(error)}
          onBlur={(event) => {
            event.currentTarget.value = event.currentTarget.value.trim();
          }}
          className="h-12 rounded-2xl border border-white/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] px-4 text-base text-[#111111] placeholder:text-[#6f6a62] focus:border-white/28 focus:bg-[linear-gradient(90deg,rgba(255,255,255,0.16),rgba(255,255,255,0.07))] focus:ring-white/10"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#d8d0c1]" htmlFor="password">
          {messages.login.passwordLabel}
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={messages.login.passwordPlaceholder}
            required
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            onBlur={(event) => {
              event.currentTarget.value = event.currentTarget.value.trim();
            }}
            className="h-12 rounded-2xl border border-white/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] px-4 pr-12 text-base text-[#111111] placeholder:text-[#6f6a62] focus:border-white/28 focus:bg-[linear-gradient(90deg,rgba(255,255,255,0.16),rgba(255,255,255,0.07))] focus:ring-white/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#a59b8c] transition hover:text-[#e6ddcf]"
            aria-label={showPassword ? messages.login.hidePassword : messages.login.showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <label className="flex items-center gap-3 text-[#a89f92]">
          <input
            type="checkbox"
            name="rememberMe"
            className="h-4 w-4 rounded border-white/20 bg-[#0f1013] text-[#d9b65f] focus:ring-[#d9b65f]/25"
          />
          {messages.login.rememberMe}
        </label>
        <Link
          href={`mailto:admin@techscore.local?subject=${resetSubject}`}
          className="font-medium text-[#d9caa0] transition hover:text-[#f1e5bf]"
        >
          {messages.login.forgotPassword}
        </Link>
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}
      <Button
        type="submit"
        className="h-12 w-full rounded-2xl border border-[#f5e8b7]/30 bg-[linear-gradient(135deg,#f8ebbb_0%,#dfbf6b_34%,#fff2c6_52%,#d4a74c_100%)] text-[#2c2413] shadow-[0_10px_30px_rgba(217,182,95,0.2)] hover:brightness-105 disabled:bg-slate-700 disabled:text-slate-300"
        disabled={pending}
      >
        <span className="inline-flex items-center gap-2">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {pending ? messages.login.signingIn : messages.login.signIn}
        </span>
      </Button>
    </form>
  );
}
