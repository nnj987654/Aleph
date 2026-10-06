Markdown · 03-Aleph-especificacion-funcional.md

# Aleph — Especificación funcional (Fase 1)

**Estado:** v1.1 (incorpora el Inicio en tarjetas, el Mapa acoplable y la sangría) · **Depende de:** `01` (documento base v2.2) y `02` (arquitectura v1.1) **Objetivo:** definir qué hace cada pantalla y cada función, sus estados y sus casos límite, antes de diseñar o programar.

**Etiquetas de fase:** `M0` corte vertical · `V0` fundación · `V1` conocimiento · `V2` archivos · `V3` portabilidad · `V4` productividad · `V5` estudio. Una función sin etiqueta pertenece a la fase de su área.

---

## 1. Cómo se consigue "sencillo pero potente"

Nueve reglas de interfaz. Cualquier pantalla o función nueva debe cumplirlas.

1. **Tres zonas, siempre las mismas:** barra lateral (dónde estoy), contenido (qué veo), panel contextual (qué más hay; **oculto por defecto**).
2. **Superficie mínima.** La cabecera del contenido muestra como máximo: migas de pan, título, `Buscar`, `Panel` y `Más (⋯)`. Todo lo demás vive en el menú contextual, el menú `/`, o la paleta de comandos.
3. **Tres vías para cada acción:** ratón (menú contextual/botón que aparece al pasar), teclado (atajo) y paleta (`Ctrl/Cmd+K`). Nada es exclusivo de una vía.
4. **Aparición progresiva.** Las acciones secundarias aparecen al pasar el cursor, al seleccionar o al enfocar; nunca ocupan espacio permanente.
5. **Deshacer antes que confirmar.** Las acciones reversibles no piden confirmación: ejecutan y muestran un aviso con `Deshacer`. Solo se confirma lo **irreversible** (eliminar definitivamente, vaciar papelera, reemplazar datos al importar).
6. **Pocos modales.** Se usan solo para confirmaciones irreversibles e importación. Renombrar, mover, elegir icono, etc. ocurren en línea o en un *popover* junto al elemento.
7. **Estados vacíos que guían.** Ninguna zona queda en blanco: siempre indica qué es y ofrece la acción principal.
8. **Lenguaje llano en español.** Sin jerga técnica ("Página", "Carpeta de archivos", "Copia de seguridad").
9. **Todo se guarda solo.** No existe "Guardar" obligatorio; siempre se ve un estado discreto ("Guardado").

**Modelo mental único para el usuario:** *todo es una página; las páginas contienen páginas y archivos.* Un "curso" o una "materia" es una página con un icono y una plantilla.

---

## 2. Mapa de pantallas

| Pantalla | Ruta (hash) | Propósito | Fase |
| --- | --- | --- | --- |
| Bienvenida | `#/welcome` | Primera vez: crear espacio o importar | M0 |
| Inicio del espacio | `#/w/:ws` | Continuar, recientes, favoritos, estructura | V0 |
| Página (documento) | `#/w/:ws/p/:id` | Leer y editar una página | M0 |
| Índice de página | (misma ruta, sin contenido) | Mostrar hijos como lista/tarjetas | V0 |
| Visor de archivo | `#/w/:ws/f/:id` | PDF, imagen u otro archivo | V2 |
| Biblioteca | `#/w/:ws/library` | Todos los archivos del espacio | V2 |
| Búsqueda | `#/search?q=` | Resultados y filtros | V1 |
| Favoritos | `#/w/:ws/favorites` | Accesos fijados | V1 |
| Recientes | `#/w/:ws/recent` | Últimos abiertos/editados | V1 |
| Etiquetas | `#/w/:ws/tags/:tag` | Contenidos por etiqueta | V1 |
| Tareas y agenda | `#/w/:ws/tasks` | Checklists con fecha (Hoy, Próximos) | V5 |
| Estudio | `#/w/:ws/study` | Flashcards y repaso | V5 |
| Grafo | `#/w/:ws/graph` | Relaciones | V4 |
| Papelera | `#/w/:ws/trash` | Restaurar o eliminar definitivamente | M0 |
| Configuración | `#/settings/:area` | Preferencias | V0 |
| Superposiciones | — | Paleta, vista rápida, importar, exportar, atajos | según fase |

---

## 3. Estructura global de la interfaz

```text
┌───────────────┬──────────────────────────────────────┬────────────┐
│ Barra lateral │ Cabecera: migas · título · ⌕ ▤ ⋯     │ Panel      │
│               ├──────────────────────────────────────┤ (opcional) │
│ Espacio ▾     │                                      │            │
│ ⌕ Buscar      │           Contenido                  │ Vista      │
│ Inicio        │                                      │ rápida     │
│ Favoritos     │                                      │ Índice     │
│ Recientes     │                                      │ Enlaces    │
│ ────────────  │                                      │ Historial  │
│ Árbol         │                                      │ Detalles   │
│  ▾ Materia    │                                      │            │
│    ▸ Tema     │                                      │            │
│ ────────────  │                                      │            │
│ Biblioteca    │                                      │            │
│ Papelera      │                                      │            │
│ ⚙ Ajustes     │                                      │            │
└───────────────┴──────────────────────────────────────┴────────────┘
```

*(Los iconos del esquema son solo indicativos; en la interfaz real son SVG propios.)*

### 3.1. Barra lateral

- **Cabecera:** selector de espacio (nombre + icono + color; desplegable con la lista de espacios y "Nuevo espacio").
- **Accesos:** Buscar (abre paleta en modo búsqueda), Inicio, Favoritos, Recientes.
- **Árbol** del espacio activo (ver §4.4). Ocupa todo el espacio vertical restante.
- **Pie:** Biblioteca, Papelera, Ajustes, y (si aplica) indicador de almacenamiento/copia.
- **Estados:** *expandida* (ancho ajustable 220–480 px, valor por defecto 280), *colapsada* (barra de 56 px con iconos y tooltips; el árbol se sustituye por los espacios y accesos), *cajón* en móvil/tablet estrecha (se abre sobre el contenido y se cierra al elegir).
- **Redimensionar:** arrastre del borde (con área de agarre amplia), doble clic restablece el ancho, teclado (`←/→` con el separador enfocado). Ancho y estado se recuerdan.
- **Acceso rápido a mostrar/ocultar:** `Ctrl/Cmd+B`.

### 3.2. Cabecera de contenido

- **Migas de pan** (`Espacio › Curso › Materia › Tema`): cada tramo es enlace; el último es el título editable en línea (clic o `F2`). Si es larga, se abrevia con `…` y un menú con los tramos ocultos.
- **Acciones visibles:** `Buscar`, `Panel` (alterna panel contextual), `Más (⋯)`.
- **`Más (⋯)`:** favorito, duplicar, mover a…, copiar enlace, exportar, historial, información, eliminar.
- **Estado de guardado:** texto pequeño junto al título ("Guardando…" → "Guardado"); en error, aviso persistente con acción.

### 3.3. Panel contextual (derecha)

Un único panel con pestañas que **solo aparece si el usuario lo abre**:

- **Índice** (títulos de la página actual, con salto y resaltado del actual) — V1
- **Enlaces** (enlaces a esta página / desde ella; relacionados) — V1/V4
- **Detalles** (tipo, fechas, etiquetas, tamaño, ubicación) — V1
- **Historial** (versiones y restauración) — V4
- **Vista rápida** (previsualizar otra página sin salir de esta) — V1
- Ancho ajustable; en pantallas estrechas se muestra como hoja inferior.

### 3.4. Mapa acoplable `V0`

El **Mapa** es el mismo mapa de tarjetas del Inicio, en versión compacta, **acoplado a la derecha o a la izquierda** mientras se trabaja, para tener siempre presente toda la estructura.

- **Abrir/cerrar:** botón *Mapa* en la cabecera, `Ctrl/Cmd+M` y paleta. El estado (abierto/cerrado, lado, ancho) se recuerda.
- **Contenido:** idéntico al Inicio (tarjetas anidadas, colores por nivel, contadores, posición actual resaltada) en una sola columna.
- **Acciones de la cabecera del Mapa:** `Expandir todo`, `Contraer todo`, `Cambiar de lado`, `Cerrar`.
- **Estado compartido:** desplegar una tarjeta en el Mapa la despliega también en el Inicio, y viceversa.
- **Relación con el árbol de la barra lateral:** el árbol es la navegación rápida en texto; el Mapa es la vista visual. Configuración permite **ocultar el árbol de la barra** y usar solo el Mapa.
- **Responsive:** en pantallas estrechas el Mapa se muestra como hoja inferior o se oculta; no compite con el contenido.
- **Con el panel contextual abierto** (§3.3): ambos pueden convivir en escritorio ancho; en espacios más reducidos el último abierto sustituye al anterior.

### 3.5. Notificaciones

- **Avisos breves (toast)** abajo a la izquierda, con acción (`Deshacer`, `Ver`). Duración 6 s; se pausan al pasar el cursor; accesibles (`aria-live`).
- **Avisos persistentes** solo para problemas que requieren acción (error de guardado, cuota llena, otra pestaña modificó la página).

---

## 4. Especificación por pantalla

### 4.1. Bienvenida `M0`

- **Contenido:** título "Bienvenido a Aleph", una frase ("Organiza todo tu conocimiento en un solo lugar. Todo se guarda en tu equipo."), botón principal **Crear mi primer espacio**, y acciones secundarias: **Empezar desde cero** (espacio vacío), **Importar una copia (.aleph)**.
- **Creación guiada (opcional, un paso):** nombre del espacio + "¿Qué quieres organizar?" (Estudios · Trabajo · Proyecto · Personal · Otro). La respuesta solo elige **plantilla inicial e icono/color**; siempre se puede omitir.
- **Al terminar:** se abre el Inicio del espacio con un aviso corto: "Puedes crear tu primera página con el botón + del árbol o con `Ctrl+N`". Se solicita `storage.persist()` en este momento o al primer contenido.
- **Casos límite:** navegador sin IndexedDB → pantalla de incompatibilidad con explicación y lista de navegadores compatibles; modo privado con almacenamiento efímero → aviso claro de que los datos se perderán al cerrar y sugerencia de exportar.

### 4.2. Inicio del espacio: mapa de tarjetas `V0`

El Inicio muestra **toda la estructura del espacio** como tarjetas embebidas unas en otras. Es la vista visual de referencia del producto.

- **Tarjetas anidadas:** cada página o archivo es una tarjeta; las que tienen hijos se pueden **desplegar y contraer** (chevrón SVG) y al desplegarse ocupan la fila completa para dar sitio a su contenido. Los hijos son tarjetas a su vez, sin límite de profundidad.
- **Entrar directamente:** clic en el título de cualquier tarjeta abre esa página o archivo, sin pasos intermedios. El chevrón solo despliega.
- **Color por nivel:** cada nivel de profundidad usa un tono distinto (fondo suave, borde lateral e icono del mismo tono). El tono es **configurable** (Configuración → Apariencia → Colores del mapa) y se aplica por nivel, no por rama. Valores por defecto: seis tonos que se repiten cíclicamente.
- **El color nunca es la única señal del nivel:** la anidación visual, el borde lateral y el nombre accesible ("Cálculo, nivel 3") transmiten la jerarquía a quien no distingue colores.
- **Contadores:** cada tarjeta con hijos muestra cuántos elementos contiene en total.
- **Posición actual:** la página abierta se resalta con un anillo de acento y sus ancestros se despliegan al abrirla.
- **Barra de la vista:** `Expandir todo` y `Contraer todo`. El estado de desplegado **se recuerda** por espacio y es **compartido con el Mapa** (§3.4).
- **Rendimiento:** solo se dibuja lo desplegado; el contenido de una tarjeta contraída no existe en el DOM. Con listas muy largas dentro de una tarjeta se pagina o virtualiza.
- **Accesos auxiliares** (solo si tienen contenido, bajo el mapa): *Continuar* (último abierto), *Recientes* (8), *Favoritos* (8), *Próximas tareas* `V5`.
- **Acciones:** `Nueva página`, `Importar`, `Abrir búsqueda`; ajustes del espacio (renombrar, color, icono, descripción, eliminar).
- **Teclado:** `Tab` recorre títulos; `Intro` abre; `→`/`←` sobre una tarjeta la despliega o contrae; `Mayús+→` despliega toda la rama.
- **Evolución** `V4`: arrastrar tarjetas entre tarjetas para reorganizar (mismo comando `MOVE_NODE`).
- **Vacío:** "Este espacio está vacío. Crea tu primera página." + botones `Nueva página` y `Desde plantilla`.

### 4.3. Índice de página `V0`

Una página **sin contenido propio y con hijos** muestra automáticamente sus hijos, sin que el usuario configure nada.

- **Vistas** (selector discreto): *Tarjetas*, *Lista* (nombre, tipo, modificado, etiquetas), *Árbol*. La elección se recuerda por página.
- **Orden:** manual (por defecto, arrastrable), nombre (natural), modificado, creado, tipo.
- **Filtros rápidos:** por tipo (páginas/archivos), etiqueta, favoritos.
- **Acciones:** `Nueva página aquí`, `Añadir archivo`, `Escribir contenido` (convierte la página en documento manteniendo los hijos debajo).
- **Una página con contenido y con hijos** muestra el documento y, al final, una sección plegable "Páginas dentro" con la lista de hijos.
- **Vacío (sin contenido ni hijos):** cursor en el cuerpo con texto guía "Escribe algo, pulsa `/` para insertar bloques o arrastra archivos aquí".

### 4.4. Árbol de navegación `M0`

- **Filas:** chevrón (SVG), icono (personalizable/color), título, indicadores discretos (favorito, etiquetas no, adjunto no; solo icono especial para archivo y alias), y acciones al pasar el cursor: `+` (nueva página dentro) y `⋯` (menú).
- **Expandir/contraer:** clic en chevrón, `→`/`←`, doble clic en el título abre; estado recordado por espacio.
- **Acciones de rama:** menú → "Expandir todo aquí", "Contraer todo aquí"; en cabecera del árbol: "Expandir todo" / "Contraer todo".
- **Seleccionar y abrir:** un clic abre la página (el árbol resalta la actual y hace *scroll* hasta ella); `Ctrl/Cmd+clic` selecciona varias; `Mayús+clic` rango.
- **Renombrar:** `F2` o menú; edición en línea; `Enter` confirma, `Esc` cancela; título vacío → conserva el anterior.
- **Crear:** botón `+` de la fila (hija), `+ Nueva página` al final del árbol (raíz), `Ctrl/Cmd+N` (hermana de la actual), menú contextual. La página nueva aparece **ya en edición del título**.
- **Arrastrar y soltar:** ver §5.3.
- **Menú contextual de nodo:** Abrir · Abrir en panel · Nueva página dentro · Renombrar · Icono y color · Favorito · Etiquetas · Duplicar · Mover a… · Copiar enlace · Exportar… · Alias en… · Eliminar.
- **Árbol vacío:** "Aún no hay páginas" + botón `Nueva página`.
- **Rendimiento:** virtualizado; 10.000 nodos sin degradar (arquitectura §9).

### 4.5. Página / editor `M0`

**Estructura del documento:** título grande (Georgia, editable) → propiedades discretas (etiquetas, icono, color, fecha; se revelan al hacer clic en "Añadir propiedades") → cuerpo de bloques → sección "Páginas dentro" (si hay hijos) → "Enlaces a esta página" (si existen).

**Interacciones del editor**

- **Menú `/`:** lista filtrable de bloques con icono, nombre y atajo; navegación con teclado; `Esc` cierra; el texto tras `/` filtra ("/tab" → Tabla).
- **Barra flotante** sobre la selección: negrita, cursiva, subrayado, tachado, código, resaltado, enlace, tipo de bloque, color. No hay barra fija.
- **Atajos Markdown** al escribir: `# ` título 1, `## ` título 2, `### ` título 3, `- ` / `* ` lista, `1. ` numerada, `[] ` tarea, `> ` cita, ```` ``` ```` código, `---` separador, `**negrita**`, `*cursiva*`, `` `código` ``.
- **Manejadores de bloque** (al pasar el cursor, a la izquierda): arrastrar para mover; clic abre menú (convertir en…, duplicar, eliminar, copiar enlace al bloque).
- **Enlaces internos:** escribir `[[` abre buscador de páginas y bloques; crea enlace con el título vivo (si la página se renombra, el enlace se actualiza) `V1`.
- **Sangría de párrafo:** los párrafos de lectura llevan sangría de primera línea (`text-indent`, 1,6 em) para ver dónde empieza y termina cada uno; el espacio entre párrafos es pequeño, como en un libro. **No** se aplica a títulos, listas, tablas, código, callouts ni a la interfaz. Se puede desactivar en Configuración → Editor y es una propiedad de presentación: no altera el contenido guardado ni la exportación.
- **Pegado:** texto plano, Markdown (se convierte), HTML (se sanea y convierte a bloques), imágenes (se guardan como archivo adjunto) `V2`.
- **Arrastrar archivos** al cuerpo: imágenes se insertan como bloque; PDF/otros como bloque de archivo `V2`.
- **Buscar en la página** (`Ctrl/Cmd+F`): barra propia con resaltado y siguiente/anterior; opción reemplazar `V1`.
- **Modo enfoque** (`Ctrl/Cmd+Shift+F`): oculta sidebar y cabecera, solo el documento `V1`.
- **Recuento** de palabras y tiempo de lectura (en `Detalles`) `V1`.
- **Autoguardado:** ver §3.2 y arquitectura §6.3.

**Catálogo de bloques**

| Bloque | Descripción | Fase |
| --- | --- | --- |
| Texto | Párrafo con formato en línea | M0 |
| Título 1–3 | Encabezados; alimentan el Índice | M0 |
| Lista con viñetas / numerada | Anidables con `Tab`/`Mayús+Tab` | V1 |
| Tarea (checklist) | Casilla, texto y fecha opcional | M0 |
| Desplegable | Bloque plegable con título y contenido oculto | V1 |
| Cita | Bloque citado | V1 |
| Código | Monoespaciado, con nombre de lenguaje y botón copiar; sin resaltado en V1 | V1 |
| Callout | Aviso con icono y color (información, atención, éxito, peligro) | V1 |
| Separador | Línea horizontal | V1 |
| Tabla | Filas/columnas, encabezado, añadir/quitar con teclado, orden, alineación | V1 |
| Imagen | Con pie de foto, tamaño, alineación y visor a pantalla completa | V2 |
| Archivo | Tarjeta con nombre, tipo y tamaño; abrir/guardar copia | V2 |
| PDF | Incrustado con selector de página y "abrir completo" | V2 |
| Fórmula | Bloque o en línea (KaTeX, carga bajo demanda) | V1 |
| Enlace a página | Tarjeta con la página enlazada (título, ruta, fragmento) | V1 |
| Tarjeta de estudio | Pregunta/respuesta convertible en flashcard | V5 |

**Errores y bordes:** documento muy grande (> 1 MB de texto) → aviso de rendimiento y sugerencia de dividir; error de guardado → aviso persistente con `Reintentar` y `Exportar esta página`; página eliminada en otra pestaña → banner "Esta página fue movida a la papelera" con `Restaurar`.

### 4.6. Visor de archivos `V2`

**PDF:** panel de miniaturas plegable, desplazamiento continuo, zoom (ajustar ancho/página, 25–400 %), ir a página, buscar (con resultados navegables), pantalla completa, rotar vista, recuerda la última página, `Guardar copia`, `Abrir en su página` (si está incrustado). **Imagen:** ajustar/100 %/zoom libre, arrastrar para mover, rotar (no destructivo), pantalla completa, `Sustituir`, `Guardar copia`, `Copiar`, ver metadatos (dimensiones, tamaño). **Otros archivos:** tarjeta con icono, nombre, tamaño y acciones `Guardar copia`; **texto/CSV/JSON** se previsualizan en línea (CSV como tabla, solo lectura). **Vacío/errores:** archivo dañado o formato no compatible → mensaje claro + `Guardar copia`; PDF protegido con contraseña → solicitar contraseña (solo en memoria).

### 4.7. Biblioteca `V2`

- Todos los archivos del espacio, independientemente de su ubicación.
- **Categorías:** Todos · PDFs · Imágenes · Documentos · Tablas/Datos · Otros.
- **Vistas:** cuadrícula con miniaturas (por defecto), lista.
- **Orden y filtros:** nombre, fecha, tamaño; por etiqueta; por página de origen.
- **Acciones por archivo:** abrir, mostrar en el árbol, guardar copia, renombrar, mover, sustituir, eliminar; subida múltiple por arrastre.
- **Vacío:** "Aquí aparecerán tus PDFs, imágenes y archivos".

### 4.8. Búsqueda `V1` (básica en M0: por título)

- **Acceso:** `Ctrl/Cmd+K` (modo mixto: acciones + resultados) o `Ctrl/Cmd+/` (búsqueda directa); también icono en la sidebar.
- **Resultados en vivo** (\< 100 ms) agrupados: Páginas · Archivos · Espacios · Acciones; cada uno con icono, título, ruta y fragmento con coincidencia resaltada.
- **Filtros** como *chips*: tipo, etiqueta, espacio (actual/todos), fecha, favoritos; y **sintaxis escrita** (`type:pdf tag:examen in:matematicas is:favorite after:2026-01-01`).
- **Búsquedas guardadas** (V4): guardar una consulta como acceso en la sidebar.
- **Tolerancia:** sin acentos, mayúsculas indiferentes, prefijos, errores leves.
- **Sin resultados:** "No hay resultados para «…»" + sugerencias (quitar filtros, buscar en todos los espacios, crear página con ese título).
- **Teclado:** `↑↓` mover, `Enter` abrir, `Ctrl/Cmd+Enter` abrir en panel, `Tab` alterna filtros.

### 4.9. Paleta de comandos `V1` (mínima en M0)

- **Modos por prefijo:** sin prefijo (buscar + acciones), `>` solo comandos, `#` etiquetas, `@` páginas recientes, `/` ir a ruta.
- **Comandos:** nueva página/espacio, ir a…, alternar sidebar/panel, cambiar tema/acento, expandir/contraer todo, exportar, importar, abrir configuración, ver atajos, deshacer/rehacer, vaciar papelera, comprobar integridad, etc.
- **Contexto:** los comandos relevantes a la selección actual aparecen primero (p. ej., "Mover esta página").
- **Historial:** recuerda comandos y páginas usados recientemente.
- Atajos de cada comando visibles a la derecha.

### 4.10. Favoritos, Recientes, Etiquetas `V1`

- **Favoritos:** lista/tarjetas; reordenar manualmente; quitar desde aquí. Aparecen también fijados arriba de la sidebar (máx. 5 visibles + "Ver todos").
- **Recientes:** agrupados por Hoy · Ayer · Esta semana · Antes; distingue "abiertos" y "editados"; `Limpiar historial` (no borra contenido).
- **Etiquetas:** lista global con conteo; clic filtra; renombrar y combinar etiquetas; color opcional; autocompletado al etiquetar; crear con `#` en el buscador de etiquetas.

### 4.11. Papelera `M0`

- Lista de elementos eliminados con **ruta original**, fecha de eliminación y **tiempo restante** antes de vaciado automático (por defecto 30 días).
- **Acciones:** `Restaurar` (a su lugar; si el padre no existe, a la raíz con aviso), `Eliminar definitivamente` (confirmación irreversible), `Vaciar papelera` (confirmación con recuento).
- Un subárbol eliminado aparece como **un elemento** con indicación "(+12 elementos)".
- **Vacía:** "La papelera está vacía. Lo que elimines se guardará aquí 30 días."

### 4.12. Configuración `V0` (básica en M0: tema)

| Área | Opciones |
| --- | --- |
| **Apariencia** | Tema (claro/oscuro/automático), color de acento (7), **colores del mapa por nivel (6 tonos editables)**, densidad (cómoda/compacta), tamaño de interfaz, animaciones (normales/reducidas/ninguna) |
| **Editor** | Tipografía (Georgia/sans/mono), tamaño de texto, ancho de línea (estrecho/medio/ancho), interlineado, **sangría de párrafo (activada por defecto)**, autoguardado (retardo), ortografía del navegador |
| **Navegación** | Sidebar (ancho, estado inicial), mostrar migas, abrir en (misma vista / panel), orden por defecto de hijos |
| **Datos** | Estado de almacenamiento (protegido/no), uso y cuota, **Exportar**, **Importar**, copias de seguridad (manual, recordatorio, carpeta vinculada, copias automáticas), comprobar integridad, reconstruir índice de búsqueda, papelera (retención) |
| **Atajos** | Lista completa buscable; **personalizables** `V4` |
| **Acerca de** | Versión, licencias de dependencias, formato de datos, cómo funciona el almacenamiento local |

Cada cambio se aplica al instante (sin "Aplicar"); "Restablecer" por área.

### 4.13. Importar `V3` (`.aleph` mínimo en M0)

Flujo (un solo panel, sin salir del contexto):

1. **Elegir origen:** arrastrar o seleccionar `.aleph`, `.zip` de Markdown, carpeta, archivos sueltos (Markdown, texto, PDF, imágenes, CSV, JSON).
2. **Vista previa:** "Universidad.aleph — 23 páginas · 184 bloques de contenido · 42 archivos · 128 MB", origen (fecha, versión), advertencias (elementos ignorados, versión más nueva).
3. **Elegir destino/estrategia:** *Nuevo espacio* (por defecto) · *Dentro de…* (elegir página) · *Fusionar* `V3+` · *Reemplazar espacio* (con copia previa automática).
4. **Progreso** cancelable; **resultado** con resumen y `Ver en el árbol`; aviso con `Deshacer importación`.

- **Errores:** paquete dañado (qué falta), versión no soportada (actualiza Aleph), sin espacio (cuánto falta), contenido rechazado por seguridad (lista sin abortar todo lo demás).

### 4.14. Exportar `V3` (`.aleph`/JSON mínimo en M0)

- **Alcance:** esta página · esta rama · este espacio · todo Aleph.
- **Formato:** Copia completa `.aleph` (recomendado) · Markdown · HTML · JSON · PDF (página actual).
- **Opciones:** incluir archivos, incluir historial, incluir papelera.
- **Resultado:** `saveToDisk` con nombre sugerido; aviso de dónde se guardó; guarda la fecha de "última copia" si es `.aleph` completo.

### 4.15. Vista rápida `V1`

Panel lateral con previsualización de solo lectura de otra página o archivo (al pasar sobre un enlace interno con `Alt` o menú "Vista rápida"): título, ruta, contenido (primeras secciones), archivos, relacionados, y `Abrir completo` / `Abrir aquí`.

### 4.16. Atajos (hoja de atajos) `V0`

`Ctrl/Cmd+/` o `?`: superposición buscable con todos los atajos agrupados; cada uno enlaza a su configuración `V4`.

---

## 5. Catálogo de funcionalidades

### 5.1. Organización y estructura

| Función | Fase |
| --- | --- |
| Espacios múltiples (nombre, icono, color, descripción, orden) | M0 |
| Páginas anidadas sin límite práctico; un solo modelo (página/archivo) | M0 |
| Crear, renombrar, mover, eliminar, restaurar | M0 |
| Duplicar página o rama (con o sin archivos) | V0 |
| Iconos (biblioteca SVG propia) y colores por página | V0 |
| Plantillas al crear (materia universitaria, curso, programación, proyecto, apuntes, diario, vacío) y **guardar rama como plantilla propia** | V0 / V1 |
| Reordenar manual (arrastre y teclado); orden automático opcional por página | V0 |
| Selección múltiple y acciones por lote (mover, etiquetar, eliminar, exportar) | V1 |
| Favoritos (con orden propio) y fijados en sidebar | V1 |
| Recientes | V1 |
| Etiquetas (múltiples, con color) | V1 |
| **Alias** (una página que aparece en otra rama) | V4 |
| Vistas del índice: tarjetas, lista, árbol | V0 |
| **Inicio como mapa de tarjetas anidadas** con color por nivel | V0 |
| **Mapa acoplable** a izquierda o derecha, con estado compartido | V0 |
| Colores del mapa por nivel configurables | V1 |
| Reorganizar arrastrando tarjetas dentro del mapa | V4 |
| Expandir/contraer todo por rama, estado recordado | M0 |
| Buscar dentro del árbol (filtrado en vivo) | V1 |
| Mover a… con selector jerárquico buscable | V0 |
| Migas de pan navegables | M0 |
| Pestañas y **vista dividida** (dos páginas lado a lado) | V4 |

### 5.2. Editor y contenido

| Función | Fase |
| --- | --- |
| Bloques: texto, títulos, tarea | M0 |
| Resto de bloques del catálogo (§4.5) | V1–V2 |
| Formato en línea (negrita, cursiva, subrayado, tachado, código, resaltado, enlace, color) | V1 |
| Menú `/` y atajos Markdown | V1 |
| Enlaces internos `[[ ]]` a páginas y bloques, **enlaces entrantes** ("Aparece en…") | V1 |
| Índice automático de la página (panel) | V1 |
| Desplegables (toggles) y plegar/desplegar todos | V1 |
| Buscar y reemplazar en la página | V1 |
| Modo enfoque, ancho y tipografía configurables | V1 |
| Tablas con orden, encabezados, filas/columnas rápidas | V1 |
| Fórmulas (bloque y en línea) | V1 |
| Insertar fecha, hora, "hoy"; recuento de palabras | V1 |
| Historial de versiones y restauración (con comparación simple) | V4 |
| Imprimir / guardar como PDF con estilo limpio | V3 |

### 5.3. Arrastrar y soltar

- **Árbol:** indicador de línea *antes / después* y resaltado *dentro*; auto-expandir al mantener sobre un nodo; auto-scroll en bordes; no permite soltar un nodo dentro de sí mismo ni de sus descendientes (cursor "no permitido" y mensaje breve).
- **Bloques:** arrastre por el manejador; línea azul de destino; copiar con `Alt`.
- **Archivos desde el PC:** sobre el árbol (crea un nodo `file` dentro del destino), sobre el cuerpo (bloque), sobre la biblioteca (sube a la raíz del espacio).
- **Carpeta completa desde el PC:** crea la estructura de páginas y archivos equivalente (con vista previa del número de elementos antes de confirmar si supera 200).
- **Alternativa por teclado/táctil:** `Mover a…`, `Ctrl+Mayús+↑/↓`; en táctil, pulsación larga activa arrastre.
- **Resultado:** un único comando → un único `Deshacer`.

### 5.4. Archivos

| Función | Fase |
| --- | --- |
| Adjuntar por selector, arrastre y pegado | V2 |
| Tipos: PDF, PNG, JPG, WEBP, SVG (seguro), GIF, TXT, MD, CSV, JSON y otros (como descarga) | V2 |
| Visor PDF y visor de imágenes | V2 |
| Miniaturas | V2 |
| Biblioteca global | V2 |
| Guardar copia de cualquier archivo en el PC | V2 |
| Sustituir archivo manteniendo enlaces | V2 |
| Detección de duplicados (mismo contenido) con aviso | V2 |
| Texto de PDF indexado en la búsqueda (segundo plano) | V4 |
| Anotaciones simples sobre PDF (resaltar, notas) guardadas como datos de Aleph, sin modificar el original | V4 |
| Límites configurables y aviso de cuota | V2 |

### 5.5. Búsqueda y navegación rápida

| Función | Fase |
| --- | --- |
| Búsqueda por título | M0 |
| Búsqueda de texto completo, etiquetas, archivos | V1 |
| Filtros y sintaxis (`type:`, `tag:`, `in:`, `is:`, `before:`/`after:`) | V1 |
| Paleta de comandos y saltador rápido | V1 |
| Búsquedas guardadas | V4 |
| Historial de búsquedas | V1 |

### 5.6. Estudio y planificación `V5`

| Función | Descripción |
| --- | --- |
| Tarjetas de estudio | Se crean desde un bloque ("Convertir en tarjeta") o escribiendo `?? pregunta :: respuesta` |
| Repaso | Sesión con mostrar respuesta y valoración (otra vez / difícil / bien / fácil); **repetición espaciada** con algoritmo estilo SM-2, todo local |
| Mazos | Cualquier rama puede ser un mazo; estadísticas por mazo (pendientes hoy, dominadas) |
| Tareas con fecha | Casillas con fecha de vencimiento y repetición simple |
| Vista Hoy / Próximos / Atrasadas | Reúne las tareas de todo el espacio |
| Progreso | Porcentaje por rama a partir de tareas completadas y tarjetas dominadas; solo se muestra si existen datos |
| Temporizador de estudio (opcional) | Sesión con cuenta atrás, sin notificaciones externas |

### 5.7. Datos, seguridad y copias

| Función | Fase |
| --- | --- |
| Autoguardado continuo y estado de guardado visible | M0 |
| Deshacer/rehacer global (estructura y contenido) | M0 |
| Papelera con restauración | M0 |
| Exportar/importar `.aleph` (mínimo) | M0 |
| Almacenamiento persistente + indicador de estado | V0 |
| Recordatorio de copia de seguridad | V0 |
| Exportación parcial (página, rama, espacio) y formatos Markdown/HTML/JSON/PDF | V3 |
| Importar Markdown/carpetas/ZIP | V3 |
| Carpeta vinculada y copias automáticas (Chromium) | V3 |
| Restaurar copia con vista previa | V3 |
| Comprobación y reparación de integridad | V3 |
| Historial de versiones por página | V4 |
| Registro de actividad exportable (diagnóstico local) | V4 |

### 5.8. Personalización y accesibilidad

| Función | Fase |
| --- | --- |
| Tema claro/oscuro/automático | M0 |
| Color de acento, densidad, tamaño de interfaz | V0 |
| Ancho y tipografía del editor | V1 |
| Atajos personalizables | V4 |
| Reducción de movimiento y alto contraste | V0 |
| Sangría de párrafo configurable | V0 |
| Navegación completa por teclado y lectores de pantalla | M0 en adelante |

---

## 6. Flujos principales (comportamiento exacto)

### 6.1. Crear una página

1. Origen: `+` en fila, `+ Nueva página` en el árbol, `Ctrl/Cmd+N`, paleta o botón del Inicio.
2. Se crea con título "Sin título" **al final de sus hermanos**, se expande el padre si hace falta y el título queda **en edición**.
3. `Enter` confirma título y mueve el cursor al cuerpo; `Esc` deja "Sin título".
4. Aviso: "Página creada" + `Deshacer`. Si el usuario lo deshace, desaparece sin pasar por la papelera.

- **Límites:** profundidad recomendada ≤ 12 niveles (aviso suave, sin bloqueo); título máximo 200 caracteres.

### 6.2. Editar

- Cada cambio de texto entra en la sesión de edición de ProseMirror; el autoguardado consolida y actualiza "Guardado".
- `Ctrl/Cmd+Z` dentro del editor deshace tecleo; fuera del editor, deshace la última acción global (mover, crear, eliminar…).
- **Cambiar de página** con cambios sin consolidar: se consolidan antes de navegar (sin diálogo).

### 6.3. Eliminar

1. Cualquier eliminación (una página, una rama, varias selecciones, un archivo) va a la **papelera**; no se pide confirmación.
2. Aviso: "«Cálculo» y 12 elementos movidos a la papelera" + `Deshacer`.
3. Si se elimina la página abierta, el foco pasa a su padre (o al Inicio).
4. **Eliminar definitivamente/vaciar papelera:** confirmación irreversible con recuento y texto claro; los botones son "Cancelar" y "Eliminar definitivamente" (rojo, con foco inicial en Cancelar).

### 6.4. Mover

- Arrastre, `Mover a…` o `Ctrl+Mayús+↑/↓`. Un solo `Deshacer`. Si el destino es descendiente del origen, se rechaza con mensaje. Al mover entre espacios, se conservan etiquetas, relaciones internas al subárbol y archivos; se rompen y avisan las relaciones hacia fuera (se convierten en enlaces por título).

### 6.5. Duplicar

Copia la página o rama (opciones: con/sin archivos) con IDs nuevos; título "Copia de …"; enlaces internos dentro de la rama se reasignan a las copias; queda seleccionada.

### 6.6. Adjuntar archivo

Selección/arrastre → validación (tipo, firma, tamaño) → *hash* → si ya existe, se reutiliza y se avisa ("Este archivo ya estaba en tu espacio") → se crea nodo `file`/bloque → miniatura en segundo plano. Fallos por archivo (no aborta el resto) con lista al final.

### 6.7. Exportar / hacer copia

`Exportar` → alcance y formato → generación con progreso (cancelable) → `saveToDisk` → confirmación "Guardado en …" → se registra la fecha si es copia completa.

### 6.8. Importar

Ver §4.13. Regla de oro: **nada se escribe hasta que el usuario acepta la vista previa** y **toda importación es atómica** (si falla, no queda nada a medias).

### 6.9. Restaurar una copia

Importar `.aleph` con la opción *Reemplazar espacio*: se crea automáticamente una copia del estado actual antes de aplicar; tras aplicar se ofrece `Deshacer importación` durante la sesión.

### 6.10. Situaciones de error

| Situación | Comportamiento |
| --- | --- |
| Error al guardar | Aviso persistente "No se pudo guardar. Tus cambios siguen en pantalla." + `Reintentar` + `Exportar esta página`. Se reintenta automáticamente con retroceso |
| Cuota de almacenamiento llena | Aviso con uso/cuota, sugiere exportar y vaciar papelera; **nunca** descarta datos sin decirlo |
| Almacenamiento borrado por el navegador | Al detectar base vacía con indicios previos: pantalla "No encontramos tus datos" con `Importar una copia` |
| Otra pestaña modificó la página | Banner con `Ver cambios` / `Sobrescribir` / `Guardar mía como copia` |
| Migración fallida | Se conserva la base anterior, se ofrece exportar, se describe el error |
| Archivo importado inválido | Se explica qué falló y qué se pudo leer |
| Sin conexión | No aplica: Aleph no necesita conexión y no muestra avisos de red |

---

## 7. Atajos de teclado (base)

| Acción | Windows/Linux | macOS |
| --- | --- | --- |
| Paleta de comandos / buscar | `Ctrl+K` | `⌘K` |
| Nueva página (hermana) | `Ctrl+N` | `⌘N` |
| Nueva página dentro | `Ctrl+Mayús+N` | `⌘⇧N` |
| Mostrar/ocultar barra lateral | `Ctrl+B` | `⌘B` |
| Mostrar/ocultar panel | `Ctrl+.` | `⌘.` |
| Deshacer / Rehacer | `Ctrl+Z` / `Ctrl+Mayús+Z` | `⌘Z` / `⌘⇧Z` |
| Buscar en la página | `Ctrl+F` | `⌘F` |
| Renombrar | `F2` | `Return` (en árbol) / `F2` |
| Favorito | `Ctrl+D` | `⌘D` |
| Modo enfoque | `Ctrl+Mayús+F` | `⌘⇧F` |
| Abrir menú de bloques | `/` | `/` |
| Enlace interno | `[[` | `[[` |
| Anterior / Siguiente ubicación | `Alt+←` / `Alt+→` | `⌘[` / `⌘]` |
| Mover elemento arriba/abajo | `Ctrl+Mayús+↑/↓` | `⌘⇧↑/↓` |
| Eliminar (a papelera) | `Supr` | `⌘⌫` |
| Ver atajos | `Ctrl+/` | `⌘/` |
| Cerrar / cancelar | `Esc` | `Esc` |

`Ctrl/Cmd+S` muestra "Guardado" (confirmación) para quien lo pulse por costumbre; no es necesario.

---

## 8. Estados vacíos, carga y mensajes tipo

| Lugar | Texto (borrador) | Acción principal |
| --- | --- | --- |
| Espacio vacío | "Este espacio está vacío. Crea tu primera página." | Nueva página |
| Página vacía | "Escribe algo, pulsa `/` para insertar bloques o arrastra archivos aquí." | — |
| Favoritos vacío | "Marca páginas con la estrella para tenerlas siempre a mano." | — |
| Recientes vacío | "Aquí verás lo último que abras o edites." | — |
| Biblioteca vacía | "Aquí aparecerán tus PDFs, imágenes y archivos." | Añadir archivos |
| Papelera vacía | "La papelera está vacía. Lo que elimines se guardará aquí 30 días." | — |
| Sin resultados | "No hay resultados para «…»." | Quitar filtros / Crear página |
| Cargando árbol | Filas fantasma (esqueleto) \< 300 ms; sin *spinners* bloqueantes | — |
| Cargando PDF | Barra de progreso fina + miniatura de la página 1 | — |
| Guardado | "Guardado" (discreto) | — |
| Error | Frase corta: qué pasó, qué pasa con los datos, qué hacer | Botón concreto |

**Principios de microcopy:** frases cortas; tuteo consistente; sin culpar al usuario; siempre decir qué pasa con sus datos.

---

## 9. Guardado en el PC: resumen funcional

Toda salida usa `saveToDisk` (arquitectura §20.3). Desde la interfaz, el usuario puede en cualquier momento:

- **Guardar copia** de cualquier archivo adjunto (original, sin modificar).
- **Exportar** página, rama, espacio o todo (`.aleph`, Markdown, HTML, JSON, PDF).
- **Vincular una carpeta** para tener un espejo automático y copias rotatorias (Chromium).
- **Ver siempre** cuándo fue la última copia y si el almacenamiento está protegido.
- **Abrir** un `.aleph` arrastrándolo a la ventana o con doble clic (PWA instalada).

**Garantía visible en Configuración → Datos:** "Todo lo que guardas en Aleph vive en este equipo. Nada se envía a ningún servidor."

---

## 10. Alcance de M0 (primer hito de código)

**Incluye:** bienvenida, un espacio (con selector de varios), Inicio en tarjetas anidadas y Mapa acoplable (versión básica, colores por defecto), sangría de párrafo, árbol completo (crear, renombrar, mover por arrastre y `Mover a…`, eliminar a papelera, expandir/contraer), migas, página con editor de tres bloques (texto, título, tarea), autoguardado y estado, deshacer/rehacer global, papelera con restaurar/eliminar definitivamente, búsqueda por título, tema claro/oscuro, exportar/importar `.aleph` mínimo (páginas y contenido), estado de almacenamiento persistente, teclado y ARIA completos en árbol, generador de 10.000 nodos y benchmarks.

**No incluye (todavía):** archivos y visores, etiquetas, favoritos, paleta completa, resto de bloques, plantillas, panel contextual, carpeta vinculada, historial, relaciones, estudio.

**Criterios de aceptación de M0:**

1. Se puede trabajar 30 minutos usando solo el teclado.
2. Recargar la página 100 veces (automatizado) no pierde ni corrompe nada.
3. 10.000 nodos: expandir \< 50 ms, abrir nota \< 100 ms, buscar \< 100 ms.
4. Exportar → importar en un espacio vacío reproduce exactamente la estructura y el contenido.
5. Toda acción de estructura se deshace y rehace correctamente (prueba de propiedades).
6. Sin ninguna petición de red durante el uso.
7. Contraste AA y foco visible en todos los controles; el árbol se anuncia correctamente en lector de pantalla.

---

## 11. Siguientes pasos

1. **Tu revisión** de esta especificación (especialmente §1, §4.4–4.5, §5 y §10).
2. **Fase 3 — Sistema de diseño:** tokens, tipografía, iconos, componentes y temas claro/oscuro (con muestras visuales).
3. **Fase 4 — Wireframes** de las pantallas de §2 con sus estados.
4. **Fase 5 — Implementación de M0.**