/**
 * Modelo de dominio de Aleph (arquitectura §5.1).
 * Solo tipos: sin dependencias del navegador.
 */

/** UUID v7 en texto. */
export type Id = string;
/** Milisegundos desde 1970. */
export type Timestamp = number;
/** Clave fraccionaria para ordenar hermanos (ver order.ts). */
export type OrderKey = string;
export type IconName = string;
export type AccentToken = string;

export interface Workspace {
  id: Id;
  name: string;
  icon: IconName;
  color: AccentToken;
  description?: string;
  order: OrderKey;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Revisión para detectar ediciones concurrentes. */
  rev: number;
}

/**
 * Solo dos tipos de nodo. Curso, materia, tema o apunte son presentación
 * (`kind`, icono, plantilla) sobre `page`, no tipos distintos.
 */
export type NodeType = 'page' | 'file';

/** Cabecera de nodo: ligera, vive en memoria. */
export interface NodeHeader {
  id: Id;
  workspaceId: Id;
  /** `null` = raíz del espacio. */
  parentId: Id | null;
  type: NodeType;
  title: string;
  icon?: IconName;
  /** Presentación o plantilla: 'curso', 'materia'... Solo visual. */
  kind?: string;
  order: OrderKey;
  favorite: boolean;
  status?: string;
  tagIds: Id[];
  /** Un nodo `file` apunta a un Asset. */
  assetId?: Id;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Borrado lógico (papelera). */
  deletedAt?: Timestamp;
  /** Raíz del subárbol eliminado al que pertenece este nodo. */
  deletedRootId?: Id;
  rev: number;
  meta?: Record<string, unknown>;
}

/** Documento de bloques en JSON estructurado (nunca HTML). */
export interface DocJSON {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocJSON[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/** Contenido pesado del nodo: se carga bajo demanda. */
export interface NodeContent {
  nodeId: Id;
  /** Versión del esquema del documento (para migraciones perezosas). */
  schemaVersion: number;
  doc: DocJSON;
  /** Texto plano para búsqueda y previsualización. */
  textCache: string;
  updatedAt: Timestamp;
  rev: number;
}

export interface Asset {
  id: Id;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  storage: 'idb' | 'opfs';
  createdAt: Timestamp;
  deletedAt?: Timestamp;
  meta?: { width?: number; height?: number; pages?: number; rotation?: number };
}

export interface Tag {
  id: Id;
  name: string;
  /** Nombre normalizado (sin acentos, minúsculas) para búsqueda y unicidad. */
  nameNorm: string;
  color?: AccentToken;
}

export type RelationType = 'link' | 'related' | 'alias' | 'prerequisite';

export interface Relation {
  id: Id;
  type: RelationType;
  sourceId: Id;
  sourceBlockId?: string;
  targetId: Id;
  targetBlockId?: string;
  createdAt: Timestamp;
}

export interface HistoryEntry {
  id: Id;
  nodeId: Id;
  at: Timestamp;
  reason: 'idle' | 'close' | 'threshold' | 'manual';
  doc: DocJSON;
  textLength: number;
}

/** Versión actual del esquema de los documentos de contenido. */
export const CURRENT_DOC_SCHEMA = 1;
