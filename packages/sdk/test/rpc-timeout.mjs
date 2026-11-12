import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ChainClient } from "../src/chain/client.ts";

const sockets = new Set();
const server = createServer(() => { /* Deliberately never send a response. */ });
server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const config = { rpcUrl: `http://127.0.0.1:${server.address().port}`, networkPassphrase: "test", contracts: { token: "unused" } };
  const client = new ChainClient({ ...config, rpcTimeoutMs: 100 });
  const start = Date.now();
  await assert.rejects(client.server.getHealth(), /timeout|timed out|abort/i);
  assert(Date.now() - start < 3000, "A stalled RPC request must terminate promptly");
  assert.equal(new ChainClient(config).server.httpClient.defaults.timeout, 30000);
  assert.throws(() => new ChainClient({ ...config, rpcTimeoutMs: 0 }), /must be positive/);
  console.log("rpc-timeout: stalled RPC aborts; default timeout and invalid configuration checks passed");
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}
