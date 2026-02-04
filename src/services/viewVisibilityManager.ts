/**
 * Service for managing panel visibility preferences.
 * Persists visibility state to VS Code globalState for cross-session storage.
 */

import * as vscode from 'vscode';

const STORAGE_KEY = 'claudeCodeBrowser.viewVisibility';
const CURRENT_VERSION = 1;

/**
 * Panel identifiers
 */
export type PanelId = 'skills' | 'agents' | 'mcpServers' | 'plugins' | 'commands' | 'marketplace';

/**
 * Human-readable labels for each panel
 */
export const PANEL_LABELS: Record<PanelId, string> = {
  skills: 'Skills',
  agents: 'Agents',
  mcpServers: 'MCP Servers',
  plugins: 'Plugins',
  commands: 'Commands',
  marketplace: 'Marketplace'
};

/**
 * Storage format for view visibility state
 */
export interface ViewVisibilityState {
  version: number;
  visibility: Record<PanelId, boolean>;
}

/**
 * Default visibility state - all panels visible
 */
const DEFAULT_VISIBILITY: Record<PanelId, boolean> = {
  skills: true,
  agents: true,
  mcpServers: true,
  plugins: true,
  commands: true,
  marketplace: true
};

/**
 * Manager for panel visibility with persistence
 */
export class ViewVisibilityManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get all panel visibility states
   */
  getVisibility(): Record<PanelId, boolean> {
    const state = this.getState();
    return state.visibility;
  }

  /**
   * Check if a specific panel is visible
   */
  isVisible(panelId: PanelId): boolean {
    const visibility = this.getVisibility();
    return visibility[panelId] ?? true; // Default to visible if not set
  }

  /**
   * Set visibility for a specific panel
   */
  async setVisibility(panelId: PanelId, visible: boolean): Promise<void> {
    const state = this.getState();
    state.visibility[panelId] = visible;
    await this.saveState(state);
    this._onDidChange.fire();
  }

  /**
   * Show all panels (reset to default)
   */
  async setAllVisible(): Promise<void> {
    const state = this.getState();
    state.visibility = { ...DEFAULT_VISIBILITY };
    await this.saveState(state);
    this._onDidChange.fire();
  }

  /**
   * Get the current state from storage
   */
  private getState(): ViewVisibilityState {
    const state = this.context.globalState.get<ViewVisibilityState>(STORAGE_KEY);

    if (!state) {
      return {
        version: CURRENT_VERSION,
        visibility: { ...DEFAULT_VISIBILITY }
      };
    }

    // Ensure all panels have a visibility setting (for backwards compatibility)
    const visibility = { ...DEFAULT_VISIBILITY, ...state.visibility };

    return {
      version: CURRENT_VERSION,
      visibility
    };
  }

  /**
   * Save state to storage
   */
  private async saveState(state: ViewVisibilityState): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, state);
  }
}
