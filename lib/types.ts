import type { FulfillmentStage } from "@/lib/fulfillment";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  position: number;
};

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  position: number;
};

export type ProductSpec = {
  id: string;
  product_id: string;
  label: string;
  value: string;
  position: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  category_id: string | null;
  power: "electric" | "gas" | "gravity" | "na";
  skill_level: string | null;
  top_speed: string | null;
  range_miles: string | null;
  stock: number;
  status: "draft" | "active" | "archived";
  is_new: boolean;
  featured: boolean;
  /** Per-product flat shipping fee; null/undefined = store default fee. */
  shipping_cents?: number | null;
  /** Ships free — the product page shows the normal fee crossed out. */
  free_shipping?: boolean;
  badge: string | null;
  hero_image: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  images?: ProductImage[];
  specs?: ProductSpec[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  slug: string | null;
  price_cents: number;
  qty: number;
  image_url: string | null;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string;
  status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  shipping_address: Record<string, unknown> | null;
  stripe_session_id: string | null;
  /** When payment actually cleared — the anchor for the delivery schedule. */
  paid_at?: string | null;
  /** Where the order is in the delivery journey (see lib/fulfillment.ts). */
  fulfillment_stage?: FulfillmentStage;
  stage_updated_at?: string | null;
  /** Date the customer is told to expect the package. */
  estimated_delivery_at?: string | null;
  tracking_number?: string | null;
  courier?: string | null;
  /** Timeline rows, newest last. Loaded on the account + confirmation pages. */
  events?: OrderEvent[];
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  category: string | null;
  author: string | null;
  read_minutes: number | null;
  published: boolean;
  published_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "customer" | "admin";
  created_at: string;
};

/** Single-row (id = 1) admin-edited settings: footer contact info + shipping. */
export type SiteSettings = {
  id: number;
  company_email: string | null;
  company_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  /** Flat shipping fee applied to every order (constant, admin-set). */
  shipping_cents?: number;
  /** When true every order ships free, ignoring shipping_cents. */
  free_shipping?: boolean;
  /** Sales tax in basis points (800 = 8.00%). Integer math, no float drift. */
  tax_rate_bps?: number;
  updated_at?: string;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  stage: FulfillmentStage;
  title: string;
  detail: string | null;
  email_sent: boolean;
  created_at: string;
};
