import * as vscode from 'vscode';
import { SkillsProvider } from './providers/skillsProvider';
import { AgentsProvider } from './providers/agentsProvider';
import { McpProvider } from './providers/mcpProvider';
import { PluginsProvider } from './providers/pluginsProvider';
import { CommandsProvider, registerCopyCommand, registerCustomPromptCommands } from './providers/commandsProvider';
import { MarketplaceProvider, registerMarketplaceCommands } from './providers/marketplaceProvider';
import { HookManagerProvider } from './providers/hookManagerProvider';
import { AgentTeamProvider, TeamTreeItem } from './providers/agentTeamProvider';
import { openAgentLiveView } from './providers/agentLiveView';
import { FolderManager } from './services/folderManager';
import { CustomPromptsManager } from './services/customPromptsManager';
import { MarketplaceSourceManager } from './services/marketplaceSourceManager';
import { ViewVisibilityManager, PANEL_LABELS } from './services/viewVisibilityManager';
import { SkillWatcherService } from './services/skillWatcherService';
import {
  registerInvokeCommand,
  registerRefreshCommand,
  registerSearchCommand,
  registerClearFilterCommand,
  registerFolderCommands,
  registerSkillCommands,
  registerAgentCommands,
  registerMcpCommands,
  registerResearchCommand,
  registerBundleCommands
} from './commands';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Claude Code Browser activating...');

  try {
    // Create folder manager for virtual folder organization
    const folderManager = new FolderManager(context);

    // Create custom prompts manager for user-created prompts
    const customPromptsManager = new CustomPromptsManager(context);

    // Create marketplace source manager for managing marketplace sources
    const marketplaceSourceManager = new MarketplaceSourceManager(context);

    // Create view visibility manager for panel management
    const viewVisibilityManager = new ViewVisibilityManager(context);

    // Apply saved panel visibility on startup
    await viewVisibilityManager.applyContextKeys();

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

    // Create new dashboard providers
    const hookManagerProvider = new HookManagerProvider(context.extensionUri);
    const agentTeamProvider = new AgentTeamProvider();

    // Register new dashboard tree views
    const hookManagerTreeView = vscode.window.createTreeView('claudeCodeBrowser.hookManager', {
      treeDataProvider: hookManagerProvider
    });
    const agentTeamsTreeView = vscode.window.createTreeView('claudeCodeBrowser.agentTeams', {
      treeDataProvider: agentTeamProvider
    });

    // Store all TreeView references for easy access
    const treeViews = {
      skills: skillsTreeView,
      agents: agentsTreeView,
      mcpServers: mcpTreeView,
      plugins: pluginsTreeView,
      commands: commandsTreeView,
      marketplace: marketplaceTreeView
    };

    // Register tree views for disposal
    context.subscriptions.push(
      skillsTreeView,
      agentsTreeView,
      mcpTreeView,
      pluginsTreeView,
      commandsTreeView,
      marketplaceTreeView,
      hookManagerTreeView,
      agentTeamsTreeView
    );

    // Register refresh commands for new panels
    context.subscriptions.push(
      vscode.commands.registerCommand('claudeCodeBrowser.refreshHookManager', () => hookManagerProvider.refresh()),
      vscode.commands.registerCommand('claudeCodeBrowser.refreshAgentTeams', () => agentTeamProvider.refresh()),
      vscode.commands.registerCommand('claudeCodeBrowser.agentTeams.watch', (item: TeamTreeItem) => {
        const agent = item?.agentInfo;
        if (agent) {
          openAgentLiveView({
            agentId: agent.agentId,
            slug: agent.slug,
            task: agent.fullTask || agent.task,
            jsonlPath: agent.jsonlPath,
            sessionId: agent.sessionId,
            agentType: agent.agentType,
          });
        }
      })
    );

    // Register hook manager CRUD commands
    context.subscriptions.push(
      vscode.commands.registerCommand('claudeCodeBrowser.hooks.add', (item?: any) => {
        hookManagerProvider.addHook(item?.eventName);
      }),
      vscode.commands.registerCommand('claudeCodeBrowser.hooks.edit', (item: any) => {
        hookManagerProvider.editHook(item);
      }),
      vscode.commands.registerCommand('claudeCodeBrowser.hooks.delete', (item: any) => {
        hookManagerProvider.deleteHook(item);
      }),
      vscode.commands.registerCommand('claudeCodeBrowser.hooks.toggle', (item: any) => {
        hookManagerProvider.toggleHook(item);
      }),
      vscode.commands.registerCommand('claudeCodeBrowser.hooks.duplicate', (item: any) => {
        hookManagerProvider.duplicateHook(item);
      }),
      vscode.commands.registerCommand('claudeCodeBrowser.hooks.openFile', (item: any) => {
        hookManagerProvider.openSettingsFile(item);
      })
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
    registerSkillCommands(context, skillsProvider);
    registerAgentCommands(context, agentsProvider);
    registerMcpCommands(context, mcpProvider);
    registerCopyCommand(context);
    registerCustomPromptCommands(context, customPromptsManager);
    registerMarketplaceCommands(context, marketplaceProvider);
    registerResearchCommand(context, skillsProvider);
    registerBundleCommands(context, skillsProvider, folderManager);

    // Create skill watcher for detecting new skills
    const skillWatcher = new SkillWatcherService(context);
    skillWatcher.start((skillName) => {
      vscode.window.showInformationMessage(
        `New skill "${skillName}" created!`,
        'Preview'
      ).then(choice => {
        if (choice === 'Preview') {
          skillsProvider.refresh();
        }
      });
      skillsProvider.refresh();
    });

    // Register panel management commands
    context.subscriptions.push(
      vscode.commands.registerCommand('claudeCodeBrowser.managePanels', async () => {
        const visibility = viewVisibilityManager.getVisibility();
        const items = Object.entries(PANEL_LABELS).map(([id, label]) => ({
          label,
          picked: visibility[id as keyof typeof visibility],
          id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: 'Select panels to show (uncheck to hide)',
          title: 'Manage Panels'
        });

        if (selected) {
          const selectedIds = new Set(selected.map(item => item.id));
          for (const panelId of Object.keys(PANEL_LABELS)) {
            await viewVisibilityManager.setVisibility(
              panelId as any,
              selectedIds.has(panelId)
            );
          }
          vscode.window.showInformationMessage('Panel visibility updated.');
        }
      }),

      vscode.commands.registerCommand('claudeCodeBrowser.showAllPanels', async () => {
        await viewVisibilityManager.setAllVisible();
        vscode.window.showInformationMessage('All panels are now visible.');
      })
    );

    console.log('Claude Code Browser activated successfully');
  } catch (error) {
    vscode.window.showErrorMessage(`Claude Code Browser failed to activate: ${error}`);
    console.error('Activation error:', error);
  }
}

export function deactivate(): void {
  console.log('Claude Code Browser deactivated');
}
