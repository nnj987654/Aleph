# Registro de dependencias

Política: documento base §4.2. Una dependencia solo entra si resuelve algo caro o peligroso de reimplementar, va empaquetada, con versión fija y justificada aquí.

## En tiempo de ejecución (lo que recibe el usuario)

Ninguna todavía. El producto de la Entrega A no incluye código de terceros.

Previstas, solo cuando llegue su función: ProseMirror (editor), MiniSearch (búsqueda) y, bajo demanda, pdf.js (visor PDF) y KaTeX (fórmulas).

## Solo desarrollo (no forman parte del producto)

| Paquete | Versión | Para qué | Alternativa descartada |
|---|---|---|---|
| typescript | 5.6.3 | Tipos estrictos en un modelo de datos grande | JavaScript puro |
| vite | 5.4.10 | Servidor de desarrollo y compilación estática | Sin compilador (pdf.js y ProseMirror necesitan empaquetado) |
| vitest | 2.1.4 | Pruebas automáticas | Jest (más pesado) |
| fake-indexeddb | 6.0.0 | Simula IndexedDB en las pruebas | Pruebas solo en navegador (más lentas) |

## Código de terceros reescrito a mano

| Qué | Origen | Licencia |
|---|---|---|
| Claves fraccionarias (`src/domain/order.ts`) | Algoritmo de David Greenspan / biblioteca «fractional-indexing» | Dominio público (CC0) |
