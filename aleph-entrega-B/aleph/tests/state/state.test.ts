import { describe, expect, it, vi } from 'vitest';
import { Router, formatRoute, parseRoute } from '../../src/app/router';
import type { Route, WindowLike } from '../../src/app/router';
import { createApp } from '../../src/app/app';
import { commands } from '../../src/commands';
import { effect } from '../../src/core/reactive';
import type { ChannelLike } from '../../src/state/tab-sync';
import { expectConsistent, fakeClock, makeApp, makeWorkspace, titles, uniqueDb } from '../helpers';

describe('estado reactivo', () => {
  it('las señales por nodo y por lista de hijos avisan solo a quien corresponde', async () => {
    const app = await makeApp();
    const ws = await makeWorkspace(app);
    const a = await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'A' }));
    const b = await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'B' }));

    const rootRuns = vi.fn();
    const aRuns = vi.fn();
    const bRuns = vi.fn();
    effect(() => void rootRuns(titles(app.store.children(null).get())));
    effect(() => void aRuns(app.store.node(a.id).get()?.title));
    effect(() => void bRuns(app.store.node(b.id).get()?.title));

    await app.bus.execute(commands.renameNodeCmd(a.id, 'A2'));
    expect(aRuns).toHaveBeenLastCalledWith('A2');
    expect(bRuns).toHaveBeenCalledTimes(1);

    // Crear un hijo de A no cambia la lista de la raíz.
    const before = rootRuns.mock.calls.length;
    await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'hijo', parentId: a.id }));
    expect(rootRuns.mock.calls.length).toBe(before);
    expect(titles(app.store.getChildren(a.id))).toEqual(['hijo']);
  });

  it('favoritos y papelera se mantienen al día', async () => {
    const app = await makeApp();
    const ws = await makeWorkspace(app);
    const a = await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'A' }));
    await app.bus.execute(commands.setFavoriteCmd(a.id, true));
    expect(app.store.favorites.peek().map((n) => n.title)).toEqual(['A']);
    await app.bus.execute(commands.trashNodesCmd([a.id]));
    expect(app.store.favorites.peek()).toEqual([]);
    expect(app.store.trashRoots.peek().map((n) => n.title)).toEqual(['A']);
    await app.bus.undo();
    expect(app.store.favorites.peek().map((n) => n.title)).toEqual(['A']);
  });

  it('calcula la ruta de migas de pan y carga el estado al reabrir la base', async () => {
    const dbName = uniqueDb();
    const app = await makeApp({ dbName });
    const ws = await makeWorkspace(app);
    const a = await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'A' }));
    const b = await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'B', parentId: a.id }));
    expect(titles(app.store.path(b.id))).toEqual(['A', 'B']);
    app.dispose();

    const again = await createApp({ engineOptions: { name: dbName }, bus: { clock: fakeClock() }, tabSync: false });
    expect(again.store.workspaces.peek().map((w) => w.name)).toEqual(['Estudios']);
    await again.openWorkspace(ws.id);
    expect(titles(again.store.path(b.id))).toEqual(['A', 'B']);
    await expectConsistent(again, ws.id);
  });

  it('borrar un espacio lo quita del estado', async () => {
    const app = await makeApp();
    const ws = await makeWorkspace(app);
    await app.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'A' }));
    await app.bus.execute(commands.deleteWorkspaceCmd(ws.id));
    expect(app.store.workspaces.peek()).toEqual([]);
    expect(app.store.currentWorkspaceId.peek()).toBeNull();
    expect([...app.store.allNodes()]).toEqual([]);
  });
});

/** Canal en memoria compartido entre «pestañas» (BroadcastChannel no entrega a quien envía). */
function memoryBus() {
  const channels = new Set<ChannelLike>();
  return (): ChannelLike => {
    const ch: ChannelLike = {
      onmessage: null,
      postMessage(message) {
        for (const other of channels) if (other !== ch) queueMicrotask(() => other.onmessage?.({ data: message }));
      },
      close() {
        channels.delete(ch);
      },
    };
    channels.add(ch);
    return ch;
  };
}

describe('sincronización entre pestañas', () => {
  it('lo que hace una pestaña aparece en la otra, incluido deshacer', async () => {
    const dbName = uniqueDb();
    const factory = memoryBus();
    const mk = () => createApp({ engineOptions: { name: dbName }, bus: { clock: fakeClock() }, tabSync: { factory: () => factory() } });
    const tab1 = await mk();
    const ws = await tab1.bus.execute(commands.createWorkspaceCmd({ name: 'E' }));
    const tab2 = await mk();
    await tab1.openWorkspace(ws.id);
    await tab2.openWorkspace(ws.id);

    const settle = () => new Promise((r) => setTimeout(r, 30));
    const a = await tab1.bus.execute(commands.createNodeCmd({ workspaceId: ws.id, title: 'A' }));
    await settle();
    expect(titles(tab2.store.getChildren(null))).toEqual(['A']);

    await tab2.bus.execute(commands.renameNodeCmd(a.id, 'A2'));
    await settle();
    expect(tab1.store.getNode(a.id)?.title).toBe('A2');

    await tab1.bus.execute(commands.trashNodesCmd([a.id]));
    await settle();
    expect(tab2.store.nodeCount.peek()).toBe(0);
    await tab1.bus.undo();
    await settle();
    expect(tab2.store.nodeCount.peek()).toBe(1);
    await expectConsistent(tab2, ws.id);
  });
});

describe('router', () => {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'settings' },
    { name: 'workspace', workspaceId: 'w1' },
    { name: 'trash', workspaceId: 'w1' },
    { name: 'node', workspaceId: 'w1', nodeId: 'n 1/x' },
  ];
  it('formatea y analiza rutas (ida y vuelta)', () => {
    for (const r of routes) expect(parseRoute(formatRoute(r))).toEqual(r);
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/w/a/n')).toMatchObject({ name: 'not-found' });
    expect(parseRoute('#/nada')).toMatchObject({ name: 'not-found' });
  });

  it('reacciona a hashchange y navega', () => {
    let listener: () => void = () => {};
    const win: WindowLike = {
      location: { hash: '#/w/x' },
      addEventListener: (_t, l) => (listener = l),
      removeEventListener: () => {},
    };
    const router = new Router(win);
    expect(router.route.peek()).toEqual({ name: 'workspace', workspaceId: 'x' });
    router.navigate({ name: 'trash', workspaceId: 'x' });
    expect(win.location.hash).toBe('#/w/x/papelera');
    listener();
    expect(router.route.peek()).toEqual({ name: 'trash', workspaceId: 'x' });
  });
});
