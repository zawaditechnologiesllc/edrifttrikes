import type { Metadata, Viewport } from "next";
import "./globals.css";
import Enhancements from "@/components/Enhancements";
import PublicEnvScript from "@/components/PublicEnvScript";
import SiteSettingsProvider from "@/components/storefront/SiteSettingsProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import { getSiteSettings } from "@/lib/db";

export const metadata: Metadata = {
  title: {
    default: "E-Drift Trikes — Engineered for Chaos",
    template: "%s · E-Drift Trikes",
  },
  description:
    "The frontier of electric street motorsport. Precision torque meets lateral freedom — the world's most advanced electric drift trikes, parts, and gear.",
  keywords: [
    "electric drift trike",
    "e-drift",
    "drift trike",
    "voltage drift",
    "performance parts",
  ],
  openGraph: {
    title: "E-Drift Trikes — Engineered for Chaos",
    description:
      "The frontier of electric street motorsport. Built for the adrenaline-fueled expert.",
    type: "website",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/assets/edrift-logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#131316",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface font-body-md antialiased overflow-x-hidden">
        <PublicEnvScript />
        <SiteSettingsProvider settings={settings}>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </SiteSettingsProvider>
        <Enhancements />
      </body>
    </html>
  );
}
