import { CommandBus } from '../commands/bus';
import type { BusOptions } from '../commands/bus';
import { IndexedDBEngine } from '../data';
import type { EngineOptions, StorageEngine } from '../data';
import { uuidv7 } from '../domain/ids';
import { WorkspaceStore } from '../state/store';
import { startTabSync } from '../state/tab-sync';
import type { ChannelFactory } from '../state/tab-sync';

export interface AppOptions {
  engine?: StorageEngine;
  engineOptions?: EngineOptions;
  bus?: BusOptions;
  /** `false` desactiva la sincronización entre pestañas. */
  tabSync?: false | { channelName?: string; factory?: ChannelFactory };
}

export interface App {
  engine: StorageEngine;
  bus: CommandBus;
  store: WorkspaceStore;
  tabId: string;
  /** Abre otro espacio (carga sus cabeceras en memoria). */
  openWorkspace(id: string): Promise<void>;
  dispose(): void;
}

/**
 * Raíz de composición: une motor, bus de comandos y estado. Cada operación
 * confirmada (propia, deshacer/rehacer o remota) actualiza el estado en memoria.
 */
export async function createApp(options: AppOptions = {}): Promise<App> {
  const engine = options.engine ?? new IndexedDBEngine(options.engineOptions);
  await engine.open();
  const bus = new CommandBus(engine, options.bus);
  const store = new WorkspaceStore();
  await store.loadWorkspaces(engine);
  const tabId = uuidv7();

  const offStore = bus.subscribe((event) => store.apply(event.changes));
  const sync = options.tabSync;
  const offSync =
    sync === false ? () => {} : startTabSync(bus, tabId, sync?.channelName, sync?.factory);

  return {
    engine,
    bus,
    store,
    tabId,
    openWorkspace: (id) => store.openWorkspace(engine, id),
    dispose() {
      offStore();
      offSync();
      engine.close();
    },
  };
}
