import type { Tx } from '../engine/types';

interface MetaRecord<T = unknown> {
  key: string;
  value: T;
}

/** Valores sueltos del sistema: `schemaVersion`, `deviceId`, `lastBackupAt`... */
export const metaRepo = {
  async get<T>(tx: Tx, key: string): Promise<T | undefined> {
    const rec = await tx.get<MetaRecord<T>>('meta', key);
    return rec?.value;
  },

  async set<T>(tx: Tx, key: string, value: T): Promise<void> {
    await tx.put<MetaRecord<T>>('meta', { key, value });
  },

  async delete(tx: Tx, key: string): Promise<void> {
    await tx.delete('meta', key);
  },
};
