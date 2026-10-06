/**
 * Interfaz de almacenamiento (arquitectura §6.1).
 *
 * Los repositorios usan SOLO esta interfaz, nunca IndexedDB directamente, para
 * poder sustituir el motor (OPFS, SQLite-WASM...) sin reescribir la aplicación.
 */

export type StoreName =
  | 'meta'
  | 'workspaces'
  | 'nodes'
  | 'contents'
  | 'assets'
  | 'blobs'
  | 'tags'
  | 'relations'
  | 'history'
  | 'searchIndex'
  | 'settings'
  | 'journal';

export const STORE_NAMES: readonly StoreName[] = [
  'meta',
  'workspaces',
  'nodes',
  'contents',
  'assets',
  'blobs',
  'tags',
  'relations',
  'history',
  'searchIndex',
  'settings',
  'journal',
];

export type KeyPart = string | number;
export type Key = KeyPart | ReadonlyArray<KeyPart>;

/**
 * Consultas admitidas:
 *  - `eq`: clave exacta.
 *  - `prefix`: todas las claves compuestas que empiezan por esos componentes.
 *  - `gte` / `lte`: rango (cualquiera de los dos extremos es opcional).
 */
export type Query =
  | { eq: Key }
  | { prefix: ReadonlyArray<KeyPart> }
  | { gte?: Key; lte?: Key };

export interface GetAllOptions {
  /** Nombre del índice; sin él se consulta por clave primaria. */
  index?: string;
  query?: Query;
  limit?: number;
}

/**
 * Operaciones dentro de una transacción.
 *
 * IMPORTANTE: dentro de `transaction(...)` solo se puede esperar (`await`) a
 * operaciones de `Tx`. Esperar a otra cosa (un `fetch`, un `setTimeout`...)
 * hace que la transacción se cierre sola y la siguiente operación falle.
 */
export interface Tx {
  get<T>(store: StoreName, key: Key): Promise<T | undefined>;
  getAll<T>(store: StoreName, options?: GetAllOptions): Promise<T[]>;
  /** Inserta o reemplaza. Devuelve la clave primaria. */
  put<T>(store: StoreName, value: T): Promise<Key>;
  delete(store: StoreName, key: Key): Promise<void>;
  count(store: StoreName, options?: Omit<GetAllOptions, 'limit'>): Promise<number>;
  clear(store: StoreName): Promise<void>;
}

export type TxMode = 'r' | 'rw';

export interface StorageEstimate {
  usage: number;
  quota: number;
}

export interface StorageEngine {
  open(): Promise<void>;
  /**
   * Ejecuta `fn` en una transacción atómica: si `fn` lanza un error o la
   * transacción se aborta, NO se guarda nada.
   */
  transaction<T>(stores: readonly StoreName[], mode: TxMode, fn: (tx: Tx) => Promise<T>): Promise<T>;
  estimate(): Promise<StorageEstimate>;
  close(): void;
}
