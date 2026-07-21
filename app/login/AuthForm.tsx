"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, type AuthState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-primary-container text-white py-5 rounded-lg font-label-bold text-label-bold tracking-[0.2em] uppercase hover:bg-inverse-primary hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginState, loginAction] = useActionState<AuthState, FormData>(signIn, {});
  const [registerState, registerAction] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "login" ? loginState : registerState;

  return (
    <div className="w-full max-w-md">
      <header className="mb-10">
        <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mb-2">
          {mode === "login" ? "ACCESS THE GARAGE" : "JOIN THE SQUADRON"}
        </h2>
        <p className="text-on-surface-variant font-body-md">
          {mode === "login"
            ? "Sign in to manage your fleet and performance specs."
            : "Establish your identity in the electric drift era."}
        </p>
      </header>

      <div className="flex mb-8 border-b border-outline-variant/30">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 py-4 font-label-bold text-label-bold tracking-widest uppercase transition-all ${
            mode === "login" ? "text-secondary border-b-2 border-secondary" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => setMode("register")}
          className={`flex-1 py-4 font-label-bold text-label-bold tracking-widest uppercase transition-all ${
            mode === "register" ? "text-secondary border-b-2 border-secondary" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Register
        </button>
      </div>

      <form action={mode === "login" ? loginAction : registerAction} className="space-y-5">
        {mode === "register" && (
          <Field label="Full name" name="full_name" type="text" placeholder="ALEX RIDER" required={false} />
        )}
        <Field label="Commander email" name="email" type="email" placeholder="PILOT@EDRIFT.COM" />
        <Field
          label="Access key"
          name="password"
          type="password"
          placeholder="••••••••••••"
          hint={mode === "register" ? "Minimum 8 characters" : undefined}
        />

        {state.error && (
          <p className="text-error font-label-bold text-sm uppercase tracking-wide">{state.error}</p>
        )}
        {state.message && (
          <p className="text-secondary font-label-bold text-sm">{state.message}</p>
        )}

        <Submit label={mode === "login" ? "Initialize Login" : "Create Profile"} />
      </form>

      <p className="mt-8 text-center text-[10px] text-outline uppercase tracking-widest font-label-bold">
        © {new Date().getFullYear()} E-Drift Motors
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  hint,
  required = true,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1 group">
      <label className="block font-label-bold text-[11px] text-on-surface-variant tracking-wider uppercase group-focus-within:text-primary-container transition-colors">
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 text-on-surface placeholder:text-outline-variant focus:border-primary-container focus:ring-0 transition-all"
      />
      {hint && <p className="text-[10px] text-outline uppercase tracking-widest">{hint}</p>}
    </div>
  );
}
