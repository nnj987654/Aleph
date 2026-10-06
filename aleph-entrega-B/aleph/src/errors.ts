/**
 * Errores propios de Aleph. Llevan un `code` estable para que la interfaz pueda
 * decidir el mensaje (en español, desde el catálogo) sin analizar textos.
 */
export class AlephError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export type StorageErrorCode =
  | 'unsupported' // el navegador no ofrece IndexedDB
  | 'closed' // se usó el motor antes de abrirlo o tras cerrarlo
  | 'quota' // almacenamiento lleno
  | 'version' // la base es de una versión más nueva que la aplicación
  | 'migration' // una migración falló (la base anterior se conserva)
  | 'unknown';

export class StorageError extends AlephError {
  declare readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

/** Otra pestaña (u otro proceso) modificó el registro desde que se leyó. */
export class ConflictError extends AlephError {
  readonly entityId: string;
  readonly expectedRev: number;
  readonly actualRev: number;

  constructor(entityId: string, expectedRev: number, actualRev: number) {
    super(
      'conflict',
      `El registro ${entityId} cambió (revisión esperada ${expectedRev}, actual ${actualRev}).`,
    );
    this.entityId = entityId;
    this.expectedRev = expectedRev;
    this.actualRev = actualRev;
  }
}

export class NotFoundError extends AlephError {
  constructor(entity: string, id: string) {
    super('not-found', `No existe ${entity} con id ${id}.`);
  }
}
