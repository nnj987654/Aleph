Markdown · 02-Aleph-arquitectura-tecnica.md

# Aleph — Arquitectura técnica (Fase 2)

**Estado:** v1.1 — decisiones del propietario incorporadas (ver §20) · **Depende de:** `01-Aleph-documento-base-v2.md` **Convención:** *DECISIÓN* = propuesta cerrada salvo objeción. *ABIERTO* = requiere tu respuesta (ver §20).

---

## 1. Objetivos y restricciones

**Objetivos técnicos:** integridad de datos, funcionamiento offline, rendimiento con 10.000+ nodos, extensibilidad sin reescrituras (archivos, búsqueda, grafo, estudio, futura sincronización), portabilidad total.

**Restricciones:**

- Aplicación web **estática y autocontenida** (sin servidor, sin CDN, sin servicios externos).
- Sin `localStorage` como base de datos (solo preferencias triviales de arranque).
- Navegadores objetivo: Chromium, Firefox y Safari recientes. Carpeta vinculada solo en Chromium.
- TypeScript estricto. Dependencias según la política del documento base §4.2.

## 2. Vista general

```text
┌──────────────────────────────────────────────────────────┐
│ UI (propia)     componentes, vistas, editor (ProseMirror) │
├──────────────────────────────────────────────────────────┤
│ Estado          stores reactivos (signals) + selectores   │
├──────────────────────────────────────────────────────────┤
│ Comandos        CommandBus · UndoManager · Transacciones  │
├──────────────────────────────────────────────────────────┤
│ Servicios       Tree · Content · Assets · Search · Backup │
│                 Import/Export · Integrity · Settings      │
├──────────────────────────────────────────────────────────┤
│ Repositorios    Workspace · Node · Content · Asset · ...  │
├──────────────────────────────────────────────────────────┤
│ StorageEngine   IndexedDBEngine  (+ FolderMirror opcional)│
└──────────────────────────────────────────────────────────┘
   Workers: search.worker · io.worker (import/export/hash)
```

**Reglas de dependencia (se validan automáticamente en CI):**

1. Cada capa solo conoce a la inmediatamente inferior (y a `core/`).
2. **La UI nunca escribe en repositorios**: solo despacha comandos.
3. **Todo cambio persistente pasa por un comando** (DECISIÓN: no hay escrituras "por fuera").
4. Los repositorios no conocen el estado ni la UI; devuelven objetos planos serializables.
5. `domain/` (tipos y lógica pura) no importa nada de navegador.

## 3. Stack y registros de decisión (ADR)

| ADR | Decisión | Alternativas descartadas | Motivo |
| --- | --- | --- | --- |
| 01 | **TypeScript** estricto | JS puro | Modelo de datos y comandos grandes; refactors seguros |
| 02 | **Vite**, salida estática, chunks perezosos | Sin build (módulos ES) | pdf.js, KaTeX y ProseMirror exigen empaquetado y workers; PWA |
| 03 | **Capa de UI propia** (señales + creación directa de DOM) | Preact, React, Svelte, Web Components | Mínimas dependencias; reactividad fina ideal para árbol y editor; ver §20.2 |
| 04 | **ProseMirror (núcleo)** para el editor | TipTap, Lexical, `contenteditable` propio | Control total del esquema y del JSON; sin capas innecesarias |
| 05 | **IndexedDB** como almacén de trabajo tras `StorageEngine` | OPFS/SQLite-WASM, localStorage | Universal y persistente; abstracción permite migrar |
| 06 | **UUID v7** para IDs | UUID v4, autoincrementales | Ordenables por tiempo, sin colisiones, generables offline |
| 07 | **Claves fraccionarias** para orden | Enteros | Mover = 1 escritura |
| 08 | **Comandos con change-sets** para undo | Snapshots de estado, patches manuales | Undo uniforme para cualquier cambio; base de historial y sincronización |
| 09 | **ZIP propio** (`CompressionStream` nativo + CRC-32) | fflate, JSZip | Formato simple; \~300 líneas; sin dependencia |
| 10 | **Hash de contenido SHA-256** (Web Crypto) para activos | Sin hash | Deduplicación e integridad |
| 11 | **MiniSearch** tras capa `SearchEngine` propia | Índice propio | Menos trabajo, sustituible; confirmado |
| 12 | **Dos tipos de nodo:** `page` y `file` | folder/note/file, tipos por curso/materia | Modelo mental único; presentación por plantilla/`kind` |
| 13 | **i18n preparada, solo español** | Textos incrustados | Coste casi nulo ahora, evita refactor futuro; ver §20.5 |

*Cerrado:* sin framework de UI (ver §20.2). Runtime final: ProseMirror, MiniSearch, y bajo demanda pdf.js y KaTeX.

## 4. Estructura del proyecto

```text
aleph/
├── index.html
├── vite.config.ts · tsconfig.json · package.json
├── docs/                      # este documento, ADRs, registro de dependencias
├── public/                    # manifest.webmanifest, iconos, fuentes WOFF2
├── src/
│   ├── main.ts                # arranque: motor, migraciones, stores, UI
│   ├── domain/                # tipos + lógica pura (sin DOM)
│   │   ├── types.ts           # Workspace, Node, Asset, Tag, Relation...
│   │   ├── ids.ts             # UUID v7
│   │   ├── order.ts           # claves fraccionarias
│   │   ├── tree.ts            # ciclos, descendientes, rutas
│   │   └── schema/            # validadores de paquetes y documentos
│   ├── data/
│   │   ├── engine/            # StorageEngine (interfaz) + indexeddb/
│   │   ├── repositories/      # workspace, node, content, asset, tag, relation, history
│   │   ├── migrations/        # v1.ts, v2.ts... + runner
│   │   └── integrity/         # comprobador de coherencia
│   ├── commands/              # CommandBus, UndoManager, definiciones de comandos
│   │   └── defs/              # createNode.ts, moveNode.ts, ...
│   ├── services/              # tree, content, assets, backup, search, io, settings
│   ├── state/                 # stores (signals), selectores, sincronización entre pestañas
│   ├── ui/
│   │   ├── core/              # señales, h(), listas con clave, portales, foco
│   │   ├── design/            # tokens CSS, temas, tipografía, iconos SVG
│   │   ├── components/        # modal, dropdown, tooltip, toast, context-menu, tree-view...
│   │   ├── views/             # welcome, dashboard, space, note, library, search, trash, settings
│   │   └── shell/             # layout, sidebar, breadcrumbs, command palette
│   ├── editor/
│   │   ├── schema.ts          # esquema PM de bloques
│   │   ├── plugins/           # slash-menu, block-ids, input-rules, paste-sanitizer
│   │   ├── nodeviews/         # imagen, pdf, fórmula, callout...
│   │   ├── serialize/         # JSON ⇄ Markdown / HTML
│   │   └── migrate/           # migraciones de documento
│   ├── files/                 # pdf viewer (lazy), image viewer, mime, thumbnails
│   ├── search/                # worker, índice, normalización, parser de consultas
│   ├── io/                    # paquete .aleph, importadores, exportadores
│   ├── platform/              # storage.persist, File System Access, save/open, locks, broadcast
│   ├── i18n/                  # catálogo es.ts, t(), Intl (plurales, fechas, ordenación)
│   └── workers/               # entradas de Web Workers
└── tests/                     # unit/, integration/, e2e/, fixtures/ (bases de datos antiguas)
```

## 5. Modelo de datos

### 5.1. Tipos (dominio)

```ts
type Id = string;                       // UUID v7
type Timestamp = number;                // epoch ms
type OrderKey = string;                 // clave fraccionaria

interface Workspace {
  id: Id; name: string; icon: IconName; color: AccentToken;
  description?: string; order: OrderKey;
  createdAt: Timestamp; updatedAt: Timestamp; rev: number;
}

type NodeType = 'page' | 'file';              // 'page' = contenido y/o hijos (curso, materia, tema, apunte...)
interface NodeHeader {                        // ligero: vive en memoria
  id: Id; workspaceId: Id; parentId: Id | null;   // null = raíz del espacio
  type: NodeType; title: string; icon?: IconName;
  kind?: string;                                  // presentación/plantilla: 'curso', 'materia'... (solo visual)
  order: OrderKey; favorite: boolean; status?: string;
  tagIds: Id[]; assetId?: Id;                     // 'file' apunta a un Asset
  createdAt: Timestamp; updatedAt: Timestamp;
  deletedAt?: Timestamp; deletedRootId?: Id;      // soft delete
  rev: number;                                    // control de concurrencia
  meta?: Record<string, unknown>;                 // extensible
}

interface NodeContent {                 // pesado: bajo demanda
  nodeId: Id; schemaVersion: number;
  doc: PMDocJSON;                       // documento de bloques (JSON, nunca HTML)
  textCache: string;                    // texto plano para búsqueda/previsualización
  updatedAt: Timestamp; rev: number;
}

interface Asset {                       // metadatos; el binario va aparte
  id: Id; name: string; mimeType: string; size: number; sha256: string;
  storage: 'idb' | 'opfs'; createdAt: Timestamp;
  deletedAt?: Timestamp; meta?: { width?: number; height?: number; pages?: number };
}

interface Tag { id: Id; name: string; nameNorm: string; color?: AccentToken; }
interface Relation {
  id: Id; type: 'link' | 'related' | 'alias' | 'prerequisite';
  sourceId: Id; sourceBlockId?: string;
  targetId: Id; targetBlockId?: string;
  createdAt: Timestamp;
}
interface HistoryEntry {                // versiones de contenido
  id: Id; nodeId: Id; at: Timestamp; reason: 'idle' | 'close' | 'threshold' | 'manual';
  doc: PMDocJSON; textLength: number;
}
```

### 5.2. Invariantes (los comprueba el módulo de integridad)

1. `parentId` referencia un nodo existente del **mismo espacio** (o `null`).
2. **No hay ciclos** en el árbol.
3. Un nodo `file` referencia un `Asset` existente; un `Asset` no eliminado pertenece al menos a un nodo o a la biblioteca.
4. `order` es único entre hermanos vivos (si hay empate se resuelve por `id`).
5. Un `alias` apunta a un nodo de otra rama; nunca al propio padre ni a un descendiente.
6. Si `deletedAt` está presente en un nodo, lo está en todo su subárbol con el mismo `deletedRootId`.
7. Los IDs de bloque son únicos dentro de un documento.

### 5.3. Claves fraccionarias (`domain/order.ts`)

Implementación propia (\~80 líneas) de claves en base 62 con función `between(a?, b?)`. Reglas: insertar al inicio/final/entre hermanos genera una clave nueva sin tocar el resto; si una clave supera cierta longitud se ejecuta una **reindexación** local de esa lista de hermanos (comando interno, atómico).

## 6. Persistencia

### 6.1. Interfaz `StorageEngine`

```ts
interface StorageEngine {
  open(): Promise<void>;
  transaction<T>(stores: StoreName[], mode: 'r' | 'rw',
                 fn: (tx: Tx) => Promise<T>): Promise<T>;   // atomicidad
  estimate(): Promise<{ usage: number; quota: number }>;
  close(): void;
}
```

Los repositorios usan **solo** esta interfaz. `IndexedDBEngine` es la implementación inicial.

### 6.2. Almacenes de IndexedDB (base `aleph`, versión de esquema en `meta`)

| Almacén | Clave | Índices | Contenido |
| --- | --- | --- | --- |
| `meta` | `key` | — | `schemaVersion`, `deviceId`, `lastBackupAt`, flags |
| `workspaces` | `id` | `order` | Espacios |
| `nodes` | `id` | `parent` \[`workspaceId`,`parentKey`,`order`\] · `workspace` · `deleted` \[`workspaceId`,`deletedAt`\] · `updated` · `type` | `NodeHeader` + `parentKey` (ver nota) |
| `contents` | `nodeId` | `updated` | `NodeContent` |
| `assets` | `id` | `sha256` · `deleted` · `mime` | Metadatos de archivo |
| `blobs` | `assetId` | — | `Blob` binario |
| `tags` | `id` | `nameNorm` (único) | Etiquetas |
| `relations` | `id` | `source` · `target` · `type` | Relaciones y alias |
| `history` | `id` | `node` \[`nodeId`,`at`\] | Versiones |
| `searchIndex` | `chunk` | — | Índice serializado por fragmentos |
| `settings` | `key` | — | Configuración de usuario |
| `journal` | `seq` (auto) | — | Registro de comandos ejecutados (diagnóstico y futura sincronización) |

**Nota (Entrega A):** IndexedDB no admite `null` ni booleanos como claves, y un registro cuyo campo indexado vale `null`/`undefined` queda fuera del índice. Por eso `nodes` guarda `parentKey` (padre o `''` para la raíz, añadido y retirado por el repositorio), el índice `deleted` solo contiene nodos eliminados, y se elimina el índice `favorite` (los favoritos se filtran en memoria).

### 6.3. Reglas de escritura

- Un comando modifica **varios almacenes en una sola transacción** (p. ej., `MOVE_NODE` actualiza `nodes` y `journal`). Todo o nada.
- `NodeHeader` y `NodeContent` se guardan separados; renombrar o mover nunca reescribe el documento.
- **Autoguardado:** el editor confirma cambios con *debounce* (≈400 ms) y siempre en `blur`, cambio de nota y `visibilitychange`/`pagehide`. Estado visible discreto: "Guardado".
- **Blobs:** se guardan como `Blob` nativo. Un `Asset` con `storage: 'opfs'` permite mover binarios grandes a OPFS más adelante sin cambiar el modelo.
- **Deduplicación:** antes de guardar un binario se calcula SHA-256; si existe, se reutiliza el `Asset`.
- **Cuota:** al superar el 80 % de `estimate()` se avisa; los errores `QuotaExceededError` se capturan, se abortan las transacciones y se informa sin corromper datos.

### 6.4. Durabilidad (implementa doc. base §4.1)

- `platform/storage.ts`: al primer uso significativo (crear primer contenido / adjuntar primer archivo) se llama a `navigator.storage.persist()`; el resultado se guarda y se muestra en Datos.
- **`FolderMirror` (V3, Chromium):** el usuario elige una carpeta (`showDirectoryPicker`), el handle se guarda en IndexedDB y se verifica el permiso al abrir. Un servicio suscrito al `journal` escribe, con *debounce* y en segundo plano, un espejo legible: `nodes.json`, `content/<id>.json`, `assets/<sha256>.<ext>`. Es un **espejo unidireccional** (Aleph → carpeta); restaurar equivale a importar. No se usa como almacén primario en v1.
- **Copias automáticas:** con `FolderMirror`, exportación `.aleph` rotatoria (p. ej., últimas 7 diarias) en `backups/`.

## 7. Comandos, undo, historial y papelera

### 7.1. Comando

```ts
interface Command<P = unknown> {
  type: CommandType;                       // 'CREATE_NODE' | 'MOVE_NODE' | ...
  payload: P;
  label: string;                           // "Mover «Cálculo»"
  coalesceKey?: string;                    // para agrupar (p. ej. edición de nota)
}
interface CommandHandler<P> {
  validate(payload: P, ctx: ReadCtx): Result;           // rechaza antes de escribir
  execute(payload: P, tx: Tx, ctx: Ctx): ChangeSet;     // escribe y devuelve cambios
}
interface Change { store: StoreName; key: IDBValidKey; before?: unknown; after?: unknown; }
type ChangeSet = Change[];
```

### 7.2. Undo por *change-sets*

- El `CommandBus` abre una transacción, ejecuta el handler, registra los `Change[]` (imagen anterior y posterior de cada registro) y añade la entrada al `journal`.
- **Deshacer** = aplicar las imágenes `before` en una nueva transacción (y emitir un evento). **Rehacer** = aplicar las `after`. Es uniforme para *cualquier* comando, sin código de "inverso" por comando.
- **Los binarios nunca entran en un change-set:** borrar un archivo solo marca `deletedAt`; deshacer quita la marca. El `Blob` se destruye únicamente al vaciar la papelera.
- `UndoManager` mantiene pilas `undo/redo` en memoria (límite configurable, p. ej. 200), con **coalescencia** por `coalesceKey` y ventana temporal. Se persiste un resumen en `journal` para recuperación tras recarga en el mejor esfuerzo.
- Los comandos de **composición** (`BATCH`) agrupan varios (p. ej. mover una selección múltiple) en una sola entrada de undo.

### 7.3. Catálogo inicial de comandos

`CREATE_WORKSPACE`, `UPDATE_WORKSPACE`, `DELETE_WORKSPACE`, `CREATE_NODE`, `UPDATE_NODE` (título, icono, favorito…), `UPDATE_CONTENT`, `MOVE_NODE`, `DUPLICATE_NODE`, `TRASH_NODE`, `RESTORE_NODE`, `PURGE_NODE`, `ATTACH_FILE`, `REPLACE_FILE`, `ADD_TAG`, `REMOVE_TAG`, `CREATE_RELATION`, `DELETE_RELATION`, `IMPORT_PACKAGE`, `BATCH`. Cada comando tiene: esquema del payload, `validate`, `execute`, prueba unitaria y prueba de "ejecutar → deshacer → rehacer = mismo estado".

### 7.4. Edición de contenido

- Dentro del editor manda el **historial de ProseMirror** (granular, tecla a tecla).
- Al consolidar (debounce/blur), se emite `UPDATE_CONTENT` con `coalesceKey = "content:<nodeId>"` y **una sola entrada** en la pila global por sesión de edición.
- Con foco fuera del editor, `Ctrl/Cmd+Z` actúa sobre la pila global.

### 7.5. Historial de versiones

Se crea un `HistoryEntry` cuando: (a) pasan ≥ 5 min de inactividad tras cambios, (b) se cierra la nota y hubo cambios, (c) el texto cambia por encima de un umbral, (d) el usuario guarda una versión manual. **Retención:** todas las de las últimas 24 h, una por día durante 30 días, una por semana después; máximo configurable. Restaurar una versión es un comando (deshacible) que crea antes una versión de "estado actual".

### 7.6. Papelera

- `TRASH_NODE` marca `deletedAt` y `deletedRootId` en todo el subárbol (una transacción; para subárboles enormes se hace por lotes dentro de la misma transacción lógica con marca de "en curso" para reanudar).
- Los nodos en papelera **se excluyen** de árbol, búsqueda y biblioteca mediante el índice `deleted`.
- `RESTORE_NODE` devuelve el subárbol a su padre original; si el padre ya no existe, se restaura en la raíz del espacio con aviso.
- `PURGE_NODE` / vaciar papelera: eliminación real de nodos, contenidos, historial, relaciones y (si ningún otro nodo los usa) activos y blobs. **No deshacible**, con confirmación explícita.
- Retención automática configurable (por defecto, 30 días).

## 8. Estado, eventos y router

- **Stores (signals):** `workspaces`, `nodeIndex` (mapa `id → NodeHeader` de los nodos vivos), `childrenByParent` (derivado), `selection`, `expandedSet`, `activeRoute`, `ui` (sidebar, paneles, tema), `settings`, `saveStatus`, `storageStatus`.
- **Cabeceras en memoria, contenidos bajo demanda:** al arrancar se cargan las cabeceras del espacio activo (≈200 B × 10.000 ≈ 2 MB); los `NodeContent` se cargan al abrir y se guardan en una caché **LRU** (p. ej. 30 documentos).
- **Flujo unidireccional:** `UI → dispatch(Command) → CommandBus → (tx) → ChangeSet → evento "changed" → stores se actualizan por diferencias → UI`.
- **Eventos internos:** bus tipado (`node:changed`, `content:saved`, `asset:added`, `route:changed`, `storage:status`…). Los servicios (búsqueda, espejo de carpeta) se suscriben al `ChangeSet`, no a la UI.
- **Router:** **basado en hash** (`#/w/<ws>/n/<node>?view=doc`) para funcionar sin configuración de servidor y desde `file://`/cualquier hosting estático. Cada estado importante (espacio, nodo, vista, búsqueda) es enlazable ("Copiar enlace"). Se restaura la última ubicación al abrir.
- **Persistencia de UI:** expansión del árbol, anchura y estado de sidebar, último nodo abierto y tema se guardan en `settings` (IndexedDB), con un espejo mínimo en `localStorage` **solo** para evitar el parpadeo de tema al arrancar.

## 9. Explorador (árbol)

- **Estructura visible aplanada:** a partir de `expandedSet` y `childrenByParent` se calcula una lista lineal de filas visibles `[{id, depth, hasChildren}]`; el árbol se renderiza con **virtualización de altura fija** (solo las filas en pantalla + margen).
- **Carga perezosa:** los hijos se indexan al expandir (índice `parent`). "Expandir todo" en ramas grandes se hace por lotes con `requestIdleCallback`.
- **Accesibilidad:** patrón WAI-ARIA `tree` (`role="tree"`, `treeitem`, `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded`, `aria-selected`); *roving tabindex*; flechas ↑↓ mover, →← expandir/contraer, `Enter` abrir, `F2` renombrar, `Supr` a papelera, `Ctrl+Shift+↑/↓` reordenar.
- **Chevrones:** componente `<Icon name="chevron" />` (SVG) con rotación CSS y transición corta; sin caracteres tipográficos.
- **Drag & Drop:** eventos de puntero (no solo HTML5 DnD, para táctil y control fino); zonas *antes / dentro / después* con indicador de línea y resaltado del destino; auto-expansión al mantener sobre un nodo; auto-scroll; prevención de ciclos (no soltar sobre un descendiente); alternativa por teclado y menú "Mover a…". Resultado: un solo `MOVE_NODE` (o `BATCH`).
- **Selección múltiple** (`Shift`/`Ctrl`) para mover, etiquetar o eliminar en lote.
- **Breadcrumbs** derivados de `parentId` recorriendo `nodeIndex` (O(profundidad)).

## 10. Editor

### 10.1. Esquema (ProseMirror)

Nodos de bloque con atributo `id` estable: `paragraph`, `heading(level 1–3)`, `bullet_list`, `ordered_list`, `list_item`, `checklist`/`task_item(checked)`, `blockquote`, `code_block(lang)`, `table`, `callout(kind)`, `horizontal_rule`, `image(assetId, alt)`, `file(assetId)`, `pdf(assetId, page?)`, `math_block`, `embed(url)`. Marcas: `strong`, `em`, `code`, `link(href)`, `underline`, `strike`, `highlight`, `math_inline`, `noderef(nodeId, blockId?)` (enlace interno). **Fases:** M0 → paragraph, heading, checklist. V1 → resto de texto/listas/cita/código/callout/separador/enlaces. V2 → image/file/pdf. V1–V2 → tabla y fórmulas.

### 10.2. Plugins

- **`block-ids`:** `appendTransaction` que asigna ID a bloques sin él y regenera IDs duplicados (p. ej., tras pegar/duplicar).
- **`slash-menu`:** menú `/` accesible (ARIA combobox), filtrable, extensible desde un registro de bloques.
- **`input-rules`:** atajos Markdown (`# `, `- `, `[] `, `> `, ```` ``` ````).
- **`paste-sanitizer`:** convierte HTML/texto pegado a nodos del esquema; descarta estilos, scripts, atributos y tipos no soportados.
- **`floating-toolbar`:** barra contextual sobre la selección (sin barras gigantes fijas).
- **`internal-links`:** autocompletado de `[[` para enlazar nodos/bloques.
- **`history`:** historial de PM.
- **`autosave`:** consolida y emite `UPDATE_CONTENT` (ver §7.4).

### 10.3. Serialización y migración

- **Guardado:** `doc.toJSON()` + `schemaVersion`. Sin HTML.
- **`editor/migrate`:** migraciones de documento por versión, ejecutadas al cargar (perezosa) y de forma masiva al migrar la base.
- **Exportación:** serializadores propios `JSON → Markdown` y `JSON → HTML` (recorren el árbol de nodos; los bloques desconocidos degradan a texto con aviso).
- **Prototipo aislado (M1):** página de pruebas del editor con casos de IME (chino/japonés/acentos con dead keys), pegado desde Word/Google Docs/web, listas anidadas, tablas y undo antes de conectarlo a la aplicación.

## 11. Búsqueda

- **Worker dedicado** (`search.worker`): construye y consulta el índice; la UI nunca bloquea.
- **Indexado:** título (peso alto), `textCache`, etiquetas, nombre de archivo y ruta. Los PDFs pueden indexar su texto extraído (fase V2/V4, opcional, en segundo plano con pdf.js).
- **Normalización (español):** `NFD` + eliminación de diacríticos, minúsculas, tokenización por Unicode, palabras vacías configurables, búsqueda por **prefijo** y **tolerancia a errores** leve; opcional *stemming* ligero. Ejemplo: `derivada` encuentra "Derivadas", "derivación" (por prefijo/fuzzy) y "DERIVADA".
- **Actualización incremental:** el servicio se suscribe a `ChangeSet` y reindexa solo el nodo afectado (con *debounce*). El índice se serializa por fragmentos en `searchIndex`; hay "Reconstruir índice" y detección de versión de índice.
- **Consultas:** parser propio para `type:`, `tag:`, `in:`, `is:favorite`, `before:/after:` y comillas para frases. Los filtros estructurados se resuelven con índices de IndexedDB o en memoria sobre `nodeIndex`, y el texto con el motor.
- **Resultados:** agrupados (Notas, Archivos, Espacios…), con ruta (breadcrumb) y fragmento resaltado. Búsqueda dentro de la nota y dentro del PDF son funciones distintas.
- **Motor:** MiniSearch (confirmado) detrás de una interfaz `SearchEngine` propia, con tokenizador y normalización propios; sustituible sin tocar el resto.

## 12. Formato `.aleph`, importación y exportación

### 12.1. Paquete `.aleph` (ZIP, versión 1)

```text
workspace.aleph
├── manifest.json          # formato, versiones, contadores, checksums
├── data/
│   ├── workspaces.json
│   ├── nodes.ndjson       # una línea por nodo (streaming)
│   ├── contents.ndjson    # documentos
│   ├── tags.json
│   ├── relations.json
│   ├── history.ndjson     # opcional
│   └── settings.json      # opcional
└── assets/
    ├── index.json         # id → {name, mime, size, sha256, path}
    └── <sha256>.<ext>
```

`manifest.json`:

```json
{ "format": "aleph", "formatVersion": 1, "appVersion": "0.1.0",
  "createdAt": 0, "scope": "workspace|selection|app",
  "counts": { "workspaces": 1, "nodes": 184, "assets": 42 },
  "checksums": { "data/nodes.ndjson": "sha256:…" } }
```

- **Autocontenido y legible:** cualquier herramienta puede abrir el ZIP y leer JSON/archivos originales.
- **Versionado:** `formatVersion` con importadores por versión; **nunca** se rompe la lectura de versiones anteriores.
- Los binarios se almacenan **sin recompresión** (ZIP *store*) y con el hash como nombre (deduplicación natural).
- **ZIP propio:** escritor (*store* siempre; *deflate* para los JSON cuando `CompressionStream` existe) y lector (*store* y *deflate* vía `DecompressionStream`) con CRC-32 propio. Los paquetes de Aleph se leen siempre, incluso sin `CompressionStream`, porque el modo *store* es universal.

### 12.2. Importación (en `io.worker`, con tres fases)

1. **Inspección:** leer el manifiesto y contar; **vista previa** ("23 materias · 184 contenidos · 42 archivos") sin escribir nada.
2. **Validación:** comprobar esquema (validadores propios de `domain/schema`), integridad (checksums), invariantes (§5.2), y **límites de seguridad** (§15). Los errores se listan; los no críticos se pueden omitir con aviso.
3. **Aplicación atómica:** se importa en una transacción (o en un espacio "preparado" y luego se activa). Estrategias de conflicto: **importar como nuevo espacio** (por defecto, regenerando IDs y remapeando referencias), **fusionar** (V3+) o **reemplazar** (con copia automática previa).

- Progreso cancelable; tras importar se ejecuta el comprobador de integridad y se ofrece deshacer (`IMPORT_PACKAGE` guarda un marcador para eliminar lo importado).

### 12.3. Exportación

| Formato | Alcance | Notas |
| --- | --- | --- |
| `.aleph` | Elemento, sección, materia, curso, espacio, aplicación completa | Sin pérdida. Exportación parcial incluye solo lo referenciado (activos incluidos) |
| Markdown | Nodo o subárbol | Carpeta/ZIP con `.md` y `assets/`; bloques no representables degradan con aviso |
| HTML | Nodo o subárbol | Documento estático **sanitizado**, CSS incrustado, imágenes en línea o carpeta |
| JSON | Cualquiera | Volcado directo del modelo |
| PDF | Nodo | Vía hoja de estilos de impresión y `window.print()` (sin librería) |

- Generación en worker, en *streaming* para volúmenes grandes; descarga mediante `Blob` + `<a download>` (o `showSaveFilePicker` si existe).

## 13. Multi-pestaña, migraciones e integridad

### 13.1. Varias pestañas

- **`BroadcastChannel('aleph')`**: cada commit emite `{store, keys, origin}`; las demás pestañas invalidan cachés y actualizan stores.
- **Concurrencia optimista:** cada `NodeHeader`/`NodeContent` lleva `rev`. Si al guardar la `rev` de base ha cambiado, se aborta y se avisa ("Esta nota se modificó en otra pestaña": ver cambios / sobrescribir / copiar como nueva).
- **Bloqueos exclusivos (Web Locks API):** `aleph:exclusive` durante importar, restaurar, migrar y vaciar papelera; el resto de pestañas muestra "operación en curso".
- **`onversionchange`:** al actualizarse el esquema desde otra pestaña, esta cierra su conexión y muestra "Recarga para continuar".

### 13.2. Migraciones

```ts
interface Migration { from: number; to: number; up(tx: UpgradeTx): Promise<void>; }
```

- Registro ordenado en `data/migrations/`; el runner aplica de `schemaVersion` actual a la última.
- **Antes de migrar:** exportación `.aleph` automática de seguridad (si hay datos) almacenada localmente, y se conserva hasta confirmar arranque correcto.
- Migraciones **idempotentes**, por lotes para no bloquear, y con **pruebas basadas en fixtures** de bases de cada versión histórica (`tests/fixtures/db-v1.json`…).
- Si una migración falla: se revierte la transacción, se muestra el error y se ofrece exportar los datos tal cual.
- Los documentos tienen su propia versión (`NodeContent.schemaVersion`), migrada de forma perezosa al abrir y masiva bajo demanda.

### 13.3. Integridad

`data/integrity`: comprobador (invariantes §5.2) con modo **solo lectura** y modo **reparar** (con confirmación): reasigna huérfanos a una carpeta "Recuperado", elimina relaciones colgantes, marca activos sin nodo, corrige `deletedRootId`. Se ejecuta tras importar, migrar, restaurar y bajo demanda desde Datos.

## 14. Archivos y visores

- **Ingesta:** selector, arrastrar y soltar, pegado (imágenes del portapapeles). Validación: lista blanca de MIME, comprobación de firma (*magic numbers*) además de extensión, límites de tamaño configurables.
- **Miniaturas:** imágenes redimensionadas con `createImageBitmap` + `OffscreenCanvas` (worker) y cacheadas; PDF: primera página renderizada por pdf.js.
- **Visor PDF (chunk perezoso):** pdf.js con su worker, renderizado por página con virtualización vertical, miniaturas laterales, zoom, búsqueda de texto, pantalla completa, marcador de página actual, y memoria de la última página vista.
- **Visor de imágenes:** zoom/pan, rotación (no destructiva, guardada como `meta.rotation`), pantalla completa, sustituir (`REPLACE_FILE`), descargar.
- **SVG:** se muestra siempre como `<img>` con URL de `Blob` (nunca inline), o previamente saneado.
- **Biblioteca:** consulta por índices `mime`/`deleted` en `assets`, con filtros por categoría y enlace "mostrar en el árbol".
- **Ciclo de vida de URLs de `Blob`:** creadas al mostrar y revocadas al desmontar para evitar fugas.

## 15. Seguridad

- **CSP:** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. Sin `unsafe-eval`. Se define por cabecera cuando el hosting lo permita y por `<meta>` como respaldo.
- **Sin `innerHTML` con datos de usuario:** el renderizado pasa por la capa de vistas (que solo inserta texto y atributos, nunca HTML) y por el esquema del editor. Si hace falta HTML (exportar/vista de pegado), se sanea con un sanitizador propio de lista blanca (etiquetas/atributos/protocolos).
- **Paquetes importados:** límites (máx. entradas, tamaño total descomprimido, ratio de compresión, profundidad y longitud de rutas), rechazo de rutas con `..`/absolutas/`\`, validación de esquema campo a campo, tamaño máximo de cadenas/JSON, protección contra *prototype pollution* (`__proto__`, `constructor`).
- **Enlaces:** solo protocolos permitidos (`http`, `https`, `mailto`, internos); `rel="noopener noreferrer"`.
- **Sin telemetría ni peticiones de red** en runtime (salvo lo que el usuario provoque explícitamente).

## 16. Rendimiento

**Presupuestos (medidos en un equipo de gama media, con 10.000 nodos):**

| Métrica | Objetivo |
| --- | --- |
| Arranque en frío hasta árbol interactivo | \< 1,0 s |
| Arranque en caliente (PWA) | \< 500 ms |
| Expandir/contraer un nodo | \< 50 ms |
| Abrir una nota (\< 200 KB) | \< 100 ms |
| Latencia de tecleo en el editor | \< 16 ms por pulsación |
| Búsqueda (resultados iniciales) | \< 100 ms |
| Mover un nodo (DnD) hasta reflejarlo | \< 50 ms |
| JS inicial (gzip), sin pdf.js/KaTeX | ≤ 250 KB |

**Técnicas:** cabeceras ligeras en memoria; contenidos y binarios perezosos; virtualización de listas; workers para búsqueda/IO/hash/miniaturas; `content-visibility` y *code splitting* por vista; transacciones agrupadas; caché LRU; `requestIdleCallback` para tareas de fondo. Se incluye un **generador de datos de prueba** (10.000 nodos, 2.000 archivos) y una página de *benchmarks* interna desde M0.

## 17. UI, sistema de diseño, accesibilidad y PWA

- **Tokens CSS** (`--bg`, `--surface`, `--surface-2`, `--text`, `--text-2`, `--border`, `--accent`, `--accent-soft`, `--success`, `--warning`, `--danger`, espaciado, radios, sombras, duraciones), definidos por tema en `[data-theme]`; acento configurable mediante variables. Detalle en Fase 3.
- **Tipografía:** `@font-face` con `src: local("Georgia"), url(...woff2)` para la serif; sans de sistema para interfaz; `font-display: swap`.
- **Iconos:** sprite SVG propio (`<symbol>`/`<use>`), un único lenguaje de trazo, tamaños 14/16/20/24, `currentColor`, estados por CSS.
- **Componentes base propios:** Modal (con *focus trap*), Dropdown, Tooltip, Toast, ContextMenu, Popover, Tabs, Resizer, Tree, Command Palette. Todos con teclado y ARIA.
- **Movimiento:** duraciones 120–200 ms; `@media (prefers-reduced-motion: reduce)` desactiva transiciones no esenciales.
- **Responsive:** *container queries* + puntos de ruptura; sidebar como *drawer* en móvil; panel contextual colapsable.
- **Accesibilidad:** foco visible siempre, orden de tabulación lógico, regiones ARIA (`navigation`, `main`, `complementary`), anuncios (`aria-live`) para guardado/errores/undo, contraste ≥ AA, objetivos ≥ 44 px en táctil, `forced-colors` respetado.
- **PWA:** `manifest.webmanifest`, *service worker* con precaché versionado (*cache-first* para la app, sin cachear datos de usuario), flujo de actualización ("Nueva versión disponible: recargar") y compatibilidad offline completa.

## 18. Pruebas y calidad

- **Unitarias (Vitest):** `order`, `ids`, `tree`, validadores, normalización de búsqueda, cada comando (ejecutar/deshacer/rehacer), migraciones con fixtures, importador con paquetes maliciosos.
- **Integración:** repositorios sobre IndexedDB simulada, flujo comando→persistencia→estado, importación/exportación *round-trip* (exportar → importar → comparar).
- **E2E (Playwright):** crear/mover/borrar/restaurar, undo entre estructura y edición, recarga forzada sin pérdida, multi-pestaña, teclado y accesibilidad (axe).
- **Propiedad/fuzz:** secuencias aleatorias de comandos con comprobación de invariantes (§5.2) tras cada paso.
- **CI:** tipos, lint, reglas de dependencia entre capas, pruebas, tamaño de bundle y benchmarks contra los presupuestos de §16.
- **Definición de "terminado":** criterios del documento base §9.

## 19. Plan de implementación

### M0 — Corte vertical (primer hito de código)

1. **Andamiaje:** Vite + TS estricto, lint, tests, reglas de capas, CI, CSP, registro de dependencias.
2. **`domain/`:** tipos, UUID v7, claves fraccionarias, utilidades de árbol + pruebas.
3. **`data/`:** `StorageEngine`, esquema v1, repositorios (workspace, node, content), migraciones (runner + v1), `meta`, `storage.persist()`.
4. **`commands/`:** `CommandBus`, `UndoManager`, comandos: `CREATE_WORKSPACE`, `CREATE_NODE`, `UPDATE_NODE`, `MOVE_NODE`, `TRASH_NODE`, `RESTORE_NODE`, `UPDATE_CONTENT` + prueba de propiedad.
5. **`state/`:** stores, sincronización entre pestañas, router hash.
6. **UI mínima:** shell (sidebar redimensionable/colapsable), árbol virtualizado con teclado, breadcrumbs, tema claro/oscuro, iconos SVG base, papelera básica.
7. **Editor mínimo:** ProseMirror con paragraph/heading/checklist + block-ids + autosave.
8. **IO mínimo:** exportar/importar `.aleph` (nodos y contenidos, sin binarios) + vista previa.
9. **Generador de 10.000 nodos + benchmarks.** *Criterios de salida:* presupuestos de §16 cumplidos; *fuzz* de comandos sin violar invariantes; *round-trip* de exportación exacto; recarga sin pérdida en 100 ciclos automáticos; navegación completa con teclado.

### Después de M0 (orden)

V0 (sistema de diseño completo, configuración) → V1 (editor completo, DnD avanzado, paleta de comandos, etiquetas, favoritos, recientes) → V2 (activos, PDF, imágenes, biblioteca) → V3 (paquete completo, carpeta vinculada, copias) → V4 (búsqueda avanzada, historial, alias/relaciones, grafo) → V5 (estudio).

## 20. Decisiones cerradas y especificaciones derivadas

### 20.1. Resumen de decisiones

| # | Decisión | Resultado |
| --- | --- | --- |
| A-1 | Capa de UI | **Propia**, sin framework (§20.2) |
| A-2 | Búsqueda | **MiniSearch** tras capa `SearchEngine` propia |
| A-3 | Carpeta vinculada | Solo Chromium; resto con exportación `.aleph` y recordatorios |
| A-4 | Tipos de nodo | **`page` y `file`**; curso/materia/etc. son presentación (§5.1) |
| A-5 | Nombre | **Aleph**, formato `.aleph` |
| A-6 | Tipografía | **Georgia** (local) + **Source Serif 4** de respaldo |
| A-7 | Idioma | **Solo español**, preparado para traducir (§20.5) |

### 20.2. Capa de UI propia

**Por qué:** menos dependencias, control total y reactividad fina (cambiar una fila del árbol no re-renderiza el árbol). Las dos partes más complejas de la interfaz (árbol virtualizado y editor) serían código propio incluso con un framework.

**Diseño (objetivo: \< 1.500 líneas, con pruebas):**

- **Reactividad:** `signal(v)`, `computed(fn)`, `effect(fn)`, `batch(fn)`; dependencias rastreadas automáticamente, limpieza determinista.
- **Vistas:** `h(tag, props, ...hijos)` crea **nodos DOM reales**; los valores dinámicos se pasan como funciones (`() => texto`) y se enlazan mediante `effect`. No hay DOM virtual.
- **Listas:** `each(signal, keyFn, render)` con reconciliación por clave (mover/añadir/quitar sin recrear).
- **Componentes:** funciones que devuelven DOM y pueden registrar `onCleanup`. Ciclo de vida explícito para evitar fugas.
- **Utilidades:** portales (menús/modales), gestión de foco (`focus trap`, restauración), delegación de eventos, `Icon`.
- **Reglas de seguridad de estilo:** prohibido `innerHTML` con datos (regla de lint); texto siempre vía `textContent`; atributos vía `setAttribute` con lista de permitidos para URLs.
- **Riesgo y mitigación:** requiere disciplina y buenas pruebas. La API se mantiene mínima y aislada en `ui/core`; si el crecimiento la volviera insostenible, se podría reemplazar por un framework pequeño sin tocar dominio, datos, comandos ni estado.

### 20.3. Guardado local de todo lo generado

**Regla:** toda salida de la aplicación llega al disco del usuario mediante un único módulo, `platform/save.ts`.

```ts
saveToDisk(blob: Blob, opts: { suggestedName: string; types: FileType[] }): Promise<SaveResult>
// 1) showSaveFilePicker (si existe)            → diálogo "Guardar como" nativo
// 2) navigator.share({files}) (móvil, si existe) → hoja de compartir a Archivos
// 3) <a download> con URL de Blob               → descarga universal
```

| Qué se genera | Formato | Cómo llega al PC |
| --- | --- | --- |
| Copia de seguridad / espacio / selección | `.aleph` | `saveToDisk`; automática y rotatoria con carpeta vinculada |
| Exportación legible | Markdown (carpeta ZIP), HTML, JSON | `saveToDisk` |
| Nota en PDF | PDF | Impresión del navegador (guardar como PDF) con hoja de estilos de impresión |
| Adjuntos (PDF, imágenes, archivos) | Original, sin modificar | "Guardar copia…" desde cualquier archivo; incluidos en `.aleph` con su nombre original |
| Espejo continuo | JSON + archivos en carpeta | Carpeta vinculada (Chromium) |
| Registro de diagnóstico | `.json` | Solo si el usuario lo exporta desde Datos; nunca se envía |

**Entrada desde el PC:** selector de archivos, arrastrar y soltar (archivos y **carpetas completas**, que crean el árbol correspondiente), pegado desde el portapapeles, y en la PWA instalada asociación de archivos (`file_handlers` en el manifiesto) para abrir `.aleph` con doble clic.

**Garantías:** sin peticiones de red en runtime (CSP `connect-src 'self'`); el nombre de archivo sugerido incluye espacio y fecha (`Universidad-2026-09-29.aleph`); cada guardado informa del resultado ("Guardado en Descargas" / "Guardado en la ubicación elegida").

### 20.4. Compatibilidad de contextos

**Detección de capacidades (no de navegador).** Cada función consulta `platform/capabilities.ts`; las ausentes usan el plan B.

| Capacidad | Chromium | Firefox | Safari | Plan B |
| --- | --- | --- | --- | --- |
| IndexedDB + Blob | Sí | Sí | Sí | Requisito mínimo; sin ella se muestra pantalla de incompatibilidad |
| `storage.persist()` | Sí | Sí (con aviso) | Parcial | Aviso y recordatorio de copias |
| Carpeta vinculada (File System Access) | Sí | No | No | Copias `.aleph` con recordatorios |
| Selector "Guardar como" | Sí | No | No | Descarga estándar |
| Web Locks | Sí | Sí | Sí (reciente) | Bloqueo cooperativo por `BroadcastChannel` |
| Service Worker / PWA | Sí | Sí (sin instalación en escritorio) | Sí | Funciona sin instalar; sin offline si no hay SW |
| `CompressionStream` | Sí | Sí | Sí (reciente) | Paquetes en modo *store* |
| `OffscreenCanvas` en worker | Sí | Sí | Parcial | Miniaturas en hilo principal |
| Entrada de carpeta (`webkitdirectory`) | Sí | Sí | Sí | Arrastrar archivos sueltos |

**Contextos de ejecución:**

1. **Alojado estático (HTTPS)** y **`localhost`:** contexto principal, todas las funciones.
2. **PWA instalada:** offline garantizado, asociación de archivos y mayor durabilidad en Safari.
3. **Archivo único portable (`aleph.html`)** — *después de M0*: un script de build propio inlinea JS/CSS/fuentes/workers (blob) en un solo HTML. Limitaciones documentadas: sin Service Worker; el origen `file://` puede variar según navegador (los datos pueden no encontrarse si el archivo cambia de ruta), por lo que se recomienda combinarlo con copias `.aleph` o carpeta vinculada.
4. **Dispositivos:** escritorio, tablet y móvil; entrada con **Pointer Events** (ratón, táctil, lápiz) y teclado completo; lectores de pantalla.

### 20.5. Internacionalización preparada (solo español)

- **Catálogo tipado:** `i18n/es.ts` exporta un objeto con claves jerárquicas (`tree.newPage`, `trash.emptyConfirm`); `t('tree.newPage')` comprueba las claves **en compilación**.
- **Plurales y variables:** `t('search.results', { count })` usa `Intl.PluralRules`; los mensajes se definen como formas (`uno`, `otros`) en el catálogo; **nunca se concatenan frases**.
- **Formatos:** `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` ("hace 3 min"), `Intl.NumberFormat`, `Intl.ListFormat`.
- **Ordenación natural:** `Intl.Collator(locale, { numeric: true, sensitivity: 'base' })` para que "Tema 2" preceda a "Tema 10" y los acentos no alteren el orden.
- **Lint:** regla que prohíbe literales de texto visibles fuera del catálogo (excepto nombres propios y símbolos).
- **Atributos de idioma:** `<html lang>` y `lang` del editor para ortografía y lectores de pantalla.
- **Coste de añadir un idioma futuro:** un archivo `xx.ts`, un selector en Configuración y revisión de la normalización de búsqueda (`SearchEngine` recibe el idioma).
- Los textos de plantillas iniciales (p. ej., "Temario", "Apuntes") también salen del catálogo, pero el contenido creado por el usuario nunca se traduce.

## 21. Siguientes documentos

- **Fase 1 (Especificación funcional):** pantalla a pantalla, estados y casos límite (crear, editar, eliminar, importar, exportar, errores, vacíos).
- **Fase 3 (Sistema de diseño):** tokens, tipografía, iconos, componentes, temas.
- **Fase 4 (Wireframes)** y **Fase 5 (implementación M0)**.