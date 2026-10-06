import { describe, expect, it } from 'vitest';
import { commands } from '../../src/commands';
import { expectConsistent, makeApp, makeWorkspace } from '../helpers';

const SEEDS = (() => {
  const n = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env['FUZZ_SEEDS'] ?? 0);
  return n > 0 ? Array.from({ length: n }, (_, i) => i + 1) : [1, 2, 3, 4];
})();

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Prueba de propiedades: secuencias aleatorias de operaciones, con deshacer y
 * rehacer intercalados. Tras CADA paso: memoria == base de datos e invariantes
 * del árbol sanas. Al final, deshacer todo vuelve al estado inicial.
 */
describe('fuzz de comandos', () => {
  for (const seed of SEEDS) {
    it(`semilla ${seed}: el árbol y el estado nunca se desincronizan`, async () => {
      const rand = rng(seed);
      const app = await makeApp();
      const ws = await makeWorkspace(app);
      app.bus.clearHistory(); // no se deshace la creación del propio espacio
      const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(rand() * list.length)];
      const alive = () => [...app.store.allNodes()].filter((n) => n.deletedAt === undefined);
      const trashed = () => app.store.trashRoots.peek();
      let n = 0;
      let applied = 0;

      for (let step = 0; step < 140; step += 1) {
        const r = rand();
        const parent = pick(alive());
        try {
          if (r < 0.28 || !parent) {
            await app.bus.execute(
              commands.createNodeCmd({
                workspaceId: ws.id,
                title: `n${(n += 1)}`,
                parentId: rand() < 0.3 ? null : (parent?.id ?? null),
                ...(rand() < 0.5 && { index: Math.floor(rand() * 4) }),
              }),
            );
          } else if (r < 0.5) {
            const target = rand() < 0.2 ? null : (pick(alive())?.id ?? null);
            await app.bus.execute(commands.moveNodeCmd(parent.id, target, Math.floor(rand() * 5)));
          } else if (r < 0.6) {
            await app.bus.execute(commands.trashNodesCmd([parent.id]));
          } else if (r < 0.66) {
            const root = pick(trashed());
            if (root) await app.bus.execute(commands.restoreNodeCmd(root.id));
          } else if (r < 0.7) {
            await app.bus.execute(commands.duplicateNodeCmd(parent.id));
          } else if (r < 0.76) {
            await app.bus.execute(commands.renameNodeCmd(parent.id, `r${step}`));
          } else if (r < 0.8) {
            await app.bus.execute(commands.setContentCmd(parent.id, { type: 'doc' }, `t${step}`));
          } else if (r < 0.9) {
            await app.bus.undo();
          } else if (r < 0.97) {
            await app.bus.redo();
          } else {
            const root = pick(trashed());
            if (root) await app.bus.execute(commands.purgeNodeCmd(root.id));
          }
          applied += 1;
        } catch (error) {
          // Las únicas operaciones que pueden fallar son movimientos prohibidos (ciclo / destino eliminado).
          expect(['cycle', 'deleted-parent', 'deleted-node']).toContain((error as { code?: string }).code);
        }
        await expectConsistent(app, ws.id);
      }
      expect(applied).toBeGreaterThan(80);

      // Deshacer todo lo que quede en la pila deja un árbol sano.
      while (app.bus.undoDepth > 0) await app.bus.undo();
      await expectConsistent(app, ws.id);
    }, 120_000);
  }

  it('deshacer todo tras operaciones solo deshacibles restaura exactamente el estado inicial', async () => {
    const rand = rng(99);
    const app = await makeApp();
    const ws = await makeWorkspace(app);
    const seedNodes: Array<{ id: string }> = [];
    for (let i = 0; i < 6; i += 1) {
      seedNodes.push(await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: `s${i}`, parentId: i > 2 ? (seedNodes[i - 3]?.id ?? null) : null })));
    }
    app.bus.clearHistory();
    const snapshot = JSON.stringify([...app.store.allNodes()].map(({ rev: _r, updatedAt: _u, ...n }) => n).sort((a, b) => (a.id < b.id ? -1 : 1)));

    for (let step = 0; step < 60; step += 1) {
      const nodes = [...app.store.allNodes()].filter((x) => x.deletedAt === undefined);
      const a = nodes[Math.floor(rand() * nodes.length)]!;
      const b = nodes[Math.floor(rand() * nodes.length)]!;
      try {
        const r = rand();
        if (r < 0.4) await app.bus.execute(commands.moveNodeCmd(a.id, b.id));
        else if (r < 0.6) await app.bus.execute(commands.trashNodesCmd([a.id]));
        else if (r < 0.8) await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'x', parentId: b.id }));
        else await app.bus.execute(commands.duplicateNodeCmd(a.id));
      } catch {
        /* ciclo permitido */
      }
    }
    while (app.bus.undoDepth > 0) await app.bus.undo();
    const after = JSON.stringify([...app.store.allNodes()].map(({ rev: _r, updatedAt: _u, ...n }) => n).sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(after).toBe(snapshot);
    await expectConsistent(app, ws.id);
  }, 120_000);
});
