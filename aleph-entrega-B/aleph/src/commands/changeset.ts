import { nodeRepo, contentRepo, workspaceRepo } from '../data';
import type { Tx } from '../data';
import { AlephError, NotFoundError } from '../errors';
import type { Id, NodeContent, NodeHeader, Workspace } from '../domain/types';

/** Almacenes que modifican los comandos. */
export type RecordStore = 'nodes' | 'contents' | 'workspaces';
export const RECORD_STORES: readonly RecordStore[] = ['nodes', 'contents', 'workspaces'];
export type AnyRecord = NodeHeader | NodeContent | Workspace;

/**
 * Cambio de un registro: imagen anterior y posterior (`undefined` = no existe).
 * Deshacer y rehacer son simétricos: escribir la imagen contraria.
 * En cambios remotos `prev` se desconoce (undefined).
 */
export interface Change {
  store: RecordStore;
  key: Id;
  prev: AnyRecord | undefined;
  next: AnyRecord | undefined;
}

/** Se intentó deshacer/rehacer algo que otra pestaña ha modificado después. */
export class StaleHistoryError extends AlephError {
  constructor() {
    super('stale-history', 'El registro cambió desde que se hizo la operación.');
  }
}

export function sameState(a: AnyRecord | undefined, b: AnyRecord | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.rev === b.rev;
}

function recordKey(store: RecordStore, key: Id): string {
  return `${store}\u0000${key}`;
}

/** Elimina claves con valor `undefined` (los campos opcionales se quitan, no se guardan vacíos). */
function clean<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

/**
 * Transacción de comandos: lee y escribe nodos, contenidos y espacios y anota
 * automáticamente cada cambio. Los comandos NO tocan el motor directamente, así
 * que todo lo que hacen es deshacible y se comunica al resto de la aplicación.
 */
export class CommandTx {
  private readonly rec = new Map<string, Change>();

  constructor(
    private readonly raw: Tx,
    readonly now: number,
  ) {}

  // ---- Lectura -----------------------------------------------------------
  getNode(id: Id): Promise<NodeHeader | undefined> {
    return nodeRepo.get(this.raw, id);
  }
  async requireNode(id: Id): Promise<NodeHeader> {
    const n = await this.getNode(id);
    if (!n) throw new NotFoundError('el nodo', id);
    return n;
  }
  getContent(id: Id): Promise<NodeContent | undefined> {
    return contentRepo.get(this.raw, id);
  }
  getWorkspace(id: Id): Promise<Workspace | undefined> {
    return workspaceRepo.get(this.raw, id);
  }
  listWorkspaces(): Promise<Workspace[]> {
    return workspaceRepo.list(this.raw);
  }
  listNodes(workspaceId: Id, includeDeleted = false): Promise<NodeHeader[]> {
    return nodeRepo.listByWorkspace(this.raw, workspaceId, { includeDeleted });
  }
  listChildren(workspaceId: Id, parentId: Id | null, includeDeleted = false): Promise<NodeHeader[]> {
    return nodeRepo.listChildren(this.raw, workspaceId, parentId, { includeDeleted });
  }
  listDeleted(workspaceId: Id): Promise<NodeHeader[]> {
    return nodeRepo.listDeleted(this.raw, workspaceId);
  }

  // ---- Acceso de bajo nivel (sin anotar): lo usa deshacer/rehacer ---------
  async peek(store: RecordStore, key: Id): Promise<AnyRecord | undefined> {
    if (store === 'nodes') return nodeRepo.get(this.raw, key);
    if (store === 'contents') return contentRepo.get(this.raw, key);
    return workspaceRepo.get(this.raw, key);
  }
  async poke(store: RecordStore, key: Id, rec: AnyRecord | undefined): Promise<void> {
    if (store === 'nodes') {
      if (rec) await nodeRepo.put(this.raw, rec as NodeHeader);
      else await nodeRepo.delete(this.raw, key);
    } else if (store === 'contents') {
      if (rec) await contentRepo.put(this.raw, rec as NodeContent);
      else await contentRepo.delete(this.raw, key);
    } else if (rec) await workspaceRepo.put(this.raw, rec as Workspace);
    else await workspaceRepo.delete(this.raw, key);
  }

  // ---- Escritura con registro de cambios ----------------------------------
  /**
   * Anota y escribe. Se pueden lanzar escrituras de claves DISTINTAS en paralelo
   * (`Promise.all`): las peticiones de una misma transacción se encadenan en el
   * motor y esperar una a una es lo que hace lento operar sobre subárboles.
   * `known` evita releer el registro cuando el llamador ya lo tiene.
   */
  private async write(
    store: RecordStore,
    key: Id,
    next: AnyRecord | undefined,
    known?: AnyRecord,
  ): Promise<void> {
    const k = recordKey(store, key);
    let change = this.rec.get(k);
    if (!change) {
      change = { store, key, prev: known ?? (await this.peek(store, key)), next: undefined };
      this.rec.set(k, change);
    }
    await this.poke(store, key, next);
    change.next = next;
  }

  /** Crea o reemplaza un nodo completo. */
  putNode(node: NodeHeader): Promise<void> {
    return this.write('nodes', node.id, clean(node));
  }
  /** Modifica campos de un nodo existente (sube `rev` y `updatedAt`). */
  async updateNode(id: Id, patch: Partial<Omit<NodeHeader, 'id' | 'rev'>>): Promise<NodeHeader> {
    const cur = await this.requireNode(id);
    const next = clean({ ...cur, ...patch, id, rev: cur.rev + 1, updatedAt: this.now });
    await this.write('nodes', id, next, cur);
    return next;
  }
  removeNode(id: Id): Promise<void> {
    return this.write('nodes', id, undefined);
  }

  async setContent(
    nodeId: Id,
    fields: Pick<NodeContent, 'doc' | 'textCache'> & Partial<NodeContent>,
  ): Promise<NodeContent> {
    const cur = await this.getContent(nodeId);
    const next: NodeContent = cur
      ? { ...cur, ...fields, nodeId, updatedAt: this.now, rev: cur.rev + 1 }
      : { schemaVersion: 1, ...fields, nodeId, updatedAt: this.now, rev: 0 };
    await this.write('contents', nodeId, next);
    return next;
  }
  putContent(content: NodeContent): Promise<void> {
    return this.write('contents', content.nodeId, content);
  }
  removeContent(nodeId: Id): Promise<void> {
    return this.write('contents', nodeId, undefined);
  }

  putWorkspace(ws: Workspace): Promise<void> {
    return this.write('workspaces', ws.id, clean(ws));
  }
  async updateWorkspace(id: Id, patch: Partial<Omit<Workspace, 'id' | 'rev'>>): Promise<Workspace> {
    const cur = await this.getWorkspace(id);
    if (!cur) throw new NotFoundError('el espacio', id);
    const next = clean({ ...cur, ...patch, id, rev: cur.rev + 1, updatedAt: this.now });
    await this.write('workspaces', id, next);
    return next;
  }
  removeWorkspace(id: Id): Promise<void> {
    return this.write('workspaces', id, undefined);
  }

  /** Cambios netos de la transacción (descarta los que no cambiaron nada). */
  changes(): Change[] {
    return [...this.rec.values()].filter((c) => !(c.prev === undefined && c.next === undefined));
  }
}

/**
 * Aplica un conjunto de cambios en una dirección. Comprueba antes que cada
 * registro sigue como lo dejó la operación (si no, `StaleHistoryError`); escribe
 * la imagen contraria con `rev` mayor que la actual. Devuelve las imágenes
 * escritas, que pasan a ser el nuevo estado esperado para la operación inversa.
 */
export async function applyDirection(
  tx: CommandTx,
  changes: readonly Change[],
  direction: 'undo' | 'redo',
): Promise<Array<AnyRecord | undefined>> {
  const currents = await Promise.all(changes.map((c) => tx.peek(c.store, c.key)));
  const written: Array<AnyRecord | undefined> = changes.map((c, i) => {
    const expected = direction === 'undo' ? c.next : c.prev;
    const target = direction === 'undo' ? c.prev : c.next;
    const current = currents[i];
    if (!sameState(current, expected)) throw new StaleHistoryError();
    if (!target) return undefined;
    return { ...target, rev: Math.max(target.rev, current?.rev ?? target.rev) + 1 } as AnyRecord;
  });
  await Promise.all(changes.map((c, i) => tx.poke(c.store, c.key, written[i])));
  return written;
}

/** Une dos conjuntos de cambios consecutivos: conserva el primer `prev` y el último `next`. */
export function mergeChanges(first: readonly Change[], second: readonly Change[]): Change[] {
  const map = new Map<string, Change>();
  for (const c of first) map.set(recordKey(c.store, c.key), { ...c });
  for (const c of second) {
    const k = recordKey(c.store, c.key);
    const existing = map.get(k);
    if (existing) existing.next = c.next;
    else map.set(k, { ...c });
  }
  return [...map.values()].filter((c) => !(c.prev === undefined && c.next === undefined));
}

/** Estimación barata del peso en memoria de un conjunto de cambios. */
export function estimateSize(changes: readonly Change[]): number {
  let size = 0;
  for (const c of changes) {
    for (const r of [c.prev, c.next]) {
      if (!r) continue;
      size += 300;
      if (c.store === 'contents') size += (r as NodeContent).textCache.length * 3;
    }
  }
  return size;
}
