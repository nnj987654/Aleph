import { beforeEach, describe, expect, it } from 'vitest';
import { isUuid, resetIdState, uuidv7, uuidv7Timestamp } from '../../src/domain/ids';

describe('uuidv7', () => {
  beforeEach(() => resetIdState());

  it('tiene formato UUID, versión 7 y variante RFC 4122', () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19]);
  });

  it('codifica la marca de tiempo', () => {
    const now = 1_790_000_000_123;
    expect(uuidv7Timestamp(uuidv7(now))).toBe(now);
  });

  it('es único y creciente aunque se generen miles en el mismo milisegundo', () => {
    const now = 1_790_000_000_000;
    const ids = Array.from({ length: 20_000 }, () => uuidv7(now));
    expect(new Set(ids).size).toBe(ids.length);
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('sigue siendo creciente si el reloj retrocede', () => {
    const a = uuidv7(1_790_000_000_500);
    const b = uuidv7(1_790_000_000_100); // el reloj va hacia atrás
    expect(b > a).toBe(true);
  });

  it('rechaza textos que no son UUID', () => {
    expect(isUuid('hola')).toBe(false);
    expect(() => uuidv7Timestamp('hola')).toThrow(TypeError);
  });
});
