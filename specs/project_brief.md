# Project Brief: Claude Code Browser

> Generated from BMAD Phase 1 Analysis

---

## Problem Statement

Claude Code users accumulate skills, agents, MCP servers, and plugins but have no easy way to discover what's available or quickly invoke them. Currently you must remember slash commands or dig through filesystem directories. This friction reduces usage of powerful capabilities.

---

## Target User

**Primary Persona:** Claude Code Power User (Team Setting)

- **Who they are:** Developers using Claude Code daily with customized skills/agents
- **Their pain point:** Can't remember what skills exist, typing `/skillname` requires memory
- **What they need:** Visual browser to see all resources + one-click invocation
- **How they'll use this:** Glance at sidebar, click to invoke, search when needed

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Resource discovery | 100% visibility | All 4 resource types shown |
| Invocation speed | <2 seconds | Click to command in chat |
| Team adoption | 3+ users | Shared via VSIX or repo |

---

## Core Features (MVP)

1. **Sidebar TreeView** - Collapsible tree showing all resources
   - Priority: P0
   - Why essential: Core discovery mechanism

2. **Resource Categories** - 4 sections: Skills, Agents, MCP Servers, Plugins
   - Priority: P0
   - Why essential: Organizes different resource types

3. **Click-to-Invoke** - Insert `/command` into Claude Code chat (primary), copy to clipboard (fallback)
   - Priority: P0
   - Why essential: Core quick-access mechanism

4. **Search/Filter** - Filter resources by name/description
   - Priority: P1
   - Why essential: Scale when you have 50+ skills

5. **Scope Indicators** - Show global (~/.claude) vs project (.claude) resources
   - Priority: P1
   - Why essential: Understand where resources come from

---

## Out of Scope (Explicit)

- **Skill/Agent Editor** - No in-panel editing, just view and invoke
- **Plugin Installation** - No marketplace browser, just show what's installed
- **MCP Server Management** - No add/remove/configure, just display
- **Settings Modification** - Read-only access to config files

---

## Technical Constraints

### Platform/Stack
- VS Code Extension API (TypeScript)
- Node.js fs module for file reading
- VS Code TreeView API for sidebar
- No external dependencies beyond VS Code SDK

### Data Sources
```
Skills:
  - ~/.claude/skills/*/SKILL.md (global)
  - .claude/skills/*/SKILL.md (project)

Agents:
  - ~/.claude/agents/*.md (global)

MCP Servers:
  - .claude/.mcp.json (project)
  - ~/.claude/settings.json → mcpServers (global)

Plugins:
  - ~/.claude/plugins/installed_plugins.json
```

### Scale
- Expected users: Small team (3-10)
- Data volume: 1-100 skills, 1-20 agents, 1-10 MCP servers, 1-10 plugins
- Geography: Local machine only

### Security
- Read-only filesystem access
- No network calls
- No credential handling

---

## Timeline

- **Target launch:** MVP in 1 BMAD cycle
- **Key milestones:**
  - [x] Phase 1: Project Brief
  - [ ] Phase 2: PRD with stories
  - [ ] Phase 3: Architecture design
  - [ ] Phase 4: Implementation

---

## Team & Resources

- **Developer:** AI-assisted (Claude Code)
- **Budget constraints:** None (open source tooling)

---

## Open Questions

1. Can we programmatically insert text into Claude Code's chat input, or copy-to-clipboard only?
2. Should resources auto-refresh via file watching, or use a manual refresh button?
3. Final extension name: "Claude Code Browser" or alternative?

---

## Next Step

Proceed to Phase 2: Planning to create the full PRD with epics and stories.
