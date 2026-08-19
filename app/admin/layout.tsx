import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/db";
import { supabaseConfigured, createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Admin" };

/**
 * Count of contact messages nobody has answered yet, shown as a badge on the
 * Messages nav item. Best-effort: a missing table (migration 0002/0007 not run)
 * must not take down every admin page, so failures degrade to no badge.
 */
async function unreadMessageCount(): Promise<number> {
  if (!adminConfigured()) return 0;
  try {
    const { count, error } = await createAdminClient()
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("handled", false);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

const NAV = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/products", label: "Products", icon: "inventory_2" },
  { href: "/admin/orders", label: "Orders", icon: "receipt_long" },
  { href: "/admin/orders/paid", label: "Paid orders", icon: "payments" },
  { href: "/admin/messages", label: "Messages", icon: "mail", badge: true },
  { href: "/admin/categories", label: "Categories", icon: "category" },
  { href: "/admin/articles", label: "Tech Lab", icon: "article" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
  { href: "/admin/status", label: "System", icon: "pulse" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured()) {
    return (
      <div className="min-h-screen bg-surface-container-lowest text-on-surface flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-white uppercase">Admin needs Supabase</h1>
          <p className="text-on-surface-variant mt-3 max-w-md">
            Add your Supabase env vars and set your profile <code className="text-secondary">role = &apos;admin&apos;</code> to access the dashboard.
          </p>
        </div>
      </div>
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/account");

  const unread = await unreadMessageCount();

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface flex">
      <aside className="w-64 shrink-0 border-r border-white/10 bg-surface-container-low hidden md:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="font-headline-md text-headline-md text-secondary tracking-tighter">E-DRIFT</Link>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1 font-label-bold">Control Room</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 px-4 py-3 rounded text-on-surface-variant hover:bg-white/5 hover:text-white font-label-bold text-sm uppercase tracking-widest transition-colors"
            >
              <Icon name={n.icon} className="w-5 h-5" />
              <span className="flex-1">{n.label}</span>
              {n.badge && unread > 0 && (
                <span className="rounded-full bg-secondary text-on-secondary-fixed px-2 py-0.5 text-[10px] leading-none">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <Link href="/" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-white text-sm font-label-bold uppercase tracking-widest">
            <Icon name="storefront" className="w-5 h-5" /> View store
          </Link>
          <form action={signOut}>
            <button className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-error text-sm font-label-bold uppercase tracking-widest w-full">
              <Icon name="logout" className="w-5 h-5" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
