"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, requestPasswordReset, type AuthState } from "./actions";
import { Icon } from "@/components/Icon";

type Mode = "login" | "register" | "reset";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  // Email is shared across modes so switching tabs never loses what was typed.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loginState, loginAction] = useActionState<AuthState, FormData>(signIn, {});
  const [registerState, registerAction] = useActionState<AuthState, FormData>(signUp, {});
  const [resetState, resetAction] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  const state =
    mode === "login" ? loginState : mode === "register" ? registerState : resetState;

  // Client-side guards so users get instant, friendly feedback before the round-trip.
  const passwordTooShort = mode === "register" && password.length > 0 && password.length < 8;
  const mismatch = mode === "register" && confirm.length > 0 && password !== confirm;
  const blockRegister = mode === "register" && (passwordTooShort || mismatch);

  const heading =
    mode === "login"
      ? "ACCESS THE GARAGE"
      : mode === "register"
        ? "JOIN THE SQUADRON"
        : "RESET ACCESS KEY";
  const sub =
    mode === "login"
      ? "Sign in to manage your fleet and performance specs."
      : mode === "register"
        ? "Establish your identity in the electric drift era."
        : "Enter your email and we'll send a secure reset link.";

  const action =
    mode === "login" ? loginAction : mode === "register" ? registerAction : resetAction;

  return (
    <div className="w-full max-w-md">
      <header className="mb-10">
        <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mb-2">
          {heading}
        </h2>
        <p className="text-on-surface-variant font-body-md">{sub}</p>
      </header>

      {mode !== "reset" && (
        <div className="flex mb-8 border-b border-outline-variant/30">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-4 font-label-bold text-label-bold tracking-widest uppercase transition-all ${
              mode === "login"
                ? "text-secondary border-b-2 border-secondary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-4 font-label-bold text-label-bold tracking-widest uppercase transition-all ${
              mode === "register"
                ? "text-secondary border-b-2 border-secondary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Register
          </button>
        </div>
      )}

      {/* key forces a fresh, uncontrolled form per mode so React never reuses
          the wrong action's inputs when switching tabs. */}
      <form key={mode} action={action} className="space-y-5">
        {mode === "register" && (
          <TextField label="Full name" name="full_name" type="text" placeholder="ALEX RIDER" required={false} />
        )}

        <TextField
          label="Commander email"
          name="email"
          type="email"
          placeholder="PILOT@EDRIFT.COM"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />

        {mode !== "reset" && (
          <PasswordField
            label="Access key"
            name="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            hint={mode === "register" ? "Minimum 8 characters" : undefined}
            error={passwordTooShort ? "Password must be at least 8 characters." : undefined}
          />
        )}

        {mode === "register" && (
          <PasswordField
            label="Confirm access key"
            name="confirm_password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            error={mismatch ? "Passwords don't match." : undefined}
          />
        )}

        {mode === "login" && (
          <div className="text-right -mt-2">
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="text-[11px] text-on-surface-variant hover:text-secondary uppercase tracking-widest font-label-bold"
            >
              Forgot access key?
            </button>
          </div>
        )}

        {state.error && (
          <p className="text-error font-label-bold text-sm uppercase tracking-wide">{state.error}</p>
        )}
        {state.message && (
          <p className="text-secondary font-label-bold text-sm">{state.message}</p>
        )}

        <SubmitGuarded
          label={
            mode === "login"
              ? "Initialize Login"
              : mode === "register"
                ? "Create Profile"
                : "Send Reset Link"
          }
          disabled={blockRegister}
        />

        {mode === "reset" && (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="w-full text-center text-on-surface-variant hover:text-secondary font-label-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Icon name="arrow_forward" className="w-4 h-4 rotate-180" />
            Back to login
          </button>
        )}
      </form>

      <p className="mt-8 text-center text-[10px] text-outline uppercase tracking-widest font-label-bold">
        © {new Date().getFullYear()} E-Drift Motors
      </p>
    </div>
  );
}

/** Submit that can be blocked by client-side validation without losing pending state. */
function SubmitGuarded({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full bg-primary-container text-white py-5 rounded-lg font-label-bold text-label-bold tracking-[0.2em] uppercase hover:bg-inverse-primary hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "…" : label}
    </button>
  );
}

function fieldWrap(children: React.ReactNode) {
  return <div className="space-y-1 group">{children}</div>;
}

function TextField({
  label,
  name,
  type,
  placeholder,
  hint,
  required = true,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  autoComplete?: string;
}) {
  return fieldWrap(
    <>
      <label className="block font-label-bold text-[11px] text-on-surface-variant tracking-wider uppercase group-focus-within:text-primary-container transition-colors">
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={254}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 text-on-surface placeholder:text-outline-variant focus:border-primary-container focus:ring-0 transition-all"
      />
      {hint && <p className="text-[10px] text-outline uppercase tracking-widest">{hint}</p>}
    </>
  );
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  hint,
  error,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return fieldWrap(
    <>
      <label className="block font-label-bold text-[11px] text-on-surface-variant tracking-wider uppercase group-focus-within:text-primary-container transition-colors">
        {label}
      </label>
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          placeholder="••••••••••••"
          autoComplete={autoComplete}
          minLength={8}
          maxLength={72}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 pr-14 text-on-surface placeholder:text-outline-variant focus:border-primary-container focus:ring-0 transition-all"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant hover:text-secondary transition-colors"
        >
          <Icon name={visible ? "visibility_off" : "visibility"} className="w-5 h-5" />
        </button>
      </div>
      {error ? (
        <p className="text-[10px] text-error uppercase tracking-widest font-label-bold">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-outline uppercase tracking-widest">{hint}</p>
      ) : null}
    </>
  );
}
