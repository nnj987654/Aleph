import { describe, expect, it } from 'vitest';
import {
  OrderError,
  between,
  betweenMany,
  isValidKey,
  keyAt,
  needsReindex,
  spread,
} from '../../src/domain/order';

/** Generador pseudoaleatorio con semilla: las pruebas son reproducibles. */
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

function expectStrictlySorted(keys: string[]): void {
  for (let i = 1; i < keys.length; i += 1) {
    expect((keys[i - 1] as string) < (keys[i] as string)).toBe(true);
  }
}

describe('claves fraccionarias', () => {
  it('genera la primera clave y las extremas', () => {
    expect(between(null, null)).toBe('a0');
    expect(between('a0', null) > 'a0').toBe(true);
    expect(between(null, 'a0') < 'a0').toBe(true);
  });

  it('inserta entre dos claves sin tocar las demás', () => {
    const k = between('a0', 'a1');
    expect(k > 'a0' && k < 'a1').toBe(true);
    expect(isValidKey(k)).toBe(true);
  });

  it('rechaza límites desordenados o iguales', () => {
    expect(() => between('a1', 'a0')).toThrow(OrderError);
    expect(() => between('a0', 'a0')).toThrow(OrderError);
  });

  it('rechaza claves mal formadas', () => {
    expect(() => between('!!', null)).toThrow(OrderError);
    expect(() => between('a10', null)).toThrow(OrderError); // fracción acabada en cero
    expect(isValidKey('a0')).toBe(true);
    expect(isValidKey('')).toBe(false);
    expect(isValidKey('a 1')).toBe(false);
  });

  it('añadir 5.000 al final mantiene las claves cortas y ordenadas', () => {
    const keys: string[] = [];
    for (let i = 0; i < 5000; i += 1) keys.push(between(keys[keys.length - 1] ?? null, null));
    expectStrictlySorted(keys);
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThanOrEqual(5);
  });

  it('añadir 5.000 al principio mantiene las claves cortas y ordenadas', () => {
    const keys: string[] = [];
    for (let i = 0; i < 5000; i += 1) keys.unshift(between(null, keys[0] ?? null));
    expectStrictlySorted(keys);
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThanOrEqual(5);
  });

  it('inserciones aleatorias (propiedad): siempre entre sus vecinos, válidas y únicas', () => {
    const rand = rng(42);
    const keys: string[] = [];
    for (let i = 0; i < 4000; i += 1) {
      const index = Math.floor(rand() * (keys.length + 1));
      const k = keyAt(keys, index);
      expect(isValidKey(k)).toBe(true);
      if (index > 0) expect(k > (keys[index - 1] as string)).toBe(true);
      if (index < keys.length) expect(k < (keys[index] as string)).toBe(true);
      keys.splice(index, 0, k);
    }
    expectStrictlySorted(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('insertar siempre en el mismo hueco alarga la clave y activa la recomendación de reindexar', () => {
    const keys = ['a0', 'a1'];
    let reindexAt = -1;
    for (let i = 0; i < 400; i += 1) {
      const k = keyAt(keys, 1);
      keys.splice(1, 0, k);
      if (reindexAt < 0 && needsReindex(k)) reindexAt = i;
    }
    expectStrictlySorted(keys);
    expect(reindexAt).toBeGreaterThan(0);
  });

  it('betweenMany reparte n claves ordenadas entre dos límites', () => {
    for (const [a, b] of [
      [null, null],
      ['a0', null],
      [null, 'a0'],
      ['a0', 'a1'],
      ['a0', 'a0V'],
    ] as Array<[string | null, string | null]>) {
      const keys = betweenMany(a, b, 50);
      expect(keys).toHaveLength(50);
      expectStrictlySorted(keys);
      if (a !== null) expect(keys[0] as string > a).toBe(true);
      if (b !== null) expect((keys[49] as string) < b).toBe(true);
    }
    expect(betweenMany(null, null, 0)).toEqual([]);
  });

  it('spread(10000) genera claves cortas para reindexar listas grandes', () => {
    const keys = spread(10_000);
    expect(keys).toHaveLength(10_000);
    expectStrictlySorted(keys);
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThanOrEqual(6);
  });

  it('keyAt acota índices fuera de rango', () => {
    const keys = ['a0', 'a1'];
    expect(keyAt(keys, -5) < 'a0').toBe(true);
    expect(keyAt(keys, 99) > 'a1').toBe(true);
  });
});
