import type { ReactNode } from "react";

/**
 * Inline SVG icon set. Nothing here depends on a web font, so every icon renders
 * and stays crisp even if the Material Symbols font is slow or blocked.
 */
type Props = { className?: string };
const base = "w-6 h-6";

// ---- Named icons used by interactive chrome (header, cart) ----
export function SearchIcon({ className = base }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
export function HeartIcon({ className = base, filled = false }: Props & { filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}
export function CartIcon({ className = base }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M2.5 3h2l2.2 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L22 7H6" />
    </svg>
  );
}
export function UserIcon({ className = base }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}
export function MenuIcon({ className = base }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
export function CloseIcon({ className = base }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
export function ChevronRightIcon({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// ---- Name-mapped icon (for data-driven + decorative icons) ----
const PATHS: Record<string, ReactNode> = {
  search: (<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  search_off: (<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="7" y1="7" x2="15" y2="15" /></>),
  favorite: (<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />),
  shopping_cart: (<><circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M2.5 3h2l2.2 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L22 7H6" /></>),
  arrow_forward: (<><line x1="4" y1="12" x2="20" y2="12" /><polyline points="14 6 20 12 14 18" /></>),
  check_circle: (<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>),
  check: (<polyline points="20 6 9 17 4 12" />),
  expand_more: (<polyline points="6 9 12 15 18 9" />),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  storefront: (<><path d="M3 9l1.2-5h15.6L21 9" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M9 20v-6h6v6" /></>),
  mark_email_read: (<><path d="M22 12.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" /><polyline points="22 6 12 13 2 6" /><polyline points="16 19 18 21 22 17" /></>),
  mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2 6 12 13 22 6" /></>),
  local_shipping: (<><rect x="1" y="6" width="13" height="10" rx="1" /><path d="M14 9h4l3 3v4h-7z" /><circle cx="5.5" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" /></>),
  menu_book: (<><path d="M12 7v13" /><path d="M4 4h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5v14h-5a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4z" /></>),
  bolt: (<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2" fill="currentColor" stroke="none" />),
  electric_bolt: (<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2" fill="currentColor" stroke="none" />),
  rebase: (<><path d="M4 12a8 8 0 0 1 13.7-5.6L21 8" /><polyline points="21 3 21 8 16 8" /><path d="M20 12a8 8 0 0 1-13.7 5.6L3 16" /><polyline points="3 21 3 16 8 16" /></>),
  architecture: (<><path d="M12 3v18" /><path d="M5 21l7-13 7 13" /><line x1="7" y1="17" x2="17" y2="17" /></>),
  article: (<><rect x="4" y="3" width="16" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></>),
  category: (<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  dashboard: (<><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>),
  inventory_2: (<><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4" /><line x1="12" y1="11" x2="12" y2="21" /></>),
  receipt_long: (<><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></>),
  payments: (<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>),
  engineering: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
  group: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6.4" /><path d="M18.5 20a6 6 0 0 0-3-5.2" /></>),
  groups: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6.4" /><path d="M18.5 20a6 6 0 0 0-3-5.2" /></>),
  call: (<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9z" />),
  pulse: (<polyline points="2 12 7 12 10 5 14 19 17 12 22 12" />),
  campaign: (<><path d="M3 10v4a1 1 0 0 0 1 1h3l7 4V5L7 9H4a1 1 0 0 0-1 1z" /><path d="M18 9a4 4 0 0 1 0 6" /></>),
  location_on: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" /></>),
  visibility: (<><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3.2" /></>),
  visibility_off: (<><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c7 0 10.5 7 10.5 7a17 17 0 0 1-3.4 4.1" /><path d="M6.3 6.3A16.7 16.7 0 0 0 1.5 12S5 19 12 19a9.7 9.7 0 0 0 4.3-1" /><path d="M9.9 9.9a3.2 3.2 0 0 0 4.4 4.4" /><line x1="3" y1="3" x2="21" y2="21" /></>),
};

export function Icon({ name, className = base }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
