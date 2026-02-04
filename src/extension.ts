import * as vscode from 'vscode';
import { SkillsProvider } from './providers/skillsProvider';
import { AgentsProvider } from './providers/agentsProvider';
import { McpProvider } from './providers/mcpProvider';
import { PluginsProvider } from './providers/pluginsProvider';
import { CommandsProvider, registerCopyCommand, registerCustomPromptCommands } from './providers/commandsProvider';
import { MarketplaceProvider, registerMarketplaceCommands } from './providers/marketplaceProvider';
import { FolderManager } from './services/folderManager';
import { CustomPromptsManager } from './services/customPromptsManager';
import { MarketplaceSourceManager } from './services/marketplaceSourceManager';
import {
  registerInvokeCommand,
  registerRefreshCommand,
  registerSearchCommand,
  registerClearFilterCommand,
  registerFolderCommands
} from './commands';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Claude Code Browser activating...');

  try {
    // Create folder manager for virtual folder organization
    const folderManager = new FolderManager(context);

    // Create custom prompts manager for user-created prompts
    const customPromptsManager = new CustomPromptsManager(context);

    // Create marketplace source manager for managing marketplace sources
    const marketplaceSourceManager = new MarketplaceSourceManager(context);

    // Create providers with folder manager
    const skillsProvider = new SkillsProvider(folderManager);
    const agentsProvider = new AgentsProvider(folderManager);
    const mcpProvider = new McpProvider(folderManager);
    const pluginsProvider = new PluginsProvider(folderManager);
    const commandsProvider = new CommandsProvider(customPromptsManager);
    const marketplaceProvider = new MarketplaceProvider(marketplaceSourceManager);

    // Create tree views with drag-and-drop support
    const skillsTreeView = skillsProvider.createTreeView();
    const agentsTreeView = agentsProvider.createTreeView();
    const mcpTreeView = mcpProvider.createTreeView();
    const pluginsTreeView = pluginsProvider.createTreeView();

    // Register commands tree view (no drag-and-drop needed)
    const commandsTreeView = vscode.window.createTreeView('claudeCodeBrowser.commands', {
      treeDataProvider: commandsProvider
    });

    // Register marketplace tree view
    const marketplaceTreeView = vscode.window.createTreeView('claudeCodeBrowser.marketplace', {
      treeDataProvider: marketplaceProvider
    });

    // Register tree views for disposal
    context.subscriptions.push(
      skillsTreeView,
      agentsTreeView,
      mcpTreeView,
      pluginsTreeView,
      commandsTreeView,
      marketplaceTreeView
    );

    // Register commands
    const providers = {
      skills: skillsProvider,
      agents: agentsProvider,
      mcp: mcpProvider,
      plugins: pluginsProvider,
      commands: commandsProvider,
      marketplace: marketplaceProvider
    };
    registerRefreshCommand(context, providers);
    registerInvokeCommand(context);
    registerSearchCommand(context, providers);
    registerClearFilterCommand(context, providers);
    registerFolderCommands(context, folderManager);
    registerCopyCommand(context);
    registerCustomPromptCommands(context, customPromptsManager);
    registerMarketplaceCommands(context, marketplaceProvider);

    console.log('Claude Code Browser activated successfully');
  } catch (error) {
    vscode.window.showErrorMessage(`Claude Code Browser failed to activate: ${error}`);
    console.error('Activation error:', error);
  }
}

export function deactivate(): void {
  console.log('Claude Code Browser deactivated');
}
