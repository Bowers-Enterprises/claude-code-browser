# Story 1.3: Implement Extension Activation

**Epic:** Extension Foundation
**Priority:** P0
**Estimate:** Small

## Description

As a developer, I need the extension to activate properly and initialize all providers so that the sidebar is functional when opened.

## Acceptance Criteria

```gherkin
Given VS Code starts with the extension installed
When the extension activates (onStartupFinished)
Then all TreeDataProviders are registered
And no errors appear in the Extension Host log

Given the extension is active
When I open the Claude Code Browser panel
Then providers begin scanning for resources
And results appear in each section (or "No items" if empty)

Given an error occurs during activation
When the error is caught
Then a user-friendly error message is shown
And the extension continues to function (graceful degradation)
```

## Technical Notes

### Activation Event
```json
{
  "activationEvents": ["onStartupFinished"]
}
```

Using `onStartupFinished` instead of `*` for better performance—extension loads after VS Code is fully ready.

### Extension Entry Point
```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { SkillsProvider } from './providers/skillsProvider';
import { AgentsProvider } from './providers/agentsProvider';
import { McpProvider } from './providers/mcpProvider';
import { PluginsProvider } from './providers/pluginsProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Browser activating...');

  try {
    // Register providers
    const skillsProvider = new SkillsProvider();
    const agentsProvider = new AgentsProvider();
    const mcpProvider = new McpProvider();
    const pluginsProvider = new PluginsProvider();

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.skills', skillsProvider),
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.agents', agentsProvider),
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.mcpServers', mcpProvider),
      vscode.window.registerTreeDataProvider('claudeCodeBrowser.plugins', pluginsProvider)
    );

    console.log('Claude Code Browser activated successfully');
  } catch (error) {
    vscode.window.showErrorMessage(`Claude Code Browser failed to activate: ${error}`);
    console.error('Activation error:', error);
  }
}

export function deactivate() {
  console.log('Claude Code Browser deactivated');
}
```

### Provider Interface
Each provider implements `vscode.TreeDataProvider<ResourceItem>`:
```typescript
interface ResourceItem extends vscode.TreeItem {
  name: string;
  description?: string;
  scope: 'global' | 'project';
  resourceType: 'skill' | 'agent' | 'mcp' | 'plugin';
  filePath?: string;
}
```

## Definition of Done

- [ ] Extension activates without errors
- [ ] All 4 providers registered
- [ ] Extension Host console shows activation success
- [ ] Deactivation cleans up subscriptions
- [ ] Error handling prevents crashes
