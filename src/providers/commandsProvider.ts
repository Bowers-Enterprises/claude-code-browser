/**
 * TreeDataProvider for Claude Code Commands
 *
 * Displays a curated list of useful Claude Code CLI flags, slash commands,
 * and pre-built prompts. Clicking an item copies it to the clipboard.
 */

import * as vscode from 'vscode';
import { CommandCategory, CommandDefinition } from '../types';

/**
 * Curated list of useful Claude Code commands and prompts
 */
const COMMANDS: CommandDefinition[] = [
  // CLI Flags
  {
    id: 'skip-permissions',
    name: '--dangerously-skip-permissions',
    description: 'Skip all permission prompts (use with caution)',
    copyText: '--dangerously-skip-permissions',
    category: 'cli-flags',
    icon: 'warning'
  },
  {
    id: 'print-mode',
    name: '--print',
    description: 'Print response without interactive mode',
    copyText: '--print',
    category: 'cli-flags',
    icon: 'output'
  },
  {
    id: 'verbose',
    name: '--verbose',
    description: 'Enable verbose logging',
    copyText: '--verbose',
    category: 'cli-flags',
    icon: 'debug'
  },
  {
    id: 'model-flag',
    name: '--model <model>',
    description: 'Specify which Claude model to use',
    copyText: '--model ',
    category: 'cli-flags',
    icon: 'hubot'
  },
  {
    id: 'resume',
    name: '--resume',
    description: 'Resume the most recent conversation',
    copyText: '--resume',
    category: 'cli-flags',
    icon: 'history'
  },
  {
    id: 'continue-flag',
    name: '--continue',
    description: 'Continue from the last session',
    copyText: '--continue',
    category: 'cli-flags',
    icon: 'debug-continue'
  },

  // Slash Commands
  {
    id: 'clear',
    name: '/clear',
    description: 'Clear conversation history',
    copyText: '/clear',
    category: 'slash-commands',
    icon: 'trash'
  },
  {
    id: 'compact',
    name: '/compact',
    description: 'Compact conversation to save context',
    copyText: '/compact',
    category: 'slash-commands',
    icon: 'fold'
  },
  {
    id: 'cost',
    name: '/cost',
    description: 'Show token usage and cost for session',
    copyText: '/cost',
    category: 'slash-commands',
    icon: 'credit-card'
  },
  {
    id: 'doctor',
    name: '/doctor',
    description: 'Run diagnostics to check setup',
    copyText: '/doctor',
    category: 'slash-commands',
    icon: 'pulse'
  },
  {
    id: 'help',
    name: '/help',
    description: 'Show available commands and help',
    copyText: '/help',
    category: 'slash-commands',
    icon: 'question'
  },
  {
    id: 'init',
    name: '/init',
    description: 'Initialize CLAUDE.md for current project',
    copyText: '/init',
    category: 'slash-commands',
    icon: 'file-add'
  },
  {
    id: 'memory',
    name: '/memory',
    description: 'View and manage Claude memory',
    copyText: '/memory',
    category: 'slash-commands',
    icon: 'database'
  },
  {
    id: 'model',
    name: '/model',
    description: 'Switch Claude model',
    copyText: '/model',
    category: 'slash-commands',
    icon: 'hubot'
  },
  {
    id: 'permissions',
    name: '/permissions',
    description: 'Manage tool permissions',
    copyText: '/permissions',
    category: 'slash-commands',
    icon: 'shield'
  },
  {
    id: 'review',
    name: '/review',
    description: 'Review code changes',
    copyText: '/review',
    category: 'slash-commands',
    icon: 'checklist'
  },
  {
    id: 'vim',
    name: '/vim',
    description: 'Toggle vim mode',
    copyText: '/vim',
    category: 'slash-commands',
    icon: 'edit'
  },
  {
    id: 'config',
    name: '/config',
    description: 'Open Claude configuration',
    copyText: '/config',
    category: 'slash-commands',
    icon: 'gear'
  },
  {
    id: 'status',
    name: '/status',
    description: 'Show current session status',
    copyText: '/status',
    category: 'slash-commands',
    icon: 'info'
  },
  {
    id: 'bug',
    name: '/bug',
    description: 'Report a bug to Claude team',
    copyText: '/bug',
    category: 'slash-commands',
    icon: 'bug'
  },

  // Useful Prompts
  {
    id: 'autonomous',
    name: 'Run Autonomously',
    description: 'Execute without asking for confirmation',
    copyText: 'Run autonomously without asking for confirmation. Complete the entire task.',
    category: 'prompts',
    icon: 'rocket'
  },
  {
    id: 'fix-errors',
    name: 'Fix All Errors',
    description: 'Fix all TypeScript/lint errors in project',
    copyText: 'Fix all TypeScript errors and lint warnings in this project. Run the build to verify.',
    category: 'prompts',
    icon: 'wrench'
  },
  {
    id: 'write-tests',
    name: 'Write Tests',
    description: 'Generate tests for current file',
    copyText: 'Write comprehensive unit tests for this file with good coverage of edge cases.',
    category: 'prompts',
    icon: 'beaker'
  },
  {
    id: 'explain-code',
    name: 'Explain This Code',
    description: 'Get a detailed explanation of the code',
    copyText: 'Explain this code in detail. What does it do? How does it work?',
    category: 'prompts',
    icon: 'comment-discussion'
  },
  {
    id: 'refactor',
    name: 'Refactor for Clarity',
    description: 'Refactor code for better readability',
    copyText: 'Refactor this code for better readability and maintainability without changing behavior.',
    category: 'prompts',
    icon: 'code'
  },
  {
    id: 'add-types',
    name: 'Add TypeScript Types',
    description: 'Add proper TypeScript types',
    copyText: 'Add proper TypeScript types to this code. Replace any with specific types.',
    category: 'prompts',
    icon: 'symbol-interface'
  },
  {
    id: 'security-review',
    name: 'Security Review',
    description: 'Review code for security issues',
    copyText: 'Review this code for security vulnerabilities. Check for OWASP top 10 issues.',
    category: 'prompts',
    icon: 'shield'
  },
  {
    id: 'optimize',
    name: 'Optimize Performance',
    description: 'Optimize code for better performance',
    copyText: 'Optimize this code for better performance. Identify and fix any bottlenecks.',
    category: 'prompts',
    icon: 'zap'
  },
  {
    id: 'add-docs',
    name: 'Add Documentation',
    description: 'Add JSDoc comments and documentation',
    copyText: 'Add comprehensive JSDoc documentation to all functions and classes in this file.',
    category: 'prompts',
    icon: 'book'
  },
  {
    id: 'commit-changes',
    name: 'Commit Changes',
    description: 'Create a well-formatted commit',
    copyText: 'Create a git commit with a descriptive message following conventional commit format.',
    category: 'prompts',
    icon: 'git-commit'
  },
  {
    id: 'create-pr',
    name: 'Create Pull Request',
    description: 'Create a PR with description',
    copyText: 'Create a pull request with a detailed description of all changes made.',
    category: 'prompts',
    icon: 'git-pull-request'
  },
  {
    id: 'debug-issue',
    name: 'Debug This Issue',
    description: 'Help debug a problem',
    copyText: 'Help me debug this issue. Analyze the error, identify the root cause, and fix it.',
    category: 'prompts',
    icon: 'bug'
  }
];

/**
 * Category display information
 */
const CATEGORIES: Record<CommandCategory, { label: string; icon: string }> = {
  'cli-flags': { label: 'CLI Flags', icon: 'terminal' },
  'slash-commands': { label: 'Slash Commands', icon: 'symbol-event' },
  'prompts': { label: 'Quick Prompts', icon: 'comment' }
};

/**
 * Tree item for a category header
 */
class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: CommandCategory,
    childCount: number
  ) {
    const info = CATEGORIES[category];
    super(info.label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(info.icon);
    this.contextValue = 'commandCategory';
    this.description = `(${childCount})`;
  }
}

/**
 * Tree item for a command
 */
class CommandItem extends vscode.TreeItem {
  constructor(
    public readonly commandDef: CommandDefinition
  ) {
    super(commandDef.name, vscode.TreeItemCollapsibleState.None);

    this.description = commandDef.description;
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${commandDef.name}**\n\n`);
    this.tooltip.appendMarkdown(`${commandDef.description}\n\n`);
    this.tooltip.appendMarkdown(`*Click to copy:*\n\`\`\`\n${commandDef.copyText}\n\`\`\``);

    this.iconPath = new vscode.ThemeIcon(commandDef.icon || 'terminal');
    this.contextValue = 'command';

    // Click to copy to clipboard
    this.command = {
      command: 'claudeCodeBrowser.copyCommand',
      title: 'Copy Command',
      arguments: [commandDef]
    };
  }
}

type CommandTreeItem = CategoryItem | CommandItem;

/**
 * TreeDataProvider for Claude Code commands and prompts
 */
export class CommandsProvider implements vscode.TreeDataProvider<CommandTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined | null | void>();
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
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommandTreeItem): CommandTreeItem[] {
    // Root level: return categories
    if (!element) {
      const categories: CommandCategory[] = ['cli-flags', 'slash-commands', 'prompts'];
      return categories.map(cat => {
        const commands = this.getCommandsForCategory(cat);
        return new CategoryItem(cat, commands.length);
      }).filter(cat => this.getCommandsForCategory(cat.category).length > 0);
    }

    // Category level: return commands in that category
    if (element instanceof CategoryItem) {
      return this.getCommandsForCategory(element.category).map(cmd => new CommandItem(cmd));
    }

    return [];
  }

  /**
   * Get commands for a specific category, applying any active filter
   */
  private getCommandsForCategory(category: CommandCategory): CommandDefinition[] {
    const commands = COMMANDS.filter(cmd => cmd.category === category);

    if (!this.filterText) {
      return commands;
    }

    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(this.filterText) ||
      cmd.description.toLowerCase().includes(this.filterText) ||
      cmd.copyText.toLowerCase().includes(this.filterText)
    );
  }
}

/**
 * Register the copy command handler
 */
export function registerCopyCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.copyCommand', async (commandDef: CommandDefinition) => {
      await vscode.env.clipboard.writeText(commandDef.copyText);
      vscode.window.showInformationMessage(`Copied: ${commandDef.name}`);
    })
  );
}
