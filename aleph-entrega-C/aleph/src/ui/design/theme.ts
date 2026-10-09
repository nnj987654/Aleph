/**
 * Gestión de temas — claro, oscuro, automático
 */

import { signal, Signal } from '../core/signals.ts';
import { applyTokens, setAccentHue, ACCENT_HUES } from './tokens.ts';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type AccentColor = keyof typeof ACCENT_HUES;

export class ThemeManager {
  mode: Signal<ThemeMode>;
  accent: Signal<AccentColor>;
  private mediaQuery: MediaQueryList;

  constructor() {
    this.mode = signal<ThemeMode>('auto');
    this.accent = signal<AccentColor>('blue');
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    this.mediaQuery.addEventListener('change', () => this.applyTheme());
    this.applyTheme();
  }

  isDark(): boolean {
    const mode = this.mode.get();
    if (mode === 'auto') {
      return this.mediaQuery.matches;
    }
    return mode === 'dark';
  }

  applyTheme(): void {
    applyTokens(this.isDark());
    const accentHue = ACCENT_HUES[this.accent.get()];
    setAccentHue(accentHue);
    document.documentElement.dataset.theme = this.isDark() ? 'dark' : 'light';
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.applyTheme();
  }

  setAccent(color: AccentColor): void {
    this.accent.set(color);
    this.applyTheme();
  }
}

export const themeManager = new ThemeManager();
