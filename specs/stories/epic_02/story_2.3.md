# Story 2.3: Implement Agents TreeDataProvider

**Epic:** Resource Discovery
**Priority:** P0
**Estimate:** Small

## Description

As a user, I want to see all my Claude Code agents listed in the sidebar so that I can discover and invoke them.

## Acceptance Criteria

```gherkin
Given agents exist in ~/.claude/agents/
When I open the Claude Code Browser panel
Then I see agents listed under "Agents" section
And each agent shows its name and description

Given an agent has tools defined in frontmatter
When I view the agent in the list
Then I can see the tools as secondary info (tooltip or description)

Given no agents exist
When I open the Claude Code Browser panel
Then I see "No agents found" message in the Agents section

Given an agent file has malformed YAML
When the provider loads agents
Then the malformed agent is skipped
And other agents load normally
```

## Technical Notes

### Data Source
```
~/.claude/agents/*.md
```

Note: Agents are currently global-only (no project-level agents observed).

### Agent File Format
```yaml
---
name: architecture
description: Senior Software Architect for system design
tools: Read, Grep, Glob, Bash, Write, Edit
disallowedTools: Write, Edit
model: opus
---

# Agent Content Below
```

### AgentsProvider Implementation
```typescript
// src/providers/agentsProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { parseAgentFile } from '../parsers/agentParser';

export interface AgentItem extends vscode.TreeItem {
  name: string;
  description: string;
  tools?: string;
  model?: string;
  filePath: string;
}

export class AgentsProvider implements vscode.TreeDataProvider<AgentItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  async getChildren(element?: AgentItem): Promise<AgentItem[]> {
    if (element) return []; // Agents are flat

    const agentsPath = path.join(os.homedir(), '.claude', 'agents');
    return this.loadAgentsFromPath(agentsPath);
  }

  getTreeItem(element: AgentItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private async loadAgentsFromPath(basePath: string): Promise<AgentItem[]> {
    // Scan for *.md files, parse each, return AgentItems
  }
}
```

### TreeItem Display
- `label`: Agent name
- `description`: Tools list (truncated)
- `tooltip`: Full description + tools + model
- `iconPath`: `$(hubot)` codicon or similar

## Definition of Done

- [ ] AgentsProvider class implemented
- [ ] Agents loaded from ~/.claude/agents/
- [ ] Agent displays name and tools
- [ ] Empty state handled gracefully
- [ ] Malformed files don't crash provider
