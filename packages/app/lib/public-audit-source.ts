import { ChainClient, IndexerClient, hybridFetchEvents } from "@lucent/sdk";
import { DEPLOYMENT } from "./deployment";
/** No viewing key or decrypted audit state is accepted by this cacheable fetcher. */
export async function loadPublicAuditEvents() {
  const client = new ChainClient({
    rpcUrl: DEPLOYMENT.rpcUrl,
    networkPassphrase: DEPLOYMENT.networkPassphrase,
    contracts: DEPLOYMENT.contracts,
  });
  const indexer = DEPLOYMENT.indexerUrl
    ? new IndexerClient({ baseUrl: DEPLOYMENT.indexerUrl })
    : undefined;
  return (
    await hybridFetchEvents(client, indexer, {
      fromLedger: DEPLOYMENT.deployedAtLedger,
    })
  ).events;
}
