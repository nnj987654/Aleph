import { StorageError } from '../../errors';

/**
 * Contexto de una migración. Se ejecuta DENTRO de la transacción de cambio de
 * versión de IndexedDB: solo se puede esperar (`await`) a peticiones de esa
 * transacción (cursores, get, put...). Si la migración lanza un error, la
 * transacción se aborta y la base anterior queda intacta.
 */
export interface UpgradeContext {
  db: IDBDatabase;
  tx: IDBTransaction;
}

export interface Migration {
  from: number;
  to: number;
  up(ctx: UpgradeContext): void | Promise<void>;
}

/** Versión más reciente que conoce la aplicación. */
export function latestVersion(migrations: readonly Migration[]): number {
  return migrations.reduce((max, m) => Math.max(max, m.to), 0);
}

/**
 * Migraciones a aplicar para pasar de `oldVersion` a `newVersion`, en orden.
 * Comprueba que forman una cadena continua (sin huecos ni solapes).
 */
export function planMigrations(
  oldVersion: number,
  newVersion: number,
  migrations: readonly Migration[],
): Migration[] {
  const plan: Migration[] = [];
  let current = oldVersion;
  while (current < newVersion) {
    const next = migrations.filter((m) => m.from === current);
    if (next.length !== 1) {
      throw new StorageError(
        'migration',
        next.length === 0
          ? `Falta la migración desde la versión ${current}.`
          : `Hay varias migraciones desde la versión ${current}.`,
      );
    }
    const m = next[0] as Migration;
    if (m.to <= m.from) {
      throw new StorageError('migration', `Migración no válida: ${m.from} → ${m.to}.`);
    }
    plan.push(m);
    current = m.to;
  }
  return plan;
}

/** Aplica `fn` a todos los registros de un almacén (para migraciones de datos). */
export function updateAll(store: IDBObjectStore, fn: (value: any) => any): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      const updated = cursor.update(fn(cursor.value));
      updated.onerror = () => reject(updated.error);
      cursor.continue();
    };
  });
}
