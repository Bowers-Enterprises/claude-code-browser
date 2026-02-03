import * as vscode from 'vscode';
import { SkillsProvider } from '../providers/skillsProvider';
import { AgentsProvider } from '../providers/agentsProvider';
import { McpProvider } from '../providers/mcpProvider';
import { PluginsProvider } from '../providers/pluginsProvider';
import { CommandsProvider } from '../providers/commandsProvider';

/**
 * Interface for all providers that need to be filtered
 */
interface Providers {
  skills: SkillsProvider;
  agents: AgentsProvider;
  mcp: McpProvider;
  plugins: PluginsProvider;
  commands?: CommandsProvider;
}

/**
 * Set the filter active context for showing/hiding clear button
 */
function setFilterActiveContext(active: boolean): void {
  vscode.commands.executeCommand('setContext', 'claudeCodeBrowser.filterActive', active);
}

/**
 * Clear filters on all providers
 */
function clearAllFilters(providers: Providers): void {
  providers.skills.setFilter('');
  providers.agents.setFilter('');
  providers.mcp.setFilter('');
  providers.plugins.setFilter('');
  providers.commands?.setFilter('');
  setFilterActiveContext(false);
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
  const searchCommand = vscode.commands.registerCommand(
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
      providers.commands?.setFilter(query);

      // Update context for clear button visibility
      setFilterActiveContext(query.length > 0);

      // Show feedback to user
      if (query) {
        vscode.window.showInformationMessage(`Filtering by: "${query}"`);
      } else {
        vscode.window.showInformationMessage('Filter cleared');
      }
    }
  );

  context.subscriptions.push(searchCommand);
}

/**
 * Register the clear filter command
 *
 * @param context - Extension context for managing subscriptions
 * @param providers - Object containing all provider instances
 */
export function registerClearFilterCommand(
  context: vscode.ExtensionContext,
  providers: Providers
): void {
  const clearCommand = vscode.commands.registerCommand(
    'claudeCodeBrowser.clearFilter',
    () => {
      clearAllFilters(providers);
      vscode.window.showInformationMessage('Filter cleared');
    }
  );

  context.subscriptions.push(clearCommand);
}
