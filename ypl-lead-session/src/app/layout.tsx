import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YPL Lead Session",
  description: "HBS YPL Week 2 Lead Session: share needs, offer leads, follow up.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#a51c30" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
