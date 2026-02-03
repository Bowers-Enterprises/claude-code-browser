# Story 3.3: Implement Search/Filter

**Epic:** Interaction & Polish
**Priority:** P1
**Estimate:** Medium

## Description

As a user with many skills, I want to search/filter the resource list so that I can quickly find what I need.

## Acceptance Criteria

```gherkin
Given I have many resources in the browser
When I type in the search box
Then only resources matching the query are shown
And matching happens against name and description

Given I search for "email"
When results are displayed
Then I see "direct-response-email", "story-email", "email-sequence"
And other resources are hidden

Given I clear the search box
When the filter is removed
Then all resources are shown again

Given my search matches nothing
When results are displayed
Then I see "No matches found" in each section
```

## Technical Notes

### VS Code TreeView Filtering
VS Code TreeViews don't have built-in filtering. Options:

**Option 1: Custom Input Box + Provider Filtering**
```typescript
// Add search state to each provider
class SkillsProvider {
  private filterText: string = '';

  setFilter(text: string) {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  async getChildren(): Promise<SkillItem[]> {
    let skills = await this.loadAllSkills();

    if (this.filterText) {
      skills = skills.filter(s =>
        s.name.toLowerCase().includes(this.filterText) ||
        s.description.toLowerCase().includes(this.filterText)
      );
    }

    return skills;
  }
}
```

**Option 2: VS Code's Built-in Tree Filter**
VS Code 1.85+ supports `tree.enableFindWidget`:
```json
{
  "views": {
    "claude-code-browser": [
      {
        "id": "claudeCodeBrowser.skills",
        "name": "Skills",
        "canSelectMany": false
      }
    ]
  }
}
```
Then user can press Ctrl+F in the tree to filter.

**Option 3: Webview with Custom Search**
More complex but full control over UI.

### Recommended Approach
Use Option 1 (custom input + provider filtering) for best UX:

```typescript
// Register search command
vscode.commands.registerCommand('claudeCodeBrowser.search', async () => {
  const query = await vscode.window.showInputBox({
    prompt: 'Search resources',
    placeHolder: 'Type to filter skills, agents, MCP servers, plugins...'
  });

  if (query !== undefined) {
    skillsProvider.setFilter(query);
    agentsProvider.setFilter(query);
    mcpProvider.setFilter(query);
    pluginsProvider.setFilter(query);
  }
});

// Add search button to view title
{
  "contributes": {
    "menus": {
      "view/title": [
        {
          "command": "claudeCodeBrowser.search",
          "when": "view == claudeCodeBrowser.skills",
          "group": "navigation"
        }
      ]
    }
  }
}
```

### Alternative: Use VS Code's Native Find
Enable find widget for each tree view. User presses Ctrl+F to filter:
```typescript
const treeView = vscode.window.createTreeView('claudeCodeBrowser.skills', {
  treeDataProvider: skillsProvider,
  showCollapseAll: true,
  canSelectMany: false
});
// Native Ctrl+F filtering is automatically available
```

## Definition of Done

- [ ] Search/filter mechanism implemented
- [ ] Filters by name and description
- [ ] Works across all 4 resource types
- [ ] Clear filter restores full list
- [ ] Empty results message shown
- [ ] Search accessible via UI button or keyboard
