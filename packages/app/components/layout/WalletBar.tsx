"use client";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress } from "@/lib/format";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
export function WalletBar(){const {wallet,view,connecting}=useWallet();
 const status=connecting?"Connecting…":!wallet?"Wallet disconnected":!view?"Account unavailable":!view.registered?"Setup required":!view.matchesChain?"State needs attention":"Account ready";
 return <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4 md:px-8"><Link href="/" aria-label="Lucent homepage" className="flex items-center gap-2 md:hidden"><LucentLogoMark size={24}/><span className="font-semibold">Lucent</span></Link><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true"/><span className="text-xs font-medium text-text-secondary">Stellar Testnet</span><span className="hidden text-xs text-text-muted lg:inline">Experimental · test funds only</span></div><div className="flex items-center gap-3 text-xs"><span role="status" className="text-text-secondary">{status}</span>{wallet && <Link href="/profile" className="rounded-lg border border-border px-3 py-2 font-mono hover:border-border-hover">{shortAddress(wallet.address,4)}</Link>}</div></header>;
}
