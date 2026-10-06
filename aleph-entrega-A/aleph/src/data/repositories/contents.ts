import type { Id, NodeContent } from '../../domain/types';
import type { Tx } from '../engine/types';

/**
 * Contenido (documento de bloques) de cada nodo. Se guarda aparte de la
 * cabecera: renombrar o mover un nodo nunca reescribe su documento.
 */
export const contentRepo = {
  get(tx: Tx, nodeId: Id): Promise<NodeContent | undefined> {
    return tx.get<NodeContent>('contents', nodeId);
  },

  async put(tx: Tx, content: NodeContent): Promise<void> {
    await tx.put('contents', content);
  },

  delete(tx: Tx, nodeId: Id): Promise<void> {
    return tx.delete('contents', nodeId);
  },
};
