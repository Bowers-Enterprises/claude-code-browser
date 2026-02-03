import * as vscode from 'vscode';
import * as path from 'path';

import { ResourceItem, ResourceScope, McpServer } from '../types';
import { parseMcpConfig } from '../parsers/configParser';

/**
 * Tree item representing an MCP server
 */
export interface McpItem extends ResourceItem {
  resourceType: 'mcp';
  server: McpServer;
}

/**
 * TreeDataProvider for MCP servers
 *
 * MCP servers are project-scoped, loaded from {workspace}/.claude/.mcp.json
 */
export class McpProvider implements vscode.TreeDataProvider<McpItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<McpItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterText: string = '';

  /**
   * Set filter text and refresh the view
   */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  /**
   * Clear the filter and refresh the view
   */
  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  /**
   * Get child elements for the tree
   * MCP servers are flat (no hierarchy), so children of any element is empty
   */
  async getChildren(element?: McpItem): Promise<McpItem[]> {
    // MCP items have no children - flat list
    if (element) {
      return [];
    }

    let items: McpItem[] = [];

    // MCP servers are project-scoped only
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const mcpConfigPath = path.join(
      workspaceFolder.uri.fsPath,
      '.claude',
      '.mcp.json'
    );

    const servers = await parseMcpConfig(mcpConfigPath);

    for (const server of servers) {
      const item = this.createMcpItem(server, 'project', mcpConfigPath);
      items.push(item);
    }

    // Apply filter if set
    if (this.filterText) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(this.filterText) ||
        item.resourceDescription.toLowerCase().includes(this.filterText)
      );
    }

    // Sort alphabetically by name
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get the tree item representation for display
   */
  getTreeItem(element: McpItem): vscode.TreeItem {
    return element;
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Create an McpItem from server configuration
   */
  private createMcpItem(
    server: McpServer,
    scope: ResourceScope,
    configPath: string
  ): McpItem {
    // Build description from command/args or url
    let description = '';
    if (server.command) {
      const argsStr = server.args?.join(' ') || '';
      description = `${server.command} ${argsStr}`.trim();
    } else if (server.url) {
      description = server.url;
    }

    // Truncate description if too long
    const maxDescLength = 60;
    const truncatedDesc = description.length > maxDescLength
      ? description.substring(0, maxDescLength - 3) + '...'
      : description;

    // Set icon based on scope
    const scopeIcon = scope === 'global'
      ? new vscode.ThemeIcon('globe')
      : new vscode.ThemeIcon('folder-opened');

    const item: McpItem = {
      // TreeItem properties
      label: server.name,
      description: truncatedDesc,
      tooltip: this.buildTooltip(server, scope),
      iconPath: scopeIcon,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: 'mcp',

      // ResourceItem properties
      name: server.name,
      resourceDescription: description,
      scope,
      resourceType: 'mcp',
      filePath: configPath,
      // MCP servers don't have a direct invoke command

      // McpItem specific
      server,
    };

    return item;
  }

  /**
   * Build a detailed tooltip for the MCP server
   */
  private buildTooltip(server: McpServer, scope: ResourceScope): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${server.name}**\n\n`);
    md.appendMarkdown(`*Scope:* ${scope === 'global' ? 'Global' : 'Project'}\n\n`);

    if (server.command) {
      md.appendMarkdown(`*Command:* \`${server.command}\`\n\n`);
    }

    if (server.args && server.args.length > 0) {
      md.appendMarkdown(`*Args:* \`${server.args.join(' ')}\`\n\n`);
    }

    if (server.url) {
      md.appendMarkdown(`*URL:* ${server.url}\n\n`);
    }

    return md;
  }
}
