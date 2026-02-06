/**
 * TreeDataProvider for Claude Code plugins
 *
 * Plugins are global-scoped, loaded from ~/.claude/plugins/installed_plugins.json
 * Supports virtual folder organization with drag-and-drop.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

import { ResourceItem, PluginMetadata } from '../types';
import { parsePluginsManifest } from '../parsers/configParser';
import { FolderManager } from '../services/folderManager';
import { FolderItem, isFolderItem } from './folderItem';

/** Union type for all tree items in the plugins view */
export type PluginTreeItem = PluginItem | FolderItem;

/**
 * Tree item representing a Claude Code plugin
 */
export class PluginItem extends vscode.TreeItem implements ResourceItem {
  public readonly resourceType = 'plugin' as const;
  public readonly itemType = 'plugin' as const;
  public readonly scope = 'global' as const;

  constructor(
    public readonly name: string,
    public readonly resourceDescription: string,
    public readonly filePath: string,
    public readonly invokeCommand: string,
    public readonly plugin: PluginMetadata
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);

    // Format version for description
    const versionDisplay = plugin.version !== 'unknown' ? `v${plugin.version}` : '';
    this.description = versionDisplay;
    this.tooltip = this.buildTooltip();
    this.iconPath = new vscode.ThemeIcon('extensions');
    this.contextValue = 'plugin';
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.name}**\n\n`);
    md.appendMarkdown(`*Scope:* Global\n\n`);

    if (this.plugin.version && this.plugin.version !== 'unknown') {
      md.appendMarkdown(`*Version:* ${this.plugin.version}\n\n`);
    }

    if (this.plugin.marketplace) {
      md.appendMarkdown(`*Marketplace:* ${this.plugin.marketplace}\n\n`);
    }

    if (this.plugin.installedAt) {
      md.appendMarkdown(`*Installed:* ${this.plugin.installedAt}\n\n`);
    }

    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`*Invoke:* \`${this.name}\``);

    return md;
  }
}

/**
 * Type guard for PluginItem
 */
export function isPluginItem(item: unknown): item is PluginItem {
  return item instanceof PluginItem;
}

/**
 * TreeDataProvider for Claude Code plugins with virtual folder support
 */
export class PluginsProvider implements
  vscode.TreeDataProvider<PluginTreeItem>,
  vscode.TreeDragAndDropController<PluginTreeItem> {

  readonly dropMimeTypes = ['application/vnd.code.tree.claudecodebrowser.plugins'];
  readonly dragMimeTypes = ['application/vnd.code.tree.claudecodebrowser.plugins'];

  private _onDidChangeTreeData = new vscode.EventEmitter<PluginTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterText: string = '';
  private treeView?: vscode.TreeView<PluginTreeItem>;

  constructor(private folderManager: FolderManager) {
    this.folderManager.onDidChange(type => {
      if (type === 'plugin') {
        this._onDidChangeTreeData.fire();
      }
    });
  }

  createTreeView(): vscode.TreeView<PluginTreeItem> {
    this.treeView = vscode.window.createTreeView('claudeCodeBrowser.plugins', {
      treeDataProvider: this,
      dragAndDropController: this,
      canSelectMany: true
    });
    return this.treeView;
  }

  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PluginTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PluginTreeItem): Promise<PluginTreeItem[]> {
    const allPlugins = await this.getAllPlugins();

    // Root level: return folders + unassigned items
    if (!element) {
      const folders = this.folderManager.getChildFolders('plugin', undefined);
      const result: PluginTreeItem[] = [];

      const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
      for (const folder of sortedFolders) {
        const itemsInFolder = allPlugins.filter(
          p => this.folderManager.getFolderForItem('plugin', p.name) === folder.id
        );
        if (this.filterText) {
          const folderMatches = folder.name.toLowerCase().includes(this.filterText);
          const hasMatchingItems = itemsInFolder.some(item =>
            item.name.toLowerCase().includes(this.filterText) ||
            item.resourceDescription.toLowerCase().includes(this.filterText)
          );
          if (!folderMatches && !hasMatchingItems) continue;
        }
        const totalCount = this.folderManager.countItemsRecursive('plugin', folder.id);
        const subFolderCount = this.folderManager.getChildFolders('plugin', folder.id).length;
        result.push(new FolderItem(folder, 'plugin', totalCount, subFolderCount));
      }

      const unassigned = allPlugins.filter(
        p => !this.folderManager.getFolderForItem('plugin', p.name)
      );
      const filtered = this.applyFilter(unassigned);
      result.push(...filtered.sort((a, b) => a.name.localeCompare(b.name)));

      return result;
    }

    // Folder children: return sub-folders + items
    if (isFolderItem(element)) {
      const result: PluginTreeItem[] = [];

      // Add sub-folders first
      const subFolders = this.folderManager.getChildFolders('plugin', element.folder.id);
      const sortedSubFolders = [...subFolders].sort((a, b) => a.name.localeCompare(b.name));
      for (const subFolder of sortedSubFolders) {
        const itemCount = this.folderManager.countItemsRecursive('plugin', subFolder.id);
        const subSubFolderCount = this.folderManager.getChildFolders('plugin', subFolder.id).length;
        if (this.filterText) {
          const folderMatches = subFolder.name.toLowerCase().includes(this.filterText);
          if (!folderMatches && itemCount === 0) continue;
        }
        result.push(new FolderItem(subFolder, 'plugin', itemCount, subSubFolderCount));
      }

      // Add items directly in this folder
      const folderPlugins = allPlugins.filter(
        p => this.folderManager.getFolderForItem('plugin', p.name) === element.folder.id
      );
      result.push(...this.applyFilter(folderPlugins).sort((a, b) => a.name.localeCompare(b.name)));

      return result;
    }

    return [];
  }

  handleDrag(
    source: readonly PluginTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    const pluginItems = source.filter(isPluginItem);
    if (pluginItems.length > 0) {
      const names = pluginItems.map(p => p.name);
      dataTransfer.set(
        'application/vnd.code.tree.claudecodebrowser.plugins',
        new vscode.DataTransferItem(names)
      );
    }
  }

  async handleDrop(
    target: PluginTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.claudecodebrowser.plugins');
    if (!transferItem) return;

    const names: string[] = transferItem.value;
    if (!names || names.length === 0) return;

    let targetFolderId: string | undefined;
    if (isFolderItem(target)) {
      targetFolderId = target.folder.id;
    }

    await this.folderManager.assignItemsToFolder('plugin', names, targetFolderId);
  }

  private applyFilter(items: PluginItem[]): PluginItem[] {
    if (!this.filterText) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(this.filterText) ||
      item.resourceDescription.toLowerCase().includes(this.filterText)
    );
  }

  private async getAllPlugins(): Promise<PluginItem[]> {
    const pluginsManifestPath = path.join(
      os.homedir(),
      '.claude',
      'plugins',
      'installed_plugins.json'
    );

    const plugins = await parsePluginsManifest(pluginsManifestPath);
    return plugins.map(p => this.createPluginItem(p, pluginsManifestPath));
  }

  private createPluginItem(plugin: PluginMetadata, manifestPath: string): PluginItem {
    const parts: string[] = [];
    if (plugin.version && plugin.version !== 'unknown') {
      parts.push(`Version ${plugin.version}`);
    }
    if (plugin.marketplace) {
      parts.push(`from ${plugin.marketplace}`);
    }
    const description = parts.join(' ') || 'Claude Code plugin';

    return new PluginItem(
      plugin.name,
      description,
      manifestPath,
      plugin.name,
      plugin
    );
  }
}
