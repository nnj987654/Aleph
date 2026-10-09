import type { CommandBus } from '../commands/bus';
import type { RecordStore } from '../commands/changeset';
import type { Id } from '../domain/types';

interface Message {
  from: string;
  refs: Array<{ store: RecordStore; key: Id }>;
}

/** Lo mínimo que necesitamos de BroadcastChannel (permite probarlo sin navegador). */
export interface ChannelLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export type ChannelFactory = (name: string) => ChannelLike | null;

export const browserChannel: ChannelFactory = (name) =>
  typeof BroadcastChannel === 'undefined' ? null : (new BroadcastChannel(name) as unknown as ChannelLike);

/**
 * Sincroniza varias pestañas abiertas sobre la misma base: lo que confirma una
 * pestaña se avisa a las demás, que releen esos registros y actualizan su estado.
 * Los mensajes llevan solo las claves cambiadas, no los datos.
 */
export function startTabSync(
  bus: CommandBus,
  tabId: string,
  channelName = 'aleph-sync',
  factory: ChannelFactory = browserChannel,
): () => void {
  const channel = factory(channelName);
  if (!channel) return () => {};
  const off = bus.subscribe((event) => {
    if (event.origin === 'remote') return;
    const message: Message = {
      from: tabId,
      refs: event.changes.map((c) => ({ store: c.store, key: c.key })),
    };
    channel.postMessage(message);
  });
  channel.onmessage = (event) => {
    const msg = event.data as Message;
    if (!msg || msg.from === tabId || !Array.isArray(msg.refs)) return;
    void bus.ingestRemote(msg.refs);
  };
  return () => {
    off();
    channel.onmessage = null;
    channel.close();
  };
}
