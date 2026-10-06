/**
 * Benchmark en navegador real (IndexedDB de verdad, no simulada).
 * Uso: `npm run bench` (arranca Vite y lo ejecuta en Chromium sin interfaz).
 */
import { createApp } from '../src/app/app';
import { commands } from '../src/commands';
import { contentRepo, nodeRepo } from '../src/data';
import { createNodeContent, createNodeHeader } from '../src/domain/factories';
import { spread } from '../src/domain/order';
import { buildChildrenIndex, checkTreeInvariants, flattenVisible } from '../src/domain/tree';
import type { NodeHeader } from '../src/domain/types';

const TOTAL = Number(new URLSearchParams(location.search).get('n') ?? 10_000);
const results: Record<string, number | string> = {};

async function time<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now();
  const r = await fn();
  results[name] = Math.round((performance.now() - t0) * 10) / 10;
  return r;
}

async function main(): Promise<void> {
  const dbName = `aleph-bench-${Date.now()}`;
  let app = await createApp({ engineOptions: { name: dbName }, tabSync: false });
  const ws = await app.bus.execute(commands.createWorkspaceCmd({ name: 'Benchmark' }));

  // Árbol de ramificación 10 (10 + 100 + 1.000 + 10.000…) hasta TOTAL nodos.
  const nodes: NodeHeader[] = [];
  const queue: Array<string | null> = [null];
  const keys = spread(10);
  while (nodes.length < TOTAL) {
    const parent = queue.shift() ?? null;
    for (let i = 0; i < 10 && nodes.length < TOTAL; i += 1) {
      const n = createNodeHeader({ workspaceId: ws.id, title: `Nodo ${nodes.length}`, order: keys[i]!, parentId: parent });
      nodes.push(n);
      queue.push(n.id);
    }
  }
  await time('insertar_en_bloque_ms', () =>
    app.engine.transaction(['nodes', 'contents'], 'rw', async (tx) => {
      for (const n of nodes) {
        await nodeRepo.put(tx, n);
        await contentRepo.put(tx, createNodeContent(n.id));
      }
    }),
  );
  app.dispose();

  // Arranque en frío: abrir la base y cargar el espacio en memoria.
  app = await createApp({ engineOptions: { name: dbName }, tabSync: false });
  await time('abrir_espacio_ms', () => app.openWorkspace(ws.id));
  results['nodos'] = app.store.nodeCount.peek();

  const all = [...app.store.allNodes()];
  await time('indice_hijos_ms', () => buildChildrenIndex(all));
  const index = buildChildrenIndex(all);
  const expanded = new Set(all.map((n) => n.id));
  await time('aplanar_todo_desplegado_ms', () => flattenVisible(index, expanded));
  await time('invariantes_ms', () => {
    const issues = checkTreeInvariants(all);
    if (issues.length) throw new Error('Árbol inválido');
  });

  const roots = app.store.getChildren(null);
  const top = roots[0]!;
  await time('crear_nodo_ms', () => app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'Nuevo', parentId: top.id })));
  await time('renombrar_ms', () => app.bus.execute(commands.renameNodeCmd(top.id, 'Renombrado')));
  const leaf = all[all.length - 1]!;
  await time('mover_hoja_ms', () => app.bus.execute(commands.moveNodeCmd(leaf.id, roots[1]!.id, 0)));
  await time('mover_subarbol_ms', () => app.bus.execute(commands.moveNodeCmd(roots[2]!.id, roots[3]!.id)));
  await time('deshacer_mover_ms', () => app.bus.undo());
  await time('duplicar_subarbol_ms', () => app.bus.execute(commands.duplicateNodeCmd(roots[4]!.id)));
  const aliveBefore = app.store.nodeCount.peek();
  await time('papelera_subarbol_ms', () => app.bus.execute(commands.trashNodesCmd([roots[5]!.id])));
  results['papelera_nodos'] = aliveBefore - app.store.nodeCount.peek();
  await time('deshacer_papelera_ms', () => app.bus.undo());
  await time('insertar_200_mismo_hueco_ms', async () => {
    for (let i = 0; i < 200; i += 1) await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: `h${i}`, parentId: roots[6]!.id, index: 1 }));
  });
  await time('deshacer_200_ms', async () => {
    for (let i = 0; i < 200; i += 1) await app.bus.undo();
  });
  await time('escribir_contenido_ms', () => app.bus.execute(commands.setContentCmd(leaf.id, { type: 'doc' }, 'x')));

  const st = await app.engine.estimate();
  results['uso_almacenamiento_MB'] = Math.round(st.usage / 1e4) / 100;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  if (mem) results['heap_MB'] = Math.round(mem.usedJSHeapSize / 1e4) / 100;
  results['ua'] = navigator.userAgent;
  app.dispose();
}

main()
  .then(() => {
    (window as unknown as { __bench: unknown }).__bench = results;
    document.getElementById('out')!.textContent = JSON.stringify(results, null, 2);
  })
  .catch((e: unknown) => {
    (window as unknown as { __benchError: string }).__benchError = String(e instanceof Error ? e.stack : e);
    document.getElementById('out')!.textContent = `ERROR: ${String(e)}`;
  });
