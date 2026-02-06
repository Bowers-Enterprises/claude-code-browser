import * as vscode from 'vscode';
import { VirtualFolder, ResourceType } from '../types';

/**
 * Tree item representing a virtual folder for organizing resources.
 */
export class FolderItem extends vscode.TreeItem {
  /** Marker to identify this as a folder item */
  public readonly itemType = 'folder' as const;

  constructor(
    public readonly folder: VirtualFolder,
    public readonly resourceType: ResourceType,
    childCount: number,
    subFolderCount: number = 0
  ) {
    super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.id = `folder:${resourceType}:${folder.id}`;
    this.contextValue = 'folder';
    this.iconPath = new vscode.ThemeIcon('folder');

    // Show total count including sub-folder items
    const totalCount = childCount;
    this.description = totalCount > 0 ? `(${totalCount})` : '';

    const parts: string[] = [];
    parts.push(`${folder.name}`);
    if (subFolderCount > 0) {
      parts.push(`${subFolderCount} subfolder${subFolderCount !== 1 ? 's' : ''}`);
    }
    parts.push(`${childCount} item${childCount !== 1 ? 's' : ''}`);
    this.tooltip = parts.join(' - ');
  }
}

/**
 * Type guard to check if an item is a FolderItem
 */
export function isFolderItem(item: unknown): item is FolderItem {
  return item instanceof FolderItem;
}
