import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyIDx for Business",
  description: "Verify customers with MyIDx. KYC and KYB across every market you serve.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            MyIDx <span className="muted">for Business</span>
          </a>
          <nav>
            <a href="/verifications">Verifications</a>
            <a href="/clients">API clients</a>
            <a href="/billing">Billing</a>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
