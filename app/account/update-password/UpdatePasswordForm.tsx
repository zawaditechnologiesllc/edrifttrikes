"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword, type AuthState } from "@/app/login/actions";
import { Icon } from "@/components/Icon";

function Submit({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full bg-primary-container text-white py-5 rounded-lg font-label-bold text-label-bold tracking-[0.2em] uppercase hover:bg-inverse-primary hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "…" : "Set New Access Key"}
    </button>
  );
}

export default function UpdatePasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <form action={action} className="space-y-5 w-full max-w-md">
      <PasswordInput
        label="New access key"
        name="password"
        value={password}
        onChange={setPassword}
        visible={visible}
        setVisible={setVisible}
        error={tooShort ? "Password must be at least 8 characters." : undefined}
        hint="Minimum 8 characters"
      />
      <PasswordInput
        label="Confirm new access key"
        name="confirm_password"
        value={confirm}
        onChange={setConfirm}
        visible={visible}
        setVisible={setVisible}
        error={mismatch ? "Passwords don't match." : undefined}
      />

      {state.error && (
        <p className="text-error font-label-bold text-sm uppercase tracking-wide">{state.error}</p>
      )}

      <Submit disabled={tooShort || mismatch || !password} />
    </form>
  );
}

function PasswordInput({
  label,
  name,
  value,
  onChange,
  visible,
  setVisible,
  hint,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  setVisible: (fn: (v: boolean) => boolean) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1 group">
      <label className="block font-label-bold text-[11px] text-on-surface-variant tracking-wider uppercase group-focus-within:text-primary-container transition-colors">
        {label}
      </label>
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          placeholder="••••••••••••"
          autoComplete="new-password"
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
    </div>
  );
}
