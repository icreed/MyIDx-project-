import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyIDx — Your identity, your control",
  description: "Verify once, reuse everywhere. Your identity vault on MyIDx.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            MyIDx
          </a>
          <nav>
            <a href="/vault">Vault</a>
            <a href="/connections">Connections</a>
            <a href="/activity">Activity</a>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
