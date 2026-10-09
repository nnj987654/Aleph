# Aleph — Entrega C: Interfaz e Editor

Tercera entrega de código de Aleph (hito M0). Añade la interfaz web completa, el editor de bloques y exportación/importación.

## Qué incluye

| Carpeta | Contenido |
|---|---|
| `src/domain/`, `src/data/`, `src/platform/`, `src/commands/`, `src/state/`, `src/core/`, `src/app/` | Entregas A y B (sin cambios). |
| `src/ui/` | **Capa de interfaz:** diseño (tokens, iconos), componentes base, shell, árbol, mapa e inicio. |
| `src/editor/` | **Editor ProseMirror:** esquema, plugins, renderizado (M0: párrafo, título, checklist). |
| `src/io/` | **Importación/exportación:** formato `.aleph` (ZIP), importadores, exportadores. |
| `tests/` | Pruebas de la interfaz (E2E con Playwright). |

## Cómo ejecutarlo en Windows (PowerShell)

```powershell
cd aleph
npm install
npm run typecheck
npm run dev          # http://localhost:5173
```

## Características de M0

✅ **Interfaz:**
- Shell (sidebar redimensionable, cabecera, contenido)
- Árbol virtualizado con navegación por teclado (WAI-ARIA)
- Inicio en tarjetas anidadas con colores por nivel
- Mapa acoplable (izq/derecha)
- Crear, renombrar, mover, papelera

✅ **Editor:**
- ProseMirror con 3 bloques (párrafo, título 1–3, checklist)
- Menú `/` (filtrable)
- Atajos Markdown
- Autoguardado (debounce + blur)

✅ **Datos:**
- Exportar/importar `.aleph` (nodos + contenidos, sin binarios)
- Undo/Redo
- Sincronización entre pestañas

✅ **Diseño:**
- Sistema de tokens CSS (claro/oscuro, acento configurable)
- Tipografía (Georgia + serif local)
- Iconografía SVG propia
- Responsive (sidebar cajón en móvil)
- Accesibilidad: teclado, ARIA, foco visible

## Estructura M0

Una vez abierto, verás:
1. **Bienvenida** (nuevo usuario) → crear primer espacio
2. **Inicio** → mapa de tarjetas del espacio
3. **Página** → editor con bloques
4. **Árbol** → navegación jerárquica
5. **Papelera** → restaurar o eliminar

## Verificado

- Tipos (tsc), compilación production, responsive en escritorio/móvil
- Teclado completo (Tab, Flechas, Enter, Esc)
- Foco visible y ARIA en árbol y componentes
- Undo/Redo funcional
- Exportar/importar `.aleph` con round-trip exacto

## Qué no incluye (futuras versiones)

- Archivos binarios (PDF, imágenes) → V2
- Etiquetas, favoritos, búsqueda avanzada → V1
- Historial, relaciones, alias → V4
- Flashcards, estudio → V5
