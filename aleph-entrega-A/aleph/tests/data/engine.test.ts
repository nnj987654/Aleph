import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  IndexedDBEngine,
  MIGRATIONS,
  STORE_NAMES,
  contentRepo,
  metaRepo,
  nodeRepo,
  planMigrations,
  updateAll,
  workspaceRepo,
} from '../../src/data';
import type { Migration } from '../../src/data';
import { ConflictError, NotFoundError, StorageError } from '../../src/errors';
import { createNodeContent, createNodeHeader, createWorkspace } from '../../src/domain/factories';
import { spread } from '../../src/domain/order';

let counter = 0;
const uniqueName = () => `aleph-test-${Date.now()}-${(counter += 1)}`;

async function openEngine(name = uniqueName(), migrations?: readonly Migration[]) {
  const engine = new IndexedDBEngine(migrations ? { name, migrations } : { name });
  await engine.open();
  return { engine, name };
}

const [K0, K1, K2] = spread(3) as [string, string, string];

describe('motor IndexedDB', () => {
  it('crea todos los almacenes y registra versión y dispositivo', async () => {
    const { engine } = await openEngine();
    for (const store of STORE_NAMES) {
      expect(await engine.transaction([store], 'r', (tx) => tx.count(store))).toBeGreaterThanOrEqual(0);
    }
    const meta = await engine.transaction(['meta'], 'r', async (tx) => ({
      version: await metaRepo.get<number>(tx, 'schemaVersion'),
      device: await metaRepo.get<string>(tx, 'deviceId'),
    }));
    expect(meta.version).toBe(1);
    expect(meta.device).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('conserva los datos y el id de dispositivo al cerrar y reabrir', async () => {
    const { engine, name } = await openEngine();
    const ws = createWorkspace({ name: 'Universidad', order: K0 });
    const device1 = await engine.transaction(['workspaces', 'meta'], 'rw', async (tx) => {
      await workspaceRepo.put(tx, ws);
      return metaRepo.get<string>(tx, 'deviceId');
    });
    engine.close();

    const again = new IndexedDBEngine({ name });
    await again.open();
    const { list, device2 } = await again.transaction(['workspaces', 'meta'], 'r', async (tx) => ({
      list: await workspaceRepo.list(tx),
      device2: await metaRepo.get<string>(tx, 'deviceId'),
    }));
    expect(list).toEqual([ws]);
    expect(device2).toBe(device1);
  });

  it('falla con un error claro si se usa sin abrir', async () => {
    const engine = new IndexedDBEngine({ name: uniqueName() });
    await expect(engine.transaction(['meta'], 'r', async () => 1)).rejects.toMatchObject({
      code: 'closed',
    });
  });

  it('es atómico: si algo falla dentro de la transacción no se guarda nada', async () => {
    const { engine } = await openEngine();
    const ws = createWorkspace({ name: 'W', order: K0 });
    const a = createNodeHeader({ workspaceId: ws.id, title: 'A', order: K0 });

    await expect(
      engine.transaction(['workspaces', 'nodes'], 'rw', async (tx) => {
        await workspaceRepo.put(tx, ws);
        await nodeRepo.put(tx, a);
        throw new Error('fallo a mitad de camino');
      }),
    ).rejects.toThrow('fallo a mitad de camino');

    const after = await engine.transaction(['workspaces', 'nodes'], 'r', async (tx) => ({
      ws: await workspaceRepo.list(tx),
      node: await nodeRepo.get(tx, a.id),
    }));
    expect(after.ws).toEqual([]);
    expect(after.node).toBeUndefined();
  });

  it('una violación de unicidad aborta toda la transacción', async () => {
    const { engine } = await openEngine();
    await engine.transaction(['tags'], 'rw', (tx) =>
      tx.put('tags', { id: 't1', name: 'Examen', nameNorm: 'examen' }),
    );
    await expect(
      engine.transaction(['tags', 'meta'], 'rw', async (tx) => {
        await metaRepo.set(tx, 'marca', 1);
        await tx.put('tags', { id: 't2', name: 'EXAMEN', nameNorm: 'examen' }); // duplicado
      }),
    ).rejects.toBeDefined();
    const marca = await engine.transaction(['meta'], 'r', (tx) => metaRepo.get(tx, 'marca'));
    expect(marca).toBeUndefined();
  });
});

describe('repositorios', () => {
  it('lista los espacios ordenados por su clave de orden', async () => {
    const { engine } = await openEngine();
    const b = createWorkspace({ name: 'B', order: K1 });
    const a = createWorkspace({ name: 'A', order: K0 });
    const c = createWorkspace({ name: 'C', order: K2 });
    await engine.transaction(['workspaces'], 'rw', async (tx) => {
      for (const w of [b, c, a]) await workspaceRepo.put(tx, w);
    });
    const names = (await engine.transaction(['workspaces'], 'r', (tx) => workspaceRepo.list(tx))).map(
      (w) => w.name,
    );
    expect(names).toEqual(['A', 'B', 'C']);
  });

  it('devuelve los hijos de cada padre (y de la raíz) ordenados, sin campos internos', async () => {
    const { engine } = await openEngine();
    const ws = createWorkspace({ name: 'W', order: K0 });
    const root = createNodeHeader({ workspaceId: ws.id, title: 'Raíz', order: K0 });
    const root2 = createNodeHeader({ workspaceId: ws.id, title: 'Raíz 2', order: K1 });
    const c2 = createNodeHeader({ workspaceId: ws.id, title: 'Hijo 2', order: K1, parentId: root.id });
    const c1 = createNodeHeader({ workspaceId: ws.id, title: 'Hijo 1', order: K0, parentId: root.id });
    const other = createNodeHeader({ workspaceId: 'otro-espacio', title: 'Ajeno', order: K0 });

    await engine.transaction(['nodes'], 'rw', async (tx) => {
      for (const n of [c2, root2, other, c1, root]) await nodeRepo.put(tx, n);
    });

    const { roots, kids, all } = await engine.transaction(['nodes'], 'r', async (tx) => ({
      roots: await nodeRepo.listChildren(tx, ws.id, null),
      kids: await nodeRepo.listChildren(tx, ws.id, root.id),
      all: await nodeRepo.listByWorkspace(tx, ws.id),
    }));
    expect(roots.map((n) => n.title)).toEqual(['Raíz', 'Raíz 2']);
    expect(kids.map((n) => n.title)).toEqual(['Hijo 1', 'Hijo 2']);
    expect(all).toHaveLength(4);
    expect(roots[0]).toEqual(root); // sin `parentKey`
    expect('parentKey' in (roots[0] as object)).toBe(false);
  });

  it('separa vivos y eliminados (papelera)', async () => {
    const { engine } = await openEngine();
    const ws = 'w1';
    const live = createNodeHeader({ workspaceId: ws, title: 'Vivo', order: K0 });
    const gone = createNodeHeader({
      workspaceId: ws,
      title: 'Borrado',
      order: K1,
      deletedAt: 1000,
      deletedRootId: 'x',
    });
    await engine.transaction(['nodes'], 'rw', async (tx) => {
      await nodeRepo.put(tx, live);
      await nodeRepo.put(tx, gone);
    });
    const r = await engine.transaction(['nodes'], 'r', async (tx) => ({
      children: await nodeRepo.listChildren(tx, ws, null),
      withDeleted: await nodeRepo.listChildren(tx, ws, null, { includeDeleted: true }),
      trash: await nodeRepo.listDeleted(tx, ws),
      byWs: await nodeRepo.listByWorkspace(tx, ws),
    }));
    expect(r.children.map((n) => n.title)).toEqual(['Vivo']);
    expect(r.withDeleted.map((n) => n.title)).toEqual(['Vivo', 'Borrado']);
    expect(r.trash.map((n) => n.title)).toEqual(['Borrado']);
    expect(r.byWs.map((n) => n.title)).toEqual(['Vivo']);
  });

  it('update incrementa la revisión y detecta ediciones concurrentes', async () => {
    const { engine } = await openEngine();
    const n = createNodeHeader({ workspaceId: 'w', title: 'Original', order: K0 });
    await engine.transaction(['nodes'], 'rw', (tx) => nodeRepo.put(tx, n));

    const updated = await engine.transaction(['nodes'], 'rw', (tx) =>
      nodeRepo.update(tx, n.id, { title: 'Nuevo' }, { expectedRev: 0, now: 5000 }),
    );
    expect(updated).toMatchObject({ title: 'Nuevo', rev: 1, updatedAt: 5000 });

    await expect(
      engine.transaction(['nodes'], 'rw', (tx) =>
        nodeRepo.update(tx, n.id, { title: 'Pisado' }, { expectedRev: 0 }), // revisión vieja
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      engine.transaction(['nodes'], 'rw', (tx) => nodeRepo.update(tx, 'no-existe', { title: 'x' })),
    ).rejects.toBeInstanceOf(NotFoundError);

    const stored = await engine.transaction(['nodes'], 'r', (tx) => nodeRepo.get(tx, n.id));
    expect(stored?.title).toBe('Nuevo'); // el intento conflictivo no escribió nada
  });

  it('mover un nodo cambia solo su registro', async () => {
    const { engine } = await openEngine();
    const p = createNodeHeader({ workspaceId: 'w', title: 'P', order: K0 });
    const q = createNodeHeader({ workspaceId: 'w', title: 'Q', order: K1 });
    const x = createNodeHeader({ workspaceId: 'w', title: 'X', order: K0, parentId: p.id });
    await engine.transaction(['nodes'], 'rw', async (tx) => {
      for (const n of [p, q, x]) await nodeRepo.put(tx, n);
    });
    await engine.transaction(['nodes'], 'rw', (tx) =>
      nodeRepo.update(tx, x.id, { parentId: q.id }),
    );
    const r = await engine.transaction(['nodes'], 'r', async (tx) => ({
      enP: await nodeRepo.listChildren(tx, 'w', p.id),
      enQ: await nodeRepo.listChildren(tx, 'w', q.id),
    }));
    expect(r.enP).toEqual([]);
    expect(r.enQ.map((n) => n.title)).toEqual(['X']);
  });

  it('guarda y recupera contenido aparte de la cabecera', async () => {
    const { engine } = await openEngine();
    const content = createNodeContent(
      'nodo-1',
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }] },
      'Hola',
    );
    await engine.transaction(['contents'], 'rw', (tx) => contentRepo.put(tx, content));
    expect(await engine.transaction(['contents'], 'r', (tx) => contentRepo.get(tx, 'nodo-1'))).toEqual(
      content,
    );
    await engine.transaction(['contents'], 'rw', (tx) => contentRepo.delete(tx, 'nodo-1'));
    expect(
      await engine.transaction(['contents'], 'r', (tx) => contentRepo.get(tx, 'nodo-1')),
    ).toBeUndefined();
  });

  // Volumen moderado a propósito: el simulador de IndexedDB de las pruebas (fake-indexeddb)
  // mantiene los índices con coste cuadrático (con 10.000 nodos tarda decenas de segundos,
  // algo que no ocurre en un navegador real). El presupuesto de 10.000 nodos se mide en el
  // navegador con el banco de pruebas de la Entrega C.
  it('maneja 2.000 nodos: carga de espacio y consulta de hijos', async () => {
    const { engine } = await openEngine();
    const ws = 'grande';
    const keys = spread(100);
    const nodes = [] as ReturnType<typeof createNodeHeader>[];
    const roots: string[] = [];
    for (let r = 0; r < 20; r += 1) {
      const root = createNodeHeader({ workspaceId: ws, title: `R${r}`, order: keys[r] as string });
      roots.push(root.id);
      nodes.push(root);
      for (let c = 0; c < 99; c += 1) {
        nodes.push(
          createNodeHeader({
            workspaceId: ws,
            title: `R${r}-${c}`,
            order: keys[c] as string,
            parentId: root.id,
          }),
        );
      }
    }
    expect(nodes).toHaveLength(2_000);

    await engine.transaction(['nodes'], 'rw', async (tx) => {
      await Promise.all(nodes.map((n) => nodeRepo.put(tx, n)));
    });

    const t0 = performance.now();
    const all = await engine.transaction(['nodes'], 'r', (tx) => nodeRepo.listByWorkspace(tx, ws));
    const t1 = performance.now();
    const kids = await engine.transaction(['nodes'], 'r', (tx) =>
      nodeRepo.listChildren(tx, ws, roots[10] as string),
    );
    const t2 = performance.now();

    expect(all).toHaveLength(2_000);
    expect(kids).toHaveLength(99);
    expect(kids.map((k) => k.order)).toEqual([...kids.map((k) => k.order)].sort());
    // Solo informativo: el presupuesto real se mide en navegador (Entrega C).
    console.info(
      `[rendimiento, fake-indexeddb] cargar 2.000 cabeceras: ${(t1 - t0).toFixed(0)} ms; hijos de un nodo: ${(t2 - t1).toFixed(0)} ms`,
    );
  });
});

describe('migraciones', () => {
  it('planMigrations encadena en orden y detecta huecos y duplicados', () => {
    const m = (from: number, to: number): Migration => ({ from, to, up() {} });
    expect(planMigrations(0, 3, [m(0, 1), m(2, 3), m(1, 2)]).map((x) => x.to)).toEqual([1, 2, 3]);
    expect(planMigrations(1, 3, [m(0, 1), m(1, 2), m(2, 3)]).map((x) => x.to)).toEqual([2, 3]);
    expect(planMigrations(3, 3, [m(0, 1)])).toEqual([]);
    expect(() => planMigrations(0, 3, [m(0, 1), m(2, 3)])).toThrow(StorageError);
    expect(() => planMigrations(0, 2, [m(0, 1), m(1, 2), m(1, 2)])).toThrow(StorageError);
    expect(() => planMigrations(0, 1, [m(0, 0)])).toThrow(StorageError);
  });

  const v2: Migration = {
    from: 1,
    to: 2,
    async up({ tx }) {
      // Ejemplo de migración de datos: todos los nodos reciben un campo nuevo.
      await updateAll(tx.objectStore('nodes'), (n) => ({ ...n, kind: 'pagina' }));
    },
  };

  it('migra una base existente conservando los datos', async () => {
    const name = uniqueName();
    const n = createNodeHeader({ workspaceId: 'w', title: 'Antiguo', order: K0 });

    const old = await openEngine(name); // versión 1
    await old.engine.transaction(['nodes'], 'rw', (tx) => nodeRepo.put(tx, n));
    old.engine.close();

    const engine = new IndexedDBEngine({ name, migrations: [...MIGRATIONS, v2] });
    await engine.open();
    const { migrated, version } = await engine.transaction(['nodes', 'meta'], 'r', async (tx) => ({
      migrated: await nodeRepo.get(tx, n.id),
      version: await metaRepo.get<number>(tx, 'schemaVersion'),
    }));
    expect(version).toBe(2);
    expect(migrated).toMatchObject({ title: 'Antiguo', kind: 'pagina' });
  });

  it('si una migración falla, se conserva la base anterior intacta', async () => {
    const name = uniqueName();
    const n = createNodeHeader({ workspaceId: 'w', title: 'Intacto', order: K0 });
    const old = await openEngine(name);
    await old.engine.transaction(['nodes'], 'rw', (tx) => nodeRepo.put(tx, n));
    old.engine.close();

    const broken: Migration = {
      from: 1,
      to: 2,
      async up({ tx }) {
        await updateAll(tx.objectStore('nodes'), (x) => ({ ...x, kind: 'roto' }));
        throw new Error('migración defectuosa');
      },
    };
    const failing = new IndexedDBEngine({ name, migrations: [...MIGRATIONS, broken] });
    await expect(failing.open()).rejects.toMatchObject({ code: 'migration' });

    const engine = new IndexedDBEngine({ name }); // la aplicación sigue en v1
    await engine.open();
    const stored = await engine.transaction(['nodes'], 'r', (tx) => nodeRepo.get(tx, n.id));
    expect(stored).toMatchObject({ title: 'Intacto' });
    expect(stored).not.toHaveProperty('kind');
  });

  it('rechaza abrir datos de una versión más nueva que la aplicación', async () => {
    const name = uniqueName();
    const newer = new IndexedDBEngine({ name, migrations: [...MIGRATIONS, v2] });
    await newer.open();
    newer.close();

    const older = new IndexedDBEngine({ name }); // aplicación antigua
    await expect(older.open()).rejects.toMatchObject({ code: 'version' });
  });
});
