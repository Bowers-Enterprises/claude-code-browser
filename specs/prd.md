# PRD: Claude Code Browser

> VS Code Extension for discovering and invoking Claude Code resources

---

## Overview

**Product Name:** Claude Code Browser
**Version:** 1.0.0 (MVP)
**Type:** VS Code Extension

### Vision
A sidebar panel in VS Code that gives Claude Code users instant visibility into their skills, agents, MCP servers, and plugins—with one-click invocation.

### Problem
Users can't easily discover or remember available Claude Code resources. They must memorize slash commands or manually browse `~/.claude/` directories.

### Solution
A TreeView sidebar that scans Claude Code config locations, parses resource metadata, and enables quick invocation via click.

---

## Functional Requirements

### FR-1: Sidebar Container
The extension provides a dedicated sidebar view container in VS Code's activity bar.

**Acceptance Criteria:**
- Custom icon appears in activity bar
- Clicking icon reveals the Claude Code Browser panel
- Panel title shows "Claude Code Browser"

### FR-2: Skills TreeView
Display all available skills from global and project locations.

**Data Sources:**
- Global: `~/.claude/skills/*/SKILL.md`
- Project: `{workspaceFolder}/.claude/skills/*/SKILL.md`

**Display:**
- Collapsible "Skills" category at top level
- Each skill shows: name, description (truncated), scope badge (Global/Project)
- Skills sorted alphabetically within each scope

**Acceptance Criteria:**
- Global skills parsed from `~/.claude/skills/`
- Project skills parsed from workspace `.claude/skills/`
- YAML frontmatter extracted for name/description
- Scope indicator distinguishes global vs project

### FR-3: Agents TreeView
Display all available agents.

**Data Sources:**
- Global: `~/.claude/agents/*.md`

**Display:**
- Collapsible "Agents" category
- Each agent shows: name, description, tools list

**Acceptance Criteria:**
- Agent markdown files parsed from `~/.claude/agents/`
- YAML frontmatter extracted
- Tools list shown as secondary info

### FR-4: MCP Servers TreeView
Display configured MCP servers.

**Data Sources:**
- Project: `{workspaceFolder}/.claude/.mcp.json`
- Global: `~/.claude/settings.json` (mcpServers key)

**Display:**
- Collapsible "MCP Servers" category
- Each server shows: name, URL

**Acceptance Criteria:**
- JSON files parsed correctly
- Both project and global MCP configs merged
- URL displayed but not credentials/headers

### FR-5: Plugins TreeView
Display installed plugins.

**Data Sources:**
- `~/.claude/plugins/installed_plugins.json`

**Display:**
- Collapsible "Plugins" category
- Each plugin shows: name, version, scope

**Acceptance Criteria:**
- installed_plugins.json parsed
- Plugin name extracted from ID (e.g., "playground" from "playground@claude-plugins-official")
- Version and install date shown

### FR-6: Click-to-Invoke
Clicking a resource invokes it.

**Behavior:**
1. Primary: Insert `/resourcename` into active Claude Code chat input
2. Fallback: Copy `/resourcename` to clipboard with notification

**Acceptance Criteria:**
- Single click triggers invoke action
- Slash command correctly formatted
- Clipboard fallback works when chat insert unavailable
- Notification confirms action

### FR-7: Search/Filter
Filter visible resources by search query.

**Behavior:**
- Search box at top of panel
- Filters by name and description
- Case-insensitive
- Clears with X button or empty input

**Acceptance Criteria:**
- Filter applies across all categories
- Matching items highlighted or isolated
- Empty results shows "No matches" message

### FR-8: Refresh Command
Manually refresh resource list.

**Behavior:**
- Refresh icon in panel toolbar
- Re-scans all data sources
- Updates TreeView

**Acceptance Criteria:**
- Refresh button visible in toolbar
- Click triggers full rescan
- Changes in files reflected after refresh

---

## Non-Functional Requirements

### NFR-1: Performance
- Initial load < 500ms for typical setup (50 skills)
- Search filter updates < 100ms

### NFR-2: Reliability
- Graceful handling of missing/malformed files
- No crashes on parse errors (log and skip)

### NFR-3: Compatibility
- VS Code 1.85.0+ (November 2023)
- macOS, Windows, Linux

### NFR-4: Security
- Read-only filesystem access
- No network calls
- No credential/secret exposure in UI

---

## Epics & Stories

### Epic 1: Extension Foundation
Set up VS Code extension scaffolding with TypeScript, build system, and basic activation.

| Story | Title | Priority |
|-------|-------|----------|
| 1.1 | Initialize VS Code extension project | P0 |
| 1.2 | Create sidebar view container | P0 |
| 1.3 | Implement extension activation | P0 |

### Epic 2: Resource Discovery
Implement parsers and providers for each resource type.

| Story | Title | Priority |
|-------|-------|----------|
| 2.1 | Implement Skills TreeDataProvider | P0 |
| 2.2 | Implement skill YAML parser | P0 |
| 2.3 | Implement Agents TreeDataProvider | P0 |
| 2.4 | Implement agent markdown parser | P0 |
| 2.5 | Implement MCP Servers TreeDataProvider | P0 |
| 2.6 | Implement Plugins TreeDataProvider | P0 |

### Epic 3: Interaction & Polish
Add click-to-invoke, search, and refresh capabilities.

| Story | Title | Priority |
|-------|-------|----------|
| 3.1 | Implement click-to-invoke command | P0 |
| 3.2 | Add clipboard fallback | P0 |
| 3.3 | Implement search/filter | P1 |
| 3.4 | Add refresh command | P1 |
| 3.5 | Add scope badges (Global/Project) | P1 |

---

## User Flows

### Flow 1: Discover and Invoke Skill
1. User clicks Claude Code Browser icon in activity bar
2. Sidebar opens showing Skills category expanded
3. User scrolls to find "frontend-design" skill
4. User clicks skill name
5. `/frontend-design` is inserted into Claude Code chat (or copied)
6. User continues conversation with skill active

### Flow 2: Search for Resource
1. User opens Claude Code Browser
2. User types "email" in search box
3. TreeView filters to show only matching resources
4. User sees "direct-response-email", "story-email", "email-sequence"
5. User clicks desired skill

### Flow 3: Refresh After Adding Skill
1. User creates new skill via filesystem
2. Skill doesn't appear in panel (not yet scanned)
3. User clicks refresh icon
4. New skill appears in list

---

## Technical Notes

### YAML Frontmatter Parsing
Skills and agents use YAML frontmatter:
```yaml
---
name: skill-name
description: What it does
tools: Read, Grep, Glob
---
```

Use a simple regex or `gray-matter` library (if adding deps is acceptable).

### VS Code TreeView API
- `TreeDataProvider<T>` interface
- `TreeItem` for each node
- `EventEmitter` for refresh events
- `vscode.window.createTreeView()` for registration

### Potential API for Chat Insert
Research if Claude Code extension exposes commands:
- `claude.insertMessage`
- `claude.sendMessage`
- Or use `vscode.commands.executeCommand()` discovery

---

## Success Criteria

MVP is complete when:
- [ ] Extension installs and activates in VS Code
- [ ] Sidebar shows all 4 resource categories
- [ ] Skills from both global and project locations appear
- [ ] Clicking resource copies/inserts slash command
- [ ] Search filters resources correctly
- [ ] Can package as .vsix and share with team

---

## Next Step

Proceed to Phase 3: Solutioning to design architecture and tech stack.
