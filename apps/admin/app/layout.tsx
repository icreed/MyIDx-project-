import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyIDx Admin",
  description: "Operate MyIDx: markets, pricing, merchant review, audit.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            MyIDx <span className="muted">Admin</span>
          </a>
          <nav>
            <a href="/countries">Markets</a>
            <a href="/pricing">Pricing</a>
            <a href="/merchants">Merchants</a>
            <a href="/audit">Audit</a>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
