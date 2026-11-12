import { EscrowState, type EscrowInfo } from "@lucent/sdk";

/** Participants can be the same wallet; the settlement state determines the branch. */
export function escrowTransferDescription(
  escrow: EscrowInfo,
  me: string,
  received: boolean,
): { label: string; tone: "warning" | "success" } {
  if (!received) return { label: "Escrow funded", tone: "warning" };
  if (escrow.state === EscrowState.Released && escrow.recipient === me) {
    return { label: "Escrow released to you", tone: "success" };
  }
  if (escrow.state === EscrowState.Refunded && escrow.depositor === me) {
    return { label: "Escrow refunded to you", tone: "warning" };
  }
  return { label: "Received from escrow", tone: "success" };
}
