Markdown · 01-Aleph-documento-base-v2.md

# Aleph — Documento base v2

> Sistema local-first para organizar, consultar, editar, relacionar y estudiar cualquier tipo de conocimiento desde un único entorno web.

**Estado:** v2.2 (decisiones confirmadas por el propietario) · **Sustituye a:** "Knowledge Workspace — Manifiesto y documento base" v1 **Nombre:** *Aleph* (confirmado). Formato nativo: `.aleph`. Documento complementario: `02-Aleph-arquitectura-tecnica.md`.

## Cambios respecto a v1

| Tema | v1 | v2 |
| --- | --- | --- |
| Nombre | Knowledge Workspace / `.mindspace` (inconsistente) | **Aleph / `.aleph`** |
| Persistencia | "IndexedDB, previsiblemente" | Modelo de **durabilidad en 3 niveles** (§4.1) |
| Dependencias | "Depender de lo mínimo" (sin criterio) | **Política explícita** con lista de dependencias admitidas (§4.2) |
| Editor | Bloques, sin base técnica | **ProseMirror + JSON estructurado**, bloques con ID (§4.3) |
| Jerarquía | Un `parentId`, pero "jerarquía flexible" | **Un padre canónico + alias y enlaces** (§4.4) |
| Recuperación | Undo, historial y papelera sin delimitar | **Tres mecanismos con responsabilidades separadas** (§4.5) |
| Robustez | No contemplada | Migraciones, multi-pestaña, rendimiento, búsqueda (§4.6) |
| Tipografía | Georgia sin plan B | **Georgia local + serif libre empaquetada** (§4.7) |
| Roadmap | V0–V5 secuencial y amplio | **Corte vertical M0** antes de V0 (§8) |

---

## 1. Manifiesto

Aleph es una aplicación web para organizar el conocimiento personal: cursos, materias, proyectos, apuntes, notas, esquemas, tablas, imágenes, PDFs, ejercicios, listas, recursos, referencias, archivos y las relaciones entre todo ello.

Debe conseguir algo aparentemente sencillo pero técnicamente exigente:

> **Permitir organizar una gran cantidad de información sin que la interfaz parezca compleja.**

El usuario empieza con una estructura mínima y profundiza cuando lo necesita. La aplicación no impone una taxonomía: la estructura es flexible, jerárquica, visual y modificable.

**Los tres pilares del proyecto:**

1. **Sencillez** — interfaz lo más simple y atractiva posible, sin renunciar a potencia.
2. **Calidad** — cada función terminada de verdad (datos seguros, accesible, rápida, coherente).
3. **Local** — todo vive en el equipo del usuario; nada externo; todo lo que la app genera puede guardarse en su PC. El usuario es el dueño de su contenido.

Cuando dos decisiones compitan, se elige la que mejor sirva a estos tres pilares.

**Regla fundamental:**

> **Potencia por debajo de la superficie; simplicidad en la superficie.**

## 2. Visión y alcance

Un **sistema personal de conocimiento completo, local y modular**, capaz de acompañar al usuario durante años. No es solo una app de notas, un gestor de archivos, un editor o una app educativa: combina esas capacidades en una experiencia coherente donde se pasa de `Espacio → Curso → Materia → Tema → Apunte → PDF/imagen/tabla` sin sentir que se cambia de aplicación.

**Fuera de alcance inicial:** sincronización cloud, colaboración, cuentas de usuario, funciones sociales, servidor obligatorio, app móvil nativa, inteligencia artificial y decenas de tipos de bloque. Se podrán estudiar más adelante, pero la arquitectura no debe impedirlo (ver "sincronización futura" en la arquitectura).

**La primera versión debe dominar:** crear, organizar, encontrar, editar, visualizar, mover, guardar, importar y exportar.

## 3. Principios de producto

1. **Simplicidad aparente.** La complejidad interna no se traduce en complejidad visual.
2. **Jerarquía clara.** Siempre evidente: dónde estamos, qué vemos, de dónde viene, qué podemos hacer.
3. **Contexto permanente.** Abrir un contenido no hace perder la ubicación de origen.
4. **Profundidad progresiva.** Primero lo importante; lo avanzado, cuando se necesita.
5. **Consistencia.** Una acción se comporta igual desde cualquier lugar.
6. **Reversibilidad.** Lo destructivo se puede deshacer o recuperar.
7. **Portabilidad.** Los datos nunca quedan encerrados; pertenecen al usuario.
8. **Profesionalidad.** Se siente una herramienta profesional desde el primer contacto.

**Prioridades ante conflicto:** 1) estabilidad, 2) claridad, 3) integridad de datos, 4) experiencia de navegación, 5) velocidad, 6) accesibilidad, 7) extensibilidad, 8) funciones avanzadas.

**Filosofía de interfaz.** Cada pantalla responde a: *¿Dónde estoy? ¿Qué estoy viendo? ¿Qué puedo hacer ahora?* Si no lo hace, se rediseña.

---

## 4. Decisiones fundamentales

Estas decisiones condicionan todo lo demás. Se cierran aquí a nivel de producto; su implementación está en el documento de arquitectura.

### 4.1. Persistencia y propiedad de los datos

**Problema.** IndexedDB es almacenamiento *del navegador*, no del usuario. Puede borrarse al limpiar datos del sitio, por presión de espacio, o de forma agresiva en Safari (limpieza tras \~7 días sin uso si la web no está instalada). Una app cuya promesa es "tus datos duran años" no puede depender solo de eso.

**Decisión: modelo de durabilidad en tres niveles.**

| Nivel | Mecanismo | Qué garantiza | Cuándo |
| --- | --- | --- | --- |
| 1. Trabajo | IndexedDB + `navigator.storage.persist()` solicitado en el primer uso significativo | Rendimiento y funcionamiento offline | M0 |
| 2. Copia viva (opcional) | **Carpeta vinculada** mediante File System Access API (Chromium): Aleph mantiene ahí un espejo legible (JSON + archivos) | Los datos existen fuera del navegador, en el disco del usuario | V3 |
| 3. Copias exportadas | Paquete `.aleph` manual y, en Chromium con carpeta vinculada, automático | Recuperación ante pérdida total | M0 (manual), V3 (auto) |

**Reglas asociadas**

- Al arrancar se comprueba `navigator.storage.persisted()` y se muestra el estado real en Configuración → Datos ("Almacenamiento protegido" / "Puede ser eliminado por el navegador").
- Indicador discreto de **"última copia de seguridad"**; tras N días o M cambios sin copia, recordatorio no intrusivo.
- En navegadores sin File System Access (Firefox, Safari) el nivel 2 no existe: el nivel 3 manual con recordatorios pasa a ser obligatorio en la experiencia, y se recomienda instalar la PWA.
- **Compatibilidad objetivo:** Chromium (experiencia completa), Firefox y Safari (experiencia completa salvo carpeta vinculada).
- La capa de almacenamiento se define tras una interfaz (`StorageEngine`) para poder añadir OPFS o carpeta como motor primario sin reescribir la aplicación.

### 4.2. Política de dependencias

**Principio:** el objetivo no es cero dependencias, sino **cero dependencias innecesarias y control total del producto**.

Una dependencia se admite solo si cumple **todas** estas condiciones:

1. Resuelve un problema que sería caro o peligroso reimplementar (criptografía, PDF, editor de texto rico, ZIP…).
2. Se **empaqueta localmente** (nunca desde CDN) y funciona sin conexión.
3. Está **fijada a versión exacta**, con licencia compatible (MIT/Apache/BSD/OFL).
4. Está **justificada por escrito** en el registro de dependencias (nombre, motivo, tamaño, alternativa descartada, fecha).
5. Se usa detrás de una **capa propia** cuando es razonable, para poder sustituirla.
6. Se carga de forma **perezosa** si no es necesaria para el primer render.

**Dependencias admitidas (propuesta inicial):**

| Necesidad | Solución | Motivo |
| --- | --- | --- |
| Lenguaje | TypeScript (dev) | Seguridad de tipos en un modelo de datos grande |
| Build | Vite (dev) | Módulos ES, chunks perezosos, PWA; salida 100 % estática |
| UI | **Capa propia** (reactividad + vistas, \< 1.500 líneas) | Sin framework: menos dependencias y control total (arquitectura ADR 03) |
| Editor | ProseMirror (paquetes núcleo) | Modelo de documento sólido, IME, cursor, pegado, undo |
| PDF | pdf.js (lazy) | Visor PDF completo; irreproducible a mano |
| Fórmulas | KaTeX (lazy) | Renderizado matemático |
| ZIP | **Implementación propia** sobre `CompressionStream` nativo | Escribir/leer ZIP es sencillo; no justifica una librería |
| Búsqueda | MiniSearch (con tokenizador propio) — **confirmado** | Índice invertido, prefijos y fuzzy; ver §4.6 |
| Tests (dev) | Vitest, Playwright | Unitarios y E2E |

Se **escriben a mano**: capa de interfaz, gestor de comandos, repositorios, árbol virtualizado, índices fraccionarios, lector/escritor ZIP, hash y utilidades (API nativas), sanitizador de contenido importado, exportadores Markdown/HTML, sistema de diseño e iconos.

**Resultado: 4 dependencias en tiempo de ejecución** — ProseMirror (núcleo del editor), MiniSearch (índice de búsqueda) y, cargadas solo bajo demanda, pdf.js (visor PDF) y KaTeX (fórmulas). Todo lo demás son herramientas de desarrollo (TypeScript, Vite, Vitest, Playwright) que no forman parte del producto entregado. Si más adelante una de las cuatro puede sustituirse por código propio sencillo, se sustituye.

### 4.3. Editor de bloques

**Decisión:** no construir un editor sobre `contenteditable` propio. Se adopta **ProseMirror** (núcleo, no un wrapper con muchas dependencias) con un esquema propio de bloques.

- El contenido se guarda como **JSON estructurado** con `schemaVersion`, **nunca como HTML**. Esto elimina la mayor parte de la superficie de XSS y facilita migraciones y exportación.
- **Cada bloque tiene un ID estable** (atributo `id`, único por documento, conservado al mover/duplicar con regeneración solo en duplicados). Esto habilita enlaces a un bloque concreto, flashcards derivadas de bloques y relaciones finas.
- HTML solo existe en dos puntos, siempre sanitizado: **pegado** (se convierte a nodos del esquema, descartando lo desconocido) y **exportación**.
- El menú `/` se implementa como plugin del editor; los bloques de archivo/PDF/fórmula son *node views* propias.
- **Sangría de párrafo:** los párrafos de lectura llevan sangría de primera línea y poco espacio entre ellos (convención de libro) para estudiar mejor; es presentación configurable, activada por defecto, y no afecta al contenido guardado.
- **Prototipo temprano y aislado (M1)**: antes de integrar el editor en la app se valida con un banco de pruebas (IME, pegado desde Word/web, listas anidadas, tablas, undo).
- **Tipos de bloque en M0/V1:** párrafo, título (3 niveles), lista, lista numerada, checklist. Resto (cita, código, tabla, imagen, archivo/PDF, callout, fórmula, separador, enlace, embebido) por entregas.

### 4.4. Modelo de jerarquía, alias y bloques

**Problema en v1:** se hablaba de "jerarquía flexible" pero `Node` tiene un único `parentId`.

**Decisión:**

- Todo nodo tiene **exactamente un padre canónico** (`parentId`). Esto mantiene el árbol simple, el breadcrumb inequívoco y el borrado predecible.
- Un contenido puede **aparecer en otros lugares** de dos formas, ambas explícitas y visibles:
  - **Relación** (`Relation` tipo `link`, `related`, `prerequisite`…): enlace bidireccional que no cambia el árbol.
  - **Alias** (`Relation` tipo `alias` con destino en otra rama): entrada en el árbol que apunta al nodo real, con indicador visual. Borrar el alias no borra el original; borrar el original convierte los alias en enlaces rotos recuperables desde la papelera.
- Los nodos **no** se clonan por referencia compartida ni tienen múltiples padres.
- **Orden entre hermanos** mediante **claves fraccionarias** (cadenas ordenables), de modo que mover un nodo modifica solo ese registro y no reescribe a todos los hermanos.
- **Bloques:** viven dentro del documento del nodo, con ID propio, y son direccionables (`nodeId#blockId`) desde relaciones y enlaces, aunque no son registros independientes en base de datos.
- **Separación estructura/contenido:** los datos del nodo (cabecera) y su documento se almacenan por separado. Abrir el árbol no carga contenidos.
- Los identificadores son **UUID v7** (ordenables por tiempo, independientes del título).
- **Solo dos tipos de nodo:** `page` (cualquier elemento del árbol: puede tener contenido, hijos, o ambos) y `file` (PDF, imagen u otro archivo; no tiene hijos). Curso, materia, tema o apunte **no son tipos distintos**, sino plantillas y presentaciones (icono, color, `kind`) sobre `page`. Modelo mental único para el usuario: *todo es una página; las páginas contienen páginas y archivos*. Una página sin contenido propio pero con hijos se muestra automáticamente como índice (tarjetas/lista) de sus hijos.

### 4.5. Recuperación: undo, historial y papelera

Tres mecanismos, tres responsabilidades. No se solapan.

|  | **Undo / Redo** | **Historial de versiones** | **Papelera** |
| --- | --- | --- | --- |
| Pregunta que responde | "Acabo de hacer algo mal" | "¿Cómo estaba esta nota ayer?" | "Borré algo la semana pasada" |
| Alcance | Acciones de la sesión (mover, crear, borrar, duplicar, renombrar, editar) | Solo **contenido de notas** (documento) | Nodos y activos eliminados |
| Duración | Sesión (pila en memoria, recuperable tras recarga en el mejor esfuerzo) | Persistente, con política de retención | Persistente hasta vaciar (o 30 días, configurable) |
| Archivos binarios | Nunca almacena el binario: borrar un archivo es un *soft delete*, así que deshacer solo revierte la marca | No versiona binarios | Conserva el binario hasta "Eliminar definitivamente" |
| Granularidad | Un comando = una entrada (con coalescencia de tecleo) | Instantáneas por inactividad, cierre de nota y umbral de cambios | Por nodo raíz eliminado (con su subárbol) |

**Regla:** eliminar es siempre *soft delete*. Solo "Eliminar definitivamente" y "Vaciar papelera" destruyen datos (y esa acción **no** es deshacible; requiere confirmación).

**Interacción con el editor:** con el foco en el editor, `Ctrl/Cmd+Z` deshace dentro del documento; fuera del editor, deshace la pila global de comandos. Al perder el foco, los cambios de texto se consolidan en un único comando.

### 4.6. Robustez desde el primer día

- **Migraciones.** Cada base y cada documento llevan versión de esquema. Existe un motor de migraciones desde M0, con migraciones idempotentes, una copia de seguridad automática antes de migrar y pruebas con datos de versiones anteriores.
- **Varias pestañas.** Las transacciones de IndexedDB garantizan atomicidad; un canal de difusión notifica cambios entre pestañas para refrescar cachés; cada nodo lleva una **revisión** para detectar edición concurrente (aviso "modificado en otra pestaña"); las operaciones globales (importar, restaurar, migrar) toman un **bloqueo exclusivo**.
- **Rendimiento a escala (10.000 nodos, miles de archivos).** Cabeceras de nodo en memoria (ligeras), contenidos y binarios bajo demanda; árbol **virtualizado** con carga perezosa; búsqueda e importación en **Web Worker**; previsualizaciones diferidas.
- **Búsqueda.** Índice propio o MiniSearch con **normalización para español** (minúsculas, eliminación de diacríticos, tokenización por Unicode, palabras vacías, prefijos), actualización incremental y reconstrucción manual. `type:`, `tag:`, `in:` como filtros estructurados.
- **Integridad.** Verificación de coherencia (huérfanos, ciclos, alias rotos, activos sin nodo) ejecutable desde Configuración → Datos, y automáticamente tras importar o migrar.

### 4.7. Tipografía

- **Serif editorial:** `Georgia` cuando existe en el sistema (`src: local("Georgia")`) y, si no, una **serif libre empaquetada** con licencia OFL de métricas similares (**Source Serif 4** confirmada, variable, WOFF2, subconjunto latino; solo se descarga si Georgia no existe).
- **Sans de interfaz:** pila del sistema (`system-ui`) por defecto, con posibilidad de empaquetar una sans libre si se quiere identidad propia.
- **Sin servicios externos de fuentes.** Todas las fuentes son locales o del sistema, con `font-display: swap` y fallback definido.
- Se acepta que el aspecto varíe ligeramente entre plataformas donde Georgia no exista; el diseño se valida con ambas.

### 4.8. Propiedad de los datos: todo puede guardarse en el PC

Regla sin excepciones: **todo lo que Aleph genera o almacena puede guardarse como archivo normal en el equipo del usuario, en formatos abiertos, sin cuentas ni servicios externos.**

- **Nada sale del dispositivo.** No hay telemetría, subidas, servidores propios ni servicios de terceros en tiempo de ejecución.
- **Guardar en disco con el mejor mecanismo disponible:** selector de "Guardar como" nativo cuando el navegador lo permite; descarga estándar como alternativa universal; compartir a archivos en móvil cuando exista.
- **Formatos abiertos:** `.aleph` (ZIP con JSON y archivos originales), Markdown, HTML, JSON, PDF; los adjuntos se recuperan tal cual se subieron.
- **Carpeta vinculada** (Chromium): espejo legible y automático en una carpeta elegida por el usuario.
- **Abrir desde el PC:** importar arrastrando archivos o carpetas completas; en la PWA instalada, doble clic en un `.aleph` lo abre en Aleph.
- Detalle técnico en arquitectura §20.3.

### 4.9. Compatibilidad: máximo alcance con mínima complejidad

- **Regla de degradación elegante:** cada función avanzada tiene un plan B sencillo; si el plan B es complejo, la función se declara "solo en navegadores compatibles" en lugar de complicar el código.
- **Contextos soportados:** navegador de escritorio, tablet y móvil (ratón, táctil, lápiz y teclado); alojado en cualquier hosting estático, en `localhost`, como PWA instalada y, después de M0, como **archivo único portable** (`aleph.html`).
- Matriz completa de capacidades y alternativas en arquitectura §20.4.

### 4.10. Idioma

La interfaz es **solo en español**, pero **preparada para traducirse**: ningún texto visible está escrito dentro de los componentes; todos salen de un catálogo (`t('clave')`), con plurales, fechas, números y ordenación (`Intl`) sensibles al idioma. Añadir otro idioma en el futuro es añadir un archivo de catálogo. Detalle en arquitectura §20.5.

---

## 5. Estructura y funcionalidades

**Jerarquía conceptual:** Aplicación → Espacios → (Cursos / Proyectos / Áreas) → Materias → Secciones → Subsecciones → Contenidos (apuntes, notas, esquemas, tablas, imágenes, PDFs, archivos). Además: Biblioteca, Favoritos, Recientes, Búsqueda, Papelera. La estructura es **conceptual, no una limitación**: la profundidad es prácticamente ilimitada y no se asume que todo sea académico.

### 5.1. Espacios

Nivel superior. Atributos: nombre, icono, color, descripción, configuración, fechas. Ejemplos: Universidad, Trabajo, Programación, Personal.

### 5.2. Navegación lateral y desplegables

- Barra lateral izquierda **redimensionable, colapsable y persistente**; colapsada se convierte en una barra compacta sin perder funciones.
- Árbol con nodos expandibles/contraíbles. **Los chevrones son iconos SVG reales**, no caracteres tipográficos ni emojis (animación suave, accesibilidad, independencia de la fuente).
- Estado de expansión persistente; "Expandir todo / Contraer todo" por rama y global.
- Navegación completa por teclado (patrón *tree* de WAI-ARIA).

### 5.3. Inicio (mapa de tarjetas), Mapa acoplable, Biblioteca, Favoritos, Recientes

- **Inicio del espacio:** toda la estructura como **tarjetas anidadas** que se despliegan y contraen, con un **color distinto por nivel** (configurable) y acceso directo a cada página o archivo. Debajo, continuar donde lo dejé, recientes y favoritos.
- **Mapa acoplable:** el mismo mapa en versión compacta, fijado a la izquierda o a la derecha mientras se trabaja, que se puede mostrar u ocultar y comparte estado con el Inicio. Complementa al árbol de la barra lateral (navegación rápida en texto); no lo sustituye salvo que el usuario lo decida.
- **El color nunca es la única señal** de jerarquía (anidación, borde y nombre accesible la refuerzan).
- **Biblioteca:** vista global de archivos por categoría (Todos, PDFs, Imágenes, Documentos, Tablas, Notas, Otros), independiente de la ubicación jerárquica.
- **Favoritos y Recientes** como accesos transversales.

### 5.4. Visores

- **PDF:** páginas, miniaturas, zoom, búsqueda, pantalla completa, página actual, asociación con contenidos.
- **Imágenes:** ampliar, pantalla completa, rotar, sustituir, descargar, asociar.
- **Vista rápida:** consultar un contenido en un panel sin perder el contexto ("Abrir completo" cuando se necesite).

### 5.5. Búsqueda y Command Palette

- Búsqueda transversal: títulos, texto, etiquetas, archivos, materias, espacios, relaciones.
- Sintaxis avanzada: `derivada type:pdf`, `derivada tag:examen`, `derivada in:matematicas`.
- **Command Palette** (`Ctrl/Cmd+K`): acciones y navegación desde el teclado; mecanismo central para usuarios avanzados.

### 5.6. Etiquetas y relaciones

- **Etiquetas** (`#examen`, `#repasar`…) como segunda navegación independiente de la jerarquía.
- **Relaciones** entre contenidos (enlaces, alias, requisitos) sin mover nada en el árbol; **vista de grafo** en fase avanzada, siempre complementaria a la jerarquía.

### 5.7. Modos de visualización

Árbol, Lista, Tarjetas, Documento y Grafo.

### 5.8. Interacción

- **Drag & Drop** con destino claramente indicado (antes, dentro, después) y alternativa por teclado/menú "Mover a…".
- **Menús contextuales:** abrir, abrir en nueva vista, renombrar, duplicar, mover, copiar enlace, favorito, exportar, eliminar. Lo poco frecuente no ocupa espacio permanente.

### 5.9. Metadatos, historial y papelera

- Metadatos por nodo: ID, título, tipo, padre, espacio, orden, etiquetas, fechas, estado, favorito, adjuntos, relaciones, historial, metadatos adicionales.
- Historial y papelera según §4.5.

### 5.10. Estudio (fase posterior)

Flashcards derivadas de bloques (con repetición espaciada), checklists, progreso y repaso sobre **los mismos datos** que la organización; nunca un sistema paralelo. El progreso es información útil, no un panel de estadísticas innecesario.

### 5.11. Importación, exportación y copias

- **Importar:** vista previa antes de aplicar ("23 materias, 184 contenidos, 42 archivos"), validación, resolución de conflictos, aplicación atómica.
- **Exportar:** elemento, sección, materia, curso, espacio o aplicación completa. Formatos: `.aleph` (nativo, sin pérdida), Markdown, HTML, JSON y PDF (vía impresión).
- **Formato `.aleph`:** paquete ZIP portable y autocontenido con manifiesto, datos y activos (ver arquitectura §12).
- **Copias:** manuales al inicio; automáticas con carpeta vinculada (ver §4.1).

### 5.12. Configuración, onboarding y plantillas

- **Configuración:** Apariencia (tema, acento, densidad, animaciones), Editor (tipografía, tamaño, ancho, autoguardado), Navegación (sidebar, anchura, estado inicial, breadcrumbs), Datos (importar, exportar, copias, almacenamiento, estado de persistencia), Atajos.
- **Onboarding:** "Crear mi primer espacio" / "Empezar desde cero", con pregunta opcional sobre qué se quiere organizar.
- **Plantillas** (materia universitaria, curso, programación, proyecto, apuntes, vacío): ayudas, nunca estructuras obligatorias.

---

## 6. Diseño y experiencia

- **Personalidad:** profesional, clara, precisa, calmada, moderna. Minimalismo = eliminar ruido, no capacidades.
- **Sistema de diseño con variables:** Background, Surface, Surface Elevated, Text, Text Secondary, Border, Accent, Accent Soft, Success, Warning, Danger. Acento configurable (azul, violeta, verde, naranja, rojo, rosa, turquesa) y usado con moderación.
- **Temas claro y oscuro** diseñados individualmente (contraste, superficies, bordes), no inversiones automáticas.
- **Iconografía:** conjunto SVG propio y coherente (mismo trazo, proporciones y tamaños; estados hover/focus/active). **Sin emojis** como iconos ni como logotipo. Logotipo e identidad reales del proyecto.
- **Microinteracciones:** rápidas, discretas y funcionales; respeto por `prefers-reduced-motion`.
- **Responsive:** escritorio `Sidebar | Contenido | Panel contextual`; tablet `Sidebar | Contenido`; móvil `Contenido` con sidebar desplegable.
- **PWA:** instalable, offline, caché de recursos (también mejora la durabilidad de datos en Safari).
- **Accesibilidad desde el inicio:** teclado completo, foco visible, HTML semántico, ARIA donde corresponda, contraste AA como mínimo, lectores de pantalla, objetivos táctiles adecuados, estados que no dependan solo del color.
- **Atajos:** `Ctrl/Cmd+K` búsqueda/comandos, `Ctrl/Cmd+N` nuevo, `Ctrl/Cmd+S` guardar (confirmación explícita, el guardado es automático), `Ctrl/Cmd+Z` / `Shift+Z` deshacer/rehacer, `Esc` cerrar, `/` bloques. Consultables desde la propia app.

## 7. Seguridad

Aunque los datos sean locales, todo contenido importado es **no confiable**:

- Validación estricta de esquema en paquetes y JSON; rechazo de campos desconocidos peligrosos.
- **Contenido en JSON, no HTML**; sanitización del HTML de pegado y de cualquier HTML importado; sin ejecución de contenido importado.
- Defensas ante ZIP malicioso: límites de nº de entradas, tamaño descomprimido, ratio de compresión y rutas (sin `..` ni rutas absolutas).
- Lista blanca de tipos MIME; SVG **nunca** se inserta como HTML inline (se muestra como imagen aislada o se sanea).
- **Content Security Policy** restrictiva (sin `eval`, sin recursos remotos).
- Enlaces externos con `rel="noopener noreferrer"`.

## 8. Roadmap revisado

Se antepone un **corte vertical mínimo (M0)** que atraviesa todas las capas. Todo lo demás se apoya en algo probado.

### M0 — Corte vertical (objetivo: demostrar que la arquitectura funciona)

Crear espacio → árbol jerárquico con crear/renombrar/mover/borrar → abrir una nota con **tres tipos de bloque** (párrafo, título, checklist) → guardado en IndexedDB → **undo/redo por comandos** → papelera básica → exportación e importación JSON/`.aleph` mínima → tema claro/oscuro. *Criterio de salida:* 10.000 nodos generados sin degradación visible, sobrevivir a recargas, migración de prueba v1→v2 exitosa, y prueba de perdida-cero en escenario de recarga forzada.

### V0 — Fundación

Layout, sidebar redimensionable y colapsable, espacios, árbol completo, persistencia robusta (`persist()`, indicador de estado), temas, configuración básica, sistema de diseño e iconos.

### V1 — Sistema de conocimiento

Editor completo con bloques y menú `/`, drag & drop, favoritos, recientes, etiquetas, menús contextuales, command palette, vista rápida.

### V2 — Archivos

Imágenes, PDFs, adjuntos, biblioteca, visor PDF, visor de imágenes, gestión de archivos y papelera con binarios.

### V3 — Portabilidad

Importación con vista previa, exportación parcial, formato `.aleph` completo, backups, restauración, **carpeta vinculada** y copias automáticas (Chromium).

### V4 — Productividad

Búsqueda avanzada, historial de versiones, undo/redo avanzado, relaciones y alias, vista de grafo, más atajos, vistas alternativas.

### V5 — Estudio

Flashcards, modo estudio, checklists avanzadas, progreso, repaso, repetición espaciada.

## 9. Proceso y criterios de calidad

**Fases previas al código:** 1) Especificación funcional, 2) Arquitectura técnica, 3) Sistema de diseño, 4) Wireframes, 5) Estructura del proyecto e implementación por capas (Core → Persistencia → Estado → Navegación → Árbol → Editor → Archivos → Búsqueda → Import/Export → Configuración → Productividad → Estudio). Cada capa debe ser funcional antes de construir la siguiente.

**Una funcionalidad está terminada cuando cumple:** UX evidente · encaja en el sistema de diseño · accesible con teclado y lector de pantalla · se guarda correctamente · es recuperable/deshacible · rápida con grandes volúmenes · exportable · mantenible.

**Presupuestos de rendimiento** (detallados en la arquitectura §16): apertura de nota \< 100 ms, expandir un nodo \< 50 ms, búsqueda \< 100 ms con 10.000 nodos, entrada de teclado sin latencia perceptible.

## 10. Conclusión

Aleph no gana por tener más funciones, sino porque todas forman un sistema coherente: **un escritorio personal de conocimiento**, no una colección de herramientas sueltas. La complejidad existe internamente para ofrecer potencia; la superficie permanece limpia, visual y comprensible.

> **Potencia por debajo de la superficie; simplicidad en la superficie.**