import type { StoreName } from './engine/types';

/**
 * Esquema de IndexedDB, versión 1 (arquitectura §6.2).
 *
 * Dos limitaciones de IndexedDB que condicionan el diseño:
 *  - `null` y `undefined` NO son claves válidas: un registro cuyo campo
 *    indexado vale null/undefined simplemente no aparece en ese índice.
 *    Por eso los nodos guardan además `parentKey` (el padre, o '' para la
 *    raíz), y el índice `deleted` solo contiene nodos eliminados.
 *  - Los booleanos tampoco son claves válidas: no se puede indexar `favorite`.
 *    Los favoritos se filtran en memoria (las cabeceras ya están cargadas).
 */

export interface IndexSpec {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
}

export interface StoreSpec {
  name: StoreName;
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: IndexSpec[];
}

export const SCHEMA_V1: readonly StoreSpec[] = [
  { name: 'meta', keyPath: 'key' },
  { name: 'workspaces', keyPath: 'id', indexes: [{ name: 'order', keyPath: 'order' }] },
  {
    name: 'nodes',
    keyPath: 'id',
    indexes: [
      // Hijos de un padre, ya ordenados: [espacio, padre ('' = raíz), orden]
      { name: 'parent', keyPath: ['workspaceId', 'parentKey', 'order'] },
      { name: 'workspace', keyPath: 'workspaceId' },
      // Solo contiene nodos eliminados (deletedAt definido): papelera.
      { name: 'deleted', keyPath: ['workspaceId', 'deletedAt'] },
      { name: 'updated', keyPath: 'updatedAt' },
      { name: 'type', keyPath: ['workspaceId', 'type'] },
    ],
  },
  { name: 'contents', keyPath: 'nodeId', indexes: [{ name: 'updated', keyPath: 'updatedAt' }] },
  {
    name: 'assets',
    keyPath: 'id',
    indexes: [
      { name: 'sha256', keyPath: 'sha256' },
      { name: 'deleted', keyPath: 'deletedAt' },
      { name: 'mime', keyPath: 'mimeType' },
    ],
  },
  { name: 'blobs', keyPath: 'assetId' },
  { name: 'tags', keyPath: 'id', indexes: [{ name: 'nameNorm', keyPath: 'nameNorm', unique: true }] },
  {
    name: 'relations',
    keyPath: 'id',
    indexes: [
      { name: 'source', keyPath: 'sourceId' },
      { name: 'target', keyPath: 'targetId' },
      { name: 'type', keyPath: 'type' },
    ],
  },
  { name: 'history', keyPath: 'id', indexes: [{ name: 'node', keyPath: ['nodeId', 'at'] }] },
  { name: 'searchIndex', keyPath: 'chunk' },
  { name: 'settings', keyPath: 'key' },
  { name: 'journal', keyPath: 'seq', autoIncrement: true },
];
