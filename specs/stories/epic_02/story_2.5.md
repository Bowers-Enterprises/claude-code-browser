# Story 2.5: Implement MCP Servers TreeDataProvider

**Epic:** Resource Discovery
**Priority:** P0
**Estimate:** Small

## Description

As a user, I want to see all configured MCP servers in the sidebar so that I know what external integrations are available.

## Acceptance Criteria

```gherkin
Given MCP servers are configured in .claude/.mcp.json
When I open the Claude Code Browser panel
Then I see project MCP servers listed under "MCP Servers" section
And each server shows its name and URL

Given MCP servers are configured in ~/.claude/settings.json
When I open the Claude Code Browser panel
Then I see global MCP servers in the list (if any)

Given no MCP servers are configured
When I open the Claude Code Browser panel
Then I see "No MCP servers configured" message

Given an MCP config file has invalid JSON
When the provider loads servers
Then the malformed config is skipped
And a warning is logged
```

## Technical Notes

### Data Sources
```
Project: {workspaceFolder}/.claude/.mcp.json
Global: ~/.claude/settings.json (mcpServers key, if present)
```

### MCP Config Format
```json
// .claude/.mcp.json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "..."
      }
    }
  }
}
```

### McpProvider Implementation
```typescript
// src/providers/mcpProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { parseMcpConfig, parseSettingsForMcp } from '../parsers/configParser';

export interface McpServerItem extends vscode.TreeItem {
  name: string;
  url: string;
  scope: 'global' | 'project';
}

export class McpProvider implements vscode.TreeDataProvider<McpServerItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<McpServerItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  async getChildren(element?: McpServerItem): Promise<McpServerItem[]> {
    if (element) return [];

    const servers: McpServerItem[] = [];

    // Load project MCP config
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const mcpPath = path.join(workspaceFolder.uri.fsPath, '.claude', '.mcp.json');
      const projectServers = await this.loadMcpServers(mcpPath, 'project');
      servers.push(...projectServers);
    }

    // Load global MCP config (from settings.json)
    const globalSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    const globalServers = await this.loadMcpFromSettings(globalSettingsPath);
    servers.push(...globalServers);

    return servers.sort((a, b) => a.name.localeCompare(b.name));
  }

  getTreeItem(element: McpServerItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private async loadMcpServers(filePath: string, scope: 'global' | 'project'): Promise<McpServerItem[]> {
    // Parse .mcp.json and return McpServerItems
  }

  private async loadMcpFromSettings(filePath: string): Promise<McpServerItem[]> {
    // Parse settings.json and extract mcpServers if present
  }
}
```

### TreeItem Display
- `label`: Server name (key from mcpServers object)
- `description`: URL (sanitized, no credentials)
- `tooltip`: Full URL + scope
- `iconPath`: `$(server)` or `$(cloud)` codicon

### Security Note
- Do NOT display headers, API keys, or other credentials
- Only show server name and base URL

## Definition of Done

- [ ] McpProvider class implemented
- [ ] Project MCP servers loaded from .claude/.mcp.json
- [ ] Global MCP servers loaded from ~/.claude/settings.json (if present)
- [ ] Server displays name and URL (no credentials)
- [ ] Empty state handled gracefully
- [ ] Malformed JSON doesn't crash provider
