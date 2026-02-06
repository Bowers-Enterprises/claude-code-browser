/**
 * TreeDataProvider for Claude Code agents.
 *
 * Scans ~/.claude/agents/ for agent .md files and displays them
 * in the VS Code tree view with virtual folder organization.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ResourceItem, ResourceScope, AgentMetadata } from '../types';
import { parseAgentsDirectory } from '../parsers/agentParser';
import { FolderManager } from '../services/folderManager';
import { FolderItem, isFolderItem } from './folderItem';

/** Union type for all tree items in the agents view */
export type AgentTreeItem = AgentItem | FolderItem;

/**
 * Tree item representing an agent in the Claude Code Browser.
 * Agents are always global scope (stored in ~/.claude/agents/).
 */
export class AgentItem extends vscode.TreeItem implements ResourceItem {
  public readonly name: string;
  public readonly resourceDescription: string;
  public readonly scope: ResourceScope = 'global';
  public readonly resourceType = 'agent' as const;
  public readonly itemType = 'agent' as const;
  public readonly filePath: string;
  public readonly invokeCommand: string;
  public readonly model?: string;
  public readonly tools?: string;

  constructor(metadata: AgentMetadata) {
    super(metadata.name, vscode.TreeItemCollapsibleState.None);

    this.name = metadata.name;
    this.resourceDescription = metadata.description;
    this.filePath = metadata.filePath;
    this.model = metadata.model;
    this.tools = metadata.tools;

    // The invoke command is the agent name for Task tool usage
    this.invokeCommand = metadata.name;

    // Set display properties
    this.description = metadata.description;
    this.tooltip = this.buildTooltip();
    // Agents are always global scope
    this.iconPath = new vscode.ThemeIcon('globe');

    // Set context value for menu contributions
    this.contextValue = 'agent';

    // Set command to invoke the resource when clicked
    this.command = {
      command: 'claudeCodeBrowser.invokeResource',
      title: 'Invoke Agent',
      arguments: [this]
    };
  }

  /**
   * Build a detailed tooltip for the agent item.
   */
  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.name}**\n\n`);
    md.appendMarkdown(`${this.resourceDescription}\n\n`);
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`**Scope:** Global\n\n`);

    if (this.model) {
      md.appendMarkdown(`**Model:** ${this.model}\n\n`);
    }

    if (this.tools) {
      md.appendMarkdown(`**Tools:** ${this.tools}\n\n`);
    }

    md.appendMarkdown(`**Invoke:** \`Task(subagent_type="${this.invokeCommand}", ...)\`\n\n`);
    md.appendMarkdown(`**File:** ${this.filePath}`);

    return md;
  }
}

/**
 * Type guard for AgentItem
 */
export function isAgentItem(item: unknown): item is AgentItem {
  return item instanceof AgentItem;
}

/**
 * TreeDataProvider for Claude Code agents with virtual folder support.
 */
export class AgentsProvider implements
  vscode.TreeDataProvider<AgentTreeItem>,
  vscode.TreeDragAndDropController<AgentTreeItem> {

  // Drag and drop MIME types
  readonly dropMimeTypes = ['application/vnd.code.tree.claudecodebrowser.agents'];
  readonly dragMimeTypes = ['application/vnd.code.tree.claudecodebrowser.agents'];

  private _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private agents: AgentItem[] = [];
  private filterText: string = '';
  private treeView?: vscode.TreeView<AgentTreeItem>;

  constructor(private folderManager: FolderManager) {
    // Listen for folder changes
    this.folderManager.onDidChange(type => {
      if (type === 'agent') {
        this._onDidChangeTreeData.fire();
      }
    });
    // Load agents on initialization
    this.loadAgents();
  }

  /**
   * Create and return the tree view with drag-and-drop support
   */
  createTreeView(): vscode.TreeView<AgentTreeItem> {
    this.treeView = vscode.window.createTreeView('claudeCodeBrowser.agents', {
      treeDataProvider: this,
      dragAndDropController: this,
      canSelectMany: true
    });
    return this.treeView;
  }

  /**
   * Set filter text and refresh the view
   */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Clear the filter and refresh the view
   */
  clearFilter(): void {
    this.filterText = '';
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh the agents list and notify the tree view.
   */
  public refresh(): void {
    this.loadAgents();
  }

  /**
   * Load agents from the global agents directory.
   */
  private async loadAgents(): Promise<void> {
    const globalAgentsPath = path.join(os.homedir(), '.claude', 'agents');

    try {
      const metadata = await parseAgentsDirectory(globalAgentsPath);
      metadata.sort((a, b) => a.name.localeCompare(b.name));
      this.agents = metadata.map(m => new AgentItem(m));
    } catch (error) {
      console.warn('Failed to load agents:', error);
      this.agents = [];
    }

    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation for an element.
   */
  getTreeItem(element: AgentTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children with folder hierarchy support.
   */
  getChildren(element?: AgentTreeItem): Thenable<AgentTreeItem[]> {
    // Root level: return folders + unassigned items
    if (!element) {
      const folders = this.folderManager.getChildFolders('agent', undefined);
      const result: AgentTreeItem[] = [];

      // Add folders first (sorted alphabetically)
      const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
      for (const folder of sortedFolders) {
        const itemsInFolder = this.agents.filter(
          a => this.folderManager.getFolderForItem('agent', a.filePath) === folder.id
        );
        // Apply filter to folder
        if (this.filterText) {
          const folderMatches = folder.name.toLowerCase().includes(this.filterText);
          const hasMatchingItems = itemsInFolder.some(item =>
            item.name.toLowerCase().includes(this.filterText) ||
            item.resourceDescription.toLowerCase().includes(this.filterText)
          );
          if (!folderMatches && !hasMatchingItems) {
            continue;
          }
        }
        const totalCount = this.folderManager.countItemsRecursive('agent', folder.id);
        const subFolderCount = this.folderManager.getChildFolders('agent', folder.id).length;
        result.push(new FolderItem(folder, 'agent', totalCount, subFolderCount));
      }

      // Add unassigned items
      const unassignedAgents = this.agents.filter(
        a => !this.folderManager.getFolderForItem('agent', a.filePath)
      );
      const filteredUnassigned = this.applyFilter(unassignedAgents);
      result.push(...filteredUnassigned.sort((a, b) => a.name.localeCompare(b.name)));

      return Promise.resolve(result);
    }

    // Folder children: return sub-folders + items assigned to this folder
    if (isFolderItem(element)) {
      const result: AgentTreeItem[] = [];

      // Add sub-folders first
      const subFolders = this.folderManager.getChildFolders('agent', element.folder.id);
      const sortedSubFolders = [...subFolders].sort((a, b) => a.name.localeCompare(b.name));
      for (const subFolder of sortedSubFolders) {
        const itemCount = this.folderManager.countItemsRecursive('agent', subFolder.id);
        const subSubFolderCount = this.folderManager.getChildFolders('agent', subFolder.id).length;
        if (this.filterText) {
          const folderMatches = subFolder.name.toLowerCase().includes(this.filterText);
          if (!folderMatches && itemCount === 0) continue;
        }
        result.push(new FolderItem(subFolder, 'agent', itemCount, subSubFolderCount));
      }

      // Add items directly in this folder
      const folderAgents = this.agents.filter(
        a => this.folderManager.getFolderForItem('agent', a.filePath) === element.folder.id
      );
      const filteredAgents = this.applyFilter(folderAgents);
      result.push(...filteredAgents.sort((a, b) => a.name.localeCompare(b.name)));

      return Promise.resolve(result);
    }

    // Agent items have no children
    return Promise.resolve([]);
  }

  /**
   * Handle drag start
   */
  handleDrag(
    source: readonly AgentTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    const agentItems = source.filter(isAgentItem);
    if (agentItems.length > 0) {
      const filePaths = agentItems.map(a => a.filePath);
      dataTransfer.set(
        'application/vnd.code.tree.claudecodebrowser.agents',
        new vscode.DataTransferItem(filePaths)
      );
    }
  }

  /**
   * Handle drop
   */
  async handleDrop(
    target: AgentTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.claudecodebrowser.agents');
    if (!transferItem) return;

    const filePaths: string[] = transferItem.value;
    if (!filePaths || filePaths.length === 0) return;

    let targetFolderId: string | undefined;
    if (isFolderItem(target)) {
      targetFolderId = target.folder.id;
    }

    await this.folderManager.assignItemsToFolder('agent', filePaths, targetFolderId);
  }

  /**
   * Apply filter to agent items
   */
  private applyFilter(items: AgentItem[]): AgentItem[] {
    if (!this.filterText) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(this.filterText) ||
      item.resourceDescription.toLowerCase().includes(this.filterText)
    );
  }
}
