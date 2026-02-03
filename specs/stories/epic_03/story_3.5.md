# Story 3.5: Add Scope Badges (Global/Project)

**Epic:** Interaction & Polish
**Priority:** P1
**Estimate:** Small

## Description

As a user, I want to see whether a skill comes from my global config or the current project so that I understand where it's defined.

## Acceptance Criteria

```gherkin
Given a skill exists in ~/.claude/skills/
When I view it in the Skills list
Then it shows a "Global" indicator

Given a skill exists in {workspace}/.claude/skills/
When I view it in the Skills list
Then it shows a "Project" indicator

Given the same skill name exists in both locations
When I view the Skills list
Then both are shown with their respective scope badges
And they are distinguishable
```

## Technical Notes

### Display Options

**Option 1: Description Field**
```typescript
item.description = scope === 'global' ? '(Global)' : '(Project)';
```
Result: `frontend-design  (Project)`

**Option 2: Different Icons**
```typescript
item.iconPath = scope === 'global'
  ? new vscode.ThemeIcon('globe')
  : new vscode.ThemeIcon('folder');
```
Result: Shows globe or folder icon before name

**Option 3: Tree Grouping**
Group skills under "Global Skills" and "Project Skills" parent nodes:
```
Skills
├── Global Skills
│   └── gutsche-innovation
└── Project Skills
    ├── frontend-design
    ├── bmad
    └── ...
```

### Recommended Approach
Combine description + icon:
```typescript
function createSkillTreeItem(skill: SkillMetadata, scope: 'global' | 'project'): vscode.TreeItem {
  const item = new vscode.TreeItem(skill.name);

  // Show scope in description
  item.description = scope === 'global' ? '🌐 Global' : '📁 Project';

  // Or use VS Code icons (no emoji)
  item.iconPath = scope === 'global'
    ? new vscode.ThemeIcon('globe')
    : new vscode.ThemeIcon('folder-opened');

  // Full details in tooltip
  item.tooltip = new vscode.MarkdownString();
  item.tooltip.appendMarkdown(`**${skill.name}**\n\n`);
  item.tooltip.appendMarkdown(`${skill.description}\n\n`);
  item.tooltip.appendMarkdown(`_Scope: ${scope}_`);

  return item;
}
```

### Sorting with Scope
Sort project skills first (more relevant to current context):
```typescript
const allSkills = [...projectSkills, ...globalSkills];
// Or explicitly group:
return [
  ...projectSkills.sort((a, b) => a.name.localeCompare(b.name)),
  ...globalSkills.sort((a, b) => a.name.localeCompare(b.name))
];
```

### Visual Consistency
Apply same pattern to all resource types:
- Skills: Global/Project
- Agents: Global only (currently)
- MCP: Global/Project
- Plugins: User scope (from manifest)

## Definition of Done

- [ ] Scope indicator visible on each resource
- [ ] Global and Project visually distinguishable
- [ ] Tooltip includes scope information
- [ ] Pattern consistent across all resource types
