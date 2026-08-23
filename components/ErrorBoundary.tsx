"use client";

import { Component, type ReactNode } from "react";

/**
 * Stops one broken widget taking a whole section down with it.
 *
 * WHY THIS EXISTS: the checkout summary and the payment controls live in the
 * same box. React unmounts the entire subtree when a render throws, so a
 * payment widget failing — a provider script that did not load, an SDK that
 * changed shape — took the ORDER TOTAL off the screen with it. A buyer then
 * sees a checkout with no money on it, which is the single most alarming thing
 * a shop can show someone.
 *
 * A class component because that is the only thing React lets be an error
 * boundary; there is no hook for it.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Worth a console line: this is a real failure, just a contained one.
    console.error(`[${this.props.label ?? "ErrorBoundary"}]`, error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
