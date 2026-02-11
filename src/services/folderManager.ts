import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { FolderState, VirtualFolder, ResourceType, FolderAssignments } from '../types';

/**
 * Centralized service for managing virtual folder state.
 * Persists folder definitions and item assignments using VS Code's globalState.
 */
export class FolderManager {
  private static STORAGE_KEY = 'claudeCodeBrowser.folderState';
  private static CURRENT_VERSION = 2;

  private state: FolderState;
  private _onDidChange = new vscode.EventEmitter<ResourceType>();

  /** Event fired when folder state changes for a resource type */
  readonly onDidChange = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {
    this.state = this.loadState();
    this.validateState();
  }

  /**
   * Load state from globalState, initializing if not present
   */
  private loadState(): FolderState {
    const stored = this.context.globalState.get<FolderState>(FolderManager.STORAGE_KEY);

    if (stored && stored.version >= 1) {
      // Migrate v1 to v2 (v1 folders just don't have parentId, which defaults to undefined = root)
      stored.version = FolderManager.CURRENT_VERSION;
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
   * Validate and repair state after loading from storage
   */
  private validateState(): void {
    for (const resourceType of ['skill', 'agent', 'mcp', 'plugin'] as ResourceType[]) {
      const folders = this.state.folders[resourceType] ?? [];
      const folderMap = new Map(folders.map(f => [f.id, f]));

      // Fix orphan folders (parentId points to non-existent folder)
      for (const folder of folders) {
        if (folder.parentId && !folderMap.has(folder.parentId)) {
          folder.parentId = undefined;
        }
      }

      // Detect and break cycles in parentId chains
      for (const folder of folders) {
        const visited = new Set<string>();
        let current = folder.parentId;
        visited.add(folder.id);
        while (current) {
          if (visited.has(current)) {
            folder.parentId = undefined;
            break;
          }
          visited.add(current);
          current = folderMap.get(current)?.parentId;
        }
      }

      // Remove assignments to non-existent folders
      const assignments = this.state.assignments[resourceType] ?? {};
      for (const [key, folderId] of Object.entries(assignments)) {
        if (!folderMap.has(folderId)) {
          delete assignments[key];
        }
      }
    }
  }

  /**
   * Get all folders for a resource type
   */
  getFolders(resourceType: ResourceType): VirtualFolder[] {
    return this.state.folders[resourceType] ?? [];
  }

  /**
   * Get child folders of a parent folder, or root-level folders if parentId is undefined
   */
  getChildFolders(resourceType: ResourceType, parentId?: string): VirtualFolder[] {
    const allFolders = this.state.folders[resourceType] ?? [];
    return allFolders.filter(f => f.parentId === parentId);
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
   * Count all items assigned to a folder and all its descendant sub-folders
   */
  countItemsRecursive(resourceType: ResourceType, folderId: string, validKeys?: Set<string>, visited = new Set<string>()): number {
    // Cycle detection
    if (visited.has(folderId)) {
      return 0;
    }
    visited.add(folderId);

    // Count direct items, optionally filtering to only items that actually exist
    const directItems = this.getItemsInFolder(resourceType, folderId);
    let count = validKeys
      ? directItems.filter(key => validKeys.has(key)).length
      : directItems.length;

    // Add items from child folders recursively
    const childFolders = this.getChildFolders(resourceType, folderId);
    for (const child of childFolders) {
      count += this.countItemsRecursive(resourceType, child.id, validKeys, visited);
    }

    return count;
  }

  /**
   * Get all item file paths assigned to a folder and all its descendant sub-folders
   */
  getItemsRecursive(resourceType: ResourceType, folderId: string, visited = new Set<string>()): string[] {
    // Cycle detection
    if (visited.has(folderId)) {
      return [];
    }
    visited.add(folderId);

    const items = [...this.getItemsInFolder(resourceType, folderId)];
    const childFolders = this.getChildFolders(resourceType, folderId);
    for (const child of childFolders) {
      items.push(...this.getItemsRecursive(resourceType, child.id, visited));
    }
    return items;
  }

  /**
   * Create a new folder
   */
  async createFolder(resourceType: ResourceType, name: string, parentId?: string): Promise<VirtualFolder> {
    const folder: VirtualFolder = {
      id: this.generateId(),
      name,
      parentId,
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
    this._deleteFolderRecursive(resourceType, folderId);
    await this.saveState();
    this._onDidChange.fire(resourceType);
  }

  /**
   * Recursively delete a folder and all its descendants
   */
  private _deleteFolderRecursive(resourceType: ResourceType, folderId: string, visited = new Set<string>()): void {
    // Cycle detection
    if (visited.has(folderId)) {
      return;
    }
    visited.add(folderId);

    // Recursively delete child folders first
    const childFolders = this.getChildFolders(resourceType, folderId);
    for (const child of childFolders) {
      this._deleteFolderRecursive(resourceType, child.id, visited);
    }

    // Remove assignments for this folder (items return to root)
    const assignments = this.state.assignments[resourceType];
    for (const [key, value] of Object.entries(assignments)) {
      if (value === folderId) {
        delete assignments[key];
      }
    }

    // Remove this folder
    this.state.folders[resourceType] = this.state.folders[resourceType].filter(
      f => f.id !== folderId
    );
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
    return randomUUID();
  }
}
