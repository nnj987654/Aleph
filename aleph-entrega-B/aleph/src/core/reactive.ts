/**
 * Reactividad mínima (señales), propia y sin dependencias.
 *
 *  - `signal`   valor observable.
 *  - `computed` valor derivado, perezoso y con caché; si recalcula el mismo valor
 *               no avisa a nadie («corte por igualdad»).
 *  - `effect`   código que se vuelve a ejecutar cuando cambia algo que leyó.
 *  - `batch`    agrupa cambios: los efectos se ejecutan una sola vez al final.
 *  - `untracked` lee sin suscribirse.
 *
 * Garantías: sin «glitches» (un efecto nunca ve valores a medias), y un efecto
 * que depende de varias fuentes derivadas de la misma señal se ejecuta una vez.
 *
 * Los `computed` se mantienen suscritos a sus fuentes mientras existan: crearlos
 * en cantidad (uno por fila de la interfaz) no es el uso previsto. Para eso se
 * usan señales por elemento o efectos con `dispose()`.
 */

interface Source {
  version: number;
  readonly observers: Set<Observer>;
  /** Pone al día el valor (solo hace algo en un `computed` sucio). */
  refresh(): void;
}

interface Observer {
  markDirty(): void;
}

type Deps = Map<Source, number>;
type Equals<T> = (a: T, b: T) => boolean;

export interface ReadonlySignal<T> {
  get(): T;
  /** Lee sin suscribirse. */
  peek(): T;
}

export interface Signal<T> extends ReadonlySignal<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

let tracker: ((source: Source) => void) | null = null;
let batchDepth = 0;
let flushing = false;
const pending = new Set<EffectNode>();

const MAX_FLUSH_STEPS = 10_000;

function depsChanged(deps: Deps): boolean {
  for (const [source, version] of deps) {
    source.refresh();
    if (source.version !== version) return true;
  }
  return false;
}

function runTracked<T>(fn: () => T, deps: Deps, self: Observer): T {
  for (const source of deps.keys()) source.observers.delete(self);
  deps.clear();
  const previous = tracker;
  tracker = (source) => {
    if (deps.has(source)) return;
    deps.set(source, source.version);
    source.observers.add(self);
  };
  try {
    return fn();
  } finally {
    tracker = previous;
  }
}

function notify(observers: Set<Observer>): void {
  for (const observer of [...observers]) observer.markDirty();
  if (batchDepth === 0) flush();
}

function flush(): void {
  if (flushing) return;
  flushing = true;
  const errors: unknown[] = [];
  let steps = 0;
  try {
    while (pending.size > 0) {
      if (++steps > MAX_FLUSH_STEPS) {
        pending.clear();
        throw new Error('Reactividad: ciclo infinito entre efectos.');
      }
      const effectNode = pending.values().next().value as EffectNode;
      pending.delete(effectNode);
      try {
        effectNode.run();
      } catch (error) {
        errors.push(error);
      }
    }
  } finally {
    flushing = false;
  }
  if (errors.length > 0) throw errors[0];
}

class SignalNode<T> implements Source, Signal<T> {
  version = 0;
  readonly observers = new Set<Observer>();

  constructor(
    private value: T,
    private readonly equals: Equals<T>,
  ) {}

  refresh(): void {}

  get(): T {
    tracker?.(this);
    return this.value;
  }

  peek(): T {
    return this.value;
  }

  set(next: T): void {
    if (this.equals(this.value, next)) return;
    this.value = next;
    this.version += 1;
    notify(this.observers);
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.value));
  }
}

class ComputedNode<T> implements Source, Observer, ReadonlySignal<T> {
  version = 0;
  readonly observers = new Set<Observer>();
  private readonly deps: Deps = new Map();
  private dirty = true;
  private computing = false;
  private hasValue = false;
  private value!: T;

  constructor(
    private readonly fn: () => T,
    private readonly equals: Equals<T>,
  ) {}

  markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    for (const observer of [...this.observers]) observer.markDirty();
  }

  refresh(): void {
    if (!this.dirty) return;
    if (this.computing) throw new Error('Reactividad: dependencia circular en un computed.');
    if (this.hasValue && !depsChanged(this.deps)) {
      this.dirty = false;
      return;
    }
    this.computing = true;
    try {
      const next = runTracked(this.fn, this.deps, this);
      this.dirty = false;
      if (!this.hasValue || !this.equals(this.value, next)) {
        this.value = next;
        this.version += 1;
      }
      this.hasValue = true;
    } finally {
      this.computing = false;
    }
  }

  get(): T {
    this.refresh();
    tracker?.(this);
    return this.value;
  }

  peek(): T {
    this.refresh();
    return this.value;
  }
}

type Cleanup = () => void;

class EffectNode implements Observer {
  private readonly deps: Deps = new Map();
  private dirty = true;
  private hasRun = false;
  private disposed = false;
  private cleanup: Cleanup | undefined;

  constructor(private readonly fn: () => void | Cleanup) {}

  markDirty(): void {
    if (this.disposed) return;
    this.dirty = true;
    pending.add(this);
  }

  run(): void {
    if (this.disposed || !this.dirty) return;
    this.dirty = false;
    if (this.hasRun && !depsChanged(this.deps)) return;
    this.cleanup?.();
    this.cleanup = undefined;
    this.hasRun = true;
    const result = runTracked(this.fn, this.deps, this);
    if (typeof result === 'function') this.cleanup = result;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    pending.delete(this);
    for (const source of this.deps.keys()) source.observers.delete(this);
    this.deps.clear();
    this.cleanup?.();
    this.cleanup = undefined;
  }
}

export function signal<T>(initial: T, equals: Equals<T> = Object.is): Signal<T> {
  return new SignalNode(initial, equals);
}

export function computed<T>(fn: () => T, equals: Equals<T> = Object.is): ReadonlySignal<T> {
  return new ComputedNode(fn, equals);
}

/** Ejecuta `fn` ya y cada vez que cambie algo que lea. Devuelve la función para detenerlo. */
export function effect(fn: () => void | Cleanup): () => void {
  const node = new EffectNode(fn);
  node.markDirty();
  if (batchDepth === 0) flush();
  else node.run();
  return () => node.dispose();
}

export function batch<T>(fn: () => T): T {
  batchDepth += 1;
  try {
    return fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) flush();
  }
}

export function untracked<T>(fn: () => T): T {
  const previous = tracker;
  tracker = null;
  try {
    return fn();
  } finally {
    tracker = previous;
  }
}
