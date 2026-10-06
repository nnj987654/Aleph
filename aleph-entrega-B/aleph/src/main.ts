/**
 * Página de comprobación de la Entrega A. NO es la interfaz de Aleph (esa
 * llega en la Entrega C): solo abre la base de datos y muestra su estado para
 * confirmar que todo funciona en tu navegador. Los textos de esta página son
 * provisionales; la interfaz real los tomará del catálogo de idioma.
 */
import { IndexedDBEngine, workspaceRepo, nodeRepo, metaRepo } from './data';
import { getStorageStatus } from './platform/storage';

async function arrancar(): Promise<void> {
  const out = document.getElementById('estado');
  if (!out) return;

  try {
    const engine = new IndexedDBEngine({
      onVersionChange: () => {
        out.textContent = 'Aleph se actualizó en otra pestaña. Recarga esta página.';
      },
    });
    await engine.open();

    const { espacios, nodos, version, dispositivo } = await engine.transaction(
      ['workspaces', 'nodes', 'meta'],
      'r',
      async (tx) => {
        const lista = await workspaceRepo.list(tx);
        let total = 0;
        for (const w of lista) total += await nodeRepo.count(tx, w.id);
        return {
          espacios: lista.length,
          nodos: total,
          version: await metaRepo.get<number>(tx, 'schemaVersion'),
          dispositivo: await metaRepo.get<string>(tx, 'deviceId'),
        };
      },
    );

    const estado = await getStorageStatus();
    const proteccion =
      estado.persisted === 'persisted'
        ? 'protegido'
        : estado.persisted === 'not-persisted'
          ? 'sin proteger (el navegador podría borrarlo)'
          : 'no disponible en este navegador';

    out.textContent =
      `Base de datos abierta (esquema v${version}). ` +
      `${espacios} espacios, ${nodos} páginas. ` +
      `Almacenamiento ${proteccion}. Dispositivo ${dispositivo?.slice(0, 8) ?? '?'}.`;
  } catch (e) {
    out.textContent = `No se pudo abrir la base de datos: ${e instanceof Error ? e.message : String(e)}`;
  }
}

void arrancar();
