"use client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { DEPLOYMENT } from "./deployment";
import type { ConfidentialWallet } from "./wallet";

export type PublicResource =
  | "activity"
  | "payroll"
  | "escrows"
  | "escrow"
  | "recipient"
  | "public-balance";
// Include every configured collaborator and event source, not just a wallet address.
export function publicScope(address: string) {
  return [
    "lucent-public",
    DEPLOYMENT.networkPassphrase,
    DEPLOYMENT.rpcUrl,
    JSON.stringify([
      DEPLOYMENT.contracts,
      DEPLOYMENT.legacyEscrowFactories,
      DEPLOYMENT.indexerUrl,
    ]),
    address,
  ] as const;
}
export function createPublicQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        structuralSharing: false, // Public SDK data includes bigint/curve points.
      },
    },
  });
}
export function PublicQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createPublicQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
/** Memory-only, public chain data. Never pass decrypted balances/openings or keys here. */
export function usePublicQuery<T>(
  wallet: ConfidentialWallet | null,
  resource: PublicResource,
  id: string,
  load: () => Promise<T>,
  enabled = true,
) {
  return useQuery({
    queryKey: [...publicScope(wallet?.address ?? "disconnected"), resource, id],
    queryFn: load,
    enabled: !!wallet && enabled,
    staleTime: resource === "recipient" ? 10_000 : 30_000,
  });
}
