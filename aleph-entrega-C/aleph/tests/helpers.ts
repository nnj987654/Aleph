import 'fake-indexeddb/auto';
import { createApp } from '../src/app/app';
import type { App, AppOptions } from '../src/app/app';
import { commands } from '../src/commands';
import { nodeRepo, contentRepo, workspaceRepo } from '../src/data';
import type { NodeHeader } from '../src/domain/types';
import { checkTreeInvariants } from '../src/domain/tree';

let counter = 0;
export const uniqueDb = (): string => `aleph-cmd-${Date.now()}-${(counter += 1)}`;

/** Reloj de pruebas que avanza `step` ms cada vez que se lee. */
export function fakeClock(start = 1_800_000_000_000, step = 10): () => number {
  let t = start;
  return () => (t += step);
}

export async function makeApp(options: AppOptions & { dbName?: string } = {}): Promise<App> {
  const { dbName, ...rest } = options;
  return createApp({
    engineOptions: { name: dbName ?? uniqueDb() },
    bus: { clock: fakeClock() },
    tabSync: false,
    ...rest,
  });
}

export async function makeWorkspace(app: App, name = 'Estudios') {
  const ws = await app.bus.execute(commands.createWorkspaceCmd({ name }));
  await app.openWorkspace(ws.id);
  return ws;
}

/** Cabeceras tal y como están en la base de datos. */
export async function dbNodes(app: App, workspaceId: string): Promise<NodeHeader[]> {
  return app.engine.transaction(['nodes'], 'r', (tx) =>
    nodeRepo.listByWorkspace(tx, workspaceId, { includeDeleted: true }),
  );
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);

/** Comprueba que el estado en memoria es idéntico a la base y que el árbol es sano. */
export async function expectConsistent(app: App, workspaceId: string): Promise<void> {
  const db = (await dbNodes(app, workspaceId)).sort(byId);
  const mem = [...app.store.allNodes()].sort(byId);
  if (JSON.stringify(mem) !== JSON.stringify(db)) {
    throw new Error(`El estado en memoria difiere de la base (memoria ${mem.length}, base ${db.length}).`);
  }
  const issues = checkTreeInvariants(db);
  if (issues.length) throw new Error(`Invariantes rotas: ${JSON.stringify(issues.slice(0, 3))}`);
  // Cada página viva tiene contenido; ningún contenido huérfano.
  await app.engine.transaction(['contents', 'workspaces'], 'r', async (tx) => {
    for (const n of db) {
      if (n.type === 'page' && !(await contentRepo.get(tx, n.id))) {
        throw new Error(`Falta el contenido de ${n.id}`);
      }
    }
    if (!(await workspaceRepo.get(tx, workspaceId))) throw new Error('Falta el espacio');
  });
}

export const titles = (list: readonly NodeHeader[]): string[] => list.map((n) => n.title);
