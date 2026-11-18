/** Bounded RPC fan-out; retain input order and propagate every failure. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  load: (item: T) => Promise<R>,
  limit = 4,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Invalid concurrency");
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        result[index] = await load(items[index]);
      }
    }),
  );
  return result;
}
export function contractIds(count: bigint): bigint[] {
  if (count > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(
      "Contract registry exceeds client enumeration capacity; use an indexer",
    );
  return Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
}
