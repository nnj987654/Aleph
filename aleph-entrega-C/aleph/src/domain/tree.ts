import type { Id, NodeHeader } from './types';

/**
 * Utilidades puras sobre el árbol de nodos (arquitectura §5.2 y §9).
 * Reciben cabeceras ya cargadas en memoria; no tocan almacenamiento.
 */

export type NodeMap = ReadonlyMap<Id, NodeHeader>;
/** Hijos por padre (`null` = raíz del espacio), ya ordenados. */
export type ChildrenIndex = Map<Id | null, NodeHeader[]>;

export function toMap(nodes: Iterable<NodeHeader>): Map<Id, NodeHeader> {
  const map = new Map<Id, NodeHeader>();
  for (const n of nodes) map.set(n.id, n);
  return map;
}

/** Orden entre hermanos: clave fraccionaria y, si empatan, id. */
export function compareSiblings(a: NodeHeader, b: NodeHeader): number {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function buildChildrenIndex(
  nodes: Iterable<NodeHeader>,
  opts: { includeDeleted?: boolean } = {},
): ChildrenIndex {
  const index: ChildrenIndex = new Map();
  for (const n of nodes) {
    if (!opts.includeDeleted && n.deletedAt !== undefined) continue;
    const list = index.get(n.parentId);
    if (list) list.push(n);
    else index.set(n.parentId, [n]);
  }
  for (const list of index.values()) list.sort(compareSiblings);
  return index;
}

/**
 * Ancestros de un nodo, de la raíz al padre inmediato (no incluye el nodo).
 * Tolerante a datos corruptos: se detiene ante un ciclo o un padre inexistente.
 */
export function getAncestors(map: NodeMap, id: Id): NodeHeader[] {
  const chain: NodeHeader[] = [];
  const seen = new Set<Id>([id]);
  let cur = map.get(id)?.parentId ?? null;
  while (cur !== null && !seen.has(cur)) {
    const parent = map.get(cur);
    if (!parent) break;
    seen.add(cur);
    chain.push(parent);
    cur = parent.parentId;
  }
  return chain.reverse();
}

/** Ruta completa para migas de pan: ancestros y el propio nodo. */
export function getPath(map: NodeMap, id: Id): NodeHeader[] {
  const node = map.get(id);
  return node ? [...getAncestors(map, id), node] : [];
}

/** ¿`nodeId` está dentro del subárbol de `ancestorId`? (un nodo no es su propio descendiente) */
export function isDescendantOf(map: NodeMap, nodeId: Id, ancestorId: Id): boolean {
  return getAncestors(map, nodeId).some((a) => a.id === ancestorId);
}

/** Mover `nodeId` bajo `newParentId` crearía un ciclo (a sí mismo o a un descendiente). */
export function wouldCreateCycle(map: NodeMap, nodeId: Id, newParentId: Id | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === nodeId) return true;
  return isDescendantOf(map, newParentId, nodeId);
}

/** Descendientes en preorden (iterativo: sin límite de profundidad de pila). */
export function getDescendants(children: ChildrenIndex, id: Id): NodeHeader[] {
  const out: NodeHeader[] = [];
  const stack: NodeHeader[] = [...(children.get(id) ?? [])].reverse();
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) break;
    out.push(n);
    const kids = children.get(n.id);
    if (kids) for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i] as NodeHeader);
  }
  return out;
}

export interface VisibleRow {
  id: Id;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

/**
 * Lista lineal de las filas visibles según los nodos desplegados. Es la base
 * del árbol virtualizado: solo se dibujan las filas que caben en pantalla.
 */
export function flattenVisible(
  children: ChildrenIndex,
  expanded: ReadonlySet<Id>,
  rootParent: Id | null = null,
): VisibleRow[] {
  const out: VisibleRow[] = [];
  const stack: Array<{ node: NodeHeader; depth: number }> = [];
  const roots = children.get(rootParent) ?? [];
  for (let i = roots.length - 1; i >= 0; i -= 1) {
    stack.push({ node: roots[i] as NodeHeader, depth: 0 });
  }
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    const kids = children.get(item.node.id) ?? [];
    const isExpanded = kids.length > 0 && expanded.has(item.node.id);
    out.push({
      id: item.node.id,
      depth: item.depth,
      hasChildren: kids.length > 0,
      expanded: isExpanded,
    });
    if (isExpanded) {
      for (let i = kids.length - 1; i >= 0; i -= 1) {
        stack.push({ node: kids[i] as NodeHeader, depth: item.depth + 1 });
      }
    }
  }
  return out;
}

export type TreeIssueCode =
  | 'missing-parent'
  | 'cross-workspace-parent'
  | 'cycle'
  | 'duplicate-order'
  | 'alive-under-deleted';

export interface TreeIssue {
  code: TreeIssueCode;
  nodeId: Id;
  detail: string;
}

/**
 * Comprueba los invariantes del árbol (arquitectura §5.2):
 * padre existente y del mismo espacio, sin ciclos, orden único entre
 * hermanos vivos y ningún nodo vivo bajo un padre eliminado.
 * Es la base del comprobador de integridad.
 */
export function checkTreeInvariants(nodes: Iterable<NodeHeader>): TreeIssue[] {
  const list = [...nodes];
  const map = toMap(list);
  const issues: TreeIssue[] = [];

  for (const n of list) {
    if (n.parentId === null) continue;
    const parent = map.get(n.parentId);
    if (!parent) {
      issues.push({
        code: 'missing-parent',
        nodeId: n.id,
        detail: `El padre ${n.parentId} no existe.`,
      });
      continue;
    }
    if (parent.workspaceId !== n.workspaceId) {
      issues.push({
        code: 'cross-workspace-parent',
        nodeId: n.id,
        detail: `El padre ${parent.id} pertenece a otro espacio.`,
      });
    }
    if (parent.deletedAt !== undefined && n.deletedAt === undefined) {
      issues.push({
        code: 'alive-under-deleted',
        nodeId: n.id,
        detail: `El nodo está vivo pero su padre ${parent.id} está en la papelera.`,
      });
    }
  }

  // Ciclos: marcado por colores (0 = sin visitar, 1 = en curso, 2 = terminado).
  const state = new Map<Id, 1 | 2>();
  for (const start of list) {
    if (state.get(start.id) === 2) continue;
    const path: Id[] = [];
    let cur: Id | null = start.id;
    while (cur !== null && state.get(cur) !== 2) {
      if (state.get(cur) === 1) {
        for (const id of path.slice(path.indexOf(cur))) {
          issues.push({ code: 'cycle', nodeId: id, detail: 'El nodo forma parte de un ciclo.' });
        }
        break;
      }
      state.set(cur, 1);
      path.push(cur);
      cur = map.get(cur)?.parentId ?? null;
    }
    for (const id of path) state.set(id, 2);
  }

  // Orden único entre hermanos vivos.
  const seen = new Map<string, Id>();
  for (const n of list) {
    if (n.deletedAt !== undefined) continue;
    const key = `${n.workspaceId}\u0000${n.parentId ?? ''}\u0000${n.order}`;
    const other = seen.get(key);
    if (other !== undefined) {
      issues.push({
        code: 'duplicate-order',
        nodeId: n.id,
        detail: `Comparte la clave de orden «${n.order}» con ${other}.`,
      });
    } else {
      seen.set(key, n.id);
    }
  }

  return issues;
}
