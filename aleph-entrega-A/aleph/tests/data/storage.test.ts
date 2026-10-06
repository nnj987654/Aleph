import { describe, expect, it, vi } from 'vitest';
import { getStorageStatus, isNearQuota, requestPersistence } from '../../src/platform/storage';

describe('estado del almacenamiento', () => {
  it('informa de no soportado si el navegador no ofrece la API', async () => {
    expect(await getStorageStatus(undefined)).toEqual({ persisted: 'unsupported', usage: 0, quota: 0 });
    expect(await requestPersistence(undefined)).toBe('unsupported');
  });

  it('lee persistencia, uso y cuota', async () => {
    const nav = {
      storage: {
        persisted: async () => true,
        estimate: async () => ({ usage: 50, quota: 1000 }),
      },
    };
    expect(await getStorageStatus(nav)).toEqual({ persisted: 'persisted', usage: 50, quota: 1000 });
  });

  it('pide persistencia solo si todavía no la tiene', async () => {
    const persist = vi.fn(async () => true);
    const already = { storage: { persisted: async () => true, persist } };
    expect(await requestPersistence(already)).toBe('persisted');
    expect(persist).not.toHaveBeenCalled();

    const not = { storage: { persisted: async () => false, persist } };
    expect(await requestPersistence(not)).toBe('persisted');
    expect(persist).toHaveBeenCalledOnce();
  });

  it('refleja que el navegador deniegue la persistencia', async () => {
    const nav = { storage: { persisted: async () => false, persist: async () => false } };
    expect(await requestPersistence(nav)).toBe('not-persisted');
  });

  it('avisa cuando se acerca a la cuota', () => {
    expect(isNearQuota({ usage: 80, quota: 100 })).toBe(true);
    expect(isNearQuota({ usage: 79, quota: 100 })).toBe(false);
    expect(isNearQuota({ usage: 5, quota: 0 })).toBe(false);
  });
});
