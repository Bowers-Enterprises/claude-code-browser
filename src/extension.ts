import * as vscode from 'vscode';
import { SkillsProvider } from './providers/skillsProvider';
import { AgentsProvider } from './providers/agentsProvider';
import { McpProvider } from './providers/mcpProvider';
import { PluginsProvider } from './providers/pluginsProvider';
import { FolderManager } from './services/folderManager';
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

    // Create providers with folder manager
    const skillsProvider = new SkillsProvider(folderManager);
    const agentsProvider = new AgentsProvider(folderManager);
    const mcpProvider = new McpProvider(folderManager);
    const pluginsProvider = new PluginsProvider(folderManager);

    // Create tree views with drag-and-drop support
    const skillsTreeView = skillsProvider.createTreeView();
    const agentsTreeView = agentsProvider.createTreeView();
    const mcpTreeView = mcpProvider.createTreeView();
    const pluginsTreeView = pluginsProvider.createTreeView();

    // Register tree views for disposal
    context.subscriptions.push(
      skillsTreeView,
      agentsTreeView,
      mcpTreeView,
      pluginsTreeView
    );

    // Register commands
    const providers = {
      skills: skillsProvider,
      agents: agentsProvider,
      mcp: mcpProvider,
      plugins: pluginsProvider
    };
    registerRefreshCommand(context, providers);
    registerInvokeCommand(context);
    registerSearchCommand(context, providers);
    registerClearFilterCommand(context, providers);
    registerFolderCommands(context, folderManager);

    console.log('Claude Code Browser activated successfully');
  } catch (error) {
    vscode.window.showErrorMessage(`Claude Code Browser failed to activate: ${error}`);
    console.error('Activation error:', error);
  }
}

export function deactivate(): void {
  console.log('Claude Code Browser deactivated');
}
