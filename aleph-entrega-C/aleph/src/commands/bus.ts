import { computed, batch, signal } from '../core/reactive';
import type { ReadonlySignal } from '../core/reactive';
import type { StorageEngine } from '../data';
import { uuidv7 } from '../domain/ids';
import type { Id } from '../domain/types';
import type { Label } from '../i18n';
import {
  CommandTx,
  RECORD_STORES,
  StaleHistoryError,
  applyDirection,
  estimateSize,
  mergeChanges,
} from './changeset';
import type { Change, RecordStore } from './changeset';

export interface CommandContext {
  now: number;
  /** Id nuevo, creciente y único. */
  newId(): Id;
}

export interface CommandSpec<R = void> {
  label: Label;
  /** Por defecto `true`. Las no deshacibles (purgas) vacían el historial. */
  undoable?: boolean;
  /** Une ediciones seguidas de la misma clave (p. ej. teclear) en un solo paso. */
  coalesce?: { key: string; windowMs: number };
  run(tx: CommandTx, ctx: CommandContext): Promise<R>;
}

export type CommitOrigin = 'local' | 'undo' | 'redo' | 'remote';
export interface CommitEvent {
  changes: readonly Change[];
  origin: CommitOrigin;
  label?: Label;
}
export type CommitListener = (event: CommitEvent) => void;

interface HistoryEntry {
  label: Label;
  changes: Change[];
  at: number;
  coalesceKey?: string;
  size: number;
}

export interface BusOptions {
  clock?: () => number;
  maxEntries?: number;
  /** Tope aproximado de memoria del historial, en bytes. */
  maxBytes?: number;
}

/**
 * Bus de comandos: ejecuta cada comando en UNA transacción atómica, anota sus
 * cambios, mantiene las pilas de deshacer/rehacer y avisa a los suscriptores
 * (estado en memoria, otras pestañas, editor). Las operaciones se serializan.
 */
export class CommandBus {
  private readonly clock: () => number;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<CommitListener>();
  private readonly undoTop = signal<Label | null>(null);
  private readonly redoTop = signal<Label | null>(null);

  /** Etiqueta de lo que se deshará (null = nada que deshacer). */
  readonly undoLabel: ReadonlySignal<Label | null> = computed(() => this.undoTop.get());
  readonly redoLabel: ReadonlySignal<Label | null> = computed(() => this.redoTop.get());

  constructor(
    private readonly engine: StorageEngine,
    options: BusOptions = {},
  ) {
    this.clock = options.clock ?? Date.now;
    this.maxEntries = options.maxEntries ?? 200;
    this.maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  }

  subscribe(listener: CommitListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: CommitEvent): void {
    for (const l of [...this.listeners]) l(event);
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private refreshSignals(): void {
    batch(() => {
      this.undoTop.set(this.undoStack[this.undoStack.length - 1]?.label ?? null);
      this.redoTop.set(this.redoStack[this.redoStack.length - 1]?.label ?? null);
    });
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.refreshSignals();
  }

  get undoDepth(): number {
    return this.undoStack.length;
  }
  get redoDepth(): number {
    return this.redoStack.length;
  }

  execute<R>(spec: CommandSpec<R>): Promise<R> {
    return this.enqueue(async () => {
      const now = this.clock();
      let result!: R;
      let changes: Change[] = [];
      await this.engine.transaction(RECORD_STORES, 'rw', async (raw) => {
        const tx = new CommandTx(raw, now);
        result = await spec.run(tx, { now, newId: () => uuidv7(now) });
        changes = tx.changes();
      });
      if (changes.length === 0) return result;
      this.record(spec, changes, now);
      this.emit({ changes, origin: 'local', label: spec.label });
      return result;
    });
  }

  private record(spec: CommandSpec<unknown>, changes: Change[], now: number): void {
    if (spec.undoable === false) {
      this.undoStack = [];
      this.redoStack = [];
    } else {
      this.redoStack = [];
      const top = this.undoStack[this.undoStack.length - 1];
      const key = spec.coalesce?.key;
      if (top && key && top.coalesceKey === key && now - top.at <= spec.coalesce!.windowMs) {
        top.changes = mergeChanges(top.changes, changes);
        top.at = now;
        top.label = spec.label;
        top.size = estimateSize(top.changes);
      } else {
        const entry: HistoryEntry = { label: spec.label, changes, at: now, size: estimateSize(changes) };
        if (key) entry.coalesceKey = key;
        this.undoStack.push(entry);
      }
      this.trim();
    }
    this.refreshSignals();
  }

  private trim(): void {
    let total = this.undoStack.reduce((s, e) => s + e.size, 0);
    while (this.undoStack.length > this.maxEntries || (total > this.maxBytes && this.undoStack.length > 1)) {
      total -= this.undoStack.shift()!.size;
    }
  }

  undo(): Promise<Label | null> {
    return this.step('undo');
  }
  redo(): Promise<Label | null> {
    return this.step('redo');
  }

  private step(direction: 'undo' | 'redo'): Promise<Label | null> {
    return this.enqueue(async () => {
      const from = direction === 'undo' ? this.undoStack : this.redoStack;
      const to = direction === 'undo' ? this.redoStack : this.undoStack;
      const entry = from.pop();
      if (!entry) return null;
      const now = this.clock();
      let written: ReturnType<typeof applyDirection> extends Promise<infer W> ? W : never = [];
      try {
        await this.engine.transaction(RECORD_STORES, 'rw', async (raw) => {
          const tx = new CommandTx(raw, now);
          written = await applyDirection(tx, entry.changes, direction);
        });
      } catch (error) {
        this.refreshSignals();
        throw error;
      }
      const events: Change[] = [];
      entry.changes.forEach((c, i) => {
        const image = written[i];
        const before = direction === 'undo' ? c.next : c.prev;
        events.push({ store: c.store, key: c.key, prev: before, next: image });
        if (direction === 'undo') c.prev = image;
        else c.next = image;
        // El registro tiene ahora una `rev` nueva: el paso vecino que esperaba
        // este mismo estado debe reconocerlo (si no, parecería modificado desde fuera).
        for (let i = from.length - 1; i >= 0; i -= 1) {
          const neighbour = from[i]!.changes.find((x) => x.store === c.store && x.key === c.key);
          if (!neighbour) continue;
          if (direction === 'undo') neighbour.next = image;
          else neighbour.prev = image;
          break;
        }
      });
      to.push(entry);
      this.refreshSignals();
      this.emit({ changes: events, origin: direction, label: entry.label });
      return entry.label;
    });
  }

  /** Cambios hechos por otra pestaña: se relee su estado actual y se avisa. */
  ingestRemote(refs: ReadonlyArray<{ store: RecordStore; key: Id }>): Promise<void> {
    return this.enqueue(async () => {
      const changes: Change[] = [];
      await this.engine.transaction(RECORD_STORES, 'r', async (raw) => {
        const tx = new CommandTx(raw, this.clock());
        for (const r of refs) changes.push({ store: r.store, key: r.key, prev: undefined, next: await tx.peek(r.store, r.key) });
      });
      if (changes.length) this.emit({ changes, origin: 'remote' });
    });
  }
}

export { StaleHistoryError };
