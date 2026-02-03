import * as vscode from 'vscode';
import { FolderState, VirtualFolder, ResourceType, FolderAssignments } from '../types';

/**
 * Centralized service for managing virtual folder state.
 * Persists folder definitions and item assignments using VS Code's globalState.
 */
export class FolderManager {
  private static STORAGE_KEY = 'claudeCodeBrowser.folderState';
  private static CURRENT_VERSION = 1;

  private state: FolderState;
  private _onDidChange = new vscode.EventEmitter<ResourceType>();

  /** Event fired when folder state changes for a resource type */
  readonly onDidChange = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {
    this.state = this.loadState();
  }

  /**
   * Load state from globalState, initializing if not present
   */
  private loadState(): FolderState {
    const stored = this.context.globalState.get<FolderState>(FolderManager.STORAGE_KEY);

    if (stored && stored.version === FolderManager.CURRENT_VERSION) {
      return stored;
    }

    // Initialize empty state
    return {
      version: FolderManager.CURRENT_VERSION,
      folders: {
        skill: [],
        agent: [],
        mcp: [],
        plugin: []
      },
      assignments: {
        skill: {},
        agent: {},
        mcp: {},
        plugin: {}
      }
    };
  }

  /**
   * Save state to globalState
   */
  private async saveState(): Promise<void> {
    await this.context.globalState.update(FolderManager.STORAGE_KEY, this.state);
  }

  /**
   * Get all folders for a resource type
   */
  getFolders(resourceType: ResourceType): VirtualFolder[] {
    return this.state.folders[resourceType] ?? [];
  }

  /**
   * Get folder ID for an item, or undefined if at root level
   */
  getFolderForItem(resourceType: ResourceType, filePath: string): string | undefined {
    return this.state.assignments[resourceType]?.[filePath];
  }

  /**
   * Get all items assigned to a specific folder
   */
  getItemsInFolder(resourceType: ResourceType, folderId: string): string[] {
    const assignments = this.state.assignments[resourceType] ?? {};
    return Object.entries(assignments)
      .filter(([_, id]) => id === folderId)
      .map(([path, _]) => path);
  }

  /**
   * Create a new folder
   */
  async createFolder(resourceType: ResourceType, name: string): Promise<VirtualFolder> {
    const folder: VirtualFolder = {
      id: this.generateId(),
      name,
      resourceType
    };

    this.state.folders[resourceType].push(folder);
    await this.saveState();
    this._onDidChange.fire(resourceType);

    return folder;
  }

  /**
   * Rename a folder
   */
  async renameFolder(resourceType: ResourceType, folderId: string, newName: string): Promise<void> {
    const folder = this.state.folders[resourceType].find(f => f.id === folderId);
    if (folder) {
      folder.name = newName;
      await this.saveState();
      this._onDidChange.fire(resourceType);
    }
  }

  /**
   * Delete a folder. Items in the folder return to root level.
   */
  async deleteFolder(resourceType: ResourceType, folderId: string): Promise<void> {
    // Remove folder
    this.state.folders[resourceType] = this.state.folders[resourceType].filter(
      f => f.id !== folderId
    );

    // Remove all assignments to this folder
    const assignments = this.state.assignments[resourceType];
    for (const [key, value] of Object.entries(assignments)) {
      if (value === folderId) {
        delete assignments[key];
      }
    }

    await this.saveState();
    this._onDidChange.fire(resourceType);
  }

  /**
   * Assign an item to a folder, or to root level if folderId is undefined
   */
  async assignItemToFolder(
    resourceType: ResourceType,
    filePath: string,
    folderId: string | undefined
  ): Promise<void> {
    if (folderId === undefined) {
      delete this.state.assignments[resourceType][filePath];
    } else {
      this.state.assignments[resourceType][filePath] = folderId;
    }

    await this.saveState();
    this._onDidChange.fire(resourceType);
  }

  /**
   * Move multiple items to a folder
   */
  async assignItemsToFolder(
    resourceType: ResourceType,
    filePaths: string[],
    folderId: string | undefined
  ): Promise<void> {
    for (const filePath of filePaths) {
      if (folderId === undefined) {
        delete this.state.assignments[resourceType][filePath];
      } else {
        this.state.assignments[resourceType][filePath] = folderId;
      }
    }

    await this.saveState();
    this._onDidChange.fire(resourceType);
  }

  /**
   * Generate a unique ID for a folder
   */
  private generateId(): string {
    // Simple UUID v4 implementation without external dependency
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
