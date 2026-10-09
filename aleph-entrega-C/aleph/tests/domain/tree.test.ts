import { describe, expect, it } from 'vitest';
import { createNodeHeader } from '../../src/domain/factories';
import { spread } from '../../src/domain/order';
import {
  buildChildrenIndex,
  checkTreeInvariants,
  flattenVisible,
  getAncestors,
  getDescendants,
  getPath,
  isDescendantOf,
  toMap,
  wouldCreateCycle,
} from '../../src/domain/tree';
import type { NodeHeader } from '../../src/domain/types';

const WS = 'ws-1';

/** Construye nodos con ids legibles. `kids` cuelga del `parent` indicado. */
function build(spec: Array<[id: string, parent: string | null]>): NodeHeader[] {
  const orderByParent = new Map<string | null, number>();
  const keys = spread(50);
  return spec.map(([id, parent]) => {
    const n = orderByParent.get(parent) ?? 0;
    orderByParent.set(parent, n + 1);
    return createNodeHeader({ workspaceId: WS, title: id, order: keys[n] as string, id, parentId: parent });
  });
}

//  A
//  ├─ B
//  │   └─ D
//  └─ C
//  E
const nodes = build([
  ['A', null],
  ['B', 'A'],
  ['C', 'A'],
  ['D', 'B'],
  ['E', null],
]);
const map = toMap(nodes);

describe('árbol', () => {
  it('agrupa hijos por padre en orden', () => {
    const idx = buildChildrenIndex(nodes);
    expect(idx.get(null)?.map((n) => n.id)).toEqual(['A', 'E']);
    expect(idx.get('A')?.map((n) => n.id)).toEqual(['B', 'C']);
  });

  it('excluye eliminados salvo que se pida lo contrario', () => {
    const withDeleted = nodes.map((n) => (n.id === 'C' ? { ...n, deletedAt: 1 } : n));
    expect(buildChildrenIndex(withDeleted).get('A')?.map((n) => n.id)).toEqual(['B']);
    expect(
      buildChildrenIndex(withDeleted, { includeDeleted: true }).get('A')?.map((n) => n.id),
    ).toEqual(['B', 'C']);
  });

  it('calcula ancestros y ruta (migas de pan)', () => {
    expect(getAncestors(map, 'D').map((n) => n.id)).toEqual(['A', 'B']);
    expect(getPath(map, 'D').map((n) => n.id)).toEqual(['A', 'B', 'D']);
    expect(getAncestors(map, 'A')).toEqual([]);
    expect(getPath(map, 'nope')).toEqual([]);
  });

  it('detecta descendencia y ciclos al mover', () => {
    expect(isDescendantOf(map, 'D', 'A')).toBe(true);
    expect(isDescendantOf(map, 'A', 'A')).toBe(false);
    expect(wouldCreateCycle(map, 'A', 'D')).toBe(true); // A dentro de su nieto
    expect(wouldCreateCycle(map, 'A', 'A')).toBe(true);
    expect(wouldCreateCycle(map, 'D', 'E')).toBe(false);
    expect(wouldCreateCycle(map, 'D', null)).toBe(false);
  });

  it('lista descendientes en preorden', () => {
    const idx = buildChildrenIndex(nodes);
    expect(getDescendants(idx, 'A').map((n) => n.id)).toEqual(['B', 'D', 'C']);
    expect(getDescendants(idx, 'E')).toEqual([]);
  });

  it('aplana las filas visibles según lo desplegado', () => {
    const idx = buildChildrenIndex(nodes);
    expect(flattenVisible(idx, new Set()).map((r) => r.id)).toEqual(['A', 'E']);

    const rows = flattenVisible(idx, new Set(['A', 'B']));
    expect(rows.map((r) => [r.id, r.depth])).toEqual([
      ['A', 0],
      ['B', 1],
      ['D', 2],
      ['C', 1],
      ['E', 0],
    ]);
    expect(rows.find((r) => r.id === 'A')).toMatchObject({ hasChildren: true, expanded: true });
    expect(rows.find((r) => r.id === 'E')).toMatchObject({ hasChildren: false, expanded: false });
    // Un nodo «desplegado» sin hijos no cuenta como desplegado.
    expect(flattenVisible(idx, new Set(['E'])).find((r) => r.id === 'E')?.expanded).toBe(false);
  });

  it('aplana 10.000 nodos con una cadena profunda sin desbordar la pila', () => {
    const chain = build(Array.from({ length: 5000 }, (_, i) => [`n${i}`, i === 0 ? null : `n${i - 1}`]));
    const idx = buildChildrenIndex(chain);
    const rows = flattenVisible(idx, new Set(chain.map((n) => n.id)));
    expect(rows).toHaveLength(5000);
    expect(rows[4999]?.depth).toBe(4999);
    expect(getDescendants(idx, 'n0')).toHaveLength(4999);
  });
});

describe('invariantes del árbol', () => {
  it('un árbol sano no tiene problemas', () => {
    expect(checkTreeInvariants(nodes)).toEqual([]);
  });

  it('detecta padre inexistente', () => {
    const bad = [...nodes, ...build([['X', 'fantasma']])];
    expect(checkTreeInvariants(bad).map((i) => i.code)).toContain('missing-parent');
  });

  it('detecta padre de otro espacio', () => {
    const bad = nodes.map((n) => (n.id === 'B' ? { ...n, workspaceId: 'otro' } : n));
    const codes = checkTreeInvariants(bad).map((i) => i.code);
    expect(codes).toContain('cross-workspace-parent');
  });

  it('detecta ciclos y los informa una vez por nodo', () => {
    const bad = nodes.map((n) => (n.id === 'A' ? { ...n, parentId: 'D' } : n));
    const cycle = checkTreeInvariants(bad).filter((i) => i.code === 'cycle');
    expect(cycle.map((i) => i.nodeId).sort()).toEqual(['A', 'B', 'D']);
  });

  it('detecta orden duplicado entre hermanos vivos', () => {
    const bad = nodes.map((n) => (n.id === 'C' ? { ...n, order: (nodes[1] as NodeHeader).order } : n));
    expect(checkTreeInvariants(bad).map((i) => i.code)).toContain('duplicate-order');
  });

  it('ignora el orden duplicado de nodos eliminados', () => {
    const bad = nodes.map((n) =>
      n.id === 'C' ? { ...n, order: (nodes[1] as NodeHeader).order, deletedAt: 5 } : n,
    );
    expect(checkTreeInvariants(bad).map((i) => i.code)).not.toContain('duplicate-order');
  });

  it('detecta un nodo vivo bajo un padre eliminado', () => {
    const bad = nodes.map((n) => (n.id === 'B' ? { ...n, deletedAt: 5 } : n));
    const issues = checkTreeInvariants(bad).filter((i) => i.code === 'alive-under-deleted');
    expect(issues.map((i) => i.nodeId)).toEqual(['D']);
  });
});
