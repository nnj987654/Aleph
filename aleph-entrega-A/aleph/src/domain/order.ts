/**
 * Claves fraccionarias para ordenar hermanos (arquitectura §5.3, ADR 07).
 *
 * Mover o insertar un nodo entre otros dos genera UNA clave nueva sin tocar a
 * los demás hermanos. Las claves se comparan como texto normal (`<`, `>`).
 *
 * Algoritmo de David Greenspan (dominio público / CC0), la base de la
 * biblioteca «fractional-indexing», reescrito aquí en TypeScript para no
 * añadir una dependencia: una parte entera de longitud variable (el primer
 * carácter indica su longitud) seguida de una parte fraccionaria en base 62.
 * Añadir al final o al principio crece muy despacio; insertar siempre en el
 * mismo hueco alarga la clave y, pasado un umbral, conviene reindexar a los
 * hermanos con `betweenMany` (ver `needsReindex`).
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS.charAt(0);
const LAST = DIGITS.charAt(DIGITS.length - 1);
const SMALLEST_INTEGER = 'A' + ZERO.repeat(26);

/** Longitud a partir de la cual se recomienda reindexar a los hermanos. */
export const MAX_KEY_LENGTH = 32;

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderError';
  }
}

function digitIndex(ch: string | undefined): number {
  const i = ch === undefined ? -1 : DIGITS.indexOf(ch);
  if (i < 0) throw new OrderError(`Carácter de clave no válido: ${String(ch)}`);
  return i;
}

/** Punto medio entre dos fracciones (`a` puede ser '', `b` puede ser null = 1). */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new OrderError(`${a} >= ${b}`);
  if (a.endsWith(ZERO) || (b !== null && b.endsWith(ZERO))) {
    throw new OrderError('Una clave no puede terminar en cero');
  }
  if (b !== null) {
    // Quita el prefijo común (rellenando `a` con ceros por la derecha).
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n += 1;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  // Los primeros dígitos (o la ausencia de dígito) difieren.
  const digitA = a.length > 0 ? digitIndex(a[0]) : 0;
  const digitB = b !== null ? digitIndex(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) {
    return DIGITS.charAt(Math.round(0.5 * (digitA + digitB)));
  }
  // Primeros dígitos consecutivos.
  if (b !== null && b.length > 1) return b.slice(0, 1);
  // `b` es null o de un solo dígito: se baja un nivel.
  return DIGITS.charAt(digitA) + midpoint(a.slice(1), null);
}

function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new OrderError(`Clave de orden no válida (cabecera ${head})`);
}

function integerPart(key: string): string {
  const len = integerLength(key.charAt(0));
  if (len > key.length) throw new OrderError(`Clave de orden no válida: ${key}`);
  return key.slice(0, len);
}

function validateKey(key: string): void {
  if (key === SMALLEST_INTEGER) throw new OrderError(`Clave de orden no válida: ${key}`);
  const i = integerPart(key);
  if (key.slice(i.length).endsWith(ZERO)) {
    throw new OrderError(`Clave de orden no válida: ${key}`);
  }
}

function incrementInteger(x: string): string | null {
  const head = x.charAt(0);
  const digs = x.slice(1).split('');
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i -= 1) {
    const d = digitIndex(digs[i]) + 1;
    if (d === DIGITS.length) {
      digs[i] = ZERO;
    } else {
      digs[i] = DIGITS.charAt(d);
      carry = false;
    }
  }
  if (carry) {
    if (head === 'Z') return 'a' + ZERO;
    if (head === 'z') return null;
    const h = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h > 'a') digs.push(ZERO);
    else digs.pop();
    return h + digs.join('');
  }
  return head + digs.join('');
}

function decrementInteger(x: string): string | null {
  const head = x.charAt(0);
  const digs = x.slice(1).split('');
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i -= 1) {
    const d = digitIndex(digs[i]) - 1;
    if (d === -1) {
      digs[i] = LAST;
    } else {
      digs[i] = DIGITS.charAt(d);
      borrow = false;
    }
  }
  if (borrow) {
    if (head === 'a') return 'Z' + LAST;
    if (head === 'A') return null;
    const h = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h < 'Z') digs.push(LAST);
    else digs.pop();
    return h + digs.join('');
  }
  return head + digs.join('');
}

/**
 * Clave estrictamente entre `a` y `b`. `null` significa «sin límite» por ese
 * lado: `between(null, null)` es la primera clave, `between(ultima, null)`
 * añade al final y `between(null, primera)` añade al principio.
 */
export function between(a: string | null, b: string | null): string {
  if (a !== null) validateKey(a);
  if (b !== null) validateKey(b);
  if (a !== null && b !== null && a >= b) throw new OrderError(`${a} >= ${b}`);

  if (a === null) {
    if (b === null) return 'a' + ZERO;
    const ib = integerPart(b);
    const fb = b.slice(ib.length);
    if (ib === SMALLEST_INTEGER) return ib + midpoint('', fb);
    if (ib < b) return ib;
    const res = decrementInteger(ib);
    if (res === null) throw new OrderError('No se puede decrementar más');
    return res;
  }

  if (b === null) {
    const ia = integerPart(a);
    const fa = a.slice(ia.length);
    const i = incrementInteger(ia);
    return i === null ? ia + midpoint(fa, null) : i;
  }

  const ia = integerPart(a);
  const fa = a.slice(ia.length);
  const ib = integerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) return ia + midpoint(fa, fb);
  const i = incrementInteger(ia);
  if (i === null) throw new OrderError('No se puede incrementar más');
  if (i < b) return i;
  return ia + midpoint(fa, null);
}

/** `n` claves estrictamente entre `a` y `b`, ordenadas y lo más cortas posible. */
export function betweenMany(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [between(a, b)];

  if (b === null) {
    let c = between(a, b);
    const result = [c];
    for (let i = 0; i < n - 1; i += 1) {
      c = between(c, b);
      result.push(c);
    }
    return result;
  }

  if (a === null) {
    let c = between(a, b);
    const result = [c];
    for (let i = 0; i < n - 1; i += 1) {
      c = between(a, c);
      result.push(c);
    }
    result.reverse();
    return result;
  }

  const mid = Math.floor(n / 2);
  const c = between(a, b);
  return [...betweenMany(a, c, mid), c, ...betweenMany(c, b, n - mid - 1)];
}

/** `count` claves iniciales repartidas para una lista nueva o reindexada. */
export function spread(count: number): string[] {
  return betweenMany(null, null, count);
}

/**
 * Clave para insertar en la posición `index` de una lista de claves ya
 * ordenadas (0 = al principio, `sorted.length` = al final).
 */
export function keyAt(sorted: readonly string[], index: number): string {
  const i = Math.max(0, Math.min(index, sorted.length));
  return between(sorted[i - 1] ?? null, sorted[i] ?? null);
}

/** ¿Es una clave bien formada? */
export function isValidKey(key: string): boolean {
  try {
    validateKey(key);
    return /^[0-9A-Za-z]+$/.test(key);
  } catch {
    return false;
  }
}

/** Una clave demasiado larga indica que conviene reindexar a los hermanos. */
export function needsReindex(key: string): boolean {
  return key.length > MAX_KEY_LENGTH;
}
