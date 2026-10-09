/**
 * Catálogo de textos. La interfaz es solo en español, pero ningún texto va
 * escrito en el código: se pide por identificador. Traducir en el futuro =
 * añadir otro catálogo con las mismas claves.
 */
import { es } from './es';

export type MessageId = keyof typeof es;
export interface Label {
  id: MessageId;
  params?: Record<string, string | number>;
}

let catalog: Record<string, string> = es;

export function setCatalog(next: Record<string, string>): void {
  catalog = next;
}

export function t(id: MessageId, params?: Record<string, string | number>): string {
  const template = catalog[id] ?? es[id] ?? id;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
}

export function tl(label: Label): string {
  return t(label.id, label.params);
}
