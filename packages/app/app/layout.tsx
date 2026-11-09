import { Analytics } from "@/components/analytics/Analytics";
import { ActionProvider } from "@/lib/action-context";
import { WalletProvider } from "@/lib/wallet-context";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucent — Confidential payments on Stellar",
  description:
    "Test confidential USDC transfers and payroll on Stellar Testnet. Participants and metadata remain public. Experimental, unaudited software; use test funds only.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101215",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-void font-sans text-text-primary antialiased">
        <Analytics />
        <WalletProvider>
          <ActionProvider>{children}</ActionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
