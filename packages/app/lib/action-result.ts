export function transactionError(message: string): {
  uncertain: boolean;
  title: string;
  advice: string;
  hash?: string;
} {
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
