import type { Id } from './types';

/**
 * UUID v7 (RFC 9562): 48 bits de marca de tiempo + versión + contador + aleatorio.
 * Los ids se ordenan por fecha de creación y se pueden generar sin conexión.
 *
 * Es monótono dentro del proceso: dos ids generados en el mismo milisegundo
 * (o con el reloj retrocediendo) siguen ordenándose en el orden de creación.
 */

let lastMs = 0;
let seq = 0;

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function randomSeq(): number {
  const r = randomBytes(2);
  // Se empieza en la mitad inferior para dejar margen de incrementos (0x7ff..0xfff).
  return (((r[0] ?? 0) << 8) | (r[1] ?? 0)) & 0x7ff;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function uuidv7(now: number = Date.now()): Id {
  let ms = Math.floor(now);
  if (ms > lastMs) {
    lastMs = ms;
    seq = randomSeq();
  } else {
    seq += 1;
    if (seq > 0xfff) {
      lastMs += 1;
      seq = randomSeq();
    }
    ms = lastMs;
  }

  const rand = randomBytes(8);
  rand[0] = ((rand[0] ?? 0) & 0x3f) | 0x80; // variante RFC 4122

  const t = ms.toString(16).padStart(12, '0');
  const s = seq.toString(16).padStart(3, '0');
  const r = hex(rand);
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-7${s}-${r.slice(0, 4)}-${r.slice(4, 16)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Fecha de creación (ms) codificada en un UUID v7. */
export function uuidv7Timestamp(id: Id): number {
  if (!isUuid(id)) throw new TypeError(`No es un UUID válido: ${id}`);
  return parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}

/** Solo para pruebas: reinicia el estado del generador monótono. */
export function resetIdState(): void {
  lastMs = 0;
  seq = 0;
}
