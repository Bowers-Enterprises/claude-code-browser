/**
 * Service for managing user-created custom prompts.
 * Persists prompts to VS Code globalState for cross-session storage.
 */

import * as vscode from 'vscode';

const STORAGE_KEY = 'claudeCodeBrowser.customPrompts';
const CURRENT_VERSION = 1;

/**
 * A user-created custom prompt
 */
export interface CustomPrompt {
  id: string;
  name: string;
  description: string;
  copyText: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Storage format for custom prompts
 */
interface CustomPromptsState {
  version: number;
  prompts: CustomPrompt[];
}

/**
 * Manager for custom prompts with persistence
 */
export class CustomPromptsManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get all custom prompts
   */
  getPrompts(): CustomPrompt[] {
    const state = this.getState();
    return state.prompts;
  }

  /**
   * Get a single prompt by ID
   */
  getPrompt(id: string): CustomPrompt | undefined {
    return this.getPrompts().find(p => p.id === id);
  }

  /**
   * Create a new custom prompt
   */
  async createPrompt(prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomPrompt> {
    const state = this.getState();
    const now = new Date().toISOString();

    const newPrompt: CustomPrompt = {
      ...prompt,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    state.prompts.push(newPrompt);
    await this.saveState(state);
    this._onDidChange.fire();

    return newPrompt;
  }

  /**
   * Update an existing prompt
   */
  async updatePrompt(id: string, updates: Partial<Omit<CustomPrompt, 'id' | 'createdAt'>>): Promise<CustomPrompt | undefined> {
    const state = this.getState();
    const index = state.prompts.findIndex(p => p.id === id);

    if (index === -1) {
      return undefined;
    }

    state.prompts[index] = {
      ...state.prompts[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.saveState(state);
    this._onDidChange.fire();

    return state.prompts[index];
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(id: string): Promise<boolean> {
    const state = this.getState();
    const index = state.prompts.findIndex(p => p.id === id);

    if (index === -1) {
      return false;
    }

    state.prompts.splice(index, 1);
    await this.saveState(state);
    this._onDidChange.fire();

    return true;
  }

  /**
   * Export prompts to JSON
   */
  exportPrompts(): string {
    const prompts = this.getPrompts();
    return JSON.stringify({
      version: CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      prompts: prompts.map(p => ({
        name: p.name,
        description: p.description,
        copyText: p.copyText,
        icon: p.icon
      }))
    }, null, 2);
  }

  /**
   * Import prompts from JSON
   */
  async importPrompts(json: string, mode: 'merge' | 'replace' = 'merge'): Promise<number> {
    const data = JSON.parse(json);

    if (!data.prompts || !Array.isArray(data.prompts)) {
      throw new Error('Invalid import format: missing prompts array');
    }

    const state = this.getState();
    const now = new Date().toISOString();

    if (mode === 'replace') {
      state.prompts = [];
    }

    let importCount = 0;
    for (const prompt of data.prompts) {
      if (!prompt.name || !prompt.copyText) {
        continue;
      }

      // Check for duplicate by name
      const existingIndex = state.prompts.findIndex(p => p.name === prompt.name);

      if (existingIndex !== -1 && mode === 'merge') {
        // Update existing
        state.prompts[existingIndex] = {
          ...state.prompts[existingIndex],
          description: prompt.description || state.prompts[existingIndex].description,
          copyText: prompt.copyText,
          icon: prompt.icon || state.prompts[existingIndex].icon,
          updatedAt: now
        };
      } else {
        // Add new
        state.prompts.push({
          id: this.generateId(),
          name: prompt.name,
          description: prompt.description || '',
          copyText: prompt.copyText,
          icon: prompt.icon,
          createdAt: now,
          updatedAt: now
        });
      }
      importCount++;
    }

    await this.saveState(state);
    this._onDidChange.fire();

    return importCount;
  }

  /**
   * Get the current state from storage
   */
  private getState(): CustomPromptsState {
    const state = this.context.globalState.get<CustomPromptsState>(STORAGE_KEY);

    if (!state) {
      return { version: CURRENT_VERSION, prompts: [] };
    }

    return state;
  }

  /**
   * Save state to storage
   */
  private async saveState(state: CustomPromptsState): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, state);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
