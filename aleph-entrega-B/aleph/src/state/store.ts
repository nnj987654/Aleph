import { batch, signal } from '../core/reactive';
import type { ReadonlySignal, Signal } from '../core/reactive';
import type { Change } from '../commands/changeset';
import { nodeRepo, ROOT_KEY, workspaceRepo } from '../data';
import type { StorageEngine } from '../data';
import { compareSiblings } from '../domain/tree';
import type { Id, NodeHeader, Workspace } from '../domain/types';

const parentKey = (n: NodeHeader): string => n.parentId ?? ROOT_KEY;

/** Posición de inserción por búsqueda binaria en una lista ordenada por `compareSiblings`. */
function lowerBound(list: readonly NodeHeader[], node: NodeHeader): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareSiblings(list[mid]!, node) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Estado en memoria de la aplicación: espacios y las cabeceras del espacio
 * abierto. Es una copia de la base de datos que se mantiene al día aplicando
 * los `Change` de cada operación (nunca se recarga entera).
 *
 * Reactividad granular: cada nodo y cada lista de hijos tienen su propia
 * señal, de modo que editar un título solo avisa a quien lo muestra.
 * Las listas son inmutables: cada cambio entrega una copia nueva.
 */
export class WorkspaceStore {
  readonly workspaces: Signal<readonly Workspace[]> = signal([]);
  readonly currentWorkspaceId: Signal<Id | null> = signal(null);
  /** Raíces de la papelera (lo que el usuario eliminó), la más reciente primero. */
  readonly trashRoots: Signal<readonly NodeHeader[]> = signal([]);
  readonly favorites: Signal<readonly NodeHeader[]> = signal([]);
  /** Nodos vivos del espacio abierto. */
  readonly nodeCount: Signal<number> = signal(0);

  private wsById = new Map<Id, Workspace>();
  private byId = new Map<Id, NodeHeader>();
  private kids = new Map<string, NodeHeader[]>();
  private trashIds = new Set<Id>();
  private favoriteIds = new Set<Id>();
  private alive = 0;
  private nodeSigs = new Map<Id, Signal<NodeHeader | undefined>>();
  private kidSigs = new Map<string, Signal<readonly NodeHeader[]>>();

  // ---- Carga ----------------------------------------------------------------
  async loadWorkspaces(engine: StorageEngine): Promise<void> {
    const list = await engine.transaction(['workspaces'], 'r', (tx) => workspaceRepo.list(tx));
    this.wsById = new Map(list.map((w) => [w.id, w]));
    this.workspaces.set(list);
  }

  /** Carga las cabeceras de un espacio (vivas y eliminadas) y lo deja como el actual. */
  async openWorkspace(engine: StorageEngine, workspaceId: Id): Promise<void> {
    const nodes = await engine.transaction(['nodes'], 'r', (tx) =>
      nodeRepo.listByWorkspace(tx, workspaceId, { includeDeleted: true }),
    );
    batch(() => {
      this.byId = new Map();
      this.kids = new Map();
      this.trashIds = new Set();
      this.favoriteIds = new Set();
      this.alive = 0;
      for (const n of nodes) {
        this.byId.set(n.id, n);
        this.index(n);
      }
      for (const list of this.kids.values()) list.sort(compareSiblings);
      this.currentWorkspaceId.set(workspaceId);
      this.nodeCount.set(this.alive);
      // Las señales ya creadas (de una carga anterior) se ponen al día.
      for (const [key, sig] of this.kidSigs) sig.set([...(this.kids.get(key) ?? [])]);
      for (const [id, sig] of this.nodeSigs) sig.set(this.byId.get(id));
      this.publishTrash();
      this.publishFavorites();
    });
  }

  /** Alta en los índices auxiliares sin ordenar (solo para la carga inicial). */
  private index(n: NodeHeader): void {
    if (n.deletedAt === undefined) {
      this.alive += 1;
      const key = parentKey(n);
      const list = this.kids.get(key);
      if (list) list.push(n);
      else this.kids.set(key, [n]);
      if (n.favorite) this.favoriteIds.add(n.id);
    } else if (n.deletedRootId === n.id) {
      this.trashIds.add(n.id);
    }
  }

  // ---- Lectura (señales y acceso directo) ---------------------------------------
  node(id: Id): ReadonlySignal<NodeHeader | undefined> {
    let sig = this.nodeSigs.get(id);
    if (!sig) {
      sig = signal(this.byId.get(id));
      this.nodeSigs.set(id, sig);
    }
    return sig;
  }

  children(parentId: Id | null): ReadonlySignal<readonly NodeHeader[]> {
    const key = parentId ?? ROOT_KEY;
    let sig = this.kidSigs.get(key);
    if (!sig) {
      sig = signal<readonly NodeHeader[]>([...(this.kids.get(key) ?? [])]);
      this.kidSigs.set(key, sig);
    }
    return sig;
  }

  getNode(id: Id): NodeHeader | undefined {
    return this.byId.get(id);
  }
  getChildren(parentId: Id | null): readonly NodeHeader[] {
    return this.kids.get(parentId ?? ROOT_KEY) ?? [];
  }
  getWorkspace(id: Id): Workspace | undefined {
    return this.wsById.get(id);
  }
  /** Todas las cabeceras cargadas (vivas y eliminadas), para invariantes y búsqueda. */
  allNodes(): IterableIterator<NodeHeader> {
    return this.byId.values();
  }
  /** Ruta de ancestros hasta el nodo, ambos incluidos (migas de pan). */
  path(id: Id): NodeHeader[] {
    const out: NodeHeader[] = [];
    for (let cur = this.byId.get(id); cur && out.length < 10_000; cur = cur.parentId ? this.byId.get(cur.parentId) : undefined) {
      out.unshift(cur);
    }
    return out;
  }

  // ---- Aplicar cambios ------------------------------------------------------------
  apply(changes: readonly Change[]): void {
    batch(() => {
      const touchedKids = new Set<string>();
      const touchedNodes = new Set<Id>();
      let trashDirty = false;
      let favDirty = false;
      const ws = this.currentWorkspaceId.peek();
      let wsDirty = false;

      for (const c of changes) {
        if (c.store === 'workspaces') {
          if (c.next) this.wsById.set(c.key, c.next as Workspace);
          else this.wsById.delete(c.key);
          wsDirty = true;
          continue;
        }
        if (c.store !== 'nodes') continue;
        const old = this.byId.get(c.key);
        const next = c.next as NodeHeader | undefined;
        if (next && next.workspaceId !== ws) {
          // Pertenece a otro espacio: si lo teníamos, ya no es nuestro.
          if (!old) continue;
        }
        if (old) this.unindex(old, touchedKids, () => (trashDirty = true), () => (favDirty = true));
        if (next && next.workspaceId === ws) {
          this.byId.set(next.id, next);
          this.reindex(next, touchedKids, () => (trashDirty = true), () => (favDirty = true));
        } else {
          this.byId.delete(c.key);
        }
        touchedNodes.add(c.key);
      }

      for (const key of touchedKids) this.kidSigs.get(key)?.set([...(this.kids.get(key) ?? [])]);
      for (const id of touchedNodes) this.nodeSigs.get(id)?.set(this.byId.get(id));
      if (touchedNodes.size) this.nodeCount.set(this.alive);
      if (trashDirty) this.publishTrash();
      if (favDirty) this.publishFavorites();
      if (wsDirty) {
        this.workspaces.set([...this.wsById.values()].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0)));
        const cur = this.currentWorkspaceId.peek();
        if (cur && !this.wsById.has(cur)) this.currentWorkspaceId.set(null);
      }
    });
  }

  private unindex(old: NodeHeader, touched: Set<string>, onTrash: () => void, onFav: () => void): void {
    if (old.deletedAt === undefined) {
      this.alive -= 1;
      const key = parentKey(old);
      const list = this.kids.get(key);
      if (list) {
        const i = lowerBound(list, old);
        if (list[i]?.id === old.id) list.splice(i, 1);
        else {
          const j = list.findIndex((x) => x.id === old.id);
          if (j >= 0) list.splice(j, 1);
        }
        if (list.length === 0) this.kids.delete(key);
        touched.add(key);
      }
      if (this.favoriteIds.delete(old.id)) onFav();
    } else if (this.trashIds.delete(old.id)) onTrash();
  }

  private reindex(n: NodeHeader, touched: Set<string>, onTrash: () => void, onFav: () => void): void {
    if (n.deletedAt === undefined) {
      this.alive += 1;
      const key = parentKey(n);
      let list = this.kids.get(key);
      if (!list) this.kids.set(key, (list = []));
      list.splice(lowerBound(list, n), 0, n);
      touched.add(key);
      if (n.favorite) {
        this.favoriteIds.add(n.id);
        onFav();
      }
    } else if (n.deletedRootId === n.id) {
      this.trashIds.add(n.id);
      onTrash();
    }
  }

  private publishTrash(): void {
    const roots = [...this.trashIds].map((id) => this.byId.get(id)).filter((n): n is NodeHeader => !!n);
    roots.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    this.trashRoots.set(roots);
  }

  private publishFavorites(): void {
    const favs = [...this.favoriteIds].map((id) => this.byId.get(id)).filter((n): n is NodeHeader => !!n);
    favs.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    this.favorites.set(favs);
  }
}
