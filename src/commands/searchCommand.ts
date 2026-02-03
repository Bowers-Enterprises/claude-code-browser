import * as vscode from 'vscode';
import { SkillsProvider } from '../providers/skillsProvider';
import { AgentsProvider } from '../providers/agentsProvider';
import { McpProvider } from '../providers/mcpProvider';
import { PluginsProvider } from '../providers/pluginsProvider';

/**
 * Interface for all providers that need to be filtered
 */
interface Providers {
  skills: SkillsProvider;
  agents: AgentsProvider;
  mcp: McpProvider;
  plugins: PluginsProvider;
}

/**
 * Register the search command that filters all resource providers
 *
 * @param context - Extension context for managing subscriptions
 * @param providers - Object containing all provider instances
 */
export function registerSearchCommand(
  context: vscode.ExtensionContext,
  providers: Providers
): void {
  const command = vscode.commands.registerCommand(
    'claudeCodeBrowser.search',
    async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search resources',
        placeHolder: 'Type to filter skills, agents, MCP servers, plugins...',
        value: ''
      });

      // If user cancelled (pressed Escape), do nothing
      if (query === undefined) {
        return;
      }

      // Apply filter to all providers
      providers.skills.setFilter(query);
      providers.agents.setFilter(query);
      providers.mcp.setFilter(query);
      providers.plugins.setFilter(query);

      // Show feedback to user
      if (query) {
        vscode.window.showInformationMessage(`Filtering by: "${query}"`);
      } else {
        vscode.window.showInformationMessage('Filter cleared');
      }
    }
  );

  context.subscriptions.push(command);
}
