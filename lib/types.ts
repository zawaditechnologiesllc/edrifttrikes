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

/** Single-row (id = 1) company contact info shown in the footer; admin-edited. */
export type SiteSettings = {
  id: number;
  company_email: string | null;
  company_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  updated_at?: string;
};
