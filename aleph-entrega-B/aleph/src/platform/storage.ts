/**
 * Estado y protección del almacenamiento del navegador (documento base §4.1).
 *
 * IndexedDB es almacenamiento «del navegador», no del usuario: puede borrarse
 * al limpiar datos del sitio o por falta de espacio. `persist()` pide al
 * navegador que no lo haga sin permiso explícito.
 */

export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

export interface StorageStatus {
  persisted: PersistState;
  usage: number;
  quota: number;
}

type NavLike = { storage?: Partial<StorageManager> } | undefined;

function defaultNav(): NavLike {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

export async function getStorageStatus(nav: NavLike = defaultNav()): Promise<StorageStatus> {
  const storage = nav?.storage;
  if (!storage) return { persisted: 'unsupported', usage: 0, quota: 0 };

  let persisted: PersistState = 'unsupported';
  if (storage.persisted) {
    persisted = (await storage.persisted()) ? 'persisted' : 'not-persisted';
  }
  let usage = 0;
  let quota = 0;
  if (storage.estimate) {
    const est = await storage.estimate();
    usage = est.usage ?? 0;
    quota = est.quota ?? 0;
  }
  return { persisted, usage, quota };
}

/**
 * Pide almacenamiento persistente. Se llama en el primer uso significativo
 * (al crear el primer contenido), no al abrir la página. El navegador puede
 * concederlo o no (Firefox pregunta al usuario; Chromium decide por uso).
 */
export async function requestPersistence(nav: NavLike = defaultNav()): Promise<PersistState> {
  const storage = nav?.storage;
  if (!storage?.persist) return 'unsupported';
  if (storage.persisted && (await storage.persisted())) return 'persisted';
  return (await storage.persist()) ? 'persisted' : 'not-persisted';
}

/** ¿Se ha superado la proporción indicada de la cuota? (por defecto 80 %) */
export function isNearQuota(status: Pick<StorageStatus, 'usage' | 'quota'>, ratio = 0.8): boolean {
  return status.quota > 0 && status.usage / status.quota >= ratio;
}
