import type { Id, Workspace } from '../../domain/types';
import type { Tx } from '../engine/types';

export const workspaceRepo = {
  get(tx: Tx, id: Id): Promise<Workspace | undefined> {
    return tx.get<Workspace>('workspaces', id);
  },

  /** Todos los espacios, ordenados por su clave de orden. */
  list(tx: Tx): Promise<Workspace[]> {
    return tx.getAll<Workspace>('workspaces', { index: 'order' });
  },

  async put(tx: Tx, workspace: Workspace): Promise<void> {
    await tx.put('workspaces', workspace);
  },

  /** Borrado físico del registro (el borrado lógico lo gestionan los comandos). */
  delete(tx: Tx, id: Id): Promise<void> {
    return tx.delete('workspaces', id);
  },
};
