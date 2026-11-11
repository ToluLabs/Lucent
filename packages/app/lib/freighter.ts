/**
 * Adapts the Varial (formerly Freighter) browser wallet to the SDK's {@link Signer} interface.
 */
import type { Signer } from "@lucent/sdk";
import {
  signMessage as freighterSignMessage,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

import { DEPLOYMENT } from "./deployment";
import { errMsg } from "./err";

/**
 * Silent check (no popup): has this site already been granted access in a
 * prior session? Used to auto-reconnect on mount instead of dropping back to
 * a disconnected state on every reload — `requestAccess()` itself won't
 * prompt either once this is true, so a full silent `connectFreighter()`
 * follows safely.
 */
export async function freighterIsAllowed(): Promise<boolean> {
  try {
    const res = await isAllowed();
    return res.isAllowed === true;
  } catch {
    return false;
  }
}

/** A {@link Signer} that can also sign arbitrary UTF-8 messages (SEP-53). */
export interface MessageSigner extends Signer {
  /** Sign a message and return the raw ed25519 signature bytes. */
  signMessage(message: string): Promise<Uint8Array>;
}

export async function requireTestnet(): Promise<void> {
  const network = await getNetworkDetails();
  if (network.error || !network.networkPassphrase)
    throw new Error(
      "Could not read Varial network. Unlock your wallet and retry.",
    );
  if (network.networkPassphrase !== DEPLOYMENT.networkPassphrase)
    throw new Error(
      "Wrong network. Switch Varial to Stellar Testnet and reconnect before continuing.",
    );
}

export async function connectFreighter(): Promise<MessageSigner> {
  const conn = await isConnected();
  if (!conn.isConnected) {
    throw new Error("Varial not detected. Install the Varial extension.");
  }
  await requireTestnet();
  const access = await requestAccess();
  if (access.error) throw new Error(errMsg(access.error));
  const address = access.address;
  await requireTestnet();

  return {
    publicKey: address,
    async sign(txXdrBase64: string): Promise<string> {
      await requireTestnet();
      const res = await signTransaction(txXdrBase64, {
        networkPassphrase: DEPLOYMENT.networkPassphrase,
        address,
      });
      if (res.error) throw new Error(errMsg(res.error));
      return res.signedTxXdr;
    },
    async signMessage(message: string): Promise<Uint8Array> {
      await requireTestnet();
      const res = await freighterSignMessage(message, {
        networkPassphrase: DEPLOYMENT.networkPassphrase,
        address,
      });
      if (res.error) throw new Error(errMsg(res.error));
      if (res.signerAddress !== address) {
        throw new Error(
          `Varial signed with ${res.signerAddress}, expected ${address}`,
        );
      }
      return normalizeSignature(res.signedMessage);
    },
  };
}

/** @stellar/freighter-api v4 returns a base64 string; v3 a Buffer (structured-cloned). */
function normalizeSignature(signed: unknown): Uint8Array {
  if (typeof signed === "string") {
    return Uint8Array.from(atob(signed), (c) => c.charCodeAt(0));
  }
  if (signed instanceof Uint8Array) return new Uint8Array(signed);
  if (
    signed &&
    typeof signed === "object" &&
    Array.isArray((signed as { data?: unknown }).data)
  ) {
    return Uint8Array.from((signed as { data: number[] }).data);
  }
  throw new Error("Varial returned no usable message signature");
}
