# Changelog

All notable changes to the Claude Code Browser extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2025-02-04

### Added
- **Preview Skills**: Open SKILL.md in VS Code's markdown preview
  - Click the preview icon (👁) that appears when hovering over a skill
  - Or right-click a skill and select "Preview Skill"
  - Works for both global and project skills
- **Convert to Global Skill**: Promote project skills to global with one click
  - Right-click a project skill and select "Convert to Global Skill"
  - Copies the entire skill folder to `~/.claude/skills/`
  - Prompts for confirmation if a global skill with the same name exists

## [0.6.0] - 2025-02-04

### Added
- **Panel Visibility Manager**: Hide panels you don't use
  - "Manage Panels" command opens a checklist to toggle panels on/off
  - "Show All Panels" command to restore all panels
  - Preferences persist across VS Code sessions
  - Access via the list icon (≡) in any panel's toolbar

## [0.5.0] - 2025-02-03

### Added
- **Skill Marketplace**: Browse and install community skills with one click
  - **Staff Picks**: 15 curated skills from daymade, lackeyjb, obra, trailofbits
  - Categories: Productivity, Automation, Code Quality, Documentation, Testing, Deployment
  - Real skills: GitHub Ops, Playwright, TDD, Systematic Debugging, Static Analysis, Markdown Tools, PDF Creator, and more
  - **Add Your Own Sources**: Click "+" to add any GitHub repo containing skills
  - Skills from user sources are fetched and cached automatically
  - Right-click to Install or View on GitHub
- Toolbar buttons in Marketplace: Refresh, Add Source

## [0.4.0] - 2025-02-03

### Added
- **Custom Prompts Library**: Create, edit, and manage your own reusable prompts
  - "My Prompts" category at the top of Commands view
  - Create prompts with custom names, descriptions, and icons
  - Edit and delete prompts via right-click context menu
  - Export prompts to JSON for backup or sharing
  - Import prompts from JSON files (merge or replace modes)
- Toolbar buttons in Commands view: New Prompt (+), Export, Import

## [0.3.0] - 2025-02-03

### Added
- **Commands Section**: New panel with curated Claude Code commands and prompts
  - CLI Flags: `--dangerously-skip-permissions`, `--print`, `--verbose`, `--model`, `--resume`, `--continue`
  - Slash Commands: `/clear`, `/compact`, `/cost`, `/doctor`, `/help`, `/init`, `/memory`, `/model`, `/permissions`, `/review`, `/vim`, `/config`, `/status`, `/bug`
  - Quick Prompts: Run Autonomously, Fix All Errors, Write Tests, Explain Code, Refactor, Add Types, Security Review, Optimize, Add Docs, Commit, Create PR, Debug
- Click any command to copy it to clipboard
- Search/filter works across commands too

## [0.2.0] - 2025-02-03

### Added
- **Virtual Folders**: Organize skills, agents, MCP servers, and plugins into custom folders without affecting the file system
- **Drag and Drop**: Drag items into folders to organize them
- **Multi-select Support**: Select multiple items (Cmd+click or Shift+click) and move them all at once
- **Folder Management**: Create, rename, and delete folders via toolbar and context menu
- **Global MCP Config**: Now reads MCP servers from both project (`.mcp.json`) and global (`~/.claude/.mcp.json`) config files
- **Clear Filter Button**: Dedicated button to clear search filters (appears when filter is active)

### Fixed
- MCP servers now load from global config in addition to project config

## [0.1.0] - 2025-02-03

### Added
- Initial release
- **Skills Browser**: View and invoke skills from global (`~/.claude/skills/`) and project (`.claude/skills/`) directories
- **Agents Browser**: Browse custom agents from `~/.claude/agents/`
- **MCP Servers**: View configured MCP servers from `.claude/.mcp.json`
- **Plugins Browser**: See installed plugins from `~/.claude/plugins/`
- **Search/Filter**: Filter resources across all categories
- **Refresh**: Rescan directories for new resources
- **Scope Badges**: Visual indicators for global vs project-specific resources
- **Click-to-invoke**: Copy resource commands to clipboard with one click
