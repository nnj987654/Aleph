import { SCHEMA_V1 } from '../schema';
import type { Migration } from './runner';

/** Versión 1: crea todos los almacenes e índices. */
export const migrationV1: Migration = {
  from: 0,
  to: 1,
  up({ db }) {
    for (const spec of SCHEMA_V1) {
      const store = db.createObjectStore(spec.name, {
        keyPath: spec.keyPath,
        autoIncrement: spec.autoIncrement ?? false,
      });
      for (const ix of spec.indexes ?? []) {
        store.createIndex(ix.name, ix.keyPath, { unique: ix.unique ?? false });
      }
    }
  },
};
