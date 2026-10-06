# Aleph — Entrega A: dominio y datos

Primera entrega de código de Aleph (hito M0). **Todavía no tiene interfaz**: contiene los cimientos que la sostendrán, con pruebas automáticas.

## Qué incluye

| Carpeta | Contenido |
|---|---|
| `src/domain/` | Tipos del modelo, ids UUID v7, claves fraccionarias de orden, utilidades de árbol e invariantes. Sin dependencias del navegador. |
| `src/data/` | Interfaz `StorageEngine`, motor IndexedDB con transacciones atómicas, migraciones, repositorios (espacios, nodos, contenidos, meta). |
| `src/platform/storage.ts` | Estado y petición de almacenamiento persistente (`navigator.storage`). |
| `src/main.ts` | Página de comprobación: abre la base de datos y muestra su estado. |
| `tests/` | 51 pruebas (dominio, motor, repositorios, migraciones, almacenamiento). |

## Cómo ejecutarlo en Windows (PowerShell)

Requiere Node.js 18 o superior (`node -v` para comprobarlo).

```powershell
cd aleph
npm install        # instala solo herramientas de desarrollo
npm test           # ejecuta las 51 pruebas
npm run typecheck  # comprueba los tipos de TypeScript
npm run dev        # abre la página de comprobación (http://localhost:5173)
npm run build      # genera la carpeta dist/ lista para alojar
```

Al abrir `npm run dev`, la página debe mostrar algo como:
`Base de datos abierta (esquema v1). 0 espacios, 0 páginas. Almacenamiento … Dispositivo xxxxxxxx.`
Si ves un error en su lugar, cópiamelo tal cual.

## Qué se ha verificado y qué no

- **Verificado aquí:** tipos, 51 pruebas y compilación de producción. Las pruebas de datos usan `fake-indexeddb`, un simulador de IndexedDB.
- **Sin verificar todavía en un navegador real:** el rendimiento con 10.000 nodos. El simulador mantiene los índices con coste cuadrático (10.000 nodos tardan decenas de segundos en pruebas, algo que un navegador real no hace), así que la prueba de volumen usa 2.000 nodos. El presupuesto real se mide en la Entrega C con un banco de pruebas en el navegador.
- **Pendiente por diseño:** la copia de seguridad automática antes de migrar necesita el exportador `.aleph` (Entrega C); el motor ya está preparado para engancharla.

## Decisiones que corrigen o precisan la arquitectura

1. **`null` y booleanos no son claves válidas de IndexedDB.** Un campo indexado con ese valor deja el registro fuera del índice. Por eso los nodos guardan además `parentKey` (el padre, o `''` en la raíz; los repositorios lo añaden y quitan solos), el índice `deleted` solo contiene nodos eliminados, y **no existe índice `favorite`**: los favoritos se filtran en memoria.
2. **Claves de orden:** algoritmo de David Greenspan (dominio público), reescrito en TypeScript. Añadir al final o al principio mantiene las claves en ≤ 5 caracteres tras 5.000 inserciones; insertar siempre en el mismo hueco las alarga y `needsReindex` avisa para reindexar a los hermanos con `spread`.
3. **Transacciones:** dentro de `engine.transaction(...)` solo se puede esperar a operaciones de `tx`. Esperar a otra cosa (un `fetch`, un `setTimeout`) cierra la transacción.
4. **Migraciones:** se añaden a `src/data/migrations/index.ts` como `{ from: N, to: N+1, up }`; nunca se editan las anteriores. Si una falla, la base anterior queda intacta (hay prueba).

## Siguientes entregas

- **B:** comandos con deshacer/rehacer, papelera, estado reactivo y router.
- **C:** interfaz (shell, árbol virtualizado, Inicio y Mapa), editor con tres bloques, exportar/importar `.aleph` y banco de pruebas con 10.000 nodos.
