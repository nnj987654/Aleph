import type { Migration } from './runner';
import { migrationV1 } from './v1';

/**
 * Lista ordenada de migraciones de la aplicación. Para cambiar el esquema:
 * añadir aquí una migración `{ from: N, to: N + 1, up }`, nunca editar las
 * anteriores. Cada migración debe tener su prueba con datos de la versión previa.
 */
export const MIGRATIONS: readonly Migration[] = [migrationV1];

export { latestVersion, planMigrations, updateAll } from './runner';
export type { Migration, UpgradeContext } from './runner';
