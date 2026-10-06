import { ConflictError, NotFoundError } from '../../errors';
import type { Id, NodeHeader } from '../../domain/types';
import type { Tx } from '../engine/types';

/** `parentKey` de los nodos que cuelgan directamente del espacio. */
export const ROOT_KEY = '';

/**
 * Forma almacenada: la cabecera más `parentKey`. IndexedDB no puede indexar
 * `null`, así que la raíz se guarda como '' (ver schema.ts). Los repositorios
 * añaden y quitan este campo: el resto de la aplicación nunca lo ve.
 */
type StoredNode = NodeHeader & { parentKey: string };

function toStored(node: NodeHeader): StoredNode {
  return { ...node, parentKey: node.parentId ?? ROOT_KEY };
}

function fromStored(stored: StoredNode): NodeHeader {
  const { parentKey: _parentKey, ...node } = stored;
  return node;
}

export interface ListOptions {
  includeDeleted?: boolean;
}

export const nodeRepo = {
  async get(tx: Tx, id: Id): Promise<NodeHeader | undefined> {
    const stored = await tx.get<StoredNode>('nodes', id);
    return stored ? fromStored(stored) : undefined;
  },

  async put(tx: Tx, node: NodeHeader): Promise<void> {
    await tx.put('nodes', toStored(node));
  },

  delete(tx: Tx, id: Id): Promise<void> {
    return tx.delete('nodes', id);
  },

  /**
   * Cambia campos de un nodo con control de concurrencia: si se pasa
   * `expectedRev` y el registro cambió desde que se leyó, lanza ConflictError.
   * Incrementa `rev` y actualiza `updatedAt`.
   */
  async update(
    tx: Tx,
    id: Id,
    patch: Partial<Omit<NodeHeader, 'id' | 'rev'>>,
    options: { expectedRev?: number; now?: number } = {},
  ): Promise<NodeHeader> {
    const current = await nodeRepo.get(tx, id);
    if (!current) throw new NotFoundError('el nodo', id);
    if (options.expectedRev !== undefined && options.expectedRev !== current.rev) {
      throw new ConflictError(id, options.expectedRev, current.rev);
    }
    const next: NodeHeader = {
      ...current,
      ...patch,
      id,
      rev: current.rev + 1,
      updatedAt: options.now ?? Date.now(),
    };
    await nodeRepo.put(tx, next);
    return next;
  },

  /** Todas las cabeceras de un espacio (para cargarlas en memoria al abrirlo). */
  async listByWorkspace(
    tx: Tx,
    workspaceId: Id,
    options: ListOptions = {},
  ): Promise<NodeHeader[]> {
    const all = await tx.getAll<StoredNode>('nodes', {
      index: 'workspace',
      query: { eq: workspaceId },
    });
    const live = options.includeDeleted ? all : all.filter((n) => n.deletedAt === undefined);
    return live.map(fromStored);
  },

  /** Hijos directos, ya ordenados por clave de orden (y por id si empatan). */
  async listChildren(
    tx: Tx,
    workspaceId: Id,
    parentId: Id | null,
    options: ListOptions = {},
  ): Promise<NodeHeader[]> {
    const all = await tx.getAll<StoredNode>('nodes', {
      index: 'parent',
      query: { prefix: [workspaceId, parentId ?? ROOT_KEY] },
    });
    const live = options.includeDeleted ? all : all.filter((n) => n.deletedAt === undefined);
    return live.map(fromStored);
  },

  /** Nodos en la papelera, del más antiguo al más reciente. */
  async listDeleted(tx: Tx, workspaceId: Id): Promise<NodeHeader[]> {
    const all = await tx.getAll<StoredNode>('nodes', {
      index: 'deleted',
      query: { prefix: [workspaceId] },
    });
    return all.map(fromStored);
  },

  count(tx: Tx, workspaceId: Id): Promise<number> {
    return tx.count('nodes', { index: 'workspace', query: { eq: workspaceId } });
  },
};
