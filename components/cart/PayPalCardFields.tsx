"use client";

import { useEffect, useRef, useState } from "react";

/**
 * PayPal Advanced Card Fields — inline card inputs rendered ON the checkout page
 * (no redirect, no "create a PayPal account" prompt). Opt-in via
 * NEXT_PUBLIC_PAYPAL_CARD_FIELDS=1 and only shown when the PayPal account is
 * eligible for Advanced Card Payments; otherwise it renders nothing and the
 * caller's PayPal redirect button remains as the fallback.
 *
 * Flow: submit() → SDK calls createOrder (our /api/checkout, method paypal) →
 * PayPal validates the card (incl. 3-D Secure) → onApprove → POST
 * /api/paypal/capture → receipt.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Payload = {
  email: string;
  shipping: Record<string, string>;
  items: { productId: string; qty: number }[];
};

const fieldBox =
  "bg-surface-container-highest border border-white/10 rounded px-3 min-h-[52px] flex items-center";
const fieldLabel =
  "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

export default function PayPalCardFields({
  getPayload,
  validate,
  amountLabel,
  onPaid,
}: {
  getPayload: () => Payload;
  validate: () => string | null;
  amountLabel: string;
  onPaid: (orderNumber: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [eligible, setEligible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardRef = useRef<any>(null);
  const getPayloadRef = useRef(getPayload);
  const validateRef = useRef(validate);
  const onPaidRef = useRef(onPaid);
  getPayloadRef.current = getPayload;
  validateRef.current = validate;
  onPaidRef.current = onPaid;

  const clientId =
    typeof window !== "undefined"
      ? (window as any).__EDRIFT_ENV?.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
        process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
        ""
      : "";

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const init = () => {
      const paypal = (window as any).paypal;
      if (cancelled || !paypal?.CardFields) return;
      try {
        const cardField = paypal.CardFields({
          createOrder: async () => {
            const v = validateRef.current();
            if (v) throw new Error(v);
            const p = getPayloadRef.current();
            const res = await fetch("/api/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...p, method: "paypal" }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.id) throw new Error(data.error || "Could not start payment.");
            return data.id as string;
          },
          onApprove: async (data: { orderID: string }) => {
            const res = await fetch("/api/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderID: data.orderID }),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok || !out.ok) throw new Error(out.error || "Payment could not be completed.");
            onPaidRef.current(out.orderNumber);
          },
          onError: (err: unknown) => {
            setLoading(false);
            setError("Card payment failed. Check your card details and try again.");
            console.error("[paypal card-fields]", err);
          },
          style: { input: { "font-size": "16px", color: "#ffffff" } },
        });

        if (!cardField.isEligible()) {
          setEligible(false);
          setReady(true);
          return;
        }
        cardField.NumberField().render("#pp-card-number");
        cardField.ExpiryField().render("#pp-card-expiry");
        cardField.CVVField().render("#pp-card-cvv");
        cardRef.current = cardField;
        setReady(true);
      } catch (e) {
        console.error("[paypal card-fields] init failed", e);
        setEligible(false);
        setReady(true);
      }
    };

    if ((window as any).paypal?.CardFields) {
      init();
      return;
    }
    const selector = 'script[data-pp-sdk="1"]';
    const existing = document.querySelector<HTMLScriptElement>(selector);
    if (existing) {
      existing.addEventListener("load", init);
      return () => existing.removeEventListener("load", init);
    }
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&components=card-fields&intent=capture&currency=USD`;
    s.async = true;
    s.dataset.ppSdk = "1";
    s.onload = init;
    s.onerror = () => {
      setEligible(false);
      setReady(true);
    };
    document.body.appendChild(s);
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // No client id, or the account can't do inline cards → render nothing so the
  // caller's redirect fallback shows instead.
  if (!clientId || (ready && !eligible)) return null;

  const pay = async () => {
    setError(null);
    const v = validateRef.current();
    if (v) {
      setError(v);
      return;
    }
    if (!cardRef.current) return;
    setLoading(true);
    try {
      await cardRef.current.submit();
      // onApprove handles success + redirect; leave the spinner running.
    } catch (e) {
      setLoading(false);
      setError("Card payment failed. Check your card details and try again.");
      console.error("[paypal card-fields] submit", e);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={fieldLabel}>Card number</label>
        <div id="pp-card-number" className={fieldBox} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel}>Expiry</label>
          <div id="pp-card-expiry" className={fieldBox} />
        </div>
        <div>
          <label className={fieldLabel}>CVV</label>
          <div id="pp-card-cvv" className={fieldBox} />
        </div>
      </div>
      {error && (
        <p className="bg-error-container/30 border border-error/40 text-error-container px-4 py-3 rounded font-label-bold uppercase tracking-widest text-xs">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={loading || !ready}
        className="w-full bg-primary-container text-white py-5 rounded-lg font-label-bold uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing…" : `Pay ${amountLabel} by card`}
      </button>
      <p className="text-center text-[10px] text-outline uppercase tracking-widest">
        Encrypted · Card processed securely by PayPal
      </p>
    </div>
  );
}
