import './styles.css';
import { renderIcon, icons } from './icons';
import { BlockEditor, EditorBlock } from './editor';

type View = 'home' | 'editor' | 'design';

interface TreeNode {
  id: string;
  title: string;
  kind: 'page' | 'folder';
  children: TreeNode[];
}

interface AppState {
  activeView: View;
  selectedNodeId: string;
  expandedNodes: Set<string>;
  sidebarWidth: number;
  mapOpen: boolean;
  darkMode: boolean;
  treeData: TreeNode[];
  editor: BlockEditor;
}

const initialBlocks: EditorBlock[] = [
  {
    id: 'b1',
    type: 'heading',
    level: 1,
    content: 'Derivadas',
    indent: 0,
    children: [],
  },
  {
    id: 'b2',
    type: 'paragraph',
    content: 'La derivada de una función en un punto mide la rapidez con la que cambia su valor.',
    indent: 0,
    children: [],
  },
  {
    id: 'b3',
    type: 'paragraph',
    content: 'Geométricamente, es la pendiente de la recta tangente a la curva en ese punto.',
    indent: 0,
    children: [],
  },
  {
    id: 'b4',
    type: 'heading',
    level: 2,
    content: 'Definición formal',
    indent: 0,
    children: [],
  },
  {
    id: 'b5',
    type: 'list',
    content: 'f′(x) = lím (f(x+h) − f(x)) / h cuando h→0',
    indent: 0,
    children: [],
  },
  {
    id: 'b6',
    type: 'heading',
    level: 2,
    content: 'Aplicaciones',
    indent: 0,
    children: [],
  },
  {
    id: 'b7',
    type: 'list',
    content: 'Cálculo de velocidades instantáneas',
    indent: 0,
    children: [],
  },
  {
    id: 'b8',
    type: 'list',
    content: 'Búsqueda de máximos y mínimos',
    indent: 1,
    children: [],
  },
  {
    id: 'b9',
    type: 'list',
    content: 'Aproximación de funciones',
    indent: 0,
    children: [],
  },
];

const treeData: TreeNode[] = [
  {
    id: 'universidad',
    title: 'Universidad',
    kind: 'folder',
    children: [
      {
        id: 'matematicas',
        title: 'Matemáticas',
        kind: 'folder',
        children: [
          {
            id: 'calculo',
            title: 'Cálculo',
            kind: 'folder',
            children: [
              { id: 'limites', title: 'Límites', kind: 'page', children: [] },
              { id: 'continuidad', title: 'Continuidad', kind: 'page', children: [] },
              { id: 'derivadas', title: 'Derivadas', kind: 'page', children: [] },
              { id: 'integrales', title: 'Integrales', kind: 'page', children: [] },
            ],
          },
          { id: 'algebra', title: 'Álgebra', kind: 'page', children: [] },
        ],
      },
      {
        id: 'fisica',
        title: 'Física',
        kind: 'folder',
        children: [{ id: 'mecanica', title: 'Mecánica', kind: 'page', children: [] }],
      },
    ],
  },
];

const state: AppState = {
  activeView: 'editor',
  selectedNodeId: 'derivadas',
  expandedNodes: new Set(['universidad', 'matematicas', 'calculo']),
  sidebarWidth: 280,
  mapOpen: true,
  darkMode: false,
  treeData,
  editor: new BlockEditor(initialBlocks),
};

let resizingSlider = false;

function renderTreeNode(node: TreeNode, depth: number): string {
  const isOpen = state.expandedNodes.has(node.id);
  const isSelected = state.selectedNodeId === node.id;
  const isFolder = node.kind === 'folder';

  const toggleIcon = isOpen ? renderIcon('chevronDown') : renderIcon('chevronRight');
  const nodeIcon = isFolder ? renderIcon('folder') : renderIcon('file');

  let html = `
    <div class="tree-node ${isSelected ? 'selected' : ''}" data-node-id="${node.id}">
      <div class="tree-row" style="--depth: ${depth}">
        ${isFolder ? `<button class="tree-toggle" data-action="toggle-node" data-node-id="${node.id}" title="Expandir/Contraer">${toggleIcon}</button>` : '<div class="tree-toggle-spacer"></div>'}
        <div class="tree-icon">${nodeIcon}</div>
        <button class="tree-label" data-action="select-node" data-node-id="${node.id}">${node.title}</button>
      </div>
  `;

  if (isFolder && isOpen && node.children.length > 0) {
    html += `<div class="tree-children">${node.children.map(child => renderTreeNode(child, depth + 1)).join('')}</div>`;
  }

  html += `</div>`;
  return html;
}

function renderTree(): string {
  return treeData.map(node => renderTreeNode(node, 0)).join('');
}

function renderEditorBlock(block: EditorBlock): string {
  const blockClass = `editor-block editor-block-${block.type}`;
  const indent = block.indent * 20;
  let content = '';

  if (block.type === 'heading') {
    const tag = `h${block.level || 1}`;
    content = `<${tag} class="block-content" contenteditable="true" data-block-id="${block.id}">${block.content}</${tag}>`;
  } else if (block.type === 'list') {
    content = `<li class="block-content" contenteditable="true" data-block-id="${block.id}">${block.content}</li>`;
  } else {
    content = `<p class="block-content" contenteditable="true" data-block-id="${block.id}">${block.content}</p>`;
  }

  return `
    <div class="${blockClass}" data-block-id="${block.id}" style="margin-left: ${indent}px;">
      <div class="block-drag-handle"></div>
      ${content}
      <div class="block-actions">
        <button class="block-action-btn" data-action="add-block" data-block-id="${block.id}" title="Añadir línea después">+</button>
        <button class="block-action-btn" data-action="indent-block" data-block-id="${block.id}" title="Sangrar">→</button>
        <button class="block-action-btn" data-action="dedent-block" data-block-id="${block.id}" title="Desangrar">←</button>
        <button class="block-action-btn danger" data-action="delete-block" data-block-id="${block.id}" title="Eliminar">×</button>
      </div>
    </div>
  `;
}

function renderEditor(): string {
  const blocks = state.editor.getBlocks();
  return `
    <div class="editor-container">
      <div class="editor-content">
        ${blocks.map(renderEditorBlock).join('')}
      </div>
      <button class="add-block-btn" data-action="add-block-bottom">+ Añadir bloque</button>
    </div>
  `;
}

function renderHome(): string {
  return `
    <div class="home-container">
      <div class="home-hero">
        <h1>Universidad</h1>
        <p>Tu espacio personal para organizar el conocimiento</p>
      </div>
      <div class="home-grid">
        <div class="home-card" data-action="select-node" data-node-id="matematicas">
          <div class="home-card-icon">${renderIcon('folder')}</div>
          <h3>Matemáticas</h3>
          <p>Cálculo, Álgebra y más</p>
        </div>
        <div class="home-card" data-action="select-node" data-node-id="fisica">
          <div class="home-card-icon">${renderIcon('folder')}</div>
          <h3>Física</h3>
          <p>Mecánica y conceptos</p>
        </div>
      </div>
    </div>
  `;
}

function renderDesign(): string {
  return `
    <div class="design-container">
      <h1>Sistema de diseño</h1>
      <section>
        <h2>Colores</h2>
        <div class="color-grid">
          <div class="color-swatch" style="--color: #4f6ef7;"><span>#4f6ef7</span></div>
          <div class="color-swatch" style="--color: #8b5cf6;"><span>#8b5cf6</span></div>
          <div class="color-swatch" style="--color: #10b981;"><span>#10b981</span></div>
          <div class="color-swatch" style="--color: #f59e0b;"><span>#f59e0b</span></div>
          <div class="color-swatch" style="--color: #ef4444;"><span>#ef4444</span></div>
        </div>
      </section>
      <section>
        <h2>Tipografía</h2>
        <h3 style="font-family: Georgia; font-size: 2rem; font-weight: 700;">Serif · Georgia</h3>
        <p style="font-family: system-ui; font-size: 1rem;">Sans-serif · System UI</p>
      </section>
    </div>
  `;
}

function render(): void {
  const app = document.querySelector('#app');
  if (!app) return;

  const mainContent =
    state.activeView === 'home'
      ? renderHome()
      : state.activeView === 'design'
        ? renderDesign()
        : renderEditor();

  const mapClass = state.mapOpen ? '' : 'map-hidden';

  app.innerHTML = `
    <div class="app-shell ${state.darkMode ? 'theme-dark' : ''} ${mapClass}">
      <aside class="sidebar" style="width: ${state.sidebarWidth}px;">
        <div class="sidebar-header">
          <div class="sidebar-brand">A</div>
          <div class="sidebar-title">Aleph</div>
        </div>

        <nav class="sidebar-nav">
          <button class="nav-btn ${state.activeView === 'home' ? 'active' : ''}" data-action="view-home">${renderIcon('home')}<span>Inicio</span></button>
          <button class="nav-btn" data-action="view-editor">${renderIcon('file')}<span>Página</span></button>
          <button class="nav-btn" data-action="view-design">${renderIcon('layout')}<span>Diseño</span></button>
        </nav>

        <div class="tree-container">
          <div class="tree-header">Estructura</div>
          <div class="tree-root">${renderTree()}</div>
        </div>

        <div class="sidebar-footer">
          <button class="nav-btn">${renderIcon('trash')}<span>Papelera</span></button>
        </div>
      </aside>

      <div class="resize-handle" data-action="start-resize"></div>

      <main class="main-panel">
        <div class="topbar">
          <button class="topbar-btn mobile" data-action="toggle-sidebar">${renderIcon('menu')}</button>
          <nav class="breadcrumbs">
            <span>Universidad</span>
            <span class="sep">/</span>
            <span>Matemáticas</span>
            <span class="sep">/</span>
            <strong>Derivadas</strong>
          </nav>
          <div class="topbar-controls">
            <button class="topbar-btn" data-action="toggle-map">${renderIcon('layout')}</button>
            <button class="topbar-btn" data-action="toggle-theme">${state.darkMode ? renderIcon('sun') : renderIcon('moon')}</button>
          </div>
        </div>
        <div class="content-area">${mainContent}</div>
      </main>

      ${state.mapOpen ? `<aside class="map-panel" style="display: ${state.mapOpen ? 'flex' : 'none'};">
        <div class="map-header">
          <span>Mapa</span>
          <button class="map-close" data-action="toggle-map">${renderIcon('x')}</button>
        </div>
        <div class="map-content">
          <p style="text-align: center; color: var(--text-muted); padding: 20px;">Mapa de contenido</p>
        </div>
      </aside>` : ''}
    </div>
  `;

  attachEventListeners();
}

function attachEventListeners(): void {
  // Navigation
  document.querySelectorAll('[data-action="view-home"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeView = 'home';
      render();
    });
  });

  document.querySelectorAll('[data-action="view-editor"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeView = 'editor';
      render();
    });
  });

  document.querySelectorAll('[data-action="view-design"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeView = 'design';
      render();
    });
  });

  // Tree operations
  document.querySelectorAll('[data-action="toggle-node"]').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const nodeId = (e.currentTarget as HTMLElement).dataset.nodeId;
      if (nodeId) {
        if (state.expandedNodes.has(nodeId)) {
          state.expandedNodes.delete(nodeId);
        } else {
          state.expandedNodes.add(nodeId);
        }
        render();
      }
    });
  });

  document.querySelectorAll('[data-action="select-node"]').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const nodeId = (e.currentTarget as HTMLElement).dataset.nodeId;
      if (nodeId) {
        state.selectedNodeId = nodeId;
        state.activeView = 'editor';
        render();
      }
    });
  });

  // Theme toggle
  document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      render();
    });
  });

  // Map toggle
  document.querySelectorAll('[data-action="toggle-map"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mapOpen = !state.mapOpen;
      render();
    });
  });

  // Sidebar resize
  const resizeHandle = document.querySelector('.resize-handle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', () => {
      resizingSlider = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
  }

  // Editor blocks
  document.querySelectorAll('[data-action="add-block"]').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const blockId = (e.currentTarget as HTMLElement).dataset.blockId;
      if (blockId) {
        const newBlock: EditorBlock = {
          id: `b${Date.now()}`,
          type: 'paragraph',
          content: '',
          indent: 0,
          children: [],
        };
        state.editor.addBlock(newBlock);
        render();
      }
    });
  });

  document.querySelectorAll('[data-action="indent-block"]').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const blockId = (e.currentTarget as HTMLElement).dataset.blockId;
      if (blockId) {
        state.editor.indentBlock(blockId);
        render();
      }
    });
  });

  document.querySelectorAll('[data-action="dedent-block"]').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const blockId = (e.currentTarget as HTMLElement).dataset.blockId;
      if (blockId) {
        state.editor.dedentBlock(blockId);
        render();
      }
    });
  });

  document.querySelectorAll('[data-action="delete-block"]').forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const blockId = (e.currentTarget as HTMLElement).dataset.blockId;
      if (blockId) {
        state.editor.deleteBlock(blockId);
        render();
      }
    });
  });
}

document.addEventListener('mousemove', (e: MouseEvent) => {
  if (!resizingSlider) return;

  const newWidth = e.clientX;
  if (newWidth > 200 && newWidth < 600) {
    state.sidebarWidth = newWidth;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.style.width = `${newWidth}px`;
    }
  }
});

document.addEventListener('mouseup', () => {
  if (resizingSlider) {
    resizingSlider = false;
    document.body.style.cursor = 'auto';
    document.body.style.userSelect = 'auto';
  }
});

render();
