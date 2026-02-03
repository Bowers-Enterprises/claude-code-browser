import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ResourceItem, ResourceScope, AgentMetadata } from '../types';
import { parseAgentsDirectory } from '../parsers/agentParser';

/**
 * Tree item representing an agent in the Claude Code Browser.
 * Agents are always global scope (stored in ~/.claude/agents/).
 */
export class AgentItem extends vscode.TreeItem implements ResourceItem {
  public readonly name: string;
  public readonly resourceDescription: string;
  public readonly scope: ResourceScope = 'global';
  public readonly resourceType = 'agent' as const;
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
 * TreeDataProvider for Claude Code agents.
 *
 * Scans ~/.claude/agents/ for agent .md files and displays them
 * in the VS Code tree view. Agents are always global scope.
 */
export class AgentsProvider implements vscode.TreeDataProvider<AgentItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private agents: AgentItem[] = [];
  private filterText: string = '';

  constructor() {
    // Load agents on initialization
    this.loadAgents();
  }

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

      // Sort agents alphabetically by name
      metadata.sort((a, b) => a.name.localeCompare(b.name));

      // Convert metadata to tree items
      this.agents = metadata.map(m => new AgentItem(m));
    } catch (error) {
      console.warn('Failed to load agents:', error);
      this.agents = [];
    }

    // Notify the tree view that data has changed
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation for an element.
   */
  getTreeItem(element: AgentItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of an element. Since agents have no hierarchy,
   * this returns all agents for the root and empty array for items.
   */
  getChildren(element?: AgentItem): Thenable<AgentItem[]> {
    if (element) {
      // Agents have no children
      return Promise.resolve([]);
    }

    // Apply filter if set
    let filteredAgents = this.agents;
    if (this.filterText) {
      filteredAgents = this.agents.filter(item =>
        item.name.toLowerCase().includes(this.filterText) ||
        item.resourceDescription.toLowerCase().includes(this.filterText)
      );
    }

    // Return filtered agents for root
    return Promise.resolve(filteredAgents);
  }

  /**
   * Get parent of an element. Agents have no hierarchy so always returns undefined.
   */
  getParent(_element: AgentItem): vscode.ProviderResult<AgentItem> {
    return undefined;
  }
}
