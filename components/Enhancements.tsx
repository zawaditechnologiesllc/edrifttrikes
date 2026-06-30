"use client";

import { useEffect } from "react";

/**
 * Progressive-enhancement layer for the Stitch-exported screens.
 *
 * The original Stitch HTML used inline `onclick` handlers and per-page <script>
 * blocks. Those were rewritten during conversion into declarative `data-*`
 * hooks; this single delegated listener restores the behaviour app-wide:
 *
 *   data-accordion="<id>|self"   toggle an accordion panel
 *   data-show / data-hide        add/remove `hidden` on #<id> (overlays, drawers)
 *   data-toggle-hidden="<id>"    toggle `hidden` on #<id>
 *   data-step="up|down"          quantity stepper on the adjacent number input
 *   data-remove-closest="group"  remove the closest `.group` ancestor (cart/wishlist)
 *   data-history-back            window.history.back()
 *
 * Plus the sticky-nav "tighten on scroll" effect.
 */
export default function Enhancements() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const start = e.target as HTMLElement | null;
      if (!start) return;

      // accordion
      const acc = start.closest<HTMLElement>("[data-accordion]");
      if (acc) {
        const val = acc.getAttribute("data-accordion") || "";
        const target =
          val === "self"
            ? acc.closest<HTMLElement>(".accordion-item") ||
              acc.parentElement ||
              acc
            : document.getElementById(val);
        if (target) {
          ["accordion-open", "accordion-active", "active"].forEach((c) =>
            target.classList.toggle(c)
          );
        }
        return;
      }

      // auth login / register tabs (mirrors the export's switchTab)
      const authTab = start.closest<HTMLElement>("#tab-login, #tab-register");
      if (authTab) {
        const mode = authTab.id === "tab-register" ? "register" : "login";
        const loginBtn = document.getElementById("tab-login");
        const registerBtn = document.getElementById("tab-register");
        const submitBtn = document.querySelector<HTMLElement>(
          '#auth-form button[type="submit"]'
        );
        const h2 = document.querySelector<HTMLElement>("header h2");
        const p = document.querySelector<HTMLElement>("header p");
        const on = ["text-secondary", "border-secondary"];
        const off = ["text-on-surface-variant"];
        const active = mode === "register" ? registerBtn : loginBtn;
        const inactive = mode === "register" ? loginBtn : registerBtn;
        active?.classList.add(...on);
        active?.classList.remove(...off);
        inactive?.classList.remove(...on);
        inactive?.classList.add(...off);
        if (submitBtn)
          submitBtn.innerText =
            mode === "register" ? "CREATE PROFILE" : "INITIALIZE LOGIN";
        if (h2)
          h2.innerText =
            mode === "register" ? "JOIN THE SQUADRON" : "ACCESS THE GARAGE";
        if (p)
          p.innerText =
            mode === "register"
              ? "Establish your identity in the electric drift era."
              : "Sign in to manage your fleet and performance specs.";
        return;
      }

      // nav icon buttons (cart / account / wishlist / search)
      const nav = start.closest<HTMLElement>("[data-nav]");
      if (nav) {
        const href = nav.getAttribute("data-nav");
        if (href) window.location.assign(href);
        return;
      }

      // show / hide / toggle overlays & drawers
      const show = start.closest<HTMLElement>("[data-show]");
      if (show) {
        document
          .getElementById(show.getAttribute("data-show")!)
          ?.classList.remove("hidden");
        return;
      }
      const hide = start.closest<HTMLElement>("[data-hide]");
      if (hide) {
        document
          .getElementById(hide.getAttribute("data-hide")!)
          ?.classList.add("hidden");
        return;
      }
      const tgl = start.closest<HTMLElement>("[data-toggle-hidden]");
      if (tgl) {
        document
          .getElementById(tgl.getAttribute("data-toggle-hidden")!)
          ?.classList.toggle("hidden");
        return;
      }

      // quantity stepper
      const step = start.closest<HTMLElement>("[data-step]");
      if (step) {
        const dir = step.getAttribute("data-step");
        const sibling =
          dir === "down"
            ? (step.nextElementSibling as HTMLInputElement | null)
            : (step.previousElementSibling as HTMLInputElement | null);
        const input =
          sibling && sibling.tagName === "INPUT"
            ? sibling
            : step.parentElement?.querySelector<HTMLInputElement>(
                'input[type="number"]'
              );
        if (input) {
          if (dir === "down") input.stepDown();
          else input.stepUp();
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }

      // remove closest (cart / wishlist line items)
      const rm = start.closest<HTMLElement>("[data-remove-closest]");
      if (rm) {
        rm.closest<HTMLElement>(
          "." + rm.getAttribute("data-remove-closest")
        )?.remove();
        return;
      }

      // history back
      if (start.closest("[data-history-back]")) {
        window.history.back();
      }
    };

    const nav = document.querySelector("nav");
    const onScroll = () => {
      if (!nav) return;
      nav.classList.toggle("scrolled-nav", window.scrollY > 50);
    };

    // Guarantee no broken-image icons: any <img> that fails falls back to the
    // branded placeholder.
    const FALLBACK = "/assets/placeholder.svg";
    const onImgError = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName === "IMG" && !img.src.endsWith(FALLBACK)) {
        img.src = FALLBACK;
      }
    };

    document.addEventListener("click", onClick);
    document.addEventListener("error", onImgError, true); // capture phase for <img>
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("error", onImgError, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
