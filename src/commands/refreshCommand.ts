import * as vscode from 'vscode';
import { SkillsProvider } from '../providers/skillsProvider';
import { AgentsProvider } from '../providers/agentsProvider';
import { McpProvider } from '../providers/mcpProvider';
import { PluginsProvider } from '../providers/pluginsProvider';

interface Providers {
  skills: SkillsProvider;
  agents: AgentsProvider;
  mcp: McpProvider;
  plugins: PluginsProvider;
}

export function registerRefreshCommand(
  context: vscode.ExtensionContext,
  providers: Providers
): void {
  // Debounce tracking
  let isRefreshing = false;

  const command = vscode.commands.registerCommand(
    'claudeCodeBrowser.refresh',
    async () => {
      if (isRefreshing) {
        return; // Debounce
      }

      isRefreshing = true;

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing Claude Code resources...',
            cancellable: false
          },
          async (progress) => {
            progress.report({ increment: 0 });

            providers.skills.refresh();
            progress.report({ increment: 25 });

            providers.agents.refresh();
            progress.report({ increment: 50 });

            providers.mcp.refresh();
            progress.report({ increment: 75 });

            providers.plugins.refresh();
            progress.report({ increment: 100 });
          }
        );

        vscode.window.showInformationMessage('Claude Code Browser refreshed');
      } finally {
        // Small delay before allowing next refresh
        setTimeout(() => {
          isRefreshing = false;
        }, 300);
      }
    }
  );

  context.subscriptions.push(command);
}
