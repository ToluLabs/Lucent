import type { Signer } from "@lucent/sdk";
/** Disconnect can stop a prepared/signed transaction before the SDK submits it. */
export function sessionSigner(delegate: Signer) {
  let closed = false;
  const check = () => {
    if (closed)
      throw new Error(
        "Wallet session ended; transaction was not submitted. Reconnect before signing.",
      );
  };
  return {
    close: () => {
      closed = true;
    },
    signer: {
      publicKey: delegate.publicKey,
      async sign(xdr: string) {
        check();
        const signed = await delegate.sign(xdr);
        check();
        return signed;
      },
    } satisfies Signer,
  };
}
