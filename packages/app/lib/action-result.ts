export function transactionError(message: string): {
  uncertain: boolean;
  title: string;
  advice: string;
  hash?: string;
} {
  if (/wallet is not funded on Stellar Testnet|Account not found: G/i.test(message))
    return {
      uncertain: false,
      title: "Fund your Testnet wallet first",
      advice: "Select Testnet in Varial and fund this address with Friendbot for XLM, then retry registration. Creating a wallet alone does not create its Stellar Testnet account.",
    };
  if (/wrong network/i.test(message))
    return {
      uncertain: false,
      title: "Switch to Stellar Testnet",
      advice:
        "Select Stellar Testnet in Varial, then reconnect. This workspace does not support Mainnet.",
    };
  if (/(?:Varial|Freighter) not detected/i.test(message))
    return {
      uncertain: false,
      title: "Varial is unavailable",
      advice:
        "Install and unlock the Varial browser extension, then connect again.",
    };
  const hash = message.match(/(?:tx\s+)([a-f0-9]{64})/i)?.[1];
  if (/txTooLate|Transaction expired before submission/i.test(message))
    return {
      uncertain:false, hash,
      title:"Transaction expired",
      advice:"This attempt did not execute the payment. Refresh your account, prepare it again and approve the new wallet request. Lucent will not resend automatically.",
    };
  const uncertain =
    /timed? ?out|timeout|confirmation.*unknown|fetch failed|failed to fetch|network.*error|load failed/i.test(
      message,
    );
  if (uncertain)
    return {
      uncertain: true,
      hash,
      title: "Confirmation unavailable",
      advice:
        "This operation may have reached the network. Check activity and refresh account state before submitting again. A timeout does not establish failure.",
    };
  if (/\(code -4\)/i.test(message))
    return {
      uncertain: false,
      hash,
      title: "Wallet signature not received",
      advice:
        "Varial reported a rejected request. If you approved it, the approval did not return a signed transaction to Lucent. Check the wallet popup and retry when ready; Lucent will not retry automatically.",
    };
  if (
    /reject|denied|declin|cancel/i.test(message) &&
    !/send .*rejected|txSoroban/i.test(message)
  )
    return {
      uncertain: false,
      hash,
      title: "Wallet approval declined",
      advice: "Your inputs are saved. Review them and try again when ready.",
    };
  if (/not registered/i.test(message))
    return {
      uncertain: false,
      hash,
      title: "Recipient is not registered",
      advice:
        "Ask the recipient to connect to Lucent and register on Stellar Testnet.",
    };
  if (/scecExceededLimit|resources? exceed.*limit|single archived entry exceeds/i.test(message))
    return {
      uncertain: false,
      hash,
      title: "Stellar resource limit exceeded",
      advice: /restore|archived/i.test(message)
        ? "Stellar rejected restoration of archived contract data. The requested action did not execute. Restoring the data may require separate wallet approvals; changing the payment amount does not resolve this restoration limit."
        : "Stellar rejected this transaction because it exceeds a network resource limit. Your inputs are saved; check the technical details before retrying.",
    };
  if (/exceed|insufficient/i.test(message))
    return {
      uncertain: false,
      hash,
      title: "Transaction could not proceed",
      advice:
        "Check your available balance and the network resource limits. Your inputs are saved.",
    };
  return {
    uncertain: false,
    hash,
    title: "Action could not be completed",
    advice:
      "Review the details below. Your inputs are saved; correct the issue before retrying.",
  };
}
