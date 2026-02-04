/**
 * TreeDataProvider for Claude Code Commands
 *
 * Displays a curated list of useful Claude Code CLI flags, slash commands,
 * pre-built prompts, and user-created custom prompts. Clicking an item copies it to the clipboard.
 */

import * as vscode from 'vscode';
import { CommandCategory, CommandDefinition } from '../types';
import { CustomPromptsManager, CustomPrompt } from '../services/customPromptsManager';

/**
 * Extended category type including custom prompts
 */
type ExtendedCategory = CommandCategory | 'custom';

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
const CATEGORIES: Record<ExtendedCategory, { label: string; icon: string }> = {
  'custom': { label: 'My Prompts', icon: 'star-full' },
  'cli-flags': { label: 'CLI Flags', icon: 'terminal' },
  'slash-commands': { label: 'Slash Commands', icon: 'symbol-event' },
  'prompts': { label: 'Quick Prompts', icon: 'comment' }
};

/**
 * Tree item for a category header
 */
class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: ExtendedCategory,
    childCount: number
  ) {
    const info = CATEGORIES[category];
    super(info.label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(info.icon);
    this.contextValue = category === 'custom' ? 'customPromptCategory' : 'commandCategory';
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

/**
 * Tree item for a custom prompt (has edit/delete options)
 */
class CustomPromptItem extends vscode.TreeItem {
  constructor(
    public readonly prompt: CustomPrompt
  ) {
    super(prompt.name, vscode.TreeItemCollapsibleState.None);

    this.description = prompt.description;
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${prompt.name}**\n\n`);
    if (prompt.description) {
      this.tooltip.appendMarkdown(`${prompt.description}\n\n`);
    }
    this.tooltip.appendMarkdown(`*Click to copy:*\n\`\`\`\n${prompt.copyText}\n\`\`\``);

    this.iconPath = new vscode.ThemeIcon(prompt.icon || 'note');
    this.contextValue = 'customPrompt';

    // Click to copy to clipboard
    this.command = {
      command: 'claudeCodeBrowser.copyCommand',
      title: 'Copy Command',
      arguments: [{
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        copyText: prompt.copyText,
        category: 'custom',
        icon: prompt.icon
      }]
    };
  }
}

type CommandTreeItem = CategoryItem | CommandItem | CustomPromptItem;

/**
 * TreeDataProvider for Claude Code commands and prompts
 */
export class CommandsProvider implements vscode.TreeDataProvider<CommandTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterText: string = '';
  private customPromptsManager?: CustomPromptsManager;

  constructor(customPromptsManager?: CustomPromptsManager) {
    this.customPromptsManager = customPromptsManager;

    // Listen for custom prompt changes
    if (customPromptsManager) {
      customPromptsManager.onDidChange(() => this.refresh());
    }
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
      const result: CategoryItem[] = [];

      // Custom prompts first (if any exist)
      const customPrompts = this.getFilteredCustomPrompts();
      if (customPrompts.length > 0 || !this.filterText) {
        result.push(new CategoryItem('custom', customPrompts.length));
      }

      // Built-in categories
      const categories: CommandCategory[] = ['cli-flags', 'slash-commands', 'prompts'];
      for (const cat of categories) {
        const commands = this.getCommandsForCategory(cat);
        if (commands.length > 0) {
          result.push(new CategoryItem(cat, commands.length));
        }
      }

      return result;
    }

    // Category level: return commands/prompts in that category
    if (element instanceof CategoryItem) {
      if (element.category === 'custom') {
        return this.getFilteredCustomPrompts().map(p => new CustomPromptItem(p));
      }
      return this.getCommandsForCategory(element.category as CommandCategory).map(cmd => new CommandItem(cmd));
    }

    return [];
  }

  /**
   * Get filtered custom prompts
   */
  private getFilteredCustomPrompts(): CustomPrompt[] {
    if (!this.customPromptsManager) {
      return [];
    }

    const prompts = this.customPromptsManager.getPrompts();

    if (!this.filterText) {
      return prompts;
    }

    return prompts.filter(p =>
      p.name.toLowerCase().includes(this.filterText) ||
      p.description.toLowerCase().includes(this.filterText) ||
      p.copyText.toLowerCase().includes(this.filterText)
    );
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
 * Register all command-related handlers
 */
export function registerCopyCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.copyCommand', async (commandDef: CommandDefinition) => {
      await vscode.env.clipboard.writeText(commandDef.copyText);
      vscode.window.showInformationMessage(`Copied: ${commandDef.name}`);
    })
  );
}

/**
 * Register custom prompt management commands
 */
export function registerCustomPromptCommands(
  context: vscode.ExtensionContext,
  customPromptsManager: CustomPromptsManager
): void {
  // Create new prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.createPrompt', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter prompt name',
        placeHolder: 'My Custom Prompt',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Name cannot be empty';
          }
          return null;
        }
      });

      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: 'Enter description (optional)',
        placeHolder: 'What does this prompt do?'
      });

      if (description === undefined) return;

      const copyText = await vscode.window.showInputBox({
        prompt: 'Enter the prompt text to copy',
        placeHolder: 'The actual prompt that will be copied...',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Prompt text cannot be empty';
          }
          return null;
        }
      });

      if (!copyText) return;

      // Icon selection
      const icons = [
        { label: '$(note) Note', value: 'note' },
        { label: '$(star) Star', value: 'star' },
        { label: '$(rocket) Rocket', value: 'rocket' },
        { label: '$(lightbulb) Lightbulb', value: 'lightbulb' },
        { label: '$(zap) Zap', value: 'zap' },
        { label: '$(tools) Tools', value: 'tools' },
        { label: '$(code) Code', value: 'code' },
        { label: '$(bug) Bug', value: 'bug' },
        { label: '$(beaker) Beaker', value: 'beaker' },
        { label: '$(heart) Heart', value: 'heart' }
      ];

      const iconSelection = await vscode.window.showQuickPick(icons, {
        placeHolder: 'Select an icon (optional)'
      });

      await customPromptsManager.createPrompt({
        name: name.trim(),
        description: description?.trim() || '',
        copyText: copyText.trim(),
        icon: iconSelection?.value
      });

      vscode.window.showInformationMessage(`Created prompt: ${name}`);
    })
  );

  // Edit prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.editPrompt', async (item: CustomPromptItem) => {
      if (!(item instanceof CustomPromptItem)) {
        vscode.window.showErrorMessage('Please select a custom prompt to edit');
        return;
      }

      const prompt = item.prompt;

      const name = await vscode.window.showInputBox({
        prompt: 'Edit prompt name',
        value: prompt.name,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Name cannot be empty';
          }
          return null;
        }
      });

      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: 'Edit description',
        value: prompt.description
      });

      if (description === undefined) return;

      const copyText = await vscode.window.showInputBox({
        prompt: 'Edit prompt text',
        value: prompt.copyText,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Prompt text cannot be empty';
          }
          return null;
        }
      });

      if (!copyText) return;

      await customPromptsManager.updatePrompt(prompt.id, {
        name: name.trim(),
        description: description?.trim() || '',
        copyText: copyText.trim()
      });

      vscode.window.showInformationMessage(`Updated prompt: ${name}`);
    })
  );

  // Delete prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.deletePrompt', async (item: CustomPromptItem) => {
      if (!(item instanceof CustomPromptItem)) {
        vscode.window.showErrorMessage('Please select a custom prompt to delete');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Delete prompt "${item.prompt.name}"?`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        await customPromptsManager.deletePrompt(item.prompt.id);
        vscode.window.showInformationMessage(`Deleted prompt: ${item.prompt.name}`);
      }
    })
  );

  // Export prompts
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.exportPrompts', async () => {
      const prompts = customPromptsManager.getPrompts();

      if (prompts.length === 0) {
        vscode.window.showInformationMessage('No custom prompts to export');
        return;
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('claude-prompts.json'),
        filters: { 'JSON': ['json'] }
      });

      if (uri) {
        const json = customPromptsManager.exportPrompts();
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
        vscode.window.showInformationMessage(`Exported ${prompts.length} prompts`);
      }
    })
  );

  // Import prompts
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.importPrompts', async () => {
      const uri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'JSON': ['json'] }
      });

      if (!uri || uri.length === 0) return;

      try {
        const content = await vscode.workspace.fs.readFile(uri[0]);
        const json = Buffer.from(content).toString('utf-8');

        const mode = await vscode.window.showQuickPick([
          { label: 'Merge', value: 'merge' as const, description: 'Add to existing prompts, update duplicates' },
          { label: 'Replace', value: 'replace' as const, description: 'Replace all existing prompts' }
        ], {
          placeHolder: 'How should prompts be imported?'
        });

        if (!mode) return;

        const count = await customPromptsManager.importPrompts(json, mode.value);
        vscode.window.showInformationMessage(`Imported ${count} prompts`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to import prompts: ${error}`);
      }
    })
  );
}
