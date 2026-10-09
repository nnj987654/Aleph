import { signal } from '../core/reactive';
import type { ReadonlySignal } from '../core/reactive';
import type { Id } from '../domain/types';

/**
 * Rutas (hash, funcionan abriendo el archivo sin servidor):
 *   #/                       Inicio (mapa de tarjetas)
 *   #/w/<espacio>            Espacio abierto
 *   #/w/<espacio>/n/<nodo>   Nodo abierto
 *   #/w/<espacio>/papelera   Papelera
 *   #/ajustes                Ajustes
 */
export type Route =
  | { name: 'home' }
  | { name: 'workspace'; workspaceId: Id }
  | { name: 'node'; workspaceId: Id; nodeId: Id }
  | { name: 'trash'; workspaceId: Id }
  | { name: 'settings' }
  | { name: 'not-found'; hash: string };

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (clean === '') return { name: 'home' };
  const parts = clean.split('/').map((p) => decodeURIComponent(p));
  if (parts[0] === 'ajustes' && parts.length === 1) return { name: 'settings' };
  if (parts[0] === 'w' && parts[1]) {
    const workspaceId = parts[1];
    if (parts.length === 2) return { name: 'workspace', workspaceId };
    if (parts.length === 3 && parts[2] === 'papelera') return { name: 'trash', workspaceId };
    if (parts.length === 4 && parts[2] === 'n' && parts[3]) return { name: 'node', workspaceId, nodeId: parts[3] };
  }
  return { name: 'not-found', hash };
}

export function formatRoute(route: Route): string {
  const e = encodeURIComponent;
  switch (route.name) {
    case 'home':
      return '#/';
    case 'settings':
      return '#/ajustes';
    case 'workspace':
      return `#/w/${e(route.workspaceId)}`;
    case 'trash':
      return `#/w/${e(route.workspaceId)}/papelera`;
    case 'node':
      return `#/w/${e(route.workspaceId)}/n/${e(route.nodeId)}`;
    case 'not-found':
      return route.hash;
  }
}

/** Lo que el router necesita del navegador (inyectable para pruebas). */
export interface LocationLike {
  hash: string;
}
export interface WindowLike {
  location: LocationLike;
  addEventListener(type: 'hashchange', listener: () => void): void;
  removeEventListener(type: 'hashchange', listener: () => void): void;
}

export class Router {
  private readonly current = signal<Route>({ name: 'home' });
  readonly route: ReadonlySignal<Route> = this.current;
  private readonly onChange = (): void => this.current.set(parseRoute(this.win.location.hash));

  constructor(private readonly win: WindowLike) {
    this.onChange();
    win.addEventListener('hashchange', this.onChange);
  }

  navigate(route: Route): void {
    const hash = formatRoute(route);
    if (this.win.location.hash === hash) return;
    this.win.location.hash = hash; // el navegador dispara hashchange
  }

  dispose(): void {
    this.win.removeEventListener('hashchange', this.onChange);
  }
}
