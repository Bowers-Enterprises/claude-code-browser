# Story 2.1: Implement Skills TreeDataProvider

**Epic:** Resource Discovery
**Priority:** P0
**Estimate:** Medium

## Description

As a user, I want to see all my Claude Code skills listed in the sidebar so that I can discover what's available.

## Acceptance Criteria

```gherkin
Given skills exist in ~/.claude/skills/
When I open the Claude Code Browser panel
Then I see global skills listed under "Skills" section
And each skill shows its name and description

Given skills exist in {workspace}/.claude/skills/
When I open the Claude Code Browser panel
Then I see project skills listed alongside global skills
And project skills are visually distinguished from global skills

Given no skills exist
When I open the Claude Code Browser panel
Then I see "No skills found" message in the Skills section

Given a skill has a malformed SKILL.md
When the provider loads skills
Then the malformed skill is skipped
And other skills load normally
And a warning is logged (not shown to user)
```

## Technical Notes

### Data Sources
```
Global: ~/.claude/skills/*/SKILL.md
Project: {workspaceFolder}/.claude/skills/*/SKILL.md
```

### SkillsProvider Implementation
```typescript
// src/providers/skillsProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { parseSkillFile } from '../parsers/skillParser';

export interface SkillItem extends vscode.TreeItem {
  name: string;
  description: string;
  scope: 'global' | 'project';
  filePath: string;
  command: string; // e.g., "/frontend-design"
}

export class SkillsProvider implements vscode.TreeDataProvider<SkillItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SkillItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  async getChildren(element?: SkillItem): Promise<SkillItem[]> {
    if (element) return []; // Skills are flat, no children

    const skills: SkillItem[] = [];

    // Load global skills
    const globalPath = path.join(os.homedir(), '.claude', 'skills');
    const globalSkills = await this.loadSkillsFromPath(globalPath, 'global');
    skills.push(...globalSkills);

    // Load project skills
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const projectPath = path.join(workspaceFolder.uri.fsPath, '.claude', 'skills');
      const projectSkills = await this.loadSkillsFromPath(projectPath, 'project');
      skills.push(...projectSkills);
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  getTreeItem(element: SkillItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private async loadSkillsFromPath(basePath: string, scope: 'global' | 'project'): Promise<SkillItem[]> {
    // Implementation uses fs to scan directories
    // Returns array of SkillItem
  }
}
```

### TreeItem Display
- `label`: Skill name (from YAML frontmatter or folder name)
- `description`: First line of description (truncated to 50 chars)
- `tooltip`: Full description
- `iconPath`: Different icons for global vs project (or use codicons)
- `contextValue`: 'skill' (for context menu actions)
- `command`: Trigger invoke on click

### Scope Badges
Use VS Code's `description` field to show scope:
```typescript
item.description = scope === 'global' ? '(Global)' : '(Project)';
```

Or use different icons:
- Global: `$(globe)` codicon
- Project: `$(folder)` codicon

## Definition of Done

- [ ] SkillsProvider class implemented
- [ ] Global skills loaded from ~/.claude/skills/
- [ ] Project skills loaded from workspace .claude/skills/
- [ ] Skills display name and description
- [ ] Scope indicator visible (Global/Project)
- [ ] Empty state handled gracefully
- [ ] Malformed files don't crash provider
