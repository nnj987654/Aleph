# Aleph — Entrega B: comandos, estado y rutas

Segunda entrega de código de Aleph (hito M0). **Sigue sin interfaz**: añade la lógica que la interfaz usará para cambiar y mostrar datos, con pruebas automáticas y un banco de pruebas en navegador real.

## Qué incluye

| Carpeta | Contenido |
|---|---|
| `src/domain/`, `src/data/`, `src/platform/` | Entrega A (dominio, almacenamiento). Sin cambios. |
| `src/core/reactive.ts` | Señales propias: `signal`, `computed`, `effect`, `batch`, `untracked`. Sin «glitches», con corte por igualdad. |
| `src/commands/` | **Bus de comandos**: cada acción es una transacción atómica con deshacer/rehacer, fusión de ediciones seguidas (teclear), límites de memoria y detección de cambios obsoletos. `definitions.ts` tiene todos los comandos. |
| `src/state/store.ts` | Estado en memoria del espacio abierto, actualizado de forma incremental, con señal propia por nodo y por lista de hijos. |
| `src/state/tab-sync.ts` | Sincronización entre pestañas (BroadcastChannel). |
| `src/app/router.ts`, `src/app/app.ts` | Rutas por hash y raíz de composición (`createApp`). |
| `src/i18n/` | Catálogo de textos en español: nada de texto de interfaz va escrito en el código, así que traducir en el futuro es añadir otro catálogo. |
| `bench/` | Banco de pruebas en Chromium real (`npm run bench`). |
| `tests/` | 97 pruebas + fuzz ampliable (`FUZZ_SEEDS=100`). |

### Comandos disponibles
Espacios: crear, modificar, eliminar (no deshacible). Nodos: crear, modificar, renombrar, favorito, mover uno o varios (con control de ciclos), duplicar subárbol con contenidos. Papelera: enviar, restaurar (vuelve a la raíz si el padre sigue eliminado), purgar y vaciar (no deshacibles: vacían el historial). Contenido: guardar documento.

## Cómo ejecutarlo en Windows (PowerShell)

```powershell
cd aleph
npm install
npm test             # 97 pruebas
$env:FUZZ_SEEDS=100; npm test   # fuzz más largo (opcional)
npm run typecheck
```
Para el banco de pruebas en navegador necesitas Playwright (no se instala con el proyecto):
```powershell
npm i -D playwright; npx playwright install chromium
npm run bench        # 10.000 nodos; admite: node bench/run.mjs 5000
```

## Cómo funciona deshacer/rehacer

Cada comando anota, por registro modificado, su imagen anterior y posterior. Deshacer escribe la anterior; rehacer, la posterior; ambas dentro de una transacción. Antes de escribir se comprueba que el registro sigue como lo dejó la operación; si otra pestaña lo cambió, se lanza `StaleHistoryError` y no se toca nada. Los binarios (futuros adjuntos) nunca entran en el historial.

## Verificado

- 97 pruebas y `tsc` sin errores. Fuzz: secuencias aleatorias de crear, mover, papelera, restaurar, duplicar, renombrar, editar, deshacer, rehacer y purgar; **tras cada paso** el estado en memoria es idéntico a la base y el árbol cumple sus invariantes (probado con 120 semillas). Esas pruebas encontraron un fallo real en el historial (deshacer dos pasos seguidos sobre el mismo registro) que está corregido y cubierto.
- Banco de pruebas en **Chromium 141 real**, 10.000 nodos, entorno de pruebas modesto (sin interfaz):

| Operación | Tiempo |
|---|---|
| Abrir la base y cargar 10.000 cabeceras | ~300 ms |
| Construir índice de hijos / aplanar todo desplegado | ~2 ms / ~3 ms |
| Crear, renombrar, mover (hoja o subárbol), deshacer un movimiento | 1–30 ms |
| Papelera de un subárbol de 1.111 nodos / deshacerla | ~560 ms / ~400 ms |
| Duplicar un subárbol de 1.111 nodos (con contenidos) | ~1,0 s |
| 200 inserciones seguidas en el mismo hueco / deshacerlas | ~0,9 s / ~0,4 s |
| Memoria JS / almacenamiento | ~26 MB / ~6,5 MB |

## Qué falta o conviene saber

- **Inserción en bloque lenta (10.000 nodos ≈ 12 s)** con el método sencillo usado por el banco. No afecta al uso normal, pero la **importación `.aleph` (Entrega C)** necesitará su propia vía optimizada (lotes en paralelo).
- Operaciones sobre subárboles grandes cuestan ≈ 0,5 ms por nodo (mantenimiento de índices de IndexedDB). Para la interfaz basta; si hiciera falta, se podrán reducir índices.
- Deshacer la creación de un nodo no comprueba hijos añadidos por otra pestaña después (límite conocido; el estado seguiría siendo consistente salvo ese caso extremo).
- Registro `journal` de la base: reservado, aún sin uso.
- Las señales (`src/core/`) viven fuera de `ui/` porque las usa el estado; la arquitectura dice `ui/core` y se corrige en la siguiente revisión del documento.

## Siguiente: Entrega C
Interfaz (shell, árbol virtualizado, Inicio con tarjetas y Mapa acoplable), editor de tres bloques, exportar/importar `.aleph`.
