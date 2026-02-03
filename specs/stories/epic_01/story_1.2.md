# Story 1.2: Create Sidebar View Container

**Epic:** Extension Foundation
**Priority:** P0
**Estimate:** Small

## Description

As a user, I want to see a Claude Code Browser icon in VS Code's activity bar so that I can access the resource browser panel.

## Acceptance Criteria

```gherkin
Given the extension is installed and activated
When I look at the VS Code activity bar (left sidebar icons)
Then I see a Claude Code Browser icon

Given I click the Claude Code Browser icon
When the sidebar panel opens
Then I see a panel titled "Claude Code Browser"

Given the panel is open
When I look at the panel structure
Then I see placeholder sections for:
  - Skills
  - Agents
  - MCP Servers
  - Plugins
```

## Technical Notes

### package.json contributes
```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-code-browser",
          "title": "Claude Code Browser",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "claude-code-browser": [
        {
          "id": "claudeCodeBrowser.skills",
          "name": "Skills"
        },
        {
          "id": "claudeCodeBrowser.agents",
          "name": "Agents"
        },
        {
          "id": "claudeCodeBrowser.mcpServers",
          "name": "MCP Servers"
        },
        {
          "id": "claudeCodeBrowser.plugins",
          "name": "Plugins"
        }
      ]
    }
  }
}
```

### Icon
Create a simple SVG icon (24x24) or use VS Code's built-in Codicons:
- Option 1: `$(symbol-misc)` codicon
- Option 2: Custom SVG in `resources/icon.svg`

### Extension Registration
```typescript
// extension.ts
const skillsProvider = new SkillsProvider();
vscode.window.registerTreeDataProvider('claudeCodeBrowser.skills', skillsProvider);
// ... repeat for other providers
```

## Definition of Done

- [ ] Activity bar icon visible
- [ ] Click opens sidebar panel
- [ ] Four view sections visible (Skills, Agents, MCP Servers, Plugins)
- [ ] Each section shows "No items" placeholder initially
