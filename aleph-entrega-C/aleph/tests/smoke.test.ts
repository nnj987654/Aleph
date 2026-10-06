* {
  box-sizing: border-box;
}

:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-alt: #eceef2;
  --text: #171a20;
  --text-muted: #5f6672;
  --border: #dfe2e8;
  --accent: #4f6ef7;
  --accent-soft: rgba(79, 110, 247, 0.12);
  --success: #23885a;
  --danger: #c93a3a;
  --shadow: 0 6px 18px rgba(17, 24, 39, 0.08);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
}

html, body {
  margin: 0;
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
}

body {
  min-height: 100vh;
}

button {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  min-height: 100vh;
}

.theme-dark {
  --bg: #101216;
  --surface: #171a20;
  --surface-alt: #20242c;
  --text: #e9ebf0;
  --text-muted: #98a0ad;
  --border: #2a2f38;
  --accent: #8aa4ff;
  --accent-soft: rgba(138, 164, 255, 0.14);
  --success: #4cc38a;
  --danger: #ef7b7b;
  background: var(--bg);
  color: var(--text);
}

.sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.sidebar-collapsed {
  width: 72px;
}

.sidebar-header,
.topbar,
.map-header,
.memory-head,
.tree-row,
.map-card-head {
  display: flex;
  align-items: center;
}

.sidebar-header {
  gap: 10px;
  padding: 14px 12px 10px;
  border-bottom: 1px solid var(--border);
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}

.brand-label {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}

.icon-btn,
.mini-btn,
.segment,
.nav-item,
.secondary,
.primary,
.danger,
.map-card-title,
.memory-title,
.tree-label {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.icon-btn,
.mini-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.icon-btn:hover,
.mini-btn:hover,
.nav-item:hover,
.secondary:hover,
.primary:hover,
.danger:hover,
.segment:hover {
  background: var(--surface-alt);
}

.mobile {
  display: none;
}

.nav-shortcuts,
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  color: var(--text-muted);
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--text);
}

.tree-panel {
  flex: 1;
  padding: 10px 8px 8px;
  overflow: auto;
}

.tree-header {
  color: var(--text-muted);
  font-size: 0.82rem;
  margin: 0 6px 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tree-node {
  display: block;
}

.tree-row {
  gap: 6px;
  min-height: 34px;
  border-radius: 8px;
  padding: 4px 6px;
}

.tree-row:hover {
  background: var(--surface-alt);
}

.tree-node.selected .tree-row {
  background: var(--accent-soft);
}

.tree-toggle {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.tree-toggle.hidden {
  visibility: hidden;
}

.tree-icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.tree-label,
.map-card-title,
.memory-title {
  flex: 1;
  text-align: left;
  font-weight: 600;
  padding: 0;
}

.tree-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
}

.tree-row:hover .tree-actions {
  opacity: 1;
}

.tree-children {
  display: none;
}

.tree-children.open {
  display: block;
}

.sidebar-footer {
  border-top: 1px solid var(--border);
}

.main-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  color: var(--text-muted);
  overflow: hidden;
  white-space: nowrap;
}

.breadcrumbs strong {
  color: var(--text);
  font-weight: 600;
}

.saved-indicator {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.segmented {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: var(--surface-alt);
  border-radius: 10px;
}

.segment {
  padding: 6px 12px;
  border-radius: 7px;
  color: var(--text-muted);
}

.segment.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}

.content-area {
  flex: 1;
  overflow: auto;
}

.screen {
  max-width: 760px;
  margin: 0 auto;
  padding: 36px 24px 80px;
}

.screen h1,
.screen h2 {
  margin: 0 0 12px;
  font-family: Georgia, 'Times New Roman', serif;
}

.screen h1 {
  font-size: clamp(2.2rem, 5vw, 3rem);
}

.screen p {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.08rem;
  line-height: 1.75;
  margin: 0 0 18px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.chip {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 10px;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.formula {
  background: var(--surface-alt);
  padding: 18px 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
  text-align: center;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.3rem;
  margin: 16px 0 18px;
}

.task-list {
  display: grid;
  gap: 10px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.04rem;
}

.task-item.done span {
  text-decoration: line-through;
  color: var(--text-muted);
}

.callout {
  margin-top: 28px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--accent-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
}

.callout .icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(79, 110, 247, 0.15);
  display: grid;
  place-items: center;
  color: var(--accent);
  font-weight: 700;
}

.subtitle {
  color: var(--text-muted);
}

.toolbar-row,
.button-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.secondary,
.primary,
.danger {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.danger {
  color: var(--danger);
  border-color: var(--danger);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
}

.memory-card {
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent);
  background: var(--surface);
  border-radius: 12px;
  padding: 12px;
  box-shadow: var(--shadow);
}

.memory-card .memory-head {
  gap: 8px;
  margin-bottom: 14px;
}

.memory-badge {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
}

.memory-title {
  font-weight: 700;
}

.memory-children {
  display: grid;
  gap: 8px;
}

.memory-child {
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
}

.memory-child span {
  font-weight: 600;
  display: block;
}

.memory-child small {
  color: var(--text-muted);
}

.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.swatch {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
}

.swatch i {
  display: block;
  height: 42px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.type-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 18px;
}

.display {
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.section {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.toast-box {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--text);
  color: var(--bg);
  border-radius: 10px;
  padding: 12px 14px;
  max-width: 500px;
}

.toast-box button {
  background: transparent;
  border: none;
  color: currentColor;
  text-decoration: underline;
  cursor: pointer;
}

.map-panel {
  background: var(--surface);
  border-left: 1px solid var(--border);
}

.map-panel.hidden {
  display: none;
}

.map-header {
  justify-content: space-between;
  padding: 14px 12px;
  border-bottom: 1px solid var(--border);
}

.map-actions {
  display: flex;
  gap: 4px;
}

.map-cards {
  padding: 10px 12px 16px;
  display: grid;
  gap: 8px;
}

.map-card {
  background: var(--surface-alt);
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 8px 10px;
  border-left: 4px solid var(--accent);
}

.map-card-head {
  gap: 8px;
}

.map-card.current {
  box-shadow: inset 0 0 0 2px var(--accent);
}

.map-card-icon {
  color: var(--accent);
}

.count {
  margin-left: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.map-children {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

@media (max-width: 980px) {
  .app-shell {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .map-panel {
    display: none;
  }
}

@media (max-width: 760px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(80vw, 320px);
    z-index: 20;
    transform: translateX(0);
  }

  .sidebar-collapsed {
    width: min(80vw, 320px);
  }

  .mobile {
    display: inline-grid;
  }

  .topbar {
    gap: 8px;
  }

  .screen {
    padding-inline: 14px;
  }
}

.theme-dark .memory-card,
.theme-dark .swatch,
.theme-dark .type-box,
.theme-dark .map-card,
.theme-dark .sidebar,
.theme-dark .main-panel,
.theme-dark .topbar,
.theme-dark .map-panel {
  background: var(--surface);
}

.theme-dark .tree-row:hover,
.theme-dark .nav-item:hover,
.theme-dark .segment.active,
.theme-dark .icon-btn:hover,
.theme-dark .secondary:hover,
.theme-dark .primary:hover,
.theme-dark .danger:hover,
.theme-dark .mini-btn:hover {
  background: var(--surface-alt);
}

.theme-dark .memory-child {
  background: rgba(255, 255, 255, 0.01);
}

.theme-dark .toast-box {
  background: #e9ebf0;
  color: #101216;
}

.theme-dark .saved-indicator,
.theme-dark .nav-item,
.theme-dark .chip,
.theme-dark .crumbs,
.theme-dark .tree-header,
.theme-dark .brand-label,
.theme-dark .tree-icon,
.theme-dark .tree-toggle {
  color: var(--text-muted);
}

.theme-dark .brand-mark,
.theme-dark .memory-badge {
  background: rgba(138, 164, 255, 0.2);
}


*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-thumb {
  background: rgba(127, 138, 153, 0.35);
  border-radius: 999px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

