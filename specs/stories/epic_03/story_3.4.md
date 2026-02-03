# Story 3.4: Add Refresh Command

**Epic:** Interaction & Polish
**Priority:** P1
**Estimate:** Small

## Description

As a user who just added a new skill, I want to refresh the resource list so that new resources appear without restarting VS Code.

## Acceptance Criteria

```gherkin
Given I have the Claude Code Browser panel open
When I click the refresh button in the panel toolbar
Then all providers re-scan their data sources
And the TreeView updates with current resources

Given I added a new skill file
When I click refresh
Then the new skill appears in the list

Given I deleted a skill file
When I click refresh
Then the deleted skill no longer appears

Given a refresh is in progress
When I click refresh again
Then the second request is debounced or queued
```

## Technical Notes

### Refresh Button in View Title
```json
{
  "contributes": {
    "commands": [
      {
        "command": "claudeCodeBrowser.refresh",
        "title": "Refresh",
        "icon": "$(refresh)"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "claudeCodeBrowser.refresh",
          "when": "view =~ /claudeCodeBrowser\\./",
          "group": "navigation"
        }
      ]
    }
  }
}
```

### Refresh Command Implementation
```typescript
// src/commands/refreshCommand.ts
export function registerRefreshCommand(
  context: vscode.ExtensionContext,
  providers: {
    skills: SkillsProvider;
    agents: AgentsProvider;
    mcp: McpProvider;
    plugins: PluginsProvider;
  }
) {
  const command = vscode.commands.registerCommand(
    'claudeCodeBrowser.refresh',
    async () => {
      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Refreshing Claude Code resources...',
          cancellable: false
        },
        async () => {
          providers.skills.refresh();
          providers.agents.refresh();
          providers.mcp.refresh();
          providers.plugins.refresh();
        }
      );
    }
  );

  context.subscriptions.push(command);
}
```

### Provider Refresh Method
Each provider already has refresh() from earlier stories:
```typescript
class SkillsProvider {
  private _onDidChangeTreeData = new vscode.EventEmitter<SkillItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
```

### Debouncing (Optional Enhancement)
Prevent rapid refreshes:
```typescript
let refreshTimeout: NodeJS.Timeout | undefined;

function debouncedRefresh(providers: Providers) {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }
  refreshTimeout = setTimeout(() => {
    providers.skills.refresh();
    // ... other providers
    refreshTimeout = undefined;
  }, 300);
}
```

## Definition of Done

- [ ] Refresh command registered
- [ ] Refresh button appears in view title bar
- [ ] Click triggers all providers to refresh
- [ ] New/deleted resources reflected after refresh
- [ ] Progress indicator shown during refresh
