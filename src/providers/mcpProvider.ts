/**
 * TreeDataProvider for MCP servers
 *
 * MCP servers are loaded from:
 * - Global: ~/.claude/.mcp.json
 * - Project: {workspace}/.claude/.mcp.json
 *
 * Supports virtual folder organization with drag-and-drop.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

import { ResourceItem, ResourceScope, McpServer } from '../types';
import { parseMcpConfig } from '../parsers/configParser';
import { FolderManager } from '../services/folderManager';
import { FolderItem, isFolderItem } from './folderItem';

/** Union type for all tree items in the MCP view */
export type McpTreeItem = McpItem | FolderItem;

/**
 * Tree item representing an MCP server
 */
export class McpItem extends vscode.TreeItem implements ResourceItem {
  public readonly resourceType = 'mcp' as const;
  public readonly itemType = 'mcp' as const;

  constructor(
    public readonly name: string,
    public readonly resourceDescription: string,
    public readonly scope: ResourceScope,
    public readonly filePath: string,
    public readonly server: McpServer
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);

    // Truncate description if too long
    const maxDescLength = 60;
    const truncatedDesc = resourceDescription.length > maxDescLength
      ? resourceDescription.substring(0, maxDescLength - 3) + '...'
      : resourceDescription;

    this.description = truncatedDesc;
    this.tooltip = this.buildTooltip();
    this.iconPath = scope === 'global'
      ? new vscode.ThemeIcon('globe')
      : new vscode.ThemeIcon('folder-opened');
    this.contextValue = 'mcp';
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.name}**\n\n`);
    md.appendMarkdown(`*Scope:* ${this.scope === 'global' ? 'Global' : 'Project'}\n\n`);

    if (this.server.command) {
      md.appendMarkdown(`*Command:* \`${this.server.command}\`\n\n`);
    }

    if (this.server.args && this.server.args.length > 0) {
      md.appendMarkdown(`*Args:* \`${this.server.args.join(' ')}\`\n\n`);
    }

    if (this.server.url) {
      md.appendMarkdown(`*URL:* ${this.server.url}\n\n`);
    }

    return md;
  }
}

/**
 * Type guard for McpItem
 */
export function isMcpItem(item: unknown): item is McpItem {
  return item instanceof McpItem;
}

/**
 * TreeDataProvider for MCP servers with virtual folder support
 */
export class McpProvider implements
  vscode.TreeDataProvider<McpTreeItem>,
  vscode.TreeDragAndDropController<McpTreeItem> {

  readonly dropMimeTypes = ['application/vnd.code.tree.claudecodebrowser.mcp'];
  readonly dragMimeTypes = ['application/vnd.code.tree.claudecodebrowser.mcp'];

  private _onDidChangeTreeData = new vscode.EventEmitter<McpTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterText: string = '';
  private treeView?: vscode.TreeView<McpTreeItem>;

  constructor(private folderManager: FolderManager) {
    this.folderManager.onDidChange(type => {
      if (type === 'mcp') {
        this._onDidChangeTreeData.fire();
      }
    });
  }

  createTreeView(): vscode.TreeView<McpTreeItem> {
    this.treeView = vscode.window.createTreeView('claudeCodeBrowser.mcpServers', {
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

  getTreeItem(element: McpTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: McpTreeItem): Promise<McpTreeItem[]> {
    // Get all MCP items first
    const allItems = await this.getAllMcpItems();

    // Root level: return folders + unassigned items
    if (!element) {
      const folders = this.folderManager.getFolders('mcp');
      const result: McpTreeItem[] = [];

      const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
      for (const folder of sortedFolders) {
        const itemsInFolder = allItems.filter(
          m => this.folderManager.getFolderForItem('mcp', m.filePath + ':' + m.name) === folder.id
        );
        if (this.filterText) {
          const folderMatches = folder.name.toLowerCase().includes(this.filterText);
          const hasMatchingItems = itemsInFolder.some(item =>
            item.name.toLowerCase().includes(this.filterText) ||
            item.resourceDescription.toLowerCase().includes(this.filterText)
          );
          if (!folderMatches && !hasMatchingItems) continue;
        }
        result.push(new FolderItem(folder, 'mcp', itemsInFolder.length));
      }

      const unassigned = allItems.filter(
        m => !this.folderManager.getFolderForItem('mcp', m.filePath + ':' + m.name)
      );
      const filtered = this.applyFilter(unassigned);
      // Sort: global first, then alphabetically
      filtered.sort((a, b) => {
        if (a.scope !== b.scope) return a.scope === 'global' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      result.push(...filtered);

      return result;
    }

    // Folder children
    if (isFolderItem(element)) {
      const folderItems = allItems.filter(
        m => this.folderManager.getFolderForItem('mcp', m.filePath + ':' + m.name) === element.folder.id
      );
      return this.applyFilter(folderItems).sort((a, b) => a.name.localeCompare(b.name));
    }

    return [];
  }

  handleDrag(
    source: readonly McpTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    const mcpItems = source.filter(isMcpItem);
    if (mcpItems.length > 0) {
      const keys = mcpItems.map(m => m.filePath + ':' + m.name);
      dataTransfer.set(
        'application/vnd.code.tree.claudecodebrowser.mcp',
        new vscode.DataTransferItem(keys)
      );
    }
  }

  async handleDrop(
    target: McpTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.claudecodebrowser.mcp');
    if (!transferItem) return;

    const keys: string[] = transferItem.value;
    if (!keys || keys.length === 0) return;

    let targetFolderId: string | undefined;
    if (isFolderItem(target)) {
      targetFolderId = target.folder.id;
    }

    await this.folderManager.assignItemsToFolder('mcp', keys, targetFolderId);
  }

  private applyFilter(items: McpItem[]): McpItem[] {
    if (!this.filterText) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(this.filterText) ||
      item.resourceDescription.toLowerCase().includes(this.filterText)
    );
  }

  private async getAllMcpItems(): Promise<McpItem[]> {
    const items: McpItem[] = [];

    // Load global MCP servers
    const globalConfigPath = path.join(os.homedir(), '.claude', '.mcp.json');
    const globalServers = await parseMcpConfig(globalConfigPath);
    for (const server of globalServers) {
      items.push(this.createMcpItem(server, 'global', globalConfigPath));
    }

    // Load project MCP servers
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const projectConfigPath = path.join(workspaceFolder.uri.fsPath, '.claude', '.mcp.json');
      const projectServers = await parseMcpConfig(projectConfigPath);
      for (const server of projectServers) {
        items.push(this.createMcpItem(server, 'project', projectConfigPath));
      }
    }

    return items;
  }

  private createMcpItem(server: McpServer, scope: ResourceScope, configPath: string): McpItem {
    let description = '';
    if (server.command) {
      const argsStr = server.args?.join(' ') || '';
      description = `${server.command} ${argsStr}`.trim();
    } else if (server.url) {
      description = server.url;
    }

    return new McpItem(server.name, description, scope, configPath, server);
  }
}
