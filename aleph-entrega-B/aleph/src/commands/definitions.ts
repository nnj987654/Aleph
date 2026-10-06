import { AlephError, NotFoundError } from '../errors';
import { createNodeContent, createNodeHeader, createWorkspace } from '../domain/factories';
import { between } from '../domain/order';
import type { DocJSON, Id, NodeContent, NodeHeader, NodeType, Workspace } from '../domain/types';
import { t } from '../i18n';
import type { CommandSpec } from './bus';
import type { CommandTx } from './changeset';
import { allocateOrders } from './placement';

const TYPING_WINDOW_MS = 2000;

/** Hijos de un conjunto de nodos, consultados en paralelo. */
async function childrenOfLevel(
  tx: CommandTx,
  level: readonly NodeHeader[],
  includeDeleted: boolean,
): Promise<NodeHeader[]> {
  const lists = await Promise.all(level.map((n) => tx.listChildren(n.workspaceId, n.id, includeDeleted)));
  return lists.flat();
}

/** Descendientes (sin la raíz), recorriendo el árbol por niveles. */
async function collectSubtree(
  tx: CommandTx,
  root: NodeHeader,
  options: { includeDeleted: boolean },
): Promise<NodeHeader[]> {
  const out: NodeHeader[] = [];
  for (let level = await childrenOfLevel(tx, [root], options.includeDeleted); level.length; ) {
    out.push(...level);
    level = await childrenOfLevel(tx, level, options.includeDeleted);
  }
  return out;
}

async function requireAliveParent(tx: CommandTx, workspaceId: Id, parentId: Id | null): Promise<void> {
  if (parentId === null) return;
  const parent = await tx.requireNode(parentId);
  if (parent.workspaceId !== workspaceId) throw new AlephError('cross-workspace', t('err.crossWorkspace'));
  if (parent.deletedAt !== undefined) throw new AlephError('deleted-parent', t('err.deletedParent'));
}

// ---------------------------------------------------------------- espacios
export interface CreateWorkspaceInput {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
}

export const createWorkspaceCmd = (input: CreateWorkspaceInput): CommandSpec<Workspace> => ({
  label: { id: 'cmd.workspace.create', params: { title: input.name } },
  async run(tx, ctx) {
    const all = await tx.listWorkspaces();
    const order = between(all[all.length - 1]?.order ?? null, null);
    const ws = { ...createWorkspace({ ...input, order }, ctx.now), id: ctx.newId() };
    await tx.putWorkspace(ws);
    return ws;
  },
});

export const updateWorkspaceCmd = (
  id: Id,
  patch: Partial<Pick<Workspace, 'name' | 'icon' | 'color' | 'description'>>,
): CommandSpec<Workspace> => ({
  label: { id: 'cmd.workspace.update', params: { title: patch.name ?? '' } },
  run: (tx) => tx.updateWorkspace(id, patch),
});

/** Borra el espacio y TODO su contenido. No se puede deshacer. */
export const deleteWorkspaceCmd = (id: Id): CommandSpec => ({
  label: { id: 'cmd.workspace.delete', params: { title: '' } },
  undoable: false,
  async run(tx) {
    await purgeNodes(tx, await tx.listNodes(id, true));
    await tx.removeWorkspace(id);
  },
});

// ------------------------------------------------------------------- nodos
export interface CreateNodeInput {
  workspaceId: Id;
  parentId?: Id | null;
  /** Posición entre los hermanos; por defecto, al final. */
  index?: number;
  type?: NodeType;
  title: string;
  icon?: string;
  kind?: string;
  assetId?: Id;
  doc?: DocJSON;
}

export const createNodeCmd = (input: CreateNodeInput): CommandSpec<NodeHeader> => ({
  label: { id: 'cmd.node.create', params: { title: input.title } },
  async run(tx, ctx) {
    const parentId = input.parentId ?? null;
    await requireAliveParent(tx, input.workspaceId, parentId);
    const [order] = await allocateOrders(tx, input.workspaceId, parentId, input.index, 1);
    const node = createNodeHeader(
      {
        workspaceId: input.workspaceId,
        title: input.title,
        order: order!,
        parentId,
        type: input.type ?? 'page',
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.kind !== undefined && { kind: input.kind }),
        ...(input.assetId !== undefined && { assetId: input.assetId }),
      },
      ctx.now,
    );
    node.id = ctx.newId();
    await tx.putNode(node);
    if (node.type === 'page') await tx.putContent(createNodeContent(node.id, input.doc, '', ctx.now));
    return node;
  },
});

export type NodePatch = Partial<Pick<NodeHeader, 'title' | 'icon' | 'kind' | 'status' | 'tagIds' | 'favorite' | 'meta'>>;

export const updateNodeCmd = (id: Id, patch: NodePatch, title = ''): CommandSpec<NodeHeader> => ({
  label: { id: 'cmd.node.update', params: { title } },
  run: (tx) => tx.updateNode(id, patch),
});

export const renameNodeCmd = (id: Id, title: string): CommandSpec<NodeHeader> => ({
  label: { id: 'cmd.node.rename', params: { title } },
  coalesce: { key: `rename:${id}`, windowMs: TYPING_WINDOW_MS },
  run: (tx) => tx.updateNode(id, { title }),
});

export const setFavoriteCmd = (id: Id, favorite: boolean, title = ''): CommandSpec<NodeHeader> => ({
  label: { id: 'cmd.node.favorite', params: { title } },
  run: (tx) => tx.updateNode(id, { favorite }),
});

/**
 * Mueve varios nodos a un destino. `index` cuenta los hermanos de destino SIN
 * los nodos que se mueven. Conserva el orden relativo dado en `ids`.
 */
export const moveNodesCmd = (ids: readonly Id[], parentId: Id | null, index?: number): CommandSpec<void> => ({
  label:
    ids.length === 1
      ? { id: 'cmd.node.move', params: { title: '' } }
      : { id: 'cmd.node.moveMany', params: { count: ids.length } },
  async run(tx) {
    const unique = [...new Set(ids)];
    const nodes = await Promise.all(unique.map((id) => tx.requireNode(id)));
    const ws = nodes[0]?.workspaceId;
    if (!ws) return;
    if (nodes.some((n) => n.workspaceId !== ws)) throw new AlephError('cross-workspace', t('err.crossWorkspace'));
    if (nodes.some((n) => n.deletedAt !== undefined)) throw new AlephError('deleted-node', t('err.deletedParent'));
    await requireAliveParent(tx, ws, parentId);
    // Ciclos: ningún nodo movido puede ser el destino ni un ancestro suyo.
    const moving = new Set(unique);
    for (let cur = parentId; cur !== null; ) {
      if (moving.has(cur)) throw new AlephError('cycle', t('err.cycle'));
      cur = (await tx.requireNode(cur)).parentId;
    }
    const orders = await allocateOrders(tx, ws, parentId, index, nodes.length, moving);
    for (let i = 0; i < nodes.length; i += 1) {
      await tx.updateNode(nodes[i]!.id, { parentId, order: orders[i]! });
    }
  },
});

export const moveNodeCmd = (id: Id, parentId: Id | null, index?: number, title = ''): CommandSpec<void> => {
  const spec = moveNodesCmd([id], parentId, index);
  return { ...spec, label: { id: 'cmd.node.move', params: { title } } };
};

/** Duplica un nodo con todo su subárbol y contenidos, justo después del original. */
export const duplicateNodeCmd = (id: Id): CommandSpec<NodeHeader> => ({
  label: { id: 'cmd.node.duplicate', params: { title: '' } },
  async run(tx, ctx) {
    const root = await tx.requireNode(id);
    if (root.deletedAt !== undefined) throw new NotFoundError('el nodo', id);
    const subtree = await collectSubtree(tx, root, { includeDeleted: false });
    const siblings = await tx.listChildren(root.workspaceId, root.parentId);
    const pos = siblings.findIndex((s) => s.id === id);
    const [order] = await allocateOrders(tx, root.workspaceId, root.parentId, pos + 1, 1);

    const idMap = new Map<Id, Id>([[root.id, ctx.newId()]]);
    for (const n of subtree) idMap.set(n.id, ctx.newId());
    const copyOf = async (n: NodeHeader, isRoot: boolean): Promise<NodeHeader> => {
      const copy: NodeHeader = {
        ...n,
        id: idMap.get(n.id)!,
        parentId: isRoot ? n.parentId : idMap.get(n.parentId!)!,
        order: isRoot ? order! : n.order,
        title: isRoot ? t('node.copySuffix', { title: n.title }) : n.title,
        favorite: false,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        rev: 0,
      };
      await tx.putNode(copy);
      const content = await tx.getContent(n.id);
      if (content) {
        const c: NodeContent = { ...content, nodeId: copy.id, updatedAt: ctx.now, rev: 0 };
        await tx.putContent(c);
      }
      return copy;
    };
    const [rootCopy] = await Promise.all([copyOf(root, true), ...subtree.map((n) => copyOf(n, false))]);
    return rootCopy!;
  },
});

// ----------------------------------------------------------------- papelera
/** Envía a la papelera cada nodo con su subárbol. Lo ya eliminado se deja como estaba. */
export const trashNodesCmd = (ids: readonly Id[]): CommandSpec<void> => ({
  label: { id: 'cmd.node.trash', params: { title: '' } },
  async run(tx, ctx) {
    for (const id of new Set(ids)) {
      const root = await tx.getNode(id);
      if (!root || root.deletedAt !== undefined) continue;
      const patch = { deletedAt: ctx.now, deletedRootId: id };
      const subtree = await collectSubtree(tx, root, { includeDeleted: false });
      await Promise.all([root, ...subtree].map((n) => tx.updateNode(n.id, patch)));
    }
  },
});

/**
 * Restaura un elemento de la papelera con lo que se eliminó junto a él. Si su
 * padre ya no está disponible, vuelve a la raíz del espacio.
 */
export const restoreNodeCmd = (rootId: Id): CommandSpec<void> => ({
  label: { id: 'cmd.node.restore', params: { title: '' } },
  async run(tx) {
    const root = await tx.requireNode(rootId);
    if (root.deletedAt === undefined) return;
    const parent = root.parentId ? await tx.getNode(root.parentId) : undefined;
    const parentOk = root.parentId === null || (parent !== undefined && parent.deletedAt === undefined);
    const target = parentOk ? root.parentId : null;

    // Recoger primero (los que pertenecen a esta eliminación), escribir después.
    const group: NodeHeader[] = [root];
    for (let level: NodeHeader[] = [root]; level.length; ) {
      level = (await childrenOfLevel(tx, level, true)).filter((k) => k.deletedRootId === rootId);
      group.push(...level);
    }
    const siblings = await tx.listChildren(root.workspaceId, target);
    const clash = !parentOk || siblings.some((s) => s.order === root.order);
    const order = clash ? (await allocateOrders(tx, root.workspaceId, target, undefined, 1))[0]! : root.order;
    await Promise.all(
      group.map((n) =>
        tx.updateNode(n.id, {
          deletedAt: undefined,
          deletedRootId: undefined,
          ...(n.id === rootId && { parentId: target, order }),
        }),
      ),
    );
  },
});

async function purgeNodes(tx: CommandTx, nodes: readonly NodeHeader[]): Promise<void> {
  await Promise.all(nodes.flatMap((n) => [tx.removeContent(n.id), tx.removeNode(n.id)]));
}

/** Elimina para siempre un elemento de la papelera y todo su subárbol. No se puede deshacer. */
export const purgeNodeCmd = (rootId: Id): CommandSpec<void> => ({
  label: { id: 'cmd.node.purge', params: { title: '' } },
  undoable: false,
  async run(tx) {
    const root = await tx.getNode(rootId);
    if (!root) return;
    const all = [root, ...(await collectSubtree(tx, root, { includeDeleted: true }))];
    await purgeNodes(tx, all);
  },
});

export const emptyTrashCmd = (workspaceId: Id): CommandSpec<void> => ({
  label: { id: 'cmd.trash.empty' },
  undoable: false,
  async run(tx) {
    await purgeNodes(tx, await tx.listDeleted(workspaceId));
  },
});

// ---------------------------------------------------------------- contenido
export const setContentCmd = (
  nodeId: Id,
  doc: DocJSON,
  textCache: string,
  title = '',
): CommandSpec<NodeContent> => ({
  label: { id: 'cmd.content.set', params: { title } },
  coalesce: { key: `content:${nodeId}`, windowMs: TYPING_WINDOW_MS },
  async run(tx) {
    await tx.requireNode(nodeId);
    return tx.setContent(nodeId, { doc, textCache });
  },
});
