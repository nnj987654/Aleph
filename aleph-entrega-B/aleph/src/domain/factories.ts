import { uuidv7 } from './ids';
import { CURRENT_DOC_SCHEMA } from './types';
import type { DocJSON, Id, NodeContent, NodeHeader, Workspace } from './types';

/** Constructores con valores por defecto coherentes (ids, fechas y revisión inicial). */

export function emptyDoc(): DocJSON {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function createWorkspace(
  input: Pick<Workspace, 'name' | 'order'> & Partial<Workspace>,
  now: number = Date.now(),
): Workspace {
  return {
    id: uuidv7(now),
    icon: 'book',
    color: 'blue',
    createdAt: now,
    updatedAt: now,
    rev: 0,
    ...input,
  };
}

export function createNodeHeader(
  input: Pick<NodeHeader, 'workspaceId' | 'title' | 'order'> & Partial<NodeHeader>,
  now: number = Date.now(),
): NodeHeader {
  return {
    id: uuidv7(now),
    parentId: null,
    type: 'page',
    favorite: false,
    tagIds: [],
    createdAt: now,
    updatedAt: now,
    rev: 0,
    ...input,
  };
}

export function createNodeContent(
  nodeId: Id,
  doc: DocJSON = emptyDoc(),
  textCache = '',
  now: number = Date.now(),
): NodeContent {
  return { nodeId, schemaVersion: CURRENT_DOC_SCHEMA, doc, textCache, updatedAt: now, rev: 0 };
}
