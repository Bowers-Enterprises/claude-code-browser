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
    childCount: number
  ) {
    super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.id = `folder:${resourceType}:${folder.id}`;
    this.contextValue = 'folder';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.description = childCount > 0 ? `(${childCount})` : '';
    this.tooltip = `${folder.name} - ${childCount} item${childCount !== 1 ? 's' : ''}`;
  }
}

/**
 * Type guard to check if an item is a FolderItem
 */
export function isFolderItem(item: unknown): item is FolderItem {
  return item instanceof FolderItem;
}
