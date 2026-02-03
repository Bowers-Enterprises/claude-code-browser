import * as vscode from 'vscode';
import { SkillsProvider } from './providers/skillsProvider';
import { AgentsProvider } from './providers/agentsProvider';
import { McpProvider } from './providers/mcpProvider';
import { PluginsProvider } from './providers/pluginsProvider';
import { registerInvokeCommand, registerRefreshCommand, registerSearchCommand } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Claude Code Browser activating...');

  try {
    // Create providers
    const skillsProvider = new SkillsProvider();
    const agentsProvider = new AgentsProvider();
    const mcpProvider = new McpProvider();
    const pluginsProvider = new PluginsProvider();

    // Register tree data providers
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.skills', skillsProvider),
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.agents', agentsProvider),
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.mcpServers', mcpProvider),
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.plugins', pluginsProvider)
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

    console.log('Claude Code Browser activated successfully');
  } catch (error) {
    vscode.window.showErrorMessage(`Claude Code Browser failed to activate: ${error}`);
    console.error('Activation error:', error);
  }
}

export function deactivate(): void {
  console.log('Claude Code Browser deactivated');
}
