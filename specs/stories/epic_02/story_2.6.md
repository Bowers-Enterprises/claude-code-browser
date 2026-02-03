# Story 2.6: Implement Plugins TreeDataProvider

**Epic:** Resource Discovery
**Priority:** P0
**Estimate:** Small

## Description

As a user, I want to see all installed Claude Code plugins in the sidebar so that I can see what plugins I have.

## Acceptance Criteria

```gherkin
Given plugins are installed in ~/.claude/plugins/
When I open the Claude Code Browser panel
Then I see plugins listed under "Plugins" section
And each plugin shows its name and version

Given the installed_plugins.json exists
When the provider loads plugins
Then it parses the JSON and displays each plugin

Given no plugins are installed
When I open the Claude Code Browser panel
Then I see "No plugins installed" message

Given installed_plugins.json has invalid JSON
When the provider loads plugins
Then an error is logged
And the Plugins section shows "Unable to load plugins"
```

## Technical Notes

### Data Source
```
~/.claude/plugins/installed_plugins.json
```

### Plugin Manifest Format
```json
{
  "version": 2,
  "plugins": {
    "code-simplifier@claude-plugins-official": [
      {
        "scope": "user",
        "installPath": "/Users/.../plugins/cache/...",
        "version": "1.0.0",
        "installedAt": "2026-01-09T16:15:25.382Z",
        "lastUpdated": "2026-01-09T16:15:25.382Z"
      }
    ],
    "playground@claude-plugins-official": [
      {
        "scope": "user",
        "version": "27d2b86d72da",
        "gitCommitSha": "27d2b86d72da..."
      }
    ]
  }
}
```

### PluginsProvider Implementation
```typescript
// src/providers/pluginsProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { parsePluginsManifest } from '../parsers/configParser';

export interface PluginItem extends vscode.TreeItem {
  name: string;
  version: string;
  scope: string;
  marketplace?: string;
  installedAt?: string;
}

export class PluginsProvider implements vscode.TreeDataProvider<PluginItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PluginItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  async getChildren(element?: PluginItem): Promise<PluginItem[]> {
    if (element) return [];

    const manifestPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
    return this.loadPlugins(manifestPath);
  }

  getTreeItem(element: PluginItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private async loadPlugins(manifestPath: string): Promise<PluginItem[]> {
    // Parse installed_plugins.json and return PluginItems
  }
}
```

### Plugin Name Extraction
Plugin IDs are formatted as `name@marketplace`. Extract display name:
```typescript
function extractPluginName(pluginId: string): { name: string; marketplace: string } {
  const [name, marketplace] = pluginId.split('@');
  return { name, marketplace: marketplace || 'unknown' };
}
```

### TreeItem Display
- `label`: Plugin name (e.g., "playground")
- `description`: Version (e.g., "1.0.0")
- `tooltip`: Full ID + marketplace + install date
- `iconPath`: `$(extensions)` codicon

## Definition of Done

- [ ] PluginsProvider class implemented
- [ ] Plugins loaded from ~/.claude/plugins/installed_plugins.json
- [ ] Plugin displays name and version
- [ ] Marketplace info available in tooltip
- [ ] Empty state handled gracefully
- [ ] Malformed JSON doesn't crash provider
