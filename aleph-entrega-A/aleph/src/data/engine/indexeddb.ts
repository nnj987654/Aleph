import { AlephError, StorageError } from '../../errors';
import { uuidv7 } from '../../domain/ids';
import { MIGRATIONS, latestVersion, planMigrations } from '../migrations';
import type { Migration } from '../migrations';
import { metaRepo } from '../repositories/meta';
import type {
  GetAllOptions,
  Key,
  Query,
  StorageEngine,
  StorageEstimate,
  StoreName,
  Tx,
  TxMode,
} from './types';

export const DEFAULT_DB_NAME = 'aleph';

export interface EngineOptions {
  name?: string;
  migrations?: readonly Migration[];
  /** Fábrica de IndexedDB (por defecto la del navegador). */
  factory?: IDBFactory;
  /** Otra pestaña actualizó la base: esta conexión se cierra y hay que recargar. */
  onVersionChange?: () => void;
  /** Otra pestaña con una versión antigua impide actualizar. */
  onBlocked?: () => void;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function toRange(q: Query): IDBKeyRange {
  if ('eq' in q) return IDBKeyRange.only(q.eq as IDBValidKey);
  if ('prefix' in q) {
    // Un array vacío ordena después de cualquier número o texto: es una cota
    // superior válida para «todo lo que empieza por este prefijo».
    return IDBKeyRange.bound([...q.prefix], [...q.prefix, []]);
  }
  if (q.gte !== undefined && q.lte !== undefined) {
    return IDBKeyRange.bound(q.gte as IDBValidKey, q.lte as IDBValidKey);
  }
  if (q.gte !== undefined) return IDBKeyRange.lowerBound(q.gte as IDBValidKey);
  if (q.lte !== undefined) return IDBKeyRange.upperBound(q.lte as IDBValidKey);
  throw new StorageError('unknown', 'Consulta vacía.');
}

class IdbTx implements Tx {
  constructor(private readonly tx: IDBTransaction) {}

  private source(store: StoreName, index?: string): IDBObjectStore | IDBIndex {
    const s = this.tx.objectStore(store);
    return index ? s.index(index) : s;
  }

  async get<T>(store: StoreName, key: Key): Promise<T | undefined> {
    const value = await wrap(this.tx.objectStore(store).get(key as IDBValidKey));
    return value as T | undefined;
  }

  async getAll<T>(store: StoreName, options: GetAllOptions = {}): Promise<T[]> {
    const range = options.query ? toRange(options.query) : undefined;
    const values = await wrap(this.source(store, options.index).getAll(range, options.limit));
    return values as T[];
  }

  async put<T>(store: StoreName, value: T): Promise<Key> {
    const key = await wrap(this.tx.objectStore(store).put(value));
    return key as Key;
  }

  async delete(store: StoreName, key: Key): Promise<void> {
    await wrap(this.tx.objectStore(store).delete(key as IDBValidKey));
  }

  async count(store: StoreName, options: Omit<GetAllOptions, 'limit'> = {}): Promise<number> {
    const range = options.query ? toRange(options.query) : undefined;
    return wrap(this.source(store, options.index).count(range));
  }

  async clear(store: StoreName): Promise<void> {
    await wrap(this.tx.objectStore(store).clear());
  }
}

/** Traduce errores conocidos del navegador; deja pasar el resto tal cual. */
function normalizeError(e: unknown): unknown {
  if (e instanceof AlephError) return e;
  const name = typeof e === 'object' && e !== null && 'name' in e ? String(e.name) : '';
  if (name === 'QuotaExceededError') {
    return new StorageError('quota', 'No hay espacio de almacenamiento suficiente.', { cause: e });
  }
  return e;
}

export class IndexedDBEngine implements StorageEngine {
  private db: IDBDatabase | null = null;
  private readonly name: string;
  private readonly migrations: readonly Migration[];

  constructor(private readonly opts: EngineOptions = {}) {
    this.name = opts.name ?? DEFAULT_DB_NAME;
    this.migrations = opts.migrations ?? MIGRATIONS;
  }

  /** Versión de esquema que esta aplicación espera. */
  get schemaVersion(): number {
    return latestVersion(this.migrations);
  }

  async open(): Promise<void> {
    if (this.db) return;
    const factory = this.opts.factory ?? globalThis.indexedDB;
    if (!factory) {
      throw new StorageError('unsupported', 'Este navegador no ofrece IndexedDB.');
    }

    const target = this.schemaVersion;
    let migrationError: unknown;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(this.name, target);

      req.onupgradeneeded = (ev) => {
        const tx = req.transaction as IDBTransaction;
        let plan: Migration[];
        try {
          plan = planMigrations(ev.oldVersion, target, this.migrations);
        } catch (e) {
          migrationError = e;
          tx.abort();
          return;
        }
        // Las migraciones se encadenan dentro de la misma transacción de cambio
        // de versión; si una falla, se aborta todo y la base anterior se conserva.
        void (async () => {
          for (const m of plan) await m.up({ db: req.result, tx });
        })().catch((e: unknown) => {
          migrationError = new StorageError(
            'migration',
            'Falló la migración de la base de datos. Tus datos anteriores se conservan.',
            { cause: e },
          );
          try {
            tx.abort();
          } catch {
            /* la transacción ya había terminado */
          }
        });
      };

      req.onblocked = () => this.opts.onBlocked?.();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        if (migrationError) {
          reject(migrationError);
          return;
        }
        const err = req.error;
        if (err?.name === 'VersionError') {
          reject(
            new StorageError(
              'version',
              'Tus datos son de una versión más nueva de Aleph. Actualiza la aplicación.',
              { cause: err },
            ),
          );
          return;
        }
        reject(normalizeError(err) ?? new StorageError('unknown', 'No se pudo abrir la base de datos.'));
      };
    });

    db.onversionchange = () => {
      db.close();
      if (this.db === db) this.db = null;
      this.opts.onVersionChange?.();
    };
    this.db = db;

    await this.transaction(['meta'], 'rw', async (tx) => {
      if ((await metaRepo.get<string>(tx, 'deviceId')) === undefined) {
        await metaRepo.set(tx, 'deviceId', uuidv7());
        await metaRepo.set(tx, 'createdAt', Date.now());
      }
      await metaRepo.set(tx, 'schemaVersion', target);
    });
  }

  async transaction<T>(
    stores: readonly StoreName[],
    mode: TxMode,
    fn: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    const db = this.db;
    if (!db) throw new StorageError('closed', 'La base de datos no está abierta.');

    const tx = db.transaction([...stores], mode === 'rw' ? 'readwrite' : 'readonly');
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new StorageError('unknown', 'Transacción abortada.'));
    });
    done.catch(() => undefined); // evita avisos de promesa sin atender si se aborta antes del await

    let result: T;
    try {
      result = await fn(new IdbTx(tx));
    } catch (e) {
      try {
        tx.abort(); // nada de lo escrito en esta transacción se guarda
      } catch {
        /* ya había terminado */
      }
      await done.catch(() => undefined);
      throw normalizeError(e);
    }

    try {
      await done;
    } catch (e) {
      throw normalizeError(e);
    }
    return result;
  }

  async estimate(): Promise<StorageEstimate> {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage?.estimate) return { usage: 0, quota: 0 };
    const { usage = 0, quota = 0 } = await storage.estimate();
    return { usage, quota };
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
