import { describe, expect, it } from 'vitest';
import { commands, StaleHistoryError } from '../../src/commands';
import { contentRepo } from '../../src/data';
import { ConflictError } from '../../src/errors';
import { dbNodes, expectConsistent, makeApp, makeWorkspace, titles } from '../helpers';

async function setup() {
  const app = await makeApp();
  const ws = await makeWorkspace(app);
  const mk = (title: string, parentId: string | null = null, index?: number) =>
    app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title, parentId, ...(index !== undefined && { index }) }));
  return { app, ws, mk };
}

describe('crear', () => {
  it('crea nodos ordenados, con contenido, y deshacer/rehacer los quita y devuelve', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    await mk('B');
    await mk('C', null, 1);
    expect(titles(app.store.getChildren(null))).toEqual(['A', 'C', 'B']);
    const content = await app.engine.transaction(['contents'], 'r', (tx) => contentRepo.get(tx, a.id));
    expect(content?.doc.type).toBe('doc');

    await app.bus.undo();
    expect(titles(app.store.getChildren(null))).toEqual(['A', 'B']);
    await app.bus.redo();
    expect(titles(app.store.getChildren(null))).toEqual(['A', 'C', 'B']);
    await expectConsistent(app, ws.id);
  });

  it('rechaza padres inexistentes, de la papelera o de otro espacio', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    await app.bus.execute(commands.trashNodesCmd([a.id]));
    await expect(mk('X', a.id)).rejects.toMatchObject({ code: 'deleted-parent' });
    await expect(mk('X', 'no-existe')).rejects.toMatchObject({ code: 'not-found' });
    const ws2 = await app.bus.execute(commands.createWorkspaceCmd({ name: 'Otro' }));
    const b = await mk('B');
    await expect(
      app.bus.execute(commands.createNodeCmd({ workspaceId: ws2.id, title: 'Y', parentId: b.id })),
    ).rejects.toMatchObject({ code: 'cross-workspace' });
    await expectConsistent(app, ws.id);
  });

  it('un comando que falla no deja nada a medias ni entra en el historial', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    const depth = app.bus.undoDepth;
    await expect(app.bus.execute(commands.moveNodeCmd(a.id, a.id))).rejects.toMatchObject({ code: 'cycle' });
    expect(app.bus.undoDepth).toBe(depth);
    await expectConsistent(app, ws.id);
  });
});

describe('mover y ordenar', () => {
  it('mueve a otro padre en una posición y lo deshace', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    const b = await mk('B');
    const c1 = await mk('c1', a.id);
    await mk('c2', a.id);
    await app.bus.execute(commands.moveNodeCmd(b.id, a.id, 1));
    expect(titles(app.store.getChildren(a.id))).toEqual(['c1', 'B', 'c2']);
    await app.bus.undo();
    expect(titles(app.store.getChildren(a.id))).toEqual(['c1', 'c2']);
    expect(titles(app.store.getChildren(null))).toEqual(['A', 'B']);
    expect(app.store.getNode(c1.id)?.parentId).toBe(a.id);
    await expectConsistent(app, ws.id);
  });

  it('reordena dentro del mismo padre contando solo los demás hermanos', async () => {
    const { app, mk } = await setup();
    const [a, b, c] = [await mk('A'), await mk('B'), await mk('C')];
    await app.bus.execute(commands.moveNodeCmd(a.id, null, 2));
    expect(titles(app.store.getChildren(null))).toEqual(['B', 'C', 'A']);
    await app.bus.execute(commands.moveNodesCmd([c.id, b.id], null, 0));
    expect(titles(app.store.getChildren(null))).toEqual(['C', 'B', 'A']);
  });

  it('impide mover un nodo dentro de sí mismo o de sus descendientes', async () => {
    const { app, mk } = await setup();
    const a = await mk('A');
    const b = await mk('B', a.id);
    const c = await mk('C', b.id);
    await expect(app.bus.execute(commands.moveNodeCmd(a.id, c.id))).rejects.toMatchObject({ code: 'cycle' });
    await expect(app.bus.execute(commands.moveNodeCmd(a.id, a.id))).rejects.toMatchObject({ code: 'cycle' });
  });

  it('reindexa los hermanos si insertar siempre en el mismo hueco alarga las claves', async () => {
    const { app, ws, mk } = await setup();
    await mk('0');
    await mk('1');
    for (let i = 0; i < 120; i += 1) await mk(`n${i}`, null, 1);
    const orders = app.store.getChildren(null).map((n) => n.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect(orders.every((o, i) => i === 0 || (orders[i - 1] as string) < o)).toBe(true);
    expect(Math.max(...orders.map((o) => o.length))).toBeLessThan(32);
    await expectConsistent(app, ws.id);
  }, 30_000);
});

describe('papelera', () => {
  it('envía el subárbol a la papelera, lo restaura y conserva lo eliminado antes', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    const b = await mk('B', a.id);
    const c = await mk('C', b.id);
    const d = await mk('D', a.id);
    await app.bus.execute(commands.trashNodesCmd([b.id])); // B y C
    await app.bus.execute(commands.trashNodesCmd([a.id])); // A y D (B/C siguen siendo suyos)
    expect(app.store.nodeCount.peek()).toBe(0);
    expect(app.store.trashRoots.peek().map((n) => n.title).sort()).toEqual(['A', 'B']);

    await app.bus.execute(commands.restoreNodeCmd(a.id));
    expect(titles(app.store.getChildren(null))).toEqual(['A']);
    expect(titles(app.store.getChildren(a.id))).toEqual(['D']);
    expect(app.store.getNode(c.id)?.deletedAt).toBeDefined();
    expect(app.store.trashRoots.peek().map((n) => n.title)).toEqual(['B']);
    await expectConsistent(app, ws.id);

    await app.bus.execute(commands.restoreNodeCmd(b.id));
    expect(titles(app.store.getChildren(b.id))).toEqual(['C']);
    expect(app.store.getNode(d.id)?.deletedAt).toBeUndefined();
    await expectConsistent(app, ws.id);
  });

  it('restaura en la raíz si el padre sigue en la papelera', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    const b = await mk('B', a.id);
    await app.bus.execute(commands.trashNodesCmd([b.id]));
    await app.bus.execute(commands.trashNodesCmd([a.id]));
    await app.bus.execute(commands.restoreNodeCmd(b.id));
    expect(app.store.getNode(b.id)?.parentId).toBeNull();
    expect(app.store.getNode(a.id)?.deletedAt).toBeDefined();
    await expectConsistent(app, ws.id);
  });

  it('mandar a la papelera se deshace', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    await mk('B', a.id);
    await app.bus.execute(commands.trashNodesCmd([a.id]));
    await app.bus.undo();
    expect(app.store.nodeCount.peek()).toBe(2);
    expect(app.store.trashRoots.peek()).toEqual([]);
    await expectConsistent(app, ws.id);
  });

  it('purgar y vaciar borran para siempre y vacían el historial', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    const b = await mk('B', a.id);
    const c = await mk('C');
    await app.bus.execute(commands.trashNodesCmd([a.id]));
    await app.bus.execute(commands.purgeNodeCmd(a.id));
    expect(app.bus.undoDepth).toBe(0);
    expect(app.store.getNode(b.id)).toBeUndefined();
    expect((await dbNodes(app, ws.id)).map((n) => n.title)).toEqual(['C']);
    await app.bus.execute(commands.trashNodesCmd([c.id]));
    await app.bus.execute(commands.emptyTrashCmd(ws.id));
    expect(await dbNodes(app, ws.id)).toEqual([]);
    expect(app.store.trashRoots.peek()).toEqual([]);
    const left = await app.engine.transaction(['contents'], 'r', (tx) => tx.count('contents'));
    expect(left).toBe(0);
    await expectConsistent(app, ws.id);
  });
});

describe('duplicar', () => {
  it('copia el subárbol con sus contenidos, justo después del original', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    await mk('B');
    const a1 = await mk('a1', a.id);
    await app.bus.execute(commands.setContentCmd(a1.id, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hola' }] }] }, 'hola'));
    const copy = await app.bus.execute(commands.duplicateNodeCmd(a.id));
    expect(titles(app.store.getChildren(null))).toEqual(['A', 'A (copia)', 'B']);
    const kid = app.store.getChildren(copy.id)[0]!;
    expect(kid.title).toBe('a1');
    expect(kid.id).not.toBe(a1.id);
    const c = await app.engine.transaction(['contents'], 'r', (tx) => contentRepo.get(tx, kid.id));
    expect(c?.textCache).toBe('hola');
    await app.bus.undo();
    expect(titles(app.store.getChildren(null))).toEqual(['A', 'B']);
    await expectConsistent(app, ws.id);
  });
});

describe('contenido y coalescencia', () => {
  it('ediciones seguidas se funden en un paso; deshacer vuelve al estado anterior', async () => {
    const { app, mk } = await setup();
    const a = await mk('A');
    const depth = app.bus.undoDepth;
    const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] });
    for (const s of ['h', 'ho', 'hol', 'hola']) await app.bus.execute(commands.setContentCmd(a.id, doc(s), s));
    expect(app.bus.undoDepth).toBe(depth + 1);
    const read = () => app.engine.transaction(['contents'], 'r', (tx) => contentRepo.get(tx, a.id));
    expect((await read())?.textCache).toBe('hola');
    await app.bus.undo();
    expect((await read())?.textCache).toBe('');
    await app.bus.redo();
    expect((await read())?.textCache).toBe('hola');
  });

  it('no funde ediciones de nodos distintos ni separadas por otro comando', async () => {
    const { app, mk } = await setup();
    const a = await mk('A');
    const b = await mk('B');
    const d = { type: 'doc' };
    const base = app.bus.undoDepth;
    await app.bus.execute(commands.setContentCmd(a.id, d, '1'));
    await app.bus.execute(commands.setContentCmd(b.id, d, '2'));
    await app.bus.execute(commands.setContentCmd(a.id, d, '3'));
    expect(app.bus.undoDepth).toBe(base + 3);
  });

  it('renombrar seguido también se funde', async () => {
    const { app, mk } = await setup();
    const a = await mk('A');
    for (const t of ['N', 'Nu', 'Nue']) await app.bus.execute(commands.renameNodeCmd(a.id, t));
    await app.bus.undo();
    expect(app.store.getNode(a.id)?.title).toBe('A');
  });
});

describe('historial', () => {
  it('una operación nueva borra el «rehacer»; las etiquetas se publican', async () => {
    const { app, mk } = await setup();
    await mk('A');
    expect(app.bus.undoLabel.peek()).toMatchObject({ id: 'cmd.node.create' });
    await app.bus.undo();
    expect(app.bus.redoLabel.peek()).toMatchObject({ id: 'cmd.node.create' });
    await mk('B');
    expect(app.bus.redoLabel.peek()).toBeNull();
    expect(await app.bus.redo()).toBeNull();
  });

  it('limita el número de pasos', async () => {
    const app = await makeApp({ bus: { maxEntries: 5 } });
    const ws = await makeWorkspace(app);
    for (let i = 0; i < 12; i += 1) await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: `n${i}` }));
    expect(app.bus.undoDepth).toBe(5);
  });

  it('detecta un deshacer obsoleto (otro lugar modificó el registro) y no toca nada', async () => {
    const { app, ws, mk } = await setup();
    const a = await mk('A');
    await app.bus.execute(commands.moveNodeCmd(a.id, null, 0));
    // Otra pestaña cambia el nodo directamente en la base.
    await app.engine.transaction(['nodes'], 'rw', async (tx) => {
      const { nodeRepo } = await import('../../src/data');
      await nodeRepo.update(tx, a.id, { title: 'Cambiado fuera' });
    });
    await app.bus.undo().catch(() => undefined); // el movimiento sin cambios netos no entra en el historial
    const before = (await dbNodes(app, ws.id)).find((n) => n.id === a.id)!;
    await app.bus.execute(commands.renameNodeCmd(a.id, 'Dentro'));
    await app.engine.transaction(['nodes'], 'rw', async (tx) => {
      const { nodeRepo } = await import('../../src/data');
      await nodeRepo.update(tx, a.id, { title: 'Fuera otra vez' });
    });
    await expect(app.bus.undo()).rejects.toBeInstanceOf(StaleHistoryError);
    const after = (await dbNodes(app, ws.id)).find((n) => n.id === a.id)!;
    expect(after.title).toBe('Fuera otra vez');
    expect(after.rev).toBeGreaterThan(before.rev);
  });
});

describe('concurrencia optimista (repositorio)', () => {
  it('update con expectedRev desfasada lanza ConflictError', async () => {
    const { app, mk } = await setup();
    const a = await mk('A');
    const { nodeRepo } = await import('../../src/data');
    await expect(
      app.engine.transaction(['nodes'], 'rw', (tx) => nodeRepo.update(tx, a.id, { title: 'x' }, { expectedRev: 99 })),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
