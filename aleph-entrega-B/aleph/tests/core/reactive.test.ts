import { describe, expect, it, vi } from 'vitest';
import { batch, computed, effect, signal, untracked } from '../../src/core/reactive';

describe('señales', () => {
  it('lee, escribe y actualiza', () => {
    const s = signal(1);
    s.set(2);
    s.update((v) => v + 1);
    expect(s.get()).toBe(3);
  });

  it('el efecto se ejecuta al crearlo y al cambiar lo que lee', () => {
    const s = signal(1);
    const seen: number[] = [];
    effect(() => {
      seen.push(s.get());
    });
    s.set(2);
    s.set(2); // mismo valor: no avisa
    s.set(3);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('el efecto devuelve una limpieza que corre antes de repetirse y al detenerlo', () => {
    const s = signal(0);
    const log: string[] = [];
    const stop = effect(() => {
      const v = s.get();
      log.push(`run${v}`);
      return () => log.push(`clean${v}`);
    });
    s.set(1);
    stop();
    s.set(2);
    expect(log).toEqual(['run0', 'clean0', 'run1', 'clean1']);
  });

  it('batch agrupa cambios en una sola ejecución', () => {
    const a = signal(1);
    const b = signal(1);
    const runs = vi.fn();
    effect(() => {
      runs(a.get() + b.get());
    });
    batch(() => {
      a.set(2);
      b.set(3);
    });
    expect(runs.mock.calls).toEqual([[2], [5]]);
  });

  it('untracked lee sin suscribirse', () => {
    const a = signal(1);
    const b = signal(1);
    const runs = vi.fn();
    effect(() => {
      runs(a.get() + untracked(() => b.get()));
    });
    b.set(5);
    expect(runs).toHaveBeenCalledTimes(1);
    a.set(2);
    expect(runs).toHaveBeenLastCalledWith(7);
  });

  it('las dependencias son dinámicas', () => {
    const flag = signal(true);
    const a = signal('A');
    const b = signal('B');
    const runs = vi.fn();
    effect(() => {
      runs(flag.get() ? a.get() : b.get());
    });
    b.set('B2'); // no se leía
    expect(runs).toHaveBeenCalledTimes(1);
    flag.set(false);
    a.set('A2'); // ya no se lee
    expect(runs.mock.calls).toEqual([['A'], ['B2']]);
  });
});

describe('computed', () => {
  it('es perezoso y usa caché', () => {
    const s = signal(2);
    const fn = vi.fn(() => s.get() * 2);
    const c = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(c.get()).toBe(4);
    expect(c.get()).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
    s.set(3);
    expect(c.get()).toBe(6);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('corte por igualdad: si el resultado no cambia, el efecto no se repite', () => {
    const s = signal(1);
    const parity = computed(() => s.get() % 2);
    const runs = vi.fn();
    effect(() => {
      runs(parity.get());
    });
    s.set(3); // misma paridad
    s.set(5);
    expect(runs).toHaveBeenCalledTimes(1);
    s.set(6);
    expect(runs).toHaveBeenCalledTimes(2);
  });

  it('diamante: el efecto se ejecuta una vez y ve valores coherentes', () => {
    const s = signal(1);
    const double = computed(() => s.get() * 2);
    const triple = computed(() => s.get() * 3);
    const seen: Array<[number, number]> = [];
    effect(() => {
      seen.push([double.get(), triple.get()]);
    });
    s.set(2);
    expect(seen).toEqual([
      [2, 3],
      [4, 6],
    ]);
  });

  it('encadena computeds', () => {
    const s = signal(1);
    const a = computed(() => s.get() + 1);
    const b = computed(() => a.get() * 10);
    expect(b.get()).toBe(20);
    s.set(2);
    expect(b.get()).toBe(30);
  });

  it('detecta dependencias circulares', () => {
    const c: { get(): number } = computed(() => c.get() + 1);
    expect(() => c.get()).toThrow(/circular/);
  });

  it('comparador personalizado', () => {
    const s = signal({ id: 1, n: 1 });
    const byId = computed(() => ({ id: s.get().id }), (a, b) => a.id === b.id);
    const runs = vi.fn();
    effect(() => {
      runs(byId.get());
    });
    s.set({ id: 1, n: 2 });
    expect(runs).toHaveBeenCalledTimes(1);
  });
});

describe('efectos', () => {
  it('un efecto que escribe una señal provoca la actualización de otros', () => {
    const a = signal(1);
    const b = signal(0);
    effect(() => {
      b.set(a.get() * 10);
    });
    const seen: number[] = [];
    effect(() => {
      seen.push(b.get());
    });
    a.set(2);
    expect(seen).toEqual([10, 20]);
  });

  it('un ciclo infinito entre efectos se corta con error', () => {
    const a = signal(0);
    expect(() =>
      effect(() => {
        a.set(a.get() + 1);
      }),
    ).toThrow(/ciclo/);
  });

  it('un error en un efecto no impide que se ejecuten los demás', () => {
    const s = signal(0);
    const ok = vi.fn();
    effect(() => {
      if (s.get() === 1) throw new Error('fallo');
    });
    effect(() => {
      ok(s.get());
    });
    expect(() => s.set(1)).toThrow('fallo');
    expect(ok).toHaveBeenLastCalledWith(1);
  });
});
