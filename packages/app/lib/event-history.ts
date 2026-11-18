import { dedupeById, type ConfidentialEvent } from "@lucent/sdk";
/** Public ciphertext events only. Failed/incomplete tails never replace a durable in-memory cursor. */
export class EventHistory {
  private history: { events: ConfidentialEvent[]; cursor?: string } | null =
    null;
  private pending: Promise<ConfidentialEvent[]> | null = null;
  constructor(
    private load: (
      cursor?: string,
    ) => Promise<{ events: ConfidentialEvent[]; cursor?: string }>,
  ) {}
  read(): Promise<ConfidentialEvent[]> {
    if (this.pending) return this.pending;
    this.pending = this.load(this.history?.cursor)
      .then((result) => {
        const events = dedupeById([
          ...(this.history?.events ?? []),
          ...result.events,
        ]);
        this.history = {
          events,
          cursor: result.cursor ?? this.history?.cursor,
        };
        return events;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }
}
