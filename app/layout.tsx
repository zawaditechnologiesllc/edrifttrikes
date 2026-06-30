import type { Metadata, Viewport } from "next";
import "./globals.css";
import Enhancements from "@/components/Enhancements";
import { CartProvider } from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";

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
};

export const viewport: Viewport = {
  themeColor: "#131316",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface font-body-md antialiased overflow-x-hidden">
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
        <Enhancements />
      </body>
    </html>
  );
}
